import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ErroIa } from './erros.js'
import { ocrDoAmbiente, textoDoDocumento, type LeitorOcr } from './ocr.js'

const FIXTURES = resolve(process.cwd(), 'e2e/fixtures/documentos')
const escaneado = new Uint8Array(readFileSync(resolve(FIXTURES, '11-escaneado-sem-texto.pdf')))
const comTexto = new Uint8Array(readFileSync(resolve(FIXTURES, '01-hemograma-2026-03-10.pdf')))
const TEXTO_LIDO = 'Hemoglobina 13,2 g/dL. Hematócrito 39 %. Leucócitos 6.500 /mm³.'

describe('textoDoDocumento', () => {
  it('PDF com texto nunca chama o OCR', async () => {
    const ocr = vi.fn<LeitorOcr>()
    const texto = await textoDoDocumento(comTexto, ocr)
    expect(texto.length).toBeGreaterThan(20)
    expect(ocr).not.toHaveBeenCalled()
  })

  it('sem OCR configurado, o digitalizado segue com a mensagem de PDF sem texto', async () => {
    await expect(textoDoDocumento(escaneado, null)).rejects.toMatchObject({ codigo: 'PDF_SEM_TEXTO' })
  })

  it('digitalizado com OCR que lê texto suficiente usa o texto lido', async () => {
    const ocr = vi.fn<LeitorOcr>().mockResolvedValue(TEXTO_LIDO)
    await expect(textoDoDocumento(escaneado, ocr)).resolves.toBe(TEXTO_LIDO)
    expect(ocr).toHaveBeenCalledOnce()
  })

  it('se o OCR falhar (null), volta à mensagem de PDF sem texto', async () => {
    const ocr = vi.fn<LeitorOcr>().mockResolvedValue(null)
    await expect(textoDoDocumento(escaneado, ocr)).rejects.toBeInstanceOf(ErroIa)
    await expect(textoDoDocumento(escaneado, ocr)).rejects.toMatchObject({ codigo: 'PDF_SEM_TEXTO' })
  })

  it('texto lido pelo OCR curto demais também cai na mensagem de PDF sem texto', async () => {
    const ocr = vi.fn<LeitorOcr>().mockResolvedValue('ruído')
    await expect(textoDoDocumento(escaneado, ocr)).rejects.toMatchObject({ codigo: 'PDF_SEM_TEXTO' })
  })

  it('arquivo que não é PDF não passa pelo OCR', async () => {
    const ocr = vi.fn<LeitorOcr>()
    const texto = new TextEncoder().encode('isto não é um pdf')
    await expect(textoDoDocumento(texto, ocr)).rejects.toMatchObject({ codigo: 'PDF_INVALIDO' })
    expect(ocr).not.toHaveBeenCalled()
  })
})

describe('ocrDoAmbiente', () => {
  it('sem variáveis OCI_*, não há OCR (a aplicação segue sem ele)', () => {
    expect(ocrDoAmbiente({})).toBeNull()
  })
})
