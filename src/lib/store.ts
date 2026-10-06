import { useCallback, useEffect, useState } from 'react'
import type { Evento } from '../data/types'
import {
  api, definirAoPerderSessao, ErroApi, mensagemDeErro, podeRepetir,
  type Conta, type DadosCadastro, type EstadoServidor, type ModoOnboarding, type MudancasPerfil,
  type PacienteCuidado, type Perfil, type RespostaCopiloto, type Saude, type TurnoHistorico, type Usuario,
} from './api'
import { lerRota, navegar, separarRota } from './router'

export interface Turno {
  id: number
  pergunta: string
  resposta?: RespostaCopiloto
  carregando: boolean
  erro?: string
  repetivel?: boolean
}

export type StatusSessao = 'carregando' | 'anonimo' | 'autenticado'

export interface Sessao {
  status: StatusSessao
  usuario: Usuario | null
  perfil: Perfil | null
  /* Recado para a próxima tela pública (sessão expirada, conta excluída). */
  aviso: string | null
}

export interface Estado extends EstadoServidor {
  carregando: boolean
  erro: string | null
  saude: Saude | null
  falhaAcao: string | null
  conversa: Turno[]
  /* Eventos anexados desde que esta sessão começou: o selo "novo" não sobrevive a sair e entrar. */
  novos: string[]
  sessao: Sessao
}

/* Só a conversa com o copiloto fica no navegador, uma chave por paciente; o histórico clínico vem do servidor. */
const PREFIXO_CONVERSA = 'nurai.conversa.v2.'
const CHAVES_LEGADAS = ['nurai.mvp.v1', 'nurai.conversa.v1']
const TURNOS_DE_CONTEXTO = 4

function vazio(): EstadoServidor {
  return { eventos: [], consentimentos: [], acessos: [], passos: [], fontes: [], compartilhamento: null }
}

function lerConversa(pacienteId: string): Turno[] {
  try {
    CHAVES_LEGADAS.forEach((c) => localStorage.removeItem(c))
    const bruto = localStorage.getItem(PREFIXO_CONVERSA + pacienteId)
    return bruto ? (JSON.parse(bruto) as Turno[]) : []
  } catch {
    return []
  }
}

function salvarConversa(pacienteId: string, conversa: Turno[]) {
  try {
    localStorage.setItem(PREFIXO_CONVERSA + pacienteId, JSON.stringify(conversa.filter((t) => t.resposta)))
  } catch {
    /* modo privado ou armazenamento cheio: a conversa segue só em memória */
  }
}

function apagarConversa(pacienteId: string) {
  try {
    localStorage.removeItem(PREFIXO_CONVERSA + pacienteId)
  } catch {
    /* sem armazenamento: nada a apagar */
  }
}

const SESSAO_INICIAL: Sessao = { status: 'carregando', usuario: null, perfil: null, aviso: null }

function dadosZerados() {
  return { ...vazio(), carregando: true, erro: null, saude: null, falhaAcao: null, conversa: [] as Turno[], novos: [] as string[] }
}

let estado: Estado = { ...dadosZerados(), sessao: SESSAO_INICIAL }
let carregado = false
let carregamento: Promise<void> | null = null
/* Muda a cada troca de usuário: resposta de uma requisição feita pela sessão anterior é descartada. */
let geracao = 0
const ouvintes = new Set<() => void>()

const pacienteAtual = () => estado.sessao.perfil?.pacienteId ?? null

export function definir(mudanca: (anterior: Estado) => Partial<Estado>) {
  const anterior = estado
  estado = { ...estado, ...mudanca(estado) }
  const pacienteId = pacienteAtual()
  if (pacienteId && estado.conversa !== anterior.conversa) salvarConversa(pacienteId, estado.conversa)
  ouvintes.forEach((o) => o())
}

/* Aplica só se ninguém trocou de sessão enquanto a requisição estava no ar. */
function definirNa(g: number, mudanca: (anterior: Estado) => Partial<Estado>) {
  if (g === geracao) definir(mudanca)
}

const ESPERA_PARA_REPETIR_MS = 800

const esperar = (ms: number) => new Promise<void>((resolver) => { setTimeout(resolver, ms) })

/* Uma falha passageira (instância fria, proxy sem resposta) não vira tela de erro: ler o estado é
   idempotente, então tenta mais uma vez antes de desistir. Visto em produção ao recarregar a página. */
