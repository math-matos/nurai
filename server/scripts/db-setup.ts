import { comConexao, fecharPool, oracleConfigurado, variaveisOracleAusentes } from '../db/conexao.js'
import { criarRepoOracle } from '../db/oracle.js'
import { aplicarSchema } from '../db/schema.js'

try {
  process.loadEnvFile('.env.local')
} catch {
  /* sem .env.local: usa só o ambiente */
}

if (!oracleConfigurado()) {
  console.error(`[db:setup] faltam ${variaveisOracleAusentes().join(', ')}`)
  process.exit(1)
}

const resetar = process.argv.includes('--reset')

try {
  console.log(`[db:setup] schema: ${await aplicarSchema()} blocos aplicados`)
  const eventos = await comConexao(async (conn) => {
    const r = await conn.execute<{ N: number }>("SELECT COUNT(*) n FROM eventos WHERE paciente_id = 'helena'")
    return r.rows?.[0].N ?? 0
  })
  if (eventos === 0 || resetar) {
    await criarRepoOracle().reiniciar()
    console.log(`[db:setup] seed aplicado${resetar ? ' (--reset)' : ''}`)
  } else {
    console.log(`[db:setup] seed mantido: ${eventos} eventos já existem (use --reset para re-semear)`)
  }
} catch (erro) {
  console.error('[db:setup] falhou:', erro instanceof Error ? erro.message : erro)
  process.exitCode = 1
} finally {
  await fecharPool()
}
