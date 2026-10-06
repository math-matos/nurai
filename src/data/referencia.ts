import type { Medida, Sinal } from './types.js'

/* Faixa de referência de uma medida. Laudos trazem às vezes só um lado ("< 130", "> 40", LIN):
   ao menos um limite existe. Compartilhado pela API, pela conferência e pela régua. */
export type Faixa = Pick<Medida, 'refMin' | 'refMax'>

const formatar = (n: number) => n.toLocaleString('pt-BR')

export const abaixoDaFaixa = (valor: number, { refMin }: Faixa) => refMin !== undefined && valor < refMin
export const acimaDaFaixa = (valor: number, { refMax }: Faixa) => refMax !== undefined && valor > refMax

export function sinalDaFaixa(valor: number, faixa: Faixa): Sinal {
  return abaixoDaFaixa(valor, faixa) || acimaDaFaixa(valor, faixa) ? 'alterado' : 'normal'
}

/* "70 a 99", "≥ 40" ou "≤ 130": o limite pertence à faixa (igual ao limite é normal). */
export function textoDaFaixa({ refMin, refMax }: Faixa): string {
  if (refMin !== undefined && refMax !== undefined) return `${formatar(refMin)} a ${formatar(refMax)}`
  if (refMin !== undefined) return `≥ ${formatar(refMin)}`
  return `≤ ${formatar(refMax!)}`
}

export interface GeometriaRegua {
  /* posições em % da pista */
  faixa: { inicio: number; fim: number }
  marca: number
  limites: { posicao: number; texto: string }[]
}

/* Faixa unilateral fica aberta até a borda da pista do lado sem limite, e o rótulo diz o lado. */
export function geometriaRegua({ valor, refMin, refMax }: Pick<Medida, 'valor' | 'refMin' | 'refMax'>): GeometriaRegua {
  const pontos = [valor, refMin, refMax].filter((n): n is number => n !== undefined)
  const piso = Math.min(...pontos)
  const teto = Math.max(...pontos)
  const folga = (teto - piso) * 0.28 || Math.abs(valor) * 0.25 || 1
  const dominioMin = piso - folga
  const dominioMax = teto + folga
  const pos = (v: number) => ((v - dominioMin) / (dominioMax - dominioMin)) * 100
  const unilateral = refMin === undefined || refMax === undefined
  const rotulo = (n: number, lado: string) => (unilateral ? `${lado} ${formatar(n)}` : formatar(n))
  return {
    faixa: { inicio: refMin === undefined ? 0 : pos(refMin), fim: refMax === undefined ? 100 : pos(refMax) },
    marca: pos(valor),
    limites: [
      ...(refMin !== undefined ? [{ posicao: pos(refMin), texto: rotulo(refMin, '≥') }] : []),
      ...(refMax !== undefined ? [{ posicao: pos(refMax), texto: rotulo(refMax, '≤') }] : []),
    ],
  }
}
