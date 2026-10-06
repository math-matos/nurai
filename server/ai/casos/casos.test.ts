import { describe, expect, it } from 'vitest'
import { EVENTOS } from '../../../src/data/seed.js'
import { PERFIL_DEMO } from '../../db/exemplo.js'
import { criarRepoMemoria } from '../../db/memoria.js'
import { DEMO_MARCOS } from '../../teste/demo-marcos.js'
import { AVISO_MEDICO } from '../guardrails.js'
import { criarLlmMock } from '../mock.js'
import { descreverPerfil, serializarEvento } from '../prompts.js'
import type { LlmProvider, MensagemLlm } from '../provider.js'
import { HISTORICO_VAZIO, responderCopiloto } from './copiloto.js'
import { explicarExame } from './explicar.js'
import { gerarPassos } from './passos.js'
import { gerarResumo } from './resumo.js'

async function deps(resposta: unknown, modo: 'exemplo' | 'vazio' = 'exemplo') {
  const chamadas: MensagemLlm[][] = []
  const llm: LlmProvider = {
    nome: 'oci',
    async chat(mensagens) {
      chamadas.push(mensagens)
      return JSON.stringify(resposta)
    },
  }
  const raiz = criarRepoMemoria()
  const { pacienteId } = await raiz.criarPaciente(PERFIL_DEMO)
  const perfil = (await raiz.aplicarOnboarding(pacienteId, modo))!
  return { deps: { repo: raiz.paraPaciente(pacienteId), llm, perfil }, chamadas }
}
const prompt = (chamadas: MensagemLlm[][]) => chamadas[0].map((m) => m.content).join('\n')

describe('serializarEvento', () => {
  it('usa data dd/mm/aaaa, vírgula decimal e inclui as tags', () => {
    const texto = serializarEvento(EVENTOS.find((e) => e.id === 'e02')!)
    expect(texto).toContain('[e02] 02/04/2019')
    expect(texto).toContain('= 7,8 %')
    expect(texto).toContain('Tags: diabetes, hba1c')
    expect(texto).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })
})

