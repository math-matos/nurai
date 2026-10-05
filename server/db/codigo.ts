import { randomInt } from 'node:crypto'

/* Sem 0/O, 1/I/L: o código é ditado e digitado por quem recebe o acesso. Ele dá acesso ao histórico,
   então vem de um gerador criptográfico, não de Math.random. */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function gerarCodigo(): string {
  return Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('')
}
