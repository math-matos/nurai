import { criarLlmMock } from './mock.js'
import { configOciDoAmbiente, criarLlmOci } from './oci.js'
import type { LlmProvider } from './provider.js'

export function criarLlm(env: NodeJS.ProcessEnv = process.env): LlmProvider {
  const config = configOciDoAmbiente(env)
  if (!config) {
    console.log('[ia] provider: mock (variáveis OCI_* ausentes)')
    return criarLlmMock()
  }
  try {
    const llm = criarLlmOci(config)
    console.log(`[ia] provider: oci (modelo ${config.modelId}, região ${config.region})`)
    return llm
  } catch (e) {
    /* Chave inválida não pode derrubar a API inteira; /api/health e geradoPor expõem o mock. */
    console.error(`[ia] configuração OCI inválida (${(e as Error).name}); usando mock`)
    return criarLlmMock()
  }
}
