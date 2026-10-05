import type { TipoId } from '../../../src/data/types.js'
import { normalizar } from './comum.js'
import type { ExtracaoBruta } from './extrair.js'

/* Modo demonstração sem IA generativa: regex sobre o texto, suficiente para laudos simples. */

const CLINICO = /exame|resultado|laudo|referencia|paciente|consulta|medic|hospital|laborat|mg\/dl|glic|colesterol|hemoglobina|pressao|receita|diagnost/
const MEDIDA = /^\s*([^:\n]{2,60}?)\s*:\s*(-?\d+(?:[.,]\d+)?)\s*([^\s(;]*)\s*\(?\s*(?:ref[^\s:]*|VR)\s*:?\s*(-?\d+(?:[.,]\d+)?)\s*(?:a|-|–|até)\s*(-?\d+(?:[.,]\d+)?)/gim
const INSTITUICAO = /laborat|hospital|clinica|ubs|instituto|centro/

const numero = (s: string) => Number(s.replace(',', '.'))

function lerData(texto: string): string | null {
  const br = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return texto.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null
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
  if (!CLINICO.test(normalizado)) return { clinico: false }

  const medidas = [...texto.matchAll(MEDIDA)].map(([, nome, valor, unidade, refMin, refMax]) => ({
    nome: nome.trim(), valor: numero(valor), unidade, refMin: numero(refMin), refMax: numero(refMax),
  }))
  const linhas = texto.split('\n').map((l) => l.trim()).filter(Boolean)
  const instituicao = linhas.find((l) => INSTITUICAO.test(normalizar(l)))
  const titulo = medidas.length
    ? `Exame — ${medidas.slice(0, 3).map((m) => m.nome).join(', ')}`
    : (linhas[0] ?? 'Documento enviado').slice(0, 80)

  return {
    clinico: true,
    data: lerData(texto),
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
