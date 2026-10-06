import { z } from 'zod'
import { responder } from '../../../src/data/copiloto.js'
import type { Evento } from '../../../src/data/types.js'
import { derivarFatos } from '../fatos.js'
import { avisoPara } from '../guardrails.js'
import { pedirJson } from '../json.js'
import { SISTEMA, contextoHistorico, descreverPerfil } from '../prompts.js'
import type { MensagemLlm } from '../provider.js'
import { limparTexto, limparTextos } from '../texto.js'
import { dataBR, filtrarAncoras, idsDe, mesAno, normalizar, porData, type ContextoIa } from './comum.js'

export interface EntradaCopiloto {
  pergunta: string
  historico?: { pergunta: string; texto: string[] }[]
}

export interface Serie {
  nome: string
  unidade: string
  pontos: { data: string; valor: number }[]
}

export interface RespostaCopiloto {
  texto: string[]
  ancoras: string[]
  serie?: Serie
  aviso?: string
  geradoPor: 'oci' | 'mock'
}

const SEM_BASE = 'Não encontrei no seu histórico registros que sustentem uma resposta para isso.'
export const HISTORICO_VAZIO = 'Seu histórico ainda está vazio. Anexe um exame ou laudo em Fontes para eu poder responder com base nele.'
const TURNOS_ANTERIORES = 6

const TAREFA = `Tarefa: responder à pergunta da paciente usando apenas os registros do histórico abaixo.
Formato da resposta (JSON):
{"texto": ["parágrafo curto"], "ancoras": ["e01"], "serie": {"medida": "nome exato de uma medida"} ou null, "aviso": "lembrete curto" ou null}
- "texto": 1 a 4 parágrafos curtos, citando datas e valores dos registros. Refira-se a um registro pelo nome e pela data (ex.: "o exame de 05/03/2026"), nunca pelo id.
- "ancoras": ids de todos os registros que sustentam a resposta. Se nada no histórico sustenta uma resposta, use [] e diga que não encontrou.
- Perguntas sobre exames repetidos ou desnecessários, pendências ou evolução de uma medida: responda a partir dos FATOS DERIVADOS e inclua nas âncoras os ids que eles citam.
- Perguntas sobre parar, trocar ou ajustar um remédio: não diga se pode ou não; conte o que os registros mostram sobre esse remédio (com âncoras) e preencha o "aviso".
- "serie": só quando a pergunta for sobre a evolução de uma medida numérica; use o nome da medida exatamente como aparece em "Medidas". Caso contrário, null.
- "aviso": quando a pergunta envolver uma decisão de saúde (parar, trocar, cancelar algo), um lembrete para confirmar com o médico; caso contrário, null.`

const esquema = z.object({
  texto: z.array(z.string()).min(1),
  ancoras: z.array(z.string()),
  serie: z.object({ medida: z.string() }).nullish(),
  aviso: z.string().nullish(),
})

const PERGUNTA_REPETICAO = /repet|duplic|de novo|refazer|ja fiz|nao preciso/
const AVISO_REPETICAO = 'Não deixe de fazer um exame pedido sem antes confirmar com quem o pediu.'

/* Exame repetido é fato calculado. Se a pergunta é sobre isso e a resposta não cita nenhum par
   feito × pedido dos fatos (o modelo disse "não encontrei"), a resposta vem dos próprios fatos. */
function respostaDeRepeticao(eventos: Evento[], pergunta: string, ancoras: string[]): Omit<RespostaCopiloto, 'geradoPor'> | undefined {
  if (!PERGUNTA_REPETICAO.test(normalizar(pergunta))) return undefined
  const { repeticoes } = derivarFatos(eventos)
  if (!repeticoes.length || repeticoes.some((r) => ancoras.includes(r.feito) && ancoras.includes(r.pedido))) return undefined
  return {
    texto: repeticoes.map((r) => `O exame "${r.exame}" foi feito em ${dataBR(r.feitoData)} (${r.feitoInstituicao}) e um novo pedido de ${r.pedidoExame} apareceu em ${dataBR(r.pedidoData)} (${r.pedidoInstituicao}), ${r.dias} dias depois. Leve o resultado de ${dataBR(r.feitoData)} a quem fez o pedido e pergunte se ainda é preciso repetir.`),
    ancoras: [...new Set(repeticoes.flatMap((r) => [r.feito, r.pedido]))],
    aviso: AVISO_REPETICAO,
  }
}

