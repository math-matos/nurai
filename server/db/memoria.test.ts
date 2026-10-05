import { describe, expect, it, vi } from 'vitest'
import * as seed from '../../src/data/seed.js'
import { criarRepoMemoria } from './memoria.js'
import { suiteRepositorio } from './repo.contract.js'

suiteRepositorio('memoria', criarRepoMemoria)

describe('criarRepoMemoria', () => {
  it('não muta o seed', async () => {
    const antes = structuredClone({
      eventos: seed.EVENTOS, consentimentos: seed.CONSENTIMENTOS, acessos: seed.ACESSOS,
      passos: seed.PROXIMOS_PASSOS, fontes: seed.FONTES_CONECTADAS,
    })
    const repo = criarRepoMemoria()
    await repo.adicionarEvento({ ...seed.EVENTOS[0], id: 'u1' }, 'Helena Duarte Nogueira')
    await repo.alternarConsentimento('c1', 'Helena Duarte Nogueira')
    await repo.alternarPasso('p1')
    await repo.conectarFonte('f5')
    await repo.criarCompartilhamento('Dr. X', 'Helena Duarte Nogueira')
    await repo.registrarAcesso({ quem: 'x', papel: 'y', acao: 'z', itens: 'w' })

    expect({
      eventos: seed.EVENTOS, consentimentos: seed.CONSENTIMENTOS, acessos: seed.ACESSOS,
      passos: seed.PROXIMOS_PASSOS, fontes: seed.FONTES_CONECTADAS,
    }).toEqual(antes)
  })

  it('instâncias são independentes', async () => {
    const a = criarRepoMemoria()
    const b = criarRepoMemoria()
    await a.alternarPasso('p1')
    expect((await b.estado()).passos[0].feito).toBe(false)
  })

  it('código de compartilhamento não usa Math.random (previsível)', async () => {
    const random = vi.spyOn(Math, 'random')
    await criarRepoMemoria().criarCompartilhamento('Dr. X', 'Helena Duarte Nogueira')
    expect(random).not.toHaveBeenCalled()
    random.mockRestore()
  })

  it('identifica-se como memoria', () => {
    expect(criarRepoMemoria().nome).toBe('memoria')
  })
})
