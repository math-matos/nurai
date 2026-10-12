import { describe, expect, it } from 'vitest'
import { criarRepoMemoria } from '../db/memoria.js'
import type { LlmProvider, MensagemLlm } from './provider.js'
import { responderCopiloto } from './casos/copiloto.js'
import { explicarExame } from './casos/explicar.js'
import { gerarPassos } from './casos/passos.js'
import { gerarResumo } from './casos/resumo.js'
import { criarLlmMock } from './mock.js'
import { descreverPerfil, SISTEMA } from './prompts.js'
import { instrucaoDeVoz, naVozDoResponsavel } from './voz.js'

const RESPONSAVEL = { nome: 'Rafael Lima', relacao: 'filho' }
const CUIDADOR = { nome: 'Marcos Vinícius Teixeira', responsavel: RESPONSAVEL }
const TITULAR = { nome: 'Marcos Vinícius Teixeira' }

describe('naVozDoResponsavel', () => {
  it.each([
    ['Seu histórico ainda está vazio.', 'O histórico de Marcos ainda está vazio.'],
    ['Não encontrei no seu histórico registros que sustentem uma resposta.', 'Não encontrei no histórico de Marcos registros que sustentem uma resposta.'],
    ['Mas você já realizou um perfil lipídico em 12/03/2026.', 'Mas Marcos já realizou um perfil lipídico em 12/03/2026.'],
    ['Você tem registros de 2019 a 2026.', 'Marcos tem registros de 2019 a 2026.'],
    ['Confirme com o seu médico ou com a equipe que acompanha você.', 'Confirme com o médico de Marcos ou com a equipe que acompanha Marcos.'],
    ['Nos seus registros, a TFG foi 85.', 'Nos registros de Marcos, a TFG foi 85.'],
    ['Sua hemoglobina glicada subiu.', 'A hemoglobina glicada de Marcos subiu.'],
    ['Como minha glicada evoluiu?', 'Como a glicada de Marcos evoluiu?'],
    ['O que significa isso no meu caso?', 'O que significa isso no caso de Marcos?'],
    ['Está em seus exames de 2025.', 'Está nos exames de Marcos de 2025.'],
  ])('"%s" → "%s"', (antes, depois) => {
    expect(naVozDoResponsavel(antes, CUIDADOR)).toBe(depois)
  })

  it('não mexe no que é dito ao próprio responsável nem em texto sem responsável', () => {
    expect(naVozDoResponsavel('Você pode levar o laudo à consulta.', CUIDADOR)).toBe('Você pode levar o laudo à consulta.')
    expect(naVozDoResponsavel('Seu histórico ainda está vazio.', TITULAR)).toBe('Seu histórico ainda está vazio.')
  })

  it('a instrução do prompt só existe com responsável e manda a 3ª pessoa pelo primeiro nome', () => {
    expect(instrucaoDeVoz(TITULAR)).toBe('')
    expect(instrucaoDeVoz(CUIDADOR)).toMatch(/Rafael Lima \(filho de Marcos\).*Refira-se a Marcos na 3ª pessoa/)
    expect(descreverPerfil({ condicoes: [], alergias: [], ...CUIDADOR })).toContain('Refira-se a Marcos na 3ª pessoa')
    expect(descreverPerfil({ condicoes: [], alergias: [], ...TITULAR })).not.toContain('3ª pessoa')
    expect(SISTEMA).toMatch(/regra de voz do Perfil/)
  })
})

/* O perfil vem do repositório (montarPerfil), como chega às rotas pela sessão. */
async function contexto(llm: LlmProvider, comResponsavel: boolean, modo: 'exemplo' | 'vazio' = 'exemplo') {
  const raiz = criarRepoMemoria()
  const { pacienteId } = await raiz.criarPaciente({
    nome: 'Marcos Vinícius Teixeira', convidado: false, ...(comResponsavel && { responsavel: RESPONSAVEL }),
  })
  const perfil = (await raiz.aplicarOnboarding(pacienteId, modo))!
  return { repo: raiz.paraPaciente(pacienteId), llm, perfil }
}

