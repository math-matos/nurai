import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Evento } from '../src/data/types.js'
import { criarLlmMock } from './ai/mock.js'
import { criarApp } from './app.js'
import { dadosExemplo } from './db/exemplo.js'
import { criarRepoMemoria } from './db/memoria.js'
import type { EstadoRepositorio, Repositorio, RepositorioPaciente } from './db/repo.js'
import {
  cadastrarComOnboarding, comSessao, json, logado, pacienteExemplo, type App,
} from './teste/apoio.js'

const EVENTO: Evento = {
  id: 'u1', data: '2026-09-01', tipo: 'exame', titulo: 'Perfil lipídico',
  instituicao: 'Laboratório Teste', fonte: 'paciente', resumo: 'Documento enviado.',
  sinal: 'alterado', tags: ['colesterol'], origem: 'OCR + IA', confianca: 0.93,
  medidas: [{ nome: 'LDL', valor: 162, unidade: 'mg/dL', refMin: 0, refMax: 130, sinal: 'alterado' }],
}
const NOME = 'Ana Teste'
const EXEMPLO = dadosExemplo(NOME)

type Corpo = Partial<EstadoRepositorio> & { erro?: string; codigo?: string; campos?: Record<string, string>; versao?: string }

async function corpo(res: Response) {
  return (await res.json()) as Corpo
}

