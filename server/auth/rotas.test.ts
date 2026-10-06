import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENTOS } from '../../src/data/seed.js'
import { criarLlmMock } from '../ai/mock.js'
import { criarApp } from '../app.js'
import { criarRepoMemoria } from '../db/memoria.js'
import type { Repositorio } from '../db/repo.js'
import { chave } from './limite.js'
import { hashToken } from './sessao.js'
import {
  SENHA, cadastrar, cadastrarComOnboarding, comSessao, cookieDe, emailNovo, json, logado, type App,
} from '../teste/apoio.js'

type Corpo = Record<string, unknown> & { codigo?: string; erro?: string; campos?: Record<string, string> }
const ler = async (res: Response) => (await res.json()) as Corpo
const HORA = 60 * 60 * 1000

const comIp = (ip: string, init: RequestInit) => {
  const headers = new Headers(init.headers)
  headers.set('x-forwarded-for', ip)
  return { ...init, headers }
}

describe('autenticação', () => {
  let repo: Repositorio
  let app: App

  beforeEach(() => {
    repo = criarRepoMemoria()
    app = criarApp({ repo, llm: criarLlmMock() })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  const post = (caminho: string, body?: unknown, cookie: string | null = null) =>
    app.request(caminho, comSessao(cookie, body === undefined ? { method: 'POST' } : json(body)))
  const login = (email: string, senha: string, ip = '10.0.0.1') =>
    app.request('/api/auth/login', comSessao(null, comIp(ip, json({ email, senha }))))

  describe('POST /api/auth/cadastro', () => {
    it('201 com usuário, perfil pendente e cookie de sessão', async () => {
      const email = emailNovo('Maria')
      const res = await post('/api/auth/cadastro', {
        nome: 'Maria Clara Souza', email: `  ${email.toUpperCase()} `, senha: SENHA, dataNascimento: '1990-01-15', aceiteLgpd: true,
      })
      expect(res.status).toBe(201)
      const body = await ler(res)
      expect(body).toEqual({
        usuario: { id: expect.any(String), email: email.toLowerCase() },
        perfil: {
          pacienteId: expect.any(String), nome: 'Maria Clara Souza', iniciais: 'MS', dataNascimento: '1990-01-15',
          idade: expect.any(Number), condicoes: [], alergias: [], onboarding: 'pendente', convidado: false,
        },
      })
      const cookie = res.headers.get('set-cookie')!
      expect(cookie).toMatch(/^nurai_sessao=[A-Za-z0-9_-]{43};/)
      expect(cookie).toMatch(/Max-Age=604800/)
      expect(cookie).toMatch(/HttpOnly/)
      expect(cookie).toMatch(/SameSite=Lax/)
      expect(cookie).toMatch(/Path=\//)
      expect(cookie).not.toMatch(/Secure/)
    })

    it('cookie Secure na Vercel', async () => {
      vi.stubEnv('VERCEL', '1')
      const res = await post('/api/auth/cadastro', { nome: 'Ana', email: emailNovo(), senha: SENHA, aceiteLgpd: true })
      expect(res.headers.get('set-cookie')).toMatch(/Secure/)
    })

    it.each([
      ['senha curta', { senha: '1234567' }, 'senha'],
      ['email inválido', { email: 'nao-e-email' }, 'email'],
      ['sem aceite LGPD', { aceiteLgpd: undefined }, 'aceiteLgpd'],
      ['aceite LGPD falso', { aceiteLgpd: false }, 'aceiteLgpd'],
      ['nome vazio', { nome: '   ' }, 'nome'],
      ['nascimento no futuro', { dataNascimento: '2999-01-01' }, 'dataNascimento'],
    ])('400 VALIDACAO para %s', async (_, mudanca, campo) => {
      const res = await post('/api/auth/cadastro', { nome: 'Ana', email: emailNovo(), senha: SENHA, aceiteLgpd: true, ...mudanca })
      expect(res.status).toBe(400)
      const body = await ler(res)
      expect(body.codigo).toBe('VALIDACAO')
      expect(body.campos?.[campo]).toEqual(expect.any(String))
      expect(res.headers.get('set-cookie')).toBeNull()
    })

    it('429 após 5 cadastros por IP na hora, contando os inválidos', async () => {
      const cadastro = (ip: string, mudanca: Record<string, unknown> = {}) => app.request('/api/auth/cadastro',
        comSessao(null, comIp(ip, json({ nome: 'Ana', email: emailNovo(), senha: SENHA, aceiteLgpd: true, ...mudanca }))))
      for (let i = 0; i < 4; i++) expect((await cadastro('10.2.2.2')).status).toBe(201)
      expect((await cadastro('10.2.2.2', { senha: 'curta' })).status).toBe(400)
      const bloqueado = await cadastro('10.2.2.2')
      expect(bloqueado.status).toBe(429)
      expect((await ler(bloqueado)).codigo).toBe('MUITAS_TENTATIVAS')
      expect(bloqueado.headers.get('retry-after')).toBe('3600')
      expect((await cadastro('10.2.2.3')).status).toBe(201)

      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(Date.now() + HORA + 60_000)
      expect((await cadastro('10.2.2.2')).status).toBe(201)
    })

    it('409 EMAIL_EM_USO, sem diferenciar maiúsculas', async () => {
      const { email } = await cadastrar(app)
      const res = await post('/api/auth/cadastro', { nome: 'Outra', email: email.toUpperCase(), senha: SENHA, aceiteLgpd: true })
      expect(res.status).toBe(409)
      expect((await ler(res)).codigo).toBe('EMAIL_EM_USO')
    })
  })

  describe('POST /api/auth/login', () => {
    it('200 com usuário, perfil e cookie novo', async () => {
      const conta = await cadastrar(app)
      const res = await login(conta.email.toUpperCase(), SENHA)
      expect(res.status).toBe(200)
      expect(await ler(res)).toEqual({ usuario: conta.usuario, perfil: conta.perfil })
      const cookie = cookieDe(res)
      expect(cookie).not.toBe(conta.cookie)
      expect((await app.request('/api/estado', comSessao(cookie))).status).toBe(200)
    })

    it('401 CREDENCIAIS_INVALIDAS com a mesma mensagem para senha errada e email desconhecido', async () => {
      const conta = await cadastrar(app)
      const errada = await login(conta.email, 'senha-errada')
      const desconhecido = await login(emailNovo('ninguem'), SENHA)
      expect(errada.status).toBe(401)
      expect(desconhecido.status).toBe(401)
      const [a, b] = [await ler(errada), await ler(desconhecido)]
      expect(a).toEqual({ erro: expect.any(String), codigo: 'CREDENCIAIS_INVALIDAS' })
      expect(b).toEqual(a)
      expect(errada.headers.get('set-cookie')).toBeNull()
    })

    it('429 MUITAS_TENTATIVAS após 5 falhas por IP + email, mesmo com a senha certa', async () => {
      const conta = await cadastrar(app)
      for (let i = 0; i < 5; i++) expect((await login(conta.email, 'senha-errada')).status).toBe(401)
      const bloqueado = await login(conta.email, SENHA)
      expect(bloqueado.status).toBe(429)
      expect((await ler(bloqueado)).codigo).toBe('MUITAS_TENTATIVAS')
      expect(bloqueado.headers.get('retry-after')).toBe('900')
      expect((await login(conta.email, SENHA, '10.0.0.2')).status).toBe(200)
    })

    it('a janela do rate limit é de 15 minutos', async () => {
      const conta = await cadastrar(app)
      vi.useFakeTimers({ toFake: ['Date'] })
      for (let i = 0; i < 5; i++) await login(conta.email, 'senha-errada')
      expect((await login(conta.email, SENHA)).status).toBe(429)
      vi.setSystemTime(Date.now() + 16 * 60 * 1000)
      expect((await login(conta.email, SENHA)).status).toBe(200)
    })

    it('usa o primeiro IP de x-forwarded-for', async () => {
      const conta = await cadastrar(app)
      for (let i = 0; i < 5; i++) await login(conta.email, 'senha-errada', `10.9.9.9, 172.16.0.${i}`)
      expect((await login(conta.email, SENHA, '10.9.9.9')).status).toBe(429)
    })

    it('conta convidada não entra por senha', async () => {
      const demo = await ler(await post('/api/auth/demo'))
      const { email } = demo.usuario as { email: string }
      expect((await login(email, '')).status).toBe(400)
      expect((await login(email, 'qualquer-coisa')).status).toBe(401)
    })
  })

  describe('sessão', () => {
    it('GET /api/auth/sessao devolve usuário e perfil', async () => {
      const conta = await cadastrar(app)
      const res = await app.request('/api/auth/sessao', comSessao(conta.cookie))
      expect(res.status).toBe(200)
      expect(await ler(res)).toEqual({ usuario: conta.usuario, perfil: conta.perfil })
    })

    it('401 NAO_AUTENTICADO sem cookie ou com cookie desconhecido', async () => {
      for (const cookie of [null, 'nurai_sessao=inventado']) {
        const res = await app.request('/api/auth/sessao', comSessao(cookie))
        expect(res.status).toBe(401)
        expect((await ler(res)).codigo).toBe('NAO_AUTENTICADO')
      }
    })

    it('logout responde 204, limpa o cookie e invalida a sessão no banco', async () => {
      const conta = await cadastrar(app)
      const res = await post('/api/auth/logout', undefined, conta.cookie)
      expect(res.status).toBe(204)
      expect(res.headers.get('set-cookie')).toMatch(/^nurai_sessao=;.*Max-Age=0/)
      expect((await app.request('/api/estado', comSessao(conta.cookie))).status).toBe(401)
      expect((await app.request('/api/auth/sessao', comSessao(conta.cookie))).status).toBe(401)
    })

    it('sessão expirada (7 dias) vira 401', async () => {
      const conta = await cadastrar(app)
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(Date.now() + 6 * 24 * HORA)
      expect((await app.request('/api/estado', comSessao(conta.cookie))).status).toBe(200)
      vi.setSystemTime(Date.now() + 2 * 24 * HORA)
      const res = await app.request('/api/estado', comSessao(conta.cookie))
      expect(res.status).toBe(401)
      expect((await ler(res)).codigo).toBe('NAO_AUTENTICADO')
    })
  })

  describe('POST /api/auth/demo', () => {
    it('201 com conta convidada, histórico de exemplo e sessão de 24 h', async () => {
      const res = await post('/api/auth/demo')
      expect(res.status).toBe(201)
      const body = await ler(res)
      expect(body.usuario).toEqual({ id: expect.any(String), email: expect.stringMatching(/^convidado\+.+@nurai\.demo$/) })
      expect(body.perfil).toMatchObject({ nome: 'Visitante', convidado: true, onboarding: 'exemplo' })
      expect(res.headers.get('set-cookie')).toMatch(/Max-Age=86400/)
      const cookie = cookieDe(res)
      const estado = await ler(await app.request('/api/estado', comSessao(cookie)))
      expect(estado.eventos).toHaveLength(EVENTOS.length)

      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(Date.now() + 25 * HORA)
      expect((await app.request('/api/estado', comSessao(cookie))).status).toBe(401)
    })

    it('429 após 10 contas por IP na hora', async () => {
      const demo = (ip: string) => app.request('/api/auth/demo', comSessao(null, comIp(ip, { method: 'POST' })))
      for (let i = 0; i < 10; i++) expect((await demo('10.1.1.1')).status).toBe(201)
      const res = await demo('10.1.1.1')
      expect(res.status).toBe(429)
      expect((await ler(res)).codigo).toBe('MUITAS_TENTATIVAS')
      expect((await demo('10.1.1.2')).status).toBe(201)
    })
  })

  describe('CSRF', () => {
    it('403 CSRF em método ≠ GET sem x-nurai: 1, mesmo com sessão', async () => {
      const conta = await cadastrar(app)
      const semCabecalho = await app.request('/api/eventos', {
        ...json({}), headers: { 'content-type': 'application/json', cookie: conta.cookie },
      })
      expect(semCabecalho.status).toBe(403)
      expect((await ler(semCabecalho)).codigo).toBe('CSRF')
      const errado = await app.request('/api/auth/login', { ...json({}), headers: { 'x-nurai': '0' } })
      expect(errado.status).toBe(403)
    })

    it('GET não exige o cabeçalho', async () => {
      const conta = await cadastrar(app)
      expect((await app.request('/api/estado', { headers: { cookie: conta.cookie } })).status).toBe(200)
    })
  })

  describe('rotas protegidas', () => {
    it.each([
      ['GET', '/api/estado'], ['POST', '/api/eventos'], ['PATCH', '/api/consentimentos/c1'],
      ['PATCH', '/api/passos/p1'], ['POST', '/api/fontes/f5/conectar'], ['POST', '/api/compartilhamentos'],
      ['GET', '/api/acessos'], ['POST', '/api/reiniciar'], ['POST', '/api/copiloto'], ['POST', '/api/extrair'],
      ['POST', '/api/exames/e21/explicar'], ['POST', '/api/resumo'], ['POST', '/api/passos/gerar'],
      ['POST', '/api/onboarding'], ['PATCH', '/api/perfil'], ['DELETE', '/api/conta'], ['GET', '/api/qualquer'],
    ])('%s %s sem sessão → 401 NAO_AUTENTICADO', async (method, caminho) => {
      const res = await app.request(caminho, comSessao(null, { method }))
      expect(res.status).toBe(401)
      expect(await ler(res)).toEqual({ erro: expect.any(String), codigo: 'NAO_AUTENTICADO' })
    })

    it('/api/acesso-medico/* fica livre de sessão (reservado)', async () => {
      expect((await app.request('/api/acesso-medico/ABC234')).status).toBe(404)
    })
  })

  describe('limpeza oportunista', () => {
    it('login apaga o convidado cuja sessão venceu há mais de 24 h, com os dados; titular fica', async () => {
      const titular = await cadastrarComOnboarding(app, 'exemplo')
      const { pacienteId } = (await ler(await post('/api/auth/demo'))).perfil as { pacienteId: string }
      vi.useFakeTimers({ toFake: ['Date'] })

      vi.setSystemTime(Date.now() + 47 * HORA)
      expect((await login(titular.email, SENHA)).status).toBe(200)
      expect(await repo.obterPerfil(pacienteId)).not.toBeNull()

      vi.setSystemTime(Date.now() + 2 * HORA)
      expect((await login(titular.email, SENHA)).status).toBe(200)
      expect(await repo.obterPerfil(pacienteId)).toBeNull()
      expect((await repo.paraPaciente(pacienteId).estado()).eventos).toEqual([])
      expect(await repo.obterPerfil(titular.perfil.pacienteId)).not.toBeNull()
    })

    it('apaga sessões expiradas e tentativas com mais de um dia', async () => {
      const conta = await cadastrar(app)
      const token = conta.cookie.slice('nurai_sessao='.length)
      await login(conta.email, 'senha-errada')
      const chaveLogin = chave('login', '10.0.0.1', conta.email)
      expect(await repo.contarTentativas(chaveLogin, new Date(0))).toBe(1)

      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(Date.now() + 8 * 24 * HORA)
      expect((await login(conta.email, SENHA, '10.0.0.9')).status).toBe(200)
      expect(await repo.buscarSessao(hashToken(token))).toBeNull()
      expect(await repo.contarTentativas(chaveLogin, new Date(0))).toBe(0)
    })

    it('roda no máximo a cada 10 minutos e uma falha não derruba o login', async () => {
      const limpar = vi.spyOn(repo, 'limpar')
      const conta = await cadastrar(app)
      expect((await login(conta.email, SENHA)).status).toBe(200)
      expect(limpar).toHaveBeenCalledTimes(1)

      limpar.mockRejectedValueOnce(new Error('ORA-00000 falhou'))
      const erroConsole = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(Date.now() + 11 * 60_000)
      expect((await login(conta.email, SENHA)).status).toBe(200)
      expect(limpar).toHaveBeenCalledTimes(2)
      expect(erroConsole).toHaveBeenCalled()
      erroConsole.mockRestore()
    })
  })
})

describe('conta', () => {
  let repo: Repositorio
  let app: App

  beforeEach(() => {
    repo = criarRepoMemoria()
    app = criarApp({ repo, llm: criarLlmMock() })
  })

  describe('POST /api/onboarding', () => {
    it('exemplo copia o histórico do seed; vazio deixa o histórico vazio', async () => {
      const conta = await cadastrar(app)
      const api = logado(app, conta.cookie)
      expect((await ler(await api.request('/api/estado'))).eventos).toEqual([])

      const exemplo = await api.request('/api/onboarding', json({ modo: 'exemplo' }))
      expect(exemplo.status).toBe(200)
      expect(await ler(exemplo)).toEqual({ perfil: { ...conta.perfil, onboarding: 'exemplo' } })
      expect((await ler(await api.request('/api/estado'))).eventos).toHaveLength(EVENTOS.length)

      const vazio = await ler(await api.request('/api/onboarding', json({ modo: 'vazio' })))
      expect((vazio.perfil as { onboarding: string }).onboarding).toBe('vazio')
      expect((await ler(await api.request('/api/estado'))).eventos).toEqual([])
    })

    it('400 VALIDACAO para modo inválido', async () => {
      const api = logado(app, (await cadastrar(app)).cookie)
      const res = await api.request('/api/onboarding', json({ modo: 'pendente' }))
      expect(res.status).toBe(400)
      expect((await ler(res)).campos?.modo).toEqual(expect.any(String))
    })
  })

  describe('PATCH /api/perfil', () => {
    it('atualiza os campos enviados e ignora campos de controle', async () => {
      const conta = await cadastrar(app, { nome: 'Ana Teste', dataNascimento: '1980-05-20' })
      const api = logado(app, conta.cookie)
      const res = await api.request('/api/perfil', json({
        condicoes: ['Asma'], alergias: ['Penicilina'], cartaoSus: '123 4567', plano: 'Plano X',
        convidado: true, onboarding: 'exemplo', pacienteId: 'outro',
      }, 'PATCH'))
      expect(res.status).toBe(200)
      expect(await ler(res)).toEqual({
        perfil: { ...conta.perfil, condicoes: ['Asma'], alergias: ['Penicilina'], cartaoSus: '123 4567', plano: 'Plano X' },
      })
      const removido = await ler(await api.request('/api/perfil', json({ cartaoSus: '', dataNascimento: '' }, 'PATCH')))
      expect(removido.perfil).not.toHaveProperty('cartaoSus')
      expect(removido.perfil).not.toHaveProperty('idade')
      expect((await ler(await api.request('/api/auth/sessao'))).perfil).toEqual(removido.perfil)
    })

    it('400 VALIDACAO para nome vazio ou data inválida', async () => {
      const api = logado(app, (await cadastrar(app)).cookie)
      for (const corpo of [{ nome: '' }, { dataNascimento: '2026-02-30' }, { condicoes: 'Asma' }]) {
        const res = await api.request('/api/perfil', json(corpo, 'PATCH'))
        expect(res.status).toBe(400)
        expect((await ler(res)).codigo).toBe('VALIDACAO')
      }
    })
  })

  describe('DELETE /api/conta', () => {
    it('400 sem a confirmação EXCLUIR', async () => {
      const conta = await cadastrar(app)
      const res = await logado(app, conta.cookie).request('/api/conta', json({ confirmacao: 'sim' }, 'DELETE'))
      expect(res.status).toBe(400)
      expect((await ler(res)).campos?.confirmacao).toEqual(expect.any(String))
      expect(await repo.obterPerfil(conta.perfil.pacienteId)).not.toBeNull()
    })

    it('204 apaga usuário, sessões e dados; login depois → 401', async () => {
      const conta = await cadastrarComOnboarding(app, 'exemplo')
      const outra = await cadastrarComOnboarding(app, 'exemplo')
      const segundaSessao = cookieDe(await app.request('/api/auth/login',
        comSessao(null, json({ email: conta.email, senha: SENHA }))))

      const res = await logado(app, conta.cookie).request('/api/conta', json({ confirmacao: 'EXCLUIR' }, 'DELETE'))
      expect(res.status).toBe(204)
      expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/)

      expect(await repo.obterPerfil(conta.perfil.pacienteId)).toBeNull()
      expect((await repo.paraPaciente(conta.perfil.pacienteId).estado()).eventos).toEqual([])
      expect((await app.request('/api/estado', comSessao(conta.cookie))).status).toBe(401)
      expect((await app.request('/api/estado', comSessao(segundaSessao))).status).toBe(401)
      const login = await app.request('/api/auth/login', comSessao(null, json({ email: conta.email, senha: SENHA })))
      expect(login.status).toBe(401)
      expect((await ler(await app.request('/api/estado', comSessao(outra.cookie)))).eventos).toHaveLength(EVENTOS.length)
    })
  })
})
