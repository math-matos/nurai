import type { Medida } from '../../src/data/types.js'
import { normalizar } from './casos/comum.js'

/* A extração nomeia o mesmo exame de jeitos diferentes conforme o laudo ("LDL-colesterol",
   "Colesterol LDL", "TFG estimada"). Série e tendência juntam pelo analito, não pelo texto do nome.
   A ordem importa: o primeiro padrão que casa vence (glicada antes de glicemia, não-HDL antes de HDL). */
const ANALITOS: { nome: string; padrao: RegExp }[] = [
  { nome: 'Hemoglobina glicada (HbA1c)', padrao: /glicada|hba1c|\ba1c\b/ },
  { nome: 'Colesterol não-HDL', padrao: /nao[- ]?hdl/ },
  { nome: 'Colesterol HDL', padrao: /\bhdl\b/ },
  { nome: 'Colesterol LDL', padrao: /\bldl\b/ },
  { nome: 'Colesterol total', padrao: /colesterol total/ },
  { nome: 'Triglicerídeos', padrao: /triglicer/ },
  { nome: 'Glicemia de jejum', padrao: /glicemia|glicose/ },
  { nome: 'Albuminúria', padrao: /albumin/ },
  { nome: 'Taxa de filtração glomerular', padrao: /filtracao glomerular|\btfge?\b|\begfr\b/ },
  { nome: 'Creatinina', padrao: /creatinina/ },
  { nome: 'Potássio', padrao: /potassio/ },
  { nome: 'TSH', padrao: /\btsh\b/ },
  { nome: 'Carga de fibrilação atrial', padrao: /fibrilacao/ },
  { nome: 'Frequência cardíaca', padrao: /frequencia cardiaca/ },
]

export function analitoDe(nomeMedida: string): string | undefined {
  const n = normalizar(nomeMedida)
  return ANALITOS.find(({ padrao }) => padrao.test(n))?.nome
}

const unidade = (u: string) => normalizar(u).replace(/\s/g, '').replace(',', '.')

/* Medida desconhecida junta só com o mesmo nome e a mesma unidade ("VEF1" em L e em % não se misturam). */
export const chaveDaMedida = (m: Pick<Medida, 'nome' | 'unidade'>) => analitoDe(m.nome) ?? `${normalizar(m.nome)}|${unidade(m.unidade)}`

/* Rótulo da série: o nome do analito ou, se desconhecido, o nome como veio do laudo. */
export const nomeDaSerie = (m: Pick<Medida, 'nome'>) => analitoDe(m.nome) ?? m.nome

/* Pergunta da paciente → analito. "Colesterol" sozinho é o LDL; "função renal", a TFG. */
const NA_PERGUNTA: [RegExp, string][] = [
  [/\bhdl\b/, 'Colesterol HDL'],
  [/\bldl\b|colesterol(?! total)/, 'Colesterol LDL'],
  [/funcao renal|\brim\b|\brins\b/, 'Taxa de filtração glomerular'],
  [/batimento/, 'Frequência cardíaca'],
]

export function analitoDaPergunta(pergunta: string): string | undefined {
  const texto = normalizar(pergunta)
  return NA_PERGUNTA.find(([re]) => re.test(texto))?.[1] ?? analitoDe(pergunta)
}
