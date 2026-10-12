import { describe, expect, it } from 'vitest'
import { LAUDO_EXEMPLO } from '../../../src/data/exemplos.js'
import { montarEvento } from './extrair.js'
import { extrairPorHeuristica } from './extrair-mock.js'

function clinico(texto: string) {
  const bruto = extrairPorHeuristica(texto)
  if (!bruto.clinico) throw new Error('esperava documento clínico')
  return bruto
}

describe('extrairPorHeuristica', () => {
  describe('laudo de exemplo do front (tabela)', () => {
    const bruto = clinico(LAUDO_EXEMPLO.texto)

    it('usa a data da coleta, não a de nascimento', () => {
      expect(bruto.data).toBe('2026-08-18')
    })

    it('lê as medidas em formato de tabela com faixa de referência', () => {
      expect(bruto.tipo).toBe('exame')
      expect(bruto.medidas).toEqual([
        { nome: 'Colesterol total', valor: 212, unidade: 'mg/dL', refMin: null, refMax: 190 },
        { nome: 'Colesterol LDL', valor: 118, unidade: 'mg/dL', refMin: null, refMax: 100 },
        { nome: 'Colesterol HDL', valor: 44, unidade: 'mg/dL', refMin: 45, refMax: 90 },
        { nome: 'Triglicérides', valor: 165, unidade: 'mg/dL', refMin: null, refMax: 150 },
        { nome: 'Colesterol não-HDL', valor: 168, unidade: 'mg/dL', refMin: null, refMax: 130 },
      ])
    })

    it('vira evento de exame sem medidas descartadas', () => {
      const { evento, avisos } = montarEvento(bruto, LAUDO_EXEMPLO.nomeArquivo)
      expect(evento).toMatchObject({ data: '2026-08-18', tipo: 'exame', sinal: 'alterado' })
      expect(evento.medidas).toHaveLength(5)
      expect(avisos.join(' ')).not.toMatch(/omitida|data de hoje/)
    })
  })

  it('lê faixa só com piso ("Desejável: > 40", "≥ 90") como refMin, sem teto', () => {
    const bruto = clinico([
      'Resultado de exame — coleta 12/03/2026',
      'HDL-colesterol      38 mg/dL     Desejável: > 40',
      'TFG estimada        101 mL/min   ≥ 90',
      'LDL-colesterol      138 mg/dL    Desejável: < 130',
    ].join('\n'))
    expect(bruto.medidas).toEqual([
      { nome: 'HDL-colesterol', valor: 38, unidade: 'mg/dL', refMin: 40, refMax: null },
      { nome: 'TFG estimada', valor: 101, unidade: 'mL/min', refMin: 90, refMax: null },
      { nome: 'LDL-colesterol', valor: 138, unidade: 'mg/dL', refMin: null, refMax: 130 },
    ])
    const { evento, avisos } = montarEvento(bruto)
    expect(evento.medidas!.map((m) => [m.nome, m.sinal])).toEqual([
      ['HDL-colesterol', 'alterado'], ['TFG estimada', 'normal'], ['LDL-colesterol', 'alterado'],
    ])
    expect(avisos.join(' ')).not.toMatch(/omitida/)
  })

  it('ignora a data de nascimento sem rótulo de coleta', () => {
    const bruto = clinico('Paciente: Ana   Nascimento: 01/01/1970\nResultado de exame\n05/03/2026')
    expect(bruto.data).toBe('2026-03-05')
  })

  it('aceita data de emissão rotulada', () => {
    expect(clinico('Nascimento: 01/01/1970\nLaudo de ultrassonografia\nEmissão: 10/04/2026').data).toBe('2026-04-10')
  })

  describe('receita', () => {
    it('receita de bolo não é clínica', () => {
      expect(extrairPorHeuristica('Receita de bolo: 2 xícaras de farinha, 3 ovos, 1 xícara de açúcar e 200 ml de leite'))
        .toEqual({ clinico: false })
    })

    it('receita médica é medicação', () => {
      expect(clinico('Receita médica\nLosartana 50 mg — tomar 1 comprimido ao dia').tipo).toBe('medicacao')
    })

    it('receita com medicamento e dose é medicação', () => {
      expect(clinico('Receita\nAmoxicilina 500 mg, 1 cápsula de 8 em 8 horas por 7 dias').tipo).toBe('medicacao')
    })
  })

  it('faixa só com teto ou só com piso, em tabela ou com rótulo, inclusive "até" e "acima de"', () => {
    const bruto = clinico([
      'Laboratório Teste - resultado de exame',
      'Data da coleta: 12/03/2026',
      'Colesterol total     212 mg/dL     Até 190 mg/dL',
      'Colesterol HDL       44 mg/dL      Acima de 40 mg/dL',
      'Triglicérides        165 mg/dL     inferior a 150 mg/dL',
      'LDL: 118 mg/dL (VR: até 130)',
      'HDL controle: 52 mg/dL (ref: ≥ 40)',
    ].join('\n'))
    expect(bruto.medidas).toEqual(expect.arrayContaining([
      { nome: 'Colesterol total', valor: 212, unidade: 'mg/dL', refMin: null, refMax: 190 },
      { nome: 'Colesterol HDL', valor: 44, unidade: 'mg/dL', refMin: 40, refMax: null },
      { nome: 'Triglicérides', valor: 165, unidade: 'mg/dL', refMin: null, refMax: 150 },
      { nome: 'LDL', valor: 118, unidade: 'mg/dL', refMin: null, refMax: 130 },
      { nome: 'HDL controle', valor: 52, unidade: 'mg/dL', refMin: 40, refMax: null },
    ]))
    expect(bruto.medidas).toHaveLength(5)
  })
})
