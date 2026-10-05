import { configOciDoAmbiente, criarLlmOci } from '../ai/oci.js'
import { criarApp } from '../app.js'
import { criarRepoMemoria } from '../db/memoria.js'

try {
  process.loadEnvFile('.env.local')
} catch {
  /* sem .env.local: depende das variáveis já exportadas */
}

const OBRIGATORIAS = ['OCI_TENANCY_OCID', 'OCI_USER_OCID', 'OCI_FINGERPRINT', 'OCI_PRIVATE_KEY', 'OCI_COMPARTMENT_OCID']
const faltando = OBRIGATORIAS.filter((nome) => !process.env[nome])
const config = configOciDoAmbiente()
if (faltando.length || !config) {
  console.error(`[smoke:genai] faltam variáveis: ${faltando.join(', ')}.`)
  console.error('[smoke:genai] Preencha .env.local (modelo em .env.example) ou exporte-as no shell.')
  process.exit(1)
}

async function medir<T>(rotulo: string, fn: () => T | Promise<T>): Promise<T> {
  const inicio = performance.now()
  const resultado = await fn()
  console.log(`[smoke:genai] ${rotulo}: ${Math.round(performance.now() - inicio)} ms`)
  return resultado
}

try {
  console.log(`[smoke:genai] provider: oci · modelo ${config.modelId} · região ${config.region} · ${config.endpoint}`)
  const llm = criarLlmOci(config)

  const eco = await medir('chat direto', () =>
    llm.chat([{ role: 'user', content: 'Responda apenas com a palavra: ok' }], { maxTokens: 10, temperatura: 0 }))
  console.log(`  resposta: ${eco.trim().slice(0, 80)}`)

  const app = criarApp({ repo: criarRepoMemoria(), llm })
  const res = await medir('POST /api/copiloto', () => app.request('/api/copiloto', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pergunta: 'Como minha glicada evoluiu?' }),
  }))
  const corpo = await res.json() as { texto?: string[]; ancoras?: string[]; geradoPor?: string; codigo?: string }
  if (res.status !== 200 || corpo.geradoPor !== 'oci') {
    throw new Error(`copiloto respondeu ${res.status} ${corpo.codigo ?? ''}`.trim())
  }
  console.log(`  texto: ${corpo.texto?.[0]?.slice(0, 160)}…`)
  console.log(`  âncoras: ${corpo.ancoras?.join(', ') || '(nenhuma)'}`)
  console.log('[smoke:genai] OK')
} catch (e) {
  console.error(`[smoke:genai] FALHOU — ${(e as Error).name}: ${(e as Error).message}`)
  process.exit(1)
}