async function lerEstadoComRepeticao() {
  try {
    return await api.estado()
  } catch (erro) {
    if (!(erro instanceof ErroApi) || !erro.repetivel) throw erro
    await esperar(ESPERA_PARA_REPETIR_MS)
    return api.estado()
  }
}

const jaNaoExiste = (erro: unknown) => erro instanceof ErroApi && erro.codigo === 'NAO_ENCONTRADO'

/* Visto em produção: o servidor apagou, mas a resposta se perdeu e o 2º toque recebeu 404.
   404 é "já excluído"; e depois de uma falha de rede repetir é seguro, porque o 404 confirma. */
async function excluirNoServidor(id: string) {
  const tentar = () => api.excluirEvento(id).catch((erro: unknown) => { if (!jaNaoExiste(erro)) throw erro })
  try {
    await tentar()
  } catch (erro) {
    if (!(erro instanceof ErroApi) || !erro.repetivel) throw erro
    await esperar(ESPERA_PARA_REPETIR_MS)
    await tentar()
  }
}

export function carregar(forcar = false): Promise<void> {
  if (carregamento) return carregamento
  if (carregado && !forcar) return Promise.resolve()
  const g = geracao
  definir(() => ({ carregando: true, erro: null }))
  const promessa = Promise.all([lerEstadoComRepeticao(), api.saude().catch(() => null)])
    .then(([servidor, saude]) => {
      if (g !== geracao) return
      carregado = true
      definir(() => ({ ...servidor, saude, carregando: false, erro: null }))
    })
    .catch((erro: unknown) => {
      definirNa(g, () => ({ carregando: false, erro: mensagemDeErro(erro) }))
    })
    .finally(() => { if (carregamento === promessa) carregamento = null })
  carregamento = promessa
  return promessa
}

/* ---------------- sessão ---------------- */

/* Troca de usuário (ou saída): nada da sessão anterior pode sobrar na tela. */
function trocarSessao(sessao: Sessao) {
  geracao += 1
  carregado = false
  carregamento = null
  acessosEmCurso = null
  const conversa = sessao.perfil ? lerConversa(sessao.perfil.pacienteId) : []
  estado = { ...dadosZerados(), conversa, sessao }
  ouvintes.forEach((o) => o())
}

function aplicarConta(conta: Conta) {
  trocarSessao({ status: 'autenticado', usuario: conta.usuario, perfil: conta.perfil, aviso: null })
}

function encerrarLocal(aviso: string | null) {
  const pacienteId = pacienteAtual()
  if (pacienteId) apagarConversa(pacienteId)
  trocarSessao({ status: 'anonimo', usuario: null, perfil: null, aviso })
}

let verificacao: Promise<void> | null = null

/* Chamado no boot: a sessão vive num cookie httpOnly, então só o servidor sabe se ela existe. */
export function verificarSessao(): Promise<void> {
  if (verificacao) return verificacao
  verificacao = api.sessao()
    .then(aplicarConta)
    .catch((erro: unknown) => {
      const aviso = erro instanceof ErroApi && erro.codigo === 'NAO_AUTENTICADO' ? null : mensagemDeErro(erro)
      trocarSessao({ status: 'anonimo', usuario: null, perfil: null, aviso })
    })
  return verificacao
}

/* Uma rota protegida respondeu 401: a sessão expirou ou foi encerrada em outra aba. */
definirAoPerderSessao(() => {
  if (estado.sessao.status !== 'autenticado') return
  const { caminho } = separarRota(lerRota())
  encerrarLocal('Sua sessão terminou. Entre de novo para continuar de onde parou.')
  navegar(caminho.startsWith('/app') ? `/entrar?volta=${encodeURIComponent(caminho)}` : '/entrar')
})

export async function entrar(email: string, senha: string): Promise<Perfil> {
  const conta = await api.entrar(email, senha)
  aplicarConta(conta)
  return conta.perfil
}

export async function cadastrar(dados: DadosCadastro): Promise<Perfil> {
  const conta = await api.cadastrar(dados)
  aplicarConta(conta)
  return conta.perfil
}

export async function entrarDemo(): Promise<Perfil> {
  const conta = await api.entrarDemo()
  aplicarConta(conta)
  return conta.perfil
}

export async function sair(destino = '/') {
  /* Mesmo se o servidor não responder, a tela não pode continuar mostrando os dados. */
  await api.sair().catch(() => undefined)
  encerrarLocal(null)
  navegar(destino)
}

