import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { comConexao, fecharPool } from './conexao.js'
import { criarRepoOracle } from './oracle.js'
import { suiteRepositorio } from './repo.contract.js'
import { aplicarSchema } from './schema.js'

/* Precisa de um Oracle de verdade: ORACLE_DB_TEST=1 + ORACLE_DB_* (ex.: docker compose up oracle). */
describe.skipIf(process.env.ORACLE_DB_TEST !== '1')('Oracle', () => {
  beforeAll(aplicarSchema, 60_000)
  afterAll(fecharPool)

  suiteRepositorio('oracle', criarRepoOracle)

  it('identifica-se como oracle', () => {
    expect(criarRepoOracle().nome).toBe('oracle')
  })

  it('compartilhamento expira 30 dias depois de criado', async () => {
    const { codigo } = await criarRepoOracle().criarCompartilhamento('Dr. X', 'Helena Duarte Nogueira')
    const dias = await comConexao(async (conn) => {
      const r = await conn.execute<{ D: number }>(
        'SELECT EXTRACT(DAY FROM expira_em - criado_em) d FROM compartilhamentos WHERE codigo = :codigo',
        { codigo },
      )
      return r.rows?.[0].D
    })
    expect(dias).toBe(30)
  })

  it('acessos é append-only', async () => {
    await expect(comConexao((conn) => conn.execute("UPDATE acessos SET itens = 'x' WHERE id = 'a1'")))
      .rejects.toThrow(/ORA-20001/)
  })
})
