import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import type { z } from 'zod'
import { PACIENTE } from '../src/data/seed.js'
import { LIMITE_PDF } from './ai/pdf.js'
import type { LlmProvider } from './ai/provider.js'
import { ErroConflito, type Repositorio } from './db/repo.js'
import { esquemaCompartilhamento, esquemaEvento } from './esquemas.js'
import { rotasIa } from './routes/ia.js'

export interface Deps {
  repo: Repositorio
  llm: LlmProvider
}

const VERSAO = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local'

/* Sem autenticação no MVP: toda ação é atribuída à titular do histórico. */
const AUTOR = PACIENTE.nome

async function lerCorpo<T>(c: Context, esquema: z.ZodType<T>): Promise<T> {
  let bruto: unknown
  try {
    bruto = await c.req.json()
  } catch {
    throw new HTTPException(400, { message: 'Corpo da requisição não é um JSON válido' })
  }
  const resultado = esquema.safeParse(bruto)
  if (!resultado.success) {
    const detalhes = resultado.error.issues
      .map((i) => `${i.path.join('.') || 'corpo'}: ${i.message}`)
      .join('; ')
    throw new HTTPException(400, { message: `Dados inválidos — ${detalhes}` })
  }
  return resultado.data
}

/* Barra o corpo antes de lê-lo: sem isso, um upload gigante seria lido inteiro em memória
   (multipart) antes da checagem de tamanho. O PDF ganha folga para o envelope multipart. */
const LIMITE_JSON = 256 * 1024
const LIMITE_EXTRAIR = LIMITE_PDF + 512 * 1024

const limiteJson = bodyLimit({
  maxSize: LIMITE_JSON,
  onError: (c) => c.json({ erro: 'O corpo da requisição passa do limite de 256 KB', codigo: 'CORPO_GRANDE' }, 413),
})

const limiteExtrair = bodyLimit({
  maxSize: LIMITE_EXTRAIR,
  onError: (c) => c.req.header('content-type')?.startsWith('multipart/form-data')
    ? c.json({ erro: 'O PDF passa do limite de 4 MB', codigo: 'ARQUIVO_GRANDE' }, 413)
    : c.json({ erro: 'O corpo da requisição passa do limite de 4 MB', codigo: 'CORPO_GRANDE' }, 413),
})

function naoEncontrado(oQue: string, id: string): never {
  throw new HTTPException(404, { message: `${oQue} "${id}" não encontrado` })
}

export function criarApp(deps: Deps): Hono {
  const { repo, llm } = deps
  const app = new Hono().basePath('/api')

  app.use('*', (c, next) => (c.req.path === '/api/extrair' ? limiteExtrair : limiteJson)(c, next))

  app.get('/health', (c) => c.json({ ok: true, genai: llm.nome, db: repo.nome, versao: VERSAO }))

  app.get('/estado', async (c) => c.json(await repo.estado()))

  app.post('/eventos', async (c) => {
    const evento = await lerCorpo(c, esquemaEvento)
    return c.json(await repo.adicionarEvento(evento, AUTOR), 201)
  })

  app.patch('/consentimentos/:id', async (c) => {
    const id = c.req.param('id')
    return c.json(await repo.alternarConsentimento(id, AUTOR) ?? naoEncontrado('Consentimento', id))
  })

  app.patch('/passos/:id', async (c) => {
    const id = c.req.param('id')
    return c.json(await repo.alternarPasso(id) ?? naoEncontrado('Passo', id))
  })

  app.post('/fontes/:id/conectar', async (c) => {
    const id = c.req.param('id')
    return c.json(await repo.conectarFonte(id) ?? naoEncontrado('Fonte', id))
  })

  app.post('/compartilhamentos', async (c) => {
    const { para } = await lerCorpo(c, esquemaCompartilhamento)
    return c.json(await repo.criarCompartilhamento(para, AUTOR), 201)
  })

  app.get('/acessos', async (c) => c.json(await repo.listarAcessos()))

  app.post('/reiniciar', async (c) => {
    await repo.reiniciar()
    return c.json(await repo.estado())
  })

  app.route('/', rotasIa(deps))

  app.notFound((c) => c.json({ erro: 'Rota não encontrada' }, 404))

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ erro: err.message }, err.status)
    if (err instanceof ErroConflito) return c.json({ erro: err.message, codigo: 'CONFLITO' }, 409)
    console.error(`[api] ${c.req.method} ${c.req.path} falhou: ${err.name}: ${err.message}`)
    return c.json({ erro: 'Erro interno' }, 500)
  })

  return app
}