/* Vale para o primeiro acesso e para recomeçar depois: o servidor apaga e recria os dados no modo pedido.
   Com paciente, o histórico passa a ser dele e o usuário vira o responsável. */
export async function concluirOnboarding(modo: ModoOnboarding, paciente?: PacienteCuidado): Promise<Perfil> {
  const { perfil } = await api.onboarding(modo, paciente)
  const pacienteId = pacienteAtual()
  if (pacienteId) apagarConversa(pacienteId)
  trocarSessao({ ...estado.sessao, perfil })
  return perfil
}

export async function atualizarPerfil(mudancas: MudancasPerfil): Promise<Perfil> {
  const { perfil } = await api.atualizarPerfil(mudancas)
  definir((e) => ({ sessao: { ...e.sessao, perfil } }))
  return perfil
}

export async function excluirConta() {
  await api.excluirConta()
  encerrarLocal('Sua conta e todo o histórico guardado nela foram excluídos.')
  navegar('/')
}

export function descartarAviso() {
  if (estado.sessao.aviso) definir((e) => ({ sessao: { ...e.sessao, aviso: null } }))
}

/* ---------------- dados do paciente ---------------- */

/* Ações de dados: o servidor é a fonte da verdade. Em falha devolvem null e
   publicam a mensagem em `falhaAcao`, exibida pelo AppShell. */
async function executar<T>(acao: () => Promise<T>): Promise<T | null> {
  const g = geracao
  try {
    const resultado = await acao()
    if (estado.falhaAcao) definirNa(g, () => ({ falhaAcao: null }))
    return resultado
  } catch (erro) {
    definirNa(g, () => ({ falhaAcao: mensagemDeErro(erro) }))
    return null
  }
}

/* A leitura em curso é reaproveitada: a tela de Privacidade pede o registro ao montar
   (duas vezes sob StrictMode). Depois de uma mudança, porém, sempre busca de novo,
   senão uma leitura iniciada antes da mudança esconderia o registro novo. */
let acessosEmCurso: Promise<void> | null = null
let ultimaLeituraDeAcessos = 0

function atualizarAcessos(aposMudanca = false): Promise<void> {
  if (acessosEmCurso && !aposMudanca) return acessosEmCurso
  const leitura = ++ultimaLeituraDeAcessos
  const g = geracao
  const promessa = api.acessos()
    .then((acessos) => { if (leitura === ultimaLeituraDeAcessos) definirNa(g, () => ({ acessos })) })
    .catch(() => { /* o registro antigo continua na tela */ })
    .finally(() => { if (acessosEmCurso === promessa) acessosEmCurso = null })
  acessosEmCurso = promessa
  return promessa
}

function historicoAntesDe(id: number): TurnoHistorico[] {
  return estado.conversa
    .filter((t) => t.id < id && t.resposta)
    .slice(-TURNOS_DE_CONTEXTO)
    .map((t) => ({
      pergunta: t.pergunta.slice(0, 1000),
      texto: t.resposta!.texto.slice(0, 10).map((p) => p.slice(0, 2000)),
    }))
}

function atualizarTurno(g: number, id: number, mudanca: Partial<Turno>) {
  definirNa(g, (e) => ({ conversa: e.conversa.map((t) => (t.id === id ? { ...t, ...mudanca } : t)) }))
}

async function responderTurno(id: number) {
  const turno = estado.conversa.find((t) => t.id === id)
  if (!turno) return
  const g = geracao
  atualizarTurno(g, id, { carregando: true, erro: undefined })
  try {
    const resposta = await api.copiloto(turno.pergunta, historicoAntesDe(id))
    atualizarTurno(g, id, { resposta, carregando: false })
  } catch (erro) {
    atualizarTurno(g, id, { erro: mensagemDeErro(erro), repetivel: podeRepetir(erro), carregando: false })
  }
}

/* Uma pergunta pode nascer em qualquer tela. Sempre chamada de um manipulador de
   evento — nunca durante a renderização. */
export function perguntar(pergunta: string) {
  const limpo = pergunta.trim()
  if (!limpo || estado.conversa.some((t) => t.carregando)) return
  const id = Date.now()
  definir((e) => ({ conversa: [...e.conversa, { id, pergunta: limpo, carregando: true }] }))
  void responderTurno(id)
}

