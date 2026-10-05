import { criarLlmMock } from './mock.js'
import type { LlmProvider } from './provider.js'

export function criarLlm(): LlmProvider {
  return criarLlmMock()
}
