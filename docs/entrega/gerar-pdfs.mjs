/* Gera os PDFs da entrega da Fase 7:
     - documento-consolidado.pdf, a partir da página /#/projeto
     - pitch-nurai.pdf, a partir de docs/entrega/pitch/index.html

   Uso:  node docs/entrega/gerar-pdfs.mjs [URL do app]
   Padrão: https://nurai-one.vercel.app. Para a versão local, suba `pnpm dev` e passe
   http://localhost:5173. */
import { chromium } from '@playwright/test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const aqui = dirname(fileURLToPath(import.meta.url))
const base = (process.argv[2] ?? 'https://nurai-one.vercel.app').replace(/\/$/, '')

const navegador = await chromium.launch()
try {
  const pitch = await navegador.newPage()
  await pitch.goto(pathToFileURL(join(aqui, 'pitch', 'index.html')).href, { waitUntil: 'networkidle' })
  await pitch.evaluate(() => document.fonts.ready)
  await pitch.pdf({ path: join(aqui, 'pitch-nurai.pdf'), width: '1280px', height: '720px', printBackground: true, preferCSSPageSize: true })
  console.log('pitch-nurai.pdf')

  const doc = await navegador.newPage({ viewport: { width: 1200, height: 900 } })
  await doc.goto(`${base}/#/projeto`, { waitUntil: 'networkidle' })
  await doc.waitForSelector('#parte-5')
  await doc.evaluate(() => document.fonts.ready)
  await doc.pdf({
    path: join(aqui, 'documento-consolidado.pdf'), format: 'A4', printBackground: true,
    margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
  })
  console.log('documento-consolidado.pdf', `(${base})`)
} finally {
  await navegador.close()
}
