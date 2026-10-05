import { readFile } from 'node:fs/promises'
import { comConexao } from './conexao.js'

/* Executa server/db/schema.sql bloco a bloco (separador: linha com "/"). Idempotente. */
export async function aplicarSchema() {
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8')
  const blocos = sql
    .split('\n')
    .filter((linha) => !linha.startsWith('--'))
    .join('\n')
    .split(/^\/\s*$/m)
    .map((b) => b.trim())
    .filter(Boolean)
  await comConexao(async (conn) => {
    for (const bloco of blocos) await conn.execute(bloco)
  })
  return blocos.length
}
