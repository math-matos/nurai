import { describe, expect, it } from 'vitest'
import { geometriaRegua, sinalDaFaixa, textoDaFaixa } from '../src/data/referencia.js'
import { serializarEvento } from './ai/prompts.js'

/* Faixa de referência compartilhada pela API, pela conferência e pela régua do front. */
describe('faixa de referência', () => {
  it('sinal: bilateral, só piso e só teto; o limite pertence à faixa', () => {
    expect(sinalDaFaixa(80, { refMin: 70, refMax: 99 })).toBe('normal')
    expect(sinalDaFaixa(100, { refMin: 70, refMax: 99 })).toBe('alterado')
    expect(sinalDaFaixa(40, { refMin: 40 })).toBe('normal')
    expect(sinalDaFaixa(38, { refMin: 40 })).toBe('alterado')
    expect(sinalDaFaixa(9999, { refMin: 40 })).toBe('normal')
    expect(sinalDaFaixa(130, { refMax: 130 })).toBe('normal')
    expect(sinalDaFaixa(131, { refMax: 130 })).toBe('alterado')
  })

  it('texto: "70 a 99", "≥ 0,7", "≤ 130"', () => {
    expect(textoDaFaixa({ refMin: 70, refMax: 99 })).toBe('70 a 99')
    expect(textoDaFaixa({ refMin: 0.7 })).toBe('≥ 0,7')
    expect(textoDaFaixa({ refMax: 130 })).toBe('≤ 130')
  })

  it('o prompt recebe a faixa unilateral sem "undefined" nem "NaN"', () => {
    const linha = serializarEvento({
      id: 'e1', data: '2026-03-12', tipo: 'exame', titulo: 'Perfil lipídico', instituicao: 'Lab', fonte: 'paciente',
      resumo: 'Perfil.', sinal: 'alterado', tags: [], origem: 'OCR + IA',
      medidas: [
        { nome: 'HDL', valor: 38, unidade: 'mg/dL', refMin: 40, sinal: 'alterado' },
        { nome: 'LDL', valor: 138, unidade: 'mg/dL', refMax: 130, sinal: 'alterado' },
      ],
    })
    expect(linha).toContain('HDL = 38 mg/dL (ref ≥ 40; alterado)')
    expect(linha).toContain('LDL = 138 mg/dL (ref ≤ 130; alterado)')
    expect(linha).not.toMatch(/undefined|NaN/)
  })
})

describe('geometriaRegua', () => {
  it('bilateral: faixa entre os dois limites, rótulos só com o número', () => {
    const g = geometriaRegua({ valor: 80, refMin: 70, refMax: 99 })
    expect(g.faixa.inicio).toBeGreaterThan(0)
    expect(g.faixa.fim).toBeLessThan(100)
    expect(g.limites.map((l) => l.texto)).toEqual(['70', '99'])
  })

  it('só piso ("> 40"): faixa aberta até a borda direita, rótulo "≥ 40", valor abaixo do piso fica à esquerda', () => {
    const g = geometriaRegua({ valor: 38, refMin: 40 })
    expect(g.faixa.fim).toBe(100)
    expect(g.faixa.inicio).toBeGreaterThan(0)
    expect(g.marca).toBeLessThan(g.faixa.inicio)
    expect(g.limites).toEqual([{ posicao: g.faixa.inicio, texto: '≥ 40' }])
  })

  it('só teto ("< 130"): faixa aberta desde a borda esquerda, rótulo "≤ 130"', () => {
    const g = geometriaRegua({ valor: 138, refMax: 130 })
    expect(g.faixa.inicio).toBe(0)
    expect(g.marca).toBeGreaterThan(g.faixa.fim)
    expect(g.limites.map((l) => l.texto)).toEqual(['≤ 130'])
  })

  it('valor igual ao único limite não gera divisão por zero', () => {
    const g = geometriaRegua({ valor: 0.7, refMin: 0.7 })
    for (const n of [g.faixa.inicio, g.faixa.fim, g.marca, g.limites[0].posicao]) expect(Number.isFinite(n)).toBe(true)
  })
})
