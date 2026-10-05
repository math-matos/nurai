import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { models, requests } from 'oci-generativeaiinference'
import { ErroIa } from './erros.js'
import { configOciDoAmbiente, criarLlmOci, normalizarChave, type ConfigOci } from './oci.js'

const sdk = vi.hoisted(() => ({
  chat: vi.fn(),
  endpoints: [] as string[],
}))

vi.mock('oci-generativeaiinference', () => ({
  GenerativeAiInferenceClient: class {
    set endpoint(url: string) { sdk.endpoints.push(url) }
    chat = sdk.chat
  },
}))

const CHAVE = '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----'

const CONFIG: ConfigOci = {
  tenancy: 'ocid1.tenancy.oc1..t', user: 'ocid1.user.oc1..u', fingerprint: 'aa:bb',
  privateKey: CHAVE, passphrase: null, region: 'sa-saopaulo-1',
  compartmentId: 'ocid1.compartment.oc1..c', modelId: 'meta.llama-3.3-70b-instruct',
  endpoint: 'https://inference.generativeai.sa-saopaulo-1.oci.oraclecloud.com',
}

function respostaGenerica(texto: string) {
  return {
    chatResult: {
      modelId: CONFIG.modelId, modelVersion: '1',
      chatResponse: {
        apiFormat: 'GENERIC', timeCreated: new Date(),
        choices: [{ index: 0, finishReason: 'stop', message: { role: 'ASSISTANT', content: [{ type: 'TEXT', text: texto }] } }],
      },
    },
  }
}

describe('normalizarChave', () => {
  it('converte \\n literal em quebra de linha', () => {
    expect(normalizarChave('-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----')).toBe(CHAVE)
  })

  it('mantém chave multilinha e remove aspas e espaços ao redor', () => {
    expect(normalizarChave(`  "${CHAVE}"\n`)).toBe(CHAVE)
    expect(normalizarChave(CHAVE.replaceAll('\n', '\r\n'))).toBe(CHAVE)
  })
})

describe('configOciDoAmbiente', () => {
  const ENV = {
    OCI_TENANCY_OCID: 't', OCI_USER_OCID: 'u', OCI_FINGERPRINT: 'f',
    OCI_PRIVATE_KEY: 'k', OCI_COMPARTMENT_OCID: 'c',
  }

  it('devolve null se faltar qualquer variável obrigatória', () => {
    expect(configOciDoAmbiente({})).toBeNull()
    expect(configOciDoAmbiente({ ...ENV, OCI_FINGERPRINT: '' })).toBeNull()
  })

  it('aplica defaults de região, modelo e endpoint', () => {
    expect(configOciDoAmbiente(ENV)).toMatchObject({
      region: 'sa-saopaulo-1', modelId: 'meta.llama-3.3-70b-instruct', passphrase: null,
      endpoint: 'https://inference.generativeai.sa-saopaulo-1.oci.oraclecloud.com',
    })
  })

  it('respeita região, modelo e endpoint explícitos', () => {
    expect(configOciDoAmbiente({
      ...ENV, OCI_REGION: 'us-chicago-1', OCI_GENAI_MODEL_ID: 'm', OCI_GENAI_ENDPOINT: 'https://x',
      OCI_PRIVATE_KEY_PASSPHRASE: 'p',
    })).toMatchObject({ region: 'us-chicago-1', modelId: 'm', endpoint: 'https://x', passphrase: 'p' })
  })
})

describe('criarLlmOci', () => {
  beforeEach(() => {
    sdk.chat.mockReset()
    sdk.endpoints.length = 0
  })

  it('envia chat GENERIC on-demand e extrai o texto', async () => {
    sdk.chat.mockResolvedValue(respostaGenerica('olá'))
    const llm = criarLlmOci(CONFIG)
    expect(llm.nome).toBe('oci')
    const texto = await llm.chat(
      [{ role: 'system', content: 'sys' }, { role: 'user', content: 'oi' }, { role: 'assistant', content: 'a' }],
      { maxTokens: 100, temperatura: 0.1 },
    )
    expect(texto).toBe('olá')
    expect(sdk.endpoints).toEqual([CONFIG.endpoint])
    const pedido = sdk.chat.mock.calls[0][0] as requests.ChatRequest
    expect(pedido.chatDetails.compartmentId).toBe(CONFIG.compartmentId)
    expect(pedido.chatDetails.servingMode).toEqual({ servingType: 'ON_DEMAND', modelId: CONFIG.modelId })
    const chatRequest = pedido.chatDetails.chatRequest as models.GenericChatRequest
    expect(chatRequest).toMatchObject({ apiFormat: 'GENERIC', maxTokens: 100, temperature: 0.1 })
    expect(chatRequest.messages).toEqual([
      { role: 'SYSTEM', content: [{ type: 'TEXT', text: 'sys' }] },
      { role: 'USER', content: [{ type: 'TEXT', text: 'oi' }] },
      { role: 'ASSISTANT', content: [{ type: 'TEXT', text: 'a' }] },
    ])
  })

  it('erro do SDK vira ErroIa IA_INDISPONIVEL sem vazar detalhes', async () => {
    sdk.chat.mockRejectedValue(Object.assign(new Error(`assinatura falhou ${CHAVE}`), { statusCode: 401 }))
    const erro = await criarLlmOci(CONFIG).chat([{ role: 'user', content: 'oi' }]).catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ErroIa)
    expect((erro as ErroIa).codigo).toBe('IA_INDISPONIVEL')
    expect((erro as ErroIa).message).not.toContain('PRIVATE KEY')
  })

  it('resposta sem texto vira IA_RESPOSTA_INVALIDA', async () => {
    sdk.chat.mockResolvedValue(respostaGenerica(''))
    const erro = await criarLlmOci(CONFIG).chat([{ role: 'user', content: 'oi' }]).catch((e: unknown) => e)
    expect((erro as ErroIa).codigo).toBe('IA_RESPOSTA_INVALIDA')
  })

  it('estoura timeout com IA_INDISPONIVEL', async () => {
    sdk.chat.mockReturnValue(new Promise(() => {}))
    const erro = await criarLlmOci({ ...CONFIG, timeoutMs: 20 })
      .chat([{ role: 'user', content: 'oi' }]).catch((e: unknown) => e)
    expect((erro as ErroIa).codigo).toBe('IA_INDISPONIVEL')
  })
})
