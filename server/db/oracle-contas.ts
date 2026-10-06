import { randomUUID } from 'node:crypto'
import type oracledb from 'oracledb'
import { comConexao, transacao } from './conexao.js'
import { montarPerfil, perfilAtualizado, perfilNovo, type PerfilGravado } from './perfil.js'
import { ErroConflito, normalizarEmail, type Repositorio, type UsuarioComSenha } from './repo.js'

type Linha = Record<string, unknown>
type Bind = Record<string, string | number | null>

/* Instantes de sessão e tentativa trafegam em UTC com milissegundos: comparar com Date do Node, sem fuso. */
const FORMATO_UTC = `'YYYY-MM-DD"T"HH24:MI:SS.FF3'`
const instanteUtc = (bind: string) => `FROM_TZ(TO_TIMESTAMP(:${bind}, ${FORMATO_UTC}), 'UTC')`
const textoUtc = (coluna: string) => `TO_CHAR(SYS_EXTRACT_UTC(${coluna}), ${FORMATO_UTC})`
const paraBindUtc = (d: Date) => d.toISOString().slice(0, 23)
const deTextoUtc = (s: unknown) => new Date(`${s as string}Z`)

const colunasPerfil = (p: string) => `${p}.id "pacienteId", ${p}.nome "nome",
  TO_CHAR(${p}.data_nascimento, 'YYYY-MM-DD') "dataNascimento", ${p}.condicoes "condicoes", ${p}.alergias "alergias",
  ${p}.cartao_sus "cartaoSus", ${p}.plano "plano", ${p}.onboarding "onboarding", ${p}.convidado "convidado"`

const SQL = {
  perfil: `SELECT ${colunasPerfil('p')} FROM pacientes p WHERE p.id = :paciente`,
  perfilParaAtualizar: `SELECT ${colunasPerfil('p')} FROM pacientes p WHERE p.id = :paciente FOR UPDATE`,
  inserirPaciente: `INSERT INTO pacientes (id, nome, data_nascimento, condicoes, alergias, cartao_sus, plano, onboarding,
    convidado) VALUES (:paciente, :nome, TO_DATE(:dataNascimento, 'YYYY-MM-DD'), :condicoes, :alergias, :cartaoSus,
    :plano, :onboarding, :convidado)`,
  atualizarPaciente: `UPDATE pacientes SET nome = :nome, data_nascimento = TO_DATE(:dataNascimento, 'YYYY-MM-DD'),
    condicoes = :condicoes, alergias = :alergias, cartao_sus = :cartaoSus, plano = :plano, onboarding = :onboarding,
    convidado = :convidado WHERE id = :paciente`,
  inserirUsuario: `INSERT INTO usuarios (id, paciente_id, email, senha_hash) VALUES (:id, :paciente, :email, :senhaHash)`,
  usuarioPorEmail: `SELECT id "id", email "email", paciente_id "pacienteId", senha_hash "senhaHash"
    FROM usuarios WHERE email = :email`,
  inserirSessao: `INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES (:token, :usuario, ${instanteUtc('expiraEm')})`,
  sessao: `SELECT u.id "usuarioId", u.email "email", ${textoUtc('s.expira_em')} "expiraEm", ${colunasPerfil('p')}
    FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id JOIN pacientes p ON p.id = u.paciente_id
    WHERE s.token_hash = :token`,
  inserirTentativa: `INSERT INTO tentativas (chave, quando) VALUES (:chave, ${instanteUtc('quando')})`,
  /* Janela máxima usada é 1 h: o que passa de um dia não conta mais e não precisa ficar. */
  limparTentativas: `DELETE FROM tentativas WHERE chave = :chave AND quando < ${instanteUtc('limite')}`,
  contarTentativas: `SELECT COUNT(*) "n" FROM tentativas WHERE chave = :chave AND quando >= ${instanteUtc('desde')}`,
}

const DIA_MS = 86_400_000

export function paraPerfilGravado(l: Linha): PerfilGravado {
  const p = Object.fromEntries(Object.entries(l).filter(([, v]) => v !== null))
  return {
    pacienteId: p.pacienteId as string,
    nome: p.nome as string,
    ...(p.dataNascimento !== undefined && { dataNascimento: p.dataNascimento as string }),
    condicoes: JSON.parse(p.condicoes as string),
    alergias: JSON.parse(p.alergias as string),
    ...(p.cartaoSus !== undefined && { cartaoSus: p.cartaoSus as string }),
    ...(p.plano !== undefined && { plano: p.plano as string }),
    onboarding: p.onboarding as PerfilGravado['onboarding'],
    convidado: p.convidado === 1,
  }
}

