import { createHash } from 'node:crypto'
import type { Context } from 'hono'
import type { Repositorio } from '../db/repo.js'
import { ipDe } from './middleware.js'

export interface Limite {
  maximo: number
  janelaMs: number
}

/* A chave guarda só um hash: IP e email não ficam em claro na tabela de tentativas. */
export const chave = (...partes: string[]) => createHash('sha256').update(partes.join('|')).digest('hex')

export async function excedeu(repo: Repositorio, chaveTentativa: string, limite: Limite) {
  return await repo.contarTentativas(chaveTentativa, new Date(Date.now() - limite.janelaMs)) >= limite.maximo
}

export function muitasTentativas(c: Context, limite: Limite) {
  c.header('Retry-After', String(limite.janelaMs / 1000))
  return c.json({ erro: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.', codigo: 'MUITAS_TENTATIVAS' }, 429)
}

/* Conta toda requisição do IP (não só as que falham). Devolve a resposta 429 ou null para seguir. */
export async function limitarPorIp(c: Context, repo: Repositorio, nome: string, limite: Limite) {
  const chaveIp = chave(nome, ipDe(c))
  if (await excedeu(repo, chaveIp, limite)) return muitasTentativas(c, limite)
  await repo.registrarTentativa(chaveIp)
  return null
}