function llmFixo(resposta: unknown) {
  const chamadas: MensagemLlm[][] = []
  const llm: LlmProvider = { nome: 'oci', chat: async (m) => { chamadas.push(m); return JSON.stringify(resposta) } }
  return { llm, chamadas }
}

describe('casos de IA no modo cuidador', () => {
  it('copiloto: o histórico vazio e a resposta do modelo falam de Marcos na 3ª pessoa', async () => {
    const vazio = await responderCopiloto(await contexto(criarLlmMock(), true, 'vazio'), { pergunta: 'Como está a glicada?' })
    expect(vazio.texto[0]).toMatch(/^O histórico de Marcos ainda está vazio\./)
    const titular = await responderCopiloto(await contexto(criarLlmMock(), false, 'vazio'), { pergunta: 'Como está a glicada?' })
    expect(titular.texto[0]).toMatch(/^Seu histórico ainda está vazio\./)

    const { llm, chamadas } = llmFixo({ texto: ['Você já realizou o exame de 14/09/2025 e sua glicada subiu.'], ancoras: ['e18'], serie: null, aviso: null })
    const r = await responderCopiloto(await contexto(llm, true), { pergunta: 'Posso parar a metformina?' })
    expect(chamadas[0].map((m) => m.content).join('\n')).toContain('Refira-se a Marcos na 3ª pessoa')
    expect(r.texto).toEqual(['Marcos já realizou o exame de 14/09/2025 e a glicada de Marcos subiu.'])
    expect(r.aviso).toBe('Qualquer decisão sobre remédios ou tratamento deve ser confirmada com o médico de Marcos ou com a equipe que acompanha Marcos.')
  })

  it('resumo: aviso, perguntas e síntese em 3ª pessoa; os pontos em aberto ficam como o médico os vê', async () => {
    const r = await gerarResumo(await contexto(criarLlmMock(), true), 'Cardiologia')
    expect(r.aviso).toMatch(/registros do histórico de Marcos/)
    expect(r.perguntasSugeridas[0]).toBe('O que mudou no acompanhamento de Marcos desde a última consulta?')
    const tudo = [...r.sintese, ...r.pontos.map((p) => p.texto), ...r.perguntasSugeridas, r.aviso].join(' ')
    expect(tudo).not.toMatch(/\b(?:seu|sua|seus|suas|meu|minha)\s+(?:histórico|registros?|exames?|acompanhamento|médic)/i)
    const titular = await gerarResumo(await contexto(criarLlmMock(), false), 'Cardiologia')
    expect(titular.aviso).toMatch(/registros do seu histórico/)
    expect(r.pontosEmAberto).toEqual(titular.pontosEmAberto)
  })

  it('explicar: com o perfil, a explicação, as perguntas e o aviso falam de Marcos', async () => {
    const ctx = await contexto(criarLlmMock(), true)
    const r = (await explicarExame(ctx, 'e21'))!
    expect(r.aviso).toBe('Esta explicação organiza o que está no histórico de Marcos e não substitui a avaliação do médico de Marcos.')
    expect(r.perguntasParaMedico.join(' ')).not.toMatch(/\bmeu\b/)

    const { llm, chamadas } = llmFixo({ explicacao: ['Seu exame mostra a TFG.'], pontosDeAtencao: [], perguntasParaMedico: ['Isso muda meu tratamento?'], ancoras: ['e21'] })
    const ia = (await explicarExame({ ...ctx, llm }, 'e21'))!
    expect(chamadas[0].map((m) => m.content).join('\n')).toContain('Refira-se a Marcos na 3ª pessoa')
    expect(ia.perguntasParaMedico).toEqual(['Isso muda o tratamento de Marcos?'])
  })

  it('passos: o prompt leva a regra de voz', async () => {
    const { llm, chamadas } = llmFixo({ passos: [] })
    await gerarPassos(await contexto(llm, true)).catch(() => undefined)
    expect(chamadas[0].map((m) => m.content).join('\n')).toContain('Refira-se a Marcos na 3ª pessoa')
  })
})