const linhaPerfil = (p: PerfilGravado): Bind => ({
  paciente: p.pacienteId, nome: p.nome, dataNascimento: p.dataNascimento ?? null,
  condicoes: JSON.stringify(p.condicoes), alergias: JSON.stringify(p.alergias), cartaoSus: p.cartaoSus ?? null,
  plano: p.plano ?? null, onboarding: p.onboarding, convidado: Number(p.convidado),
})

export async function lerPerfil(conn: oracledb.Connection, pacienteId: string, paraAtualizar = false) {
  const r = await conn.execute<Linha>(paraAtualizar ? SQL.perfilParaAtualizar : SQL.perfil, { paciente: pacienteId })
  const linha = r.rows?.[0]
  return linha ? paraPerfilGravado(linha) : null
}

export async function gravarPerfil(conn: oracledb.Connection, perfil: PerfilGravado) {
  await conn.execute(SQL.atualizarPaciente, linhaPerfil(perfil))
}

/* ORA-00001: unique constraint violated; a mensagem traz o nome da constraint. */
export const violouChave = (e: unknown, constraint: string) =>
  (e as { errorNum?: number }).errorNum === 1 && (e as Error).message.toUpperCase().includes(constraint)

type Contas = Omit<Repositorio, 'nome' | 'paraPaciente' | 'aplicarOnboarding'>

export function contasOracle(): Contas {
  return {
    criarPaciente: (dados) => transacao(async (conn) => {
      const perfil = perfilNovo(randomUUID(), dados)
      await conn.execute(SQL.inserirPaciente, linhaPerfil(perfil))
      return montarPerfil(perfil)
    }),

    obterPerfil: (id) => comConexao(async (conn) => {
      const perfil = await lerPerfil(conn, id)
      return perfil && montarPerfil(perfil)
    }),

    atualizarPerfil: (id, mudancas) => transacao(async (conn) => {
      const atual = await lerPerfil(conn, id, true)
      if (!atual) return null
      const perfil = perfilAtualizado(atual, mudancas)
      await gravarPerfil(conn, perfil)
      return montarPerfil(perfil)
    }),

    excluirPaciente: (id) => transacao(async (conn) => {
      const r = await conn.execute('DELETE FROM pacientes WHERE id = :paciente', { paciente: id })
      return Boolean(r.rowsAffected)
    }),

    criarUsuario: ({ email, senhaHash, pacienteId }) => transacao(async (conn) => {
      const usuario = { id: randomUUID(), email: normalizarEmail(email) }
      try {
        await conn.execute(SQL.inserirUsuario, { ...usuario, paciente: pacienteId, senhaHash })
      } catch (e) {
        if (violouChave(e, 'USUARIOS_EMAIL_UK')) throw new ErroConflito('Email já cadastrado')
        throw e
      }
      return usuario
    }),

    buscarUsuarioPorEmail: (email) => comConexao(async (conn) => {
      const r = await conn.execute<Linha>(SQL.usuarioPorEmail, { email: normalizarEmail(email) })
      const l = r.rows?.[0]
      return l ? ({ ...l, senhaHash: l.senhaHash ?? null } as UsuarioComSenha) : null
    }),

    criarSessao: ({ tokenHash, usuarioId, expiraEm }) => transacao(async (conn) => {
      await conn.execute(SQL.inserirSessao, { token: tokenHash, usuario: usuarioId, expiraEm: paraBindUtc(expiraEm) })
    }),

    buscarSessao: (tokenHash) => comConexao(async (conn) => {
      const r = await conn.execute<Linha>(SQL.sessao, { token: tokenHash })
      const l = r.rows?.[0]
      if (!l) return null
      const { usuarioId, email, expiraEm, ...perfil } = l
      return {
        usuario: { id: usuarioId as string, email: email as string },
        perfil: montarPerfil(paraPerfilGravado(perfil)),
        expiraEm: deTextoUtc(expiraEm),
      }
    }),

    apagarSessao: (tokenHash) => transacao(async (conn) => {
      await conn.execute('DELETE FROM sessoes WHERE token_hash = :token', { token: tokenHash })
    }),

    registrarTentativa: (chave, quando = new Date()) => transacao(async (conn) => {
      await conn.execute(SQL.limparTentativas, { chave, limite: paraBindUtc(new Date(Date.now() - DIA_MS)) })
      await conn.execute(SQL.inserirTentativa, { chave, quando: paraBindUtc(quando) })
    }),

    contarTentativas: (chave, desde) => comConexao(async (conn) => {
      const r = await conn.execute<{ n: number }>(SQL.contarTentativas, { chave, desde: paraBindUtc(desde) })
      return r.rows?.[0].n ?? 0
    }),
  }
}
