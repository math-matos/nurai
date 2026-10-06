import { expect, type Page } from '@playwright/test'

export interface Vigia {
  erros: string[]
  afirmarLimpo(): void
}

/* O Chromium loga "Failed to load resource" para qualquer 4xx; erros esperados (422, 413, 401)
   não são falha. 5xx é pego pelo listener de resposta, com URL e método. */
const RECURSO_4XX = /Failed to load resource: the server responded with a status of 4\d\d/

export function vigiarConsole(page: Page, ignorar: RegExp[] = []): Vigia {
  const erros: string[] = []
  const registrar = (msg: string) => {
    if (!ignorar.some((r) => r.test(msg))) erros.push(msg)
  }

  page.on('console', (msg) => {
    if (msg.type() === 'error' && !RECURSO_4XX.test(msg.text())) registrar(`console.error: ${msg.text()}`)
  })
  page.on('pageerror', (erro) => registrar(`pageerror: ${erro.message}`))
  page.on('response', (res) => {
    if (res.status() >= 500) registrar(`HTTP ${res.status()} ${res.request().method()} ${res.url()}`)
  })

  return {
    erros,
    afirmarLimpo() {
      expect(erros, 'erros de console, exceções ou respostas 5xx durante o teste').toEqual([])
    },
  }
}
