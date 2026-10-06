import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { comConexao, fecharPool } from './conexao.js'
import { criarRepoOracle } from './oracle.js'
import { suiteRepositorio } from './repo.contract.js'
import { aplicarSchema } from './schema.js'

/* Precisa de um Oracle de verdade: ORACLE_DB_TEST=1 + ORACLE_DB_* (ex.: docker compose up oracle). */
describe.skipIf(process.env.ORACLE_DB_TEST !== '1')('Oracle', () => {
  const repo = criarRepoOracle()
  let pacienteId: string

  beforeAll(async () => {
    await aplicarSchema()
    pacienteId = (await repo.criarPaciente({ nome: 'Paciente Oracle', convidado: false })).pacienteId
    await repo.aplicarOnboarding(pacienteId, 'exemplo')
  }, 60_000)

  afterAll(async () => {
    await repo.excluirPaciente(pacienteId)
    await fecharPool()
  })

  suiteRepositorio('oracle', criarRepoOracle)

  it('identifica-se como oracle', () => {
    expect(repo.nome).toBe('oracle')
  })

  it('aplicarSchema é idempotente', async () => {
    expect(await aplicarSchema()).toBeGreaterThan(0)
  })

  it('compartilhamento expira 30 dias depois de criado e nasce não revogado', async () => {
    const { codigo } = await repo.paraPaciente(pacienteId).criarCompartilhamento('Dr. X', 'Paciente Oracle')
    const linha = await comConexao(async (conn) => {
      const r = await conn.execute<{ D: number; R: number; P: string }>(
        `SELECT EXTRACT(DAY FROM expira_em - criado_em) d, revogado r, paciente_id p
           FROM compartilhamentos WHERE codigo = :codigo`,
        { codigo },
      )
      return r.rows?.[0]
    })
    expect(linha).toEqual({ D: 30, R: 0, P: pacienteId })
  })

  it('acessos é append-only', async () => {
    await expect(comConexao((conn) => conn.execute(
      "UPDATE acessos SET itens = 'x' WHERE paciente_id = :p AND id = 'a1'", { p: pacienteId },
    ))).rejects.toThrow(/ORA-20001/)
  })

  it('email só entra em minúsculas', async () => {
    await expect(comConexao((conn) => conn.execute(
      "INSERT INTO usuarios (id, paciente_id, email) VALUES ('x-maiusc', :p, 'A@B.COM')", { p: pacienteId },
    ))).rejects.toThrow(/ORA-02290/)
  })
})
