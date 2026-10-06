import type { Evento } from '../../src/data/types.js'
import { chaveDaMedida, nomeDaSerie } from './analitos.js'
import { hojeIso } from '../db/datas.js'
import { dataBR, formatarNumero, mesAno, normalizar, porData } from './casos/comum.js'

/* Fatos calculados de forma determinística a partir dos registros. O modelo erra tendência
   ("glicada em queda" quando subiu) e não liga pedido a exame já feito; aqui isso é contado,
   e o prompt manda usar estes fatos em vez de calcular. */

export type Direcao = 'subiu' | 'caiu' | 'estável'

export interface Tendencia {
  nome: string
  unidade: string
  pontos: { id: string; data: string; valor: number }[]
  variacoes: Direcao[]
  ultima: Direcao
}

export interface Repeticao {
  exame: string
  /* como o pedido nomeia o exame ("perfil lipídico"), que pode diferir do título do feito */
  pedidoExame: string
  feito: string
  feitoData: string
  feitoInstituicao: string
  pedido: string
  pedidoData: string
  pedidoInstituicao: string
  dias: number
}

export interface Pendencia {
  tipo: 'pedido' | 'reavaliacao' | 'retorno'
  /* exame pedido, medida a reavaliar ou especialidade do retorno */
  alvo: string
  data: string
  descricao: string
  ancoras: string[]
}

export interface Fatos {
  tendencias: Tendencia[]
  repeticoes: Repeticao[]
  pendencias: Pendencia[]
}

const JANELA_REPETICAO_DIAS = 365
/* Pedido avulso (guia, requisição) só aponta repetição de exame feito há pouco tempo. */
const JANELA_PEDIDO_AVULSO_DIAS = 180
const TOLERANCIA_ESTAVEL = 0.01
const DIA_MS = 86_400_000
const TIPOS_RESULTADO = ['exame', 'imagem', 'documento']
/* Só consulta/internação pedem exames; em "Solicitado em consulta particular" o exame descreve a si mesmo. */
const TIPOS_PEDIDO = ['consulta', 'internacao']
/* A extração real classifica pedido médico e guia como "documento", com título genérico ("Pedido de exame"). */
const TIPOS_PEDIDO_AVULSO = ['documento', ...TIPOS_PEDIDO]
const PEDIDO_NO_TITULO = /\b(pedido|solicitac\w*|guia|requisic\w*)\b/
const PEDIDO_NO_RESUMO = /^(pedido|solicitac\w*|guia|requisic\w*)\b/
const PALAVRAS_VAZIAS = new Set(['novo', 'nova', 'novos', 'novas', 'exame', 'exames', 'para', 'com', 'sem'])

/* Exames que um pedido costuma citar, com os nomes alternativos (texto já sem acento). */
const EXAMES_CONHECIDOS: { nome: string; padrao: RegExp }[] = [
  { nome: 'perfil lipídico', padrao: /perfil lipidico|lipidograma|colesterol total e fracoes/ },
  { nome: 'hemograma', padrao: /hemograma/ },
  { nome: 'hemoglobina glicada', padrao: /glicada|\bhba1c\b/ },
  { nome: 'glicemia', padrao: /glicemia|glicose/ },
  { nome: 'TSH', padrao: /\btsh\b|tireoestimulante/ },
  { nome: 'creatinina', padrao: /creatinina/ },
  { nome: 'potássio', padrao: /potassio/ },
  { nome: 'urina tipo 1', padrao: /urina tipo|\beas\b|urinalise/ },
  { nome: 'eletrocardiograma', padrao: /eletrocardiograma|\becg\b/ },
  { nome: 'ecocardiograma', padrao: /ecocardiograma/ },
  { nome: 'Holter', padrao: /holter/ },
  { nome: 'radiografia de tórax', padrao: /(radiografia|raio[ -]?x)( d[eo])? torax/ },
  { nome: 'mamografia', padrao: /mamografia/ },
  { nome: 'espirometria', padrao: /espirometria|prova de funcao pulmonar/ },
  { nome: 'MAPA', padrao: /\bmapa\b|monitorizacao ambulatorial/ },
]
const ULTRASSOM = /(?:ultrassom|ultrassonografia|ecografia)(?: doppler)?(?: d[aeo]s?)? ([a-z]{4,})/g

