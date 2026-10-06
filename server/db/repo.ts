import type { FONTES_CONECTADAS } from '../../src/data/seed.js'
import type { AcessoLog, Consentimento, Evento, ProximoPasso } from '../../src/data/types.js'

export type FonteConectada = (typeof FONTES_CONECTADAS)[number]

export interface Compartilhamento {
  codigo: string
  criadoEm: string
  para: string
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

export type Onboarding = 'pendente' | 'vazio' | 'exemplo'
export type ModoOnboarding = Exclude<Onboarding, 'pendente'>

/* iniciais e idade são derivadas de nome e dataNascimento na leitura; não são gravadas. */
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
}

export type NovoPaciente = DadosPerfil & { convidado: boolean }

/* undefined mantém o campo; '' remove um opcional. */
export type AtualizacaoPerfil = Partial<DadosPerfil>

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
  adicionarEvento(evento: Evento, autor: string): Promise<Evento>
  alternarConsentimento(id: string, autor: string): Promise<Consentimento | null>
  alternarPasso(id: string): Promise<ProximoPasso | null>
  substituirPassos(passos: ProximoPasso[]): Promise<ProximoPasso[]>
  criarCompartilhamento(para: string, autor: string): Promise<Compartilhamento>
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

export const normalizarEmail = (email: string) => email.trim().toLowerCase()
