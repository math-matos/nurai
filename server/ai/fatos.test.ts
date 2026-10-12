import { describe, expect, it } from 'vitest'
import { EVENTOS } from '../../src/data/seed.js'
import type { Evento } from '../../src/data/types.js'
import { DEMO_MARCOS } from '../teste/demo-marcos.js'
import { derivarFatos, pontosEmAberto, serializarFatos } from './fatos.js'

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

/* Eventos no shape real da extração (server/teste/demo-marcos.ts). Hoje fixo: o prazo do retorno conta. */
describe('derivarFatos — pedidos e retornos de consulta (shape real)', () => {
  const HOJE = '2026-10-06'
  const pendencias = (eventos: Evento[], hoje = HOJE) => derivarFatos(eventos, hoje).pendencias

  it('consulta de pneumologia de 04/11/2025: nova espirometria e retorno em 6 meses ficam pendentes', () => {
    const lista = pendencias(DEMO_MARCOS).filter((p) => p.ancoras.includes('d08'))
    expect(lista.map((p) => [p.tipo, p.alvo, p.ancoras])).toEqual([
      ['pedido', 'nova espirometria com prova broncodilatadora', ['d08']],
      ['retorno', 'Pneumologia', ['d08']],
    ])
    expect(lista[1].descricao).toMatch(/^Retorno em Pneumologia previsto para 05\/2026 sem consulta posterior registrada\..*retorno em 6 meses/)
  })

  it('internação de pneumologia dentro da janela não é o retorno ambulatorial: continua pendente', () => {
    const alta: Evento = {
      id: 'alta', data: '2026-05-03', tipo: 'internacao', titulo: 'Resumo de alta hospitalar',
      instituicao: 'Hospital Municipal Vale do Jacarandá', fonte: 'hospital', especialidade: 'Pneumologia',
      resumo: 'Paciente internado de 03/05/2026 a 06/05/2026 por crise asmática moderada a grave.',
      sinal: 'alterado', tags: [], origem: 'OCR + IA',
    }
    const lista = pendencias([...DEMO_MARCOS, alta]).filter((p) => p.tipo === 'retorno' && p.ancoras.includes('d08'))
    expect(lista.map((p) => p.alvo)).toEqual(['Pneumologia'])
  })

  it('"nova espirometria" pedida no seguimento não é exame duplicado da espirometria anterior', () => {
    const { repeticoes } = derivarFatos(DEMO_MARCOS, HOJE)
    expect(repeticoes.map((r) => [r.feito, r.pedido])).toEqual([['f02', 'f09'], ['d09', 'd11']])
  })

  it('consulta de cardiologia de 14/08/2024: MAPA, perfil lipídico, glicemia, glicada, creatinina e potássio foram feitos depois', () => {
    expect(pendencias(DEMO_MARCOS).filter((p) => p.ancoras.includes('d01') && p.tipo === 'pedido')).toEqual([])
    const semExames = DEMO_MARCOS.filter((e) => ['d01'].includes(e.id))
    expect(pendencias(semExames).filter((p) => p.tipo === 'pedido').map((p) => p.alvo)).toEqual([
      'MAPA de 24 horas', 'perfil lipídico completo', 'glicemia de jejum', 'hemoglobina glicada', 'creatinina', 'potássio',
    ])
  })

  it('creatinina e potássio contam como feitos pelas medidas do laudo de "função renal"', () => {
    const d01 = DEMO_MARCOS.find((e) => e.id === 'd01')!
    const d04 = DEMO_MARCOS.find((e) => e.id === 'd04')!
    expect(pendencias([d01, d04]).filter((p) => p.tipo === 'pedido').map((p) => p.alvo))
      .toEqual(['MAPA de 24 horas', 'perfil lipídico completo'])
  })

  it('retorno em 60 dias da cardiologia: o MAPA feito depois não é o retorno; sem consulta de cardiologia, fica pendente', () => {
    const [cardio] = pendencias(DEMO_MARCOS).filter((p) => p.tipo === 'retorno' && p.ancoras.includes('d01'))
    expect(cardio.descricao).toMatch(/^Retorno em Cardiologia previsto para 10\/2024 sem consulta posterior registrada/)
  })

  it('retorno ainda dentro do prazo + tolerância não é pendência; vencido é', () => {
    const d08 = DEMO_MARCOS.find((e) => e.id === 'd08')!
    const retorno = (hoje: string) => pendencias([d08], hoje).filter((p) => p.tipo === 'retorno')
    expect(retorno('2026-04-01')).toEqual([])
    expect(retorno('2026-06-01')).toEqual([])
    expect(retorno('2026-06-10')).toHaveLength(1)
  })

  it('consulta posterior da mesma especialidade resolve o retorno', () => {
    const d08 = DEMO_MARCOS.find((e) => e.id === 'd08')!
    const volta = { ...d08, id: 'x1', data: '2026-05-20', resumo: 'Consulta de retorno: asma controlada.' }
    expect(pendencias([d08, volta]).filter((p) => p.tipo === 'retorno' && p.ancoras.includes('d08'))).toEqual([])
  })
})

