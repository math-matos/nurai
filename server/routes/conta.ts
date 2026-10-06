import { Hono } from 'hono'
import type { AmbienteApp } from '../auth/middleware.js'
import { limparCookieSessao } from '../auth/sessao.js'
import type { Repositorio } from '../db/repo.js'
import { esquemaExclusao, esquemaOnboarding, esquemaPerfil } from '../esquemas.js'
import { lerCorpo } from '../http.js'

/* Rotas da própria conta; o middleware de sessão já garantiu c.var.pacienteId. */
export function rotasConta(repo: Repositorio): Hono<AmbienteApp> {
  const rotas = new Hono<AmbienteApp>()

  rotas.post('/onboarding', async (c) => {
    const { modo } = await lerCorpo(c, esquemaOnboarding)
    return c.json({ perfil: await repo.aplicarOnboarding(c.var.pacienteId, modo) })
  })

  rotas.patch('/perfil', async (c) => {
    const mudancas = await lerCorpo(c, esquemaPerfil)
    return c.json({ perfil: await repo.atualizarPerfil(c.var.pacienteId, mudancas) })
  })

  rotas.delete('/conta', async (c) => {
    await lerCorpo(c, esquemaExclusao)
    await repo.excluirPaciente(c.var.pacienteId)
    limparCookieSessao(c)
    return c.body(null, 204)
  })

  return rotas
}
