import { describe, expect, it } from 'vitest'
import { criarLlm } from './index.js'
import { criarLlmMock } from './mock.js'

describe('LLM mock', () => {
  it('é determinístico e se identifica como mock', async () => {
    const llm = criarLlmMock()
    const msgs = [{ role: 'user' as const, content: 'Como está meu colesterol?' }]
    expect(llm.nome).toBe('mock')
    expect(await llm.chat(msgs)).toBe(await llm.chat(msgs))
  })

  it('devolve JSON válido quando pedido', async () => {
    const r = await criarLlmMock().chat([{ role: 'user', content: 'oi' }], { json: true })
    expect(() => JSON.parse(r)).not.toThrow()
  })

  it('criarLlm usa o mock por enquanto', () => {
    expect(criarLlm().nome).toBe('mock')
  })
})
