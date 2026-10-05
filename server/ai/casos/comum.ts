import type { Evento, Sinal } from '../../../src/data/types.js'

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

export const hojeISO = () => new Date().toISOString().slice(0, 10)

export function sinalDaMedida(valor: number, refMin: number, refMax: number): Sinal {
  return valor < refMin || valor > refMax ? 'alterado' : 'normal'
}

export const formatarNumero = (n: number) => n.toLocaleString('pt-BR')
