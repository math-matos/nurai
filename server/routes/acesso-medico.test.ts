import { randomInt } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AcessoLog, Evento, ProximoPasso } from '../../src/data/types.js'
import { derivarFatos, pontosEmAberto } from '../ai/fatos.js'
import { criarLlmMock } from '../ai/mock.js'
import { criarApp } from '../app.js'
import { fecharPool } from '../db/conexao.js'
import { criarRepoMemoria } from '../db/memoria.js'
import { criarRepoOracle } from '../db/oracle.js'
import type { Compartilhamento, EstadoRepositorio, Repositorio } from '../db/repo.js'
import { aplicarSchema } from '../db/schema.js'
import { cadastrar, cadastrarComOnboarding, comSessao, json, logado, type App, type Conta } from '../teste/apoio.js'

type Corpo = Record<string, unknown> & { erro?: string; codigo?: string }
const ler = async (res: Response) => (await res.json()) as Corpo

const MINUTO = 60_000
const DIA = 24 * 60 * MINUTO
const PAPEL = 'Profissional de saúde (via código)'
const INVALIDO = { erro: 'Código inválido ou expirado', codigo: 'CODIGO_INVALIDO' }

const EVENTO_BRUNO: Evento = {
  id: 'b1', data: '2026-08-01', tipo: 'exame', titulo: 'Exame exclusivo do Bruno', instituicao: 'Lab Bruno',
  fonte: 'paciente', resumo: 'Só do Bruno.', sinal: 'normal', tags: ['bruno'], origem: 'Registro manual',
}

