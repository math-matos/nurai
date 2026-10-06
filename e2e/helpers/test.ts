import { test as base, type BrowserContext, type Page } from '@playwright/test'
import { vigiarConsole } from './console.ts'
import { SENHA_TESTE, emailTeste, excluirConta } from './conta.ts'

export interface ContaTeste {
  email: string
  senha: string
  /* Contexto compartilhado pelos testes do worker: o cookie de sessão sobrevive entre testes. */
  contexto: BrowserContext
}

interface FixturesTeste {
  /* Padrões de erro tolerados pelo vigia (ex.: test.use({ ignorarErros: [/HTTP 503/] })). */
  ignorarErros: RegExp[]
  /* Página dentro do contexto da `conta`, vigiada como `page`. */
  paginaConta: Page
}

interface FixturesWorker {
  conta: ContaTeste
}

export const test = base.extend<FixturesTeste, FixturesWorker>({
  ignorarErros: [[], { option: true }],

  page: async ({ page, ignorarErros }, usar) => {
    const vigia = vigiarConsole(page, ignorarErros)
    await usar(page)
    vigia.afirmarLimpo()
  },

  /* Uma conta por worker, apagada no fim (equivale a afterAll) via DELETE /api/conta. */
  conta: [
    async ({ browser }, usar, workerInfo) => {
      const { baseURL, viewport, isMobile, hasTouch, deviceScaleFactor, userAgent, locale, timezoneId } =
        workerInfo.project.use
      const contexto = await browser.newContext({
        baseURL,
        viewport,
        isMobile,
        hasTouch,
        deviceScaleFactor,
        userAgent,
        locale,
        timezoneId,
      })
      await usar({ email: emailTeste(), senha: SENHA_TESTE, contexto })

      const status = await excluirConta(contexto.request)
      await contexto.close()
      if (status >= 500) throw new Error(`DELETE /api/conta respondeu ${status}`)
      if (status >= 400) console.warn(`[e2e] conta não apagada (HTTP ${status}): nunca logou ou rota ausente`)
    },
    { scope: 'worker' },
  ],

  paginaConta: async ({ conta, ignorarErros }, usar) => {
    const page = await conta.contexto.newPage()
    const vigia = vigiarConsole(page, ignorarErros)
    await usar(page)
    await page.close()
    vigia.afirmarLimpo()
  },
})

export { expect } from '@playwright/test'