/* Nome popular na pergunta → trecho do nome da medida nos registros. HDL antes de "colesterol". */
const MEDIDAS_POPULARES: [RegExp, string][] = [
  [/glicada|hba1c|\ba1c\b/, 'glicada'],
  [/\bhdl\b/, 'colesterol hdl'],
  [/\bldl\b|colesterol/, 'colesterol ldl'],
  [/triglicer/, 'triglicerides'],
  [/glicemia|glicose/, 'glicemia'],
  [/creatinina/, 'creatinina'],
  [/filtracao|\btfg\b|funcao renal/, 'filtracao glomerular'],
  [/\btsh\b/, 'tsh'],
  [/albumin/, 'albuminuria'],
  [/fibrilacao|holter/, 'carga de fibrilacao'],
  [/frequencia cardiaca|batimento/, 'frequencia cardiaca'],
]

/* O modelo só devolvia "serie" em 4 de 5 perguntas sobre a glicada; a pergunta já diz a medida. */
export function serieDaPergunta(eventos: Evento[], pergunta: string): Serie | undefined {
  const texto = normalizar(pergunta)
  const alvo = MEDIDAS_POPULARES.find(([re]) => re.test(texto))?.[1]
  return alvo ? montarSerie(eventos, alvo) : undefined
}

/* Os números da série vêm sempre dos registros, nunca do modelo. */
export function montarSerie(eventos: Evento[], medida: string): Serie | undefined {
  const alvo = normalizar(medida)
  const nomes = [...new Set(eventos.flatMap((e) => e.medidas ?? []).map((m) => m.nome))]
  const contendo = nomes.filter((n) => normalizar(n).includes(alvo))
  const nome = nomes.find((n) => normalizar(n) === alvo) ?? (contendo.length === 1 ? contendo[0] : undefined)
  if (!nome) return undefined
  const pontos = [...eventos].sort(porData).flatMap((e) =>
    (e.medidas ?? []).filter((m) => m.nome === nome).map((m) => ({ data: mesAno(e.data), valor: m.valor, unidade: m.unidade })))
  if (pontos.length < 2) return undefined
  return { nome, unidade: pontos[0].unidade, pontos: pontos.map(({ data, valor }) => ({ data, valor })) }
}

export async function responderCopiloto({ repo, llm, perfil }: ContextoIa, entrada: EntradaCopiloto): Promise<RespostaCopiloto> {
  const { eventos } = await repo.estado()
  /* Sem registros não há o que ancorar: nem o modelo nem o motor determinístico são chamados. */
  if (!eventos.length) return { texto: [HISTORICO_VAZIO], ancoras: [], geradoPor: llm.nome }
  const validos = idsDe(eventos)

  if (llm.nome === 'mock') {
    const resposta = responder(entrada.pergunta)
    const ancoras = filtrarAncoras(resposta.ancoras, validos)
    /* O motor determinístico só conhece o histórico de exemplo: se nenhuma das âncoras dele existe
       aqui, a resposta falaria de registros que a paciente não tem. */
    if (resposta.ancoras.length && !ancoras.length) {
      const repeticao = respostaDeRepeticao(eventos, entrada.pergunta, [])
      if (repeticao) return { ...repeticao, geradoPor: llm.nome }
      const aviso = avisoPara(entrada.pergunta, null)
      return { texto: [SEM_BASE], ancoras: [], ...(aviso && { aviso }), geradoPor: llm.nome }
    }
    const aviso = avisoPara(entrada.pergunta, resposta.aviso)
    return { ...resposta, ancoras, ...(aviso && { aviso }), geradoPor: llm.nome }
  }

  const turnos: MensagemLlm[] = (entrada.historico ?? []).slice(-TURNOS_ANTERIORES).flatMap((t) => [
    { role: 'user' as const, content: t.pergunta },
    { role: 'assistant' as const, content: t.texto.join('\n') },
  ])
  const pedido: MensagemLlm[] = [
    { role: 'system', content: SISTEMA },
    ...turnos,
    {
      role: 'user',
      content: [TAREFA, descreverPerfil(perfil), contextoHistorico(eventos), `Pergunta: ${entrada.pergunta}`].join('\n\n'),
    },
  ]
  const r = await pedirJson(llm, pedido, esquema)

  const texto = limparTextos(r.texto, eventos)
  const ancoras = filtrarAncoras(r.ancoras, validos)
  const repeticao = respostaDeRepeticao(eventos, entrada.pergunta, ancoras)
  if (repeticao) return { ...repeticao, geradoPor: llm.nome }
  const aviso = avisoPara(entrada.pergunta, r.aviso && limparTexto(r.aviso, eventos))
  if (!texto.length || !ancoras.length) return { texto: [SEM_BASE], ancoras: [], ...(aviso && { aviso }), geradoPor: llm.nome }

  const serie = serieDaPergunta(eventos, entrada.pergunta) ?? (r.serie ? montarSerie(eventos, r.serie.medida) : undefined)
  return { texto, ancoras, ...(serie && { serie }), ...(aviso && { aviso }), geradoPor: llm.nome }
}
