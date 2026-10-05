import { z } from 'zod'
import type { Evento, ProximoPasso } from '../../../src/data/types.js'
import type { Deps } from '../../app.js'
import { ErroIa } from '../erros.js'
import { pedirJson } from '../json.js'
import { PERFIL, mensagens, serializarEventos } from '../prompts.js'
import { dataBR, filtrarAncoras, idsDe, normalizar, porData } from './comum.js'

export interface RespostaPassos {
  passos: ProximoPasso[]
  geradoPor: 'oci' | 'mock'
}

const MAX_PASSOS = 6
const JANELA_REPETICAO_DIAS = 180
const JANELA_RECENTE_DIAS = 180
const DIA_MS = 86_400_000

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
Os passos são de organização (levar um laudo, agendar, perguntar, confirmar com quem pediu). Nunca sugira iniciar, suspender ou mudar tratamento.
Formato da resposta (JSON):
{"passos": [{"titulo": "ação curta no imperativo", "porque": "fatos e datas dos registros", "ancoras": ["e01"], "prazo": "ex.: Próxima consulta", "prioridade": "alta" | "media" | "baixa"}]}
- 1 a ${MAX_PASSOS} passos, os mais importantes primeiro, cada um com os ids que o sustentam.`

const dias = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / DIA_MS)
const PALAVRAS_VAZIAS = new Set(['novo', 'nova', 'exame', 'exames', 'para', 'com', 'sem'])

function palavrasDe(texto: string): string[] {
  return normalizar(texto).split(/[^a-z0-9]+/).filter((p) => p.length >= 4 && !PALAVRAS_VAZIAS.has(p))
}

/* "Solicitado ultrassom de carótidas" num registro posterior a um "Ultrassom ... de carótidas" já feito. */
function examesRepetidos(eventos: Evento[]): PassoBruto[] {
  return eventos.flatMap((pedido) => {
    const trecho = pedido.resumo.match(/solicitad[oa]s?\s+([^.;—–]+)/i)?.[1]
    if (!trecho) return []
    return trecho.split(/,|\se\s/).flatMap((item) => {
      const palavras = palavrasDe(item)
      const feito = palavras.length && eventos.findLast((e) =>
        e.data < pedido.data && dias(e.data, pedido.data) <= JANELA_REPETICAO_DIAS
        && ['exame', 'imagem', 'documento'].includes(e.tipo)
        && palavras.every((p) => normalizar(e.titulo).includes(p)))
      if (!feito) return []
      return [{
        titulo: `Levar o laudo de "${feito.titulo}" a quem pediu o novo exame`,
        porque: `O exame foi feito em ${dataBR(feito.data)} (${feito.instituicao}) e um novo pedido apareceu em ${dataBR(pedido.data)} (${pedido.instituicao}), ${dias(feito.data, pedido.data)} dias depois. Confirme com quem pediu se ele ainda é necessário.`,
        ancoras: [feito.id, pedido.id],
        prazo: 'Antes da data marcada',
        prioridade: 'alta' as const,
      }]
    })
  })
}

/* Retorno ou reavaliação recomendados sem nenhum registro posterior da mesma especialidade. */
function pendencias(eventos: Evento[]): PassoBruto[] {
  return eventos
    .filter((e) => e.especialidade && /retorno|reavalia/i.test(e.resumo))
    .filter((e) => !eventos.some((d) => d.data > e.data && d.especialidade === e.especialidade))
    .map((e) => ({
      titulo: `Retomar o acompanhamento de ${e.especialidade!.toLowerCase()}`,
      porque: `Em ${dataBR(e.data)}, "${e.titulo}" registrou: ${e.resumo} Não há registro posterior dessa especialidade no histórico.`,
      ancoras: [e.id],
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
  const prioritarios = [...examesRepetidos(ordenados), ...pendencias(ordenados)]
  const citados = new Set(prioritarios.flatMap((p) => p.ancoras))
  return [...prioritarios, ...resultadosRecentes(ordenados, citados)]
}

export async function gerarPassos({ repo, llm }: Deps): Promise<RespostaPassos> {
  const { eventos, passos: atuais } = await repo.estado()
  const brutos = llm.nome === 'mock'
    ? passosSemIa(eventos)
    : (await pedirJson(llm, mensagens(
        TAREFA, PERFIL, `Histórico (${eventos.length} registros):\n${serializarEventos(eventos)}`,
      ), esquema, { maxTokens: 2000 })).passos

  const validos = idsDe(eventos)
  const feitos = new Set(atuais.filter((p) => p.feito).map((p) => normalizar(p.titulo)))
  const passos: ProximoPasso[] = brutos
    .map((p) => ({ ...p, ancoras: filtrarAncoras(p.ancoras, validos) }))
    .filter((p) => p.ancoras.length)
    .slice(0, MAX_PASSOS)
    .map((p, i) => ({ id: `p-ia-${i + 1}`, ...p, feito: feitos.has(normalizar(p.titulo)) }))
  /* Não apagar a lista atual da paciente por uma resposta sem nenhum passo sustentado. */
  if (!passos.length) throw new ErroIa('IA_RESPOSTA_INVALIDA', 'A IA não encontrou passos sustentados pelo histórico')

  return { passos: await repo.substituirPassos(passos), geradoPor: llm.nome }
}
