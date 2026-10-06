import { randomInt, randomUUID } from 'node:crypto'
import { criarLlmMock } from '../ai/mock.js'
import { criarApp } from '../app.js'
import type { Perfil, Repositorio, RepositorioPaciente, Usuario } from '../db/repo.js'

/* Apoio dos testes de rota: cadastro real pela API, cookie de sessão e cabeçalho anti-CSRF. */

export type App = ReturnType<typeof criarApp>

export const SENHA = 'senha-de-teste-123'

export function json(body: unknown, method = 'POST'): RequestInit {
  return { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

/* Mantém os cabeçalhos do init e acrescenta o cookie (se houver) e o x-nurai exigido em método ≠ GET. */
export function comSessao(cookie: string | null, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers)
  headers.set('x-nurai', '1')
  if (cookie) headers.set('cookie', cookie)
  return { ...init, headers }
}

export function cookieDe(res: Response): string {
  const bruto = res.headers.get('set-cookie') ?? ''
  const par = bruto.split(';')[0]
  if (!par.startsWith('nurai_sessao=')) throw new Error(`resposta sem cookie de sessão: "${bruto}"`)
  return par
}

export const emailNovo = (prefixo = 'pessoa') => `${prefixo}+${randomUUID()}@exemplo.com`

export interface Conta {
  cookie: string
  usuario: Usuario
  perfil: Perfil
  email: string
}

/* Cada cadastro vem de um IP novo: o limite de cadastros por IP não interfere nos testes que criam várias contas. */
export async function cadastrar(app: App, dados: Record<string, unknown> = {}): Promise<Conta> {
  const email = (dados.email as string | undefined) ?? emailNovo()
  const init = comSessao(null, json({ nome: 'Ana Teste', email, senha: SENHA, aceiteLgpd: true, ...dados }))
  const headers = new Headers(init.headers)
  headers.set('x-forwarded-for', `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`)
  const res = await app.request('/api/auth/cadastro', { ...init, headers })
  if (res.status !== 201) throw new Error(`cadastro falhou: ${res.status} ${await res.text()}`)
  const corpo = await res.json() as { usuario: Usuario; perfil: Perfil }
  return { cookie: cookieDe(res), email, ...corpo }
}

export async function cadastrarComOnboarding(app: App, modo: 'vazio' | 'exemplo', dados: Record<string, unknown> = {}) {
  const conta = await cadastrar(app, dados)
  const res = await app.request('/api/onboarding', comSessao(conta.cookie, json({ modo })))
  if (res.status !== 200) throw new Error(`onboarding falhou: ${res.status} ${await res.text()}`)
  return { ...conta, perfil: (await res.json() as { perfil: Perfil }).perfil }
}

/* Paciente com o histórico de exemplo, para testes que não são de autenticação. */
export async function pacienteExemplo(repo: Repositorio, dados: Record<string, unknown> = {}):
Promise<Conta & { repo: RepositorioPaciente }> {
  const conta = await cadastrarComOnboarding(criarApp({ repo, llm: criarLlmMock() }), 'exemplo', dados)
  return { ...conta, repo: repo.paraPaciente(conta.perfil.pacienteId) }
}

/* app.request com a sessão já anexada. */
export function logado(app: App, cookie: string) {
  return { request: (caminho: string, init: RequestInit = {}) => app.request(caminho, comSessao(cookie, init)) }
}
