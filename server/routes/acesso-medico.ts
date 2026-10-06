import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { gerarResumo } from '../ai/casos/resumo.js'
import { pontosDoHistorico } from '../ai/fatos.js'
import type { LlmProvider } from '../ai/provider.js'
import { limitarPorIp, type Limite } from '../auth/limite.js'
import { normalizarCodigo } from '../db/codigo.js'
import type { Perfil, Repositorio } from '../db/repo.js'
import { esquemaAcessoMedico, esquemaResumoMedico, esquemaVerificacaoMedico } from '../esquemas.js'
import { lerCorpo } from '../http.js'

/* Toda requisição conta, válida ou não: 31^6 códigos com 10 tentativas por minuto inviabilizam a varredura. */
const LIMITE = { maximo: 10, janelaMs: 60_000 }
/* Balde próprio: a tela aberta revalida a cada minuto, e vários profissionais atrás do mesmo IP (clínica)
   não podem gastar o limite de abertura. 60 por minuto ainda inviabiliza varrer 31^6 códigos. */
const LIMITE_VERIFICAR = { maximo: 60, janelaMs: 60_000 }
const PAPEL = 'Profissional de saúde (via código)'
const ESPECIALIDADE_PADRAO = 'Clínica geral'

/* Inexistente, revogado e expirado respondem igual: a resposta não diz se o código já existiu. */
const codigoInvalido = (c: Context) =>
  c.json({ erro: 'Código inválido ou expirado', codigo: 'CODIGO_INVALIDO' }, 404)

/* Só o que o médico precisa: nada de email, ids de usuário ou do paciente. O responsável aparece para o
   médico saber quem enviou as informações quando não foi o próprio paciente. */
const pacienteVisivel = ({ nome, idade, condicoes, alergias, responsavel }: Perfil) => ({
  nome, ...(idade !== undefined && { idade }), condicoes, alergias,
  ...(responsavel && { responsavel: { nome: responsavel.nome, relacao: responsavel.relacao } }),
})

/* No log do paciente, só o fim do código: identifica qual foi sem reexpor a credencial. */
const codigoParcial = (codigo: string) => `••••${codigo.slice(-2)}`

/* Sem sessão: o código é a credencial, e o acesso fica registrado no log do paciente. */
export function rotasAcessoMedico(repo: Repositorio, llm: LlmProvider): Hono {
  const rotas = new Hono()

  const limitar = (nome: string, limite: Limite): MiddlewareHandler => async (c, next) => {
    const bloqueio = await limitarPorIp(c, repo, nome, limite)
    if (bloqueio) return bloqueio
    await next()
  }
  const limiteAbertura = limitar('acesso-medico', LIMITE)

  /* Código que existiu mas foi revogado ou expirou: a tentativa vai para o log do dono (a Privacidade promete
     registrar inclusive as recusadas). Código inexistente não tem dono, então não há onde registrar. */
  async function abrir(codigoBruto: string, profissional: string) {
    const codigo = normalizarCodigo(codigoBruto)
    const encontrado = await repo.buscarCompartilhamento(codigo)
    if (!encontrado) return null
    const repoPaciente = repo.paraPaciente(encontrado.pacienteId)
    if (encontrado.situacao !== 'ativo') {
      await repoPaciente.registrarAcesso({
        quem: profissional, papel: PAPEL, acao: `Tentativa recusada: código ${encontrado.situacao}`, itens: codigoParcial(codigo),
      })
      return null
    }
    const perfil = await repo.obterPerfil(encontrado.pacienteId)
    return perfil ? { ...encontrado, perfil, repoPaciente } : null
  }

  rotas.post('/', limiteAbertura, async (c) => {
    const { codigo, profissional } = await lerCorpo(c, esquemaAcessoMedico)
    const acesso = await abrir(codigo, profissional)
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
      /* Calculados no acesso: valem mesmo que o paciente nunca tenha gerado os próximos passos. */
      pontosEmAberto: pontosDoHistorico(eventos),
      /* Mantido por compatibilidade: são os passos gravados pelo paciente, que podem não existir. */
      passos: passos.filter((p) => !p.feito),
    })
  })

  /* A tela do médico revalida o código sem abrir o histórico de novo: sem log e com limite por IP próprio. */
  rotas.post('/verificar', limitar('acesso-medico-verificar', LIMITE_VERIFICAR), async (c) => {
    const { codigo } = await lerCorpo(c, esquemaVerificacaoMedico)
    const ativo = await repo.buscarCompartilhamentoAtivo(normalizarCodigo(codigo))
    return ativo ? c.body(null, 204) : codigoInvalido(c)
  })

  rotas.post('/resumo', limiteAbertura, async (c) => {
    const { codigo, profissional, especialidade = ESPECIALIDADE_PADRAO } = await lerCorpo(c, esquemaResumoMedico)
    const acesso = await abrir(codigo, profissional)
    if (!acesso) return codigoInvalido(c)
    const contexto = { repo: acesso.repoPaciente, perfil: acesso.perfil, llm }
    return c.json(await gerarResumo(contexto, especialidade, {
      quem: profissional, papel: PAPEL, acao: 'Gerou resumo pré-consulta pelo código',
    }))
  })

  return rotas
}
