import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

const N = 2 ** 15
const R = 8
const P = 1
const TAMANHO = 64
const TAMANHO_SAL = 16
/* scrypt usa 128 * N * r bytes = 32 MiB, exatamente o maxmem padrão do Node, que então recusa. */
const MAXMEM = 64 * 1024 * 1024

function derivar(senha: string, sal: Buffer, opcoes: ScryptOptions, tamanho: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha.normalize('NFC'), sal, tamanho, { ...opcoes, maxmem: MAXMEM }, (erro, chave) =>
      (erro ? reject(erro) : resolve(chave)))
  })
}

export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(TAMANHO_SAL)
  const hash = await derivar(senha, sal, { N, r: R, p: P }, TAMANHO)
  return ['scrypt', N, R, P, sal.toString('base64url'), hash.toString('base64url')].join('$')
}

function lerHash(hash: string) {
  const [algoritmo, n, r, p, sal, derivado] = hash.split('$')
  if (algoritmo !== 'scrypt' || !sal || !derivado) return null
  return { opcoes: { N: Number(n), r: Number(r), p: Number(p) }, sal: Buffer.from(sal, 'base64url'), derivado: Buffer.from(derivado, 'base64url') }
}

/* Sem hash (convidado, email desconhecido ou formato inválido) o custo do scrypt é pago do mesmo jeito:
   o tempo de resposta não revela se a conta existe. */
export async function verificarSenha(senha: string, hash: string | null): Promise<boolean> {
  const lido = hash ? lerHash(hash) : null
  if (!lido) {
    await derivar(senha, randomBytes(TAMANHO_SAL), { N, r: R, p: P }, TAMANHO)
    return false
  }
  const calculado = await derivar(senha, lido.sal, lido.opcoes, lido.derivado.length)
  return timingSafeEqual(calculado, lido.derivado)
}