/* Evento gravado em produção (conta de teste do Marcos), com o resumo exato da extração. */
describe('derivarFatos — retorno vencido (evento real de produção)', () => {
  const HOJE = '2026-10-06'
  const SEGUIMENTO: Evento = {
    id: 'p08', data: '2025-11-04', tipo: 'consulta', titulo: 'Consulta de seguimento em Pneumologia',
    instituicao: 'Clínica Ipê-Roxo', fonte: 'paciente', especialidade: 'Pneumologia',
    resumo: 'A paciente apresenta asma parcialmente controlada, com baixa adesão à técnica inalatória. Foi substituída a budesonida isolada por budesonida 160 mcg + formoterol 4,5 mcg, 1 inalação 12/12 h. Foi solicitada nova espirometria com prova broncodilatadora e retorno em 6 meses.',
    sinal: 'alterado', tags: ['asma'], origem: 'OCR + IA',
  }
  /* Receita de clínica médica que cita o retorno com a pneumologia (resumo devolvido pela OCI). */
  const RECEITA: Evento = {
    id: 'p12', data: '2026-09-03', tipo: 'medicacao', titulo: 'Receita renovada', instituicao: 'Clínica Ipê-Roxo',
    fonte: 'paciente', especialidade: 'Clínica Médica', sinal: 'info', tags: [], origem: 'OCR + IA',
    resumo: 'Receita renovada para uso contínuo com losartana potássica 50 mg, budesonida 160 mcg + formoterol 4,5 mcg e salbutamol 100 mcg. Retorno com a pneumologia se precisar do salbutamol mais de 2 vezes por semana.',
  }
  const retornos = (eventos: Evento[], hoje = HOJE) =>
    derivarFatos(eventos, hoje).pendencias.filter((p) => p.tipo === 'retorno')
  const consulta = (id: string, data: string, especialidade = 'Pneumologia'): Evento =>
    ({ ...SEGUIMENTO, id, data, especialidade, titulo: 'Consulta', resumo: 'Asma controlada.' })

  it('retorno em 6 meses sem consulta posterior vira pendência "previsto para 05/2026"', () => {
    const d05 = DEMO_MARCOS.find((e) => e.id === 'd05')!
    const lista = retornos([d05, SEGUIMENTO, RECEITA])
    expect(lista.map((p) => [p.alvo, p.ancoras])).toEqual([['Pneumologia', ['p08']]])
    expect(lista[0].descricao).toMatch(/^Retorno em Pneumologia previsto para 05\/2026 sem consulta posterior registrada\./)
    expect(lista[0].descricao).toMatch(/04\/11\/2025.*retorno em 6 meses/)
  })

  it('receita que só cita o retorno com outra especialidade não gera pendência de retorno', () => {
    expect(retornos([RECEITA])).toEqual([])
  })

  it('exame posterior da mesma especialidade não é o retorno', () => {
    const espirometria = { ...DEMO_MARCOS.find((e) => e.id === 'd05')!, id: 'x2', data: '2026-06-20' }
    const { pendencias } = derivarFatos([SEGUIMENTO, espirometria], HOJE)
    expect(pendencias.map((p) => p.tipo)).toEqual(['retorno'])
  })

  it('consulta da mesma especialidade (grafia normalizada) a partir de previsto − tolerância resolve', () => {
    expect(retornos([SEGUIMENTO, consulta('x3', '2026-04-20', ' pneumologia ')])).toEqual([])
    expect(retornos([SEGUIMENTO, consulta('x4', '2026-01-10')])).toHaveLength(1)
    expect(retornos([SEGUIMENTO, consulta('x5', '2026-05-20', 'Cardiologia')])).toHaveLength(1)
  })
})

describe('pontosEmAberto', () => {
  it('no seed: o Doppler repetido e as duas pendências, em texto descritivo e com as âncoras dos fatos', () => {
    const pontos = pontosEmAberto(derivarFatos(EVENTOS, '2026-09-01'))
    expect(pontos.map(({ tipo, ancoras }) => ({ tipo, ancoras }))).toEqual([
      { tipo: 'repeticao', ancoras: ['e22', 'e24'] },
      { tipo: 'retorno', ancoras: ['e14'] },
      { tipo: 'reavaliacao', ancoras: ['e16', 'e15'] },
    ])
    expect(pontos[0].texto).toBe('Possível exame repetido: pedido de ultrassom de carótidas em 08/07/2026 (UBS Vila Mariana), 42 dias depois de "Ultrassom Doppler de carótidas" realizado em 27/05/2026 (Instituto de Imagem Anhangá).')
    expect(pontos[2].texto).toContain('Reavaliação de TSH pedida em 10/02/2025')
    /* O profissional lê fatos, não ordens ao paciente. */
    for (const { texto } of pontos) expect(texto).not.toMatch(/^(Levar|Fazer|Repetir|Retomar|Agendar)/)
  })

  it('histórico sem fatos não tem pontos em aberto', () => {
    expect(pontosEmAberto(derivarFatos([]))).toEqual([])
  })
})
