import { z } from 'zod'
import type { Evento, Medida } from '../../../src/data/types.js'
import type { Deps } from '../../app.js'
import { pedirJson } from '../json.js'
import { mensagens, serializarEvento, serializarEventos } from '../prompts.js'
import { limparTextos } from '../texto.js'
import { dataBR, filtrarAncoras, formatarNumero, idsDe, mesAno, porData } from './comum.js'

export interface RespostaExplicacao {
  explicacao: string[]
  pontosDeAtencao: string[]
  perguntasParaMedico: string[]
  ancoras: string[]
  aviso: string
  geradoPor: 'oci' | 'mock'
}

const AVISO = 'Esta explicação organiza o que está no seu histórico e não substitui a avaliação do seu médico.'
const MAX_ANTERIORES = 8

const esquema = z.object({
  explicacao: z.array(z.string()).min(1),
  pontosDeAtencao: z.array(z.string()),
  perguntasParaMedico: z.array(z.string()),
  ancoras: z.array(z.string()),
})

const tarefa = (id: string) => `Tarefa: explicar para a paciente, em linguagem simples, o registro [${id}], comparando com os registros anteriores relacionados quando houver.
Formato da resposta (JSON):
{"explicacao": ["parágrafo curto"], "pontosDeAtencao": ["..."], "perguntasParaMedico": ["..."], "ancoras": ["${id}"]}
- "explicacao": 1 a 3 parágrafos curtos sobre o que o exame mede e o que o registro mostra.
- "pontosDeAtencao": valores fora da faixa de referência e mudanças em relação aos registros anteriores, descritos sem interpretar como diagnóstico. Pode ser [].
- "perguntasParaMedico": 2 a 4 perguntas que a paciente pode levar à consulta.
- "ancoras": ids dos registros citados.`

/* Registros anteriores com alguma medida em comum; sem medidas, mesmo tipo com tag em comum. */
function anterioresRelacionados(evento: Evento, eventos: Evento[]): Evento[] {
  const medidas = new Set(evento.medidas?.map((m) => m.nome))
  const tags = new Set(evento.tags)
  return eventos
    .filter((e) => e.id !== evento.id && e.data <= evento.data)
    .filter((e) => medidas.size
      ? e.medidas?.some((m) => medidas.has(m.nome))
      : e.tipo === evento.tipo && e.tags.some((t) => tags.has(t)))
    .sort(porData)
    .slice(-MAX_ANTERIORES)
}

function descreverFaixa(m: Medida): string {
  if (m.valor < m.refMin) return 'abaixo da faixa de referência'
  if (m.valor > m.refMax) return 'acima da faixa de referência'
  return 'dentro da faixa de referência'
}

function explicarSemIa(evento: Evento, anteriores: Evento[]): Omit<RespostaExplicacao, 'aviso' | 'geradoPor'> {
  const ancoras = [evento.id]
  const pontosDeAtencao = (evento.medidas ?? [])
    .filter((m) => m.sinal === 'alterado' || m.sinal === 'atencao')
    .map((m) => {
      const anterior = anteriores.findLast((e) => e.medidas?.some((x) => x.nome === m.nome))
      const valorAnterior = anterior?.medidas?.find((x) => x.nome === m.nome)
      if (anterior) ancoras.push(anterior.id)
      const evolucao = valorAnterior ? ` Na medição anterior (${mesAno(anterior!.data)}), era ${formatarNumero(valorAnterior.valor)}.` : ''
      return `${m.nome}: ${formatarNumero(m.valor)} ${m.unidade}, ${descreverFaixa(m)} (${formatarNumero(m.refMin)} a ${formatarNumero(m.refMax)}).${evolucao}`
    })
  const alteradas = (evento.medidas ?? []).filter((m) => m.sinal === 'alterado')
  return {
    explicacao: [`${evento.titulo}, registrado em ${dataBR(evento.data)} por ${evento.instituicao}.`, evento.resumo],
    pontosDeAtencao,
    perguntasParaMedico: [
      ...alteradas.slice(0, 2).map((m) => `O que significa ${m.nome} ${descreverFaixa(m)} no meu caso?`),
      'Preciso repetir este exame? Quando?',
      'Este resultado muda algo no meu acompanhamento?',
    ],
    ancoras: [...new Set(ancoras)],
  }
}

export async function explicarExame({ repo, llm }: Deps, id: string): Promise<RespostaExplicacao | null> {
  const { eventos } = await repo.estado()
  const evento = eventos.find((e) => e.id === id)
  if (!evento) return null
  const anteriores = anterioresRelacionados(evento, eventos)

  if (llm.nome === 'mock') return { ...explicarSemIa(evento, anteriores), aviso: AVISO, geradoPor: llm.nome }

  const r = await pedirJson(llm, mensagens(
    tarefa(evento.id),
    `Registro a explicar:\n${serializarEvento(evento)}`,
    anteriores.length ? `Registros anteriores relacionados:\n${serializarEventos(anteriores)}` : 'Não há registros anteriores relacionados.',
  ), esquema)
  return {
    explicacao: limparTextos(r.explicacao),
    pontosDeAtencao: limparTextos(r.pontosDeAtencao),
    perguntasParaMedico: limparTextos(r.perguntasParaMedico),
    ancoras: filtrarAncoras([evento.id, ...r.ancoras], idsDe([evento, ...anteriores])),
    aviso: AVISO,
    geradoPor: llm.nome,
  }
}