interface ItemPedido {
  nome: string
  janela: number
  casa: (feito: Evento) => boolean
}

export const dias = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / DIA_MS)

function direcao(anterior: number, atual: number): Direcao {
  if (Math.abs(atual - anterior) <= Math.abs(anterior) * TOLERANCIA_ESTAVEL) return 'estável'
  return atual > anterior ? 'subiu' : 'caiu'
}

/* Agrupa pelo analito: "Taxa de filtração glomerular estimada (TFG)" e "TFG estimada" são a mesma série. */
function tendencias(eventos: Evento[]): Tendencia[] {
  const porChave = new Map<string, { nome: string; unidade: string; pontos: Tendencia['pontos'] }>()
  for (const e of eventos) {
    for (const m of e.medidas ?? []) {
      const chave = chaveDaMedida(m)
      const serie = porChave.get(chave) ?? { nome: nomeDaSerie(m), unidade: m.unidade, pontos: [] }
      serie.pontos.push({ id: e.id, data: e.data, valor: m.valor })
      porChave.set(chave, serie)
    }
  }
  return [...porChave.values()].filter((s) => s.pontos.length >= 2).map(({ nome, unidade, pontos }) => {
    const variacoes = pontos.slice(1).map((p, i) => direcao(pontos[i].valor, p.valor))
    return { nome, unidade, pontos, variacoes, ultima: variacoes.at(-1)! }
  })
}

const palavrasDe = (texto: string) =>
  normalizar(texto).split(/[^a-z0-9]+/).filter((p) => p.length >= 4 && !PALAVRAS_VAZIAS.has(p))

const tituloTem = (e: Evento, palavras: string[]) =>
  palavras.length > 0 && palavras.every((p) => normalizar(e.titulo).includes(p))

const pedeExames = (e: Evento) => TIPOS_PEDIDO_AVULSO.includes(e.tipo)
  && (PEDIDO_NO_TITULO.test(normalizar(e.titulo)) || PEDIDO_NO_RESUMO.test(normalizar(e.resumo)))

/* Um pedido de exame não é o exame feito, mesmo sendo do tipo "documento". */
const realizado = (e: Evento) => TIPOS_RESULTADO.includes(e.tipo) && !pedeExames(e)

/* O exame feito pode citar o pedido no título ("Perfil lipídico") ou só nas medidas
   ("Função renal" com "Creatinina"). */
const registraExame = (feito: Evento, padrao: RegExp) =>
  padrao.test(normalizar(feito.titulo)) || (feito.medidas ?? []).some((m) => padrao.test(normalizar(m.nome)))

const SOLICITACAO = /\b(?:solicitad[oa]s?|solicita|solicitou|pedid[oa]s?|pede|pediu)\s*:?\s+([^.;—–]+)/gi
/* "exames como MAPA de 24 horas" → "MAPA de 24 horas". */
const REPETICAO_PEDIDA = /^(?:nov[oa]s?|repetir|repeticao|controle)\b/
const ABERTURA = /^(?:(?:os|as|a|o)\s+)?(?:seguintes\s+)?(?:exames?\s*(?:como|de|:)\s*|exames?\s+)?(?:a realiza[çc][ãa]o de\s+)?/i
const semAbertura = (item: string) => item.trim().replace(ABERTURA, '').trim()

/* "Foram solicitados exames como MAPA de 24 horas, perfil lipídico e potássio, com retorno em 60 dias"
   → ["MAPA de 24 horas", "perfil lipídico", "potássio"]; o retorno é tratado à parte. Exame conhecido
   casa por sinônimo; os demais, por todas as palavras no título do feito. */
