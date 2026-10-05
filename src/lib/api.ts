import type { FONTES_CONECTADAS } from '../data/seed'
import type { AcessoLog, Consentimento, Evento, ProximoPasso } from '../data/types'

export type FonteConectada = (typeof FONTES_CONECTADAS)[number]
export type GeradoPor = 'oci' | 'mock'

export interface Compartilhamento { codigo: string; criadoEm: string; para: string }

export interface EstadoServidor {
  eventos: Evento[]
  consentimentos: Consentimento[]
  acessos: AcessoLog[]
  passos: ProximoPasso[]
  fontes: FonteConectada[]
  compartilhamento: Compartilhamento | null
}

export interface Saude { ok: boolean; genai: GeradoPor; db: 'oracle' | 'memoria'; versao: string }

export interface SerieTemporal {
  nome: string
  unidade: string
  pontos: { data: string; valor: number }[]
}

export interface RespostaCopiloto {
  texto: string[]
  ancoras: string[]
  serie?: SerieTemporal
  aviso?: string
  geradoPor: GeradoPor
}

export interface TurnoHistorico { pergunta: string; texto: string[] }

export interface Extracao {
  evento: Omit<Evento, 'id'>
  avisos: string[]
  geradoPor: GeradoPor
}

export interface Explicacao {
  explicacao: string[]
  pontosDeAtencao: string[]
  perguntasParaMedico: string[]
  ancoras: string[]
  aviso: string
  geradoPor: GeradoPor
}

export interface ResumoIa {
  especialidade: string
  sintese: string[]
  pontos: { texto: string; ancoras: string[] }[]
  perguntasSugeridas: string[]
  aviso: string
  geradoPor: GeradoPor
}

export interface PassosGerados { passos: ProximoPasso[]; geradoPor: GeradoPor }

export type CodigoErro =
  | 'IA_INDISPONIVEL' | 'IA_RESPOSTA_INVALIDA' | 'PDF_SEM_TEXTO' | 'PDF_INVALIDO' | 'ARQUIVO_GRANDE'
  | 'NAO_CLINICO' | 'CORPO_GRANDE' | 'REDE' | 'TEMPO_ESGOTADO' | 'VALIDACAO' | 'NAO_ENCONTRADO' | 'RECUSADO' | 'SERVIDOR'

const MENSAGENS: Record<CodigoErro, string> = {
  IA_INDISPONIVEL: 'A IA está indisponível agora. Tente de novo em alguns instantes.',
  IA_RESPOSTA_INVALIDA: 'A IA devolveu uma resposta que não passou na conferência, então ela foi descartada. Tente de novo.',
  PDF_SEM_TEXTO: 'Este PDF não tem texto selecionável (parece uma imagem digitalizada). Cole o texto do documento ou envie outro arquivo.',
  PDF_INVALIDO: 'Não conseguimos abrir este arquivo como PDF. Ele pode estar corrompido ou ter outro formato com a extensão .pdf. Exporte o documento de novo em PDF ou cole o texto dele.',
  ARQUIVO_GRANDE: 'O arquivo passa do limite de 4 MB. Envie um PDF menor ou cole o texto do documento.',
  CORPO_GRANDE: 'O conteúdo enviado é grande demais para o servidor. Envie um texto menor.',
  NAO_CLINICO: 'Não reconhecemos este conteúdo como um documento de saúde. Confira se é um laudo, resultado de exame ou receita.',
  REDE: 'Não foi possível falar com o servidor. Verifique a conexão e tente de novo.',
  TEMPO_ESGOTADO: 'A resposta demorou mais do que o esperado. Tente de novo.',
  VALIDACAO: 'Alguns dados não passaram na conferência do servidor.',
  NAO_ENCONTRADO: 'Este item não foi encontrado no servidor.',
  RECUSADO: 'O servidor não aceitou este pedido. Confira os dados enviados antes de tentar outra vez.',
  SERVIDOR: 'O servidor encontrou um erro inesperado. Tente de novo.',
}

/* Só vale oferecer "Tentar de novo" quando repetir o mesmo pedido pode dar certo:
   falha de rede, demora ou instabilidade do servidor/IA. Erros de entrada (4xx)
   pedem que a pessoa mude o que enviou. */
const REPETIVEIS = new Set<CodigoErro>(['REDE', 'TEMPO_ESGOTADO', 'SERVIDOR', 'IA_INDISPONIVEL', 'IA_RESPOSTA_INVALIDA'])

export class ErroApi extends Error {
  readonly codigo: CodigoErro
  readonly status: number

