import type { PontoEmAberto } from './api'

/* Ordem de leitura do profissional: o que pode ser evitado (exame repetido) antes do que está pendente.
   A folha do paciente usa a mesma ordem e os mesmos títulos da tela do médico. */
export const GRUPOS_PONTOS: { tipo: PontoEmAberto['tipo']; titulo: string }[] = [
  { tipo: 'repeticao', titulo: 'Possíveis exames repetidos' },
  { tipo: 'pedido', titulo: 'Pedidos sem resultado' },
  { tipo: 'retorno', titulo: 'Retornos sem consulta registrada' },
  { tipo: 'reavaliacao', titulo: 'Reavaliações sem nova medição' },
]

export function agruparPontos(pontos: PontoEmAberto[]) {
  return GRUPOS_PONTOS
    .map((g) => ({ ...g, itens: pontos.filter((p) => p.tipo === g.tipo) }))
    .filter((g) => g.itens.length > 0)
}
