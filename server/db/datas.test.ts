import { describe, expect, it } from 'vitest'
import { agora, hoje } from './datas.js'

describe('datas', () => {
  it('formata no horário de Brasília', () => {
    const d = new Date('2026-01-01T03:05:00Z')
    expect(agora(d)).toBe('01/01/2026 00:05')
    expect(hoje(d)).toBe('01/01/2026')
  })

  it('usa 00 para meia-noite', () => {
    expect(agora(new Date('2026-03-10T03:00:00Z'))).toBe('10/03/2026 00:00')
  })
})