function itensSolicitados(e: Evento): ItemPedido[] {
  if (!TIPOS_PEDIDO.includes(e.tipo)) return []
  return [...e.resumo.matchAll(SOLICITACAO)].flatMap(([, trecho]) => trecho.split(/,|\se\s/))
    .map(semAbertura)
    .filter((nome) => nome && !/\b(retorno|consulta|reavaliac|acompanhamento)\b/.test(normalizar(nome)))
    .map((nome) => {
      const conhecido = EXAMES_CONHECIDOS.find(({ padrao }) => padrao.test(normalizar(nome)))
      return {
        nome,
        /* "Nova espirometria", "repetir o Holter": a repetição foi pedida de propósito no seguimento. Não é
           exame duplicado; fica pendente até aparecer um resultado depois do pedido. */
        janela: REPETICAO_PEDIDA.test(normalizar(nome)) ? 0 : JANELA_REPETICAO_DIAS,
        casa: conhecido ? (feito: Evento) => registraExame(feito, conhecido.padrao) : (feito: Evento) => tituloTem(feito, palavrasDe(nome)),
      }
    })
}

/* "Pedido de exame" com "perfil lipídico" no resumo: o exame vem do texto, por nome ou sinônimo. */
function itensDoPedidoAvulso(e: Evento): ItemPedido[] {
  if (!pedeExames(e)) return []
  const texto = normalizar(`${e.titulo} ${e.resumo}`)
  const conhecidos = EXAMES_CONHECIDOS.filter(({ padrao }) => padrao.test(texto))
    .map(({ nome, padrao }) => ({ nome, casa: (feito: Evento) => registraExame(feito, padrao) }))
  const ultrassons = [...new Set([...texto.matchAll(ULTRASSOM)].map((m) => m[1]))].map((regiao) => ({
    nome: `ultrassom de ${regiao}`,
    casa: (feito: Evento) => /ultrass|ecografia/.test(normalizar(feito.titulo)) && normalizar(feito.titulo).includes(regiao),
  }))
  return [...conhecidos, ...ultrassons].map((i) => ({ ...i, janela: JANELA_PEDIDO_AVULSO_DIAS }))
}

function pedidosDe(e: Evento): ItemPedido[] {
  const solicitados = itensSolicitados(e)
  return solicitados.length ? solicitados : itensDoPedidoAvulso(e)
}

function feitoAntes(eventos: Evento[], pedido: Evento, item: ItemPedido): Evento | undefined {
  return eventos.findLast((e) => e.data < pedido.data && dias(e.data, pedido.data) <= item.janela
    && realizado(e) && item.casa(e))
}

function repeticoes(eventos: Evento[]): Repeticao[] {
  return eventos.flatMap((pedido) => pedidosDe(pedido).flatMap((item) => {
    const feito = feitoAntes(eventos, pedido, item)
    return feito ? [{
      exame: feito.titulo, pedidoExame: item.nome, feito: feito.id, feitoData: feito.data, feitoInstituicao: feito.instituicao,
      pedido: pedido.id, pedidoData: pedido.data, pedidoInstituicao: pedido.instituicao, dias: dias(feito.data, pedido.data),
    }] : []
  }))
}

function pedidosSemResultado(eventos: Evento[]): Pendencia[] {
  return eventos.flatMap((pedido) => pedidosDe(pedido)
    .filter((item) => !feitoAntes(eventos, pedido, item))
    .filter((item) => !eventos.some((e) => e.data > pedido.data && realizado(e) && item.casa(e)))
    .map(({ nome }) => ({
      tipo: 'pedido' as const,
      alvo: nome,
      data: pedido.data,
      descricao: `Pedido de ${nome} em ${dataBR(pedido.data)} ("${pedido.titulo}") sem resultado posterior no histórico.`,
      ancoras: [pedido.id],
    })))
}

