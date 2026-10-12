import {
  expect,
  type APIRequestContext,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
  type TestInfo,
} from '@playwright/test'
import type { Consentimento, Evento, ProximoPasso } from '../../src/data/types.ts'
import { SENHA_TESTE, emailTeste } from './conta.ts'

/* Sem E2E_BASE_URL a suíte roda contra o dev local (memória + IA simulada). */
export const LOCAL = !process.env.E2E_BASE_URL
/* Com E2E_REAL=1 as asserções de IA também cobram qualidade, não só a mecânica. */
export const REAL = process.env.E2E_REAL === '1'

export const CSRF = { 'x-nurai': '1' }

export function ipAleatorio(): string {
  const octeto = () => Math.floor(Math.random() * 254) + 1
  return `10.${octeto()}.${octeto()}.${octeto()}`
}

/* O servidor lê o IP de x-forwarded-for. Localmente cada contexto ganha o seu, para os limites
   por IP não vazarem entre testes; num deploy real a plataforma sobrescreve o cabeçalho. */
export const cabecalhosDeIp = (ip = ipAleatorio()): Record<string, string> =>
  LOCAL ? { 'x-forwarded-for': ip } : {}

/* No navegador o IP vai só nas chamadas à API: como extraHTTPHeaders ele iria também às fontes
   do Google, e o cabeçalho extra dispara um preflight de CORS que elas recusam.
   O route não pega `contexto.request`: para chamar a API direto com este IP, use cabecalhosDeIp(ip). */
export async function rotearIp(contexto: BrowserContext, ip: string) {
  if (!LOCAL) return
  await contexto.route(
    (url) => url.pathname.startsWith('/api/'),
    (rota) => rota.continue({ headers: { ...rota.request().headers(), 'x-forwarded-for': ip } }),
  )
}

/* Localmente a suíte roda sem internet (namespace de rede próprio, ver e2e/rede-isolada.mjs): a folha
   do Google Fonts volta vazia e o texto usa a fonte do sistema, em vez de um erro de rede no console. */
export async function dispensarFontesExternas(contexto: BrowserContext) {
  if (!LOCAL) return
  await contexto.route(
    (url) => url.hostname === 'fonts.googleapis.com',
    (rota) => rota.fulfill({ status: 200, contentType: 'text/css', body: '' }),
  )
}

export function opcoesDoProjeto(info: TestInfo): BrowserContextOptions {
  const { baseURL, viewport, isMobile, hasTouch, deviceScaleFactor, userAgent, locale, timezoneId } = info.project.use
  return { baseURL, viewport, isMobile, hasTouch, deviceScaleFactor, userAgent, locale, timezoneId }
}

export type Modo = 'vazio' | 'exemplo'

export interface Credenciais {
  nome: string
  email: string
  senha: string
}

export interface EstadoApi {
  eventos: Evento[]
  consentimentos: Consentimento[]
  acessos: { id: string; quem: string; papel: string; acao: string; itens: string }[]
  passos: ProximoPasso[]
  fontes: { id: string; nome: string; estado: string }[]
  compartilhamento: { codigo: string; para: string; expiraEm: string } | null
}

/* Cadastra pela API no `request` dado: o cookie de sessão fica nele (page.request = contexto da página).
   Cada cadastro sai de um IP novo, para o limite de cadastros por IP não somar entre testes. */
export async function cadastrarPorApi(
  request: APIRequestContext,
  { nome = 'Paciente E2E', email = emailTeste(), senha = SENHA_TESTE, modo }: Partial<Credenciais> & { modo?: Modo } = {},
): Promise<Credenciais> {
  const res = await request.post('/api/auth/cadastro', {
    data: { nome, email, senha, aceiteLgpd: true },
    headers: { ...CSRF, ...cabecalhosDeIp() },
  })
  expect(res.status(), `cadastro: ${await res.text()}`).toBe(201)
  if (modo) {
    const onboarding = await request.post('/api/onboarding', { data: { modo }, headers: CSRF })
    expect(onboarding.status(), `onboarding: ${await onboarding.text()}`).toBe(200)
  }
  return { nome, email, senha }
}

export async function entrarPorApi(request: APIRequestContext, { email, senha }: Pick<Credenciais, 'email' | 'senha'>) {
  const res = await request.post('/api/auth/login', { data: { email, senha }, headers: CSRF })
  expect(res.status(), `login: ${await res.text()}`).toBe(200)
}

export async function lerEstado(request: APIRequestContext): Promise<EstadoApi> {
  const res = await request.get('/api/estado')
  expect(res.status()).toBe(200)
  return (await res.json()) as EstadoApi
}

/* Espera o AppShell terminar de carregar o histórico. */
export async function esperarApp(page: Page) {
  await expect(page.getByTestId('shell-perfil')).toBeAttached()
  await expect(page.locator('.carregando-app')).toHaveCount(0)
}

/* Abaixo de 900px a barra lateral é uma gaveta fora da tela: abre antes de clicar nela. */
export async function abrirMenuSePreciso(page: Page) {
  const menu = page.getByRole('button', { name: 'Abrir menu' })
  if (await menu.isVisible()) {
    await menu.click()
    await expect(page.locator('.lateral--aberta')).toBeInViewport()
  }
}

export async function irParaSecao(page: Page, rotulo: string) {
  await abrirMenuSePreciso(page)
  await page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: rotulo }).click()
}

export const SECOES_DO_APP = ['linha', 'fontes', 'copiloto', 'cuidado', 'resumo', 'privacidade'] as const
