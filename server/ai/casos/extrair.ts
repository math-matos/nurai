import { z } from 'zod'
import { sinalDaFaixa } from '../../../src/data/referencia.js'
import type { Evento, Medida } from '../../../src/data/types.js'
import { dataIsoValida } from '../../esquemas.js'
import { ErroIa } from '../erros.js'
import { pedirJson } from '../json.js'
import { mensagens } from '../prompts.js'
import { limparTexto } from '../texto.js'
import { hojeISO, type ContextoIa } from './comum.js'
import { extrairPorHeuristica, lerDataDoTexto } from './extrair-mock.js'
import { alertaDeIdentidade, type AlertaExtracao } from './identidade.js'

export interface EntradaExtracao {
  texto: string
  nomeArquivo?: string
}

export interface ResultadoExtracao {
  evento: Omit<Evento, 'id'>
  avisos: string[]
  /* Alertas que exigem confirmação explícita na conferência (paciente de outro nome). */
  alertas: AlertaExtracao[]
  pacienteNoDocumento?: string
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
    pacienteNoDocumento: z.string().nullish(),
    data: z.string().nullish(),
    tipo: z.enum(TIPOS),
    titulo: z.string().trim().min(1),
    instituicao: z.string().nullish(),
    especialidade: z.string().nullish(),
    resumo: z.string(),
    /* Medida sem número ("—" no pós-BD) sai da lista em vez de mandar a resposta inteira para o retry. */
    medidas: z.preprocess((v) => (Array.isArray(v) ? v.filter((m) => typeof m?.valor === 'number') : v), z.array(z.object({
      nome: z.string().trim().min(1),
      valor: z.number(),
      /* VEF1/CVF não tem unidade: o modelo manda null tanto quanto "". */
      unidade: z.string().nullish().transform((u) => u ?? ''),
      refMin: z.number().nullish(),
      refMax: z.number().nullish(),
    })).default([])),
    tags: z.array(z.string()).default([]),
    confianca: z.number().min(0).max(1),
    avisos: z.array(z.string()).default([]),
  }),
])

export type ExtracaoBruta = z.infer<typeof esquemaExtracao>
type ExtracaoClinica = Extract<ExtracaoBruta, { clinico: true }>

