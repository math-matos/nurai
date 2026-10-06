import type { FONTES_CONECTADAS } from '../../src/data/seed.js'
import type { AcessoLog, Consentimento, Evento, ProximoPasso } from '../../src/data/types.js'

export type FonteConectada = (typeof FONTES_CONECTADAS)[number]

/* criadoEm e expiraEm no formato exibido (DD/MM/AAAA HH:mm, horário de Brasília). */
export interface Compartilhamento {
  codigo: string
  criadoEm: string
  para: string
  expiraEm: string
}

export const VALIDADE_COMPARTILHAMENTO_DIAS = 30

export interface CompartilhamentoAtivo {
  pacienteId: string
  para: string
  expiraEm: string
}

export interface LimitesLimpeza {
  sessoesExpiradasAntesDe: Date
  tentativasAntesDe: Date
  convidadosCriadosAntesDe: Date
}

export interface ResultadoLimpeza {
  sessoes: number
  tentativas: number
  convidados: number
}

export interface EstadoRepositorio {
  eventos: Evento[]
  consentimentos: Consentimento[]
  acessos: AcessoLog[]
  passos: ProximoPasso[]
  fontes: FonteConectada[]
  compartilhamento: Compartilhamento | null
}

export type NovoAcesso = Omit<AcessoLog, 'id' | 'quando'>

export type SituacaoCompartilhamento = 'ativo' | 'revogado' | 'expirado'

export interface CompartilhamentoEncontrado extends CompartilhamentoAtivo {
  situacao: SituacaoCompartilhamento
}

export type Onboarding = 'pendente' | 'vazio' | 'exemplo'
export type ModoOnboarding = Exclude<Onboarding, 'pendente'>

/* Quem usa a conta para cuidar do histórico de outra pessoa (relacao: o que ele é do paciente, ex.: "filho"). */
export interface Responsavel {
  nome: string
  relacao: string
}

/* nome é o do paciente, dono do histórico; com responsavel, a conta é de quem cuida dele.
   iniciais e idade são derivadas de nome e dataNascimento na leitura; não são gravadas. */
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

export interface DadosPerfil {
  nome: string
  dataNascimento?: string
  condicoes?: string[]
  alergias?: string[]
  cartaoSus?: string
  plano?: string
  responsavel?: Responsavel
}

export type NovoPaciente = DadosPerfil & { convidado: boolean }

/* undefined mantém o campo; '' remove um opcional e responsavel: null volta a ser o histórico do próprio usuário. */
export type AtualizacaoPerfil = Partial<Omit<DadosPerfil, 'responsavel'>> & { responsavel?: Responsavel | null }

export interface Usuario {
  id: string
  email: string
}

export interface UsuarioComSenha extends Usuario {
  pacienteId: string
  /* null: conta convidada, sem senha utilizável. */
  senhaHash: string | null
}

export interface NovoUsuario {
  email: string
  senhaHash: string | null
  pacienteId: string
}

export interface NovaSessao {
  tokenHash: string
  usuarioId: string
  expiraEm: Date
}

export interface SessaoAtiva {
  usuario: Usuario
  perfil: Perfil
  expiraEm: Date
}

/* Dados de um paciente. Métodos que recebem id devolvem null quando o id não existe para esse paciente. */
export interface RepositorioPaciente {
  estado(): Promise<EstadoRepositorio>
  /* autor e papel vão para o log de acessos (papel padrão: Titular). */
  adicionarEvento(evento: Evento, autor: string, papel?: string): Promise<Evento>
  /* Apaga o evento, tira o id das âncoras dos passos (passo sem âncora sai junto) e registra no log.
     false: o evento não é deste paciente. */
  excluirEvento(id: string, autor: string, papel?: string): Promise<boolean>
  alternarConsentimento(id: string, autor: string, papel?: string): Promise<Consentimento | null>
  alternarPasso(id: string): Promise<ProximoPasso | null>
  substituirPassos(passos: ProximoPasso[]): Promise<ProximoPasso[]>
  criarCompartilhamento(para: string, autor: string, papel?: string): Promise<Compartilhamento>
  /* false: o código não é deste paciente. Revogar de novo devolve true sem registrar outro acesso. */
  revogarCompartilhamento(codigo: string, autor: string, papel?: string): Promise<boolean>
  conectarFonte(id: string): Promise<FonteConectada | null>
  listarAcessos(): Promise<AcessoLog[]>
  registrarAcesso(log: NovoAcesso): Promise<AcessoLog>
  /* Volta ao ponto de partida do onboarding do paciente: histórico de exemplo ou vazio. */
  reiniciar(): Promise<void>
}

