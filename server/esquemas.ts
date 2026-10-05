import { z } from 'zod'
import type { Evento } from '../src/data/types.js'

const sinal = z.enum(['normal', 'atencao', 'alterado', 'info'])
const texto = z.string().trim().min(1)

export const esquemaEvento: z.ZodType<Evento> = z.object({
  id: texto,
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'deve estar no formato AAAA-MM-DD'),
  tipo: z.enum(['exame', 'consulta', 'imagem', 'cirurgia', 'medicacao', 'internacao', 'vacina', 'documento']),
  titulo: texto,
  instituicao: texto,
  fonte: z.enum(['sus', 'laboratorio', 'hospital', 'clinica', 'operadora', 'paciente']),
  especialidade: z.string().optional(),
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
  documento: z.string().optional(),
  novo: z.boolean().optional(),
})

export const esquemaCompartilhamento = z.object({ para: texto })