const TAREFA = `Tarefa: ler o texto de um documento de saúde enviado por quem usa o app (laudo, resultado de exame, receita, relatório) e estruturá-lo como um registro do histórico.
Formato da resposta (JSON):
{"clinico": true, "pacienteNoDocumento": "nome impresso" ou null, "data": "AAAA-MM-DD" ou null, "tipo": "${TIPOS.join('" | "')}", "titulo": "título curto", "instituicao": "nome" ou null, "especialidade": "nome" ou null, "resumo": "1 a 2 frases fiéis ao documento", "medidas": [{"nome": "Colesterol LDL", "valor": 162, "unidade": "mg/dL", "refMin": null, "refMax": 130}], "tags": ["colesterol"], "confianca": 0.9, "avisos": ["o que ficou ilegível ou ambíguo"]}
- Se o texto não for um documento de saúde, responda apenas {"clinico": false}.
- "pacienteNoDocumento": o nome de quem é paciente, como está impresso (campo "Paciente", "Nome", destinatário da receita), com a grafia original. Nunca o nome do médico, do solicitante ou do responsável técnico. null se o documento não identificar quem é paciente.
- "data": a data do exame/atendimento: em exame, a da coleta ou realização, antes da data de emissão do laudo (use a emissão só se for a única); em receita, pedido ou guia, a data da emissão ou da solicitação. Nunca a de impressão nem a de nascimento. Use null só se o documento não trouxer nenhuma dessas datas.
- "tipo": o que o documento é, não o que ele cita ou pede:
  - "exame": resultado de exame laboratorial ou funcional (sangue, urina, eletrocardiograma, espirometria, Holter).
  - "imagem": laudo de exame de imagem (radiografia/raio-X, ultrassom, tomografia, ressonância, mamografia, ecocardiograma).
  - "medicacao": receita ou prescrição de medicamentos, mesmo que emitida numa consulta.
  - "consulta": registro ou evolução de consulta, parecer ou relatório médico sem receita.
  - "internacao": resumo de alta, internação ou atendimento de pronto-socorro.
  - "cirurgia": descrição de cirurgia ou procedimento.
  - "vacina": comprovante ou registro de vacinação.
  - "documento": pedido de exame, guia, atestado, encaminhamento e outros documentos.
- Copie nomes, títulos e termos com a grafia do documento, com acentos e cedilha, mesmo que o documento esteja em maiúsculas (ex.: "MONITORIZAÇÃO AMBULATORIAL DA PRESSÃO ARTERIAL" vira "Monitorização Ambulatorial da Pressão Arterial", nunca "Monitorizacao").
- "titulo": o que o documento é, com o nome do exame. Em pedido, guia ou requisição, nomeie o(s) exame(s) pedido(s), ex.: "Pedido de perfil lipídico", "Guia de ultrassom de abdome" — nunca só "Pedido de exame".
- "medidas": só valores numéricos presentes no texto, com ponto decimal; refMin/refMax da faixa de referência impressa. Não invente faixas.
- Faixa "X a Y": refMin X e refMax Y. Faixa só com teto ("< X", "≤ X", "até X", "inferior a X"): refMin null e refMax X. Faixa só com piso ("> X", "≥ X", "acima de X", "superior a X", limite inferior da normalidade "LIN X"): refMin X e refMax null; se o documento trouxer o LIN, use o LIN. Use null nos dois só quando o documento não trouxer referência para a medida. Nunca preencha 0 como limite que o documento não imprime: em espirometria com só o LIN, o teto fica null e o piso é o LIN.
- Valor duplo como pressão arterial "152/96 mmHg" (referência "< 140/90") vira duas medidas com nomes distintos: "Pressão arterial sistólica" (152, refMax 140) e "Pressão arterial diastólica" (96, refMax 90).
- Referência em "% do previsto" (espirometria, por exemplo): registre a medida pelo valor em % do previsto, com unidade "% do previsto", para a faixa e o valor ficarem na mesma unidade.
- "resumo": descreva o que o documento registra, sem interpretar nem diagnosticar. Em pedido ou guia, cite os exames pedidos pelo nome (ex.: "Pedido de perfil lipídico e hemograma.").
- Em consulta, relatório ou alta, o "resumo" (até 4 frases) precisa trazer o que o documento registra de conduta, com os nomes como estão no texto: remédio iniciado, trocado ou suspenso, com a dose (ex.: "Iniciada losartana 50 mg."); cada exame solicitado pelo nome (ex.: "Solicitados MAPA de 24 horas, perfil lipídico e nova espirometria."); e o retorno com o prazo (ex.: "Retorno em 6 meses."). Esses itens são fatos do registro, não recomendações.
- No "resumo", não presuma o gênero de quem é paciente, nem pelo nome: nada de artigo masculino ou feminino antes de "paciente". Comece por "Paciente" sem artigo ou use a voz passiva (ex.: "Paciente com asma parcialmente controlada.", "Foi solicitada nova espirometria."), salvo o que o documento declarar.
- Use só os campos do formato, sem campos a mais (a extração não tem "ancoras").
- "avisos": frases completas, começando com letra maiúscula.
- "confianca": de 0 a 1, o quanto o texto estava legível e completo.`

type MedidaBruta = ExtracaoClinica['medidas'][number]
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
type Montado = Omit<ResultadoExtracao, 'geradoPor' | 'alertas' | 'pacienteNoDocumento'>

/* Zero solto no texto ("0", "0,0", "0.00"), não o de "0,70" nem o de "10". */
const ZERO_IMPRESSO = /(?<![\d.,])0(?:[.,]0+)?(?![.,]?\d)/

