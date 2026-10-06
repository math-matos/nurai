import type { FONTES_CONECTADAS } from '../data/seed'
import type { AcessoLog, Consentimento, Evento, ProximoPasso } from '../data/types'

export type FonteConectada = (typeof FONTES_CONECTADAS)[number]
export type GeradoPor = 'oci' | 'mock'

/* criadoEm e expiraEm já chegam formatados (DD/MM/AAAA HH:mm, horário de Brasília). */
export interface Compartilhamento { codigo: string; criadoEm: string; para: string; expiraEm: string }

export type Onboarding = 'pendente' | 'vazio' | 'exemplo'
export type ModoOnboarding = Exclude<Onboarding, 'pendente'>

/* Quem usa a conta para cuidar do histórico de outra pessoa; relacao é o que ele é do paciente (ex.: "filho"). */
export interface Responsavel { nome: string; relacao: string }

/* Vai para o log e para o médico como "Rafael (filho)". */
export const RELACOES = ['filho', 'filha', 'pai', 'mãe', 'cônjuge', 'outro'] as const

/* nome é o do paciente, dono do histórico; com responsavel, a conta é de quem cuida dele. */
export interface Perfil {
  pacienteId: string
  nome: string
  iniciais: string
  dataNascimento?: string
  idade?: number
  condicoes: string[]
  alergias: string[]
  cartaoSus?: string
  plano?: string
  responsavel?: Responsavel
  onboarding: Onboarding
  convidado: boolean
}

/* "Para alguém que eu cuido": o histórico passa a ser deste paciente e quem criou a conta vira o responsável. */
export interface PacienteCuidado { nome: string; dataNascimento?: string; relacao: string }

export interface Usuario { id: string; email: string }
export interface Conta { usuario: Usuario; perfil: Perfil }

export interface DadosCadastro {
  nome: string
  email: string
  senha: string
  dataNascimento?: string
  aceiteLgpd: true
}

/* '' remove um campo opcional. */
export interface MudancasPerfil {
  nome?: string
  dataNascimento?: string
  condicoes?: string[]
  alergias?: string[]
  cartaoSus?: string
  plano?: string
  /* null: o histórico volta a ser do próprio usuário. */
  responsavel?: Responsavel | null
}

/* Calculado no acesso a partir dos registros (não depende dos passos gravados pelo paciente). */
export interface PontoEmAberto {
  tipo: 'repeticao' | 'pedido' | 'reavaliacao' | 'retorno'
  texto: string
  ancoras: string[]
}

export interface AcessoMedico {
  paciente: { nome: string; idade?: number; condicoes: string[]; alergias: string[]; responsavel?: Responsavel }
  para: string
  expiraEm: string
  eventos: Evento[]
  pontosEmAberto: PontoEmAberto[]
  /* Passos gravados pelo paciente; mantidos por compatibilidade. */
  passos: ProximoPasso[]
}

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

export interface AlertaExtracao { codigo: 'PACIENTE_DIVERGENTE'; texto: string }

export interface Extracao {
  evento: Omit<Evento, 'id'>
  avisos: string[]
  /* Pedem confirmação explícita antes de salvar (documento de outro paciente). */
  alertas: AlertaExtracao[]
  pacienteNoDocumento?: string
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
  | 'EMAIL_EM_USO' | 'CREDENCIAIS_INVALIDAS' | 'MUITAS_TENTATIVAS' | 'NAO_AUTENTICADO' | 'CODIGO_INVALIDO' | 'CSRF'

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
  EMAIL_EM_USO: 'Este e-mail já tem uma conta. Entre com ele ou use outro e-mail.',
  CREDENCIAIS_INVALIDAS: 'E-mail ou senha incorretos.',
  MUITAS_TENTATIVAS: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
  NAO_AUTENTICADO: 'Sua sessão terminou. Entre de novo para continuar.',
  CODIGO_INVALIDO: 'Código inválido, expirado ou revogado. Confira com o paciente se o acesso ainda está ativo.',
  CSRF: 'O pedido foi bloqueado pela proteção de segurança. Recarregue a página e tente de novo.',
}

/* Só vale oferecer "Tentar de novo" quando repetir o mesmo pedido pode dar certo:
   falha de rede, demora ou instabilidade do servidor/IA. Erros de entrada (4xx)
   pedem que a pessoa mude o que enviou. */
const REPETIVEIS = new Set<CodigoErro>(['REDE', 'TEMPO_ESGOTADO', 'SERVIDOR', 'IA_INDISPONIVEL', 'IA_RESPOSTA_INVALIDA'])

export class ErroApi extends Error {
  readonly codigo: CodigoErro
  readonly status: number
  /* Mensagem por campo do formulário, quando o servidor recusou o corpo (VALIDACAO). */
  readonly campos: Record<string, string>

  constructor(codigo: CodigoErro, status: number, mensagem = MENSAGENS[codigo], campos: Record<string, string> = {}) {
    super(mensagem)
    this.name = 'ErroApi'
    this.codigo = codigo
    this.status = status
    this.campos = campos
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
  'EMAIL_EM_USO', 'CREDENCIAIS_INVALIDAS', 'NAO_AUTENTICADO', 'CODIGO_INVALIDO', 'CSRF',
])

function minutosDeEspera(retryAfter: string | null): number | null {
  const segundos = Number(retryAfter)
  return Number.isFinite(segundos) && segundos > 0 ? Math.ceil(segundos / 60) : null
}

