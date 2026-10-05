import type { TipoId } from '../../../src/data/types.js'
import { normalizar } from './comum.js'
import type { ExtracaoBruta } from './extrair.js'

/* Modo demonstração sem IA generativa: regex sobre o texto, suficiente para laudos simples. */

const CLINICO = /exame|resultado|laudo|referencia|paciente|consulta|medic|hospital|laborat|mg\/dl|glic|colesterol|hemoglobina|pressao|diagnost/
/* "receita" sozinha também é de bolo: só conta com dose ou posologia. */
const RECEITA_MEDICA = /prescri|posologia|\d+\s*(?:mg|mcg|ui)\b|comprimido|capsula|gotas|de \d+ em \d+ horas|uso (?:oral|continuo)/
const NUM = '(-?\\d+(?:[.,]\\d+)?)'
const MEDIDA = new RegExp(`^\\s*([^:\\n]{2,60}?)\\s*:\\s*${NUM}\\s*([^\\s(;]*)\\s*\\(?\\s*(?:ref[^\\s:]*|VR)\\s*:?\\s*${NUM}\\s*(?:a|-|–|até)\\s*${NUM}`, 'gim')
/* Linha de tabela: "Colesterol HDL      44 mg/dL     45 a 90 mg/dL" ou "... < 190 mg/dL". */
const MEDIDA_TABELA = new RegExp(`^[ \\t]*([^\\s:][^:\\n]{1,58}?)[ \\t]{2,}${NUM}[ \\t]*(\\S+)[ \\t]{2,}(?:(?:<|≤|até)[ \\t]*${NUM}|${NUM}[ \\t]*(?:a|-|–|até)[ \\t]*${NUM})`, 'gm')
const INSTITUICAO = /laborat|hospital|clinica|ubs|instituto|centro/
const DATA = /(\d{2})\/(\d{2})\/(\d{4})|(\d{4}-\d{2}-\d{2})/
const DATA_ROTULADA = new RegExp(`(?:coleta|realizacao|realizado em|data do exame|data do atendimento|emissao|emitido em)[^\\d\\n]{0,20}(?:${DATA.source})`)
const NASCIMENTO = new RegExp(`(?:nascimento|nasc\\.?|dn)[^\\d\\n]{0,10}(?:${DATA.source})`, 'g')

const numero = (s: string) => Number(s.replace(',', '.'))

const isoDe = (m: RegExpMatchArray) => m[4] ?? `${m[3]}-${m[2]}-${m[1]}`

/* A data do exame vem do rótulo (coleta, realização, emissão); a de nascimento nunca é a do evento. */
function lerData(normalizado: string): string | null {
  const rotulada = normalizado.match(DATA_ROTULADA)
  if (rotulada) return isoDe(rotulada)
  const qualquer = normalizado.replace(NASCIMENTO, '').match(DATA)
  return qualquer ? isoDe(qualquer) : null
}

function lerMedidas(texto: string): Extract<ExtracaoBruta, { clinico: true }>['medidas'] {
  const comRotulo = [...texto.matchAll(MEDIDA)].map(([, nome, valor, unidade, refMin, refMax]) => ({
    nome: nome.trim(), valor: numero(valor), unidade, refMin: numero(refMin), refMax: numero(refMax),
  }))
  const tabela = [...texto.matchAll(MEDIDA_TABELA)].map(([, nome, valor, unidade, teto, refMin, refMax]) => ({
    nome: nome.trim(), valor: numero(valor), unidade,
    refMin: teto ? 0 : numero(refMin), refMax: numero(teto ?? refMax),
  }))
  return [...comRotulo, ...tabela]
}

function lerTipo(normalizado: string, temMedidas: boolean): TipoId {
  if (temMedidas) return 'exame'
  if (/ultrass|tomograf|ressonanc|raio-?x|radiograf|ecocardio/.test(normalizado)) return 'imagem'
  if (/receita|prescri/.test(normalizado)) return 'medicacao'
  if (/consulta/.test(normalizado)) return 'consulta'
  return 'documento'
}

export function extrairPorHeuristica(texto: string): ExtracaoBruta {
  const normalizado = normalizar(texto)
  if (!CLINICO.test(normalizado) && !RECEITA_MEDICA.test(normalizado)) return { clinico: false }

  const medidas = lerMedidas(texto)
  const linhas = texto.split('\n').map((l) => l.trim()).filter(Boolean)
  const instituicao = linhas.find((l) => INSTITUICAO.test(normalizar(l)))
  const titulo = medidas.length
    ? `Exame — ${medidas.slice(0, 3).map((m) => m.nome).join(', ')}`
    : (linhas[0] ?? 'Documento enviado').slice(0, 80)

  return {
    clinico: true,
    data: lerData(normalizado),
    tipo: lerTipo(normalizado, medidas.length > 0),
    titulo,
    instituicao: instituicao?.split(/\s[-–]\s/)[0].slice(0, 80) ?? null,
    especialidade: null,
    resumo: medidas.length
      ? `Documento lido automaticamente: ${medidas.length} medida(s) identificada(s).`
      : 'Documento lido automaticamente; nenhuma medida numérica identificada.',
    medidas,
    tags: ['documento enviado'],
    confianca: medidas.length ? 0.75 : 0.6,
    avisos: ['Leitura por regras simples (modo demonstração, sem IA generativa).'],
  }
}
