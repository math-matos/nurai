import { z } from 'zod'
import type { Evento } from '../src/data/types.js'

const sinal = z.enum(['normal', 'atencao', 'alterado', 'info'])
const texto = z.string().trim().min(1)

/* Date.parse aceita "2026-02-30" (vira 02/03); o Oracle rejeita no TO_DATE. */
export function dataIsoValida(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s)
}

/* Limites em bytes das colunas VARCHAR2 de server/db/schema.sql: acima disso o Oracle daria 500. */
const bytes = new TextEncoder()
const ate = <T extends z.ZodString>(campo: T, limite: number) =>
  campo.refine((s) => bytes.encode(s).length <= limite, `passa do limite de ${limite} bytes`)

export const esquemaEvento: z.ZodType<Evento> = z.object({
  id: ate(texto, 64),
  data: z.string().refine(dataIsoValida, 'deve ser uma data válida no formato AAAA-MM-DD'),
  tipo: z.enum(['exame', 'consulta', 'imagem', 'cirurgia', 'medicacao', 'internacao', 'vacina', 'documento']),
  titulo: ate(texto, 400),
  instituicao: ate(texto, 400),
  fonte: z.enum(['sus', 'laboratorio', 'hospital', 'clinica', 'operadora', 'paciente']),
  especialidade: ate(z.string(), 200).optional(),
  resumo: z.string(),
  sinal,
  medidas: z.array(z.object({
    nome: texto,
    valor: z.number(),
    unidade: z.string(),
    refMin: z.number(),
    refMax: z.number(),
    sinal,
  })).optional(),
  tags: z.array(z.string()),
  origem: z.enum(['RNDS', 'API da instituição', 'OCR + IA', 'Registro manual']),
  confianca: z.number().min(0).max(1).optional(),
  documento: ate(z.string(), 400).optional(),
  novo: z.boolean().optional(),
})

export const esquemaCompartilhamento = z.object({ para: texto })
