import { z } from 'zod'
import { responder } from '../../../src/data/copiloto.js'
import type { Evento, Medida } from '../../../src/data/types.js'
import { analitoDaPergunta, analitoDe, chaveDaMedida } from '../analitos.js'
import { type Pendencia, derivarFatos } from '../fatos.js'
import { avisoPara } from '../guardrails.js'
import { pedirJson } from '../json.js'
import { SISTEMA, contextoHistorico, descreverPerfil } from '../prompts.js'
import type { MensagemLlm } from '../provider.js'
import { limparTexto, limparTextos } from '../texto.js'
import { naVozDoResponsavel, textosNaVoz } from '../voz.js'
import { dataBR, filtrarAncoras, formatarNumero, idsDe, mesAno, normalizar, porData, type ContextoIa } from './comum.js'

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

const TAREFA = `Tarefa: responder à pergunta da pessoa usando apenas os registros do histórico abaixo.
Formato da resposta (JSON):
{"texto": ["parágrafo curto"], "ancoras": ["e01"], "serie": {"medida": "nome exato de uma medida"} ou null, "aviso": "lembrete curto" ou null}
- "texto": 1 a 4 parágrafos curtos, citando datas e valores dos registros. Refira-se a um registro pelo nome e pela data (ex.: "o exame de 05/03/2026"), nunca pelo id.
- "ancoras": ids de todos os registros que sustentam a resposta. Se nada no histórico sustenta uma resposta, use [] e diga que não encontrou.
- Perguntas sobre exames repetidos ou desnecessários, pendências ou evolução de uma medida: responda a partir dos FATOS DERIVADOS e inclua nas âncoras os ids que eles citam.
- Perguntas sobre parar, trocar ou ajustar um remédio: não diga se pode ou não; conte o que os registros mostram sobre esse remédio (com âncoras) e preencha o "aviso".
- Evolução de uma medida: cite todos os valores listados para ela em "Evolução das medidas" dos FATOS DERIVADOS, com as datas. Não registrar algo não é o mesmo que não mudar: sem registro posterior, diga que não há registro posterior no histórico, nunca que "não houve alteração".
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

const PERGUNTA_PENDENCIA = /pendent|pendenc|faltou|faltando|ficou para tras|esqueci|em aberto|atrasad/
const CONFIRME_PENDENCIAS = 'Confirme com quem acompanha você se esses itens ainda são necessários.'

const VAZIAS_PENDENCIA = new Set(['nova', 'novo', 'novas', 'novos', 'exame', 'exames', 'prova', 'para', 'com'])
const palavrasDoAlvo = (alvo: string) =>
  normalizar(alvo).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !VAZIAS_PENDENCIA.has(w))

/* A pendência está na resposta se o modelo ancorou o registro e nomeou o alvo; retorno e pedido da mesma
   consulta dividem a âncora, então o retorno precisa ser dito como retorno. */
const citaPendencia = (p: Pendencia, texto: string, ancoras: string[]) => ancoras.includes(p.ancoras[0])
  && (p.tipo !== 'retorno' || /retorn|voltar|volta a|acompanhamento/.test(texto))
  && palavrasDoAlvo(p.alvo).some((w) => texto.includes(w))

/* Visto em produção: "Ficou alguma coisa pendente?" → "Não encontrei", com retorno e espirometria
   pedidos em 04/11/2025 e nunca registrados; depois, só a espirometria, sem o retorno vencido.
   Pendência é fato calculado: se o modelo não citou nenhuma, a resposta vem dos fatos; se citou parte,
   as que faltaram entram no fim da resposta. */
function respostaDePendencia(eventos: Evento[], pergunta: string, texto: string[], ancoras: string[]): Omit<RespostaCopiloto, 'geradoPor'> | undefined {
  if (!PERGUNTA_PENDENCIA.test(normalizar(pergunta))) return undefined
  const { pendencias } = derivarFatos(eventos)
  const dito = normalizar(texto.join(' '))
  const faltam = pendencias.filter((p) => !citaPendencia(p, dito, ancoras))
  if (!faltam.length) return undefined
  if (!pendencias.some((p) => ancoras.includes(p.ancoras[0]))) {
    return {
      texto: [...pendencias.map((p) => p.descricao), CONFIRME_PENDENCIAS],
      ancoras: [...new Set(pendencias.flatMap((p) => p.ancoras))],
    }
  }
  return {
    texto: [...texto, ...faltam.map((p) => p.descricao)],
    ancoras: [...new Set([...ancoras, ...faltam.flatMap((p) => p.ancoras)])],
  }
}

/* O modelo só devolvia "serie" em 4 de 5 perguntas sobre a glicada, e "LDL-colesterol" não casava
   com "colesterol ldl": a série sai da pergunta, pelo analito, sem depender do texto do modelo. */
export function serieDaPergunta(eventos: Evento[], pergunta: string): Serie | undefined {
  const alvo = analitoDaPergunta(pergunta)
  return alvo ? montarSerie(eventos, alvo) : undefined
}

/* Medida fora da lista de analitos: o nome exato, ou o único que contém o texto pedido. */
function chaveDoPedido(medidas: Medida[], medida: string): string | undefined {
  const analito = analitoDe(medida)
  if (analito) return analito
  const alvo = normalizar(medida)
  const nomes = [...new Set(medidas.map((m) => m.nome))]
  const contendo = nomes.filter((n) => normalizar(n).includes(alvo))
  const nome = nomes.find((n) => normalizar(n) === alvo) ?? (contendo.length === 1 ? contendo[0] : undefined)
  const exemplo = nome && medidas.find((m) => m.nome === nome)
  return exemplo ? chaveDaMedida(exemplo) : undefined
}

/* Os números da série vêm sempre dos registros, nunca do modelo. */
export function montarSerie(eventos: Evento[], medida: string): Serie | undefined {
  const chave = chaveDoPedido(eventos.flatMap((e) => e.medidas ?? []), medida)
  if (!chave) return undefined
  const pontos = [...eventos].sort(porData).flatMap((e) => (e.medidas ?? []).filter((m) => chaveDaMedida(m) === chave)
    .map((m) => ({ data: mesAno(e.data), valor: m.valor, unidade: m.unidade, nome: m.nome })))
  if (pontos.length < 2) return undefined
  return {
    nome: analitoDe(medida) ?? pontos[0].nome,
    unidade: pontos.at(-1)!.unidade,
    pontos: pontos.map(({ data, valor }) => ({ data, valor })),
  }
}

/* Modo cuidador: respostas, fallbacks e avisos falam do paciente na 3ª pessoa (voz.ts). */
export async function responderCopiloto(contexto: ContextoIa, entrada: EntradaCopiloto): Promise<RespostaCopiloto> {
  const r = await responderNoHistorico(contexto, entrada)
  return {
    ...r, texto: textosNaVoz(r.texto, contexto.perfil),
    ...(r.aviso && { aviso: naVozDoResponsavel(r.aviso, contexto.perfil) }),
  }
}

async function responderNoHistorico({ repo, llm, perfil }: ContextoIa, entrada: EntradaCopiloto): Promise<RespostaCopiloto> {
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
      const deFatos = respostaDeRepeticao(eventos, entrada.pergunta, []) ?? respostaDePendencia(eventos, entrada.pergunta, [], [])
      if (deFatos) return { ...deFatos, geradoPor: llm.nome }
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
  const deFatos = respostaDeRepeticao(eventos, entrada.pergunta, ancoras) ?? respostaDePendencia(eventos, entrada.pergunta, texto, ancoras)
  if (deFatos) return { ...deFatos, geradoPor: llm.nome }
  const aviso = avisoPara(entrada.pergunta, r.aviso && limparTexto(r.aviso, eventos))
  if (!texto.length || !ancoras.length) return { texto: [SEM_BASE], ancoras: [], ...(aviso && { aviso }), geradoPor: llm.nome }

  const serie = serieDaPergunta(eventos, entrada.pergunta) ?? (r.serie ? montarSerie(eventos, r.serie.medida) : undefined)
  return { texto: semNegarMudanca(texto, serie), ancoras, ...(serie && { serie }), ...(aviso && { aviso }), geradoPor: llm.nome }
}

const NEGA_MUDANCA = /\b(?:nao|sem)\b[^.]{0,40}\b(?:alterac|mudanc|variac)\w*|\b(?:manteve|mantem|permaneceu)\b[^.]{0,20}\b(?:estavel|igual|o mesmo)/

/* Visto em produção: "não há registros de alterações subsequentes" com a TFG caindo de 101 para 85.
   Se a série dos registros mudou, a frase que nega a mudança sai e a evolução vem dos números. */
function semNegarMudanca(texto: string[], serie: Serie | undefined): string[] {
  if (!serie) return texto
  const valores = serie.pontos.map((p) => p.valor)
  if (valores.every((v) => v === valores[0])) return texto
  const mantidos = texto.filter((t) => !NEGA_MUDANCA.test(normalizar(t)))
  if (mantidos.length === texto.length) return texto
  const evolucao = serie.pontos.map((p) => `${formatarNumero(p.valor)} ${serie.unidade} em ${p.data}`).join('; ')
  return [...mantidos, `Nos seus registros, ${serie.nome} foi: ${evolucao}.`]
}