describe('API', () => {
  let raiz: Repositorio
  let app: App
  let api: ReturnType<typeof logado>
  let repo: RepositorioPaciente
  let conta: Awaited<ReturnType<typeof pacienteExemplo>>

  beforeEach(async () => {
    raiz = criarRepoMemoria()
    app = criarApp({ repo: raiz, llm: criarLlmMock() })
    conta = await pacienteExemplo(raiz, { nome: NOME })
    repo = conta.repo
    api = logado(app, conta.cookie)
  })

  it('GET /api/health informa providers sem exigir sessão', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = await corpo(res)
    expect(body).toMatchObject({ ok: true, genai: 'mock', db: 'memoria' })
    expect(typeof body.versao).toBe('string')
  })

  it('GET /api/estado devolve o estado completo do paciente da sessão', async () => {
    const res = await api.request('/api/estado')
    expect(res.status).toBe(200)
    const body = await corpo(res)
    expect(body.eventos).toHaveLength(EXEMPLO.eventos.length)
    expect(body.compartilhamento).toBeNull()
    expect(Object.keys(body).sort()).toEqual(
      ['acessos', 'compartilhamento', 'consentimentos', 'eventos', 'fontes', 'passos'])
  })

  describe('POST /api/eventos', () => {
    it('cria o evento e registra acesso com o nome do perfil', async () => {
      const res = await api.request('/api/eventos', json(EVENTO))
      expect(res.status).toBe(201)
      expect(await corpo(res)).toEqual(EVENTO)
      const [ultimo] = await repo.listarAcessos()
      expect(ultimo).toMatchObject({ quem: NOME, papel: 'Titular', acao: 'Anexou documento ao histórico' })
    })

    it('o autor acompanha o nome atualizado no perfil', async () => {
      await api.request('/api/perfil', json({ nome: 'Ana Nova' }, 'PATCH'))
      await api.request('/api/consentimentos/c1', { method: 'PATCH' })
      expect((await repo.listarAcessos())[0]).toMatchObject({ quem: 'Ana Nova', papel: 'Titular' })
    })

    it('400 VALIDACAO quando o corpo não é um evento válido', async () => {
      const res = await api.request('/api/eventos', json({ ...EVENTO, titulo: undefined, tipo: 'xpto' }))
      expect(res.status).toBe(400)
      const body = await corpo(res)
      expect(body.codigo).toBe('VALIDACAO')
      expect(body.erro).toMatch(/titulo/)
      expect(body.erro).toMatch(/tipo/)
      expect(Object.keys(body.campos ?? {})).toEqual(expect.arrayContaining(['titulo', 'tipo']))
      expect((await repo.estado()).eventos).toHaveLength(EXEMPLO.eventos.length)
    })

    /* O Oracle rejeita (TO_DATE/ORA-12899) e viraria 500; a memória aceitaria. Os dois devem dar 400. */
    it.each([
      ['data impossível', { data: '2026-02-30' }, /data/],
      ['titulo acima do limite da coluna', { titulo: 'é'.repeat(201) }, /titulo/],
      ['documento acima do limite da coluna', { documento: 'a'.repeat(401) }, /documento/],
      ['id acima do limite da coluna', { id: 'u'.repeat(65) }, /id/],
    ])('400 para %s', async (_, mudanca, campo) => {
      const res = await api.request('/api/eventos', json({ ...EVENTO, ...mudanca }))
      expect(res.status).toBe(400)
      expect((await corpo(res)).erro).toMatch(campo)
      expect((await repo.estado()).eventos).toHaveLength(EXEMPLO.eventos.length)
    })

    it('aceita medida com faixa unilateral e devolve sem o limite ausente', async () => {
      const medidas = [
        { nome: 'HDL', valor: 38, unidade: 'mg/dL', refMin: 40, sinal: 'alterado' },
        { nome: 'LDL', valor: 138, unidade: 'mg/dL', refMax: 130, sinal: 'alterado' },
      ]
      const res = await api.request('/api/eventos', json({ ...EVENTO, medidas }))
      expect(res.status).toBe(201)
      expect(await res.json()).toMatchObject({ medidas })
    })

    it.each([
      ['sem nenhum limite', { refMin: undefined, refMax: undefined }, /limite/],
      ['com mínimo acima do máximo', { refMin: 200, refMax: 130 }, /mínimo/],
      ['com limite null', { refMin: null, refMax: 130 }, /refMin/],
    ])('400 para medida %s', async (_, faixa, mensagem) => {
      const medida = { nome: 'LDL', valor: 138, unidade: 'mg/dL', sinal: 'alterado', ...faixa }
      const res = await api.request('/api/eventos', json({ ...EVENTO, medidas: [medida] }))
      expect(res.status).toBe(400)
      expect((await corpo(res)).erro).toMatch(mensagem)
    })

    it('413 CORPO_GRANDE para corpo acima de 256 KB', async () => {
      const res = await api.request('/api/eventos', json({ ...EVENTO, resumo: 'a'.repeat(300 * 1024) }))
      expect(res.status).toBe(413)
      expect(await res.json()).toMatchObject({ codigo: 'CORPO_GRANDE' })
      expect((await repo.estado()).eventos).toHaveLength(EXEMPLO.eventos.length)
    })

    it('409 CONFLITO quando o id já existe', async () => {
      await api.request('/api/eventos', json(EVENTO))
      const res = await api.request('/api/eventos', json({ ...EVENTO, titulo: 'Outro' }))
      expect(res.status).toBe(409)
      const body = await corpo(res)
      expect(body.codigo).toBe('CONFLITO')
      expect(body.erro).toMatch(/u1/)
      expect((await repo.estado()).eventos).toHaveLength(EXEMPLO.eventos.length + 1)
    })

    it('400 quando o JSON é malformado', async () => {
      const res = await api.request('/api/eventos', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
      })
      expect(res.status).toBe(400)
      expect(await corpo(res)).toMatchObject({ codigo: 'VALIDACAO', erro: expect.any(String) })
    })
  })

  describe('DELETE /api/eventos/:id', () => {
    it('exclui o evento, limpa os passos e registra o acesso com o nome do perfil', async () => {
      await api.request('/api/eventos', json(EVENTO))
      const res = await api.request('/api/eventos/u1', { method: 'DELETE' })
      expect(res.status).toBe(204)
      expect(await res.text()).toBe('')
      expect((await api.request('/api/eventos/e14', { method: 'DELETE' })).status).toBe(204)

      const estado = await corpo(await api.request('/api/estado'))
      expect(estado.eventos?.map((e) => e.id)).not.toContain('u1')
      expect(estado.eventos?.map((e) => e.id)).not.toContain('e14')
      expect(estado.passos?.map((p) => p.id)).not.toContain('p5')
      expect(estado.acessos?.[1]).toMatchObject({
        quem: NOME, papel: 'Titular', acao: 'Excluiu registro do histórico', itens: 'Perfil lipídico, 01/09/2026',
      })
    })

    it('404 para id inexistente', async () => {
      const res = await api.request('/api/eventos/zz', { method: 'DELETE' })
      expect(res.status).toBe(404)
      expect((await corpo(res)).erro).toBeTypeOf('string')
    })

    it('exige o cabeçalho anti-CSRF e a sessão', async () => {
      const semCsrf = await app.request('/api/eventos/e14', { method: 'DELETE', headers: { cookie: conta.cookie } })
      expect(semCsrf.status).toBe(403)
      const semSessao = await app.request('/api/eventos/e14', comSessao(null, { method: 'DELETE' }))
      expect(semSessao.status).toBe(401)
      expect((await repo.estado()).eventos).toEqual(EXEMPLO.eventos)
    })
  })

  describe('PATCH /api/consentimentos/:id', () => {
    it('alterna o consentimento', async () => {
      const res = await api.request('/api/consentimentos/c1', { method: 'PATCH' })
      expect(res.status).toBe(200)
      expect(await corpo(res)).toMatchObject({ id: 'c1', ativo: false })
    })

    it('404 para id inexistente', async () => {
      const res = await api.request('/api/consentimentos/zz', { method: 'PATCH' })
      expect(res.status).toBe(404)
      expect((await corpo(res)).erro).toBeTypeOf('string')
    })
  })

  describe('PATCH /api/passos/:id', () => {
    it('alterna o passo', async () => {
      const res = await api.request('/api/passos/p1', { method: 'PATCH' })
      expect(res.status).toBe(200)
      expect(await corpo(res)).toMatchObject({ id: 'p1', feito: true })
    })

    it('404 para id inexistente', async () => {
      expect((await api.request('/api/passos/zz', { method: 'PATCH' })).status).toBe(404)
    })
  })

  describe('POST /api/fontes/:id/conectar', () => {
    it('conecta a fonte', async () => {
      const res = await api.request('/api/fontes/f5/conectar', { method: 'POST' })
      expect(res.status).toBe(200)
      expect(await corpo(res)).toMatchObject({ id: 'f5', estado: 'conectado' })
    })

    it('404 para id inexistente', async () => {
      expect((await api.request('/api/fontes/zz/conectar', { method: 'POST' })).status).toBe(404)
    })
  })

  describe('POST /api/compartilhamentos', () => {
    it('cria o compartilhamento', async () => {
      const res = await api.request('/api/compartilhamentos', json({ para: 'Dra. Renata Aguiar' }))
      expect(res.status).toBe(201)
      expect(await corpo(res)).toMatchObject({ para: 'Dra. Renata Aguiar' })
      expect((await repo.estado()).compartilhamento?.para).toBe('Dra. Renata Aguiar')
    })

    it('400 sem "para"', async () => {
      const res = await api.request('/api/compartilhamentos', json({ para: '  ' }))
      expect(res.status).toBe(400)
      expect((await corpo(res)).erro).toMatch(/para/)
    })
  })

  it('GET /api/acessos lista o log do paciente', async () => {
    const res = await api.request('/api/acessos')
    expect(res.status).toBe(200)
    expect(await corpo(res)).toEqual(EXEMPLO.acessos)
  })

  describe('POST /api/reiniciar', () => {
    it('volta ao histórico de exemplo', async () => {
      await api.request('/api/passos/p1', { method: 'PATCH' })
      const res = await api.request('/api/reiniciar', { method: 'POST' })
      expect(res.status).toBe(200)
      expect((await corpo(res)).passos?.[0].feito).toBe(false)
    })

    it('volta ao vazio para quem escolheu começar vazio', async () => {
      const vazio = logado(app, (await cadastrarComOnboarding(app, 'vazio')).cookie)
      await vazio.request('/api/eventos', json(EVENTO))
      const res = await vazio.request('/api/reiniciar', { method: 'POST' })
      expect((await corpo(res)).eventos).toEqual([])
    })
  })

  it('404 em JSON para rota desconhecida (com sessão)', async () => {
    const res = await api.request('/api/nada')
    expect(res.status).toBe(404)
    expect((await corpo(res)).erro).toBeTypeOf('string')
  })

  it('500 em JSON sem stack quando o repositório falha', async () => {
    const falho: Repositorio = {
      ...raiz,
      paraPaciente: (id) => ({ ...raiz.paraPaciente(id), estado: () => Promise.reject(new Error('ORA-00000 detalhe interno')) }),
    }
    const outra = await pacienteExemplo(raiz)
    const erroConsole = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await criarApp({ repo: falho, llm: criarLlmMock() }).request('/api/estado', comSessao(outra.cookie))
    erroConsole.mockRestore()
    expect(res.status).toBe(500)
    expect(await corpo(res)).toEqual({ erro: 'Erro interno' })
  })
})

