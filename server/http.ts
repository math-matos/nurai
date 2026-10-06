import type { Context } from 'hono'
import type { z } from 'zod'

/* Vira 400 { erro, codigo: 'VALIDACAO', campos? } no onError do app. */
export class ErroValidacao extends Error {
  readonly campos?: Record<string, string>

  constructor(mensagem: string, campos?: Record<string, string>) {
    super(mensagem)
    this.name = 'ErroValidacao'
    this.campos = campos
  }
}

export async function lerCorpo<T>(c: Context, esquema: z.ZodType<T>): Promise<T> {
  let bruto: unknown
  try {
    bruto = await c.req.json()
  } catch {
    throw new ErroValidacao('Corpo da requisição não é um JSON válido')
  }
  const resultado = esquema.safeParse(bruto)
  if (resultado.success) return resultado.data
  const issues = resultado.error.issues.map((i) => ({ campo: i.path.join('.') || 'corpo', mensagem: i.message }))
  /* Um campo com várias falhas mostra a primeira. */
  const campos = Object.fromEntries(issues.toReversed().map((i) => [i.campo, i.mensagem]))
  const detalhes = issues.map((i) => `${i.campo}: ${i.mensagem}`).join('; ')
  throw new ErroValidacao(`Dados inválidos — ${detalhes}`, campos)
}
