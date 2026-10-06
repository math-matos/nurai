import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { ErroIa } from './erros.js'
import { MINIMO_RETRY_MS, ORCAMENTO_IA_MS, extrairJson, pedirJson } from './json.js'
import { SISTEMA } from './prompts.js'
import type { LlmProvider, MensagemLlm, OpcoesChat } from './provider.js'

function llmFila(...respostas: string[]) {
  const chamadas: { mensagens: MensagemLlm[]; opcoes?: OpcoesChat }[] = []
  const llm: LlmProvider = {
    nome: 'oci',
    async chat(mensagens, opcoes) {
      chamadas.push({ mensagens, opcoes })
      const proxima = respostas.shift()
      if (proxima === undefined) throw new Error('fila vazia')
      return proxima
    },
  }
  return { llm, chamadas }
}

const esquema = z.object({ texto: z.array(z.string()), n: z.number() })
const PEDIDO: MensagemLlm[] = [{ role: 'user', content: 'responda' }]

describe('extrairJson', () => {
  it('lê JSON puro', () => {
    expect(extrairJson('{"a":1}')).toEqual({ a: 1 })
  })

  /* Resposta real do Llama 3.3 para um laudo de HbA1c: o português do documento vaza para o número. */
  it('aceita vírgula decimal num valor numérico, sem mexer em vírgulas dentro de textos', () => {
    const resposta = '{"resumo": "HbA1c de 5,8%, glicemia 99", "medidas": [{"nome": "HbA1c", "valor": 5,8, "unidade": "%", "refMin": 4,0, "refMax": 5,6}], "confianca": 0.9}'
    expect(extrairJson(resposta)).toEqual({
      resumo: 'HbA1c de 5,8%, glicemia 99',
      medidas: [{ nome: 'HbA1c', valor: 5.8, unidade: '%', refMin: 4, refMax: 5.6 }],
      confianca: 0.9,
    })
  })

  it('o prompt de sistema separa a vírgula decimal do texto do ponto decimal dos campos numéricos', () => {
    expect(SISTEMA).toMatch(/campos numéricos do JSON[^\n]*ponto decimal/)
  })

  it('JSON quebrado por outro motivo continua sendo erro', () => {
    expect(() => extrairJson('{"a": 1,, "b": 2}')).toThrow(SyntaxError)
  })

  it('tolera fences ```json e texto ao redor', () => {
    expect(extrairJson('Claro! Segue:\n```json\n{"a": {"b": "x}"}}\n```\nAbraço')).toEqual({ a: { b: 'x}' } })
  })

  it('pega o primeiro objeto quando há mais de um', () => {
    expect(extrairJson('{"a":1} e depois {"b":2}')).toEqual({ a: 1 })
  })

  it('lança quando não há objeto', () => {
    expect(() => extrairJson('sem json aqui')).toThrow()
  })
})

