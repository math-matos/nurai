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
        { nome: 'Colesterol total', valor: 212, unidade: 'mg/dL', refMin: 0, refMax: 190 },
        { nome: 'Colesterol LDL', valor: 118, unidade: 'mg/dL', refMin: 0, refMax: 100 },
        { nome: 'Colesterol HDL', valor: 44, unidade: 'mg/dL', refMin: 45, refMax: 90 },
        { nome: 'Triglicérides', valor: 165, unidade: 'mg/dL', refMin: 0, refMax: 150 },
        { nome: 'Colesterol não-HDL', valor: 168, unidade: 'mg/dL', refMin: 0, refMax: 130 },
      ])
    })

    it('vira evento de exame sem medidas descartadas', () => {
      const { evento, avisos } = montarEvento(bruto, LAUDO_EXEMPLO.nomeArquivo)
      expect(evento).toMatchObject({ data: '2026-08-18', tipo: 'exame', sinal: 'alterado' })
      expect(evento.medidas).toHaveLength(5)
      expect(avisos.join(' ')).not.toMatch(/omitida|data de hoje/)
    })
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
})
