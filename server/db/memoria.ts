import { randomUUID } from 'node:crypto'
import type { AcessoLog } from '../../src/data/types.js'
import { gerarCodigo } from './codigo.js'
import { agora, hoje } from './datas.js'
import { dadosIniciais, dadosVazios } from './exemplo.js'
import { montarPerfil, perfilAtualizado, perfilNovo, type PerfilGravado } from './perfil.js'
import {
  ErroConflito, normalizarEmail, semOpcionaisVazios, type EstadoRepositorio, type NovoAcesso, type Repositorio,
  type RepositorioPaciente, type UsuarioComSenha,
} from './repo.js'

interface Paciente {
  perfil: PerfilGravado
  estado: EstadoRepositorio
}

const estadoInicial = (perfil: PerfilGravado): EstadoRepositorio =>
  ({ ...dadosIniciais(perfil.onboarding, perfil.nome), compartilhamento: null })

export function criarRepoMemoria(): Repositorio {
  const pacientes = new Map<string, Paciente>()
  const usuarios = new Map<string, UsuarioComSenha>()
  const sessoes = new Map<string, { usuarioId: string; expiraEm: Date }>()
  let tentativas: { chave: string; quando: number }[] = []
  let sequencia = 0

  /* Paciente inexistente é erro de programação: o middleware só entrega ids de sessões válidas. */
  function paciente(id: string): Paciente {
    const p = pacientes.get(id)
    if (!p) throw new Error(`Paciente "${id}" não existe`)
    return p
  }

  function paraPaciente(id: string): RepositorioPaciente {
    const ler = () => paciente(id).estado
    const gravar = (estado: EstadoRepositorio) => {
      pacientes.set(id, { ...paciente(id), estado })
    }
    const registrar = (log: NovoAcesso): AcessoLog => {
      const completo = { id: `a${Date.now()}-${++sequencia}`, quando: agora(), ...log }
      gravar({ ...ler(), acessos: [completo, ...ler().acessos] })
      return completo
    }

    return {
      async estado() {
        return structuredClone(pacientes.get(id)?.estado ?? { ...dadosVazios(), compartilhamento: null })
      },

      async adicionarEvento(evento, autor) {
        if (ler().eventos.some((e) => e.id === evento.id)) throw new ErroConflito(`Evento "${evento.id}" já existe`)
        const copia = structuredClone(semOpcionaisVazios(evento))
        gravar({ ...ler(), eventos: [...ler().eventos, copia] })
        registrar({ quem: autor, papel: 'Titular', acao: 'Anexou documento ao histórico', itens: evento.titulo })
        return structuredClone(copia)
      },

      async alternarConsentimento(cid, autor) {
        const alvo = ler().consentimentos.find((c) => c.id === cid)
        if (!alvo) return null
        const atualizado = { ...alvo, ativo: !alvo.ativo }
        gravar({ ...ler(), consentimentos: ler().consentimentos.map((c) => (c.id === cid ? atualizado : c)) })
        registrar({
          quem: autor, papel: 'Titular', acao: alvo.ativo ? 'Revogou acesso' : 'Concedeu acesso',
          itens: alvo.instituicao,
        })
        return { ...atualizado }
      },

      async alternarPasso(pid) {
        const alvo = ler().passos.find((p) => p.id === pid)
        if (!alvo) return null
        const atualizado = { ...alvo, feito: !alvo.feito }
        gravar({ ...ler(), passos: ler().passos.map((p) => (p.id === pid ? atualizado : p)) })
        return structuredClone(atualizado)
      },

      async substituirPassos(passos) {
        gravar({ ...ler(), passos: structuredClone(passos) })
        return structuredClone(passos)
      },

      async criarCompartilhamento(para, autor) {
        const compartilhamento = { codigo: gerarCodigo(), criadoEm: agora(), para }
        gravar({ ...ler(), compartilhamento })
        registrar({ quem: autor, papel: 'Titular', acao: 'Gerou acesso temporário', itens: `${para}, 30 dias` })
        return { ...compartilhamento }
      },

      async conectarFonte(fid) {
        const alvo = ler().fontes.find((f) => f.id === fid)
        if (!alvo) return null
        const atualizada = { ...alvo, estado: 'conectado' as const, ultima: hoje() }
        gravar({ ...ler(), fontes: ler().fontes.map((f) => (f.id === fid ? atualizada : f)) })
        return { ...atualizada }
      },

      async listarAcessos() {
        return structuredClone(pacientes.get(id)?.estado.acessos ?? [])
      },

      async registrarAcesso(log) {
        return { ...registrar(log) }
      },

      async reiniciar() {
        gravar(estadoInicial(paciente(id).perfil))
      },
    }
  }

  const perfilDe = (id: string) => {
    const p = pacientes.get(id)
    return p ? montarPerfil(p.perfil) : null
  }

  return {
    nome: 'memoria',
    paraPaciente,

    async criarPaciente(dados) {
      const perfil = perfilNovo(randomUUID(), dados)
      pacientes.set(perfil.pacienteId, { perfil, estado: estadoInicial(perfil) })
      return montarPerfil(perfil)
    },

    async obterPerfil(id) {
      return perfilDe(id)
    },

    async atualizarPerfil(id, mudancas) {
      const p = pacientes.get(id)
      if (!p) return null
      const perfil = perfilAtualizado(p.perfil, structuredClone(mudancas))
      pacientes.set(id, { ...p, perfil })
      return montarPerfil(perfil)
    },

    async aplicarOnboarding(id, modo) {
      const p = pacientes.get(id)
      if (!p) return null
      const perfil = { ...p.perfil, onboarding: modo }
      pacientes.set(id, { perfil, estado: estadoInicial(perfil) })
      return montarPerfil(perfil)
    },

    async excluirPaciente(id) {
      if (!pacientes.delete(id)) return false
      const doPaciente = new Set([...usuarios.values()].filter((u) => u.pacienteId === id).map((u) => u.id))
      for (const [email, u] of usuarios) if (doPaciente.has(u.id)) usuarios.delete(email)
      for (const [token, s] of sessoes) if (doPaciente.has(s.usuarioId)) sessoes.delete(token)
      return true
    },

    async criarUsuario({ email, senhaHash, pacienteId }) {
      const normalizado = normalizarEmail(email)
      if (usuarios.has(normalizado)) throw new ErroConflito('Email já cadastrado')
      paciente(pacienteId)
      const usuario = { id: randomUUID(), email: normalizado, pacienteId, senhaHash }
      usuarios.set(normalizado, usuario)
      return { id: usuario.id, email: usuario.email }
    },

    async buscarUsuarioPorEmail(email) {
      const u = usuarios.get(normalizarEmail(email))
      return u ? { ...u } : null
    },

    async criarSessao({ tokenHash, usuarioId, expiraEm }) {
      sessoes.set(tokenHash, { usuarioId, expiraEm: new Date(expiraEm) })
    },

    async buscarSessao(tokenHash) {
      const s = sessoes.get(tokenHash)
      const u = s && [...usuarios.values()].find((x) => x.id === s.usuarioId)
      const perfil = u && perfilDe(u.pacienteId)
      if (!s || !u || !perfil) return null
      return { usuario: { id: u.id, email: u.email }, perfil, expiraEm: new Date(s.expiraEm) }
    },

    async apagarSessao(tokenHash) {
      sessoes.delete(tokenHash)
    },

    async registrarTentativa(chave, quando = new Date()) {
      tentativas = [...tentativas, { chave, quando: quando.getTime() }]
    },

    async contarTentativas(chave, desde) {
      return tentativas.filter((t) => t.chave === chave && t.quando >= desde.getTime()).length
    },
  }
}
