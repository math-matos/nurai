import { describe, expect, it } from 'vitest'
import type { MensagemLlm } from '../provider.js'
import { type ExtracaoBruta, extrairEvento, montarEvento } from './extrair.js'

type Clinica = Extract<ExtracaoBruta, { clinico: true }>
type MedidaBruta = Clinica['medidas'][number]

const bruto = (medidas: MedidaBruta[], extra: Partial<Clinica> = {}): Clinica => ({
  clinico: true, data: '2026-08-18', tipo: 'exame', titulo: 'Perfil lipídico', instituicao: 'Laboratório Vetor',
  especialidade: null, resumo: 'Perfil lipídico.', medidas, tags: [], confianca: 0.9, avisos: [], ...extra,
})
const m = (nome: string, valor: number, refMin: number | null, refMax: number | null): MedidaBruta =>
  ({ nome, valor, unidade: 'mg/dL', refMin, refMax })

describe('montarEvento — faixas de referência', () => {
  it('"< X" (só teto) guarda só o teto, sem inventar piso 0', () => {
    const { evento, avisos } = montarEvento(bruto([m('Colesterol total', 212, null, 190), m('Colesterol HDL', 44, 45, 90)]))
    expect(evento.medidas).toEqual([
      { nome: 'Colesterol total', valor: 212, unidade: 'mg/dL', refMax: 190, sinal: 'alterado' },
      { nome: 'Colesterol HDL', valor: 44, unidade: 'mg/dL', refMin: 45, refMax: 90, sinal: 'alterado' },
    ])
    expect(evento.medidas![0]).not.toHaveProperty('refMin')
    expect(avisos).toEqual([])
    expect(evento.confianca).toBe(0.9)
  })

  it('"> 40" (só piso) mantém a medida com refMin e o sinal pelo piso, sem aviso nem penalidade', () => {
    const { evento, avisos } = montarEvento(bruto([m('Colesterol HDL', 38, 40, null), m('HDL de controle', 52, 40, null)]))
    expect(evento.medidas).toEqual([
      { nome: 'Colesterol HDL', valor: 38, unidade: 'mg/dL', refMin: 40, sinal: 'alterado' },
      { nome: 'HDL de controle', valor: 52, unidade: 'mg/dL', refMin: 40, sinal: 'normal' },
    ])
    expect(evento.medidas![0]).not.toHaveProperty('refMax')
    expect(evento.sinal).toBe('alterado')
    expect(avisos).toEqual([])
    expect(evento.confianca).toBe(0.9)
  })

  it('"≥ 0,70" e LIN da espirometria: o valor no limite é normal, abaixo é alterado', () => {
    const espiro = (nome: string, valor: number, refMin: number) => ({ nome, valor, unidade: '% do previsto', refMin, refMax: null })
    const { evento, avisos } = montarEvento(bruto([
      { nome: 'VEF1/CVF', valor: 0.72, unidade: '', refMin: 0.7, refMax: null },
      { nome: 'VEF1/CVF no limite', valor: 0.7, unidade: '', refMin: 0.7, refMax: null },
      espiro('VEF1', 78, 80),
      espiro('CVF', 88, 80),
    ], { tipo: 'exame', titulo: 'Espirometria' }))
    expect(evento.medidas!.map((x) => [x.nome, x.refMin, x.refMax, x.sinal])).toEqual([
      ['VEF1/CVF', 0.7, undefined, 'normal'],
      ['VEF1/CVF no limite', 0.7, undefined, 'normal'],
      ['VEF1', 80, undefined, 'alterado'],
      ['CVF', 80, undefined, 'normal'],
    ])
    expect(avisos.join(' ')).not.toMatch(/omitida|limite inferior/)
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

/* Modelo falso que devolve sempre a mesma extração e guarda o prompt que recebeu. */
/* Só as instruções: o documento enviado fica de fora, para não casar com o texto dele. */
const instrucoes = (recebidas: MensagemLlm[][]) => recebidas[0].map((m) => m.content.split('Documento:')[0]).join('\n')

function llmFixo(resposta: Clinica) {
  const recebidas: MensagemLlm[][] = []
  return {
    recebidas,
    llm: { nome: 'oci' as const, chat: async (mensagens: MensagemLlm[]) => { recebidas.push(mensagens); return JSON.stringify(resposta) } },
  }
}

const MARCOS = { nome: 'Marcos Vinícius Teixeira' }

const PEDIDO = `Clínica Ipê-Roxo
Paciente: Marcos Vinícius Teixeira Registro: FIC-0044-1982
Nascimento: 14/02/1982 (44 anos) Sexo: Masculino
Data da solicitação: 02/04/2026 Solicitante: Dra. Beatriz N. Sallum
PEDIDO MÉDICO DE EXAMES
40301397 Perfil lipídico — colesterol total, HDL, LDL e triglicerídeos 1`

describe('extrairEvento — data', () => {
  it('modelo sem data: usa a data impressa no documento (não a de nascimento), com aviso para conferir', async () => {
    const { llm } = llmFixo(bruto([], { data: null, tipo: 'documento', titulo: 'Pedido de perfil lipídico' }))
    const { evento, avisos } = await extrairEvento({ llm, perfil: MARCOS }, { texto: PEDIDO })
    expect(evento.data).toBe('2026-04-02')
    expect(avisos.join(' ')).toMatch(/data .*documento.*confira/i)
    expect(avisos.join(' ')).not.toMatch(/data de hoje/)
  })

  it('sem data alguma no texto, segue usando hoje com o aviso', async () => {
    const { llm } = llmFixo(bruto([], { data: null }))
    const { avisos } = await extrairEvento({ llm, perfil: MARCOS }, { texto: 'Laudo sem data. Paciente: Fulano. Exame normal.' })
    expect(avisos.join(' ')).toMatch(/data de hoje/)
  })

  it('o prompt pede a data da solicitação ou emissão para pedidos e receitas', async () => {
    const { llm, recebidas } = llmFixo(bruto([]))
    await extrairEvento({ llm, perfil: MARCOS }, { texto: PEDIDO })
    expect(instrucoes(recebidas)).toMatch(/"data":[^\n]*solicitação/)
  })

  it('o prompt prefere a data da coleta à da emissão do laudo', async () => {
    const { llm, recebidas } = llmFixo(bruto([]))
    await extrairEvento({ llm, perfil: MARCOS }, { texto: PEDIDO })
    expect(instrucoes(recebidas)).toMatch(/"data":[^\n]*coleta[^\n]*antes da[^\n]*emissão/)
  })
})

describe('extrairEvento — tipo', () => {
  it('o prompt define cada tipo, para radiografia não virar "exame" nem receita virar "consulta"', async () => {
    const { llm, recebidas } = llmFixo(bruto([]))
    await extrairEvento({ llm, perfil: MARCOS }, { texto: PEDIDO })
    const prompt = instrucoes(recebidas)
    for (const tipo of ['exame', 'consulta', 'imagem', 'cirurgia', 'medicacao', 'internacao', 'vacina', 'documento']) {
      expect(prompt, tipo).toMatch(new RegExp(`- "${tipo}": `))
    }
    expect(prompt).toMatch(/"imagem": [^\n]*radiografia/)
    expect(prompt).toMatch(/"medicacao": [^\n]*receita/)
  })
})

describe('extrairEvento — título de pedido', () => {
  it('o prompt manda nomear o exame pedido no título e no resumo de pedidos e guias', async () => {
    const { llm, recebidas } = llmFixo(bruto([]))
    await extrairEvento({ llm, perfil: MARCOS }, { texto: PEDIDO })
    const prompt = instrucoes(recebidas)
    expect(prompt).toMatch(/"titulo":[^\n]*pedido[^\n]*"Pedido de perfil lipídico"/i)
    expect(prompt).toMatch(/"titulo":[^\n]*nunca[^\n]*"Pedido de exame"/i)
    expect(prompt).toMatch(/"resumo":[^\n]*exames? pedidos?/i)
  })
})

describe('extrairEvento — faixas unilaterais no prompt', () => {
  it('o prompt manda guardar só o piso em "> X", "≥ X" e LIN, e a espirometria em % do previsto', async () => {
    const { llm, recebidas } = llmFixo(bruto([]))
    await extrairEvento({ llm, perfil: MARCOS }, { texto: PEDIDO })
    const prompt = instrucoes(recebidas)
    expect(prompt).toMatch(/só com piso \("> X", "≥ X"[^\n]*LIN[^\n]*refMin X e refMax null/)
    expect(prompt).toMatch(/% do previsto/)
  })
})

describe('extrairEvento — paciente do documento', () => {
  it('o prompt pede o nome do paciente impresso, nunca o do médico', async () => {
    const { llm, recebidas } = llmFixo(bruto([]))
    await extrairEvento({ llm, perfil: MARCOS }, { texto: PEDIDO })
    expect(instrucoes(recebidas)).toMatch(/"pacienteNoDocumento":[^\n]*Nunca o nome do médico/)
  })

  it('nome do documento diferente do titular gera alerta PACIENTE_DIVERGENTE com os dois nomes', async () => {
    const { llm } = llmFixo(bruto([], { pacienteNoDocumento: 'Marcos Vinícius Teixeira' }))
    const r = await extrairEvento({ llm, perfil: { nome: 'Thiago Matumoto' } }, { texto: PEDIDO })
    expect(r.pacienteNoDocumento).toBe('Marcos Vinícius Teixeira')
    expect(r.alertas).toEqual([{
      codigo: 'PACIENTE_DIVERGENTE',
      texto: expect.stringMatching(/^Este documento parece ser de Marcos Vinícius Teixeira, não de Thiago Matumoto/),
    }])
    expect(r.evento).not.toHaveProperty('pacienteNoDocumento')
  })

  it.each([
    ['Marcos Vinícius Teixeira', 'Marcos Vinícius Teixeira'],
    ['MARCOS VINICIUS TEIXEIRA', 'Marcos Vinícius Teixeira'],
    ['Marcos Teixeira', 'Marcos Vinícius Teixeira'],
    ['Marcos V. Teixeira', 'Marcos Vinícius Teixeira'],
    ['Marcos Vinícius', 'Marcos Vinícius Teixeira'],
    ['Marcos', 'Marcos Vinícius Teixeira'],
    ['Maria da Silva', 'Maria Silva'],
  ])('"%s" no documento é o titular "%s": sem alerta', async (impresso, titular) => {
    const { llm } = llmFixo(bruto([], { pacienteNoDocumento: impresso }))
    expect((await extrairEvento({ llm, perfil: { nome: titular } }, { texto: PEDIDO })).alertas).toEqual([])
  })

  it.each([
    ['Marcos Silva', 'Marcos Vinícius Teixeira'],
    ['Helena Duarte Nogueira', 'Paciente E2E'],
    ['Ana Teixeira', 'Marcos Teixeira'],
  ])('"%s" no documento não é "%s": alerta', async (impresso, titular) => {
    const { llm } = llmFixo(bruto([], { pacienteNoDocumento: impresso }))
    expect((await extrairEvento({ llm, perfil: { nome: titular } }, { texto: PEDIDO })).alertas).toHaveLength(1)
  })

  it('documento sem nome de paciente: sem alerta e sem pacienteNoDocumento', async () => {
    const { llm } = llmFixo(bruto([], { pacienteNoDocumento: null }))
    const r = await extrairEvento({ llm, perfil: { nome: 'Thiago Matumoto' } }, { texto: PEDIDO })
    expect(r.alertas).toEqual([])
    expect(r).not.toHaveProperty('pacienteNoDocumento')
  })

  it('modo demonstração lê "Paciente:" do texto e compara do mesmo jeito', async () => {
    const mock = { nome: 'mock' as const, chat: async () => '' }
    const texto = `${PEDIDO}\nGlicemia de jejum      96 mg/dL     70 a 99`
    const outro = await extrairEvento({ llm: mock, perfil: { nome: 'Paciente E2E' } }, { texto })
    expect(outro.pacienteNoDocumento).toBe('Marcos Vinícius Teixeira')
    expect(outro.alertas.map((a) => a.codigo)).toEqual(['PACIENTE_DIVERGENTE'])
    expect((await extrairEvento({ llm: mock, perfil: MARCOS }, { texto })).alertas).toEqual([])
  })
})
