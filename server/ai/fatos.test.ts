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

describe('derivarFatos — tendências com faixa unilateral', () => {
  it('série de HDL só com piso ("> 40") e de LDL só com teto ("< 130") viram tendência e serializam', () => {
    const hdl = (valor: number) => ({ nome: 'HDL-colesterol', valor, unidade: 'mg/dL', refMin: 40, sinal: valor < 40 ? 'alterado' as const : 'normal' as const })
    const ldl = (valor: number) => ({ nome: 'LDL-colesterol', valor, unidade: 'mg/dL', refMax: 130, sinal: valor > 130 ? 'alterado' as const : 'normal' as const })
    const fatos = derivarFatos([
      evento({ id: 'a', data: '2024-09-05', medidas: [hdl(39), ldl(168)] }),
      evento({ id: 'b', data: '2025-09-18', medidas: [hdl(41), ldl(142)] }),
      evento({ id: 'c', data: '2026-03-12', medidas: [hdl(38), ldl(138)] }),
    ])
    expect(fatos.tendencias.map((t) => [t.nome, t.variacoes])).toEqual([
      ['Colesterol HDL', ['subiu', 'caiu']], ['Colesterol LDL', ['caiu', 'caiu']],
    ])
    expect(serializarFatos(fatos)).toMatch(/HDL \(mg\/dL\): 39 em 05\/09\/2024 \(a\); 41 em 18\/09\/2025 \(b\), subiu; 38 em 12\/03\/2026 \(c\), caiu/)
  })

  /* Shape real da extração (OCI) dos docs demo 04 (20/01/2025) e 10 (15/05/2026): TFG "≥ 90" só com piso.
     Antes, a TFG de 85 era descartada e o copiloto dizia que não havia alteração posterior. */
  const TFG = 'Taxa de filtração glomerular estimada (TFG)'
  const renal = (id: string, data: string, tfg: number, creatinina: number) => evento({
    id, data, titulo: id === 'd04' ? 'Glicemia, Hemoglobina Glicada e Função Renal' : 'Hemograma completo e função renal',
    sinal: tfg < 90 ? 'alterado' : 'normal', origem: 'OCR + IA', fonte: 'paciente',
    medidas: [
      { nome: 'Creatinina', valor: creatinina, unidade: 'mg/dL', refMin: 0.7, refMax: 1.3, sinal: 'normal' },
      { nome: TFG, valor: tfg, unidade: 'mL/min/1,73 m²', refMin: 90, sinal: tfg < 90 ? 'alterado' : 'normal' },
    ],
  })

  it('TFG unilateral dos dois laudos vira uma série com a queda de 101 para 85', () => {
    const fatos = derivarFatos([renal('d10', '2026-05-15', 85, 1.08), renal('d04', '2025-01-20', 101, 0.94)])
    const tfg = fatos.tendencias.find((t) => t.nome === 'Taxa de filtração glomerular')!
    expect(tfg.pontos.map((p) => [p.id, p.valor])).toEqual([['d04', 101], ['d10', 85]])
    expect(tfg.ultima).toBe('caiu')
    expect(serializarFatos(fatos)).toMatch(/Taxa de filtração glomerular \(mL\/min\/1,73 m²\): 101 em 20\/01\/2025 \(d04\); 85 em 15\/05\/2026 \(d10\), caiu/)
  })

  it('nomes diferentes do mesmo analito entram na mesma série; medidas desconhecidas só com mesmo nome e unidade', () => {
    const m = (nome: string, valor: number, unidade = 'mL/min/1,73 m²') => ({ nome, valor, unidade, refMin: 60, sinal: 'normal' as const })
    const { tendencias } = derivarFatos([
      evento({ id: 'a', data: '2024-01-01', medidas: [m('TFG estimada (CKD-EPI)', 92), m('VEF1', 2.9, 'L'), m('VEF1', 78, '% do previsto')] }),
      evento({ id: 'b', data: '2025-01-01', medidas: [m(TFG, 88), m('VEF1', 3.1, 'L')] }),
    ])
    expect(tendencias.map((t) => [t.nome, t.pontos.map((p) => p.valor)])).toEqual([
      ['Taxa de filtração glomerular', [92, 88]], ['VEF1', [2.9, 3.1]],
    ])
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
    expect(pendencias.map((p) => [p.tipo, p.alvo, p.ancoras])).toEqual([
      ['retorno', 'Oftalmologia', ['e14']], ['reavaliacao', 'TSH', ['e16', 'e15']],
    ])
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
    expect(texto).toMatch(/pedido em 08\/07\/2026 de .*já realizado em 27\/05\/2026.*\(e22, e24\)/)
    expect(texto).toMatch(/Reavaliação de TSH.*\(e16, e15\)/)
    expect(texto).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('declara quando não há fatos de um tipo', () => {
    expect(serializarFatos(derivarFatos([]))).toMatch(/nenhum/i)
  })
})

/* Shape exato que a extração real (OCI) devolveu para os PDFs 02 e 09 do Marcos. */
const PERFIL_02 = evento({
  id: 'r02', data: '2026-03-12', tipo: 'exame', titulo: 'Perfil lipídico', instituicao: 'Laboratório Quaresmeira',
  resumo: 'Colesterol total, LDL e triglicerídeos acima do desejável.',
})
const PEDIDO_09 = evento({
  id: 'r09', data: '2026-04-02', tipo: 'documento', titulo: 'Pedido de exame', instituicao: 'Clínica Ipê-Roxo',
  resumo: 'Pedido de exame de perfil lipídico para controle de dislipidemia, solicitado pela Dra. Beatriz N. Sallum.',
})

describe('derivarFatos — pedido de exame já realizado', () => {
  it('liga o "Pedido de exame" (documento) de perfil lipídico ao perfil feito 21 dias antes', () => {
    const { repeticoes, pendencias } = derivarFatos([PERFIL_02, PEDIDO_09])
    expect(repeticoes).toEqual([expect.objectContaining({
      exame: 'Perfil lipídico', feito: 'r02', pedido: 'r09', dias: 21, feitoInstituicao: 'Laboratório Quaresmeira',
    })])
    expect(pendencias).toEqual([])
    expect(serializarFatos(derivarFatos([PERFIL_02, PEDIDO_09])))
      .toMatch(/pedido em 02\/04\/2026 de perfil lipídico, já realizado em 12\/03\/2026 \(Laboratório Quaresmeira\).*\(r02, r09\)/)
  })

  it('reconhece sinônimos e acentos: "Guia — lipidograma" casa com "Perfil Lipidico"', () => {
    const { repeticoes } = derivarFatos([
      { ...PERFIL_02, titulo: 'PERFIL LIPIDICO' },
      { ...PEDIDO_09, titulo: 'Guia SADT', resumo: 'Solicitação de lipidograma.' },
    ])
    expect(repeticoes.map((r) => [r.feito, r.pedido])).toEqual([['r02', 'r09']])
  })

  it('pedido de hemograma casa com "Hemograma completo"; pedido de outro exame não', () => {
    const hemograma = evento({ id: 'h', data: '2026-03-10', titulo: 'Hemograma completo' })
    const pedidoHemograma = evento({ id: 'p1', data: '2026-05-01', tipo: 'documento', titulo: 'Pedido de exame', resumo: 'Requisição de hemograma.' })
    const pedidoTsh = evento({ id: 'p2', data: '2026-05-01', tipo: 'documento', titulo: 'Pedido de exame', resumo: 'Pedido de TSH.' })
    expect(derivarFatos([hemograma, pedidoHemograma, pedidoTsh]).repeticoes.map((r) => r.pedido)).toEqual(['p1'])
  })

  it('não liga quando o exame foi feito há mais de 6 meses, nem um pedido a outro pedido', () => {
    expect(derivarFatos([{ ...PERFIL_02, data: '2025-09-01' }, PEDIDO_09]).repeticoes).toEqual([])
    expect(derivarFatos([{ ...PEDIDO_09, id: 'r08', data: '2026-03-01' }, PEDIDO_09]).repeticoes).toEqual([])
  })

  it('pedido sem resultado anterior nem posterior vira pendência com o nome do exame', () => {
    const { pendencias } = derivarFatos([PEDIDO_09])
    expect(pendencias).toEqual([expect.objectContaining({ tipo: 'pedido', alvo: 'perfil lipídico', ancoras: ['r09'] })])
  })
})
