import type { Evento } from '../../../src/data/types.js'
import { hojeIso } from '../../db/datas.js'
import type { Perfil, RepositorioPaciente } from '../../db/repo.js'
import type { LlmProvider } from '../provider.js'

/* Cada caso enxerga só o histórico e o perfil do paciente da sessão. */
export interface ContextoIa {
  repo: RepositorioPaciente
  llm: LlmProvider
  perfil: Perfil
}

export const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

export const idsDe = (eventos: Evento[]) => new Set(eventos.map((e) => e.id))

/* Âncora só vale se aponta para um registro real — é a garantia de que a IA não inventou a fonte. */
export function filtrarAncoras(ancoras: string[], validos: Set<string>): string[] {
  return [...new Set(ancoras.map((a) => a.trim()))].filter((a) => validos.has(a))
}

export const porData = (a: Evento, b: Evento) => a.data.localeCompare(b.data)

export function dataBR(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export function mesAno(iso: string): string {
  const [ano, mes] = iso.split('-')
  return `${mes}/${ano}`
}

export const hojeISO = () => hojeIso()

export const formatarNumero = (n: number) => n.toLocaleString('pt-BR')
