import { describe, expect, it } from 'vitest'
import { EVENTOS } from '../../src/data/seed.js'
import type { Evento } from '../../src/data/types.js'
import { derivarFatos, serializarFatos } from './fatos.js'

const base = { instituicao: 'Lab', fonte: 'laboratorio', sinal: 'info', tags: [], origem: 'RNDS' } as const
const evento = (e: Partial<Evento> & Pick<Evento, 'id' | 'data'>): Evento =>
  ({ tipo: 'exame', titulo: 'Exame', resumo: '', ...base, ...e }) as Evento
const medida = (nome: string, valor: number) => ({ nome, valor, unidade: '%', refMin: 0, refMax: 1, sinal: 'normal' as const })

describe('derivarFatos — tendências', () => {
  it('compara cada medição com a anterior e expõe a última variação', () => {
    const { tendencias } = derivarFatos(EVENTOS)
    const glicada = tendencias.find((t) => t.nome === 'Hemoglobina glicada (HbA1c)')!
    expect(glicada.pontos.map((p) => [p.id, p.valor])).toEqual([
      ['e02', 7.8], ['e11', 7.1], ['e12', 6.9], ['e18', 7.4], ['e21', 7.2],
    ])
    expect(glicada.variacoes).toEqual(['caiu', 'caiu', 'subiu', 'caiu'])
    expect(glicada.ultima).toBe('caiu')
  })

  it('trata variação de até 1% como estável e ignora medida com um só ponto', () => {
    const { tendencias } = derivarFatos([
      evento({ id: 'a', data: '2024-01-01', medidas: [medida('X', 100), medida('Y', 5)] }),
      evento({ id: 'b', data: '2024-06-01', medidas: [medida('X', 100.5)] }),
    ])
    expect(tendencias).toEqual([expect.objectContaining({ nome: 'X', variacoes: ['estável'], ultima: 'estável' })])
  })
})

describe('derivarFatos — exames repetidos', () => {
  it('liga o pedido da UBS ao Doppler de carótidas feito seis semanas antes', () => {
    const { repeticoes } = derivarFatos(EVENTOS)
    expect(repeticoes).toEqual([expect.objectContaining({
      exame: 'Ultrassom Doppler de carótidas', feito: 'e22', pedido: 'e24', dias: 42,
    })])
  })

  it('não conta exame feito há mais de 12 meses nem pedido descrito no próprio exame', () => {
    const { repeticoes } = derivarFatos([
      evento({ id: 'a', data: '2023-01-01', tipo: 'imagem', titulo: 'Ecocardiograma' }),
      evento({ id: 'b', data: '2024-03-01', tipo: 'consulta', resumo: 'Solicitado ecocardiograma.' }),
      evento({ id: 'c', data: '2024-04-01', titulo: 'Glicemia', resumo: 'Solicitado em consulta particular.' }),
    ])
    expect(repeticoes).toEqual([])
  })
})

describe('derivarFatos — pendências', () => {
  it('no seed, aponta o TSH nunca reavaliado e o retorno anual da oftalmologia', () => {
    const { pendencias } = derivarFatos(EVENTOS)
    expect(pendencias.map((p) => p.ancoras)).toEqual([['e14'], ['e16', 'e15']])
    expect(pendencias.find((p) => p.ancoras[0] === 'e16')?.descricao).toMatch(/TSH.*10\/02\/2025/)
  })

  it('pedido de exame sem resultado posterior vira pendência; com resultado, não', () => {
    const { pendencias } = derivarFatos([
      evento({ id: 'a', data: '2024-01-01', tipo: 'consulta', resumo: 'Solicitados novo Holter e ecocardiograma.' }),
      evento({ id: 'b', data: '2024-02-01', tipo: 'documento', titulo: 'Laudo de Holter de 24 h' }),
    ])
    expect(pendencias).toEqual([expect.objectContaining({ ancoras: ['a'], descricao: expect.stringMatching(/ecocardiograma/i) })])
  })

  it('reavaliação de medida feita depois não é pendência', () => {
    const { pendencias } = derivarFatos([
      evento({ id: 'a', data: '2024-01-01', tipo: 'consulta', especialidade: 'Endo', resumo: 'Reavaliar TSH em 8 semanas.' }),
      evento({ id: 'b', data: '2024-03-01', medidas: [medida('TSH', 3)] }),
    ])
    expect(pendencias).toEqual([])
  })
})

describe('serializarFatos', () => {
  it('escreve datas dd/mm/aaaa, vírgula decimal e os ids de cada fato', () => {
    const texto = serializarFatos(derivarFatos(EVENTOS))
    expect(texto).toContain('FATOS DERIVADOS')
    expect(texto).toMatch(/Hemoglobina glicada \(HbA1c\).*7,8 em 02\/04\/2019 \(e02\)/)
    expect(texto).toMatch(/7,4 em 14\/09\/2025 \(e18\), subiu/)
    expect(texto).toMatch(/27\/05\/2026.*\(e22\).*08\/07\/2026.*\(e24\)/)
    expect(texto).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('declara quando não há fatos de um tipo', () => {
    expect(serializarFatos(derivarFatos([]))).toMatch(/nenhum/i)
  })
})
