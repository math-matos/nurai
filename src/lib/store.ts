import { useCallback, useEffect, useState } from 'react'
import {
  ACESSOS, CONSENTIMENTOS, EVENTOS, FONTES_CONECTADAS, PROXIMOS_PASSOS,
} from '../data/seed'
import type { AcessoLog, Consentimento, Evento, ProximoPasso } from '../data/types'
import { responder, type Resposta } from '../data/copiloto'

export interface Turno { id: number; pergunta: string; resposta?: Resposta }

const CHAVE = 'nurai.mvp.v1'

export interface Estado {
  eventos: Evento[]
  consentimentos: Consentimento[]
  acessos: AcessoLog[]
  passos: ProximoPasso[]
  fontes: typeof FONTES_CONECTADAS
  compartilhamento: { codigo: string; criadoEm: string; para: string } | null
  conversa: Turno[]
}

function estadoInicial(): Estado {
  return {
    eventos: EVENTOS,
    consentimentos: CONSENTIMENTOS,
    acessos: ACESSOS,
    passos: PROXIMOS_PASSOS,
    fontes: FONTES_CONECTADAS,
    compartilhamento: null,
    conversa: [],
  }
}

function carregar(): Estado {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return estadoInicial()
    const salvo = JSON.parse(bruto) as Partial<Estado>
    return { ...estadoInicial(), ...salvo }
  } catch {
    return estadoInicial()
  }
}

/* Uma única fonte de verdade em memória, espelhada em localStorage e
   compartilhada entre todas as telas por assinatura. */
let estado: Estado = typeof window === 'undefined' ? estadoInicial() : carregar()
const ouvintes = new Set<() => void>()

function persistir() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado))
  } catch {
    /* modo privado ou armazenamento cheio: a sessão segue só em memória */
  }
}

export function definir(mudanca: (anterior: Estado) => Partial<Estado>) {
  estado = { ...estado, ...mudanca(estado) }
  persistir()
  ouvintes.forEach((o) => o())
}

/* Uma pergunta pode nascer em qualquer tela. Sempre chamada de um manipulador de
   evento — nunca durante a renderização. */
export function perguntar(pergunta: string, comEspera = true) {
  const limpo = pergunta.trim()
  if (!limpo) return
  const id = Date.now()
  definir((e) => ({ conversa: [...e.conversa, { id, pergunta: limpo }] }))
  const concluir = () => definir((e) => ({
    conversa: e.conversa.map((t) => (t.id === id ? { ...t, resposta: responder(limpo) } : t)),
  }))
  if (comEspera) window.setTimeout(concluir, 720)
  else concluir()
}

export function reiniciar() {
  estado = estadoInicial()
  try { localStorage.removeItem(CHAVE) } catch { /* ignora */ }
  ouvintes.forEach((o) => o())
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
    adicionarEvento: useCallback((evento: Evento) => {
      definir((e) => ({
        eventos: [...e.eventos, evento],
        acessos: [
          {
            id: `a${Date.now()}`, quando: agora(), quem: 'Helena Duarte Nogueira',
            papel: 'Titular', acao: 'Anexou documento ao histórico', itens: evento.titulo,
          },
          ...e.acessos,
        ],
      }))
    }, []),

    alternarConsentimento: useCallback((id: string) => {
      definir((e) => {
        const alvo = e.consentimentos.find((c) => c.id === id)
        if (!alvo) return {}
        return {
          consentimentos: e.consentimentos.map((c) =>
            c.id === id ? { ...c, ativo: !c.ativo } : c),
          acessos: [
            {
              id: `a${Date.now()}`, quando: agora(), quem: 'Helena Duarte Nogueira',
              papel: 'Titular', acao: alvo.ativo ? 'Revogou acesso' : 'Concedeu acesso',
              itens: alvo.instituicao,
            },
            ...e.acessos,
          ],
        }
      })
    }, []),

    alternarPasso: useCallback((id: string) => {
      definir((e) => ({
        passos: e.passos.map((p) => (p.id === id ? { ...p, feito: !p.feito } : p)),
      }))
    }, []),

    conectarFonte: useCallback((id: string) => {
      definir((e) => ({
        fontes: e.fontes.map((f) =>
          f.id === id ? { ...f, estado: 'conectado' as const, ultima: hoje() } : f),
      }))
    }, []),

    gerarCompartilhamento: useCallback((para: string) => {
      const codigo = Array.from({ length: 6 }, () =>
        'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')
      definir((e) => ({
        compartilhamento: { codigo, criadoEm: agora(), para },
        acessos: [
          {
            id: `a${Date.now()}`, quando: agora(), quem: 'Helena Duarte Nogueira',
            papel: 'Titular', acao: 'Gerou acesso temporário', itens: `${para}, 30 dias`,
          },
          ...e.acessos,
        ],
      }))
    }, []),

    reiniciar,
  }
}

function doisDigitos(n: number) { return String(n).padStart(2, '0') }

export function hoje() {
  const d = new Date()
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function agora() {
  const d = new Date()
  return `${hoje()} ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`
}

export function isoHoje() {
  const d = new Date()
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`
}
