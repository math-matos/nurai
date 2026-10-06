import { Hono, type Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { responderCopiloto } from '../ai/casos/copiloto.js'
import { explicarExame } from '../ai/casos/explicar.js'
import { extrairEvento, type EntradaExtracao } from '../ai/casos/extrair.js'
import { gerarPassos } from '../ai/casos/passos.js'
import { gerarResumo } from '../ai/casos/resumo.js'
import { ErroIa } from '../ai/erros.js'
import { LIMITE_PDF, textoDoPdf } from '../ai/pdf.js'
import type { LlmProvider } from '../ai/provider.js'
import type { AmbienteApp } from '../auth/middleware.js'
import { lerCorpo } from '../http.js'

const texto = z.string().trim().min(1)

/* O histórico vai inteiro para o LLM: limitado ao que o copiloto usa (6 turnos) e sempre como user/assistant. */
const esquemaCopiloto = z.object({
  pergunta: texto.max(1000),
  historico: z.array(z.object({
    pergunta: z.string().max(1000),
    texto: z.array(z.string().max(2000)).max(10),
  })).max(6).optional(),
})
const esquemaTexto = z.object({
  texto: texto.max(100_000),
  nomeArquivo: texto.max(200).optional(),
})
const esquemaResumo = z.object({ especialidade: texto.max(80) })

async function lerPdf(c: Context): Promise<EntradaExtracao> {
  const { arquivo } = await c.req.parseBody()
  if (!(arquivo instanceof File)) throw new HTTPException(400, { message: 'Envie o PDF no campo "arquivo"' })
  if (arquivo.size > LIMITE_PDF) throw new ErroIa('ARQUIVO_GRANDE', 'O PDF passa do limite de 4 MB')
  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  return { texto: await textoDoPdf(bytes), nomeArquivo: arquivo.name.slice(0, 200) }
}

/* Os casos de IA enxergam só o histórico e o perfil do paciente da sessão. */
export function rotasIa(llm: LlmProvider): Hono<AmbienteApp> {
  const rotas = new Hono<AmbienteApp>()
  const contexto = (c: Context<AmbienteApp>) => ({ repo: c.var.repoPaciente, perfil: c.var.perfil, llm })

  rotas.post('/copiloto', async (c) =>
    c.json(await responderCopiloto(contexto(c), await lerCorpo(c, esquemaCopiloto))))

  rotas.post('/extrair', async (c) => {
    const multipart = c.req.header('content-type')?.startsWith('multipart/form-data')
    const entrada = multipart ? await lerPdf(c) : await lerCorpo(c, esquemaTexto)
    return c.json(await extrairEvento({ llm }, entrada))
  })

  rotas.post('/exames/:id/explicar', async (c) => {
    const id = c.req.param('id')
    const resposta = await explicarExame(contexto(c), id)
    if (!resposta) throw new HTTPException(404, { message: `Evento "${id}" não encontrado` })
    return c.json(resposta)
  })

  rotas.post('/resumo', async (c) => {
    const { especialidade } = await lerCorpo(c, esquemaResumo)
    return c.json(await gerarResumo(contexto(c), especialidade))
  })

  rotas.post('/passos/gerar', async (c) => c.json(await gerarPassos(contexto(c))))

  return rotas
}