describe('responderCopiloto', () => {
  const resposta = { texto: ['Em 2019-04-02 [e02] a glicada era 7.8% (e02).'], ancoras: ['e02'], serie: null, aviso: null }

  it('envia os fatos derivados e limpa ids, datas ISO e ponto decimal do texto', async () => {
    const { deps: d, chamadas } = await deps(resposta)
    const r = await responderCopiloto(d, { pergunta: 'Qual era minha glicada em 2019?' })
    expect(r.texto).toEqual(['Em 02/04/2019 a glicada era 7,8%.'])
    expect(prompt(chamadas)).toContain('FATOS DERIVADOS')
    expect(prompt(chamadas)).toMatch(/\(e22, e24\)/)
  })

  it('monta a série pela medida citada na pergunta mesmo se o modelo não pedir', async () => {
    const { deps: d } = await deps(resposta)
    const r = await responderCopiloto(d, { pergunta: 'Como minha glicada evoluiu?' })
    expect(r.serie?.nome).toBe('Hemoglobina glicada (HbA1c)')
    expect(r.serie?.pontos).toHaveLength(5)
  })

  it('reconhece outras medidas pelo nome popular', async () => {
    const { deps: d } = await deps(resposta)
    const r = await responderCopiloto(d, { pergunta: 'E o meu colesterol?' })
    expect(r.serie?.nome).toBe('Colesterol LDL')
  })

  /* Shape real da extração dos laudos de LDL: o nome muda de laudo para laudo. A mesma pergunta
     devolvia gráfico numa vez e não na outra, conforme o modelo preenchia "serie". */
  it('série de LDL é determinística com nomes de laudo diferentes, com ou sem "serie" do modelo', async () => {
    const ldl = (id: string, data: string, nome: string, valor: number) => ({
      id, data, tipo: 'exame' as const, titulo: 'Perfil lipídico', instituicao: 'Laboratório Quaresmeira', fonte: 'paciente' as const,
      resumo: 'Perfil lipídico.', sinal: 'alterado' as const, tags: [], origem: 'OCR + IA' as const,
      medidas: [{ nome, valor, unidade: 'mg/dL', refMax: 130, sinal: valor > 130 ? 'alterado' as const : 'normal' as const }],
    })
    const pergunta = 'Como meu colesterol LDL evoluiu?'
    for (const serieDoModelo of [null, { medida: 'LDL-colesterol' }, { medida: 'Colesterol LDL' }]) {
      const { deps: d } = await deps({ texto: ['Seu LDL caiu.'], ancoras: ['d03'], serie: serieDoModelo, aviso: null }, 'vazio')
      await d.repo.adicionarEvento(ldl('d03', '2024-09-05', 'LDL-colesterol', 168), 'Marcos')
      await d.repo.adicionarEvento(ldl('d07', '2025-09-18', 'Colesterol LDL', 142), 'Marcos')
      await d.repo.adicionarEvento(ldl('d12', '2026-03-12', 'LDL-colesterol (Martin/Hopkins)', 138), 'Marcos')
      const r = await responderCopiloto(d, { pergunta })
      expect(r.serie, JSON.stringify(serieDoModelo)).toEqual({
        nome: 'Colesterol LDL', unidade: 'mg/dL',
        pontos: [{ data: '09/2024', valor: 168 }, { data: '09/2025', valor: 142 }, { data: '03/2026', valor: 138 }],
      })
    }
  })

  it('não deixa passar "sem alterações" quando a série dos registros mudou (TFG 101 → 85)', async () => {
    const tfg = (id: string, data: string, valor: number) => ({
      id, data, tipo: 'exame' as const, titulo: 'Função renal', instituicao: 'Laboratório Quaresmeira', fonte: 'paciente' as const,
      resumo: 'Função renal.', sinal: 'normal' as const, tags: [], origem: 'OCR + IA' as const,
      medidas: [{ nome: 'Taxa de filtração glomerular estimada (TFG)', valor, unidade: 'mL/min/1,73 m²', refMin: 90, sinal: valor < 90 ? 'alterado' as const : 'normal' as const }],
    })
    const { deps: d, chamadas } = await deps({
      texto: ['A sua TFG foi de 94.4 mL/min/1,73 m² em 20/01/2025 e não há registros de alterações subsequentes.'],
      ancoras: ['d04'], serie: null, aviso: null,
    }, 'vazio')
    await d.repo.adicionarEvento(tfg('d04', '2025-01-20', 101), 'Marcos')
    await d.repo.adicionarEvento(tfg('d10', '2026-05-15', 85), 'Marcos')
    const r = await responderCopiloto(d, { pergunta: 'Como está minha função renal?' })
    expect(prompt(chamadas)).toMatch(/Taxa de filtração glomerular \(mL\/min\/1,73 m²\): 101 em 20\/01\/2025 \(d04\); 85 em 15\/05\/2026 \(d10\), caiu/)
    expect(prompt(chamadas)).toMatch(/nunca que "não houve alteração"/)
    expect(r.texto.join(' ')).not.toMatch(/alteraç/)
    expect(r.texto.at(-1)).toBe('Nos seus registros, Taxa de filtração glomerular foi: 101 mL/min/1,73 m² em 01/2025; 85 mL/min/1,73 m² em 05/2026.')
    expect(r.serie?.pontos.map((p) => p.valor)).toEqual([101, 85])
  })

  it('"Não encontrei" mantém o aviso do médico quando a pergunta é sobre remédio', async () => {
    const { deps: d } = await deps({ texto: ['Não encontrei.'], ancoras: [], serie: null, aviso: null })
    const r = await responderCopiloto(d, { pergunta: 'Posso parar a rivaroxabana?' })
    expect(r.ancoras).toEqual([])
    expect(r.aviso).toBe(AVISO_MEDICO)
  })

  it('com âncoras, também insere o aviso padrão se o modelo esqueceu', async () => {
    const { deps: d } = await deps({ texto: ['Você usa rivaroxabana desde 2023.'], ancoras: ['e10'], serie: null, aviso: null })
    const r = await responderCopiloto(d, { pergunta: 'Posso parar a rivaroxabana?' })
    expect(r.aviso).toBe(AVISO_MEDICO)
  })
})