describe('isolamento entre pacientes via HTTP', () => {
  let app: App
  let a: ReturnType<typeof logado>
  let b: ReturnType<typeof logado>

  beforeEach(async () => {
    app = criarApp({ repo: criarRepoMemoria(), llm: criarLlmMock() })
    a = logado(app, (await cadastrarComOnboarding(app, 'exemplo', { nome: 'Ana Alves' })).cookie)
    b = logado(app, (await cadastrarComOnboarding(app, 'vazio', { nome: 'Bruno Braga' })).cookie)
  })

  it('evento criado por A não aparece no estado de B', async () => {
    expect((await a.request('/api/eventos', json(EVENTO))).status).toBe(201)
    const estadoB = await corpo(await b.request('/api/estado'))
    expect(estadoB.eventos).toEqual([])
    expect(estadoB.acessos).toEqual([])
    expect((await corpo(await a.request('/api/estado'))).eventos?.map((e) => e.id)).toContain('u1')
  })

  it('B não alcança passo, consentimento, fonte nem exame de A', async () => {
    expect((await b.request('/api/passos/p1', { method: 'PATCH' })).status).toBe(404)
    expect((await b.request('/api/consentimentos/c1', { method: 'PATCH' })).status).toBe(404)
    expect((await b.request('/api/fontes/f5/conectar', { method: 'POST' })).status).toBe(404)
    expect((await b.request('/api/exames/e21/explicar', { method: 'POST' })).status).toBe(404)
    const estadoA = await corpo(await a.request('/api/estado'))
    expect(estadoA.passos?.find((p) => p.id === 'p1')?.feito).toBe(false)
    expect(estadoA.consentimentos?.find((c) => c.id === 'c1')?.ativo).toBe(true)
  })

  it('B não exclui evento de A (404) e o evento continua com A', async () => {
    const res = await b.request('/api/eventos/e14', { method: 'DELETE' })
    expect(res.status).toBe(404)
    const estadoA = await corpo(await a.request('/api/estado'))
    expect(estadoA.eventos?.map((e) => e.id)).toContain('e14')
    expect(estadoA.acessos?.[0].acao).not.toBe('Excluiu registro do histórico')
  })

  it('reiniciar de B não mexe em A', async () => {
    await a.request('/api/passos/p1', { method: 'PATCH' })
    await b.request('/api/reiniciar', { method: 'POST' })
    const estadoA = await corpo(await a.request('/api/estado'))
    expect(estadoA.passos?.find((p) => p.id === 'p1')?.feito).toBe(true)
  })
})