/* IP novo por teste: o limite por IP vive no banco, que no Oracle persiste entre execuções. */
const ipNovo = () => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`

function suiteAcessoMedico(nome: string, fabrica: () => Repositorio) {
  describe(`acesso do médico pelo código (${nome})`, () => {
    let repo: Repositorio
    let app: App
    let ana: Conta
    let bruno: Conta
    let ip: string

    beforeEach(async () => {
      repo = fabrica()
      app = criarApp({ repo, llm: criarLlmMock() })
      ip = ipNovo()
      ana = await cadastrarComOnboarding(app, 'exemplo', { nome: 'Ana Alves', dataNascimento: '1980-05-10' })
      await logado(app, ana.cookie).request('/api/perfil', json({ condicoes: ['Hipertensão'], alergias: ['Dipirona'] }, 'PATCH'))
      bruno = await cadastrarComOnboarding(app, 'vazio', { nome: 'Bruno Braga' })
      await logado(app, bruno.cookie).request('/api/eventos', json(EVENTO_BRUNO))
    })

    afterEach(async () => {
      vi.useRealTimers()
      await repo.excluirPaciente(ana.perfil.pacienteId)
      await repo.excluirPaciente(bruno.perfil.pacienteId)
    })

    const gerar = async (conta: Conta, para = 'Dra. Renata Aguiar') => {
      const res = await logado(app, conta.cookie).request('/api/compartilhamentos', json({ para }))
      expect(res.status).toBe(201)
      return (await res.json()) as Compartilhamento
    }
    const comIp = (init: RequestInit, deIp = ip) => {
      const headers = new Headers(init.headers)
      headers.set('x-forwarded-for', deIp)
      return { ...init, headers }
    }
    const acessar = (body: unknown, deIp = ip) => app.request('/api/acesso-medico', comSessao(null, comIp(json(body), deIp)))
    const resumir = (body: unknown, deIp = ip) =>
      app.request('/api/acesso-medico/resumo', comSessao(null, comIp(json(body), deIp)))
    const estadoDe = async (conta: Conta) =>
      (await (await logado(app, conta.cookie).request('/api/estado')).json()) as EstadoRepositorio
    const acessosDe = async (conta: Conta) =>
      (await (await logado(app, conta.cookie).request('/api/acessos')).json()) as AcessoLog[]

    describe('POST /api/compartilhamentos e GET /api/estado', () => {
      it('201 com codigo, criadoEm, para e expiraEm; estado mostra o ativo', async () => {
        const comp = await gerar(ana)
        expect(Object.keys(comp).sort()).toEqual(['codigo', 'criadoEm', 'expiraEm', 'para'])
        expect(comp.expiraEm).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)
        expect((await estadoDe(ana)).compartilhamento).toEqual(comp)
        expect((await estadoDe(bruno)).compartilhamento).toBeNull()
      })
    })

    describe('POST /api/acesso-medico', () => {
      it('200 com paciente, eventos e só os passos pendentes, sem sessão; código sem caixa e com espaços', async () => {
        const comp = await gerar(ana)
        const passo = (await estadoDe(ana)).passos[0]
        await logado(app, ana.cookie).request(`/api/passos/${passo.id}`, { method: 'PATCH' })
        const estado = await estadoDe(ana)

        const res = await acessar({ codigo: `  ${comp.codigo.toLowerCase()} `, profissional: '  Dra. Renata Aguiar ' })
        expect(res.status).toBe(200)
        const body = await ler(res)
        expect(Object.keys(body).sort()).toEqual(['eventos', 'expiraEm', 'paciente', 'para', 'passos', 'pontosEmAberto'])
        expect(body.paciente).toEqual({
          nome: 'Ana Alves', idade: expect.any(Number), condicoes: ['Hipertensão'], alergias: ['Dipirona'],
        })
        expect(body.para).toBe('Dra. Renata Aguiar')
        expect(body.expiraEm).toBe(comp.expiraEm)
        expect(body.eventos).toEqual(estado.eventos)
        const passos = body.passos as ProximoPasso[]
        expect(passos).toEqual(estado.passos.filter((p) => !p.feito))
        expect(passos.map((p) => p.id)).not.toContain(passo.id)
        expect(body.pontosEmAberto).toEqual(pontosEmAberto(derivarFatos(estado.eventos)))
      })

      it('pontos em aberto são calculados no acesso, mesmo sem nenhum passo gravado pelo paciente', async () => {
        await repo.paraPaciente(ana.perfil.pacienteId).substituirPassos([])
        const comp = await gerar(ana)
        const body = await ler(await acessar({ codigo: comp.codigo, profissional: 'Dra. Renata Aguiar' }))
        expect(body.passos).toEqual([])
        const pontos = body.pontosEmAberto as { texto: string; tipo: string; ancoras: string[] }[]
        expect(pontos[0]).toEqual({
          tipo: 'repeticao', ancoras: ['e22', 'e24'],
          texto: expect.stringMatching(/^Possível exame repetido: pedido de ultrassom de carótidas em 08\/07\/2026/),
        })
        expect(pontos.map((p) => p.tipo)).toEqual(expect.arrayContaining(['retorno', 'reavaliacao']))
        const ids = new Set((body.eventos as Evento[]).map((e) => e.id))
        expect(pontos.flatMap((p) => p.ancoras).every((id) => ids.has(id))).toBe(true)

        const vazio = await ler(await acessar({ codigo: (await gerar(bruno)).codigo, profissional: 'Dra. Renata Aguiar' }))
        expect(vazio.pontosEmAberto).toEqual([])
      })

      it('histórico gerenciado por um responsável: o médico vê o paciente e quem enviou as informações', async () => {
        const rafael = await cadastrar(app, { nome: 'Rafael Lima' })
        const api = logado(app, rafael.cookie)
        await api.request('/api/onboarding', json({
          modo: 'vazio', paciente: { nome: 'Marcos Vinícius Teixeira', dataNascimento: '1958-03-02', relacao: 'filho' },
        }))
        try {
          const comp = await gerar(rafael, 'Dr. Paulo')
          const body = await ler(await acessar({ codigo: comp.codigo, profissional: 'Dra. Renata Aguiar' }))
          expect(body.paciente).toEqual({
            nome: 'Marcos Vinícius Teixeira', idade: expect.any(Number), condicoes: [], alergias: [],
            responsavel: { nome: 'Rafael Lima', relacao: 'filho' },
          })
          const log = await acessosDe(rafael)
          expect(log.find((a) => a.acao === 'Gerou acesso temporário')).toMatchObject({ quem: 'Rafael Lima', papel: 'Responsável (filho)' })
        } finally {
          await repo.excluirPaciente(rafael.perfil.pacienteId)
        }
      })

      it('registra o acesso no log do paciente, e só no dele', async () => {
        const comp = await gerar(ana, 'Dr. Paulo')
        const antesBruno = await acessosDe(bruno)
        expect((await acessar({ codigo: comp.codigo, profissional: 'Dra. Renata Aguiar' })).status).toBe(200)
        expect((await acessosDe(ana))[0]).toMatchObject({
          quem: 'Dra. Renata Aguiar', papel: PAPEL, acao: 'Abriu o histórico pelo código', itens: 'Dr. Paulo',
        })
        expect(await acessosDe(bruno)).toEqual(antesBruno)
      })

      it('não expõe email, ids de usuário, pacienteId nem dados fora do contrato', async () => {
        const comp = await gerar(ana)
        const texto = await (await acessar({ codigo: comp.codigo, profissional: 'Dra. Renata Aguiar' })).text()
        expect(texto).not.toContain(ana.email)
        expect(texto).not.toContain(ana.usuario.id)
        expect(texto).not.toContain(ana.perfil.pacienteId)
        for (const campo of ['pacienteId', 'email', 'usuario', 'acessos', 'consentimentos', 'fontes', 'codigo']) {
          expect(texto).not.toContain(`"${campo}"`)
        }
      })

      it('o código de A não revela dados de B', async () => {
        const deAna = await gerar(ana)
        const deBruno = await gerar(bruno, 'Dr. Bruno')
        const texto = await (await acessar({ codigo: deAna.codigo, profissional: 'Dra. Renata Aguiar' })).text()
        expect(texto).not.toContain('Bruno')
        expect(texto).not.toContain(EVENTO_BRUNO.titulo)

        const body = await ler(await acessar({ codigo: deBruno.codigo, profissional: 'Dra. Renata Aguiar' }))
        expect(body.paciente).toEqual({ nome: 'Bruno Braga', condicoes: [], alergias: [] })
        expect(body.eventos).toEqual([EVENTO_BRUNO])
      })

      it('404 com a mesma mensagem para código inexistente, revogado ou expirado', async () => {
        const revogado = await gerar(ana, 'Dr. Revogado')
        expect((await logado(app, ana.cookie).request(`/api/compartilhamentos/${revogado.codigo}`, { method: 'DELETE' })).status).toBe(204)
        const expira = await gerar(ana, 'Dr. Expira')

        for (const codigo of ['ZZZZZ9', 'abc', revogado.codigo]) {
          const res = await acessar({ codigo, profissional: 'Dra. Renata Aguiar' })
          expect(res.status).toBe(404)
          expect(await ler(res)).toEqual(INVALIDO)
        }

        expect((await acessar({ codigo: expira.codigo, profissional: 'Dra. Renata Aguiar' })).status).toBe(200)
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(Date.now() + 30 * DIA + MINUTO)
        const res = await acessar({ codigo: expira.codigo, profissional: 'Dra. Renata Aguiar' })
        expect(res.status).toBe(404)
        expect(await ler(res)).toEqual(INVALIDO)
      })

      it('tentativa com código revogado ou expirado vai para o log do dono, só com o fim do código', async () => {
        const logDeAna = () => repo.paraPaciente(ana.perfil.pacienteId).listarAcessos()
        const revogado = await gerar(ana, 'Dr. Revogado')
        await logado(app, ana.cookie).request(`/api/compartilhamentos/${revogado.codigo}`, { method: 'DELETE' })
        const antesBruno = await acessosDe(bruno)

        const res = await acessar({ codigo: revogado.codigo.toLowerCase(), profissional: 'Dr. Curioso' })
        expect(res.status).toBe(404)
        expect(await ler(res)).toEqual(INVALIDO)
        const [recusa] = await logDeAna()
        expect(recusa).toMatchObject({
          quem: 'Dr. Curioso', papel: PAPEL, acao: 'Tentativa recusada: código revogado', itens: `••••${revogado.codigo.slice(-2)}`,
        })
        expect(JSON.stringify(await logDeAna())).not.toContain(revogado.codigo)

        expect((await resumir({ codigo: revogado.codigo, profissional: 'Dr. Curioso' })).status).toBe(404)
        expect((await logDeAna())[0].acao).toBe('Tentativa recusada: código revogado')

        /* Código inexistente não tem dono: não registra em lugar nenhum. */
        const antes = await logDeAna()
        expect((await acessar({ codigo: 'ZZZZZ9', profissional: 'Dr. Curioso' })).status).toBe(404)
        expect(await logDeAna()).toEqual(antes)
        expect(await acessosDe(bruno)).toEqual(antesBruno)

        const expira = await gerar(ana, 'Dr. Expira')
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(Date.now() + 30 * DIA + MINUTO)
        expect((await acessar({ codigo: expira.codigo, profissional: 'Dra. Atrasada' })).status).toBe(404)
        expect((await logDeAna())[0]).toMatchObject({
          quem: 'Dra. Atrasada', papel: PAPEL, acao: 'Tentativa recusada: código expirado', itens: `••••${expira.codigo.slice(-2)}`,
        })
      })

      it('400 para profissional com menos de 3 ou mais de 120 caracteres, ou sem código', async () => {
        const comp = await gerar(ana)
        for (const body of [
          { codigo: comp.codigo, profissional: '  ab  ' },
          { codigo: comp.codigo, profissional: 'x'.repeat(121) },
          { profissional: 'Dra. Renata Aguiar' },
        ]) {
          const res = await acessar(body)
          expect(res.status).toBe(400)
          expect((await ler(res)).codigo).toBe('VALIDACAO')
        }
        expect((await acessar({ codigo: comp.codigo, profissional: 'x'.repeat(120) })).status).toBe(200)
      })

      it('exige o cabeçalho anti-CSRF', async () => {
        const comp = await gerar(ana)
        const res = await app.request('/api/acesso-medico', comIp(json({ codigo: comp.codigo, profissional: 'Dra. Renata' })))
        expect(res.status).toBe(403)
      })

      it('429 na 11ª tentativa do IP no minuto, contando acertos, erros e resumos', async () => {
        const comp = await gerar(ana)
        const valido = { codigo: comp.codigo, profissional: 'Dra. Renata Aguiar' }
        for (let i = 0; i < 4; i++) expect((await acessar(valido)).status).toBe(200)
        for (let i = 0; i < 4; i++) expect((await acessar({ ...valido, codigo: 'ZZZZZ9' })).status).toBe(404)
        expect((await acessar({ codigo: comp.codigo })).status).toBe(400)
        expect((await resumir(valido)).status).toBe(200)

        const res = await acessar(valido)
        expect(res.status).toBe(429)
        expect((await ler(res)).codigo).toBe('MUITAS_TENTATIVAS')
        expect(res.headers.get('retry-after')).toBe('60')
        expect((await resumir(valido)).status).toBe(429)
        expect((await acessar(valido, ipNovo())).status).toBe(200)

        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(Date.now() + MINUTO + 1000)
        expect((await acessar(valido)).status).toBe(200)
      })
    })

    describe('POST /api/acesso-medico/verificar', () => {
      const verificar = (body: unknown, deIp = ip) =>
        app.request('/api/acesso-medico/verificar', comSessao(null, comIp(json(body), deIp)))

      it('204 para código ativo e 404 genérico para revogado ou inexistente, sem registrar nada', async () => {
        const comp = await gerar(ana)
        const antes = await acessosDe(ana)
        const ok = await verificar({ codigo: ` ${comp.codigo.toLowerCase()} ` })
        expect(ok.status).toBe(204)

        await logado(app, ana.cookie).request(`/api/compartilhamentos/${comp.codigo}`, { method: 'DELETE' })
        const depois = await acessosDe(ana)
        for (const codigo of [comp.codigo, 'ZZZZZ9']) {
          const res = await verificar({ codigo })
          expect(res.status).toBe(404)
          expect(await ler(res)).toEqual(INVALIDO)
        }
        expect(await acessosDe(ana)).toEqual(depois)
        expect(depois.length).toBe(antes.length + 1)
        expect((await verificar({})).status).toBe(400)
      })

      /* Tela aberta revalidando (vários profissionais atrás do mesmo IP) não pode bloquear a abertura, e vice-versa. */
      it('tem limite por IP próprio, separado do acesso pelo código', async () => {
        const comp = await gerar(ana)
        const valido = { codigo: comp.codigo, profissional: 'Dra. Renata Aguiar' }
        for (let i = 0; i < 15; i++) expect((await verificar({ codigo: comp.codigo })).status).toBe(204)
        expect((await acessar(valido)).status).toBe(200)

        for (let i = 0; i < 9; i++) expect((await acessar(valido)).status).toBe(200)
        expect((await acessar(valido)).status).toBe(429)
        expect((await verificar({ codigo: comp.codigo })).status).toBe(204)
      })

      it('429 na 61ª verificação do IP no minuto', async () => {
        const comp = await gerar(ana)
        for (let i = 0; i < 60; i++) expect((await verificar({ codigo: i % 2 ? comp.codigo : 'ZZZZZ9' })).status).toBe(i % 2 ? 204 : 404)
        const res = await verificar({ codigo: comp.codigo })
        expect(res.status).toBe(429)
        expect((await ler(res)).codigo).toBe('MUITAS_TENTATIVAS')
        expect((await verificar({ codigo: comp.codigo }, ipNovo())).status).toBe(204)
        expect((await acessar({ codigo: comp.codigo, profissional: 'Dra. Renata Aguiar' })).status).toBe(200)
      })
    })

    describe('POST /api/acesso-medico/resumo', () => {
      it('200 no mesmo formato de /api/resumo e registra o acesso do profissional', async () => {
        const comp = await gerar(ana)
        const res = await resumir({ codigo: comp.codigo, profissional: 'Dra. Renata Aguiar', especialidade: 'Cardiologia' })
        expect(res.status).toBe(200)
        const body = await ler(res)
        expect(Object.keys(body).sort()).toEqual(['aviso', 'especialidade', 'geradoPor', 'perguntasSugeridas', 'pontos', 'sintese'])
        expect(body).toMatchObject({ especialidade: 'Cardiologia', geradoPor: 'mock' })

        const doTitular = await (await logado(app, ana.cookie).request('/api/resumo', json({ especialidade: 'Cardiologia' }))).json()
        expect(body).toEqual(doTitular)

        expect((await acessosDe(ana)).find((a) => a.quem === 'Dra. Renata Aguiar')).toMatchObject({
          papel: PAPEL, acao: 'Gerou resumo pré-consulta pelo código', itens: 'Cardiologia',
        })
      })

      it('especialidade livre sem registros relacionados responde 200 explicando que não há base', async () => {
        const comp = await gerar(bruno)
        const res = await resumir({ codigo: comp.codigo, profissional: 'Dra. Renata Aguiar', especialidade: 'Pneumologia' })
        expect(res.status).toBe(200)
        const body = await ler(res)
        expect(body).toMatchObject({ especialidade: 'Pneumologia', pontos: [], geradoPor: 'mock' })
        expect((body.sintese as string[]).join(' ')).toMatch(/Pneumologia/)
      })

      it('especialidade é opcional', async () => {
        const comp = await gerar(ana)
        const res = await resumir({ codigo: comp.codigo, profissional: 'Dra. Renata Aguiar' })
        expect(res.status).toBe(200)
        expect((await ler(res)).especialidade).toBeTypeOf('string')
      })

      it('404 para código inválido e 400 para profissional curto', async () => {
        const comp = await gerar(ana)
        const res = await resumir({ codigo: 'ZZZZZ9', profissional: 'Dra. Renata Aguiar' })
        expect(res.status).toBe(404)
        expect(await ler(res)).toEqual(INVALIDO)
        expect((await resumir({ codigo: comp.codigo, profissional: 'ab' })).status).toBe(400)
      })
    })

    describe('DELETE /api/compartilhamentos/:codigo', () => {
      it('204, registra a revogação e o código deixa de abrir o histórico', async () => {
        const comp = await gerar(ana, 'Dr. Paulo')
        const res = await logado(app, ana.cookie).request(`/api/compartilhamentos/${comp.codigo.toLowerCase()}`, { method: 'DELETE' })
        expect(res.status).toBe(204)
        expect((await acessosDe(ana))[0]).toMatchObject({
          quem: 'Ana Alves', papel: 'Titular', acao: 'Revogou acesso temporário', itens: 'Dr. Paulo',
        })
        expect((await estadoDe(ana)).compartilhamento).toBeNull()
        expect((await acessar({ codigo: comp.codigo, profissional: 'Dra. Renata Aguiar' })).status).toBe(404)
      })

      it('404 para o código de outro paciente, que continua valendo', async () => {
        const deAna = await gerar(ana)
        const res = await logado(app, bruno.cookie).request(`/api/compartilhamentos/${deAna.codigo}`, { method: 'DELETE' })
        expect(res.status).toBe(404)
        expect((await acessar({ codigo: deAna.codigo, profissional: 'Dra. Renata Aguiar' })).status).toBe(200)
      })

      it('401 sem sessão', async () => {
        const comp = await gerar(ana)
        expect((await app.request(`/api/compartilhamentos/${comp.codigo}`, comSessao(null, { method: 'DELETE' }))).status).toBe(401)
      })
    })
  })
}

suiteAcessoMedico('memoria', criarRepoMemoria)

/* Mesmo contrato contra um Oracle de verdade: ORACLE_DB_TEST=1 + ORACLE_DB_* (ex.: container local). */
describe.skipIf(process.env.ORACLE_DB_TEST !== '1')('Oracle', () => {
  beforeAll(async () => {
    await aplicarSchema()
  }, 60_000)

  afterAll(async () => {
    await fecharPool()
  })

  suiteAcessoMedico('oracle', criarRepoOracle)
})
