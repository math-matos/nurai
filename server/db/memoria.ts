import {
  ACESSOS, CONSENTIMENTOS, EVENTOS, FONTES_CONECTADAS, PROXIMOS_PASSOS,
} from '../../src/data/seed.js'
import type { AcessoLog } from '../../src/data/types.js'
import { agora, hoje } from './datas.js'
import { ErroConflito, type EstadoRepositorio, type NovoAcesso, type Repositorio } from './repo.js'

const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function estadoInicial(): EstadoRepositorio {
  return structuredClone({
    eventos: EVENTOS,
    consentimentos: CONSENTIMENTOS,
    acessos: ACESSOS,
    passos: PROXIMOS_PASSOS,
    fontes: FONTES_CONECTADAS,
    compartilhamento: null,
  })
}

export function criarRepoMemoria(): Repositorio {
  let estado = estadoInicial()
  let sequencia = 0

  const novoAcesso = (log: NovoAcesso): AcessoLog =>
    ({ id: `a${Date.now()}-${++sequencia}`, quando: agora(), ...log })

  const registrar = (log: NovoAcesso) => {
    const completo = novoAcesso(log)
    estado = { ...estado, acessos: [completo, ...estado.acessos] }
    return completo
  }

  return {
    nome: 'memoria',

    async estado() {
      return structuredClone(estado)
    },

    async adicionarEvento(evento, autor) {
      if (estado.eventos.some((e) => e.id === evento.id)) throw new ErroConflito(`Evento "${evento.id}" já existe`)
      const copia = structuredClone(evento)
      estado = { ...estado, eventos: [...estado.eventos, copia] }
      registrar({ quem: autor, papel: 'Titular', acao: 'Anexou documento ao histórico', itens: evento.titulo })
      return structuredClone(copia)
    },

    async alternarConsentimento(id, autor) {
      const alvo = estado.consentimentos.find((c) => c.id === id)
      if (!alvo) return null
      const atualizado = { ...alvo, ativo: !alvo.ativo }
      estado = {
        ...estado,
        consentimentos: estado.consentimentos.map((c) => (c.id === id ? atualizado : c)),
      }
      registrar({
        quem: autor, papel: 'Titular', acao: alvo.ativo ? 'Revogou acesso' : 'Concedeu acesso',
        itens: alvo.instituicao,
      })
      return { ...atualizado }
    },

    async alternarPasso(id) {
      const alvo = estado.passos.find((p) => p.id === id)
      if (!alvo) return null
      const atualizado = { ...alvo, feito: !alvo.feito }
      estado = { ...estado, passos: estado.passos.map((p) => (p.id === id ? atualizado : p)) }
      return structuredClone(atualizado)
    },

    async substituirPassos(passos) {
      estado = { ...estado, passos: structuredClone(passos) }
      return structuredClone(passos)
    },

    async criarCompartilhamento(para, autor) {
      const codigo = Array.from({ length: 6 }, () =>
        ALFABETO_CODIGO[Math.floor(Math.random() * ALFABETO_CODIGO.length)]).join('')
      const compartilhamento = { codigo, criadoEm: agora(), para }
      estado = { ...estado, compartilhamento }
      registrar({ quem: autor, papel: 'Titular', acao: 'Gerou acesso temporário', itens: `${para}, 30 dias` })
      return { ...compartilhamento }
    },

    async conectarFonte(id) {
      const alvo = estado.fontes.find((f) => f.id === id)
      if (!alvo) return null
      const atualizada = { ...alvo, estado: 'conectado' as const, ultima: hoje() }
      estado = { ...estado, fontes: estado.fontes.map((f) => (f.id === id ? atualizada : f)) }
      return { ...atualizada }
    },

    async listarAcessos() {
      return structuredClone(estado.acessos)
    },

    async registrarAcesso(log) {
      return { ...registrar(log) }
    },

    async reiniciar() {
      estado = estadoInicial()
    },
  }
}
