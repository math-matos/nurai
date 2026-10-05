import { PACIENTE } from '../../src/data/seed.js'
import type { Evento, Medida } from '../../src/data/types.js'
import type { MensagemLlm } from './provider.js'

export const SISTEMA = `Você é o assistente do Nurai, um app que organiza o histórico de saúde de uma paciente reunindo registros de várias instituições.
Regras inegociáveis:
- Você é um assistente de organização do histórico: NUNCA diagnostica, NUNCA prescreve e NUNCA sugere iniciar, suspender ou alterar tratamento, dose ou conduta.
- Só afirme o que está nos registros fornecidos. Se a informação não estiver neles, diga que não encontrou — nunca complete com conhecimento geral sobre a paciente.
- Cite os ids dos registros usados (ex.: "e12") no campo de âncoras pedido.
- Sempre que houver uma decisão de saúde envolvida, recomende confirmar com o médico ou a equipe que acompanha a paciente.
- Escreva em português do Brasil, em linguagem simples, falando diretamente com a paciente ("você").
- Responda somente com um objeto JSON válido no formato pedido, sem texto antes ou depois.`

const num = (n: number) => String(n)

function serializarMedida(m: Medida): string {
  return `${m.nome} = ${num(m.valor)} ${m.unidade} (ref ${num(m.refMin)}–${num(m.refMax)}; ${m.sinal})`
}

export function serializarEvento(e: Evento): string {
  const cabecalho = [e.data, e.tipo, e.titulo, e.instituicao, e.especialidade, `sinal: ${e.sinal}`]
    .filter(Boolean)
    .join(' · ')
  const linhas = [`[${e.id}] ${cabecalho}`, `  Resumo: ${e.resumo}`]
  if (e.medidas?.length) linhas.push(`  Medidas: ${e.medidas.map(serializarMedida).join('; ')}`)
  return linhas.join('\n')
}

export function serializarEventos(eventos: Evento[]): string {
  return [...eventos].sort((a, b) => a.data.localeCompare(b.data)).map(serializarEvento).join('\n')
}

export const PERFIL = `Perfil: ${PACIENTE.idade} anos. Condições registradas: ${PACIENTE.condicoes.join(', ')}. Alergias: ${PACIENTE.alergias.join(', ')}.`

export function mensagens(...partes: string[]): MensagemLlm[] {
  return [
    { role: 'system', content: SISTEMA },
    { role: 'user', content: partes.join('\n\n') },
  ]
}
