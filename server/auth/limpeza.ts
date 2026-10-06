import type { LimitesLimpeza, Repositorio, ResultadoLimpeza } from '../db/repo.js'
import { DURACAO_CONVIDADO_MS } from './sessao.js'

const DIA_MS = 86_400_000
const INTERVALO_MS = 10 * 60_000

/* A sessão do convidado dura 24 h e não se renova (ele não tem senha para entrar de novo):
   "sessão expirada há mais de 24 h" equivale a "conta criada há mais de 24 h + duração da sessão". */
export function limitesPadrao(agora = new Date()): LimitesLimpeza {
  return {
    sessoesExpiradasAntesDe: agora,
    tentativasAntesDe: new Date(agora.getTime() - DIA_MS),
    convidadosCriadosAntesDe: new Date(agora.getTime() - DURACAO_CONVIDADO_MS - DIA_MS),
  }
}

export const limparExpirados = (repo: Repositorio, agora = new Date()): Promise<ResultadoLimpeza> =>
  repo.limpar(limitesPadrao(agora))

const ultimaLimpeza = new WeakMap<Repositorio, number>()

/* Sem cron: roda no login/cadastro/demo, no máximo a cada 10 min por instância. Falha só vai para o log. */
export async function limpezaOportunista(repo: Repositorio) {
  const agora = Date.now()
  if (agora - (ultimaLimpeza.get(repo) ?? -Infinity) < INTERVALO_MS) return
  ultimaLimpeza.set(repo, agora)
  try {
    await limparExpirados(repo, new Date(agora))
  } catch (erro) {
    console.error(`[limpeza] falhou: ${erro instanceof Error ? erro.message : String(erro)}`)
  }
}
