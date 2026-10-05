import { criarRepoMemoria } from './memoria.js'
import type { Repositorio } from './repo.js'

export async function criarRepo(): Promise<Repositorio> {
  return criarRepoMemoria()
}
