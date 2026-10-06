import { z } from 'zod'
import type { Evento, ProximoPasso } from '../../../src/data/types.js'
import { ErroIa } from '../erros.js'
import { type Fatos, type Pendencia, derivarFatos, dias } from '../fatos.js'
import { recomendaConduta } from '../guardrails.js'
import { pedirJson } from '../json.js'
import { contextoHistorico, descreverPerfil, mensagens } from '../prompts.js'
import { limparTexto } from '../texto.js'
import { dataBR, filtrarAncoras, idsDe, normalizar, porData, type ContextoIa } from './comum.js'

export interface RespostaPassos {
  passos: ProximoPasso[]
  geradoPor: 'oci' | 'mock'
}

const MAX_PASSOS = 6
const JANELA_RECENTE_DIAS = 180

const esquemaPasso = z.object({
  titulo: z.string().trim().min(1),
  porque: z.string().trim().min(1),
  ancoras: z.array(z.string()),
  prazo: z.string().trim().min(1),
  prioridade: z.enum(['alta', 'media', 'baixa']),
})
type PassoBruto = z.infer<typeof esquemaPasso>
const esquema = z.object({ passos: z.array(esquemaPasso) })

const TAREFA = `Tarefa: listar os próximos passos práticos do acompanhamento da paciente com base no histórico. Procure especialmente:
1. exames repetidos ou duplicados: o mesmo exame pedido ou feito de novo pouco tempo depois de um já realizado (cite os dois registros);
2. pendências: retornos, reavaliações ou exames recomendados que não aparecem depois no histórico;
3. resultados recentes alterados que ainda não aparecem avaliados em uma consulta posterior.
Use os FATOS DERIVADOS: cada exame possivelmente repetido e cada pendência listados ali deve virar um passo, com os ids que o fato cita. Não diga que um exame não foi feito se ele aparece no histórico.
Os passos são de organização (levar um laudo, agendar, perguntar, confirmar com quem pediu). Nunca sugira iniciar, manter, suspender ou mudar remédio ou tratamento — nem como pergunta ao médico, nem como "verificar/avaliar a necessidade de ajuste, troca, suspensão, aumento ou redução" de um remédio ou dose. Remédios só aparecem como fato registrado no "porque".
Formato da resposta (JSON):
{"passos": [{"titulo": "ação curta no imperativo", "porque": "fatos e datas dos registros", "ancoras": ["e01"], "prazo": "ex.: Próxima consulta", "prioridade": "alta" | "media" | "baixa"}]}
- 1 a ${MAX_PASSOS} passos, os mais importantes primeiro, cada um com os ids que o sustentam em "ancoras".
- Em "titulo" e "porque", refira-se a um registro pelo nome e pela data (ex.: "o exame de 05/03/2026"), nunca pelo id.`

/* Exames repetidos e pendências vêm dos fatos derivados — a mesma regra que o modelo recebe. */
function examesRepetidos({ repeticoes }: Fatos): PassoBruto[] {
  return repeticoes.map((r) => ({
    titulo: `Levar o laudo de "${r.exame}" a quem pediu o novo exame`,
    porque: `O exame foi feito em ${dataBR(r.feitoData)} (${r.feitoInstituicao}) e um novo pedido apareceu em ${dataBR(r.pedidoData)} (${r.pedidoInstituicao}), ${r.dias} dias depois. Confirme com quem pediu se ele ainda é necessário.`,
    ancoras: [r.feito, r.pedido],
    prazo: 'Antes da data marcada',
    prioridade: 'alta' as const,
  }))
}

const TITULO_PENDENCIA: Record<Pendencia['tipo'], (alvo: string) => string> = {
  reavaliacao: (alvo) => `Repetir o ${alvo} — a reavaliação pedida não aparece no histórico`,
  retorno: (alvo) => `Retomar o acompanhamento de ${alvo.toLowerCase()}`,
  pedido: (alvo) => `Confirmar se ${alvo} ainda precisa ser feito`,
}

function pendencias({ pendencias }: Fatos): PassoBruto[] {
  return pendencias.map((p) => ({
    titulo: TITULO_PENDENCIA[p.tipo](p.alvo),
    porque: p.descricao,
    ancoras: p.ancoras,
    prazo: 'Em até 30 dias',
    prioridade: 'alta' as const,
  }))
}

function resultadosRecentes(eventos: Evento[], jaCitados: Set<string>): PassoBruto[] {
  const ultimaData = eventos.at(-1)?.data ?? ''
  return eventos
    .filter((e) => ['exame', 'imagem', 'documento'].includes(e.tipo) && !jaCitados.has(e.id))
    .filter((e) => (e.sinal === 'alterado' || e.sinal === 'atencao') && dias(e.data, ultimaData) <= JANELA_RECENTE_DIAS)
    .map((e) => ({
      titulo: `Levar "${e.titulo}" à próxima consulta`,
      porque: `Resultado de ${dataBR(e.data)} (${e.instituicao}) marcado para atenção: ${e.resumo}`,
      ancoras: [e.id],
      prazo: 'Próxima consulta',
      prioridade: 'media' as const,
    }))
}

function passosSemIa(eventos: Evento[]): PassoBruto[] {
  const ordenados = [...eventos].sort(porData)
  const fatos = derivarFatos(ordenados)
  const prioritarios = [...examesRepetidos(fatos), ...pendencias(fatos)]
  const citados = new Set(prioritarios.flatMap((p) => p.ancoras))
  return [...prioritarios, ...resultadosRecentes(ordenados, citados)]
}

export async function gerarPassos({ repo, llm, perfil }: ContextoIa): Promise<RespostaPassos> {
  const { eventos, passos: atuais } = await repo.estado()
  if (!eventos.length) return { passos: [], geradoPor: llm.nome }
  const brutos = llm.nome === 'mock'
    ? passosSemIa(eventos)
    : (await pedirJson(llm, mensagens(TAREFA, descreverPerfil(perfil), contextoHistorico(eventos)), esquema, { maxTokens: 2000 })).passos

  const validos = idsDe(eventos)
  const feitos = new Set(atuais.filter((p) => p.feito).map((p) => normalizar(p.titulo)))
  const passos: ProximoPasso[] = brutos
    .map((p) => ({
      ...p, titulo: limparTexto(p.titulo, eventos), porque: limparTexto(p.porque, eventos), prazo: limparTexto(p.prazo, eventos),
      ancoras: filtrarAncoras(p.ancoras, validos),
    }))
    .filter((p) => p.titulo && p.ancoras.length && !recomendaConduta(`${p.titulo} ${p.porque}`))
    .slice(0, MAX_PASSOS)
    .map((p, i) => ({ id: `p-ia-${i + 1}`, ...p, feito: feitos.has(normalizar(p.titulo)) }))
  /* Não apagar a lista atual da paciente por uma resposta sem nenhum passo sustentado. */
  if (!passos.length) throw new ErroIa('IA_RESPOSTA_INVALIDA', 'A IA não encontrou passos sustentados pelo histórico')

  return { passos: await repo.substituirPassos(passos), geradoPor: llm.nome }
}
