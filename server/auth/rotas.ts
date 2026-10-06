import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { PERFIL_DEMO } from '../db/exemplo.js'
import { ErroConflito, type Perfil, type Repositorio, type Usuario } from '../db/repo.js'
import { esquemaCadastro, esquemaLogin } from '../esquemas.js'
import { lerCorpo } from '../http.js'
import { chave, excedeu, limitarPorIp, muitasTentativas } from './limite.js'
import { limpezaOportunista } from './limpeza.js'
import { ipDe, naoAutenticado } from './middleware.js'
import { gerarHashSenha, verificarSenha } from './senha.js'
import { abrirSessao, encerrarSessao, sessaoDaRequisicao } from './sessao.js'

const MINUTO_MS = 60_000
const LIMITE_LOGIN = { maximo: 5, janelaMs: 15 * MINUTO_MS }
/* Por IP, e uma sala de aula ou um teste de usabilidade inteiro sai pelo mesmo IP (NAT da rede):
   o teto barra robô sem barrar uma turma. Conta toda tentativa de cadastro, válida ou não. */
const LIMITE_DEMO = { maximo: 50, janelaMs: 60 * MINUTO_MS }
const LIMITE_CADASTRO = { maximo: 50, janelaMs: 60 * MINUTO_MS }

const conta = (usuario: Usuario, perfil: Perfil) => ({ usuario: { id: usuario.id, email: usuario.email }, perfil })

export function rotasAuth(repo: Repositorio): Hono {
  const rotas = new Hono()

  rotas.post('/cadastro', async (c) => {
    const bloqueio = await limitarPorIp(c, repo, 'cadastro', LIMITE_CADASTRO,
      'Muitas contas foram criadas a partir desta rede na última hora.')
    if (bloqueio) return bloqueio
    await limpezaOportunista(repo)
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
    await limpezaOportunista(repo)
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
    const bloqueio = await limitarPorIp(c, repo, 'demo', LIMITE_DEMO,
      'Muitas demonstrações foram abertas a partir desta rede na última hora.')
    if (bloqueio) return bloqueio
    await limpezaOportunista(repo)

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
