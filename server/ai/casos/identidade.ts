import { normalizar } from './comum.js'

export interface AlertaExtracao {
  codigo: 'PACIENTE_DIVERGENTE'
  texto: string
}

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

/* Abreviação ("V.") e partícula não distinguem pessoas: ficam de fora da comparação. */
const partesDoNome = (nome: string) =>
  normalizar(nome).replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((p) => p.length > 1 && !PARTICULAS.has(p))

/* Mesmo primeiro nome e os demais nomes do mais curto presentes no mais longo: "Marcos Teixeira" e
   "Marcos Vinícius" são "Marcos Vinícius Teixeira"; "Marcos Silva" não é. */
export function mesmoPaciente(a: string, b: string): boolean {
  const [curto, longo] = [partesDoNome(a), partesDoNome(b)].sort((x, y) => x.length - y.length)
  if (!curto.length) return true
  return curto[0] === longo[0] && curto.slice(1).every((p) => longo.includes(p))
}

export function alertaDeIdentidade(pacienteNoDocumento: string | undefined, titular: string): AlertaExtracao[] {
  if (!pacienteNoDocumento || mesmoPaciente(pacienteNoDocumento, titular)) return []
  return [{
    codigo: 'PACIENTE_DIVERGENTE',
    texto: `Este documento parece ser de ${pacienteNoDocumento}, não de ${titular}. Confira antes de salvar: anexar o exame de outra pessoa mistura históricos.`,
  }]
}
