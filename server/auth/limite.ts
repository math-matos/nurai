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

const HORA_MS = 3_600_000

/* "15 min", "1 h", "2 h": a espera máxima é a janela inteira. */
export function tempoDeEspera(janelaMs: number): string {
  return janelaMs >= HORA_MS && janelaMs % HORA_MS === 0 ? `${janelaMs / HORA_MS} h` : `${Math.ceil(janelaMs / 60_000)} min`
}

export function muitasTentativas(c: Context, limite: Limite, motivo = 'Muitas tentativas seguidas.') {
  c.header('Retry-After', String(limite.janelaMs / 1000))
  return c.json({ erro: `${motivo} Tente de novo em ${tempoDeEspera(limite.janelaMs)}.`, codigo: 'MUITAS_TENTATIVAS' }, 429)
}

/* Conta toda requisição do IP (não só as que falham). Devolve a resposta 429 ou null para seguir. */
export async function limitarPorIp(c: Context, repo: Repositorio, nome: string, limite: Limite, motivo?: string) {
  const chaveIp = chave(nome, ipDe(c))
  if (await excedeu(repo, chaveIp, limite)) return muitasTentativas(c, limite, motivo)
  await repo.registrarTentativa(chaveIp)
  return null
}
