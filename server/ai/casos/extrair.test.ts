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

const PEDIDO = `Clínica Ipê-Roxo
Paciente: Marcos Vinícius Teixeira Registro: FIC-0044-1982
Nascimento: 14/02/1982 (44 anos) Sexo: Masculino
Data da solicitação: 02/04/2026 Solicitante: Dra. Beatriz N. Sallum
PEDIDO MÉDICO DE EXAMES
40301397 Perfil lipídico — colesterol total, HDL, LDL e triglicerídeos 1`

describe('extrairEvento — data', () => {
  it('modelo sem data: usa a data impressa no documento (não a de nascimento), com aviso para conferir', async () => {
    const { llm } = llmFixo(bruto([], { data: null, tipo: 'documento', titulo: 'Pedido de perfil lipídico' }))
    const { evento, avisos } = await extrairEvento({ llm }, { texto: PEDIDO })
    expect(evento.data).toBe('2026-04-02')
    expect(avisos.join(' ')).toMatch(/data .*documento.*confira/i)
    expect(avisos.join(' ')).not.toMatch(/data de hoje/)
  })

  it('sem data alguma no texto, segue usando hoje com o aviso', async () => {
    const { llm } = llmFixo(bruto([], { data: null }))
    const { avisos } = await extrairEvento({ llm }, { texto: 'Laudo sem data. Paciente: Fulano. Exame normal.' })
    expect(avisos.join(' ')).toMatch(/data de hoje/)
  })

  it('o prompt pede a data da solicitação ou emissão para pedidos e receitas', async () => {
    const { llm, recebidas } = llmFixo(bruto([]))
    await extrairEvento({ llm }, { texto: PEDIDO })
    expect(instrucoes(recebidas)).toMatch(/"data":[^\n]*solicitação/)
  })
})

describe('extrairEvento — tipo', () => {
  it('o prompt define cada tipo, para radiografia não virar "exame" nem receita virar "consulta"', async () => {
    const { llm, recebidas } = llmFixo(bruto([]))
    await extrairEvento({ llm }, { texto: PEDIDO })
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
    await extrairEvento({ llm }, { texto: PEDIDO })
    const prompt = instrucoes(recebidas)
    expect(prompt).toMatch(/"titulo":[^\n]*pedido[^\n]*"Pedido de perfil lipídico"/i)
    expect(prompt).toMatch(/"titulo":[^\n]*nunca[^\n]*"Pedido de exame"/i)
    expect(prompt).toMatch(/"resumo":[^\n]*exames? pedidos?/i)
  })
})
