import type { Evento } from '../../src/data/types.js'
import { dataBR, formatarNumero, normalizar, porData } from './casos/comum.js'

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
  feito: string
  feitoData: string
  feitoInstituicao: string
  pedido: string
  pedidoData: string
  pedidoInstituicao: string
  dias: number
}

export interface Pendencia {
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
const TOLERANCIA_ESTAVEL = 0.01
const DIA_MS = 86_400_000
const TIPOS_RESULTADO = ['exame', 'imagem', 'documento']
/* Só consulta/internação pedem exames; em "Solicitado em consulta particular" o exame descreve a si mesmo. */
const TIPOS_PEDIDO = ['consulta', 'internacao']
const PALAVRAS_VAZIAS = new Set(['novo', 'nova', 'novos', 'novas', 'exame', 'exames', 'para', 'com', 'sem'])

export const dias = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / DIA_MS)

function direcao(anterior: number, atual: number): Direcao {
  if (Math.abs(atual - anterior) <= Math.abs(anterior) * TOLERANCIA_ESTAVEL) return 'estável'
  return atual > anterior ? 'subiu' : 'caiu'
}

function tendencias(eventos: Evento[]): Tendencia[] {
  const porNome = new Map<string, { unidade: string; pontos: Tendencia['pontos'] }>()
  for (const e of eventos) {
    for (const m of e.medidas ?? []) {
      const serie = porNome.get(m.nome) ?? { unidade: m.unidade, pontos: [] }
      serie.pontos.push({ id: e.id, data: e.data, valor: m.valor })
      porNome.set(m.nome, serie)
    }
  }
  return [...porNome].filter(([, s]) => s.pontos.length >= 2).map(([nome, { unidade, pontos }]) => {
    const variacoes = pontos.slice(1).map((p, i) => direcao(pontos[i].valor, p.valor))
    return { nome, unidade, pontos, variacoes, ultima: variacoes.at(-1)! }
  })
}

const palavrasDe = (texto: string) =>
  normalizar(texto).split(/[^a-z0-9]+/).filter((p) => p.length >= 4 && !PALAVRAS_VAZIAS.has(p))

const tituloTem = (e: Evento, palavras: string[]) =>
  palavras.length > 0 && palavras.every((p) => normalizar(e.titulo).includes(p))

/* "Solicitados novo Holter e ultrassom de carótidas" → ["novo Holter", "ultrassom de carótidas"]. */
function pedidosDe(e: Evento): string[] {
  if (!TIPOS_PEDIDO.includes(e.tipo)) return []
  const trecho = e.resumo.match(/solicitad[oa]s?\s+([^.;—–]+)/i)?.[1]
  return trecho ? trecho.split(/,|\se\s/).map((i) => i.trim()).filter(Boolean) : []
}

function feitoAntes(eventos: Evento[], pedido: Evento, item: string): Evento | undefined {
  const palavras = palavrasDe(item)
  return eventos.findLast((e) => e.data < pedido.data && dias(e.data, pedido.data) <= JANELA_REPETICAO_DIAS
    && TIPOS_RESULTADO.includes(e.tipo) && tituloTem(e, palavras))
}

function repeticoes(eventos: Evento[]): Repeticao[] {
  return eventos.flatMap((pedido) => pedidosDe(pedido).flatMap((item) => {
    const feito = feitoAntes(eventos, pedido, item)
    return feito ? [{
      exame: feito.titulo, feito: feito.id, feitoData: feito.data, feitoInstituicao: feito.instituicao,
      pedido: pedido.id, pedidoData: pedido.data, pedidoInstituicao: pedido.instituicao, dias: dias(feito.data, pedido.data),
    }] : []
  }))
}

function pedidosSemResultado(eventos: Evento[]): Pendencia[] {
  return eventos.flatMap((pedido) => pedidosDe(pedido)
    .filter((item) => !feitoAntes(eventos, pedido, item))
    .filter((item) => !eventos.some((e) => e.data > pedido.data && TIPOS_RESULTADO.includes(e.tipo) && tituloTem(e, palavrasDe(item))))
    .map((item) => ({
      data: pedido.data,
      descricao: `Pedido de ${item} em ${dataBR(pedido.data)} ("${pedido.titulo}", ${pedido.id}) sem resultado posterior no histórico.`,
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
      ? ` A última medição é de ${dataBR(ultima.data)}: ${formatarNumero(valor.valor)} ${valor.unidade} (${ultima.id}).`
      : ''
    return [{
      data: e.data,
      descricao: `Reavaliação de ${nome} pedida em ${dataBR(e.data)} ("${e.titulo}", ${e.id}), sem nenhuma medição de ${nome} depois dessa data.${anterior}`,
      ancoras: ultima ? [e.id, ultima.id] : [e.id],
    }]
  })
}

/* Retorno recomendado sem nenhum registro posterior da mesma especialidade. */
function retornosSemRegistro(eventos: Evento[]): Pendencia[] {
  return eventos
    .filter((e) => e.especialidade && /retorno/i.test(e.resumo))
    .filter((e) => !eventos.some((d) => d.data > e.data && d.especialidade === e.especialidade))
    .map((e) => {
      const frase = e.resumo.split(/(?<=\.)\s+/).find((f) => /retorno/i.test(f))?.trim().replace(/\.$/, '')
      return {
        data: e.data,
        descricao: `Em ${dataBR(e.data)}, "${e.titulo}" (${e.id}) registrou: "${frase}". Não há registro posterior de ${e.especialidade}.`,
        ancoras: [e.id],
      }
    })
}

export function derivarFatos(eventos: Evento[]): Fatos {
  const ordenados = [...eventos].sort(porData)
  return {
    tendencias: tendencias(ordenados),
    repeticoes: repeticoes(ordenados),
    pendencias: [...pedidosSemResultado(ordenados), ...reavaliacoesSemMedicao(ordenados), ...retornosSemRegistro(ordenados)]
      .sort((a, b) => a.data.localeCompare(b.data)),
  }
}

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
      `"${r.exame}" feito em ${dataBR(r.feitoData)} em ${r.feitoInstituicao} (${r.feito}) e pedido de novo em ${dataBR(r.pedidoData)} em ${r.pedidoInstituicao} (${r.pedido}), ${r.dias} dias depois.`)),
    'Pendências (recomendação ou pedido sem registro posterior correspondente):',
    lista(f.pendencias.map((p) => p.descricao)),
  ].join('\n')
}
