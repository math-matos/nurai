import { extractText } from 'unpdf'
import { ErroIa } from './erros.js'

export const LIMITE_PDF = 4 * 1024 * 1024
const MINIMO_CARACTERES = 20

export async function textoDoPdf(bytes: Uint8Array): Promise<string> {
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') {
    throw new ErroIa('PDF_INVALIDO', 'O arquivo enviado não é um PDF válido')
  }
  let texto: string
  try {
    ({ text: texto } = await extractText(bytes, { mergePages: true }))
  } catch {
    throw new ErroIa('PDF_INVALIDO', 'Não consegui ler este PDF')
  }
  if (texto.replace(/\s+/g, '').length < MINIMO_CARACTERES) {
    throw new ErroIa(
      'PDF_SEM_TEXTO',
      'Não encontrei texto neste PDF. Se for uma foto ou digitalização, cole o texto do documento.',
    )
  }
  return texto
}
