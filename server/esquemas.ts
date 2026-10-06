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
    refMin: z.number().optional(),
    refMax: z.number().optional(),
    sinal,
  })
    .refine((m) => m.refMin !== undefined || m.refMax !== undefined, 'informe ao menos um limite da faixa de referência')
    .refine((m) => m.refMin === undefined || m.refMax === undefined || m.refMin <= m.refMax,
      'o limite mínimo da faixa não pode passar do máximo')).optional(),
  tags: z.array(z.string()),
  origem: z.enum(['RNDS', 'API da instituição', 'OCR + IA', 'Registro manual']),
  confianca: z.number().min(0).max(1).optional(),
  documento: ate(z.string(), 400).optional(),
  novo: z.boolean().optional(),
})

/* Limites das colunas compartilhamentos.para e acessos.quem. */
export const esquemaCompartilhamento = z.object({ para: ate(texto, 400) })

/* Código com formato errado não é erro de validação: cai no mesmo 404 de código inexistente. */
const acessoMedico = {
  codigo: z.string({ error: 'Informe o código' }).max(64),
  profissional: ate(z.string({ error: 'Informe seu nome' }).trim()
    .min(3, 'Informe seu nome (pelo menos 3 caracteres)')
    .max(120, 'O nome pode ter no máximo 120 caracteres'), 200),
}

export const esquemaAcessoMedico = z.object(acessoMedico)

export const esquemaVerificacaoMedico = z.object({ codigo: acessoMedico.codigo })

export const esquemaResumoMedico = z.object({
  ...acessoMedico,
  especialidade: texto.max(80).optional(),
})

/* ---- Conta e perfil ---- */

const nome = ate(z.string({ error: 'Informe o nome' }).trim().min(1, 'Informe o nome'), 200)
const email = z.string({ error: 'Informe o e-mail' }).trim().toLowerCase()
  .pipe(z.email({ error: 'E-mail inválido' }).max(254, 'E-mail longo demais'))
const senha = z.string({ error: 'Informe a senha' })
  .min(8, 'A senha precisa ter pelo menos 8 caracteres')
  .max(200, 'A senha pode ter no máximo 200 caracteres')
const dataNascimento = z.string()
  .refine(dataIsoValida, 'Use uma data válida no formato AAAA-MM-DD')
  .refine((s) => s <= new Date().toISOString().slice(0, 10), 'A data de nascimento não pode estar no futuro')
const lista = z.array(ate(z.string().trim().min(1), 200)).max(50)

export const esquemaCadastro = z.object({
  nome,
  email,
  senha,
  dataNascimento: dataNascimento.optional(),
  aceiteLgpd: z.literal(true, { error: 'É preciso aceitar o uso dos seus dados de saúde (LGPD)' }),
})

/* Login não valida formato: a resposta não pode dar pista sobre o que existe. */
export const esquemaLogin = z.object({
  email: z.string({ error: 'Informe o e-mail' }).trim().toLowerCase().min(1, 'Informe o e-mail'),
  senha: z.string({ error: 'Informe a senha' }).min(1, 'Informe a senha'),
})

const relacao = ate(z.string({ error: 'Informe a relação' }).trim().min(1, 'Informe a relação'), 40)

/* Sem paciente: o histórico é de quem criou a conta. Com paciente ("para alguém que eu cuido"), o histórico
   passa a ser dele e quem criou a conta vira o responsável, com a relação que tem com ele. */
export const esquemaOnboarding = z.object({
  modo: z.enum(['vazio', 'exemplo'], { error: "Use 'vazio' ou 'exemplo'" }),
  paciente: z.object({ nome, dataNascimento: dataNascimento.optional(), relacao }).optional(),
})

/* '' remove um opcional. Campos fora da lista (convidado, onboarding...) são descartados. */
export const esquemaPerfil = z.object({
  nome: nome.optional(),
  dataNascimento: z.union([z.literal(''), dataNascimento]).optional(),
  condicoes: lista.optional(),
  alergias: lista.optional(),
  cartaoSus: ate(z.string().trim(), 40).optional(),
  plano: ate(z.string().trim(), 200).optional(),
  /* null: o histórico volta a ser do próprio usuário. */
  responsavel: z.union([z.null(), z.object({ nome, relacao })]).optional(),
})

export const esquemaExclusao = z.object({
  confirmacao: z.literal('EXCLUIR', { error: 'Digite EXCLUIR para confirmar' }),
})
