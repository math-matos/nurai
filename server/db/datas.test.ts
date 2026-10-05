import { describe, expect, it } from 'vitest'
import { agora, hoje, hojeIso } from './datas.js'

describe('datas', () => {
  it('formata no horário de Brasília', () => {
    const d = new Date('2026-01-01T03:05:00Z')
    expect(agora(d)).toBe('01/01/2026 00:05')
    expect(hoje(d)).toBe('01/01/2026')
  })

  it('usa 00 para meia-noite', () => {
    expect(agora(new Date('2026-03-10T03:00:00Z'))).toBe('10/03/2026 00:00')
  })

  it('hojeIso devolve a data de Brasília em AAAA-MM-DD, mesmo quando em UTC já virou o dia', () => {
    expect(hojeIso(new Date('2026-10-05T01:30:00Z'))).toBe('2026-10-04')
    expect(hojeIso(new Date('2026-10-05T03:00:00Z'))).toBe('2026-10-05')
  })
})
