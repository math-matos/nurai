import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { criarLlmMock } from '../ai/mock.js'
import type { LlmProvider, MensagemLlm } from '../ai/provider.js'
import { criarApp } from '../app.js'
import { criarRepoMemoria } from '../db/memoria.js'
import type { Repositorio } from '../db/repo.js'
import { esquemaEvento } from '../esquemas.js'

/* Contratos que o front consome — fixos. */
const geradoPor = z.enum(['oci', 'mock'])
const textos = z.array(z.string().min(1))
const CONTRATO = {
  copiloto: z.object({
    texto: textos.min(1),
    ancoras: z.array(z.string()),
    serie: z.object({
      nome: z.string(), unidade: z.string(),
      pontos: z.array(z.object({ data: z.string(), valor: z.number() })).min(2),
    }).optional(),
    aviso: z.string().optional(),
    geradoPor,
  }).strict(),
  extrair: z.object({
    evento: z.custom<object>((e) => typeof e === 'object' && e !== null && !('id' in e))
      .pipe(z.preprocess((e) => ({ ...e, id: 'sem-id' }), esquemaEvento))
      .refine((e) => e.origem === 'OCR + IA' && e.novo === true, 'origem OCR + IA e novo: true'),
    avisos: z.array(z.string()),
    geradoPor,
  }).strict(),
  explicar: z.object({
    explicacao: textos.min(1), pontosDeAtencao: textos, perguntasParaMedico: textos,
    ancoras: z.array(z.string()).min(1), aviso: z.string().min(1), geradoPor,
  }).strict(),
  resumo: z.object({
    especialidade: z.string(), sintese: textos.min(1),
    pontos: z.array(z.object({ texto: z.string().min(1), ancoras: z.array(z.string()).min(1) })),
    perguntasSugeridas: textos, aviso: z.string().min(1), geradoPor,
  }).strict(),
  passos: z.object({
    passos: z.array(z.object({
      id: z.string().regex(/^p-ia-\d+$/), titulo: z.string().min(1), porque: z.string().min(1),
      ancoras: z.array(z.string()).min(1), prazo: z.string().min(1),
      prioridade: z.enum(['alta', 'media', 'baixa']), feito: z.boolean(),
    }).strict()).min(1),
    geradoPor,
  }).strict(),
}

/* Fixtures no formato exato que os prompts pedem ao modelo. */
const COPILOTO = {
  texto: ['Sua glicada caiu até 2024 e voltou a subir depois.'],
  ancoras: ['e02', 'e21', 'e99'],
  serie: { medida: 'Hemoglobina glicada (HbA1c)' },
  aviso: null,
}
const EXTRACAO = {
  clinico: true,
  data: '2026-09-20',
  tipo: 'exame',
  titulo: 'Perfil lipídico',
  instituicao: 'Laboratório Teste',
  especialidade: null,
  resumo: 'LDL acima da faixa de referência.',
  medidas: [
    { nome: 'Colesterol LDL', valor: 162, unidade: 'mg/dL', refMin: 0, refMax: 130 },
    { nome: 'Colesterol HDL', valor: 52, unidade: 'mg/dL', refMin: 40, refMax: 200 },
  ],
  tags: ['colesterol'],
  confianca: 0.88,
  avisos: [],
}
const EXPLICACAO = {
  explicacao: ['A filtração glomerular mede quanto o rim filtra por minuto.'],
  pontosDeAtencao: ['Valor abaixo da faixa e menor que em 2023.'],
  perguntasParaMedico: ['Esse valor muda alguma dose dos meus remédios?'],
  ancoras: ['e11', 'e77'],
}
const RESUMO = {
  sintese: ['Fibrilação atrial paroxística desde 2023, em anticoagulação.'],
  pontos: [
    { texto: 'Carga de fibrilação subiu para 6,3%.', ancoras: ['e09', 'e23', 'e88'] },
    { texto: 'Ponto inventado.', ancoras: ['e88'] },
  ],
  perguntasSugeridas: ['O aumento da carga muda algo no tratamento?'],
}
const PASSOS = {
  passos: [
    {
      titulo: 'Cancelar o ultrassom de carótidas pedido na UBS',
      porque: 'Exame repetido seis semanas depois.', ancoras: ['e22', 'e24'],
      prazo: 'Antes da data marcada', prioridade: 'alta',
    },
    {
      titulo: 'Repetir o TSH', porque: 'Reavaliação nunca feita.', ancoras: ['e16', 'e55'],
      prazo: 'Em até 30 dias', prioridade: 'media',
    },
    { titulo: 'Sem base', porque: 'Inventado.', ancoras: ['e55'], prazo: 'Logo', prioridade: 'baixa' },
  ],
}

