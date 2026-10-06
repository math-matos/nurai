/* Conta o que a suíte E2E deixou no banco: titulares e-mail "e2e+..." e convidados (demo) criados
   desde --desde (ISO; padrão: últimas 6 h). Com --apagar, exclui pelo repositório (cascata).
   Imprime só contagens: nada de e-mail, id ou credencial. */
import { comConexao, fecharPool, oracleConfigurado, variaveisOracleAusentes } from '../db/conexao.js'
import { instanteUtc, paraBindUtc } from '../db/oracle-contas.js'
import { criarRepoOracle } from '../db/oracle.js'

try {
  process.loadEnvFile('.env.local')
} catch {
  /* sem .env.local: usa só o ambiente */
}

if (!oracleConfigurado()) {
  console.error(`[contas-e2e] faltam ${variaveisOracleAusentes().join(', ')}`)
  process.exit(1)
}

const args = process.argv.slice(2)
const apagar = args.includes('--apagar')
const desdeArg = args.find((a) => a.startsWith('--desde='))?.slice('--desde='.length)
const desde = desdeArg ? new Date(desdeArg) : new Date(Date.now() - 6 * 60 * 60 * 1000)
if (Number.isNaN(desde.getTime())) {
  console.error('[contas-e2e] --desde inválido (use ISO, ex.: 2026-10-06T12:00:00Z)')
  process.exit(1)
}

interface Alvos {
  titulares: string[]
  convidados: string[]
  orfaos: string[]
}

/* Órfão: paciente sem usuário (cadastro que falhou no meio), criado na janela. */
const buscarAlvos = () => comConexao(async (conn): Promise<Alvos> => {
  const ids = async (sql: string, binds: Record<string, string> = {}) =>
    ((await conn.execute<{ ID: string }>(sql, binds)).rows ?? []).map((r) => r.ID)
  const janela = { desde: paraBindUtc(desde) }
  return {
    titulares: await ids(`SELECT paciente_id id FROM usuarios WHERE email LIKE 'e2e+%'`),
    convidados: await ids(`SELECT id FROM pacientes WHERE convidado = 1 AND criado_em >= ${instanteUtc('desde')}`, janela),
    orfaos: await ids(
      `SELECT p.id FROM pacientes p WHERE p.criado_em >= ${instanteUtc('desde')}
         AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.paciente_id = p.id)`,
      janela,
    ),
  }
})

const totais = () => comConexao(async (conn) => {
  const r = await conn.execute<{ U: number; P: number }>(
    'SELECT (SELECT COUNT(*) FROM usuarios) u, (SELECT COUNT(*) FROM pacientes) p FROM dual',
  )
  return r.rows![0]
})

const resumo = (a: Alvos) =>
  `titulares e2e+: ${a.titulares.length}, convidados desde ${desde.toISOString()}: ${a.convidados.length}, órfãos: ${a.orfaos.length}`

try {
  const alvos = await buscarAlvos()
  console.log(`[contas-e2e] ${resumo(alvos)}`)
  if (apagar) {
    const repo = criarRepoOracle()
    const ids = [...new Set([...alvos.titulares, ...alvos.convidados, ...alvos.orfaos])]
    let apagados = 0
    for (const id of ids) if (await repo.excluirPaciente(id)) apagados++
    console.log(`[contas-e2e] apagados: ${apagados}`)
    console.log(`[contas-e2e] depois: ${resumo(await buscarAlvos())}`)
  }
  const { U, P } = await totais()
  console.log(`[contas-e2e] banco: usuários ${U}, pacientes ${P}`)
} catch (erro) {
  console.error('[contas-e2e] falhou:', erro instanceof Error ? erro.message : erro)
  process.exitCode = 1
} finally {
  await fecharPool()
}
