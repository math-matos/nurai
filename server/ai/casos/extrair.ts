import { z } from 'zod'
import type { Evento, Medida } from '../../../src/data/types.js'
import { dataIsoValida } from '../../esquemas.js'
import { ErroIa } from '../erros.js'
import { pedirJson } from '../json.js'
import { mensagens } from '../prompts.js'
import { hojeISO, sinalDaMedida, type ContextoIa } from './comum.js'
import { extrairPorHeuristica } from './extrair-mock.js'

export interface EntradaExtracao {
  texto: string
  nomeArquivo?: string
}

export interface ResultadoExtracao {
  evento: Omit<Evento, 'id'>
  avisos: string[]
  geradoPor: 'oci' | 'mock'
}

const LIMITE_TEXTO = 20_000
const CONFIANCA_MINIMA = 0.7
/* A confiança do modelo mede legibilidade; medida perdida ou aviso também reduzem o quanto
   o registro pode ser usado sem conferência. */
const PENALIDADE_MEDIDA_OMITIDA = 0.15
const PENALIDADE_AVISO = 0.05
const TIPOS = ['exame', 'consulta', 'imagem', 'cirurgia', 'medicacao', 'internacao', 'vacina', 'documento'] as const

export const esquemaExtracao = z.discriminatedUnion('clinico', [
  z.object({ clinico: z.literal(false) }),
  z.object({
    clinico: z.literal(true),
    data: z.string().nullish(),
    tipo: z.enum(TIPOS),
    titulo: z.string().trim().min(1),
    instituicao: z.string().nullish(),
    especialidade: z.string().nullish(),
    resumo: z.string(),
    medidas: z.array(z.object({
      nome: z.string().trim().min(1),
      valor: z.number(),
      unidade: z.string(),
      refMin: z.number().nullish(),
      refMax: z.number().nullish(),
    })).default([]),
    tags: z.array(z.string()).default([]),
    confianca: z.number().min(0).max(1),
    avisos: z.array(z.string()).default([]),
  }),
])

export type ExtracaoBruta = z.infer<typeof esquemaExtracao>
type ExtracaoClinica = Extract<ExtracaoBruta, { clinico: true }>

const TAREFA = `Tarefa: ler o texto de um documento de saúde enviado pela paciente (laudo, resultado de exame, receita, relatório) e estruturá-lo como um registro do histórico.
Formato da resposta (JSON):
{"clinico": true, "data": "AAAA-MM-DD" ou null, "tipo": "${TIPOS.join('" | "')}", "titulo": "título curto", "instituicao": "nome" ou null, "especialidade": "nome" ou null, "resumo": "1 a 2 frases fiéis ao documento", "medidas": [{"nome": "Colesterol LDL", "valor": 162, "unidade": "mg/dL", "refMin": 0, "refMax": 130}], "tags": ["colesterol"], "confianca": 0.9, "avisos": ["o que ficou ilegível ou ambíguo"]}
- Se o texto não for um documento de saúde, responda apenas {"clinico": false}.
- "data": a data do exame/atendimento (coleta, realização ou emissão), não a data de impressão.
- "medidas": só valores numéricos presentes no texto, com ponto decimal; refMin/refMax da faixa de referência impressa. Não invente faixas.
- Faixa "X a Y": refMin X e refMax Y. Faixa só com teto ("< X", "≤ X", "até X", "inferior a X"): refMin null e refMax X. Faixa só com piso ("> X", "≥ X", "acima de X", "superior a X"): refMin X e refMax null. Use null nos dois só quando o documento não trouxer referência para a medida.
- "resumo": descreva o que o documento registra, sem interpretar nem diagnosticar.
- "confianca": de 0 a 1, o quanto o texto estava legível e completo.`

type MedidaBruta = ExtracaoClinica['medidas'][number]

/* "< X" é faixa 0–X (o seed já usa refMin 0 para LDL). "> X" não tem como virar Medida sem
   inventar um teto — o tipo exige os dois limites —, então a medida é omitida com aviso exato. */
function lerMedida(m: MedidaBruta): Medida | string {
  if (m.refMin == null && m.refMax == null) {
    return `A medida "${m.nome}" foi omitida porque o documento não traz faixa de referência.`
  }
  if (m.refMax == null) {
    return `A medida "${m.nome}" foi omitida porque a referência tem só o limite inferior (${m.refMin}). Inclua-a manualmente se quiser guardá-la.`
  }
  const refMin = m.refMin ?? 0
  return {
    nome: m.nome, valor: m.valor, unidade: m.unidade, refMin, refMax: m.refMax,
    sinal: sinalDaMedida(m.valor, refMin, m.refMax),
  }
}

/* Pós-processamento comum ao modelo e à heurística: sinal e validações ficam no servidor. */
export function montarEvento(bruto: ExtracaoClinica, nomeArquivo?: string): Omit<ResultadoExtracao, 'geradoPor'> {
  const avisos = bruto.avisos.map((a) => a.trim()).filter(Boolean)
  const lidas = bruto.medidas.map(lerMedida)
  const medidas = lidas.filter((m): m is Medida => typeof m !== 'string')
  const omitidas = lidas.filter((m): m is string => typeof m === 'string')
  const dataValida = bruto.data != null && dataIsoValida(bruto.data)
  if (!dataValida) avisos.push('Não encontrei a data no documento; usei a data de hoje. Confira antes de salvar.')
  const penalidade = PENALIDADE_MEDIDA_OMITIDA * omitidas.length + PENALIDADE_AVISO * avisos.length
  const confianca = Math.round(Math.max(0, bruto.confianca - penalidade) * 100) / 100
  avisos.push(...omitidas)
  if (confianca < CONFIANCA_MINIMA) {
    avisos.push('A leitura teve baixa confiança. Confira cada campo com o documento original.')
  }
  const especialidade = bruto.especialidade?.trim()
  const evento: Omit<Evento, 'id'> = {
    data: dataValida ? bruto.data! : hojeISO(),
    tipo: bruto.tipo,
    titulo: bruto.titulo,
    instituicao: bruto.instituicao?.trim() || 'Não identificada',
    fonte: 'paciente',
    ...(especialidade && { especialidade }),
    resumo: bruto.resumo.trim(),
    sinal: medidas.some((m) => m.sinal === 'alterado') ? 'alterado' : medidas.length ? 'normal' : 'info',
    ...(medidas.length && { medidas }),
    tags: bruto.tags.map((t) => t.trim()).filter(Boolean),
    origem: 'OCR + IA',
    confianca,
    ...(nomeArquivo && { documento: nomeArquivo }),
    novo: true,
  }
  return { evento, avisos }
}

export async function extrairEvento({ llm }: Pick<ContextoIa, 'llm'>, entrada: EntradaExtracao): Promise<ResultadoExtracao> {
  const texto = entrada.texto.slice(0, LIMITE_TEXTO)
  const bruto = llm.nome === 'mock'
    ? extrairPorHeuristica(texto)
    : await pedirJson(llm, mensagens(TAREFA, `Documento:\n"""\n${texto}\n"""`), esquemaExtracao)
  if (!bruto.clinico) throw new ErroIa('NAO_CLINICO', 'O texto enviado não parece ser um documento de saúde')
  const resultado = montarEvento(bruto, entrada.nomeArquivo)
  if (entrada.texto.length > LIMITE_TEXTO) {
    resultado.avisos.push('O documento é longo e só o início foi lido. Confira se faltou alguma informação.')
  }
  return { ...resultado, geradoPor: llm.nome }
}