describe('responderCopiloto com o provider mock', () => {
  /* O motor determinístico responde sobre o histórico de exemplo; quem tem outro histórico não pode
     receber fatos de registros que não são dele. */
  async function depsMock(modo: 'exemplo' | 'vazio') {
    const raiz = criarRepoMemoria()
    const { pacienteId } = await raiz.criarPaciente({ nome: 'Marcos', convidado: false })
    const perfil = (await raiz.aplicarOnboarding(pacienteId, modo))!
    const repo = raiz.paraPaciente(pacienteId)
    if (modo === 'vazio') {
      await repo.adicionarEvento({
        id: 'u1', data: '2026-03-12', tipo: 'exame', titulo: 'Perfil lipídico', instituicao: 'Laboratório Quaresmeira',
        fonte: 'paciente', resumo: 'LDL 138 mg/dL.', sinal: 'alterado', tags: [], origem: 'OCR + IA',
      }, perfil.nome)
    }
    return { repo, perfil, llm: criarLlmMock() }
  }

  it('não cita registros do exemplo para quem não os tem', async () => {
    const r = await responderCopiloto(await depsMock('vazio'), { pergunta: 'Tem algum exame que eu não preciso repetir?' })
    expect(r.ancoras).toEqual([])
    expect(r.texto.join(' ')).not.toMatch(/carótidas|08\/07\/2026/)
    expect(r.texto).toEqual(['Não encontrei no seu histórico registros que sustentem uma resposta para isso.'])
  })

  it('aplica o aviso de remédio do servidor, como no provider real', async () => {
    const r = await responderCopiloto(await depsMock('vazio'), { pergunta: 'Posso parar de tomar a losartana?' })
    expect(r.aviso).toBe(AVISO_MEDICO)
  })

  it('no histórico de exemplo continua respondendo com as âncoras do exemplo', async () => {
    const r = await responderCopiloto(await depsMock('exemplo'), { pergunta: 'Tem algum exame que eu não preciso repetir?' })
    expect(r.ancoras).toEqual(['e22', 'e24'])
    expect(r.texto[0]).toMatch(/ultrassom de carótidas/)
    expect(r.aviso).toMatch(/Não cancele um exame/)
  })
})

describe('responderCopiloto — exame repetido por pedido avulso', () => {
  /* Shape que a extração real produziu para os PDFs 02 e 09 do Marcos. */
  async function comPedido(llm: LlmProvider) {
    const raiz = criarRepoMemoria()
    const { pacienteId } = await raiz.criarPaciente({ nome: 'Marcos', convidado: false })
    const perfil = (await raiz.aplicarOnboarding(pacienteId, 'vazio'))!
    const repo = raiz.paraPaciente(pacienteId)
    const comum = { fonte: 'paciente' as const, sinal: 'info' as const, tags: [], origem: 'OCR + IA' as const }
    await repo.adicionarEvento({
      ...comum, id: 'r02', data: '2026-03-12', tipo: 'exame', titulo: 'Perfil lipídico', instituicao: 'Laboratório Quaresmeira',
      resumo: 'Colesterol total, LDL e triglicerídeos acima do desejável.',
    }, perfil.nome)
    await repo.adicionarEvento({
      ...comum, id: 'r09', data: '2026-04-02', tipo: 'documento', titulo: 'Pedido de exame', instituicao: 'Clínica Ipê-Roxo',
      resumo: 'Pedido de exame de perfil lipídico para controle de dislipidemia.',
    }, perfil.nome)
    return { repo, perfil, llm }
  }
  const PERGUNTA = { pergunta: 'Tem algum exame que eu não preciso repetir?' }
  const naoEncontrei: LlmProvider = {
    nome: 'oci',
    chat: async () => JSON.stringify({ texto: ['Não encontrei nada repetido.'], ancoras: [], serie: null, aviso: null }),
  }

  it('no mock, responde pelos fatos citando o perfil feito e o pedido', async () => {
    const r = await responderCopiloto(await comPedido(criarLlmMock()), PERGUNTA)
    expect(r.ancoras).toEqual(['r02', 'r09'])
    expect(r.texto.join(' ')).toMatch(/Perfil lipídico.*12\/03\/2026.*02\/04\/2026.*21 dias/)
  })

  it('com o modelo dizendo que não encontrou, os fatos derivados respondem', async () => {
    const r = await responderCopiloto(await comPedido(naoEncontrei), PERGUNTA)
    expect(r.ancoras).toEqual(['r02', 'r09'])
    expect(r.geradoPor).toBe('oci')
  })

  it('pergunta que não é sobre repetição segue com o "não encontrei"', async () => {
    const r = await responderCopiloto(await comPedido(naoEncontrei), { pergunta: 'Tenho alergia a algo?' })
    expect(r.ancoras).toEqual([])
  })
})

