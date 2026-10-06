import { describe, expect, it } from 'vitest'
import { gerarToken, hashToken } from './sessao.js'

describe('token de sessão', () => {
  it('tem 32 bytes aleatórios em base64url', () => {
    const token = gerarToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(Buffer.from(token, 'base64url')).toHaveLength(32)
    expect(gerarToken()).not.toBe(token)
  })

  it('o banco guarda o sha256 em hex, nunca o token', () => {
    const token = gerarToken()
    const hash = hashToken(token)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toBe(hashToken(token))
    expect(hash).not.toContain(token)
  })
})
