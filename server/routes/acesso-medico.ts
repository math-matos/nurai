import { Hono, type Context } from 'hono'
import { gerarResumo } from '../ai/casos/resumo.js'
import type { LlmProvider } from '../ai/provider.js'
import { limitarPorIp } from '../auth/limite.js'
import { normalizarCodigo } from '../db/codigo.js'
import type { Perfil, Repositorio } from '../db/repo.js'
import { esquemaAcessoMedico, esquemaResumoMedico } from '../esquemas.js'
import { lerCorpo } from '../http.js'

/* Toda requisição conta, válida ou não: 31^6 códigos com 10 tentativas por minuto inviabilizam a varredura. */
const LIMITE = { maximo: 10, janelaMs: 60_000 }
const PAPEL = 'Profissional de saúde (via código)'
const ESPECIALIDADE_PADRAO = 'Clínica geral'

/* Inexistente, revogado e expirado respondem igual: a resposta não diz se o código já existiu. */
const codigoInvalido = (c: Context) =>
  c.json({ erro: 'Código inválido ou expirado', codigo: 'CODIGO_INVALIDO' }, 404)

/* Só o que o médico precisa: nada de email, ids de usuário ou do paciente. */
const pacienteVisivel = ({ nome, idade, condicoes, alergias }: Perfil) =>
  ({ nome, ...(idade !== undefined && { idade }), condicoes, alergias })

/* Sem sessão: o código é a credencial, e o acesso fica registrado no log do paciente. */
export function rotasAcessoMedico(repo: Repositorio, llm: LlmProvider): Hono {
  const rotas = new Hono()

  rotas.use('*', async (c, next) => {
    const bloqueio = await limitarPorIp(c, repo, 'acesso-medico', LIMITE)
    if (bloqueio) return bloqueio
    await next()
  })

  async function abrir(codigo: string) {
    const acesso = await repo.buscarCompartilhamentoAtivo(normalizarCodigo(codigo))
    const perfil = acesso && await repo.obterPerfil(acesso.pacienteId)
    return acesso && perfil ? { ...acesso, perfil, repoPaciente: repo.paraPaciente(acesso.pacienteId) } : null
  }

  rotas.post('/', async (c) => {
    const { codigo, profissional } = await lerCorpo(c, esquemaAcessoMedico)
    const acesso = await abrir(codigo)
    if (!acesso) return codigoInvalido(c)
    const { eventos, passos } = await acesso.repoPaciente.estado()
    await acesso.repoPaciente.registrarAcesso({
      quem: profissional, papel: PAPEL, acao: 'Abriu o histórico pelo código', itens: acesso.para,
    })
    return c.json({
      paciente: pacienteVisivel(acesso.perfil),
      para: acesso.para,
      expiraEm: acesso.expiraEm,
      eventos,
      passos: passos.filter((p) => !p.feito),
    })
  })

  rotas.post('/resumo', async (c) => {
    const { codigo, profissional, especialidade = ESPECIALIDADE_PADRAO } = await lerCorpo(c, esquemaResumoMedico)
    const acesso = await abrir(codigo)
    if (!acesso) return codigoInvalido(c)
    const contexto = { repo: acesso.repoPaciente, perfil: acesso.perfil, llm }
    return c.json(await gerarResumo(contexto, especialidade, {
      quem: profissional, papel: PAPEL, acao: 'Gerou resumo pré-consulta pelo código',
    }))
  })

  return rotas
}