describe('gerarResumo', () => {
  it('envia os fatos derivados, descarta conduta medicamentosa e limpa o texto', async () => {
    const { deps: d, chamadas } = await deps({
      sintese: ['Diabetes desde 2019 [e01].', 'Recomenda-se manter a metformina.'],
      pontos: [
        { texto: 'Glicada subiu para 7.4% em 2025-09-14.', ancoras: ['e18'] },
        { texto: 'Avaliar suspender a levotiroxina.', ancoras: ['e16'] },
      ],
      perguntasSugeridas: ['Devo manter a metformina?'],
    })
    const r = await gerarResumo(d, 'Endocrinologia')
    expect(prompt(chamadas)).toContain('FATOS DERIVADOS')
    expect(r.sintese).toEqual(['Diabetes desde 2019.'])
    expect(r.pontos).toEqual([{ texto: 'Glicada subiu para 7,4% em 14/09/2025.', ancoras: ['e18'] }])
    expect(r.perguntasSugeridas).toEqual(['Devo manter a metformina?'])
  })
})

describe('gerarPassos', () => {
  it('descarta passo de conduta e sem âncora, e limpa o texto', async () => {
    const { deps: d, chamadas } = await deps({
      passos: [
        { titulo: 'Levar o laudo do Doppler [e22]', porque: 'Feito em 2026-05-27.', ancoras: ['e22', 'e24'], prazo: 'Antes da data marcada', prioridade: 'alta' },
        { titulo: 'Confirmar com o médico sobre a manutenção da rivaroxabana', porque: 'Uso contínuo.', ancoras: ['e20'], prazo: 'Próxima consulta', prioridade: 'media' },
        { titulo: 'Sem base', porque: 'Inventado.', ancoras: [], prazo: 'Logo', prioridade: 'baixa' },
      ],
    })
    const { passos } = await gerarPassos(d)
    expect(prompt(chamadas)).toContain('FATOS DERIVADOS')
    /* O passo do modelo sobre a duplicidade dá lugar ao do servidor; conduta e passo sem âncora saem. */
    expect(passos.map((p) => p.titulo)).toEqual([
      'Levar o laudo de "Ultrassom Doppler de carótidas" de 27/05/2026 antes de refazer o exame',
      'Retomar o acompanhamento de oftalmologia',
      'Repetir o TSH — a reavaliação pedida não aparece no histórico',
    ])
    expect(passos.map((p) => p.porque).join(' ')).not.toMatch(/\[e\d+\]|\d{4}-\d{2}-\d{2}/)
  })
})