function llmFake(...respostas: unknown[]) {
  const chamadas: MensagemLlm[][] = []
  const llm: LlmProvider = {
    nome: 'oci',
    async chat(mensagens) {
      chamadas.push(mensagens)
      const proxima = respostas.shift()
      if (proxima instanceof Error) throw proxima
      if (proxima === undefined) throw new Error('fila do fake vazia')
      return typeof proxima === 'string' ? proxima : JSON.stringify(proxima)
    },
  }
  return { llm, chamadas }
}

function json(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

function multipart(conteudo: Uint8Array<ArrayBuffer> | string, nome = 'laudo.pdf'): RequestInit {
  const form = new FormData()
  form.append('arquivo', new File([conteudo], nome, { type: 'application/pdf' }))
  return { method: 'POST', body: form }
}

/* PDF 1.4 mínimo com xref correto; linhas em ASCII com fonte padrão. */
function pdf(linhas: string[]): Uint8Array<ArrayBuffer> {
  const escapar = (s: string) => s.replace(/[\\()]/g, '\\$&')
  const fluxo = linhas.length
    ? `BT /F1 12 Tf 14 TL 72 720 Td ${linhas.map((l) => `(${escapar(l)}) Tj T*`).join(' ')} ET`
    : ''
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${fluxo.length} >>\nstream\n${fluxo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let corpo = '%PDF-1.4\n'
  const offsets = objetos.map((obj, i) => {
    const offset = corpo.length
    corpo += `${i + 1} 0 obj\n${obj}\nendobj\n`
    return offset
  })
  const xref = corpo.length
  corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  corpo += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  corpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(corpo)
}

const LAUDO_TEXTO = [
  'Laboratorio Teste - Resultado de exame',
  'Paciente: Helena Duarte Nogueira',
  'Data da coleta: 20/09/2026',
  'Colesterol LDL: 162 mg/dL (referencia: 0 a 130)',
  'Colesterol HDL: 52 mg/dL (referencia: 40 a 200)',
]

describe('rotas de IA com provider real (fake)', () => {
  let repo: Repositorio

  beforeEach(() => {
    repo = criarRepoMemoria()
  })

  const app = (llm: LlmProvider) => criarApp({ repo, llm })

  describe('POST /api/copiloto', () => {
    it('filtra âncoras inexistentes e monta a série a partir das medidas reais', async () => {
      const { llm, chamadas } = llmFake(COPILOTO)
      const res = await app(llm).request('/api/copiloto', json({ pergunta: 'Como minha glicada evoluiu?' }))
      expect(res.status).toBe(200)
      const body = CONTRATO.copiloto.parse(await res.json())
      expect(body.ancoras).toEqual(['e02', 'e21'])
      expect(body.geradoPor).toBe('oci')
      expect(body.aviso).toBeUndefined()
      expect(body.serie).toEqual({
        nome: 'Hemoglobina glicada (HbA1c)', unidade: '%',
        pontos: [
          { data: '04/2019', valor: 7.8 }, { data: '08/2023', valor: 7.1 }, { data: '03/2024', valor: 6.9 },
          { data: '09/2025', valor: 7.4 }, { data: '03/2026', valor: 7.2 },
        ],
      })
      const [sistema, ...resto] = chamadas[0]
      expect(sistema.role).toBe('system')
      expect(sistema.content).toMatch(/nunca diagnostic/i)
      expect(resto.at(-1)?.content).toContain('[e21]')
      expect(resto.at(-1)?.content).toContain('Como minha glicada evoluiu?')
    })

    it('sem nenhuma âncora válida responde que não encontrou', async () => {
      const { llm } = llmFake({ ...COPILOTO, ancoras: ['e99'], serie: null })
      const res = await app(llm).request('/api/copiloto', json({ pergunta: 'Tenho câncer?' }))
      expect(await res.json()).toEqual({
        texto: ['Não encontrei no seu histórico registros que sustentem uma resposta para isso.'],
        ancoras: [], geradoPor: 'oci',
      })
    })

    it('ignora série de medida que não existe no histórico', async () => {
      const { llm } = llmFake({ ...COPILOTO, serie: { medida: 'Vitamina D' }, aviso: 'Confirme com o médico.' })
      const body = CONTRATO.copiloto.parse(
        await (await app(llm).request('/api/copiloto', json({ pergunta: 'vitamina d?' }))).json())
      expect(body.serie).toBeUndefined()
      expect(body.aviso).toBe('Confirme com o médico.')
    })

    it('envia o histórico da conversa como turnos anteriores', async () => {
      const { llm, chamadas } = llmFake(COPILOTO)
      await app(llm).request('/api/copiloto', json({
        pergunta: 'E agora?', historico: [{ pergunta: 'Como está a glicada?', texto: ['Está em 7,2%.'] }],
      }))
      expect(chamadas[0].map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user'])
      expect(chamadas[0][2].content).toContain('Está em 7,2%.')
    })

    it('valida o corpo com 400', async () => {
      const { llm } = llmFake()
      expect((await app(llm).request('/api/copiloto', json({ pergunta: '' }))).status).toBe(400)
      expect((await app(llm).request('/api/copiloto', json({}))).status).toBe(400)
    })

    it('JSON inválido duas vezes vira 502 IA_RESPOSTA_INVALIDA', async () => {
      const { llm, chamadas } = llmFake('não é json', '{"texto": "string solta"}')
      const res = await app(llm).request('/api/copiloto', json({ pergunta: 'oi' }))
      expect(res.status).toBe(502)
      expect(await res.json()).toMatchObject({ codigo: 'IA_RESPOSTA_INVALIDA' })
      expect(chamadas).toHaveLength(2)
    })

    it('erro do provider vira 503 IA_INDISPONIVEL', async () => {
      const { llm } = llmFake(new Error('ECONNREFUSED'))
      const res = await app(llm).request('/api/copiloto', json({ pergunta: 'oi' }))
      expect(res.status).toBe(503)
      const body = await res.json() as { erro: string; codigo: string }
      expect(body.codigo).toBe('IA_INDISPONIVEL')
      expect(body.erro).not.toContain('ECONNREFUSED')
    })
  })

  describe('POST /api/extrair', () => {
    it('extrai evento de texto com sinal calculado no servidor e não salva', async () => {
      const { llm, chamadas } = llmFake(EXTRACAO)
      const antes = (await repo.estado()).eventos.length
      const res = await app(llm).request('/api/extrair', json({ texto: LAUDO_TEXTO.join('\n'), nomeArquivo: 'lipidios.pdf' }))
      expect(res.status).toBe(200)
      const { evento, avisos, geradoPor } = CONTRATO.extrair.parse(await res.json())
      expect(geradoPor).toBe('oci')
      expect(evento).toMatchObject({
        data: '2026-09-20', tipo: 'exame', titulo: 'Perfil lipídico', instituicao: 'Laboratório Teste',
        fonte: 'paciente', sinal: 'alterado', origem: 'OCR + IA', confianca: 0.88,
        documento: 'lipidios.pdf', novo: true, tags: ['colesterol'],
      })
      expect(evento.medidas?.map((m) => m.sinal)).toEqual(['alterado', 'normal'])
      expect(avisos).toEqual([])
      expect(chamadas[0].at(-1)?.content).toContain('Colesterol LDL: 162')
      expect((await repo.estado()).eventos).toHaveLength(antes)
    })

    it('omite medida sem referência e usa a data de hoje quando o documento não traz data', async () => {
      const { llm } = llmFake({
        ...EXTRACAO, data: null, instituicao: null, confianca: 0.5,
        medidas: [{ nome: 'Vitamina D', valor: 28, unidade: 'ng/mL', refMin: null, refMax: null }],
      })
      const { evento, avisos } = CONTRATO.extrair.parse(
        await (await app(llm).request('/api/extrair', json({ texto: 'exame vitamina d 28' }))).json())
      expect(evento.medidas).toBeUndefined()
      expect(evento.sinal).toBe('info')
      expect(evento.instituicao).toBe('Não identificada')
      expect(evento.data).toBe(new Date().toISOString().slice(0, 10))
      expect(evento).not.toHaveProperty('documento')
      expect(avisos.join(' ')).toMatch(/Vitamina D/)
      expect(avisos.join(' ')).toMatch(/data/i)
      expect(avisos.join(' ')).toMatch(/confian/i)
    })

    it('texto não clínico vira 422 NAO_CLINICO', async () => {
      const { llm } = llmFake({ clinico: false })
      const res = await app(llm).request('/api/extrair', json({ texto: 'Lista de compras: arroz, feijão' }))
      expect(res.status).toBe(422)
      expect(await res.json()).toMatchObject({ codigo: 'NAO_CLINICO' })
    })

    it('valida o corpo JSON com 400', async () => {
      const { llm } = llmFake()
      expect((await app(llm).request('/api/extrair', json({ texto: '  ' }))).status).toBe(400)
    })

    it('extrai texto de PDF enviado por multipart', async () => {
      const { llm, chamadas } = llmFake(EXTRACAO)
      const res = await app(llm).request('/api/extrair', multipart(pdf(LAUDO_TEXTO), 'lipidios-set.pdf'))
      expect(res.status).toBe(200)
      const { evento } = CONTRATO.extrair.parse(await res.json())
      expect(evento.documento).toBe('lipidios-set.pdf')
      expect(chamadas[0].at(-1)?.content).toContain('Colesterol LDL: 162 mg/dL')
    })

    it('arquivo que não é PDF vira 422 PDF_INVALIDO', async () => {
      const { llm } = llmFake()
      const res = await app(llm).request('/api/extrair', multipart('isto não é um pdf'))
      expect(res.status).toBe(422)
      expect(await res.json()).toMatchObject({ codigo: 'PDF_INVALIDO' })
    })

    it('PDF sem texto vira 422 PDF_SEM_TEXTO', async () => {
      const { llm } = llmFake()
      const res = await app(llm).request('/api/extrair', multipart(pdf([])))
      expect(res.status).toBe(422)
      expect(await res.json()).toMatchObject({ codigo: 'PDF_SEM_TEXTO' })
    })

    it('PDF acima de 4 MB vira 413', async () => {
      const { llm } = llmFake()
      const grande = new Uint8Array(4 * 1024 * 1024 + 1)
      grande.set(new TextEncoder().encode('%PDF-1.4'))
      const res = await app(llm).request('/api/extrair', multipart(grande))
      expect(res.status).toBe(413)
      expect(await res.json()).toMatchObject({ codigo: 'ARQUIVO_GRANDE' })
    })

    it('multipart sem o campo arquivo vira 400', async () => {
      const { llm } = llmFake()
      const form = new FormData()
      form.append('outro', 'x')
      expect((await app(llm).request('/api/extrair', { method: 'POST', body: form })).status).toBe(400)
    })
  })

  describe('POST /api/exames/:id/explicar', () => {
    it('explica com histórico da mesma medida e âncoras validadas', async () => {
      const { llm, chamadas } = llmFake(EXPLICACAO)
      const res = await app(llm).request('/api/exames/e21/explicar', { method: 'POST' })
      expect(res.status).toBe(200)
      const body = CONTRATO.explicar.parse(await res.json())
      expect(body.ancoras).toEqual(['e21', 'e11'])
      expect(body.geradoPor).toBe('oci')
      const contexto = chamadas[0].at(-1)?.content ?? ''
      expect(contexto).toContain('[e21]')
      expect(contexto).toContain('[e18]')
      expect(contexto).not.toContain('[e08]')
    })

    it('404 para evento inexistente', async () => {
      const { llm } = llmFake()
      expect((await app(llm).request('/api/exames/nao-existe/explicar', { method: 'POST' })).status).toBe(404)
    })
  })

  describe('POST /api/resumo', () => {
    it('gera resumo com pontos ancorados e registra o acesso', async () => {
      const { llm } = llmFake(RESUMO)
      const res = await app(llm).request('/api/resumo', json({ especialidade: 'Cardiologia' }))
      expect(res.status).toBe(200)
      const body = CONTRATO.resumo.parse(await res.json())
      expect(body.especialidade).toBe('Cardiologia')
      expect(body.pontos).toEqual([{ texto: 'Carga de fibrilação subiu para 6,3%.', ancoras: ['e09', 'e23'] }])
      const [acesso] = await repo.listarAcessos()
      expect(acesso).toMatchObject({
        quem: 'Helena Duarte Nogueira', papel: 'Titular', acao: 'Gerou resumo pré-consulta', itens: 'Cardiologia',
      })
    })

    it('valida o corpo com 400', async () => {
      const { llm } = llmFake()
      expect((await app(llm).request('/api/resumo', json({}))).status).toBe(400)
    })

    it('não registra acesso se a IA falhar', async () => {
      const { llm } = llmFake(new Error('down'))
      const antes = (await repo.listarAcessos()).length
      expect((await app(llm).request('/api/resumo', json({ especialidade: 'Cardiologia' }))).status).toBe(503)
      expect(await repo.listarAcessos()).toHaveLength(antes)
    })
  })

  describe('POST /api/passos/gerar', () => {
    it('persiste passos com ids estáveis, âncoras válidas e feito preservado', async () => {
      await repo.alternarPasso('p1')
      const { llm, chamadas } = llmFake(PASSOS)
      const res = await app(llm).request('/api/passos/gerar', { method: 'POST' })
      expect(res.status).toBe(200)
      const body = CONTRATO.passos.parse(await res.json())
      expect(body.passos.map((p) => [p.id, p.ancoras, p.feito])).toEqual([
        ['p-ia-1', ['e22', 'e24'], true],
        ['p-ia-2', ['e16'], false],
      ])
      expect((await repo.estado()).passos).toEqual(body.passos)
      expect(chamadas[0].at(-1)?.content).toMatch(/repetid|duplicad/i)
    })
  })
})

describe('rotas de IA em modo mock', () => {
  const repo = criarRepoMemoria()
  const app = criarApp({ repo, llm: criarLlmMock() })

  it('copiloto reaproveita o motor determinístico com série', async () => {
    const res = await app.request('/api/copiloto', json({ pergunta: 'Como minha glicada evoluiu?' }))
    const body = CONTRATO.copiloto.parse(await res.json())
    expect(body.geradoPor).toBe('mock')
    expect(body.ancoras).toContain('e21')
    expect(body.serie?.pontos).toHaveLength(5)
  })

  it('extrai medidas por heurística de texto clínico', async () => {
    const res = await app.request('/api/extrair', json({ texto: LAUDO_TEXTO.join('\n'), nomeArquivo: 'lab.pdf' }))
    expect(res.status).toBe(200)
    const { evento, geradoPor } = CONTRATO.extrair.parse(await res.json())
    expect(geradoPor).toBe('mock')
    expect(evento).toMatchObject({ data: '2026-09-20', tipo: 'exame', documento: 'lab.pdf', sinal: 'alterado' })
    expect(evento.medidas).toEqual([
      { nome: 'Colesterol LDL', valor: 162, unidade: 'mg/dL', refMin: 0, refMax: 130, sinal: 'alterado' },
      { nome: 'Colesterol HDL', valor: 52, unidade: 'mg/dL', refMin: 40, refMax: 200, sinal: 'normal' },
    ])
  })

  it('extrai de PDF real em modo mock', async () => {
    const res = await app.request('/api/extrair', multipart(pdf(LAUDO_TEXTO)))
    expect(res.status).toBe(200)
    const { evento } = CONTRATO.extrair.parse(await res.json())
    expect(evento).toMatchObject({ data: '2026-09-20', documento: 'laudo.pdf', instituicao: 'Laboratorio Teste' })
    expect(evento.medidas?.map((m) => m.nome)).toEqual(['Colesterol LDL', 'Colesterol HDL'])
  })

  it('recusa texto não clínico', async () => {
    const res = await app.request('/api/extrair', json({ texto: 'Lista de compras: arroz, feijão, café' }))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ codigo: 'NAO_CLINICO' })
  })

  it('explica exame a partir das medidas', async () => {
    const res = await app.request('/api/exames/e21/explicar', { method: 'POST' })
    const body = CONTRATO.explicar.parse(await res.json())
    expect(body.ancoras[0]).toBe('e21')
    expect(body.pontosDeAtencao.join(' ')).toMatch(/filtração/i)
  })

  it('gera resumo da especialidade e registra acesso', async () => {
    const res = await app.request('/api/resumo', json({ especialidade: 'cardiologia' }))
    const body = CONTRATO.resumo.parse(await res.json())
    expect(body.pontos.flatMap((p) => p.ancoras)).toEqual(expect.arrayContaining(['e23']))
    expect((await repo.listarAcessos())[0].acao).toBe('Gerou resumo pré-consulta')
  })

  it('gera passos detectando exame repetido e pendências', async () => {
    const res = await app.request('/api/passos/gerar', { method: 'POST' })
    const { passos } = CONTRATO.passos.parse(await res.json())
    const ancoras = passos.map((p) => p.ancoras)
    expect(ancoras).toContainEqual(['e22', 'e24'])
    expect(ancoras.flat()).toEqual(expect.arrayContaining(['e14', 'e16']))
    expect(passos[0].prioridade).toBe('alta')
  })
})
