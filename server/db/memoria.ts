import { randomUUID } from 'node:crypto'
import type { AcessoLog } from '../../src/data/types.js'
import { gerarCodigo } from './codigo.js'
import { agora, hoje } from './datas.js'
import { dadosIniciais, dadosVazios, type DadosIniciais } from './exemplo.js'
import { montarPerfil, perfilAtualizado, perfilNovo, type PerfilGravado } from './perfil.js'
import {
  ACAO_EXCLUIR_EVENTO, ErroConflito, itensExclusao, normalizarEmail, passosSemEvento, semOpcionaisVazios, VALIDADE_COMPARTILHAMENTO_DIAS, type Compartilhamento,
  type NovoAcesso, type Repositorio, type RepositorioPaciente, type UsuarioComSenha,
} from './repo.js'

interface CompartilhamentoGravado extends Compartilhamento {
  expiraMs: number
  revogado: boolean
}

interface Paciente {
  perfil: PerfilGravado
  criadoMs: number
  estado: DadosIniciais
  /* Do mais antigo para o mais recente. */
  compartilhamentos: CompartilhamentoGravado[]
}

const DIA_MS = 86_400_000
const estadoInicial = (perfil: PerfilGravado): DadosIniciais => dadosIniciais(perfil.onboarding, perfil.nome)
const ativo = (c: CompartilhamentoGravado) => !c.revogado && c.expiraMs > Date.now()
const publico = ({ codigo, criadoEm, para, expiraEm }: CompartilhamentoGravado): Compartilhamento =>
  ({ codigo, criadoEm, para, expiraEm })

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
    const gravar = (estado: DadosIniciais) => {
      pacientes.set(id, { ...paciente(id), estado })
    }
    const gravarCompartilhamentos = (compartilhamentos: CompartilhamentoGravado[]) => {
      pacientes.set(id, { ...paciente(id), compartilhamentos })
    }
    const registrar = (log: NovoAcesso): AcessoLog => {
      const completo = { id: `a${Date.now()}-${++sequencia}`, quando: agora(), ...log }
      gravar({ ...ler(), acessos: [completo, ...ler().acessos] })
      return completo
    }

    return {
      async estado() {
        const p = pacientes.get(id)
        const atual = p?.compartilhamentos.findLast(ativo)
        return { ...structuredClone(p?.estado ?? dadosVazios()), compartilhamento: atual ? publico(atual) : null }
      },

      async adicionarEvento(evento, autor) {
        if (ler().eventos.some((e) => e.id === evento.id)) throw new ErroConflito(`Evento "${evento.id}" já existe`)
        const copia = structuredClone(semOpcionaisVazios(evento))
        gravar({ ...ler(), eventos: [...ler().eventos, copia] })
        registrar({ quem: autor, papel: 'Titular', acao: 'Anexou documento ao histórico', itens: evento.titulo })
        return structuredClone(copia)
      },

      async excluirEvento(eid, autor) {
        const alvo = ler().eventos.find((e) => e.id === eid)
        if (!alvo) return false
        const { atualizados, removidos } = passosSemEvento(ler().passos, eid)
        const novos = new Map(atualizados.map((p) => [p.id, p]))
        const passos = ler().passos.filter((p) => !removidos.includes(p.id)).map((p) => novos.get(p.id) ?? p)
        gravar({ ...ler(), eventos: ler().eventos.filter((e) => e.id !== eid), passos })
        registrar({ quem: autor, papel: 'Titular', acao: ACAO_EXCLUIR_EVENTO, itens: itensExclusao(alvo) })
        return true
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
        const agoraMs = Date.now()
        const expiraMs = agoraMs + VALIDADE_COMPARTILHAMENTO_DIAS * DIA_MS
        const gravado: CompartilhamentoGravado = {
          codigo: gerarCodigo(), criadoEm: agora(new Date(agoraMs)), para, expiraEm: agora(new Date(expiraMs)),
          expiraMs, revogado: false,
        }
        gravarCompartilhamentos([...paciente(id).compartilhamentos, gravado])
        registrar({ quem: autor, papel: 'Titular', acao: 'Gerou acesso temporário', itens: `${para}, 30 dias` })
        return publico(gravado)
      },

      async revogarCompartilhamento(codigo, autor) {
        const alvo = pacientes.get(id)?.compartilhamentos.find((c) => c.codigo === codigo)
        if (!alvo) return false
        if (alvo.revogado) return true
        gravarCompartilhamentos(paciente(id).compartilhamentos
          .map((c) => (c.codigo === codigo ? { ...c, revogado: true } : c)))
        registrar({ quem: autor, papel: 'Titular', acao: 'Revogou acesso temporário', itens: alvo.para })
        return true
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
        pacientes.set(id, { ...paciente(id), estado: estadoInicial(paciente(id).perfil), compartilhamentos: [] })
      },
    }
  }

  async function excluirPaciente(id: string) {
    if (!pacientes.delete(id)) return false
    const doPaciente = new Set([...usuarios.values()].filter((u) => u.pacienteId === id).map((u) => u.id))
    for (const [email, u] of usuarios) if (doPaciente.has(u.id)) usuarios.delete(email)
    for (const [token, s] of sessoes) if (doPaciente.has(s.usuarioId)) sessoes.delete(token)
    return true
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
      pacientes.set(perfil.pacienteId, { perfil, criadoMs: Date.now(), estado: estadoInicial(perfil), compartilhamentos: [] })
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
      pacientes.set(id, { ...p, perfil, estado: estadoInicial(perfil), compartilhamentos: [] })
      return montarPerfil(perfil)
    },

    excluirPaciente,
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

    async buscarCompartilhamentoAtivo(codigo) {
      for (const [pacienteId, p] of pacientes) {
        const c = p.compartilhamentos.find((x) => x.codigo === codigo)
        if (c) return ativo(c) ? { pacienteId, para: c.para, expiraEm: c.expiraEm } : null
      }
      return null
    },

    async limpar({ sessoesExpiradasAntesDe, tentativasAntesDe, convidadosCriadosAntesDe }) {
      const convidados = [...pacientes].filter(([, p]) => p.perfil.convidado && p.criadoMs < convidadosCriadosAntesDe.getTime())
      for (const [id] of convidados) await excluirPaciente(id)
      const expiradas = [...sessoes].filter(([, s]) => s.expiraEm < sessoesExpiradasAntesDe)
      for (const [token] of expiradas) sessoes.delete(token)
      const antes = tentativas.length
      tentativas = tentativas.filter((t) => t.quando >= tentativasAntesDe.getTime())
      return { sessoes: expiradas.length, tentativas: antes - tentativas.length, convidados: convidados.length }
    },
  }
}
