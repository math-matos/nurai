/* Gera os documentos fictícios de e2e/fixtures/documentos/ a partir de modelos.ts.
   Uso: pnpm e2e:fixtures  (também é chamado pelo globalSetup quando falta algum arquivo). */
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser } from '@playwright/test'
import {
  TEXTO_SIMPLES,
  TEXTO_WHATSAPP,
  altaHospitalar,
  boleto,
  documentoEscaneado,
  ecg,
  glicemia,
  hemograma,
  laudoComImagens,
  pedidoPerfilLipidico,
  perfilLipidico,
  raioXTorax,
  receita,
  AVISO_FICTICIO,
} from './modelos.ts'

export const DIR_DOCUMENTOS = fileURLToPath(new URL('./documentos/', import.meta.url))

/* O aviso vai no rodapé de toda página impressa; na versão de tela (escaneado) ele está no HTML. */
const RODAPE_PDF = `<div style="width:100%;text-align:center;font-size:7px;color:#8a979d;font-family:Arial">
${AVISO_FICTICIO} · página <span class="pageNumber"></span>/<span class="totalPages"></span></div>`

const LIMITE_SERVIDOR = 4 * 1024 * 1024
const MINIMO_ARQUIVO_GRANDE = 4.2 * 1024 * 1024

async function htmlParaPdf(browser: Browser, html: string): Promise<Buffer> {
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'load' })
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: RODAPE_PDF,
    })
  } finally {
    await page.close()
  }
}

/* "Digitalização": a página inteira vira PNG e o PDF contém só a imagem, sem camada de texto. */
async function pdfEscaneado(browser: Browser, html: string): Promise<Buffer> {
  const ctx = await browser.newContext({
    viewport: { width: 794, height: 1123 },
    deviceScaleFactor: 1.5,
  })
  try {
    const page = await ctx.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    await page.addStyleTag({
      content: 'body{padding:40px 48px;transform:rotate(-0.6deg)}',
    })
    const png = await page.screenshot({ fullPage: true, type: 'png' })
    const imgHtml = `<!doctype html><html><head><style>@page{size:A4;margin:0}body{margin:0}
img{width:210mm;display:block;filter:grayscale(1) contrast(1.1)}</style></head>
<body><img src="data:image/png;base64,${png.toString('base64')}"></body></html>`
    await page.setContent(imgHtml, { waitUntil: 'load' })
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    })
  } finally {
    await ctx.close()
  }
}

/* Ruído determinístico (LCG) é incompressível: garante PDF > 4,2 MB sem depender de imagens externas. */
async function imagensRuido(browser: Browser, quantidade: number): Promise<string[]> {
  const page = await browser.newPage()
  try {
    // Sem funções nomeadas aqui dentro: o tsx injetaria __name, que não existe no browser.
    return await page.evaluate((n) => {
      let semente = 20260310
      const urls: string[] = []
      for (let i = 0; i < n; i++) {
        const canvas = document.createElement('canvas')
        canvas.width = 1200
        canvas.height = 900
        const ctx = canvas.getContext('2d')!
        const dados = ctx.createImageData(canvas.width, canvas.height)
        for (let p = 0; p < dados.data.length; p += 4) {
          semente = (Math.imul(semente, 1664525) + 1013904223) >>> 0
          const r = semente
          dados.data[p] = r & 0xff
          dados.data[p + 1] = (r >>> 8) & 0xff
          dados.data[p + 2] = (r >>> 16) & 0xff
          dados.data[p + 3] = 255
        }
        ctx.putImageData(dados, 0, 0)
        urls.push(canvas.toDataURL('image/png'))
      }
      return urls
    }, quantidade)
  } finally {
    await page.close()
  }
}

/* Bytes pseudoaleatórios determinísticos que não começam com %PDF-. */
function bytesCorrompidos(tamanho: number): Buffer {
  let semente = 14
  const buf = Buffer.alloc(tamanho)
  for (let i = 0; i < tamanho; i++) {
    semente = (Math.imul(semente, 1103515245) + 12345) >>> 0
    buf[i] = semente >>> 24
  }
  buf.write('\x89ZIP', 0, 'latin1')
  return buf
}

