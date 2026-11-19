import { MaxAttemptsTerminationStrategy, Region, SimpleAuthenticationDetailsProvider } from 'oci-common'
import { AIServiceDocumentClient, models } from 'oci-aidocument'
import { ErroIa } from './erros.js'
import { comTimeout, configOciDoAmbiente, type ConfigOci } from './oci.js'
import { MINIMO_CARACTERES, textoDoPdf } from './pdf.js'

/* Lê o texto de um documento digitalizado (sem camada de texto). Devolve null quando não consegue. */
export type LeitorOcr = (bytes: Uint8Array) => Promise<string | null>

/* A extração com IA ainda roda depois do OCR, e a função da Vercel tem 60 s no total. */
const PRAZO_OCR_MS = 15_000

/* OCI Document Understanding (serviço da Oracle). Usa as mesmas credenciais do GenAI. */
export function criarOcrOci(config: ConfigOci, prazoMs = PRAZO_OCR_MS): LeitorOcr {
  const autenticacao = new SimpleAuthenticationDetailsProvider(
    config.tenancy, config.user, config.fingerprint, config.privateKey, config.passphrase,
    Region.fromRegionId(config.region),
  )
  const cliente = new AIServiceDocumentClient(
    { authenticationDetailsProvider: autenticacao },
    { retryConfiguration: { terminationStrategy: new MaxAttemptsTerminationStrategy(2) } },
  )
  cliente.endpoint = `https://document.aiservice.${config.region}.oci.oraclecloud.com`

  return async (bytes) => {
    try {
      const recurso = { featureType: models.DocumentTextExtractionFeature.featureType }
      const resposta = await comTimeout(cliente.analyzeDocument({
        analyzeDocumentDetails: {
          features: [recurso satisfies models.DocumentTextExtractionFeature],
          document: { source: 'INLINE', data: Buffer.from(bytes).toString('base64') },
          compartmentId: config.compartmentId,
        },
      }), prazoMs)
      return resposta.analyzeDocumentResult.pages
        .flatMap((pagina) => pagina.lines ?? [])
        .map((linha) => linha.text)
        .join('\n')
    } catch (e) {
      /* Status e código do serviço, como no GenAI: a mensagem do SDK pode trazer detalhes da conta. */
      const { statusCode, serviceCode, opcRequestId } = e as { statusCode?: number; serviceCode?: string; opcRequestId?: string }
      const codigo = serviceCode ?? ((e as Error).message?.startsWith('timeout') ? 'timeout' : (e as Error).name)
      console.error(`[ocr] leitura falhou: status=${statusCode ?? '-'} codigo=${codigo} request=${opcRequestId ?? '-'}`)
      return null
    }
  }
}

let ocrDoProcesso: LeitorOcr | null | undefined

/* Liga só com OCI_DOCUMENT_OCR=1 e as credenciais OCI_*: cada página lida custa crédito, e um PDF escaneado
   que hoje recebe a mensagem de "sem texto" passaria a ser lido. Sem isso, o comportamento é o de antes. */
export function ocrDoAmbiente(env: NodeJS.ProcessEnv = process.env): LeitorOcr | null {
  if (env === process.env && ocrDoProcesso !== undefined) return ocrDoProcesso
  const config = env.OCI_DOCUMENT_OCR === '1' ? configOciDoAmbiente(env) : null
  const leitor = config ? criarOcrOci(config) : null
  if (env === process.env) ocrDoProcesso = leitor
  return leitor
}

/* PDF com texto segue o caminho normal. Só quando não há texto nenhum, tenta o OCR, se houver. */
export async function textoDoDocumento(bytes: Uint8Array, ocr: LeitorOcr | null): Promise<string> {
  try {
    /* O leitor de PDF transfere o buffer para o worker e o deixa vazio: passa uma cópia para o OCR ainda ter o arquivo. */
    return await textoDoPdf(bytes.slice())
  } catch (erro) {
    if (!(erro instanceof ErroIa) || erro.codigo !== 'PDF_SEM_TEXTO' || !ocr) throw erro
    const texto = await ocr(bytes)
    if (texto && texto.replace(/\s+/g, '').length >= MINIMO_CARACTERES) return texto
    throw erro
  }
}
