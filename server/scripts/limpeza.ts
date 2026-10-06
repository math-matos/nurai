/* tsx server/scripts/limpeza.ts
   Apaga do Oracle configurado: sessões expiradas, tentativas de login/demo/cadastro/código com mais de
   um dia e contas convidadas cuja sessão venceu há mais de 24 h (com todo o histórico delas).
   A API já faz isso de forma oportunista no login/cadastro; o script serve para rodar sob demanda. */
import { limparExpirados } from '../auth/limpeza.js'
import { fecharPool, oracleConfigurado, variaveisOracleAusentes } from '../db/conexao.js'
import { criarRepoOracle } from '../db/oracle.js'

try {
  process.loadEnvFile('.env.local')
} catch {
  /* sem .env.local: usa só o ambiente */
}

if (!oracleConfigurado()) {
  console.error(`[limpeza] faltam ${variaveisOracleAusentes().join(', ')}`)
  process.exit(1)
}

try {
  const r = await limparExpirados(criarRepoOracle())
  console.log(`[limpeza] sessões: ${r.sessoes} · tentativas: ${r.tentativas} · convidados: ${r.convidados}`)
} catch (erro) {
  console.error('[limpeza] falhou:', erro instanceof Error ? erro.message : erro)
  process.exitCode = 1
} finally {
  await fecharPool()
}
