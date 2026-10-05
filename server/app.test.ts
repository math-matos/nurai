import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACESSOS, EVENTOS } from '../src/data/seed.js'
import type { Evento } from '../src/data/types.js'
import { criarLlmMock } from './ai/mock.js'
import { criarApp } from './app.js'
import { criarRepoMemoria } from './db/memoria.js'
import type { EstadoRepositorio, Repositorio } from './db/repo.js'

const EVENTO: Evento = {
  id: 'u1', data: '2026-09-01', tipo: 'exame', titulo: 'Perfil lipídico',
  instituicao: 'Laboratório Teste', fonte: 'paciente', resumo: 'Documento enviado.',
  sinal: 'alterado', tags: ['colesterol'], origem: 'OCR + IA', confianca: 0.93,
  medidas: [{ nome: 'LDL', valor: 162, unidade: 'mg/dL', refMin: 0, refMax: 130, sinal: 'alterado' }],
}

type Corpo = Partial<EstadoRepositorio> & { erro?: string; versao?: string }

async function corpo(res: Response) {
  return (await res.json()) as Corpo
}

function json(body: unknown, method = 'POST'): RequestInit {
  return { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

describe('API', () => {
  let app: ReturnType<typeof criarApp>
  let repo: Repositorio

  beforeEach(() => {
    repo = criarRepoMemoria()
    app = criarApp({ repo, llm: criarLlmMock() })
  })

  it('GET /api/health informa providers', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = await corpo(res)
    expect(body).toMatchObject({ ok: true, genai: 'mock', db: 'memoria' })
    expect(typeof body.versao).toBe('string')
  })

  it('GET /api/estado devolve o estado completo', async () => {
    const res = await app.request('/api/estado')
    expect(res.status).toBe(200)
    const body = await corpo(res)
    expect(body.eventos).toHaveLength(EVENTOS.length)
    expect(body.compartilhamento).toBeNull()
    expect(Object.keys(body).sort()).toEqual(
      ['acessos', 'compartilhamento', 'consentimentos', 'eventos', 'fontes', 'passos'])
  })

  describe('POST /api/eventos', () => {
    it('cria o evento e registra acesso da titular', async () => {
      const res = await app.request('/api/eventos', json(EVENTO))
      expect(res.status).toBe(201)
      expect(await corpo(res)).toEqual(EVENTO)
      const [ultimo] = await repo.listarAcessos()
      expect(ultimo).toMatchObject({ quem: 'Helena Duarte Nogueira', acao: 'Anexou documento ao histórico' })
    })

    it('400 quando o corpo não é um evento válido', async () => {
      const res = await app.request('/api/eventos', json({ ...EVENTO, titulo: undefined, tipo: 'xpto' }))
      expect(res.status).toBe(400)
      const body = await corpo(res)
      expect(body.erro).toMatch(/titulo/)
      expect(body.erro).toMatch(/tipo/)
      expect((await repo.estado()).eventos).toHaveLength(EVENTOS.length)
    })

    it('400 quando o JSON é malformado', async () => {
      const res = await app.request('/api/eventos', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
      })
      expect(res.status).toBe(400)
      expect((await corpo(res)).erro).toBeTypeOf('string')
    })
  })

  describe('PATCH /api/consentimentos/:id', () => {
    it('alterna o consentimento', async () => {
      const res = await app.request('/api/consentimentos/c1', { method: 'PATCH' })
      expect(res.status).toBe(200)
      expect(await corpo(res)).toMatchObject({ id: 'c1', ativo: false })
    })

    it('404 para id inexistente', async () => {
      const res = await app.request('/api/consentimentos/zz', { method: 'PATCH' })
      expect(res.status).toBe(404)
      expect((await corpo(res)).erro).toBeTypeOf('string')
    })
  })

  describe('PATCH /api/passos/:id', () => {
    it('alterna o passo', async () => {
      const res = await app.request('/api/passos/p1', { method: 'PATCH' })
      expect(res.status).toBe(200)
      expect(await corpo(res)).toMatchObject({ id: 'p1', feito: true })
    })

    it('404 para id inexistente', async () => {
      expect((await app.request('/api/passos/zz', { method: 'PATCH' })).status).toBe(404)
    })
  })

  describe('POST /api/fontes/:id/conectar', () => {
    it('conecta a fonte', async () => {
      const res = await app.request('/api/fontes/f5/conectar', { method: 'POST' })
      expect(res.status).toBe(200)
      expect(await corpo(res)).toMatchObject({ id: 'f5', estado: 'conectado' })
    })

    it('404 para id inexistente', async () => {
      expect((await app.request('/api/fontes/zz/conectar', { method: 'POST' })).status).toBe(404)
    })
  })

  describe('POST /api/compartilhamentos', () => {
    it('cria o compartilhamento', async () => {
      const res = await app.request('/api/compartilhamentos', json({ para: 'Dra. Renata Aguiar' }))
      expect(res.status).toBe(201)
      expect(await corpo(res)).toMatchObject({ para: 'Dra. Renata Aguiar' })
      expect((await repo.estado()).compartilhamento?.para).toBe('Dra. Renata Aguiar')
    })

    it('400 sem "para"', async () => {
      const res = await app.request('/api/compartilhamentos', json({ para: '  ' }))
      expect(res.status).toBe(400)
      expect((await corpo(res)).erro).toMatch(/para/)
    })
  })

  it('GET /api/acessos lista o log', async () => {
    const res = await app.request('/api/acessos')
    expect(res.status).toBe(200)
    expect(await corpo(res)).toEqual(ACESSOS)
  })

  it('POST /api/reiniciar volta ao seed', async () => {
    await app.request('/api/passos/p1', { method: 'PATCH' })
    const res = await app.request('/api/reiniciar', { method: 'POST' })
    expect(res.status).toBe(200)
    expect((await corpo(res)).passos?.[0].feito).toBe(false)
  })

  it('404 em JSON para rota desconhecida', async () => {
    const res = await app.request('/api/nada')
    expect(res.status).toBe(404)
    expect((await corpo(res)).erro).toBeTypeOf('string')
  })

  it('500 em JSON sem stack quando o repositório falha', async () => {
    const falho: Repositorio = {
      ...criarRepoMemoria(),
      estado: () => Promise.reject(new Error('ORA-00000 detalhe interno')),
    }
    const erroConsole = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await criarApp({ repo: falho, llm: criarLlmMock() }).request('/api/estado')
    erroConsole.mockRestore()
    expect(res.status).toBe(500)
    const body = await corpo(res)
    expect(body).toEqual({ erro: 'Erro interno' })
  })
})
