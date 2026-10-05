import { describe, expect, it, vi } from 'vitest'
import { gerarCodigo } from './codigo.js'

describe('gerarCodigo', () => {
  it('gera 6 caracteres do alfabeto sem ambíguos, sem Math.random', () => {
    const random = vi.spyOn(Math, 'random')
    const codigos = Array.from({ length: 200 }, gerarCodigo)
    expect(random).not.toHaveBeenCalled()
    random.mockRestore()
    for (const c of codigos) expect(c).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)
    expect(new Set(codigos).size).toBeGreaterThan(190)
  })
})
