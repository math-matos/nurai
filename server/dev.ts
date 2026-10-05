import { serve } from '@hono/node-server'
import { criarApp } from './app.js'
import { obterDeps } from './deps.js'

try {
  process.loadEnvFile('.env.local')
} catch {
  /* sem .env.local: segue com mocks */
}

const PORTA = 3001
const deps = await obterDeps()

serve({ fetch: criarApp(deps).fetch, port: PORTA }, () => {
  console.log(`[api] http://localhost:${PORTA}/api (genai: ${deps.llm.nome}, db: ${deps.repo.nome})`)
})
