import { useCallback, useEffect, useState } from 'react'
import type { Evento } from '../data/types'
import {
  api, mensagemDeErro, podeRepetir, type EstadoServidor, type RespostaCopiloto, type Saude, type TurnoHistorico,
} from './api'

export interface Turno {
  id: number
  pergunta: string
  resposta?: RespostaCopiloto
  carregando: boolean
  erro?: string
  repetivel?: boolean
}

export interface Estado extends EstadoServidor {
  carregando: boolean
  erro: string | null
  saude: Saude | null
  falhaAcao: string | null
  conversa: Turno[]
}

/* Só a conversa com o copiloto fica no navegador; o histórico clínico vem do servidor. */
const CHAVE_CONVERSA = 'nurai.conversa.v1'
const CHAVE_LEGADA = 'nurai.mvp.v1'
const TURNOS_DE_CONTEXTO = 4

function vazio(): EstadoServidor {
  return { eventos: [], consentimentos: [], acessos: [], passos: [], fontes: [], compartilhamento: null }
}

function lerConversa(): Turno[] {
  try {
    localStorage.removeItem(CHAVE_LEGADA)
    const bruto = localStorage.getItem(CHAVE_CONVERSA)
    return bruto ? (JSON.parse(bruto) as Turno[]) : []
  } catch {
    return []
  }
}

function salvarConversa(conversa: Turno[]) {
  try {
    localStorage.setItem(CHAVE_CONVERSA, JSON.stringify(conversa.filter((t) => t.resposta)))
  } catch {
    /* modo privado ou armazenamento cheio: a conversa segue só em memória */
  }
}

let estado: Estado = {
  ...vazio(),
  carregando: true,
  erro: null,
  saude: null,
  falhaAcao: null,
  conversa: typeof window === 'undefined' ? [] : lerConversa(),
}
let carregado = false
let carregamento: Promise<void> | null = null
const ouvintes = new Set<() => void>()

export function definir(mudanca: (anterior: Estado) => Partial<Estado>) {
  const anterior = estado
  estado = { ...estado, ...mudanca(estado) }
  if (estado.conversa !== anterior.conversa) salvarConversa(estado.conversa)
  ouvintes.forEach((o) => o())
}

export function carregar(forcar = false): Promise<void> {
  if (carregamento) return carregamento
  if (carregado && !forcar) return Promise.resolve()
  definir(() => ({ carregando: true, erro: null }))
  carregamento = Promise.all([api.estado(), api.saude().catch(() => null)])
    .then(([servidor, saude]) => {
      carregado = true
      definir(() => ({ ...servidor, saude, carregando: false, erro: null }))
    })
    .catch((erro: unknown) => {
      definir(() => ({ carregando: false, erro: mensagemDeErro(erro) }))
    })
    .finally(() => { carregamento = null })
  return carregamento
}

/* Ações de dados: o servidor é a fonte da verdade. Em falha devolvem null e
   publicam a mensagem em `falhaAcao`, exibida pelo AppShell. */
async function executar<T>(acao: () => Promise<T>): Promise<T | null> {
  try {
    const resultado = await acao()
    if (estado.falhaAcao) definir(() => ({ falhaAcao: null }))
    return resultado
  } catch (erro) {
    definir(() => ({ falhaAcao: mensagemDeErro(erro) }))
    return null
  }
}

async function atualizarAcessos() {
  const acessos = await api.acessos().catch(() => null)
  if (acessos) definir(() => ({ acessos }))
}

function historicoAntesDe(id: number): TurnoHistorico[] {
  return estado.conversa
    .filter((t) => t.id < id && t.resposta)
    .slice(-TURNOS_DE_CONTEXTO)
    .map((t) => ({ pergunta: t.pergunta, texto: t.resposta!.texto }))
}

function atualizarTurno(id: number, mudanca: Partial<Turno>) {
  definir((e) => ({ conversa: e.conversa.map((t) => (t.id === id ? { ...t, ...mudanca } : t)) }))
}

async function responderTurno(id: number) {
  const turno = estado.conversa.find((t) => t.id === id)
  if (!turno) return
  atualizarTurno(id, { carregando: true, erro: undefined })
  try {
    const resposta = await api.copiloto(turno.pergunta, historicoAntesDe(id))
    atualizarTurno(id, { resposta, carregando: false })
  } catch (erro) {
    atualizarTurno(id, { erro: mensagemDeErro(erro), repetivel: podeRepetir(erro), carregando: false })
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

export function reiniciar() {
  definir(() => ({ conversa: [], falhaAcao: null }))
  void executar(async () => {
    const servidor = await api.reiniciar()
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

export function useAcoes() {
  return {
    adicionarEvento: useCallback((evento: Evento) => executar(async () => {
      const salvo = await api.adicionarEvento(evento)
      definir((e) => ({ eventos: [...e.eventos, salvo] }))
      void atualizarAcessos()
      return salvo
    }), []),

    alternarConsentimento: useCallback((id: string) => executar(async () => {
      const atualizado = await api.alternarConsentimento(id)
      definir((e) => ({ consentimentos: e.consentimentos.map((c) => (c.id === id ? atualizado : c)) }))
      void atualizarAcessos()
      return atualizado
    }), []),

    alternarPasso: useCallback((id: string) => executar(async () => {
      const atualizado = await api.alternarPasso(id)
      definir((e) => ({ passos: e.passos.map((p) => (p.id === id ? atualizado : p)) }))
      return atualizado
    }), []),

    conectarFonte: useCallback((id: string) => executar(async () => {
      const atualizada = await api.conectarFonte(id)
      definir((e) => ({ fontes: e.fontes.map((f) => (f.id === id ? atualizada : f)) }))
      return atualizada
    }), []),

    gerarCompartilhamento: useCallback((para: string) => executar(async () => {
      const compartilhamento = await api.compartilhar(para)
      definir(() => ({ compartilhamento }))
      void atualizarAcessos()
      return compartilhamento
    }), []),

    /* Ação de IA: lança ErroApi para a tela mostrar o erro no próprio contexto. */
    gerarPassos: useCallback(async () => {
      const gerados = await api.gerarPassos()
      definir(() => ({ passos: gerados.passos }))
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
