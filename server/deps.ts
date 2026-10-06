import { criarLlm } from './ai/index.js'
import type { Deps } from './app.js'
import { criarRepo } from './db/index.js'

let deps: Promise<Deps> | undefined

export function obterDeps(): Promise<Deps> {
  deps ??= criarRepo().then((repo) => ({ repo, llm: criarLlm() }))
  return deps
}
