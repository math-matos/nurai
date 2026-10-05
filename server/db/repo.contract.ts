import { beforeEach, describe, expect, it } from 'vitest'
import {
  ACESSOS, CONSENTIMENTOS, EVENTOS, FONTES_CONECTADAS, PROXIMOS_PASSOS,
} from '../../src/data/seed.js'
import type { Evento, ProximoPasso } from '../../src/data/types.js'
import { ErroConflito, type Repositorio } from './repo.js'

const AUTOR = 'Helena Duarte Nogueira'
const FORMATO_QUANDO = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/
const FORMATO_DIA = /^\d{2}\/\d{2}\/\d{4}$/

const EVENTO_NOVO: Evento = {
  id: 'u1', data: '2026-09-01', tipo: 'exame', titulo: 'Perfil lipídico',
  instituicao: 'Laboratório Teste', fonte: 'paciente', resumo: 'Documento enviado.',
  sinal: 'alterado', tags: ['colesterol'], origem: 'OCR + IA', confianca: 0.93,
  documento: 'perfil.pdf', novo: true,
  medidas: [{ nome: 'LDL', valor: 162, unidade: 'mg/dL', refMin: 0, refMax: 130, sinal: 'alterado' }],
}

export function suiteRepositorio(nome: string, fabrica: () => Repositorio | Promise<Repositorio>) {
  describe(`Repositorio (${nome})`, () => {
    let repo: Repositorio

    beforeEach(async () => {
      repo = await fabrica()
      await repo.reiniciar()
    })

    it('começa com o estado do seed', async () => {
      expect(await repo.estado()).toEqual({
        eventos: EVENTOS,
        consentimentos: CONSENTIMENTOS,
        acessos: ACESSOS,
        passos: PROXIMOS_PASSOS,
        fontes: FONTES_CONECTADAS,
        compartilhamento: null,
      })
    })

    it('estado() devolve uma cópia que não altera o repositório', async () => {
      const e = await repo.estado()
      e.eventos.pop()
      e.consentimentos[0].ativo = !e.consentimentos[0].ativo
      expect((await repo.estado()).eventos).toHaveLength(EVENTOS.length)
      expect((await repo.estado()).consentimentos[0].ativo).toBe(CONSENTIMENTOS[0].ativo)
    })

    describe('adicionarEvento', () => {
      it('anexa o evento ao fim e registra o acesso do autor', async () => {
        const salvo = await repo.adicionarEvento(EVENTO_NOVO, AUTOR)
        expect(salvo).toEqual(EVENTO_NOVO)

        const { eventos, acessos } = await repo.estado()
        expect(eventos).toHaveLength(EVENTOS.length + 1)
        expect(eventos.at(-1)).toEqual(EVENTO_NOVO)
        expect(acessos).toHaveLength(ACESSOS.length + 1)
        expect(acessos[0]).toMatchObject({
          quem: AUTOR, papel: 'Titular', acao: 'Anexou documento ao histórico', itens: 'Perfil lipídico',
        })
        expect(acessos[0].id).toMatch(/^a/)
        expect(acessos[0].quando).toMatch(FORMATO_QUANDO)
      })
    })

    describe('adicionarEvento com id repetido', () => {
      it('lança ErroConflito sem gravar o evento nem o acesso', async () => {
        await repo.adicionarEvento(EVENTO_NOVO, AUTOR)
        const antes = await repo.estado()
        await expect(repo.adicionarEvento({ ...EVENTO_NOVO, titulo: 'Outro' }, AUTOR))
          .rejects.toBeInstanceOf(ErroConflito)
        expect(await repo.estado()).toEqual(antes)
      })

      it('também para id que já vem do seed', async () => {
        await expect(repo.adicionarEvento({ ...EVENTO_NOVO, id: EVENTOS[0].id }, AUTOR))
          .rejects.toBeInstanceOf(ErroConflito)
        expect((await repo.estado()).eventos).toEqual(EVENTOS)
      })
    })

    describe('alternarConsentimento', () => {
      it('revoga um consentimento ativo e registra "Revogou acesso"', async () => {
        const c = await repo.alternarConsentimento('c1', AUTOR)
        expect(c).toMatchObject({ id: 'c1', ativo: false })

        const { consentimentos, acessos } = await repo.estado()
        expect(consentimentos.find((x) => x.id === 'c1')?.ativo).toBe(false)
        expect(acessos[0]).toMatchObject({
          quem: AUTOR, papel: 'Titular', acao: 'Revogou acesso',
          itens: 'Rede Nacional de Dados em Saúde (RNDS)',
        })
        expect(acessos[0].quando).toMatch(FORMATO_QUANDO)
      })

      it('concede um consentimento inativo e registra "Concedeu acesso"', async () => {
        const c = await repo.alternarConsentimento('c5', AUTOR)
        expect(c).toMatchObject({ id: 'c5', ativo: true })
        expect((await repo.listarAcessos())[0]).toMatchObject({
          acao: 'Concedeu acesso', itens: 'Vitalis Saúde (operadora)',
        })
      })

      it('devolve null e não registra acesso para id inexistente', async () => {
        expect(await repo.alternarConsentimento('nao-existe', AUTOR)).toBeNull()
        expect(await repo.listarAcessos()).toEqual(ACESSOS)
      })
    })

    describe('alternarPasso', () => {
      it('inverte "feito" sem registrar acesso', async () => {
        expect(await repo.alternarPasso('p1')).toMatchObject({ id: 'p1', feito: true })
        expect((await repo.estado()).passos.find((p) => p.id === 'p1')?.feito).toBe(true)
        expect(await repo.alternarPasso('p1')).toMatchObject({ id: 'p1', feito: false })
        expect(await repo.listarAcessos()).toEqual(ACESSOS)
      })

      it('devolve null para id inexistente', async () => {
        expect(await repo.alternarPasso('nao-existe')).toBeNull()
      })
    })

    describe('substituirPassos', () => {
      it('troca a lista inteira de passos', async () => {
        const novos: ProximoPasso[] = [{
          id: 'p9', titulo: 'Novo passo', porque: 'Motivo', ancoras: ['e01'],
          prazo: 'Em até 30 dias', prioridade: 'baixa', feito: false,
        }]
        expect(await repo.substituirPassos(novos)).toEqual(novos)
        expect((await repo.estado()).passos).toEqual(novos)
      })
    })

    describe('criarCompartilhamento', () => {
      it('gera código de 6 caracteres e registra o acesso temporário', async () => {
        const comp = await repo.criarCompartilhamento('Dra. Renata Aguiar', AUTOR)
        expect(comp.codigo).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)
        expect(comp.para).toBe('Dra. Renata Aguiar')
        expect(comp.criadoEm).toMatch(FORMATO_QUANDO)

        const { compartilhamento, acessos } = await repo.estado()
        expect(compartilhamento).toEqual(comp)
        expect(acessos[0]).toMatchObject({
          quem: AUTOR, papel: 'Titular', acao: 'Gerou acesso temporário',
          itens: 'Dra. Renata Aguiar, 30 dias',
        })
      })
    })

    describe('conectarFonte', () => {
      it('marca a fonte como conectada com a data de hoje', async () => {
        const f = await repo.conectarFonte('f5')
        expect(f).toMatchObject({ id: 'f5', estado: 'conectado' })
        expect(f?.ultima).toMatch(FORMATO_DIA)
        expect((await repo.estado()).fontes.find((x) => x.id === 'f5')).toEqual(f)
      })

      it('devolve null para id inexistente', async () => {
        expect(await repo.conectarFonte('nao-existe')).toBeNull()
      })
    })

    describe('acessos', () => {
      it('listarAcessos espelha estado().acessos', async () => {
        expect(await repo.listarAcessos()).toEqual((await repo.estado()).acessos)
      })

      it('registrarAcesso completa id e quando e coloca no topo', async () => {
        const log = await repo.registrarAcesso({
          quem: 'Assistente Nurai', papel: 'IA', acao: 'Consultou o histórico', itens: '3 eventos',
        })
        expect(log.id).toMatch(/^a/)
        expect(log.quando).toMatch(FORMATO_QUANDO)
        expect((await repo.listarAcessos())[0]).toEqual(log)
      })

      it('gera ids distintos para ações no mesmo instante', async () => {
        await repo.alternarConsentimento('c1', AUTOR)
        await repo.alternarConsentimento('c1', AUTOR)
        const [a, b] = await repo.listarAcessos()
        expect(a.id).not.toBe(b.id)
      })
    })

    describe('reiniciar', () => {
      it('volta ao estado do seed após mudanças', async () => {
        await repo.adicionarEvento(EVENTO_NOVO, AUTOR)
        await repo.alternarConsentimento('c1', AUTOR)
        await repo.alternarPasso('p1')
        await repo.conectarFonte('f5')
        await repo.criarCompartilhamento('Dr. X', AUTOR)
        await repo.reiniciar()
        const e = await repo.estado()
        expect(e.eventos).toEqual(EVENTOS)
        expect(e.consentimentos).toEqual(CONSENTIMENTOS)
        expect(e.acessos).toEqual(ACESSOS)
        expect(e.passos).toEqual(PROXIMOS_PASSOS)
        expect(e.fontes).toEqual(FONTES_CONECTADAS)
        expect(e.compartilhamento).toBeNull()
      })
    })
  })
}
