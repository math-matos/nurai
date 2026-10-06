import type { Evento } from '../../src/data/types.js'
import { chaveDaMedida, nomeDaSerie } from './analitos.js'
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

/* "Solicitados novo Holter e ultrassom de carótidas" → ["novo Holter", "ultrassom de carótidas"]. */
function itensSolicitados(e: Evento): ItemPedido[] {
  if (!TIPOS_PEDIDO.includes(e.tipo)) return []
  const trecho = e.resumo.match(/solicitad[oa]s?\s+([^.;—–]+)/i)?.[1]
  if (!trecho) return []
  return trecho.split(/,|\se\s/).map((i) => i.trim()).filter(Boolean)
    .map((nome) => ({ nome, janela: JANELA_REPETICAO_DIAS, casa: (feito: Evento) => tituloTem(feito, palavrasDe(nome)) }))
}

/* "Pedido de exame" com "perfil lipídico" no resumo: o exame vem do texto, por nome ou sinônimo. */
function itensDoPedidoAvulso(e: Evento): ItemPedido[] {
  if (!pedeExames(e)) return []
  const texto = normalizar(`${e.titulo} ${e.resumo}`)
  const conhecidos = EXAMES_CONHECIDOS.filter(({ padrao }) => padrao.test(texto))
    .map(({ nome, padrao }) => ({ nome, casa: (feito: Evento) => padrao.test(normalizar(feito.titulo)) }))
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

/* Retorno recomendado sem nenhum registro posterior da mesma especialidade. */
function retornosSemRegistro(eventos: Evento[]): Pendencia[] {
  return eventos
    .filter((e) => e.especialidade && /retorno/i.test(e.resumo))
    .filter((e) => !eventos.some((d) => d.data > e.data && d.especialidade === e.especialidade))
    .map((e) => {
      const frase = e.resumo.split(/(?<=\.)\s+/).find((f) => /retorno/i.test(f))?.trim().replace(/\.$/, '')
      return {
        tipo: 'retorno' as const,
        alvo: e.especialidade!,
        data: e.data,
        descricao: `Em ${dataBR(e.data)}, "${e.titulo}" registrou: "${frase}". Não há registro posterior de ${e.especialidade}.`,
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
      `Possível exame repetido: pedido em ${dataBR(r.pedidoData)} de ${r.pedidoExame}, já realizado em ${dataBR(r.feitoData)} (${r.feitoInstituicao}) como "${r.exame}"; o pedido (${r.pedidoInstituicao}) veio ${r.dias} dias depois do exame feito (${r.feito}, ${r.pedido}).`)),
    'Pendências (recomendação ou pedido sem registro posterior correspondente):',
    lista(f.pendencias.map((p) => `${p.descricao} (${p.ancoras.join(', ')})`)),
  ].join('\n')
}
