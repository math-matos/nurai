import { z } from 'zod'
import type { Evento } from '../../../src/data/types.js'
import { recomendaConduta } from '../guardrails.js'
import { pedirJson } from '../json.js'
import { autorDe, type NovoAcesso } from '../../db/repo.js'
import { contextoHistorico, descreverPerfil, mensagens } from '../prompts.js'
import { limparTexto, limparTextos } from '../texto.js'
import { dataBR, filtrarAncoras, idsDe, mesAno, normalizar, porData, type ContextoIa } from './comum.js'

export interface RespostaResumo {
  especialidade: string
  sintese: string[]
  pontos: { texto: string; ancoras: string[] }[]
  perguntasSugeridas: string[]
  aviso: string
  geradoPor: 'oci' | 'mock'
}

const AVISO = 'Resumo montado a partir dos registros do seu histórico para apoiar a conversa com o médico — não substitui a avaliação clínica.'
const MAX_PONTOS = 6
/* Tags que não indicam especialidade e puxariam registros sem relação. */
const TAGS_GENERICAS = new Set(['imagem', 'medicacao', 'papel', 'vacina', 'procedimento', 'diagnostico'])

const esquema = z.object({
  sintese: z.array(z.string()).min(1),
  pontos: z.array(z.object({ texto: z.string(), ancoras: z.array(z.string()) })),
  perguntasSugeridas: z.array(z.string()),
})

const tarefa = (especialidade: string) => `Tarefa: preparar um resumo pré-consulta para a especialidade "${especialidade}", que a pessoa vai levar ao médico. Selecione apenas o que é relevante para essa especialidade.
Formato da resposta (JSON):
{"sintese": ["frase"], "pontos": [{"texto": "fato objetivo e datado", "ancoras": ["e01"]}], "perguntasSugeridas": ["..."]}
- "sintese": 1 a 3 frases sobre o quadro registrado relevante para a especialidade.
- "pontos": até ${MAX_PONTOS} fatos objetivos e datados (mudanças recentes, exames alterados, medicamentos, pendências), cada um com os ids que o sustentam.
- Para dizer se uma medida subiu ou caiu, use a variação indicada nos FATOS DERIVADOS para aquela data; não calcule tendência por conta própria.
- Descreva o que foi registrado; não recomende manter, iniciar, suspender ou mudar remédios.
- "perguntasSugeridas": 2 a 4 perguntas para a pessoa levar à consulta.
- No texto, refira-se a um registro pelo nome e pela data (ex.: "o exame de 05/03/2026"), nunca pelo id; ids vão só em "ancoras".`

function relevantes(eventos: Evento[], especialidade: string): Evento[] {
  const alvo = normalizar(especialidade)
  const base = eventos.filter((e) => e.especialidade && normalizar(e.especialidade).includes(alvo))
  const tags = new Set(base.flatMap((e) => e.tags).filter((t) => !TAGS_GENERICAS.has(normalizar(t))))
  const doTema = eventos.filter((e) => base.includes(e) || e.tags.some((t) => tags.has(t)))
  return (doTema.length ? doTema : eventos.filter((e) => e.sinal === 'alterado').slice(-MAX_PONTOS)).sort(porData)
}

function resumirSemIa(eventos: Evento[], especialidade: string): Omit<RespostaResumo, 'especialidade' | 'aviso' | 'geradoPor'> {
  const doTema = relevantes(eventos, especialidade)
  const primeiro = doTema[0]
  const ultimo = doTema.at(-1)!
  const destaque = doTema.filter((e) => e.sinal === 'alterado' || e.sinal === 'atencao')
  return {
    sintese: [
      `Encontrei ${doTema.length} registro(s) relacionados a ${especialidade}, entre ${mesAno(primeiro.data)} e ${mesAno(ultimo.data)}.`,
      `O mais recente é "${ultimo.titulo}", de ${dataBR(ultimo.data)}.`,
    ],
    pontos: (destaque.length ? destaque : doTema).slice(-MAX_PONTOS).reverse().map((e) => ({
      texto: `${dataBR(e.data)} — ${e.titulo}: ${e.resumo}`,
      ancoras: [e.id],
    })),
    perguntasSugeridas: [
      'O que mudou no meu acompanhamento desde a última consulta?',
      'Algum desses resultados muda o que eu preciso fazer agora?',
      'Quando devo repetir os exames de controle?',
    ],
  }
}

/* Quem pede o resumo vai para o log de acessos: quem usa a conta (titular ou responsável), por padrão, ou o
   profissional que entrou pelo código. */
export type AutorResumo = Omit<NovoAcesso, 'itens'>

export async function gerarResumo(
  { repo, llm, perfil }: ContextoIa, especialidade: string,
  autor: AutorResumo = { ...autorDe(perfil), acao: 'Gerou resumo pré-consulta' },
): Promise<RespostaResumo> {
  const { eventos } = await repo.estado()
  const semBase = (sintese: string): RespostaResumo =>
    ({ especialidade, sintese: [sintese], pontos: [], perguntasSugeridas: [], aviso: AVISO, geradoPor: llm.nome })
  if (!eventos.length) {
    return semBase(`Seu histórico ainda está vazio, então não há registros para montar um resumo de ${especialidade}. Anexe exames ou laudos em Fontes e gere o resumo de novo.`)
  }
  /* Especialidade livre ("Outra…") pode não casar com nada; sem registro do tema nem alterado, não há o que resumir. */
  if (!relevantes(eventos, especialidade).length) {
    return semBase(`Não encontrei registros de ${especialidade} no histórico, nem resultados alterados para levar à consulta. Anexe exames, laudos ou receitas dessa especialidade em Fontes e gere o resumo de novo.`)
  }
  let corpo: Omit<RespostaResumo, 'especialidade' | 'aviso' | 'geradoPor'>
  if (llm.nome === 'mock') {
    corpo = resumirSemIa(eventos, especialidade)
  } else {
    const r = await pedirJson(llm, mensagens(tarefa(especialidade), descreverPerfil(perfil), contextoHistorico(eventos)), esquema, { maxTokens: 2000 })
    const validos = idsDe(eventos)
    /* Perguntas à médica podem falar de remédio ("Devo manter...?"); síntese e pontos não recomendam conduta. */
    const sintese = limparTextos(r.sintese, eventos).filter((t) => !recomendaConduta(t))
    corpo = {
      sintese: sintese.length ? sintese : resumirSemIa(eventos, especialidade).sintese,
      pontos: r.pontos
        .map((p) => ({ texto: limparTexto(p.texto, eventos), ancoras: filtrarAncoras(p.ancoras, validos) }))
        .filter((p) => p.texto && p.ancoras.length && !recomendaConduta(p.texto)),
      perguntasSugeridas: limparTextos(r.perguntasSugeridas, eventos),
    }
  }
  await repo.registrarAcesso({ ...autor, itens: especialidade })
  return { especialidade, ...corpo, aviso: AVISO, geradoPor: llm.nome }
}