/* "Reavaliar TSH em 8 semanas": pendente enquanto não houver medição posterior com esse nome. */
function reavaliacoesSemMedicao(eventos: Evento[]): Pendencia[] {
  const nomes = [...new Set(eventos.flatMap((e) => e.medidas ?? []).map((m) => m.nome))]
  return eventos.flatMap((e) => {
    const alvo = normalizar(e.resumo).match(/(?:reavaliar|repetir)\s+(?:o\s+|a\s+)?([a-z0-9]+)/)?.[1]
    const nome = alvo && nomes.find((n) => palavrasDe(n).concat(normalizar(n)).includes(alvo))
    if (!nome) return []
    const medicoes = eventos.filter((d) => d.medidas?.some((m) => m.nome === nome))
    if (medicoes.some((d) => d.data > e.data)) return []
    const ultima = medicoes.findLast((d) => d.data <= e.data)
    const valor = ultima?.medidas?.find((m) => m.nome === nome)
    const anterior = ultima && valor
      ? ` A última medição é de ${dataBR(ultima.data)}: ${formatarNumero(valor.valor)} ${valor.unidade}.`
      : ''
    return [{
      tipo: 'reavaliacao' as const,
      alvo: nome,
      data: e.data,
      descricao: `Reavaliação de ${nome} pedida em ${dataBR(e.data)} ("${e.titulo}"), sem nenhuma medição de ${nome} depois dessa data.${anterior}`,
      ancoras: ultima ? [e.id, ultima.id] : [e.id],
    }]
  })
}

const PRAZO = /retorno\s+(?:em|apos|dentro de)\s+(\d+)\s+(dia|semana|mes|ano)/
/* Retorno feito com algum atraso (ou adiantado) ainda é o retorno: só vira pendência depois do
   previsto + esta folga, e consulta a partir do previsto − esta folga conta como o retorno. */
const TOLERANCIA_RETORNO_DIAS = 30

/* "6 meses" a partir de 04/11/2025 é 04/05/2026: mês e ano no calendário, dia e semana em dias. */
function dataPrevista(resumo: string, desde: string): string | undefined {
  const m = normalizar(resumo).match(PRAZO)
  if (!m) return undefined
  const n = Number(m[1])
  const d = new Date(`${desde}T00:00:00Z`)
  if (m[2] === 'mes') d.setUTCMonth(d.getUTCMonth() + n)
  else if (m[2] === 'ano') d.setUTCFullYear(d.getUTCFullYear() + n)
  else d.setUTCDate(d.getUTCDate() + n * (m[2] === 'semana' ? 7 : 1))
  return d.toISOString().slice(0, 10)
}

const somarDias = (iso: string, n: number) => new Date(Date.parse(iso) + n * DIA_MS).toISOString().slice(0, 10)
const mesmaEspecialidade = (a?: string, b?: string) => !!a && !!b && normalizar(a).trim() === normalizar(b).trim()

/* Retorno recomendado numa consulta sem consulta posterior da mesma especialidade. Exame, receita ou
   vacina do mesmo serviço não são o retorno. Com prazo ("retorno em 6 meses"), conta a consulta a partir
   do previsto − tolerância, e a pendência só aparece depois do previsto + tolerância. Receita que cita
   o retorno ("antecipar o retorno com a pneumologia") não é quem o recomendou. */
function retornosSemRegistro(eventos: Evento[], hoje: string): Pendencia[] {
  return eventos
    .filter((e) => TIPOS_PEDIDO.includes(e.tipo) && e.especialidade && /retorno/i.test(e.resumo))
    .flatMap((e) => {
      const prevista = dataPrevista(e.resumo, e.data)
      const desde = prevista ? somarDias(prevista, -TOLERANCIA_RETORNO_DIAS) : e.data
      /* Internação de urgência na mesma especialidade não substitui o retorno ambulatorial. */
      const voltou = eventos.some((d) => d.id !== e.id && d.tipo === 'consulta' && d.data > e.data
        && d.data >= desde && mesmaEspecialidade(d.especialidade, e.especialidade))
      if (voltou || (prevista && dias(prevista, hoje) <= TOLERANCIA_RETORNO_DIAS)) return []
      const frase = e.resumo.split(/(?<=\.)\s+/).find((f) => /retorno/i.test(f))?.trim().replace(/\.$/, '')
      const quando = prevista ? `previsto para ${mesAno(prevista)}` : `recomendado em ${dataBR(e.data)}`
      return [{
        tipo: 'retorno' as const,
        alvo: e.especialidade!,
        data: e.data,
        descricao: `Retorno em ${e.especialidade} ${quando} sem consulta posterior registrada. Em ${dataBR(e.data)}, "${e.titulo}" registrou: "${frase}".`,
        ancoras: [e.id],
      }]
    })
}