export function tentarTurnoDeNovo(id: number) {
  if (estado.conversa.some((t) => t.carregando)) return
  void responderTurno(id)
}

/* Volta ao ponto de partida escolhido no onboarding (exemplo ou vazio). */
export function reiniciar() {
  definir(() => ({ conversa: [], falhaAcao: null }))
  const g = geracao
  void executar(async () => {
    const servidor = await api.reiniciar()
    if (g !== geracao) return
    carregado = true
    definir(() => ({ ...servidor, erro: null }))
  })
}

export function useEstado(): Estado {
  const [, forcar] = useState(0)
  useEffect(() => {
    const ouvinte = () => forcar((n) => n + 1)
    ouvintes.add(ouvinte)
    return () => { ouvintes.delete(ouvinte) }
  }, [])
  return estado
}

export function useSessao(): Sessao {
  return useEstado().sessao
}

/* O perfil só é lido dentro do app, que já passou pela guarda de sessão. */
export function usePerfil(): Perfil {
  const { perfil } = useSessao()
  if (!perfil) throw new Error('usePerfil fora de uma sessão autenticada')
  return perfil
}

export function useAcoes() {
  return {
    adicionarEvento: useCallback((evento: Evento) => executar(async () => {
      const g = geracao
      const salvo = await api.adicionarEvento(evento)
      definirNa(g, (e) => ({ eventos: [...e.eventos, salvo], novos: [...e.novos, salvo.id] }))
      void atualizarAcessos(true)
      return salvo
    }), []),

    /* Espelha o servidor: o id sai das âncoras e o passo que fica sem nenhuma sai junto.
       Lança ErroApi: a tela mostra a falha na própria confirmação, onde a pessoa tocou. */
    excluirEvento: useCallback(async (id: string) => {
      const g = geracao
      await excluirNoServidor(id)
      definirNa(g, (e) => ({
        eventos: e.eventos.filter((x) => x.id !== id),
        novos: e.novos.filter((x) => x !== id),
        passos: e.passos.flatMap((p) => {
          if (!p.ancoras.includes(id)) return [p]
          const ancoras = p.ancoras.filter((a) => a !== id)
          return ancoras.length ? [{ ...p, ancoras }] : []
        }),
      }))
      void atualizarAcessos(true)
    }, []),

    alternarConsentimento: useCallback((id: string) => executar(async () => {
      const g = geracao
      const atualizado = await api.alternarConsentimento(id)
      definirNa(g, (e) => ({ consentimentos: e.consentimentos.map((c) => (c.id === id ? atualizado : c)) }))
      void atualizarAcessos(true)
      return atualizado
    }), []),

    alternarPasso: useCallback((id: string) => executar(async () => {
      const g = geracao
      const atualizado = await api.alternarPasso(id)
      definirNa(g, (e) => ({ passos: e.passos.map((p) => (p.id === id ? atualizado : p)) }))
      return atualizado
    }), []),

    conectarFonte: useCallback((id: string) => executar(async () => {
      const g = geracao
      const atualizada = await api.conectarFonte(id)
      definirNa(g, (e) => ({ fontes: e.fontes.map((f) => (f.id === id ? atualizada : f)) }))
      return atualizada
    }), []),

    gerarCompartilhamento: useCallback((para: string) => executar(async () => {
      const g = geracao
      const compartilhamento = await api.compartilhar(para)
      definirNa(g, () => ({ compartilhamento }))
      void atualizarAcessos(true)
      return compartilhamento
    }), []),

    revogarCompartilhamento: useCallback((codigo: string) => executar(async () => {
      const g = geracao
      await api.revogarCompartilhamento(codigo)
      definirNa(g, () => ({ compartilhamento: null }))
      void atualizarAcessos(true)
      return true
    }), []),

    /* Ação de IA: lança ErroApi para a tela mostrar o erro no próprio contexto. */
    gerarPassos: useCallback(async () => {
      const g = geracao
      const gerados = await api.gerarPassos()
      definirNa(g, () => ({ passos: gerados.passos }))
      return gerados
    }, []),

    atualizarAcessos: useCallback(() => atualizarAcessos(), []),
    descartarFalha: useCallback(() => definir(() => ({ falhaAcao: null })), []),
    carregar,
    reiniciar,
  }
}

function doisDigitos(n: number) { return String(n).padStart(2, '0') }

export function hoje() {
  const d = new Date()
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function isoHoje() {
  const d = new Date()
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`
}
