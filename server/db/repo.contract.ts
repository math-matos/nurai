import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Evento, ProximoPasso } from '../../src/data/types.js'
import { dadosExemplo } from './exemplo.js'
import {
  ErroConflito, type Perfil, type Repositorio, type RepositorioPaciente,
} from './repo.js'

const AUTOR = 'Paciente Teste da Silva'
const ACAO_EXCLUIR = 'Excluiu registro do histórico'
const EXEMPLO = dadosExemplo(AUTOR)
const FORMATO_QUANDO = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/
const FORMATO_DIA = /^\d{2}\/\d{2}\/\d{4}$/
const MINUTO = 60_000
const DIA = 24 * 60 * MINUTO

/* 'DD/MM/AAAA HH:mm' para ms, no mesmo fuso para os dois lados: só serve para diferenças. */
function quandoParaMs(quando: string) {
  const [d, m, a, h, min] = quando.split(/[/ :]/).map(Number)
  return Date.UTC(a, m - 1, d, h, min)
}

const EVENTO_NOVO: Evento = {
  id: 'u1', data: '2026-09-01', tipo: 'exame', titulo: 'Perfil lipídico',
  instituicao: 'Laboratório Teste', fonte: 'paciente', resumo: 'Documento enviado.',
  sinal: 'alterado', tags: ['colesterol'], origem: 'OCR + IA', confianca: 0.93,
  documento: 'perfil.pdf', novo: true,
  medidas: [{ nome: 'LDL', valor: 162, unidade: 'mg/dL', refMin: 0, refMax: 130, sinal: 'alterado' }],
}

/* O Oracle de teste persiste entre execuções: emails e chaves únicos, e cada teste apaga quem criou. */
const emailUnico = (prefixo = 'teste') => `${prefixo}+${randomUUID()}@exemplo.com`

