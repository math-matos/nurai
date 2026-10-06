/* pnpm db:setup            cria o que faltar do schema (idempotente; não semeia paciente)
   pnpm db:setup --recriar  DERRUBA e recria todas as tabelas da Nurai: APAGA todos os dados
                            (pacientes, contas, sessões, históricos). Necessário uma vez para sair
                            do schema single-patient antigo. */
import { fecharPool, oracleConfigurado, variaveisOracleAusentes } from '../db/conexao.js'
import { aplicarSchema, derrubarSchema, TABELAS } from '../db/schema.js'

try {
  process.loadEnvFile('.env.local')
} catch {
  /* sem .env.local: usa só o ambiente */
}

if (!oracleConfigurado()) {
  console.error(`[db:setup] faltam ${variaveisOracleAusentes().join(', ')}`)
  process.exit(1)
}

const recriar = process.argv.includes('--recriar')

try {
  if (recriar) {
    await derrubarSchema()
    console.log(`[db:setup] --recriar: tabelas derrubadas (${TABELAS.join(', ')})`)
  }
  console.log(`[db:setup] schema: ${await aplicarSchema()} blocos aplicados`)
} catch (erro) {
  console.error('[db:setup] falhou:', erro instanceof Error ? erro.message : erro)
  process.exitCode = 1
} finally {
  await fecharPool()
}