  constructor(codigo: CodigoErro, status: number, mensagem = MENSAGENS[codigo]) {
    super(mensagem)
    this.name = 'ErroApi'
    this.codigo = codigo
    this.status = status
  }

  get repetivel(): boolean {
    return REPETIVEIS.has(this.codigo)
  }
}

export function mensagemDeErro(erro: unknown): string {
  return erro instanceof ErroApi ? erro.message : MENSAGENS.SERVIDOR
}

/* Erro desconhecido (bug de cliente, por exemplo) conta como repetível, como o SERVIDOR. */
export function podeRepetir(erro: unknown): boolean {
  return erro instanceof ErroApi ? erro.repetivel : true
}

const CODIGOS_DO_SERVIDOR = new Set<string>([
  'IA_INDISPONIVEL', 'IA_RESPOSTA_INVALIDA', 'PDF_SEM_TEXTO', 'PDF_INVALIDO', 'ARQUIVO_GRANDE', 'NAO_CLINICO', 'CORPO_GRANDE',
])

function erroDaResposta(status: number, corpo: unknown): ErroApi {
  const { erro, codigo } = (corpo ?? {}) as { erro?: string; codigo?: string }
  if (codigo && CODIGOS_DO_SERVIDOR.has(codigo)) return new ErroApi(codigo as CodigoErro, status)
  // 413 sem corpo JSON: a plataforma barrou o upload antes de chegar à API.
  if (status === 413) return new ErroApi('ARQUIVO_GRANDE', status)
  // 5xx sem corpo JSON: o proxy não alcançou a API.
  if (corpo === null && status >= 500) return new ErroApi('REDE', status)
  if (status === 400) return new ErroApi('VALIDACAO', status, erro ? `${MENSAGENS.VALIDACAO} ${erro}` : undefined)
  if (status === 404) return new ErroApi('NAO_ENCONTRADO', status)
  if (status >= 400 && status < 500) return new ErroApi('RECUSADO', status)
  return new ErroApi('SERVIDOR', status)
}

const TEMPO_LIMITE_MS = 60_000

async function requisitar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch(`/api${caminho}`, { ...init, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) })
  } catch (erro) {
    throw new ErroApi(erro instanceof DOMException && erro.name === 'TimeoutError' ? 'TEMPO_ESGOTADO' : 'REDE', 0)
  }
  const corpo: unknown = await resposta.json().catch(() => null)
  if (!resposta.ok) throw erroDaResposta(resposta.status, corpo)
  if (corpo === null) throw new ErroApi('REDE', resposta.status)
  return corpo as T
}

const json = (metodo: string, corpo?: unknown): RequestInit => ({
  method: metodo,
  headers: { 'Content-Type': 'application/json' },
  body: corpo === undefined ? undefined : JSON.stringify(corpo),
})

const enc = encodeURIComponent

export const api = {
  saude: () => requisitar<Saude>('/health'),
  estado: () => requisitar<EstadoServidor>('/estado'),
  acessos: () => requisitar<AcessoLog[]>('/acessos'),
  reiniciar: () => requisitar<EstadoServidor>('/reiniciar', json('POST')),

  adicionarEvento: (evento: Evento) => requisitar<Evento>('/eventos', json('POST', evento)),
  alternarConsentimento: (id: string) => requisitar<Consentimento>(`/consentimentos/${enc(id)}`, json('PATCH')),
  alternarPasso: (id: string) => requisitar<ProximoPasso>(`/passos/${enc(id)}`, json('PATCH')),
  conectarFonte: (id: string) => requisitar<FonteConectada>(`/fontes/${enc(id)}/conectar`, json('POST')),
  compartilhar: (para: string) => requisitar<Compartilhamento>('/compartilhamentos', json('POST', { para })),

  copiloto: (pergunta: string, historico: TurnoHistorico[]) =>
    requisitar<RespostaCopiloto>('/copiloto', json('POST', { pergunta, historico })),

  extrairTexto: (texto: string, nomeArquivo?: string) =>
    requisitar<Extracao>('/extrair', json('POST', { texto, nomeArquivo })),

  extrairPdf: (arquivo: File) => {
    const dados = new FormData()
    dados.append('arquivo', arquivo)
    return requisitar<Extracao>('/extrair', { method: 'POST', body: dados })
  },

  explicarExame: (id: string) => requisitar<Explicacao>(`/exames/${enc(id)}/explicar`, json('POST')),
  resumo: (especialidade: string) => requisitar<ResumoIa>('/resumo', json('POST', { especialidade })),
  gerarPassos: () => requisitar<PassosGerados>('/passos/gerar', json('POST')),
}
