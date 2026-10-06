import { afterEach, describe, expect, it, vi } from 'vitest'
import { hojeISO } from './comum.js'

describe('hojeISO', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  /* Às 22h30 de Brasília já é o dia seguinte em UTC (fuso da Vercel). */
  it('usa o dia de Brasília, não o de UTC', () => {
    vi.useFakeTimers({ now: new Date('2026-10-05T01:30:00Z') })
    expect(hojeISO()).toBe('2026-10-04')
  })
})