export function suiteRepositorio(nome: string, fabrica: () => Repositorio | Promise<Repositorio>) {
  describe(`Repositorio (${nome})`, () => {
    let raiz: Repositorio
    let criados: string[]

    beforeEach(async () => {
      raiz = await fabrica()
      criados = []
    })

    afterEach(async () => {
      for (const id of criados) await raiz.excluirPaciente(id)
    })

    async function novoPaciente(modo: 'pendente' | 'vazio' | 'exemplo' = 'exemplo', nomePaciente = AUTOR) {
      const perfil = await raiz.criarPaciente({ nome: nomePaciente, convidado: false })
      criados.push(perfil.pacienteId)
      if (modo !== 'pendente') await raiz.aplicarOnboarding(perfil.pacienteId, modo)
      return { perfil, repo: raiz.paraPaciente(perfil.pacienteId) }
    }

    describe('dados do paciente', () => {
      let repo: RepositorioPaciente

      beforeEach(async () => {
        repo = (await novoPaciente('exemplo')).repo
      })

      it('onboarding exemplo começa com o seed, com o nome do titular no log', async () => {
        expect(await repo.estado()).toEqual({ ...EXEMPLO, compartilhamento: null })
        expect(EXEMPLO.acessos.filter((a) => a.papel === 'Titular').map((a) => a.quem)).toEqual([AUTOR])
      })

      it('estado() devolve uma cópia que não altera o repositório', async () => {
        const e = await repo.estado()
        e.eventos.pop()
        e.consentimentos[0].ativo = !e.consentimentos[0].ativo
        expect((await repo.estado()).eventos).toHaveLength(EXEMPLO.eventos.length)
        expect((await repo.estado()).consentimentos[0].ativo).toBe(EXEMPLO.consentimentos[0].ativo)
      })

      describe('adicionarEvento', () => {
        it('anexa o evento ao fim e registra o acesso do autor', async () => {
          const salvo = await repo.adicionarEvento(EVENTO_NOVO, AUTOR)
          expect(salvo).toEqual(EVENTO_NOVO)

          const { eventos, acessos } = await repo.estado()
          expect(eventos).toHaveLength(EXEMPLO.eventos.length + 1)
          expect(eventos.at(-1)).toEqual(EVENTO_NOVO)
          expect(acessos).toHaveLength(EXEMPLO.acessos.length + 1)
          expect(acessos[0]).toMatchObject({
            quem: AUTOR, papel: 'Titular', acao: 'Anexou documento ao histórico', itens: 'Perfil lipídico',
          })
          expect(acessos[0].id).toMatch(/^a/)
          expect(acessos[0].quando).toMatch(FORMATO_QUANDO)
        })

        it('com papel informado (responsável), as ações vão para o log com ele', async () => {
          const [quem, papel] = ['Rafael Lima', 'Responsável (filho)']
          await repo.adicionarEvento(EVENTO_NOVO, quem, papel)
          await repo.excluirEvento(EVENTO_NOVO.id, quem, papel)
          await repo.alternarConsentimento('c1', quem, papel)
          const { codigo } = await repo.criarCompartilhamento('Dr. X', quem, papel)
          await repo.revogarCompartilhamento(codigo, quem, papel)
          const novos = (await repo.listarAcessos()).slice(0, 5)
          expect(novos.map((a) => a.acao)).toEqual([
            'Revogou acesso temporário', 'Gerou acesso temporário', 'Revogou acesso', ACAO_EXCLUIR, 'Anexou documento ao histórico',
          ])
          expect(novos.every((a) => a.quem === quem && a.papel === papel)).toBe(true)
        })

        /* O Oracle grava '' como NULL: string opcional vazia equivale a campo ausente nos dois repositórios. */
        it('trata especialidade e documento vazios como ausentes', async () => {
          const comVazios = { ...EVENTO_NOVO, especialidade: '', documento: '' }
          const esperado = Object.fromEntries(Object.entries(comVazios).filter(([, v]) => v !== ''))
          expect(await repo.adicionarEvento(comVazios, AUTOR)).toEqual(esperado)
          const salvo = (await repo.estado()).eventos.at(-1)
          expect(salvo).toEqual(esperado)
          expect(salvo).not.toHaveProperty('especialidade')
          expect(salvo).not.toHaveProperty('documento')
        })

        /* Medidas vão como JSON: o lado ausente da faixa não pode voltar como null. Evento antigo,
           com os dois limites, segue igual. */
        it('guarda faixa unilateral (só piso, só teto) sem criar o limite ausente', async () => {
          const unilateral: Evento = {
            ...EVENTO_NOVO, id: 'u-unilateral',
            medidas: [
              { nome: 'HDL', valor: 38, unidade: 'mg/dL', refMin: 40, sinal: 'alterado' },
              { nome: 'LDL', valor: 138, unidade: 'mg/dL', refMax: 130, sinal: 'alterado' },
              { nome: 'Glicemia', valor: 96, unidade: 'mg/dL', refMin: 70, refMax: 99, sinal: 'normal' },
            ],
          }
          await repo.adicionarEvento(unilateral, AUTOR)
          const salvo = (await repo.estado()).eventos.find((e) => e.id === 'u-unilateral')!
          expect(salvo).toEqual(unilateral)
          expect(salvo.medidas![0]).not.toHaveProperty('refMax')
          expect(salvo.medidas![1]).not.toHaveProperty('refMin')
        })

        it('id repetido lança ErroConflito sem gravar o evento nem o acesso', async () => {
          await repo.adicionarEvento(EVENTO_NOVO, AUTOR)
          const antes = await repo.estado()
          await expect(repo.adicionarEvento({ ...EVENTO_NOVO, titulo: 'Outro' }, AUTOR))
            .rejects.toBeInstanceOf(ErroConflito)
          expect(await repo.estado()).toEqual(antes)
        })

        it('id repetido também para id que já vem do seed', async () => {
          await expect(repo.adicionarEvento({ ...EVENTO_NOVO, id: EXEMPLO.eventos[0].id }, AUTOR))
            .rejects.toBeInstanceOf(ErroConflito)
          expect((await repo.estado()).eventos).toEqual(EXEMPLO.eventos)
        })
      })

      describe('excluirEvento', () => {
        it('apaga o evento e registra título e data no log', async () => {
          await repo.adicionarEvento(EVENTO_NOVO, AUTOR)
          expect(await repo.excluirEvento('u1', AUTOR)).toBe(true)

          const { eventos, acessos } = await repo.estado()
          expect(eventos).toEqual(EXEMPLO.eventos)
          expect(acessos[0]).toMatchObject({
            quem: AUTOR, papel: 'Titular', acao: 'Excluiu registro do histórico', itens: 'Perfil lipídico, 01/09/2026',
          })
          expect(acessos[0].quando).toMatch(FORMATO_QUANDO)
          expect(await repo.listarAcessos()).toEqual(acessos)
        })

        it('tira o id das âncoras e apaga o passo que fica sem nenhuma', async () => {
          await repo.alternarPasso('p1')
          expect(await repo.excluirEvento('e22', AUTOR)).toBe(true)
          expect(await repo.excluirEvento('e14', AUTOR)).toBe(true)

          const { passos } = await repo.estado()
          expect(passos.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4'])
          expect(passos[0]).toMatchObject({ ancoras: ['e24'], feito: true })
          expect(passos.slice(1)).toEqual(EXEMPLO.passos.slice(1, 4))
        })

        it('mantém passo que já não tinha âncora', async () => {
          const semAncora: ProximoPasso = {
            id: 'p9', titulo: 'Passo livre', porque: '', ancoras: [], prazo: '', prioridade: 'baixa', feito: false,
          }
          await repo.substituirPassos([...EXEMPLO.passos, semAncora])
          await repo.excluirEvento('e14', AUTOR)
          expect((await repo.estado()).passos.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p9'])
        })

        it('devolve false e não muda nada para id inexistente', async () => {
          const antes = await repo.estado()
          expect(await repo.excluirEvento('nao-existe', AUTOR)).toBe(false)
          expect(await repo.estado()).toEqual(antes)
        })

        it('excluir de novo devolve false sem duplicar o log', async () => {
          await repo.excluirEvento('e14', AUTOR)
          const antes = await repo.listarAcessos()
          expect(await repo.excluirEvento('e14', AUTOR)).toBe(false)
          expect(await repo.listarAcessos()).toEqual(antes)
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
          expect(await repo.listarAcessos()).toEqual(EXEMPLO.acessos)
        })
      })

      describe('alternarPasso', () => {
        it('inverte "feito" sem registrar acesso', async () => {
          expect(await repo.alternarPasso('p1')).toMatchObject({ id: 'p1', feito: true })
          expect((await repo.estado()).passos.find((p) => p.id === 'p1')?.feito).toBe(true)
          expect(await repo.alternarPasso('p1')).toMatchObject({ id: 'p1', feito: false })
          expect(await repo.listarAcessos()).toEqual(EXEMPLO.acessos)
        })

        it('devolve null para id inexistente', async () => {
          expect(await repo.alternarPasso('nao-existe')).toBeNull()
        })
      })

      it('substituirPassos troca a lista inteira de passos', async () => {
        const novos: ProximoPasso[] = [{
          id: 'p9', titulo: 'Novo passo', porque: 'Motivo', ancoras: ['e01'],
          prazo: 'Em até 30 dias', prioridade: 'baixa', feito: false,
        }]
        expect(await repo.substituirPassos(novos)).toEqual(novos)
        expect((await repo.estado()).passos).toEqual(novos)
      })

      it('criarCompartilhamento gera código de 6 caracteres e registra o acesso temporário', async () => {
        const comp = await repo.criarCompartilhamento('Dra. Renata Aguiar', AUTOR)
        expect(comp.codigo).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)
        expect(comp.para).toBe('Dra. Renata Aguiar')
        expect(comp.criadoEm).toMatch(FORMATO_QUANDO)
        expect(comp.expiraEm).toMatch(FORMATO_QUANDO)
        expect(quandoParaMs(comp.expiraEm) - quandoParaMs(comp.criadoEm)).toBe(30 * DIA)

        const { compartilhamento, acessos } = await repo.estado()
        expect(compartilhamento).toEqual(comp)
        expect(acessos[0]).toMatchObject({
          quem: AUTOR, papel: 'Titular', acao: 'Gerou acesso temporário',
          itens: 'Dra. Renata Aguiar, 30 dias',
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

      it('reiniciar volta ao histórico de exemplo após mudanças', async () => {
        await repo.adicionarEvento(EVENTO_NOVO, AUTOR)
        await repo.alternarConsentimento('c1', AUTOR)
        await repo.alternarPasso('p1')
        await repo.conectarFonte('f5')
        await repo.criarCompartilhamento('Dr. X', AUTOR)
        await repo.reiniciar()
        expect(await repo.estado()).toEqual({ ...EXEMPLO, compartilhamento: null })
      })
    })

    describe('compartilhamentos', () => {
      let a: { perfil: Perfil; repo: RepositorioPaciente }
      let b: { perfil: Perfil; repo: RepositorioPaciente }

      beforeEach(async () => {
        a = await novoPaciente('exemplo', 'Ana Alves')
        b = await novoPaciente('exemplo', 'Bruno Braga')
      })

      afterEach(() => {
        vi.useRealTimers()
      })

      it('buscarCompartilhamentoAtivo encontra o paciente pelo código', async () => {
        const comp = await a.repo.criarCompartilhamento('Dr. X', 'Ana Alves')
        expect(await raiz.buscarCompartilhamentoAtivo(comp.codigo)).toEqual({
          pacienteId: a.perfil.pacienteId, para: 'Dr. X', expiraEm: comp.expiraEm,
        })
        expect(await raiz.buscarCompartilhamentoAtivo('ZZZZZ9')).toBeNull()
      })

      it('estado mostra o compartilhamento ativo mais recente', async () => {
        const primeiro = await a.repo.criarCompartilhamento('Dr. Um', 'Ana Alves')
        const segundo = await a.repo.criarCompartilhamento('Dr. Dois', 'Ana Alves')
        expect((await a.repo.estado()).compartilhamento).toEqual(segundo)
        expect(await a.repo.revogarCompartilhamento(segundo.codigo, 'Ana Alves')).toBe(true)
        expect((await a.repo.estado()).compartilhamento).toEqual(primeiro)
        await a.repo.revogarCompartilhamento(primeiro.codigo, 'Ana Alves')
        expect((await a.repo.estado()).compartilhamento).toBeNull()
      })

      it('revogar desativa o código e registra o acesso; repetir não duplica o log', async () => {
        const comp = await a.repo.criarCompartilhamento('Dr. X', 'Ana Alves')
        expect(await a.repo.revogarCompartilhamento(comp.codigo, 'Ana Alves')).toBe(true)
        expect(await raiz.buscarCompartilhamentoAtivo(comp.codigo)).toBeNull()
        const acessos = await a.repo.listarAcessos()
        expect(acessos[0]).toMatchObject({
          quem: 'Ana Alves', papel: 'Titular', acao: 'Revogou acesso temporário', itens: 'Dr. X',
        })
        expect(await a.repo.revogarCompartilhamento(comp.codigo, 'Ana Alves')).toBe(true)
        expect(await a.repo.listarAcessos()).toEqual(acessos)
      })

      it('A não revoga o código de B', async () => {
        const deB = await b.repo.criarCompartilhamento('Dr. Y', 'Bruno Braga')
        const acessosA = await a.repo.listarAcessos()
        expect(await a.repo.revogarCompartilhamento(deB.codigo, 'Ana Alves')).toBe(false)
        expect(await a.repo.revogarCompartilhamento('ZZZZZ9', 'Ana Alves')).toBe(false)
        expect(await a.repo.listarAcessos()).toEqual(acessosA)
        expect((await raiz.buscarCompartilhamentoAtivo(deB.codigo))?.pacienteId).toBe(b.perfil.pacienteId)
      })

      it('expira 30 dias depois de criado', async () => {
        const comp = await a.repo.criarCompartilhamento('Dr. X', 'Ana Alves')
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(Date.now() + 30 * DIA - 2 * MINUTO)
        expect(await raiz.buscarCompartilhamentoAtivo(comp.codigo)).not.toBeNull()
        vi.setSystemTime(Date.now() + 3 * MINUTO)
        expect(await raiz.buscarCompartilhamentoAtivo(comp.codigo)).toBeNull()
        expect((await a.repo.estado()).compartilhamento).toBeNull()
      })

      it('buscarCompartilhamento diz a situação do código, inclusive revogado e expirado', async () => {
        const vivo = await a.repo.criarCompartilhamento('Dr. Vivo', 'Ana Alves')
        const revogado = await a.repo.criarCompartilhamento('Dr. Revogado', 'Ana Alves')
        await a.repo.revogarCompartilhamento(revogado.codigo, 'Ana Alves')
        expect(await raiz.buscarCompartilhamento(vivo.codigo)).toEqual({
          pacienteId: a.perfil.pacienteId, para: 'Dr. Vivo', expiraEm: vivo.expiraEm, situacao: 'ativo',
        })
        expect(await raiz.buscarCompartilhamento(revogado.codigo)).toMatchObject({
          pacienteId: a.perfil.pacienteId, para: 'Dr. Revogado', situacao: 'revogado',
        })
        expect(await raiz.buscarCompartilhamento('ZZZZZ9')).toBeNull()

        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(Date.now() + 30 * DIA + MINUTO)
        expect((await raiz.buscarCompartilhamento(vivo.codigo))?.situacao).toBe('expirado')
        /* Revogado e depois expirado continua revogado: foi a decisão do paciente que o desligou. */
        expect((await raiz.buscarCompartilhamento(revogado.codigo))?.situacao).toBe('revogado')
      })

      it('reiniciar apaga os códigos do paciente', async () => {
        const comp = await a.repo.criarCompartilhamento('Dr. X', 'Ana Alves')
        await a.repo.reiniciar()
        expect(await raiz.buscarCompartilhamentoAtivo(comp.codigo)).toBeNull()
      })
    })

    describe('limpar', () => {
      async function comSessao(pacienteId: string, expiraEm: Date) {
        const usuario = await raiz.criarUsuario({ email: emailUnico(), senhaHash: null, pacienteId })
        const tokenHash = `tok-${randomUUID()}`
        await raiz.criarSessao({ tokenHash, usuarioId: usuario.id, expiraEm })
        return tokenHash
      }

      it('apaga sessões expiradas e tentativas antigas, mantendo as recentes', async () => {
        const { perfil } = await novoPaciente('pendente')
        const expirada = await comSessao(perfil.pacienteId, new Date(Date.now() - MINUTO))
        const valida = `tok-${randomUUID()}`
        const usuario = await raiz.buscarSessao(expirada)
        await raiz.criarSessao({ tokenHash: valida, usuarioId: usuario!.usuario.id, expiraEm: new Date(Date.now() + DIA) })
        const chave = `limpar-${randomUUID()}`
        /* A antiga por último: o Oracle já descarta as antigas da mesma chave a cada registro. */
        await raiz.registrarTentativa(chave)
        await raiz.registrarTentativa(chave, new Date(Date.now() - 2 * DIA))
        expect(await raiz.contarTentativas(chave, new Date(0))).toBe(2)

        const r = await raiz.limpar({
          sessoesExpiradasAntesDe: new Date(), tentativasAntesDe: new Date(Date.now() - DIA),
          convidadosCriadosAntesDe: new Date(0),
        })

        expect(r.sessoes).toBeGreaterThanOrEqual(1)
        expect(r.tentativas).toBeGreaterThanOrEqual(1)
        expect(await raiz.buscarSessao(expirada)).toBeNull()
        expect(await raiz.buscarSessao(valida)).not.toBeNull()
        expect(await raiz.contarTentativas(chave, new Date(0))).toBe(1)
        expect(await raiz.obterPerfil(perfil.pacienteId)).not.toBeNull()
      })

      it('exclui convidados criados antes do limite com todos os dados; titulares ficam', async () => {
        const convidado = await raiz.criarPaciente({ nome: 'Visitante', convidado: true })
        criados.push(convidado.pacienteId)
        await raiz.aplicarOnboarding(convidado.pacienteId, 'exemplo')
        const token = await comSessao(convidado.pacienteId, new Date(Date.now() + DIA))
        const { codigo } = await raiz.paraPaciente(convidado.pacienteId).criarCompartilhamento('Dr. X', 'Visitante')
        const titular = await novoPaciente('exemplo')

        const nada = await raiz.limpar({
          sessoesExpiradasAntesDe: new Date(0), tentativasAntesDe: new Date(0),
          convidadosCriadosAntesDe: new Date(Date.now() - MINUTO),
        })
        expect(await raiz.obterPerfil(convidado.pacienteId)).not.toBeNull()

        const r = await raiz.limpar({
          sessoesExpiradasAntesDe: new Date(0), tentativasAntesDe: new Date(0),
          convidadosCriadosAntesDe: new Date(Date.now() + MINUTO),
        })
        expect(r.convidados).toBeGreaterThanOrEqual(nada.convidados + 1)
        expect(await raiz.obterPerfil(convidado.pacienteId)).toBeNull()
        expect(await raiz.buscarSessao(token)).toBeNull()
        expect(await raiz.buscarCompartilhamentoAtivo(codigo)).toBeNull()
        expect((await raiz.paraPaciente(convidado.pacienteId).estado()).eventos).toEqual([])
        expect(await raiz.obterPerfil(titular.perfil.pacienteId)).not.toBeNull()
      })
    })

    describe('onboarding', () => {
      it('paciente novo fica pendente e com o histórico vazio', async () => {
        const { perfil, repo } = await novoPaciente('pendente')
        expect(perfil.onboarding).toBe('pendente')
        expect(await repo.estado()).toEqual({
          eventos: [], consentimentos: [], acessos: [], passos: [], fontes: [], compartilhamento: null,
        })
      })

      it('vazio mantém o histórico vazio e reiniciar volta ao vazio', async () => {
        const { perfil } = await novoPaciente('pendente')
        expect((await raiz.aplicarOnboarding(perfil.pacienteId, 'vazio'))?.onboarding).toBe('vazio')
        const repo = raiz.paraPaciente(perfil.pacienteId)
        await repo.adicionarEvento(EVENTO_NOVO, AUTOR)
        await repo.reiniciar()
        expect((await repo.estado()).eventos).toEqual([])
        expect((await raiz.obterPerfil(perfil.pacienteId))?.onboarding).toBe('vazio')
      })

      it('exemplo copia o seed e troca de modo recomeça os dados', async () => {
        const { perfil, repo } = await novoPaciente('pendente')
        expect((await raiz.aplicarOnboarding(perfil.pacienteId, 'exemplo'))?.onboarding).toBe('exemplo')
        expect((await repo.estado()).eventos).toEqual(EXEMPLO.eventos)
        await raiz.aplicarOnboarding(perfil.pacienteId, 'vazio')
        expect((await repo.estado()).eventos).toEqual([])
      })

      it('devolve null para paciente inexistente', async () => {
        expect(await raiz.aplicarOnboarding('nao-existe', 'exemplo')).toBeNull()
      })
    })

    describe('isolamento entre pacientes', () => {
      let a: { perfil: Perfil; repo: RepositorioPaciente }
      let b: { perfil: Perfil; repo: RepositorioPaciente }

      beforeEach(async () => {
        a = await novoPaciente('vazio', 'Ana Alves')
        b = await novoPaciente('exemplo', 'Bruno Braga')
      })

      it('A não vê eventos nem acessos de B', async () => {
        await b.repo.adicionarEvento(EVENTO_NOVO, 'Bruno Braga')
        const estadoA = await a.repo.estado()
        expect(estadoA.eventos).toEqual([])
        expect(estadoA.acessos).toEqual([])
        expect(await a.repo.listarAcessos()).toEqual([])
      })

      it('o mesmo id de evento pode existir em pacientes diferentes', async () => {
        await a.repo.adicionarEvento({ ...EVENTO_NOVO, id: 'e01' }, 'Ana Alves')
        expect((await a.repo.estado()).eventos.map((e) => e.id)).toEqual(['e01'])
        expect((await b.repo.estado()).eventos).toEqual(dadosExemplo('Bruno Braga').eventos)
      })

      it('A não altera consentimento, passo nem fonte de B', async () => {
        const antes = await b.repo.estado()
        expect(await a.repo.alternarConsentimento('c1', 'Ana Alves')).toBeNull()
        expect(await a.repo.alternarPasso('p1')).toBeNull()
        expect(await a.repo.conectarFonte('f5')).toBeNull()
        expect(await b.repo.estado()).toEqual(antes)
      })

      it('A não exclui evento de B, nem com o mesmo id', async () => {
        await a.repo.adicionarEvento({ ...EVENTO_NOVO, id: 'e14' }, 'Ana Alves')
        const antesB = await b.repo.estado()
        expect(await a.repo.excluirEvento('e22', 'Ana Alves')).toBe(false)
        expect(await a.repo.excluirEvento('e14', 'Ana Alves')).toBe(true)
        expect(await b.repo.estado()).toEqual(antesB)
        expect((await a.repo.estado()).eventos).toEqual([])
      })

      it('substituirPassos e compartilhamento de A não tocam B', async () => {
        const antes = await b.repo.estado()
        await a.repo.substituirPassos([])
        await a.repo.criarCompartilhamento('Dr. X', 'Ana Alves')
        expect(await b.repo.estado()).toEqual(antes)
      })

      it('reiniciar de A não afeta B', async () => {
        await b.repo.alternarPasso('p1')
        const antes = await b.repo.estado()
        await a.repo.reiniciar()
        expect(await b.repo.estado()).toEqual(antes)
      })

      it('excluirPaciente apaga tudo de A e só de A', async () => {
        const emailA = emailUnico('ana')
        const usuarioA = await raiz.criarUsuario({ email: emailA, senhaHash: 'h', pacienteId: a.perfil.pacienteId })
        const tokenA = `tok-${randomUUID()}`
        await raiz.criarSessao({ tokenHash: tokenA, usuarioId: usuarioA.id, expiraEm: new Date(Date.now() + MINUTO) })
        await a.repo.adicionarEvento(EVENTO_NOVO, 'Ana Alves')
        await a.repo.criarCompartilhamento('Dr. X', 'Ana Alves')
        const antesB = await b.repo.estado()

        expect(await raiz.excluirPaciente(a.perfil.pacienteId)).toBe(true)

        expect(await raiz.obterPerfil(a.perfil.pacienteId)).toBeNull()
        expect(await raiz.buscarUsuarioPorEmail(emailA)).toBeNull()
        expect(await raiz.buscarSessao(tokenA)).toBeNull()
        expect((await a.repo.estado()).eventos).toEqual([])
        expect(await b.repo.estado()).toEqual(antesB)
        expect(await raiz.obterPerfil(b.perfil.pacienteId)).not.toBeNull()
        expect(await raiz.excluirPaciente(a.perfil.pacienteId)).toBe(false)
      })
    })

    describe('perfil', () => {
      it('criarPaciente devolve o perfil com iniciais e idade derivadas', async () => {
        const perfil = await raiz.criarPaciente({
          nome: 'Maria Clara Souza', dataNascimento: '1990-01-15', convidado: false,
        })
        criados.push(perfil.pacienteId)
        expect(perfil).toEqual({
          pacienteId: expect.any(String), nome: 'Maria Clara Souza', iniciais: 'MS',
          dataNascimento: '1990-01-15', idade: expect.any(Number), condicoes: [], alergias: [],
          onboarding: 'pendente', convidado: false,
        })
        expect(perfil.idade).toBeGreaterThanOrEqual(36)
        expect(await raiz.obterPerfil(perfil.pacienteId)).toEqual(perfil)
      })

      it('gera ids distintos por paciente', async () => {
        const { perfil: p1 } = await novoPaciente('pendente')
        const { perfil: p2 } = await novoPaciente('pendente')
        expect(p1.pacienteId).not.toBe(p2.pacienteId)
      })

      it('atualizarPerfil troca campos, mantém os omitidos e remove opcionais com ""', async () => {
        const perfil = await raiz.criarPaciente({
          nome: 'Joana Dias', cartaoSus: '123', plano: 'Plano X', convidado: false,
        })
        criados.push(perfil.pacienteId)
        const atualizado = await raiz.atualizarPerfil(perfil.pacienteId, {
          condicoes: ['Asma'], alergias: ['Penicilina'], cartaoSus: '', dataNascimento: '2000-06-30',
        })
        expect(atualizado).toEqual({
          ...perfil, condicoes: ['Asma'], alergias: ['Penicilina'], cartaoSus: undefined,
          dataNascimento: '2000-06-30', idade: expect.any(Number),
        })
        expect(atualizado).not.toHaveProperty('cartaoSus')
        expect(await raiz.obterPerfil(perfil.pacienteId)).toEqual(atualizado)
      })

      it('guarda o responsável; null volta a ser o histórico do próprio usuário', async () => {
        const responsavel = { nome: 'Rafael Lima', relacao: 'filho' }
        const perfil = await raiz.criarPaciente({ nome: 'Marcos Vinícius Teixeira', responsavel, convidado: false })
        criados.push(perfil.pacienteId)
        /* Sem a declaração de autorização, a leitura marca a pendência. */
        expect(perfil).toMatchObject({ nome: 'Marcos Vinícius Teixeira', iniciais: 'MT', responsavel: { ...responsavel, autorizacaoPendente: true } })
        expect(await raiz.obterPerfil(perfil.pacienteId)).toEqual(perfil)

        const mantido = await raiz.atualizarPerfil(perfil.pacienteId, { plano: 'Plano Y' })
        expect(mantido?.responsavel).toEqual({ ...responsavel, autorizacaoPendente: true })
        /* O instante volta com o fuso de Brasília, igual ao gravado, mesmo vindo de outro fuso. */
        const autorizadoEm = '2026-10-06T14:32:05-03:00'
        const declarado = await raiz.atualizarPerfil(perfil.pacienteId, { responsavel: { ...responsavel, autorizadoEm: '2026-10-06T17:32:05Z' } })
        expect(declarado?.responsavel).toEqual({ ...responsavel, autorizadoEm })
        expect((await raiz.obterPerfil(perfil.pacienteId))?.responsavel).toEqual({ ...responsavel, autorizadoEm })
        const trocado = await raiz.atualizarPerfil(perfil.pacienteId, { responsavel: { nome: 'Rafael', relacao: 'neto' } })
        expect(trocado?.responsavel).toEqual({ nome: 'Rafael', relacao: 'neto', autorizadoEm })
        const proprio = await raiz.atualizarPerfil(perfil.pacienteId, { responsavel: null })
        expect(proprio).not.toHaveProperty('responsavel')
        expect(await raiz.obterPerfil(perfil.pacienteId)).toEqual(proprio)
      })

      it('onboarding exemplo com responsável põe o nome e o papel dele nas ações do log', async () => {
        const perfil = await raiz.criarPaciente({
          nome: 'Marcos Vinícius Teixeira', responsavel: { nome: 'Rafael Lima', relacao: 'filho' }, convidado: false,
        })
        criados.push(perfil.pacienteId)
        await raiz.aplicarOnboarding(perfil.pacienteId, 'exemplo')
        const repo = raiz.paraPaciente(perfil.pacienteId)
        const doUsuario = (await repo.listarAcessos()).filter((a) => a.papel.startsWith('Responsável'))
        expect(doUsuario.length).toBe(EXEMPLO.acessos.filter((a) => a.papel === 'Titular').length)
        expect(new Set(doUsuario.map((a) => `${a.quem} | ${a.papel}`))).toEqual(new Set(['Rafael Lima | Responsável (filho)']))
        await repo.reiniciar()
        expect((await repo.listarAcessos()).some((a) => a.papel === 'Titular')).toBe(false)
      })

      it('obterPerfil e atualizarPerfil devolvem null para paciente inexistente', async () => {
        expect(await raiz.obterPerfil('nao-existe')).toBeNull()
        expect(await raiz.atualizarPerfil('nao-existe', { nome: 'X' })).toBeNull()
      })

      it('guarda a flag de convidado', async () => {
        const perfil = await raiz.criarPaciente({ nome: 'Visitante', convidado: true })
        criados.push(perfil.pacienteId)
        expect(perfil).toMatchObject({ convidado: true, iniciais: 'V' })
      })
    })

    describe('usuários', () => {
      it('criarUsuario normaliza o email e buscarUsuarioPorEmail ignora maiúsculas', async () => {
        const { perfil } = await novoPaciente('pendente')
        const email = emailUnico('Maria')
        const usuario = await raiz.criarUsuario({ email: email.toUpperCase(), senhaHash: 'scrypt$x', pacienteId: perfil.pacienteId })
        expect(usuario).toEqual({ id: expect.any(String), email: email.toLowerCase() })
        expect(await raiz.buscarUsuarioPorEmail(email)).toEqual({
          ...usuario, pacienteId: perfil.pacienteId, senhaHash: 'scrypt$x',
        })
      })

      it('email repetido lança ErroConflito', async () => {
        const { perfil } = await novoPaciente('pendente')
        const { perfil: outro } = await novoPaciente('pendente')
        const email = emailUnico()
        await raiz.criarUsuario({ email, senhaHash: 'h', pacienteId: perfil.pacienteId })
        await expect(raiz.criarUsuario({ email: email.toUpperCase(), senhaHash: 'h', pacienteId: outro.pacienteId }))
          .rejects.toBeInstanceOf(ErroConflito)
      })

      it('conta convidada não tem senha', async () => {
        const { perfil } = await novoPaciente('pendente')
        const email = emailUnico('convidado')
        await raiz.criarUsuario({ email, senhaHash: null, pacienteId: perfil.pacienteId })
        expect((await raiz.buscarUsuarioPorEmail(email))?.senhaHash).toBeNull()
      })

      it('buscarUsuarioPorEmail devolve null para email desconhecido', async () => {
        expect(await raiz.buscarUsuarioPorEmail(emailUnico('ninguem'))).toBeNull()
      })
    })

    describe('sessões', () => {
      it('buscarSessao devolve usuário, perfil e expiração; apagarSessao invalida', async () => {
        const { perfil } = await novoPaciente('exemplo')
        const usuario = await raiz.criarUsuario({ email: emailUnico(), senhaHash: 'h', pacienteId: perfil.pacienteId })
        const tokenHash = `tok-${randomUUID()}`
        const expiraEm = new Date(Date.now() + 7 * 24 * 60 * MINUTO)
        await raiz.criarSessao({ tokenHash, usuarioId: usuario.id, expiraEm })

        expect(await raiz.buscarSessao(tokenHash)).toEqual({
          usuario, perfil: { ...perfil, onboarding: 'exemplo' }, expiraEm,
        })
        await raiz.apagarSessao(tokenHash)
        expect(await raiz.buscarSessao(tokenHash)).toBeNull()
      })

      it('sessão expirada continua visível com a data no passado', async () => {
        const { perfil } = await novoPaciente('pendente')
        const usuario = await raiz.criarUsuario({ email: emailUnico(), senhaHash: 'h', pacienteId: perfil.pacienteId })
        const tokenHash = `tok-${randomUUID()}`
        const expiraEm = new Date(Date.now() - MINUTO)
        await raiz.criarSessao({ tokenHash, usuarioId: usuario.id, expiraEm })
        expect((await raiz.buscarSessao(tokenHash))?.expiraEm).toEqual(expiraEm)
      })

      it('token desconhecido devolve null', async () => {
        expect(await raiz.buscarSessao(`tok-${randomUUID()}`)).toBeNull()
        await raiz.apagarSessao(`tok-${randomUUID()}`)
      })
    })

    describe('tentativas', () => {
      it('conta só as tentativas da chave a partir do instante pedido', async () => {
        const chave = `login-${randomUUID()}`
        const agora = Date.now()
        await raiz.registrarTentativa(chave, new Date(agora - 20 * MINUTO))
        await raiz.registrarTentativa(chave)
        await raiz.registrarTentativa(chave)
        await raiz.registrarTentativa(`outra-${randomUUID()}`)
        expect(await raiz.contarTentativas(chave, new Date(agora - 15 * MINUTO))).toBe(2)
        expect(await raiz.contarTentativas(chave, new Date(agora - 30 * MINUTO))).toBe(3)
        expect(await raiz.contarTentativas(chave, new Date(agora + MINUTO))).toBe(0)
        expect(await raiz.contarTentativas(`nada-${randomUUID()}`, new Date(0))).toBe(0)
      })
    })
  })
}
