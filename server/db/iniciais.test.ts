import { describe, expect, it } from 'vitest'
import { iniciaisDe } from './perfil.js'

describe('iniciaisDe', () => {
  it('ignora parênteses e caracteres que não são letras', () => {
    expect(iniciaisDe('Aparecida Souza (simulação)')).toBe('AS')
    expect(iniciaisDe('  Rafael   Lima ')).toBe('RL')
    expect(iniciaisDe('Ana')).toBe('A')
    expect(iniciaisDe("D'Ávila Ribeiro-Neto")).toBe('DR')
  })
})
