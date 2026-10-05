import { z } from 'zod'
import { responder } from '../../../src/data/copiloto.js'
import type { Evento } from '../../../src/data/types.js'
import type { Deps } from '../../app.js'
import { pedirJson } from '../json.js'
import { PERFIL, SISTEMA, serializarEventos } from '../prompts.js'
import type { MensagemLlm } from '../provider.js'
import { filtrarAncoras, idsDe, mesAno, normalizar, porData } from './comum.js'

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
const TURNOS_ANTERIORES = 6

const TAREFA = `Tarefa: responder à pergunta da paciente usando apenas os registros do histórico abaixo.
Formato da resposta (JSON):
{"texto": ["parágrafo curto"], "ancoras": ["e01"], "serie": {"medida": "nome exato de uma medida"} ou null, "aviso": "lembrete curto" ou null}
- "texto": 1 a 4 parágrafos curtos, citando datas e valores dos registros.
- "ancoras": ids de todos os registros que sustentam a resposta. Se nada no histórico sustenta uma resposta, use [] e diga que não encontrou.
- "serie": só quando a pergunta for sobre a evolução de uma medida numérica; use o nome da medida exatamente como aparece em "Medidas". Caso contrário, null.
- "aviso": quando a pergunta envolver uma decisão de saúde (parar, trocar, cancelar algo), um lembrete para confirmar com o médico; caso contrário, null.`

const esquema = z.object({
  texto: z.array(z.string()).min(1),
  ancoras: z.array(z.string()),
  serie: z.object({ medida: z.string() }).nullish(),
  aviso: z.string().nullish(),
})

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

export async function responderCopiloto({ repo, llm }: Deps, entrada: EntradaCopiloto): Promise<RespostaCopiloto> {
  const { eventos } = await repo.estado()
  const validos = idsDe(eventos)

  if (llm.nome === 'mock') {
    const resposta = responder(entrada.pergunta)
    return { ...resposta, ancoras: filtrarAncoras(resposta.ancoras, validos), geradoPor: llm.nome }
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
      content: [TAREFA, PERFIL, `Histórico (${eventos.length} registros):\n${serializarEventos(eventos)}`, `Pergunta: ${entrada.pergunta}`].join('\n\n'),
    },
  ]
  const r = await pedirJson(llm, pedido, esquema)

  const texto = r.texto.map((t) => t.trim()).filter(Boolean)
  const ancoras = filtrarAncoras(r.ancoras, validos)
  if (!texto.length || !ancoras.length) return { texto: [SEM_BASE], ancoras: [], geradoPor: llm.nome }

  const serie = r.serie ? montarSerie(eventos, r.serie.medida) : undefined
  const aviso = r.aviso?.trim()
  return { texto, ancoras, ...(serie && { serie }), ...(aviso && { aviso }), geradoPor: llm.nome }
}
