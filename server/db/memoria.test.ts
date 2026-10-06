import { describe, expect, it, vi } from 'vitest'
import * as seed from '../../src/data/seed.js'
import { criarRepoMemoria } from './memoria.js'
import { suiteRepositorio } from './repo.contract.js'

suiteRepositorio('memoria', criarRepoMemoria)

async function pacienteExemplo(repo = criarRepoMemoria()) {
  const { pacienteId } = await repo.criarPaciente({ nome: 'Ana Alves', convidado: false })
  await repo.aplicarOnboarding(pacienteId, 'exemplo')
  return repo.paraPaciente(pacienteId)
}

describe('criarRepoMemoria', () => {
  it('não muta o seed', async () => {
    const antes = structuredClone({
      eventos: seed.EVENTOS, consentimentos: seed.CONSENTIMENTOS, acessos: seed.ACESSOS,
      passos: seed.PROXIMOS_PASSOS, fontes: seed.FONTES_CONECTADAS,
    })
    const repo = await pacienteExemplo()
    await repo.adicionarEvento({ ...seed.EVENTOS[0], id: 'u1' }, 'Ana Alves')
    await repo.alternarConsentimento('c1', 'Ana Alves')
    await repo.alternarPasso('p1')
    await repo.conectarFonte('f5')
    await repo.criarCompartilhamento('Dr. X', 'Ana Alves')
    await repo.registrarAcesso({ quem: 'x', papel: 'y', acao: 'z', itens: 'w' })

    expect({
      eventos: seed.EVENTOS, consentimentos: seed.CONSENTIMENTOS, acessos: seed.ACESSOS,
      passos: seed.PROXIMOS_PASSOS, fontes: seed.FONTES_CONECTADAS,
    }).toEqual(antes)
  })

  it('instâncias são independentes', async () => {
    const a = criarRepoMemoria()
    const b = criarRepoMemoria()
    const { pacienteId } = await a.criarPaciente({ nome: 'Ana', convidado: false })
    expect(await b.obterPerfil(pacienteId)).toBeNull()
  })

  it('código de compartilhamento não usa Math.random (previsível)', async () => {
    const repo = await pacienteExemplo()
    const random = vi.spyOn(Math, 'random')
    await repo.criarCompartilhamento('Dr. X', 'Ana Alves')
    expect(random).not.toHaveBeenCalled()
    random.mockRestore()
  })

  it('identifica-se como memoria', () => {
    expect(criarRepoMemoria().nome).toBe('memoria')
  })
})