export function derivarFatos(eventos: Evento[], hoje = hojeIso()): Fatos {
  const ordenados = [...eventos].sort(porData)
  return {
    tendencias: tendencias(ordenados),
    repeticoes: repeticoes(ordenados),
    pendencias: [...pedidosSemResultado(ordenados), ...reavaliacoesSemMedicao(ordenados), ...retornosSemRegistro(ordenados, hoje)]
      .sort((a, b) => a.data.localeCompare(b.data)),
  }
}

export interface PontoEmAberto {
  tipo: 'repeticao' | Pendencia['tipo']
  texto: string
  ancoras: string[]
}

/* Os mesmos fatos que viram passos do paciente, em texto descritivo (sem mandar ninguém fazer nada) e
   calculados na hora, sem depender dos passos gravados. A tela do médico e o resumo do paciente usam esta
   lista: a folha que o paciente leva não pode contradizer o que o médico vê. */
export function pontosEmAberto({ repeticoes, pendencias }: Fatos): PontoEmAberto[] {
  return [
    ...repeticoes.map((r) => ({
      tipo: 'repeticao' as const,
      texto: `Possível exame repetido: pedido de ${r.pedidoExame} em ${dataBR(r.pedidoData)} (${r.pedidoInstituicao}), ${r.dias} dias depois de "${r.exame}" realizado em ${dataBR(r.feitoData)} (${r.feitoInstituicao}).`,
      ancoras: [r.feito, r.pedido],
    })),
    ...pendencias.map(({ tipo, descricao, ancoras }) => ({ tipo, texto: descricao, ancoras })),
  ]
}

export const pontosDoHistorico = (eventos: Evento[], hoje = hojeIso()) => pontosEmAberto(derivarFatos(eventos, hoje))

const lista = (itens: string[]) => (itens.length ? itens.map((i) => `- ${i}`) : ['- nenhum encontrado']).join('\n')

function linhaTendencia(t: Tendencia): string {
  const pontos = t.pontos.map((p, i) =>
    `${formatarNumero(p.valor)} em ${dataBR(p.data)} (${p.id})${i ? `, ${t.variacoes[i - 1]}` : ''}`)
  return `${t.nome} (${t.unidade}): ${pontos.join('; ')}. Última variação: ${t.ultima}.`
}

export function serializarFatos(f: Fatos): string {
  return [
    'FATOS DERIVADOS (calculados pelo sistema a partir dos registros; são a fonte para tendências, exames repetidos e pendências — não calcule tendências por conta própria e não contradiga estes fatos):',
    'Evolução das medidas (cada valor comparado com a medição anterior):',
    lista(f.tendencias.map(linhaTendencia)),
    'Exames possivelmente repetidos:',
    lista(f.repeticoes.map((r) =>
      `Possível exame repetido: pedido em ${dataBR(r.pedidoData)} de ${r.pedidoExame}, já realizado em ${dataBR(r.feitoData)} (${r.feitoInstituicao}) como "${r.exame}"; o pedido (${r.pedidoInstituicao}) veio ${r.dias} dias depois do exame feito (${r.feito}, ${r.pedido}).`)),
    'Pendências (recomendação ou pedido sem registro posterior correspondente):',
    lista(f.pendencias.map((p) => `${p.descricao} (${p.ancoras.join(', ')})`)),
  ].join('\n')
}
