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

/* Métodos que recebem id devolvem null quando o id não existe. */
export interface Repositorio {
  nome: 'oracle' | 'memoria'
  estado(): Promise<EstadoRepositorio>
  adicionarEvento(evento: Evento, autor: string): Promise<Evento>
  alternarConsentimento(id: string, autor: string): Promise<Consentimento | null>
  alternarPasso(id: string): Promise<ProximoPasso | null>
  substituirPassos(passos: ProximoPasso[]): Promise<ProximoPasso[]>
  criarCompartilhamento(para: string, autor: string): Promise<Compartilhamento>
  conectarFonte(id: string): Promise<FonteConectada | null>
  listarAcessos(): Promise<AcessoLog[]>
  registrarAcesso(log: NovoAcesso): Promise<AcessoLog>
  reiniciar(): Promise<void>
}
