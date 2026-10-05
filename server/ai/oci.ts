import {
  MaxAttemptsTerminationStrategy, Region, SimpleAuthenticationDetailsProvider,
} from 'oci-common'
import { GenerativeAiInferenceClient, type models } from 'oci-generativeaiinference'
import { ErroIa } from './erros.js'
import type { LlmProvider, MensagemLlm } from './provider.js'

export interface ConfigOci {
  tenancy: string
  user: string
  fingerprint: string
  privateKey: string
  passphrase: string | null
  region: string
  compartmentId: string
  modelId: string
  endpoint: string
  timeoutMs?: number
}

const PAPEL: Record<MensagemLlm['role'], string> = {
  system: 'SYSTEM',
  user: 'USER',
  assistant: 'ASSISTANT',
}

/* Aceita a chave com "\n" escapados (Vercel/.env de uma linha) ou multilinha. */
export function normalizarChave(chave: string): string {
  return chave
    .trim()
    .replace(/^["']|["']$/g, '')
    .replaceAll('\\n', '\n')
    .replaceAll('\r\n', '\n')
    .trim()
}

export function configOciDoAmbiente(env: NodeJS.ProcessEnv = process.env): ConfigOci | null {
  const {
    OCI_TENANCY_OCID, OCI_USER_OCID, OCI_FINGERPRINT, OCI_PRIVATE_KEY, OCI_COMPARTMENT_OCID,
  } = env
  if (!OCI_TENANCY_OCID || !OCI_USER_OCID || !OCI_FINGERPRINT || !OCI_PRIVATE_KEY || !OCI_COMPARTMENT_OCID) {
    return null
  }
  const region = env.OCI_REGION || 'sa-saopaulo-1'
  return {
    tenancy: OCI_TENANCY_OCID,
    user: OCI_USER_OCID,
    fingerprint: OCI_FINGERPRINT,
    privateKey: normalizarChave(OCI_PRIVATE_KEY),
    passphrase: env.OCI_PRIVATE_KEY_PASSPHRASE || null,
    region,
    compartmentId: OCI_COMPARTMENT_OCID,
    modelId: env.OCI_GENAI_MODEL_ID || 'meta.llama-3.3-70b-instruct',
    endpoint: env.OCI_GENAI_ENDPOINT || `https://inference.generativeai.${region}.oci.oraclecloud.com`,
  }
}

function extrairTexto(resposta: Awaited<ReturnType<GenerativeAiInferenceClient['chat']>>): string {
  if (!resposta || !('chatResult' in resposta)) return ''
  const chat = resposta.chatResult.chatResponse
  if (chat.apiFormat !== 'GENERIC') return ''
  const [conteudo] = (chat as models.GenericChatResponse).choices[0]?.message.content ?? []
  return conteudo?.type === 'TEXT' ? ((conteudo as models.TextContent).text ?? '') : ''
}

function comTimeout<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const limite = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error(`timeout de ${ms} ms`)), ms)
  })
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer))
}

export function criarLlmOci(config: ConfigOci): LlmProvider {
  const autenticacao = new SimpleAuthenticationDetailsProvider(
    config.tenancy, config.user, config.fingerprint, config.privateKey, config.passphrase,
    Region.fromRegionId(config.region),
  )
  const cliente = new GenerativeAiInferenceClient(
    { authenticationDetailsProvider: autenticacao },
    { retryConfiguration: { terminationStrategy: new MaxAttemptsTerminationStrategy(2) } },
  )
  cliente.endpoint = config.endpoint

  return {
    nome: 'oci',
    async chat(mensagens, opcoes) {
      const chatRequest: models.GenericChatRequest = {
        apiFormat: 'GENERIC',
        messages: mensagens.map((m) => ({
          role: PAPEL[m.role],
          content: [{ type: 'TEXT', text: m.content } satisfies models.TextContent],
        })),
        maxTokens: opcoes?.maxTokens ?? 1500,
        temperature: opcoes?.temperatura ?? 0.2,
      }
      let resposta
      try {
        resposta = await comTimeout(cliente.chat({
          chatDetails: {
            compartmentId: config.compartmentId,
            servingMode: { servingType: 'ON_DEMAND', modelId: config.modelId } satisfies models.OnDemandServingMode,
            chatRequest,
          },
        }), config.timeoutMs ?? 45_000)
      } catch (e) {
        const { statusCode, serviceCode, opcRequestId } = e as { statusCode?: number; serviceCode?: string; opcRequestId?: string }
        const codigo = serviceCode ?? ((e as Error).message?.startsWith('timeout') ? 'timeout' : (e as Error).name)
        console.error(`[ia] OCI chat falhou: status=${statusCode ?? '-'} codigo=${codigo} request=${opcRequestId ?? '-'}`)
        throw new ErroIa('IA_INDISPONIVEL', 'Serviço de IA indisponível no momento')
      }
      const texto = extrairTexto(resposta)
      if (!texto.trim()) throw new ErroIa('IA_RESPOSTA_INVALIDA', 'A IA devolveu uma resposta vazia')
      return texto
    },
  }
}
