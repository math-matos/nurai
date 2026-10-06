import oracledb from 'oracledb'

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT
oracledb.fetchAsString = [oracledb.CLOB]

const VARIAVEIS = ['ORACLE_DB_USER', 'ORACLE_DB_PASSWORD', 'ORACLE_DB_CONNECT_STRING'] as const

export function variaveisOracleAusentes() {
  return VARIAVEIS.filter((v) => !process.env[v])
}

export function oracleConfigurado() {
  return variaveisOracleAusentes().length === 0
}

export function usaWallet() {
  return Boolean(process.env.ORACLE_DB_WALLET_PEM_BASE64)
}

/* Always Free limita a 20 sessões; cada instância serverless fica com no máximo 4. */
function atributosPool(): oracledb.PoolAttributes {
  const ausentes = variaveisOracleAusentes()
  if (ausentes.length) throw new Error(`Oracle não configurado: faltam ${ausentes.join(', ')}`)
  const env = process.env
  const base: oracledb.PoolAttributes = {
    user: env.ORACLE_DB_USER,
    password: env.ORACLE_DB_PASSWORD,
    connectString: env.ORACLE_DB_CONNECT_STRING,
    poolMin: 0,
    poolMax: 4,
    poolIncrement: 1,
  }
  if (!usaWallet()) return base
  /* walletContent (thin, >= 6.6) dispensa gravar o ewallet.pem em disco — na Vercel só há /tmp efêmero. */
  return {
    ...base,
    walletContent: Buffer.from(env.ORACLE_DB_WALLET_PEM_BASE64!, 'base64').toString('utf8'),
    walletPassword: env.ORACLE_DB_WALLET_PASSWORD,
  }
}

let pool: Promise<oracledb.Pool> | undefined

export function obterPool() {
  pool ??= oracledb.createPool(atributosPool()).catch((erro: unknown) => {
    pool = undefined
    throw erro
  })
  return pool
}

export async function fecharPool() {
  const atual = pool
  pool = undefined
  if (atual) await (await atual).close(0)
}

export async function comConexao<T>(fn: (conn: oracledb.Connection) => Promise<T>): Promise<T> {
  const conn = await (await obterPool()).getConnection()
  try {
    return await fn(conn)
  } finally {
    await conn.close()
  }
}

/* close() sem commit desfaz a transação: um erro no meio não deixa escrita pela metade. */
export function transacao<T>(fn: (conn: oracledb.Connection) => Promise<T>): Promise<T> {
  return comConexao(async (conn) => {
    const resultado = await fn(conn)
    await conn.commit()
    return resultado
  })
}

export async function verificarConexao() {
  try {
    await comConexao((conn) => conn.execute('SELECT 1 FROM dual'))
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro)
    throw new Error(`Falha ao conectar no Oracle (ORACLE_DB_*): ${motivo}`, { cause: erro })
  }
}
