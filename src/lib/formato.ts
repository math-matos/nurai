import type { NomeIcone } from '../components/Icon'
import type { Evento, Sinal, TipoId } from '../data/types'

export const ROTULO_SINAL: Record<Sinal, string> = {
  normal: 'Dentro da faixa',
  atencao: 'Limítrofe',
  alterado: 'Fora da faixa',
  info: 'Registro',
}

export const ICONE_TIPO: Record<TipoId, NomeIcone> = {
  exame: 'frasco',
  consulta: 'pessoa',
  imagem: 'imagem',
  cirurgia: 'bisturi',
  medicacao: 'frasco',
  internacao: 'leito',
  vacina: 'seringa',
  documento: 'papel',
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function formatarData(iso: string) {
  const [a, m, d] = iso.split('-')
  return `${d} ${MESES[Number(m) - 1]} ${a}`
}

export function formatarDataCurta(iso: string) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

export function ano(iso: string) { return iso.slice(0, 4) }

export function ordenarRecentes(eventos: Evento[]) {
  return [...eventos].sort((a, b) => (a.data < b.data ? 1 : -1))
}