/* O modelo às vezes completa a faixa com 0 (ex.: espirometria só com LIN): sem um 0 impresso, esse limite é inventado. */
function semZeroInventado(m: MedidaBruta, texto?: string): MedidaBruta {
  if (texto === undefined || ZERO_IMPRESSO.test(texto)) return m
  return { ...m, refMin: m.refMin === 0 ? null : m.refMin, refMax: m.refMax === 0 ? null : m.refMax }
}

/* Faixa unilateral ("< X", "> X", LIN) guarda só o lado impresso: nada de teto ou piso inventado.
   Sem referência alguma não há com o que comparar, e a medida é omitida com aviso. */
function lerMedida(m: MedidaBruta): Medida | string {
  if (m.refMin == null && m.refMax == null) {
    return `A medida "${m.nome}" foi omitida porque o documento não traz faixa de referência.`
  }
  const faixa = { ...(m.refMin != null && { refMin: m.refMin }), ...(m.refMax != null && { refMax: m.refMax }) }
  return { nome: m.nome, valor: m.valor, unidade: m.unidade, ...faixa, sinal: sinalDaFaixa(m.valor, faixa) }
}

/* Rede de segurança para a regra do prompt: "A paciente apresenta…" vira "Paciente apresenta…". */
const ARTIGO_NO_INICIO = /(^|[.!?;]\s+)[OA] (paciente\b)/g
const semGenero = (resumo: string) => resumo.replace(ARTIGO_NO_INICIO, (_, antes: string) => `${antes}Paciente`)

/* Pós-processamento comum ao modelo e à heurística: sinal e validações ficam no servidor.
   Com o texto do documento, limite 0 que não aparece impresso é descartado. */
export function montarEvento(bruto: ExtracaoClinica, nomeArquivo?: string, texto?: string): Montado {
  const avisos = bruto.avisos.map((a) => maiuscula(limparTexto(a))).filter(Boolean)
  const lidas = bruto.medidas.map((m) => lerMedida(semZeroInventado(m, texto)))
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
    resumo: semGenero(limparTexto(bruto.resumo)),
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

/* O modelo às vezes devolve null para uma data rotulada de outro jeito ("Data da solicitação"):
   antes de cair na data de hoje, usa a impressa no documento, que a heurística acha sem a de nascimento. */
function completarData(bruto: ExtracaoClinica, texto: string): ExtracaoClinica {
  if (bruto.data != null && dataIsoValida(bruto.data)) return bruto
  const doTexto = lerDataDoTexto(texto)
  if (!doTexto || !dataIsoValida(doTexto)) return bruto
  return { ...bruto, data: doTexto, avisos: [...bruto.avisos, 'Usei a data impressa no documento; confira antes de salvar.'] }
}

/* A conferência compara o nome impresso com o titular da conta: exame de outra pessoa é erro grave. */
export async function extrairEvento(
  { llm, perfil }: Pick<ContextoIa, 'llm'> & { perfil: Pick<ContextoIa['perfil'], 'nome'> },
  entrada: EntradaExtracao,
): Promise<ResultadoExtracao> {
  const texto = entrada.texto.slice(0, LIMITE_TEXTO)
  const bruto = llm.nome === 'mock'
    ? extrairPorHeuristica(texto)
    : await pedirJson(llm, mensagens(TAREFA, `Documento:\n"""\n${texto}\n"""`), esquemaExtracao, { temperatura: 0 })
  if (!bruto.clinico) throw new ErroIa('NAO_CLINICO', 'O texto enviado não parece ser um documento de saúde')
  const resultado = montarEvento(completarData(bruto, texto), entrada.nomeArquivo, texto)
  if (entrada.texto.length > LIMITE_TEXTO) {
    resultado.avisos.push('O documento é longo e só o início foi lido. Confira se faltou alguma informação.')
  }
  const pacienteNoDocumento = bruto.pacienteNoDocumento?.trim() || undefined
  return {
    ...resultado,
    alertas: alertaDeIdentidade(pacienteNoDocumento, perfil.nome),
    ...(pacienteNoDocumento && { pacienteNoDocumento }),
    geradoPor: llm.nome,
  }
}