describe('gerarPassos — passos concretos', () => {
  const passo = (titulo: string, porque: string, ancoras: string[]) => ({ titulo, porque, ancoras, prazo: 'Próxima consulta', prioridade: 'media' })
  const repeticao = passo('Levar o laudo do Doppler', 'Feito em 27/05/2026 e pedido de novo em 08/07/2026.', ['e22', 'e24'])

  it('começa título e porque com maiúscula', async () => {
    const { deps: d } = await deps({ passos: [repeticao, passo('levar o hemograma', 'o exame de 05/03/2026 trouxe creatinina de 1.1 mg/dL.', ['e21'])] })
    const { passos } = await gerarPassos(d)
    expect(passos.at(-1)).toMatchObject({ titulo: 'Levar o hemograma', porque: 'O exame de 05/03/2026 trouxe creatinina de 1,1 mg/dL.' })
  })

  it('descarta passo genérico que não diz qual valor ou achado, e mantém o que cita a medida', async () => {
    const { deps: d } = await deps({
      passos: [
        repeticao,
        passo('Discutir com o médico os resultados do hemograma', 'o exame de hemograma completo de 05/03/2026 apresentou alterações.', ['e21']),
        passo('Mostrar a filtração glomerular ao nefrologista', 'A taxa de filtração glomerular caiu no exame de 05/03/2026.', ['e21']),
      ],
    })
    const { passos } = await gerarPassos(d)
    expect(passos.map((p) => p.titulo).slice(3)).toEqual(['Mostrar a filtração glomerular ao nefrologista'])
  })

  it('exame repetido dos fatos derivados vira passo mesmo se o modelo não o listar', async () => {
    const { deps: d } = await deps({ passos: [passo('Mostrar a creatinina', 'Creatinina de 1.1 mg/dL em 05/03/2026.', ['e21'])] })
    const { passos } = await gerarPassos(d)
    expect(passos[0].ancoras).toEqual(['e22', 'e24'])
    expect(passos[0].porque).toMatch(/27\/05\/2026.*08\/07\/2026/)
    expect(passos.map((p) => p.titulo)).toContain('Mostrar a creatinina')
  })

  it('o prompt exige o valor ou achado concreto e a data em cada passo', async () => {
    const { deps: d, chamadas } = await deps({ passos: [repeticao] })
    await gerarPassos(d)
    expect(prompt(chamadas)).toMatch(/"porque"[^\n]*valor[^\n]*data/i)
    expect(prompt(chamadas)).toMatch(/genéric/i)
  })
})

/* Histórico do Marcos no shape real da extração; os passos do "modelo" são os vistos em produção. */
describe('gerarPassos — histórico real do Marcos', () => {
  const passo = (titulo: string, porque: string, ancoras: string[], prioridade = 'media') => ({ titulo, porque, ancoras, prazo: 'Próxima consulta', prioridade })
  const DO_MODELO = [
    passo('Agendar o exame de perfil lipídico', 'O pedido foi feito em 02/04/2026, mas o exame já havia sido realizado em 12/03/2026, e não há registro de que tenha sido feito novamente.', ['f09']),
    passo('Agendar a ultrassonografia de abdome', 'Pedido de 22/07/2026; a ultrassonografia de 10/02/2026 mostrou esteatose leve.', ['d11', 'd09']),
    passo('Confirmar a dosagem de losartana e budesonida + formoterol com o médico', 'Budesonida + formoterol iniciada em 04/11/2025.', ['d08', 'd01'], 'alta'),
    passo('Levar a TFG de 85 ao nefrologista', 'TFG de 85 mL/min/1,73 m² em 15/05/2026, abaixo da referência de 90.', ['d10']),
  ]

  async function gerar() {
    const { deps: d } = await deps({ passos: DO_MODELO }, 'vazio')
    for (const e of DEMO_MARCOS) await d.repo.adicionarEvento(e, 'Marcos')
    return (await gerarPassos(d)).passos
  }

  it('duplicidades viram "levar o laudo antes de refazer"; nenhum passo manda agendar exame duplicado', async () => {
    const passos = await gerar()
    expect(passos.slice(0, 2).map((p) => [p.titulo, p.ancoras])).toEqual([
      ['Levar o laudo de "Perfil Lipídico" de 12/03/2026 antes de refazer o exame', ['f02', 'f09']],
      ['Levar o laudo de "Ultrassonografia de Abdome Total" de 10/02/2026 antes de refazer o exame', ['d09', 'd11']],
    ])
    expect(passos[0].porque).toMatch(/feito em 12\/03\/2026.*21 dias antes do novo pedido de perfil lipídico de 02\/04\/2026/)
    expect(passos.map((p) => p.titulo).join(' | ')).not.toMatch(/Agendar/)
  })

  it('copiloto: "ficou algo pendente?" com o modelo dizendo que não encontrou responde pelos fatos e cita a consulta de pneumologia', async () => {
    const { deps: d } = await deps({ texto: ['Não encontrei pendências no seu histórico.'], ancoras: [], serie: null, aviso: null }, 'vazio')
    for (const e of DEMO_MARCOS) await d.repo.adicionarEvento(e, 'Marcos')
    const r = await responderCopiloto(d, { pergunta: 'Ficou alguma coisa pendente no meu acompanhamento?' })
    expect(r.ancoras).toEqual(['d08'])
    expect(r.texto.join(' ')).toMatch(/nova espirometria com prova broncodilatadora em 04\/11\/2025/)
    expect(r.texto.join(' ')).toMatch(/Pneumologia.*retorno em 6 meses/)
  })

  it('pendências da consulta de pneumologia viram passos; "confirmar a dosagem" é barrado; o passo concreto do modelo fica', async () => {
    const passos = await gerar()
    expect(passos.slice(2).map((p) => [p.titulo, p.ancoras])).toEqual([
      ['Fazer o exame pedido: nova espirometria com prova broncodilatadora', ['d08']],
      ['Retomar o acompanhamento de pneumologia', ['d08']],
      ['Levar a TFG de 85 ao nefrologista', ['d10']],
    ])
    expect(passos[3].porque).toMatch(/retorno em 6 meses.*O prazo venceu em 03\/05\/2026/)
    expect(passos.map((p) => p.titulo).join(' | ')).not.toMatch(/dosagem/)
  })
})

