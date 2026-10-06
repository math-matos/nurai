import { createHash, randomBytes } from 'node:crypto'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Repositorio, SessaoAtiva, Usuario } from '../db/repo.js'

export const COOKIE_SESSAO = 'nurai_sessao'
const HORA_MS = 60 * 60 * 1000
export const DURACAO_SESSAO_MS = 7 * 24 * HORA_MS
export const DURACAO_CONVIDADO_MS = 24 * HORA_MS

export const gerarToken = () => randomBytes(32).toString('base64url')
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

const cookieSeguro = () => Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production'

export async function abrirSessao(c: Context, repo: Repositorio, usuario: Usuario, convidado: boolean) {
  const token = gerarToken()
  const duracao = convidado ? DURACAO_CONVIDADO_MS : DURACAO_SESSAO_MS
  await repo.criarSessao({ tokenHash: hashToken(token), usuarioId: usuario.id, expiraEm: new Date(Date.now() + duracao) })
  setCookie(c, COOKIE_SESSAO, token, {
    httpOnly: true, sameSite: 'Lax', path: '/', secure: cookieSeguro(), maxAge: duracao / 1000,
  })
}

export function limparCookieSessao(c: Context) {
  deleteCookie(c, COOKIE_SESSAO, { path: '/', secure: cookieSeguro() })
}

/* Sessão expirada é apagada no primeiro uso; o cookie inválido é limpo no navegador. */
export async function sessaoDaRequisicao(c: Context, repo: Repositorio): Promise<SessaoAtiva | null> {
  const token = getCookie(c, COOKIE_SESSAO)
  if (!token) return null
  const tokenHash = hashToken(token)
  const sessao = await repo.buscarSessao(tokenHash)
  if (sessao && sessao.expiraEm.getTime() > Date.now()) return sessao
  if (sessao) await repo.apagarSessao(tokenHash)
  limparCookieSessao(c)
  return null
}

export async function encerrarSessao(c: Context, repo: Repositorio) {
  const token = getCookie(c, COOKIE_SESSAO)
  if (token) await repo.apagarSessao(hashToken(token))
  limparCookieSessao(c)
}
