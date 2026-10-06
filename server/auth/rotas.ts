import { createHash, randomUUID } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { PERFIL_DEMO } from '../db/exemplo.js'
import { ErroConflito, type Perfil, type Repositorio, type Usuario } from '../db/repo.js'
import { esquemaCadastro, esquemaLogin } from '../esquemas.js'
import { lerCorpo } from '../http.js'
import { ipDe, naoAutenticado } from './middleware.js'
import { gerarHashSenha, verificarSenha } from './senha.js'
import { abrirSessao, encerrarSessao, sessaoDaRequisicao } from './sessao.js'

const MINUTO_MS = 60_000
const LIMITE_LOGIN = { maximo: 5, janelaMs: 15 * MINUTO_MS }
const LIMITE_DEMO = { maximo: 10, janelaMs: 60 * MINUTO_MS }

/* A chave guarda só um hash: IP e email não ficam em claro na tabela de tentativas. */
const chave = (...partes: string[]) => createHash('sha256').update(partes.join('|')).digest('hex')

async function excedeu(repo: Repositorio, chaveTentativa: string, limite: typeof LIMITE_LOGIN) {
  return await repo.contarTentativas(chaveTentativa, new Date(Date.now() - limite.janelaMs)) >= limite.maximo
}

function muitasTentativas(c: Context, limite: typeof LIMITE_LOGIN) {
  c.header('Retry-After', String(limite.janelaMs / 1000))
  return c.json({ erro: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.', codigo: 'MUITAS_TENTATIVAS' }, 429)
}

const conta = (usuario: Usuario, perfil: Perfil) => ({ usuario: { id: usuario.id, email: usuario.email }, perfil })

export function rotasAuth(repo: Repositorio): Hono {
  const rotas = new Hono()

  rotas.post('/cadastro', async (c) => {
    const { nome, dataNascimento, email, senha } = await lerCorpo(c, esquemaCadastro)
    const emUso = () => c.json({ erro: 'Este e-mail já tem uma conta', codigo: 'EMAIL_EM_USO' }, 409)
    if (await repo.buscarUsuarioPorEmail(email)) return emUso()

    const senhaHash = await gerarHashSenha(senha)
    const perfil = await repo.criarPaciente({ nome, dataNascimento, convidado: false })
    let usuario: Usuario
    try {
      usuario = await repo.criarUsuario({ email, senhaHash, pacienteId: perfil.pacienteId })
    } catch (e) {
      /* Corrida entre dois cadastros com o mesmo email: desfaz o paciente órfão. */
      await repo.excluirPaciente(perfil.pacienteId)
      if (e instanceof ErroConflito) return emUso()
      throw e
    }
    await abrirSessao(c, repo, usuario, false)
    return c.json(conta(usuario, perfil), 201)
  })

  rotas.post('/login', async (c) => {
    const { email, senha } = await lerCorpo(c, esquemaLogin)
    const chaveLogin = chave('login', ipDe(c), email)
    if (await excedeu(repo, chaveLogin, LIMITE_LOGIN)) return muitasTentativas(c, LIMITE_LOGIN)

    const usuario = await repo.buscarUsuarioPorEmail(email)
    const perfil = usuario && await verificarSenha(senha, usuario.senhaHash) && await repo.obterPerfil(usuario.pacienteId)
    if (!usuario || !perfil) {
      await repo.registrarTentativa(chaveLogin)
      return c.json({ erro: 'E-mail ou senha incorretos', codigo: 'CREDENCIAIS_INVALIDAS' }, 401)
    }
    await abrirSessao(c, repo, usuario, perfil.convidado)
    return c.json(conta(usuario, perfil))
  })

  rotas.post('/logout', async (c) => {
    await encerrarSessao(c, repo)
    return c.body(null, 204)
  })

  rotas.get('/sessao', async (c) => {
    const sessao = await sessaoDaRequisicao(c, repo)
    return sessao ? c.json(conta(sessao.usuario, sessao.perfil)) : naoAutenticado(c)
  })

  rotas.post('/demo', async (c) => {
    const chaveDemo = chave('demo', ipDe(c))
    if (await excedeu(repo, chaveDemo, LIMITE_DEMO)) return muitasTentativas(c, LIMITE_DEMO)
    await repo.registrarTentativa(chaveDemo)

    const { pacienteId } = await repo.criarPaciente(PERFIL_DEMO)
    const perfil = (await repo.aplicarOnboarding(pacienteId, 'exemplo'))!
    const usuario = await repo.criarUsuario({
      email: `convidado+${randomUUID()}@nurai.demo`, senhaHash: null, pacienteId,
    })
    await abrirSessao(c, repo, usuario, true)
    return c.json(conta(usuario, perfil), 201)
  })

  return rotas
}
