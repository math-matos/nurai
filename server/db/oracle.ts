import { randomUUID } from 'node:crypto'
import oracledb from 'oracledb'
import type { AcessoLog, Consentimento, Evento, ProximoPasso } from '../../src/data/types.js'
import { comConexao, transacao } from './conexao.js'
import { gerarCodigo } from './codigo.js'
import { agora, hoje } from './datas.js'
import { dadosIniciais } from './exemplo.js'
import { contasOracle, gravarPerfil, lerPerfil, violouChave } from './oracle-contas.js'
import { montarPerfil } from './perfil.js'
import {
  ErroConflito, semOpcionaisVazios, type Compartilhamento, type FonteConectada, type ModoOnboarding, type NovoAcesso,
  type Onboarding, type Repositorio, type RepositorioPaciente,
} from './repo.js'

type Linha = Record<string, unknown>
type Bind = Record<string, string | number | null>

const TABELAS_DO_PACIENTE = ['eventos', 'consentimentos', 'acessos', 'passos', 'fontes', 'compartilhamentos']
/* 31^6 códigos: colisão é rara, mas o código é chave global. */
const TENTATIVAS_CODIGO = 3

/* Instantes trafegam no formato exibido (horário de Brasília) e o banco guarda TIMESTAMP WITH TIME ZONE:
   a ida e a volta usam o mesmo fuso, então o texto devolvido é exatamente o que foi gravado. */
const FUSO = 'America/Sao_Paulo'
const instante = (bind: string) => `FROM_TZ(TO_TIMESTAMP(:${bind}, 'DD/MM/YYYY HH24:MI'), '${FUSO}')`
const texto = (coluna: string) => `TO_CHAR(${coluna} AT TIME ZONE '${FUSO}', 'DD/MM/YYYY HH24:MI')`

const COLUNAS = {
  evento: `id "id", TO_CHAR(data, 'YYYY-MM-DD') "data", tipo "tipo", titulo "titulo", instituicao "instituicao",
    fonte "fonte", especialidade "especialidade", resumo "resumo", sinal "sinal", medidas "medidas", tags "tags",
    origem "origem", confianca "confianca", documento "documento", novo "novo"`,
  consentimento: `id "id", instituicao "instituicao", fonte "fonte", escopo "escopo", ativo "ativo",
    TO_CHAR(desde, 'YYYY-MM-DD') "desde"`,
  acesso: `id "id", ${texto('quando')} "quando", quem "quem", papel "papel", acao "acao", itens "itens"`,
  passo: `id "id", titulo "titulo", porque "porque", ancoras "ancoras", prazo "prazo", prioridade "prioridade",
    feito "feito"`,
  fonte: `id "id", nome "nome", fonte "fonte", estado "estado", registros "registros", ultima "ultima"`,
}

const SQL = {
  eventos: `SELECT ${COLUNAS.evento} FROM eventos WHERE paciente_id = :paciente ORDER BY ordem`,
  consentimentos: `SELECT ${COLUNAS.consentimento} FROM consentimentos WHERE paciente_id = :paciente ORDER BY ordem`,
  consentimento: `SELECT ${COLUNAS.consentimento} FROM consentimentos WHERE paciente_id = :paciente AND id = :id`,
  acessos: `SELECT ${COLUNAS.acesso} FROM acessos WHERE paciente_id = :paciente ORDER BY ordem DESC`,
  passos: `SELECT ${COLUNAS.passo} FROM passos WHERE paciente_id = :paciente ORDER BY ordem`,
  passo: `SELECT ${COLUNAS.passo} FROM passos WHERE paciente_id = :paciente AND id = :id`,
  fontes: `SELECT ${COLUNAS.fonte} FROM fontes WHERE paciente_id = :paciente ORDER BY ordem`,
  fonte: `SELECT ${COLUNAS.fonte} FROM fontes WHERE paciente_id = :paciente AND id = :id`,
  compartilhamento: `SELECT codigo "codigo", ${texto('criado_em')} "criadoEm", para "para" FROM compartilhamentos
    WHERE paciente_id = :paciente ORDER BY ordem DESC FETCH FIRST 1 ROWS ONLY`,

  inserirEvento: `INSERT INTO eventos (paciente_id, id, data, tipo, titulo, instituicao, fonte, especialidade, resumo,
    sinal, medidas, tags, origem, confianca, documento, novo) VALUES (:paciente, :id, TO_DATE(:data, 'YYYY-MM-DD'),
    :tipo, :titulo, :instituicao, :fonte, :especialidade, :resumo, :sinal, :medidas, :tags, :origem, :confianca,
    :documento, :novo)`,
  inserirConsentimento: `INSERT INTO consentimentos (paciente_id, id, instituicao, fonte, escopo, ativo, desde)
    VALUES (:paciente, :id, :instituicao, :fonte, :escopo, :ativo, TO_DATE(:desde, 'YYYY-MM-DD'))`,
  inserirAcesso: `INSERT INTO acessos (paciente_id, id, quando, quem, papel, acao, itens)
    VALUES (:paciente, :id, ${instante('quando')}, :quem, :papel, :acao, :itens)`,
  inserirPasso: `INSERT INTO passos (paciente_id, id, titulo, porque, ancoras, prazo, prioridade, feito)
    VALUES (:paciente, :id, :titulo, :porque, :ancoras, :prazo, :prioridade, :feito)`,
  inserirFonte: `INSERT INTO fontes (paciente_id, id, nome, fonte, estado, registros, ultima)
    VALUES (:paciente, :id, :nome, :fonte, :estado, :registros, :ultima)`,
  inserirCompartilhamento: `INSERT INTO compartilhamentos (paciente_id, codigo, criado_em, para, expira_em)
    VALUES (:paciente, :codigo, ${instante('criadoEm')}, :para, ${instante('criadoEm')} + INTERVAL '30' DAY)`,
}