describe('pedirJson', () => {
  it('pede JSON ao provider e devolve o objeto validado', async () => {
    const { llm, chamadas } = llmFila('```json\n{"texto":["oi"],"n":2}\n```')
    expect(await pedirJson(llm, PEDIDO, esquema)).toEqual({ texto: ['oi'], n: 2 })
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].opcoes?.json).toBe(true)
  })

  it('faz 1 retry incluindo o erro de validação', async () => {
    const { llm, chamadas } = llmFila('{"texto":"oi"}', '{"texto":["oi"],"n":1}')
    expect(await pedirJson(llm, PEDIDO, esquema)).toEqual({ texto: ['oi'], n: 1 })
    expect(chamadas).toHaveLength(2)
    const retry = chamadas[1].mensagens
    expect(retry.slice(0, PEDIDO.length)).toEqual(PEDIDO)
    expect(retry.at(-2)).toEqual({ role: 'assistant', content: '{"texto":"oi"}' })
    expect(retry.at(-1)?.role).toBe('user')
    expect(retry.at(-1)?.content).toMatch(/texto/)
  })

  it('faz retry quando a resposta não tem JSON', async () => {
    const { llm } = llmFila('desculpe, não sei', '{"texto":[],"n":0}')
    expect(await pedirJson(llm, PEDIDO, esquema)).toEqual({ texto: [], n: 0 })
  })

  it('falha com IA_RESPOSTA_INVALIDA após 2 respostas inválidas', async () => {
    const { llm } = llmFila('nada', '{"n":"x"}')
    const erro = await pedirJson(llm, PEDIDO, esquema).catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ErroIa)
    expect((erro as ErroIa).codigo).toBe('IA_RESPOSTA_INVALIDA')
    expect((erro as ErroIa).status).toBe(502)
  })

  it('o log de resposta inválida não carrega conteúdo da resposta, só tipo e tamanho', async () => {
    const clinico = '{"texto": HbA1c 9,1% em 2026}'
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { llm } = llmFila(clinico, clinico)
    await pedirJson(llm, PEDIDO, esquema).catch(() => {})
    const registrado = log.mock.calls.flat().join(' ')
    log.mockRestore()
    expect(registrado).toMatch(/SyntaxError/)
    expect(registrado).toContain(String(clinico.length))
    expect(registrado).not.toMatch(/HbA1c|9,1/)
  })

  it('erro do provider vira IA_INDISPONIVEL', async () => {
    const llm: LlmProvider = { nome: 'oci', chat: async () => { throw new Error('ECONNRESET') } }
    const erro = await pedirJson(llm, PEDIDO, esquema).catch((e: unknown) => e)
    expect((erro as ErroIa).codigo).toBe('IA_INDISPONIVEL')
    expect((erro as ErroIa).status).toBe(503)
  })
})

/* Vercel corta a função em 60 s: tentativa + retry precisam caber num prazo único. */
describe('pedirJson — orçamento de tempo', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function llmLento(...passos: { demoraMs: number; resposta: string }[]) {
    const chamadas: OpcoesChat[] = []
    const llm: LlmProvider = {
      nome: 'oci',
      async chat(_, opcoes) {
        chamadas.push(opcoes ?? {})
        const passo = passos.shift()
        if (!passo) throw new Error('fila vazia')
        vi.advanceTimersByTime(passo.demoraMs)
        return passo.resposta
      },
    }
    return { llm, chamadas }
  }

  it('cabe abaixo do maxDuration de 60 s com folga mínima para o retry', () => {
    expect(ORCAMENTO_IA_MS).toBeLessThanOrEqual(50_000)
    expect(MINIMO_RETRY_MS).toBeGreaterThanOrEqual(15_000)
  })

  it('a primeira tentativa recebe o orçamento inteiro como timeout', async () => {
    vi.useFakeTimers()
    const { llm, chamadas } = llmLento({ demoraMs: 1_000, resposta: '{"texto":[],"n":0}' })
    await pedirJson(llm, PEDIDO, esquema)
    expect(chamadas[0].timeoutMs).toBe(ORCAMENTO_IA_MS)
  })

  it('o retry usa só o tempo que sobrou do orçamento', async () => {
    vi.useFakeTimers()
    const { llm, chamadas } = llmLento(
      { demoraMs: 20_000, resposta: 'nada' },
      { demoraMs: 1_000, resposta: '{"texto":[],"n":0}' },
    )
    expect(await pedirJson(llm, PEDIDO, esquema)).toEqual({ texto: [], n: 0 })
    expect(chamadas[1].timeoutMs).toBe(ORCAMENTO_IA_MS - 20_000)
  })

  it('não faz retry quando sobra menos que o mínimo e falha com IA_RESPOSTA_INVALIDA', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { llm, chamadas } = llmLento(
      { demoraMs: ORCAMENTO_IA_MS - MINIMO_RETRY_MS + 1, resposta: 'nada' },
      { demoraMs: 1_000, resposta: '{"texto":[],"n":0}' },
    )
    const erro = await pedirJson(llm, PEDIDO, esquema).catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ErroIa)
    expect((erro as ErroIa).codigo).toBe('IA_RESPOSTA_INVALIDA')
    expect(chamadas).toHaveLength(1)
  })
})
