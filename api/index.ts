import { handle } from 'hono/vercel'
import { criarApp } from '../server/app.js'
import { obterDeps } from '../server/deps.js'

const handler = handle(criarApp(await obterDeps()))

export const GET = handler
export const POST = handler
export const PATCH = handler
export const PUT = handler
export const DELETE = handler
export const OPTIONS = handler