const semNulos = (l: Linha) => Object.fromEntries(Object.entries(l).filter(([, v]) => v !== null))

function paraEvento(l: Linha): Evento {
  const e = semNulos(l)
  return {
    ...e,
    resumo: e.resumo ?? '',
    tags: JSON.parse(e.tags as string),
    ...(e.medidas !== undefined && { medidas: JSON.parse(e.medidas as string) }),
    ...(e.novo !== undefined && { novo: e.novo === 1 }),
  } as Evento
}

const paraConsentimento = (l: Linha) =>
  ({ ...l, escopo: l.escopo ?? '', ativo: l.ativo === 1 }) as Consentimento

const paraAcesso = (l: Linha) =>
  Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v ?? ''])) as unknown as AcessoLog

const paraPasso = (l: Linha) => ({
  ...l, porque: l.porque ?? '', prazo: l.prazo ?? '', ancoras: JSON.parse(l.ancoras as string), feito: l.feito === 1,
}) as ProximoPasso

const paraFonte = (l: Linha) => l as FonteConectada
const paraCompartilhamento = (l: Linha) => l as unknown as Compartilhamento

const linhaEvento = (paciente: string, e: Evento): Bind => ({
  paciente, id: e.id, data: e.data, tipo: e.tipo, titulo: e.titulo, instituicao: e.instituicao,
  fonte: e.fonte, especialidade: e.especialidade ?? null, resumo: e.resumo, sinal: e.sinal,
  medidas: e.medidas ? JSON.stringify(e.medidas) : null, tags: JSON.stringify(e.tags), origem: e.origem,
  confianca: e.confianca ?? null, documento: e.documento ?? null, novo: e.novo === undefined ? null : Number(e.novo),
})

const linhaConsentimento = (paciente: string, c: Consentimento): Bind => ({ paciente, ...c, ativo: Number(c.ativo) })
const linhaAcesso = (paciente: string, a: AcessoLog): Bind => ({ paciente, ...a })
const linhaPasso = (paciente: string, p: ProximoPasso): Bind =>
  ({ paciente, ...p, ancoras: JSON.stringify(p.ancoras), feito: Number(p.feito) })
const linhaFonte = (paciente: string, f: FonteConectada): Bind => ({ paciente, ...f })

/* executeMany precisa dos tipos declarados: colunas opcionais vêm null em várias linhas. */
async function inserirVarios(conn: oracledb.Connection, sql: string, linhas: Bind[]) {
  if (!linhas.length) return
  const bindDefs = Object.fromEntries(Object.keys(linhas[0]).map((k) => {
    const valores = linhas.map((l) => l[k])
    if (valores.some((v) => typeof v === 'number')) return [k, { type: oracledb.NUMBER }]
    const maxSize = Math.max(1, ...valores.map((v) => Buffer.byteLength(String(v ?? ''))))
    return [k, { type: oracledb.STRING, maxSize }]
  }))
  await conn.executeMany(sql, linhas, { bindDefs })
}

/* Apaga os dados do paciente e grava o ponto de partida do modo (exemplo: seed; vazio/pendente: nada). */
async function recomecar(conn: oracledb.Connection, paciente: string, modo: Onboarding, titular: string) {
  for (const tabela of TABELAS_DO_PACIENTE) {
    await conn.execute(`DELETE FROM ${tabela} WHERE paciente_id = :paciente`, { paciente })
  }
  const dados = dadosIniciais(modo, titular)
  await inserirVarios(conn, SQL.inserirEvento, dados.eventos.map((e) => linhaEvento(paciente, e)))
  await inserirVarios(conn, SQL.inserirConsentimento, dados.consentimentos.map((c) => linhaConsentimento(paciente, c)))
  /* O log vem do mais recente para o mais antigo; a leitura ordena por "ordem" decrescente. */
  await inserirVarios(conn, SQL.inserirAcesso, dados.acessos.toReversed().map((a) => linhaAcesso(paciente, a)))
  await inserirVarios(conn, SQL.inserirPasso, dados.passos.map((p) => linhaPasso(paciente, p)))
  await inserirVarios(conn, SQL.inserirFonte, dados.fontes.map((f) => linhaFonte(paciente, f)))
}