function erroDaResposta(resposta: Response, corpo: unknown): ErroApi {
  const { status } = resposta
  const { erro, codigo, campos } = (corpo ?? {}) as { erro?: string; codigo?: string; campos?: Record<string, string> }
  if (codigo === 'MUITAS_TENTATIVAS' || status === 429) {
    /* A API diz o motivo e o tempo ("Muitas contas foram criadas a partir desta rede..."). */
    if (codigo === 'MUITAS_TENTATIVAS' && erro) return new ErroApi('MUITAS_TENTATIVAS', status, erro)
    const minutos = minutosDeEspera(resposta.headers.get('Retry-After'))
    const mensagem = minutos
      ? `Muitas tentativas seguidas. Tente de novo em ${minutos} min.`
      : MENSAGENS.MUITAS_TENTATIVAS
    return new ErroApi('MUITAS_TENTATIVAS', status, mensagem)
  }
  if (codigo === 'VALIDACAO' && campos) return new ErroApi('VALIDACAO', status, MENSAGENS.VALIDACAO, campos)
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

/* Quem cuida da sessão (o store) é avisado quando uma rota protegida responde 401. */
let aoPerderSessao: (() => void) | null = null
export function definirAoPerderSessao(acao: () => void) { aoPerderSessao = acao }

/* Rotas que respondem sem sessão: um 401 delas é resposta, não sessão perdida. */
const ROTA_PUBLICA = /^\/(health|auth|acesso-medico)(\/|$)/

async function requisitar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const metodo = (init.method ?? 'GET').toUpperCase()
  const cabecalhos = new Headers(init.headers)
  /* O servidor recusa (403 CSRF) qualquer escrita sem este cabeçalho. */
  if (metodo !== 'GET') cabecalhos.set('x-nurai', '1')

  let resposta: Response
  try {
    resposta = await fetch(`/api${caminho}`, {
      ...init,
      headers: cabecalhos,
      credentials: 'same-origin',
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    })
  } catch (erro) {
    throw new ErroApi(erro instanceof DOMException && erro.name === 'TimeoutError' ? 'TEMPO_ESGOTADO' : 'REDE', 0)
  }
  if (resposta.status === 204) return undefined as T
  const corpo: unknown = await resposta.json().catch(() => null)
  if (!resposta.ok) {
    const erro = erroDaResposta(resposta, corpo)
    if (erro.codigo === 'NAO_AUTENTICADO' && !ROTA_PUBLICA.test(caminho)) aoPerderSessao?.()
    throw erro
  }
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
  sessao: () => requisitar<Conta>('/auth/sessao'),
  entrar: (email: string, senha: string) => requisitar<Conta>('/auth/login', json('POST', { email, senha })),
  cadastrar: (dados: DadosCadastro) => requisitar<Conta>('/auth/cadastro', json('POST', dados)),
  entrarDemo: () => requisitar<Conta>('/auth/demo', json('POST')),
  sair: () => requisitar<void>('/auth/logout', json('POST')),
  onboarding: (modo: ModoOnboarding, paciente?: PacienteCuidado) =>
    requisitar<{ perfil: Perfil }>('/onboarding', json('POST', { modo, paciente })),
  atualizarPerfil: (mudancas: MudancasPerfil) => requisitar<{ perfil: Perfil }>('/perfil', json('PATCH', mudancas)),
  excluirConta: () => requisitar<void>('/conta', json('DELETE', { confirmacao: 'EXCLUIR' })),

  acessoMedico: (codigo: string, profissional: string) =>
    requisitar<AcessoMedico>('/acesso-medico', json('POST', { codigo, profissional })),
  /* 204 se o código ainda vale; 404 (CODIGO_INVALIDO) se foi revogado ou expirou. Não registra acesso. */
  verificarAcessoMedico: (codigo: string) => requisitar<void>('/acesso-medico/verificar', json('POST', { codigo })),
  resumoMedico: (codigo: string, profissional: string, especialidade?: string) =>
    requisitar<ResumoIa>('/acesso-medico/resumo', json('POST', { codigo, profissional, especialidade })),

  saude: () => requisitar<Saude>('/health'),
  estado: () => requisitar<EstadoServidor>('/estado'),
  /* Os mesmos pontos que o médico vê pelo código, calculados dos registros sem IA. */
  pontosEmAberto: () => requisitar<{ pontosEmAberto: PontoEmAberto[] }>('/pontos-em-aberto'),
  acessos: () => requisitar<AcessoLog[]>('/acessos'),
  reiniciar: () => requisitar<EstadoServidor>('/reiniciar', json('POST')),

  adicionarEvento: (evento: Evento) => requisitar<Evento>('/eventos', json('POST', evento)),
  excluirEvento: (id: string) => requisitar<void>(`/eventos/${enc(id)}`, json('DELETE')),
  alternarConsentimento: (id: string) => requisitar<Consentimento>(`/consentimentos/${enc(id)}`, json('PATCH')),
  alternarPasso: (id: string) => requisitar<ProximoPasso>(`/passos/${enc(id)}`, json('PATCH')),
  conectarFonte: (id: string) => requisitar<FonteConectada>(`/fontes/${enc(id)}/conectar`, json('POST')),
  compartilhar: (para: string) => requisitar<Compartilhamento>('/compartilhamentos', json('POST', { para })),
  revogarCompartilhamento: (codigo: string) => requisitar<void>(`/compartilhamentos/${enc(codigo)}`, json('DELETE')),

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
