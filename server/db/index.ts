import { oracleConfigurado, usaWallet, verificarConexao } from './conexao.js'
import { criarRepoMemoria } from './memoria.js'
import { criarRepoOracle } from './oracle.js'
import type { Repositorio } from './repo.js'

/* Com ORACLE_DB_* presentes, falha de conexão derruba o startup em vez de cair para memória:
   o /api/health precisa dizer qual banco está de fato atendendo. */
export async function criarRepo(): Promise<Repositorio> {
  if (!oracleConfigurado()) {
    console.log('[db] repositório: memoria (ORACLE_DB_* ausentes)')
    return criarRepoMemoria()
  }
  await verificarConexao()
  console.log(`[db] repositório: oracle (${usaWallet() ? 'mTLS com wallet' : 'TCP sem wallet'})`)
  return criarRepoOracle()
}
