import { test as base, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test'
import { vigiarConsole } from './console.ts'
import { excluirConta } from './conta.ts'
import {
  CSRF, cabecalhosDeIp, cadastrarPorApi, ipAleatorio, opcoesDoProjeto, rotearIp, type Credenciais, type Modo,
} from './sessao.ts'

export interface Contas {
  /* Cadastra pela API; com `request`, a sessão fica nele (ex.: page.request). Sem, numa sessão descartável. */
  criar(opcoes?: Partial<Credenciais> & { modo?: Modo; request?: APIRequestContext }): Promise<Credenciais>
  /* Conta criada pela UI: entra na limpeza do fim do teste. */
  registrar(conta: Pick<Credenciais, 'email' | 'senha'>): void
  /* Conta sem senha (demo): apagada no fim pela sessão que a criou. */
  apagarAoFim(request: APIRequestContext): void
}

export interface OutroNavegador {
  contexto: BrowserContext
  pagina: Page
  /* Chamadas diretas à API sem sessão, do mesmo IP do navegador. `contexto.request` não passa pelo
     route que injeta o IP: sai sem x-forwarded-for e divide o limite por IP com o resto da suíte. */
  api: APIRequestContext
}

interface FixturesTeste {
  /* Padrões de erro tolerados pelo vigia (ex.: test.use({ ignorarErros: [/HTTP 503/] })). */
  ignorarErros: RegExp[]
  /* IP (x-forwarded-for) do contexto `page` e do `request` deste teste; só vale localmente. */
  ip: string
  contas: Contas
  /* Abre outro navegador isolado (sem sessão), vigiado como `page` e fechado no fim. */
  novoNavegador: (opcoes?: { ip?: string }) => Promise<OutroNavegador>
}

export const test = base.extend<FixturesTeste>({
  ignorarErros: [[], { option: true }],

  /* O Playwright exige o objeto de fixtures desestruturado, mesmo vazio. */
  // eslint-disable-next-line no-empty-pattern
  ip: async ({}, usar) => {
    await usar(ipAleatorio())
  },

  context: async ({ context, ip }, usar) => {
    await rotearIp(context, ip)
    await usar(context)
  },

  request: async ({ playwright, baseURL, ip }, usar) => {
    const request = await playwright.request.newContext({ baseURL, extraHTTPHeaders: cabecalhosDeIp(ip) })
    await usar(request)
    await request.dispose()
  },

  page: async ({ page, ignorarErros }, usar) => {
    const vigia = vigiarConsole(page, ignorarErros)
    await usar(page)
    vigia.afirmarLimpo()
  },

  /* Limpeza independente do estado em que o teste deixou a sessão: entra de novo e apaga.
     Login 401 = a própria conta foi excluída pelo teste. */
  contas: async ({ playwright, baseURL }, usar) => {
    const comSenha: Pick<Credenciais, 'email' | 'senha'>[] = []
    const semSenha: APIRequestContext[] = []
    const descartaveis: APIRequestContext[] = []
    const novaSessao = () => playwright.request.newContext({ baseURL, extraHTTPHeaders: cabecalhosDeIp() })

    await usar({
      async criar({ request, ...opcoes } = {}) {
        let alvo = request
        if (!alvo) {
          alvo = await novaSessao()
          descartaveis.push(alvo)
        }
        const conta = await cadastrarPorApi(alvo, opcoes)
        comSenha.push(conta)
        return conta
      },
      registrar: (conta) => { comSenha.push(conta) },
      apagarAoFim: (request) => { semSenha.push(request) },
    })

    const falhas: string[] = []
    for (const { email, senha } of comSenha) {
      const api = await novaSessao()
      const login = await api.post('/api/auth/login', { data: { email, senha }, headers: CSRF })
      if (login.status() === 200) {
        const status = await excluirConta(api)
        if (status !== 204) falhas.push(`${email}: DELETE /api/conta ${status}`)
      } else if (login.status() !== 401) {
        falhas.push(`${email}: login de limpeza ${login.status()}`)
      }
      await api.dispose()
    }
    for (const request of semSenha) {
      const status = await excluirConta(request).catch(() => 0)
      if (status !== 204 && status !== 401) falhas.push(`conta demo: DELETE /api/conta ${status}`)
    }
    await Promise.all(descartaveis.map((r) => r.dispose()))
    if (falhas.length) throw new Error(`limpeza de contas falhou:\n${falhas.join('\n')}`)
  },

  novoNavegador: async ({ browser, playwright, baseURL, ignorarErros }, usar, info) => {
    const abertos: { contexto: BrowserContext; api: APIRequestContext; afirmar: () => void }[] = []
    await usar(async ({ ip = ipAleatorio() } = {}) => {
      const contexto = await browser.newContext(opcoesDoProjeto(info))
      await rotearIp(contexto, ip)
      const pagina = await contexto.newPage()
      const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: cabecalhosDeIp(ip) })
      const vigia = vigiarConsole(pagina, ignorarErros)
      abertos.push({ contexto, api, afirmar: () => vigia.afirmarLimpo() })
      return { contexto, pagina, api }
    })
    for (const { contexto, api } of abertos) {
      await contexto.close()
      await api.dispose()
    }
    for (const { afirmar } of abertos) afirmar()
  },
})

export { expect } from '@playwright/test'
