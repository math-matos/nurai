import type { Context, MiddlewareHandler } from 'hono'
import type { Perfil, Repositorio, RepositorioPaciente, Usuario } from '../db/repo.js'
import { sessaoDaRequisicao } from './sessao.js'

export interface VariaveisSessao {
  pacienteId: string
  perfil: Perfil
  usuario: Usuario
  repoPaciente: RepositorioPaciente
}

export type AmbienteApp = { Variables: VariaveisSessao }

/* /api/acesso-medico/* fica reservado para o acesso por código, sem conta. */
const ROTAS_LIVRES = [/^\/api\/health$/, /^\/api\/auth(\/|$)/, /^\/api\/acesso-medico(\/|$)/]

export const rotaLivre = (caminho: string) => ROTAS_LIVRES.some((re) => re.test(caminho))

export const naoAutenticado = (c: Context) =>
  c.json({ erro: 'Faça login para continuar', codigo: 'NAO_AUTENTICADO' }, 401)

/* Um site de terceiros não consegue mandar cabeçalho customizado sem preflight de CORS, que a API não libera. */
export const exigirCsrf: MiddlewareHandler = async (c, next) => {
  if (c.req.method !== 'GET' && c.req.header('x-nurai') !== '1') {
    return c.json({ erro: 'Requisição sem o cabeçalho de proteção', codigo: 'CSRF' }, 403)
  }
  await next()
}

export function exigirSessao(repo: Repositorio): MiddlewareHandler<AmbienteApp> {
  return async (c, next) => {
    if (rotaLivre(c.req.path)) return next()
    const sessao = await sessaoDaRequisicao(c, repo)
    if (!sessao) return naoAutenticado(c)
    const { pacienteId } = sessao.perfil
    c.set('pacienteId', pacienteId)
    c.set('perfil', sessao.perfil)
    c.set('usuario', sessao.usuario)
    c.set('repoPaciente', repo.paraPaciente(pacienteId))
    await next()
  }
}

export function ipDe(c: Context): string {
  const encaminhado = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  return encaminhado || c.req.header('x-real-ip')?.trim() || 'desconhecido'
}
