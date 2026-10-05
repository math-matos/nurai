import { randomUUID } from 'node:crypto'
import oracledb from 'oracledb'
import {
  ACESSOS, CONSENTIMENTOS, EVENTOS, FONTES_CONECTADAS, PACIENTE, PROXIMOS_PASSOS,
} from '../../src/data/seed.js'
import type { AcessoLog, Consentimento, Evento, ProximoPasso } from '../../src/data/types.js'
import { comConexao, transacao } from './conexao.js'
import { agora, hoje } from './datas.js'
import {
  ErroConflito, type Compartilhamento, type FonteConectada, type NovoAcesso, type Repositorio,
} from './repo.js'

type Linha = Record<string, unknown>
type Bind = Record<string, string | number | null>

const PACIENTE_ID = 'helena'
const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const TABELAS = ['eventos', 'consentimentos', 'acessos', 'passos', 'fontes', 'compartilhamentos']

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
  inserirPaciente: `MERGE INTO pacientes p USING (SELECT :paciente id, :nome nome FROM dual) s ON (p.id = s.id)
    WHEN NOT MATCHED THEN INSERT (id, nome) VALUES (s.id, s.nome)`,
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

const linhaEvento = (e: Evento): Bind => ({
  paciente: PACIENTE_ID, id: e.id, data: e.data, tipo: e.tipo, titulo: e.titulo, instituicao: e.instituicao,
  fonte: e.fonte, especialidade: e.especialidade ?? null, resumo: e.resumo, sinal: e.sinal,
  medidas: e.medidas ? JSON.stringify(e.medidas) : null, tags: JSON.stringify(e.tags), origem: e.origem,
  confianca: e.confianca ?? null, documento: e.documento ?? null, novo: e.novo === undefined ? null : Number(e.novo),
})

const linhaConsentimento = (c: Consentimento): Bind => ({ paciente: PACIENTE_ID, ...c, ativo: Number(c.ativo) })
const linhaAcesso = (a: AcessoLog): Bind => ({ paciente: PACIENTE_ID, ...a })
const linhaPasso = (p: ProximoPasso): Bind =>
  ({ paciente: PACIENTE_ID, ...p, ancoras: JSON.stringify(p.ancoras), feito: Number(p.feito) })
const linhaFonte = (f: FonteConectada): Bind => ({ paciente: PACIENTE_ID, ...f })

async function selecionar(conn: oracledb.Connection, sql: string, binds: Bind = {}) {
  const r = await conn.execute<Linha>(sql, { paciente: PACIENTE_ID, ...binds })
  return r.rows ?? []
}

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

/* ORA-00001: unique constraint violated; a mensagem traz o nome da constraint. */
const violouChave = (e: unknown, constraint: string) =>
  (e as { errorNum?: number }).errorNum === 1 && (e as Error).message.toUpperCase().includes(constraint)

async function registrar(conn: oracledb.Connection, log: NovoAcesso): Promise<AcessoLog> {
  const completo = { id: `a${Date.now()}-${randomUUID().slice(0, 8)}`, quando: agora(), ...log }
  await conn.execute(SQL.inserirAcesso, linhaAcesso(completo))
  return completo
}

export function criarRepoOracle(): Repositorio {
  return {
    nome: 'oracle',

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
        await conn.execute(SQL.inserirEvento, linhaEvento(evento))
      } catch (e) {
        if (violouChave(e, 'EVENTOS_PK')) throw new ErroConflito(`Evento "${evento.id}" já existe`)
        throw e
      }
      await registrar(conn, { quem: autor, papel: 'Titular', acao: 'Anexou documento ao histórico', itens: evento.titulo })
      return structuredClone(evento)
    }),

    alternarConsentimento: (id, autor) => transacao(async (conn) => {
      const r = await conn.execute(
        'UPDATE consentimentos SET ativo = 1 - ativo WHERE paciente_id = :paciente AND id = :id',
        { paciente: PACIENTE_ID, id },
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
        'UPDATE passos SET feito = 1 - feito WHERE paciente_id = :paciente AND id = :id',
        { paciente: PACIENTE_ID, id },
      )
      if (!r.rowsAffected) return null
      return (await selecionar(conn, SQL.passo, { id })).map(paraPasso)[0]
    }),

    substituirPassos: (passos) => transacao(async (conn) => {
      await conn.execute('DELETE FROM passos WHERE paciente_id = :paciente', { paciente: PACIENTE_ID })
      await inserirVarios(conn, SQL.inserirPasso, passos.map(linhaPasso))
      return structuredClone(passos)
    }),

    criarCompartilhamento: (para, autor) => transacao(async (conn) => {
      const codigo = Array.from({ length: 6 }, () =>
        ALFABETO_CODIGO[Math.floor(Math.random() * ALFABETO_CODIGO.length)]).join('')
      const compartilhamento: Compartilhamento = { codigo, criadoEm: agora(), para }
      await conn.execute(SQL.inserirCompartilhamento, { paciente: PACIENTE_ID, ...compartilhamento })
      await registrar(conn, { quem: autor, papel: 'Titular', acao: 'Gerou acesso temporário', itens: `${para}, 30 dias` })
      return compartilhamento
    }),

    conectarFonte: (id) => transacao(async (conn) => {
      const r = await conn.execute(
        `UPDATE fontes SET estado = 'conectado', ultima = :ultima WHERE paciente_id = :paciente AND id = :id`,
        { paciente: PACIENTE_ID, id, ultima: hoje() },
      )
      if (!r.rowsAffected) return null
      return (await selecionar(conn, SQL.fonte, { id })).map(paraFonte)[0]
    }),

    listarAcessos: () => comConexao(async (conn) => (await selecionar(conn, SQL.acessos)).map(paraAcesso)),

    registrarAcesso: (log) => transacao((conn) => registrar(conn, log)),

    reiniciar: () => transacao(async (conn) => {
      await conn.execute(SQL.inserirPaciente, { paciente: PACIENTE_ID, nome: PACIENTE.nome })
      for (const tabela of TABELAS) {
        await conn.execute(`DELETE FROM ${tabela} WHERE paciente_id = :paciente`, { paciente: PACIENTE_ID })
      }
      await inserirVarios(conn, SQL.inserirEvento, EVENTOS.map(linhaEvento))
      await inserirVarios(conn, SQL.inserirConsentimento, CONSENTIMENTOS.map(linhaConsentimento))
      /* ACESSOS vem do mais recente para o mais antigo; a leitura ordena por "ordem" decrescente. */
      await inserirVarios(conn, SQL.inserirAcesso, ACESSOS.toReversed().map(linhaAcesso))
      await inserirVarios(conn, SQL.inserirPasso, PROXIMOS_PASSOS.map(linhaPasso))
      await inserirVarios(conn, SQL.inserirFonte, FONTES_CONECTADAS.map(linhaFonte))
    }),
  }
}
