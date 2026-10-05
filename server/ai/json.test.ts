import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ErroIa } from './erros.js'
import { extrairJson, pedirJson } from './json.js'
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

  it('erro do provider vira IA_INDISPONIVEL', async () => {
    const llm: LlmProvider = { nome: 'oci', chat: async () => { throw new Error('ECONNRESET') } }
    const erro = await pedirJson(llm, PEDIDO, esquema).catch((e: unknown) => e)
    expect((erro as ErroIa).codigo).toBe('IA_INDISPONIVEL')
    expect((erro as ErroIa).status).toBe(503)
  })
})