export async function gerarDocumentos(): Promise<{ arquivo: string; bytes: number }[]> {
  await mkdir(DIR_DOCUMENTOS, { recursive: true })
  const browser = await chromium.launch()
  const saida: Record<string, Buffer | string> = {}
  try {
    saida['01-hemograma-2026-03-10.pdf'] = await htmlParaPdf(
      browser,
      hemograma('10/03/2026', '11/03/2026', 'Q-26-031033', {
        hemacias: '4,85',
        hemoglobina: '14,6',
        hematocrito: '43,8',
        vcm: '90,3',
        hcm: '30,1',
        chcm: '33,3',
        rdw: '13,1',
        leucocitos: '7,2',
        eosinofilos: '7,8',
        plaquetas: '245',
      }),
    )
    saida['02-perfil-lipidico-2026-03-12.pdf'] = await htmlParaPdf(browser, perfilLipidico())
    saida['03-glicemia-hba1c-2026-03-19.pdf'] = await htmlParaPdf(browser, glicemia())
    saida['04-raio-x-torax-2026-04-20.pdf'] = await htmlParaPdf(browser, raioXTorax())
    saida['05-receita-2026-04-22.pdf'] = await htmlParaPdf(browser, receita())
    saida['06-alta-hospitalar-2026-05-06.pdf'] = await htmlParaPdf(browser, altaHospitalar())
    saida['07-ecg-2026-05-20.pdf'] = await htmlParaPdf(browser, ecg())
    saida['08-hemograma-2026-06-12.pdf'] = await htmlParaPdf(
      browser,
      hemograma('12/06/2026', '13/06/2026', 'Q-26-061218', {
        hemacias: '4,21',
        hemoglobina: '12,4',
        hematocrito: '37,9',
        vcm: '90,0',
        hcm: '29,5',
        chcm: '32,7',
        rdw: '14,9',
        leucocitos: '6,8',
        eosinofilos: '5,1',
        plaquetas: '228',
      }),
    )
    saida['09-pedido-perfil-lipidico-2026-04-02.pdf'] = await htmlParaPdf(browser, pedidoPerfilLipidico())
    saida['10-whatsapp-potassio-creatinina.txt'] = TEXTO_WHATSAPP
    saida['11-escaneado-sem-texto.pdf'] = await pdfEscaneado(browser, documentoEscaneado())
    saida['12-boleto-nao-clinico.pdf'] = await htmlParaPdf(browser, boleto())
    saida['13-arquivo-grande.pdf'] = await htmlParaPdf(browser, laudoComImagens(await imagensRuido(browser, 2)))
    saida['14-corrompido.pdf'] = bytesCorrompidos(48 * 1024)
    saida['15-texto-simples.txt'] = TEXTO_SIMPLES
  } finally {
    await browser.close()
  }

  const grande = saida['13-arquivo-grande.pdf']
  if (grande.length <= MINIMO_ARQUIVO_GRANDE) {
    throw new Error(
      `13-arquivo-grande.pdf ficou com ${grande.length} bytes; precisa passar de ${MINIMO_ARQUIVO_GRANDE}`,
    )
  }
  if (grande.length <= LIMITE_SERVIDOR) throw new Error('13-arquivo-grande.pdf não excede o limite do servidor')

  const resultado: { arquivo: string; bytes: number }[] = []
  for (const [arquivo, conteudo] of Object.entries(saida)) {
    const caminho = join(DIR_DOCUMENTOS, arquivo)
    await writeFile(caminho, conteudo)
    resultado.push({ arquivo, bytes: (await stat(caminho)).size })
  }
  return resultado
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arquivos = await gerarDocumentos()
  for (const { arquivo, bytes } of arquivos) {
    console.log(`${arquivo.padEnd(44)} ${(bytes / 1024).toFixed(1).padStart(9)} KB`)
  }
  console.log(`\n${arquivos.length} arquivos em ${DIR_DOCUMENTOS}`)
}
