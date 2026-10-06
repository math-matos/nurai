import type { Evento, TipoId } from '../../src/data/types.js'
import { dataBR } from './casos/comum.js'

/* Pós-processamento do texto do modelo antes de chegar à paciente. As fontes já vão no campo
   "ancoras"; ids no texto ("[e21]") são ruído. Datas e decimais seguem o padrão pt-BR da UI. */

const ID = 'e\\d{2,}'
const MARCADOR = `[\\[(]\\s*(${ID}(?:\\s*(?:,|;|\\be\\b)\\s*${ID})*)\\s*[\\])]`
const DATA_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g
/* Só 1–2 casas: "1.500" é milhar em pt-BR e fica como está; "0.125" não tem como ser milhar.
   Colado a letra ("J45.9", "v2.5"), depois de "versão" ou de vírgula ("1,234.5") é código ou formato inglês. */
const DECIMAL_COM_PONTO = /(?<![\p{L}\d.,])(?<!vers[aã]o\s)(\d+)\.(\d{1,2})(?!\d|\.\d)/gu
const DECIMAL_MENOR_QUE_UM = /(?<![\p{L}\d.,])0\.(\d{3,})(?!\d|\.\d)/gu

/* Artigo ou preposição logo antes do marcador = o id está no lugar do nome do registro
   ("como o [e11] e o [e18]"). Removê-lo deixaria "como o e o"; aí o id vira a descrição. */
type Contracao = '' | 'de' | 'em' | 'a' | 'por'
const CONTRACOES: Record<string, Contracao> = {
  o: '', a: '', os: '', as: '',
  do: 'de', da: 'de', dos: 'de', das: 'de', de: 'de',
  no: 'em', na: 'em', nos: 'em', nas: 'em', em: 'em',
  ao: 'a', aos: 'a', 'à': 'a', 'às': 'a',
  pelo: 'por', pela: 'por', pelos: 'por', pelas: 'por',
}
/* Palavras que pedem artigo antes do nome do registro, mas ficam no texto. */
const PREPOSICOES = ['com', 'e', 'entre', 'sobre', 'após', 'apos', 'como', 'que', 'para']
const ARTIGOS: Record<Contracao, [masculino: string, feminino: string]> = {
  '': ['o', 'a'], de: ['do', 'da'], em: ['no', 'na'], a: ['ao', 'à'], por: ['pelo', 'pela'],
}
const NOME_DO_TIPO: Record<TipoId, [nome: string, feminino: boolean]> = {
  exame: ['exame', false], imagem: ['exame', false], documento: ['documento', false],
  cirurgia: ['procedimento', false], medicacao: ['registro de medicação', false],
  consulta: ['consulta', true], internacao: ['internação', true], vacina: ['vacina', true],
}

const ANTES = [...Object.keys(CONTRACOES), ...PREPOSICOES].join('|')
const MARCADOR_COMO_NOME = new RegExp(`(?<![\\p{L}\\d])(${ANTES})\\s+${MARCADOR}`, 'giu')
const MARCADOR_SOLTO = new RegExp(`\\s*${MARCADOR}`, 'g')

function descrever(evento: Evento, contracao: Contracao): string {
  const [nome, feminino] = NOME_DO_TIPO[evento.tipo]
  return `${ARTIGOS[contracao][feminino ? 1 : 0]} ${nome} de ${dataBR(evento.data)} (${evento.titulo})`
}

const juntar = (partes: string[]) =>
  partes.length < 2 ? partes.join('') : `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}`

function nomearRegistros(texto: string, eventos: Evento[]): string {
  const porId = new Map(eventos.map((e) => [e.id, e]))
  return texto.replace(MARCADOR_COMO_NOME, (trecho, palavra: string, ids: string) => {
    const citados = ids.match(/e\d{2,}/g)!.map((id) => porId.get(id))
    if (citados.some((e) => !e)) return trecho
    const minuscula = palavra.toLowerCase()
    const contracao = CONTRACOES[minuscula]
    const mantida = contracao === undefined ? `${palavra} ` : ''
    const descricao = juntar(citados.map((e) => descrever(e!, contracao ?? '')))
    const resultado = `${mantida}${descricao}`
    return palavra[0] !== minuscula[0] ? resultado[0].toUpperCase() + resultado.slice(1) : resultado
  })
}

export function limparTexto(texto: string, eventos: Evento[] = []): string {
  return nomearRegistros(texto, eventos)
    .replace(MARCADOR_SOLTO, '')
    .replace(DATA_ISO, '$3/$2/$1')
    .replace(DECIMAL_COM_PONTO, '$1,$2')
    .replace(DECIMAL_MENOR_QUE_UM, '0,$1')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/([,;:])(?:\s*[,;:])+/g, '$1')
    .replace(/[,;:](?=[.!?])/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export const limparTextos = (textos: string[], eventos: Evento[] = []) =>
  textos.map((t) => limparTexto(t, eventos)).filter(Boolean)
