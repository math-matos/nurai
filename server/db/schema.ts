import { readFile } from 'node:fs/promises'
import type oracledb from 'oracledb'
import { comConexao } from './conexao.js'

/* Ordem de DROP: filhas antes das mães (CASCADE CONSTRAINTS cobre o resto). */
export const TABELAS = [
  'sessoes', 'tentativas', 'usuarios', 'compartilhamentos', 'fontes', 'passos', 'acessos', 'consentimentos',
  'eventos', 'pacientes',
] as const

export class ErroSchemaAntigo extends Error {
  constructor() {
    super('Schema antigo (single-patient) detectado: rode "pnpm db:setup --recriar" — isso APAGA todos os dados da Nurai')
    this.name = 'ErroSchemaAntigo'
  }
}

async function lerBlocos() {
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8')
  return sql
    .split('\n')
    .filter((linha) => !linha.startsWith('--'))
    .join('\n')
    .split(/^\/\s*$/m)
    .map((b) => b.trim())
    .filter(Boolean)
}

/* "pacientes" sem a coluna onboarding é a tabela do MVP single-patient; CREATE ... IF NOT EXISTS a manteria. */
async function schemaAntigo(conn: oracledb.Connection) {
  const r = await conn.execute<{ TABELA: number; COLUNA: number }>(
    `SELECT (SELECT COUNT(*) FROM user_tables WHERE table_name = 'PACIENTES') tabela,
            (SELECT COUNT(*) FROM user_tab_columns WHERE table_name = 'PACIENTES' AND column_name = 'ONBOARDING') coluna
       FROM dual`,
  )
  const { TABELA, COLUNA } = r.rows![0]
  return TABELA > 0 && COLUNA === 0
}

/* Executa server/db/schema.sql bloco a bloco (separador: linha com "/"). Idempotente. */
export async function aplicarSchema() {
  const blocos = await lerBlocos()
  await comConexao(async (conn) => {
    if (await schemaAntigo(conn)) throw new ErroSchemaAntigo()
    for (const bloco of blocos) await conn.execute(bloco)
  })
  return blocos.length
}

/* Derruba todas as tabelas da Nurai, com os dados. Só para "db:setup --recriar" e testes. */
export async function derrubarSchema() {
  await comConexao(async (conn) => {
    for (const tabela of TABELAS) {
      await conn.execute(`BEGIN
        EXECUTE IMMEDIATE 'DROP TABLE ${tabela} CASCADE CONSTRAINTS PURGE';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
      END;`)
    }
  })
}
