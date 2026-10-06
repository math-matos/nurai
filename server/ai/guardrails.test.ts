import { describe, expect, it } from 'vitest'
import { AVISO_MEDICO, avisoPara, envolveMedicamento, recomendaConduta } from './guardrails.js'

describe('recomendaConduta', () => {
  it.each([
    'Confirmar com o médico sobre a manutenção da rivaroxabana',
    'Suspender a metformina antes do exame',
    'Perguntar se é preciso aumentar a dose de levotiroxina',
    'Iniciar tratamento para a tireoide',
    'Trocar o anticoagulante',
  ])('detecta conduta medicamentosa: %s', (texto) => {
    expect(recomendaConduta(texto)).toBe(true)
  })

  it.each([
    'Levar o laudo do Doppler de carótidas a quem pediu o novo exame',
    'Repetir o TSH — a reavaliação de 8 semanas nunca aconteceu',
    'Em 15/02/2023 foi iniciada a rivaroxabana 20 mg ao dia.',
    'Mantida a rivaroxabana no retorno de fevereiro de 2026.',
    'Agendar avaliação com nefrologia',
  ])('não confunde fato histórico ou passo de organização: %s', (texto) => {
    expect(recomendaConduta(texto)).toBe(false)
  })
})

describe('envolveMedicamento', () => {
  it.each(['Posso parar a rivaroxabana?', 'Qual remédio devo tomar?', 'Preciso mudar a dose?', 'E o tratamento da tireoide?'])(
    'reconhece pergunta sobre medicamento ou conduta: %s', (p) => expect(envolveMedicamento(p)).toBe(true))

  it.each(['Como minha glicada evoluiu?', 'Tenho câncer?', 'Tem algum exame que eu não preciso repetir?'])(
    'ignora pergunta sem medicamento: %s', (p) => expect(envolveMedicamento(p)).toBe(false))
})

describe('avisoPara', () => {
  it('preserva o aviso do modelo', () => {
    expect(avisoPara('Posso parar a rivaroxabana?', ' Fale com a cardiologista. ')).toBe('Fale com a cardiologista.')
  })

  it('insere o aviso padrão quando a pergunta envolve medicamento e o modelo não deu aviso', () => {
    expect(avisoPara('Posso parar a rivaroxabana?', null)).toBe(AVISO_MEDICO)
  })

  it('sem medicamento e sem aviso do modelo, não inventa aviso', () => {
    expect(avisoPara('Tenho câncer?', undefined)).toBeUndefined()
  })
})
