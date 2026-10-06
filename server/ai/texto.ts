/* Pós-processamento do texto do modelo antes de chegar à paciente. As fontes já vão no campo
   "ancoras"; ids no texto ("[e21]") são ruído. Datas e decimais seguem o padrão pt-BR da UI. */

const ID = 'e\\d{2,}'
const MARCADOR_ID = new RegExp(`\\s*[\\[(]\\s*${ID}(?:\\s*(?:,|;|\\be\\b)\\s*${ID})*\\s*[\\])]`, 'g')
const DATA_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g
/* Só 1–2 casas: "1.500" é milhar em pt-BR e fica como está. */
const DECIMAL_COM_PONTO = /(?<![\d.])(\d+)\.(\d{1,2})(?!\d|\.\d)/g

export function limparTexto(texto: string): string {
  return texto
    .replace(MARCADOR_ID, '')
    .replace(DATA_ISO, '$3/$2/$1')
    .replace(DECIMAL_COM_PONTO, '$1,$2')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export const limparTextos = (textos: string[]) => textos.map(limparTexto).filter(Boolean)
