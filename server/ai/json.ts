import type { z } from 'zod'
import { ErroIa } from './erros.js'
import type { LlmProvider, MensagemLlm, OpcoesChat } from './provider.js'

/* Primeiro objeto JSON balanceado do texto — modelos costumam embrulhar em ```json ou prosa. */
export function extrairJson(texto: string): unknown {
  const inicio = texto.indexOf('{')
  if (inicio < 0) throw new Error('nenhum objeto JSON na resposta')
  let profundidade = 0
  let emString = false
  let escape = false
  for (let i = inicio; i < texto.length; i++) {
    const ch = texto[i]
    if (emString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') emString = false
    } else if (ch === '"') emString = true
    else if (ch === '{') profundidade++
    else if (ch === '}' && --profundidade === 0) return JSON.parse(texto.slice(inicio, i + 1))
  }
  throw new Error('objeto JSON incompleto na resposta')
}

function validar<T>(bruto: string, esquema: z.ZodType<T>): { ok: true; valor: T } | { ok: false; erro: string } {
  let json: unknown
  try {
    json = extrairJson(bruto)
  } catch (e) {
    return { ok: false, erro: (e as Error).message }
  }
  const r = esquema.safeParse(json)
  if (r.success) return { ok: true, valor: r.data }
  const erro = r.error.issues.map((i) => `${i.path.join('.') || 'raiz'}: ${i.message}`).join('; ')
  return { ok: false, erro }
}

async function conversar(llm: LlmProvider, mensagens: MensagemLlm[], opcoes: OpcoesChat) {
  try {
    return await llm.chat(mensagens, opcoes)
  } catch (e) {
    if (e instanceof ErroIa) throw e
    console.error(`[ia] provider ${llm.nome} falhou: ${(e as Error).name}`)
    throw new ErroIa('IA_INDISPONIVEL', 'Serviço de IA indisponível no momento')
  }
}

/* A função na Vercel morre em 60 s (vercel.json) e devolveria 504 sem JSON: tentativa e retry
   dividem um prazo único, com folga para o resto da requisição. */
export const ORCAMENTO_IA_MS = 50_000
export const MINIMO_RETRY_MS = 15_000

export async function pedirJson<T>(
  llm: LlmProvider,
  mensagens: MensagemLlm[],
  esquema: z.ZodType<T>,
  opcoes: Omit<OpcoesChat, 'json' | 'timeoutMs'> = {},
): Promise<T> {
  const prazo = Date.now() + ORCAMENTO_IA_MS
  const config = { temperatura: 0.2, maxTokens: 1500, ...opcoes, json: true }
  const primeira = await conversar(llm, mensagens, { ...config, timeoutMs: ORCAMENTO_IA_MS })
  const r1 = validar(primeira, esquema)
  if (r1.ok) return r1.valor

  const restante = prazo - Date.now()
  if (restante < MINIMO_RETRY_MS) {
    console.error(`[ia] resposta inválida sem tempo para retry (${restante} ms restantes)`)
    throw new ErroIa('IA_RESPOSTA_INVALIDA', 'A IA devolveu uma resposta em formato inesperado')
  }

  const retry: MensagemLlm[] = [
    ...mensagens,
    { role: 'assistant', content: primeira },
    {
      role: 'user',
      content: `Sua resposta não é válida (${r1.erro}). Responda novamente apenas com o objeto JSON corrigido, no formato pedido, sem texto fora dele.`,
    },
  ]
  const r2 = validar(await conversar(llm, retry, { ...config, timeoutMs: restante }), esquema)
  if (r2.ok) return r2.valor
  console.error(`[ia] resposta inválida após retry: ${r2.erro.slice(0, 200)}`)
  throw new ErroIa('IA_RESPOSTA_INVALIDA', 'A IA devolveu uma resposta em formato inesperado')
}
