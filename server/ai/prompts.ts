import type { Evento, Medida } from '../../src/data/types.js'
import type { Perfil } from '../db/repo.js'
import { dataBR, formatarNumero } from './casos/comum.js'
import { derivarFatos, serializarFatos } from './fatos.js'
import type { MensagemLlm } from './provider.js'

export const SISTEMA = `Você é o assistente do Nurai, um app que organiza o histórico de saúde de uma paciente reunindo registros de várias instituições.
Regras inegociáveis:
- Você é um assistente de organização do histórico: NUNCA diagnostica, NUNCA prescreve e NUNCA sugere iniciar, suspender ou alterar tratamento, dose ou conduta.
- Só afirme o que está nos registros fornecidos. Se a informação não estiver neles, diga que não encontrou — nunca complete com conhecimento geral sobre a paciente.
- Cite os ids dos registros usados (ex.: "e12") no campo de âncoras pedido.
- Sempre que houver uma decisão de saúde envolvida, recomende confirmar com o médico ou a equipe que acompanha a paciente.
- Não cite diagnósticos ou condições que não estejam no Perfil ou nos registros: não deduza uma doença pelo nome de um remédio nem por uma orientação.
- Escreva em português do Brasil, em linguagem simples, falando diretamente com a paciente ("você"). No texto, datas no formato dd/mm/aaaa e números com vírgula decimal (ex.: 7,2%); nos campos numéricos do JSON, sempre ponto decimal (ex.: 7.2).
- Não escreva ids de registros (como "e12" ou "[e12]") no texto: eles vão só no campo de âncoras. No texto, refira-se a um registro pelo nome e pela data (ex.: "o exame de 05/03/2026").
- Responda somente com um objeto JSON válido no formato pedido, sem texto antes ou depois.`

function serializarMedida(m: Medida): string {
  return `${m.nome} = ${formatarNumero(m.valor)} ${m.unidade} (ref ${formatarNumero(m.refMin)}–${formatarNumero(m.refMax)}; ${m.sinal})`
}

export function serializarEvento(e: Evento): string {
  const cabecalho = [dataBR(e.data), e.tipo, e.titulo, e.instituicao, e.especialidade, `sinal: ${e.sinal}`]
    .filter(Boolean)
    .join(' · ')
  const linhas = [`[${e.id}] ${cabecalho}`, `  Resumo: ${e.resumo}`]
  if (e.medidas?.length) linhas.push(`  Medidas: ${e.medidas.map(serializarMedida).join('; ')}`)
  if (e.tags.length) linhas.push(`  Tags: ${e.tags.join(', ')}`)
  return linhas.join('\n')
}

export function serializarEventos(eventos: Evento[]): string {
  return [...eventos].sort((a, b) => a.data.localeCompare(b.data)).map(serializarEvento).join('\n')
}

/* Registros + fatos derivados: o modelo não calcula tendência nem procura duplicidade sozinho. */
export function contextoHistorico(eventos: Evento[]): string {
  return [
    `Histórico (${eventos.length} registros):\n${serializarEventos(eventos)}`,
    serializarFatos(derivarFatos(eventos)),
  ].join('\n\n')
}

/* Perfil preenchido pelo próprio paciente: idade, condições e alergias podem faltar. */
export function descreverPerfil({ idade, condicoes, alergias }: Pick<Perfil, 'idade' | 'condicoes' | 'alergias'>): string {
  const lista = (itens: string[]) => (itens.length ? itens.join(', ') : 'nenhuma informada')
  const anos = idade === undefined ? 'idade não informada' : `${idade} anos`
  return `Perfil: ${anos}. Condições registradas: ${lista(condicoes)}. Alergias: ${lista(alergias)}.`
}

export function mensagens(...partes: string[]): MensagemLlm[] {
  return [
    { role: 'system', content: SISTEMA },
    { role: 'user', content: partes.join('\n\n') },
  ]
}
