import { Region, SimpleAuthenticationDetailsProvider } from 'oci-common'
import { AIServiceDocumentClient, models } from 'oci-aidocument'
import { ErroIa } from './erros.js'
import { configOciDoAmbiente, type ConfigOci } from './oci.js'
import { MINIMO_CARACTERES, textoDoPdf } from './pdf.js'

/* Lê o texto de um documento digitalizado (sem camada de texto). Devolve null quando não consegue. */
export type LeitorOcr = (bytes: Uint8Array) => Promise<string | null>

/* OCI Document Understanding (serviço da Oracle). Usa as mesmas credenciais do GenAI. */
export function criarOcrOci(config: ConfigOci): LeitorOcr {
  const autenticacao = new SimpleAuthenticationDetailsProvider(
    config.tenancy, config.user, config.fingerprint, config.privateKey, config.passphrase,
    Region.fromRegionId(config.region),
  )
  const cliente = new AIServiceDocumentClient({ authenticationDetailsProvider: autenticacao })
  cliente.endpoint = `https://document.aiservice.${config.region}.oci.oraclecloud.com`

  return async (bytes) => {
    try {
      const resposta = await cliente.analyzeDocument({
        analyzeDocumentDetails: {
          features: [{ featureType: 'TEXT_EXTRACTION' } as models.DocumentFeature],
          document: { source: 'INLINE', data: Buffer.from(bytes).toString('base64') },
          compartmentId: config.compartmentId,
          language: 'pt',
        },
      })
      return resposta.analyzeDocumentResult.pages
        .flatMap((pagina) => pagina.lines ?? [])
        .map((linha) => linha.text)
        .join('\n')
    } catch (erro) {
      /* Só o nome do erro: a mensagem do SDK pode trazer detalhes da conta. */
      console.error(`[ocr] leitura falhou: ${erro instanceof Error ? erro.name : 'erro desconhecido'}`)
      return null
    }
  }
}

/* Sem as variáveis OCI_*, não há OCR: o comportamento volta ao de antes. */
export function ocrDoAmbiente(env: NodeJS.ProcessEnv = process.env): LeitorOcr | null {
  const config = configOciDoAmbiente(env)
  return config ? criarOcrOci(config) : null
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