export interface Repositorio {
  nome: 'oracle' | 'memoria'
  paraPaciente(pacienteId: string): RepositorioPaciente

  criarPaciente(dados: NovoPaciente): Promise<Perfil>
  obterPerfil(pacienteId: string): Promise<Perfil | null>
  atualizarPerfil(pacienteId: string, mudancas: AtualizacaoPerfil): Promise<Perfil | null>
  /* Define o modo e recomeça os dados do paciente nele (exemplo: cópia do seed; vazio: nada). */
  aplicarOnboarding(pacienteId: string, modo: ModoOnboarding): Promise<Perfil | null>
  /* Apaga o paciente com todos os dados, o usuário e as sessões dele. */
  excluirPaciente(pacienteId: string): Promise<boolean>

  /* Email já usado: lança ErroConflito. */
  criarUsuario(dados: NovoUsuario): Promise<Usuario>
  buscarUsuarioPorEmail(email: string): Promise<UsuarioComSenha | null>

  criarSessao(sessao: NovaSessao): Promise<void>
  /* Devolve a sessão mesmo expirada: quem decide pela expiração é o middleware. */
  buscarSessao(tokenHash: string): Promise<SessaoAtiva | null>
  apagarSessao(tokenHash: string): Promise<void>

  registrarTentativa(chave: string, quando?: Date): Promise<void>
  contarTentativas(chave: string, desde: Date): Promise<number>

  /* Código exato (já normalizado); null se não existe, foi revogado ou expirou. */
  buscarCompartilhamentoAtivo(codigo: string): Promise<CompartilhamentoAtivo | null>
  /* Como o anterior, mas devolve também o revogado e o expirado (revogado prevalece); null só se não existe. */
  buscarCompartilhamento(codigo: string): Promise<CompartilhamentoEncontrado | null>

  /* Convidados saem com todos os dados (como excluirPaciente). Devolve quantos de cada foram apagados. */
  limpar(limites: LimitesLimpeza): Promise<ResultadoLimpeza>
}

/* Id ou email que já existe: os dois repositórios lançam isto em vez de duplicar (memória) ou estourar ORA-00001 (Oracle). */
export class ErroConflito extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroConflito'
  }
}

/* O Oracle grava '' como NULL e o campo some na leitura: os dois repositórios tratam string opcional vazia como ausente. */
export function semOpcionaisVazios(evento: Evento): Evento {
  const { especialidade, documento, ...resto } = evento
  return { ...resto, ...(especialidade && { especialidade }), ...(documento && { documento }) }
}

export const PAPEL_TITULAR = 'Titular'

/* Quem age pela conta e vai para o log: o próprio paciente ou o responsável que cuida do histórico dele. */
export function autorDe({ nome, responsavel }: Pick<Perfil, 'nome' | 'responsavel'>): Pick<AcessoLog, 'quem' | 'papel'> {
  return responsavel
    ? { quem: responsavel.nome, papel: `Responsável (${responsavel.relacao})` }
    : { quem: nome, papel: PAPEL_TITULAR }
}

export const ACAO_EXCLUIR_EVENTO = 'Excluiu registro do histórico'

/* O log guarda título e data do registro apagado: depois da exclusão, é a única pista do que existiu. */
export function itensExclusao({ titulo, data }: Pick<Evento, 'titulo' | 'data'>) {
  const [a, m, d] = data.split('-')
  return `${titulo}, ${d}/${m}/${a}`
}

/* Passos tocados ao apagar um evento: o id sai das âncoras; o passo que fica sem nenhuma perdeu a sustentação e sai. */
export function passosSemEvento(passos: ProximoPasso[], eventoId: string) {
  const tocados = passos.filter((p) => p.ancoras.includes(eventoId))
    .map((p) => ({ ...p, ancoras: p.ancoras.filter((a) => a !== eventoId) }))
  return {
    atualizados: tocados.filter((p) => p.ancoras.length > 0),
    removidos: tocados.filter((p) => p.ancoras.length === 0).map((p) => p.id),
  }
}

export const normalizarEmail = (email: string) => email.trim().toLowerCase()