function repoPaciente(paciente: string): RepositorioPaciente {
  const selecionar = async (conn: oracledb.Connection, sql: string, binds: Bind = {}) =>
    (await conn.execute<Linha>(sql, { paciente, ...binds })).rows ?? []

  async function registrar(conn: oracledb.Connection, log: NovoAcesso): Promise<AcessoLog> {
    const completo = { id: `a${Date.now()}-${randomUUID().slice(0, 8)}`, quando: agora(), ...log }
    await conn.execute(SQL.inserirAcesso, linhaAcesso(paciente, completo))
    return completo
  }

  return {
    estado: () => comConexao(async (conn) => ({
      eventos: (await selecionar(conn, SQL.eventos)).map(paraEvento),
      consentimentos: (await selecionar(conn, SQL.consentimentos)).map(paraConsentimento),
      acessos: (await selecionar(conn, SQL.acessos)).map(paraAcesso),
      passos: (await selecionar(conn, SQL.passos)).map(paraPasso),
      fontes: (await selecionar(conn, SQL.fontes)).map(paraFonte),
      compartilhamento: (await selecionar(conn, SQL.compartilhamento)).map(paraCompartilhamento)[0] ?? null,
    })),

    adicionarEvento: (evento, autor) => transacao(async (conn) => {
      try {
        await conn.execute(SQL.inserirEvento, linhaEvento(paciente, evento))
      } catch (e) {
        if (violouChave(e, 'EVENTOS_PK')) throw new ErroConflito(`Evento "${evento.id}" já existe`)
        throw e
      }
      await registrar(conn, { quem: autor, papel: 'Titular', acao: 'Anexou documento ao histórico', itens: evento.titulo })
      return structuredClone(semOpcionaisVazios(evento))
    }),

    alternarConsentimento: (id, autor) => transacao(async (conn) => {
      const r = await conn.execute(
        'UPDATE consentimentos SET ativo = 1 - ativo WHERE paciente_id = :paciente AND id = :id', { paciente, id },
      )
      if (!r.rowsAffected) return null
      const [c] = (await selecionar(conn, SQL.consentimento, { id })).map(paraConsentimento)
      await registrar(conn, {
        quem: autor, papel: 'Titular', acao: c.ativo ? 'Concedeu acesso' : 'Revogou acesso', itens: c.instituicao,
      })
      return c
    }),

    alternarPasso: (id) => transacao(async (conn) => {
      const r = await conn.execute(
        'UPDATE passos SET feito = 1 - feito WHERE paciente_id = :paciente AND id = :id', { paciente, id },
      )
      if (!r.rowsAffected) return null
      return (await selecionar(conn, SQL.passo, { id })).map(paraPasso)[0]
    }),

    substituirPassos: (passos) => transacao(async (conn) => {
      await conn.execute('DELETE FROM passos WHERE paciente_id = :paciente', { paciente })
      await inserirVarios(conn, SQL.inserirPasso, passos.map((p) => linhaPasso(paciente, p)))
      return structuredClone(passos)
    }),

    criarCompartilhamento: (para, autor) => transacao(async (conn) => {
      for (let tentativa = 1; ; tentativa++) {
        const compartilhamento: Compartilhamento = { codigo: gerarCodigo(), criadoEm: agora(), para }
        try {
          await conn.execute(SQL.inserirCompartilhamento, { paciente, ...compartilhamento })
        } catch (e) {
          if (violouChave(e, 'COMPARTILHAMENTOS_PK') && tentativa < TENTATIVAS_CODIGO) continue
          throw e
        }
        await registrar(conn, { quem: autor, papel: 'Titular', acao: 'Gerou acesso temporário', itens: `${para}, 30 dias` })
        return compartilhamento
      }
    }),

    conectarFonte: (id) => transacao(async (conn) => {
      const r = await conn.execute(
        `UPDATE fontes SET estado = 'conectado', ultima = :ultima WHERE paciente_id = :paciente AND id = :id`,
        { paciente, id, ultima: hoje() },
      )
      if (!r.rowsAffected) return null
      return (await selecionar(conn, SQL.fonte, { id })).map(paraFonte)[0]
    }),

    listarAcessos: () => comConexao(async (conn) => (await selecionar(conn, SQL.acessos)).map(paraAcesso)),

    registrarAcesso: (log) => transacao((conn) => registrar(conn, log)),

    reiniciar: () => transacao(async (conn) => {
      const perfil = await lerPerfil(conn, paciente, true)
      if (!perfil) throw new Error(`Paciente "${paciente}" não existe`)
      await recomecar(conn, paciente, perfil.onboarding, perfil.nome)
    }),
  }
}

export function criarRepoOracle(): Repositorio {
  return {
    nome: 'oracle',
    paraPaciente: repoPaciente,
    ...contasOracle(),

    aplicarOnboarding: (id, modo: ModoOnboarding) => transacao(async (conn) => {
      const atual = await lerPerfil(conn, id, true)
      if (!atual) return null
      const perfil = { ...atual, onboarding: modo }
      await gravarPerfil(conn, perfil)
      await recomecar(conn, id, modo, perfil.nome)
      return montarPerfil(perfil)
    }),
  }
}
