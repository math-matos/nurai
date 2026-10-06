import { describe, expect, it } from 'vitest'
import { type ExtracaoBruta, montarEvento } from './extrair.js'

type Clinica = Extract<ExtracaoBruta, { clinico: true }>
type MedidaBruta = Clinica['medidas'][number]

const bruto = (medidas: MedidaBruta[], extra: Partial<Clinica> = {}): Clinica => ({
  clinico: true, data: '2026-08-18', tipo: 'exame', titulo: 'Perfil lipídico', instituicao: 'Laboratório Vetor',
  especialidade: null, resumo: 'Perfil lipídico.', medidas, tags: [], confianca: 0.9, avisos: [], ...extra,
})
const m = (nome: string, valor: number, refMin: number | null, refMax: number | null): MedidaBruta =>
  ({ nome, valor, unidade: 'mg/dL', refMin, refMax })

describe('montarEvento — faixas de referência', () => {
  it('"< X" (só teto) vira faixa 0–X e mantém a medida', () => {
    const { evento, avisos } = montarEvento(bruto([m('Colesterol total', 212, null, 190), m('Colesterol HDL', 44, 45, 90)]))
    expect(evento.medidas).toEqual([
      { nome: 'Colesterol total', valor: 212, unidade: 'mg/dL', refMin: 0, refMax: 190, sinal: 'alterado' },
      { nome: 'Colesterol HDL', valor: 44, unidade: 'mg/dL', refMin: 45, refMax: 90, sinal: 'alterado' },
    ])
    expect(avisos).toEqual([])
    expect(evento.confianca).toBe(0.9)
  })

  it('"> X" (só piso) não cabe no tipo Medida: omite com aviso específico, sem dizer que não há faixa', () => {
    const { evento, avisos } = montarEvento(bruto([m('Colesterol HDL', 52, 40, null)]))
    expect(evento.medidas).toBeUndefined()
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toMatch(/Colesterol HDL.*só o limite inferior \(40\)/)
    expect(avisos[0]).not.toMatch(/não traz faixa/)
  })

  it('aviso de "não traz faixa" só quando não há referência alguma', () => {
    const { avisos } = montarEvento(bruto([m('Vitamina D', 28, null, null)]))
    expect(avisos).toEqual(['A medida "Vitamina D" foi omitida porque o documento não traz faixa de referência.'])
  })
})

describe('montarEvento — confiança', () => {
  it('cai a cada medida descartada e a cada aviso', () => {
    expect(montarEvento(bruto([m('Vitamina D', 28, null, null)])).evento.confianca).toBe(0.75)
    expect(montarEvento(bruto([], { avisos: ['Valor de LDL parcialmente ilegível'] })).evento.confianca).toBe(0.85)
    expect(montarEvento(bruto([], { data: null })).evento.confianca).toBe(0.85)
  })

  it('confiança ajustada abaixo do mínimo gera o aviso de baixa confiança', () => {
    const { evento, avisos } = montarEvento(bruto(
      [m('A', 1, null, null), m('B', 1, null, null)], { confianca: 0.95 }))
    expect(evento.confianca).toBe(0.65)
    expect(avisos.at(-1)).toMatch(/baixa confiança/)
  })
})
