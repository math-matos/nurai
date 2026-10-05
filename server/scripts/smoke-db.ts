import { comConexao, fecharPool, oracleConfigurado, usaWallet, variaveisOracleAusentes } from '../db/conexao.js'

try {
  process.loadEnvFile('.env.local')
} catch {
  /* sem .env.local: usa só o ambiente */
}

if (!oracleConfigurado()) {
  console.error(`[smoke:db] faltam ${variaveisOracleAusentes().join(', ')}`)
  process.exit(1)
}

const inicio = performance.now()
const ms = (desde: number) => `${Math.round(performance.now() - desde)} ms`

try {
  await comConexao(async (conn) => {
    console.log(`[smoke:db] conectado (${usaWallet() ? 'mTLS com wallet' : 'TCP sem wallet'}) em ${ms(inicio)}`)
    /* product_component_version é legível por qualquer usuário, inclusive no Autonomous DB. */
    let t = performance.now()
    const versao = await conn.execute<{ V: string }>(
      "SELECT product || ' ' || version_full v FROM product_component_version FETCH FIRST 1 ROWS ONLY",
    )
    console.log(`[smoke:db] ${versao.rows?.[0].V} (${ms(t)})`)
    t = performance.now()
    const eventos = await conn.execute<{ N: number }>("SELECT COUNT(*) n FROM eventos WHERE paciente_id = 'helena'")
    console.log(`[smoke:db] eventos da paciente: ${eventos.rows?.[0].N} (${ms(t)})`)
  })
  console.log(`[smoke:db] ok — total ${ms(inicio)}`)
} catch (erro) {
  console.error('[smoke:db] falhou:', erro instanceof Error ? erro.message : erro)
  process.exitCode = 1
} finally {
  await fecharPool()
}
