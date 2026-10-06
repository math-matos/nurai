import { describe, expect, it } from 'vitest'
import { gerarHashSenha, verificarSenha } from './senha.js'

describe('senha (scrypt)', () => {
  it('gera hash no formato scrypt$N$r$p$salt$hash com os parâmetros fixos', async () => {
    const hash = await gerarHashSenha('segredo-forte')
    const [algoritmo, n, r, p, sal, derivado] = hash.split('$')
    expect([algoritmo, n, r, p]).toEqual(['scrypt', '32768', '8', '1'])
    expect(Buffer.from(sal, 'base64url')).toHaveLength(16)
    expect(Buffer.from(derivado, 'base64url')).toHaveLength(64)
  })

  it('usa salt aleatório: a mesma senha gera hashes diferentes', async () => {
    expect(await gerarHashSenha('segredo-forte')).not.toBe(await gerarHashSenha('segredo-forte'))
  })

  it('verifica a senha certa e rejeita a errada', async () => {
    const hash = await gerarHashSenha('segredo-forte')
    expect(await verificarSenha('segredo-forte', hash)).toBe(true)
    expect(await verificarSenha('segredo-fraco', hash)).toBe(false)
  })

  it('rejeita conta sem senha (convidado) e hash malformado', async () => {
    expect(await verificarSenha('qualquer', null)).toBe(false)
    expect(await verificarSenha('qualquer', 'scrypt$1$2')).toBe(false)
    expect(await verificarSenha('qualquer', 'bcrypt$x')).toBe(false)
  })
})