describe('explicarExame', () => {
  it('limpa ids e formatos do texto', async () => {
    const { deps: d } = await deps({
      explicacao: ['A filtração caiu de 74 [e11] para 68 [e21].'],
      pontosDeAtencao: ['Creatinina 1.1 mg/dL em 2026-03-05.'],
      perguntasParaMedico: ['Preciso repetir (e21)?'],
      ancoras: ['e21', 'e11'],
    })
    const r = await explicarExame(d, 'e21')
    expect(r?.explicacao).toEqual(['A filtração caiu de 74 para 68.'])
    expect(r?.pontosDeAtencao).toEqual(['Creatinina 1,1 mg/dL em 05/03/2026.'])
    expect(r?.perguntasParaMedico).toEqual(['Preciso repetir?'])
  })
})

describe('perfil no prompt', () => {
  it('descreve idade, condições e alergias do perfil da sessão', async () => {
    const { deps: d, chamadas } = await deps({ texto: ['ok'], ancoras: ['e02'], serie: null, aviso: null })
    await responderCopiloto(d, { pergunta: 'Como está a glicada?' })
    expect(prompt(chamadas)).toContain(`Perfil: ${d.perfil.idade} anos. Condições registradas: Diabetes tipo 2`)
    expect(prompt(chamadas)).toContain('Alergias: Dipirona')
  })

  it('tolera perfil sem idade, condições nem alergias', () => {
    expect(descreverPerfil({ condicoes: [], alergias: [] }))
      .toBe('Perfil: idade não informada. Condições registradas: nenhuma informada. Alergias: nenhuma informada.')
  })
})

describe('histórico vazio responde sem chamar o LLM', () => {
  it('copiloto pede para anexar um documento', async () => {
    const { deps: d, chamadas } = await deps(null, 'vazio')
    expect(await responderCopiloto(d, { pergunta: 'Como está minha glicada?' }))
      .toEqual({ texto: [HISTORICO_VAZIO], ancoras: [], geradoPor: 'oci' })
    expect(chamadas).toHaveLength(0)
  })

  it('resumo explica que não há registros e não registra acesso', async () => {
    const { deps: d, chamadas } = await deps(null, 'vazio')
    const r = await gerarResumo(d, 'Cardiologia')
    expect(r).toMatchObject({ especialidade: 'Cardiologia', pontos: [], perguntasSugeridas: [], geradoPor: 'oci' })
    expect(r.sintese[0]).toMatch(/histórico ainda está vazio/)
    expect(chamadas).toHaveLength(0)
    expect(await d.repo.listarAcessos()).toEqual([])
  })

  it('passos devolve lista vazia', async () => {
    const { deps: d, chamadas } = await deps(null, 'vazio')
    expect(await gerarPassos(d)).toEqual({ passos: [], geradoPor: 'oci' })
    expect(chamadas).toHaveLength(0)
  })

  it('explicar não encontra o exame', async () => {
    const { deps: d, chamadas } = await deps(null, 'vazio')
    expect(await explicarExame(d, 'e21')).toBeNull()
    expect(chamadas).toHaveLength(0)
  })
})
