import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { APIRequestContext, Page, Response } from '@playwright/test'
import type { Evento } from '../src/data/types.ts'
import { GABARITOS, compararExtracao, ehErro, type ErroEsperado, type Gabarito } from './fixtures/gabaritos.ts'
import { DIR_DOCUMENTOS } from './fixtures/gerar.ts'
import { excluirConta } from './helpers/conta.ts'
import {
  CSRF, LOCAL, REAL, cabecalhosDeIp, cadastrarPorApi, entrarPorApi, esperarApp, lerEstado, type Credenciais,
} from './helpers/sessao.ts'
import { expect, test } from './helpers/test.ts'

const ACERTO_MINIMO = 0.9

/* Uma conta "do zero" por worker para o arquivo todo: os documentos se acumulam no mesmo histórico. */
let conta: Credenciais
let sessaoDaConta: APIRequestContext

test.beforeAll(async ({ playwright }, info) => {
  sessaoDaConta = await playwright.request.newContext({ baseURL: info.project.use.baseURL, extraHTTPHeaders: cabecalhosDeIp() })
  conta = await cadastrarPorApi(sessaoDaConta, { nome: 'Marcos Vinícius Teixeira', modo: 'vazio' })
})

test.afterAll(async () => {
  expect(await excluirConta(sessaoDaConta)).toBe(204)
  await sessaoDaConta.dispose()
})

test.beforeEach(async ({ page }) => {
  await entrarPorApi(page.request, conta)
  await page.goto('/#/app/fontes')
  await esperarApp(page)
})

const caminho = (arquivo: string) => join(DIR_DOCUMENTOS, arquivo)
const ehExtrair = (r: Response) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/extrair'

async function enviar(page: Page, g: Gabarito) {
  if (g.modo === 'pdf') {
    await page.getByTestId('fontes-pdf').setInputFiles(caminho(g.arquivo))
  } else {
    await page.getByTestId('fontes-texto').fill(await readFile(caminho(g.arquivo), 'utf8'))
    await page.getByTestId('fontes-ler-texto').click()
  }
}

const LEGIVEIS = GABARITOS.filter((g) => !ehErro(g.esperado))

for (const g of LEGIVEIS) {
  test(`${g.arquivo}: lê, confere, salva na linha do tempo e persiste`, async ({ page }) => {
    const resposta = page.waitForResponse(ehExtrair)
    await enviar(page, g)
    const extraida = await resposta
    expect(extraida.status()).toBe(200)
    const { evento, geradoPor } = await extraida.json()
    const arquivo = g.modo === 'pdf' ? g.arquivo : 'texto-colado.txt'

    expect(evento).toMatchObject({ fonte: 'paciente', origem: 'OCR + IA', documento: arquivo, novo: true })
    expect(evento.data).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(evento.titulo.trim()).not.toBe('')
    if (LOCAL && !REAL) expect(geradoPor).toBe('mock')
    await expect(page.getByTestId('conferencia')).toContainText(arquivo)
    await expect(page.getByTestId('conferencia-titulo')).toHaveValue(evento.titulo)

    if (REAL) {
      const { acertos, total, divergencias } = compararExtracao(evento, g.esperado as Exclude<Gabarito['esperado'], { erro: ErroEsperado }>)
      const taxa = total ? acertos / total : 1
      test.info().annotations.push({ type: 'extracao', description: `${g.arquivo}: ${acertos}/${total} (${Math.round(taxa * 100)}%)` })
      expect(taxa, JSON.stringify(divergencias)).toBeGreaterThanOrEqual(ACERTO_MINIMO)
    }

    const gravacao = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/eventos')
    await page.getByTestId('conferencia-salvar').click()
    const gravada = await gravacao
    expect(gravada.status()).toBe(201)
    const salvo: Evento = await gravada.json()

    await expect(page).toHaveURL(new RegExp(`#/app/linha/${salvo.id}$`))
    await expect(page.getByTestId('evento-detalhe').getByRole('heading', { level: 2 })).toHaveText(salvo.titulo)
    await expect(page.locator(`#evento-${salvo.id}`)).toContainText(salvo.titulo)

    await page.reload()
    await esperarApp(page)
    await expect(page.getByTestId('evento-detalhe').getByRole('heading', { level: 2 })).toHaveText(salvo.titulo)
    const persistido = (await lerEstado(page.request)).eventos.find((e) => e.id === salvo.id)
    expect(persistido).toMatchObject({ titulo: salvo.titulo, data: evento.data, documento: arquivo })
  })
}

/* Mensagem esperada na tela; `status` null = a tela barra antes de enviar ao servidor. */
const BORDAS: Record<ErroEsperado, { mensagem: string; status: number | null }> = {
  PDF_SEM_TEXTO: { mensagem: 'Este PDF não tem texto selecionável', status: 422 },
  NAO_CLINICO: { mensagem: 'Não reconhecemos este conteúdo como um documento de saúde', status: 422 },
  ARQUIVO_GRANDE: { mensagem: 'O PDF passa de 4 MB', status: null },
  PDF_INVALIDO: { mensagem: 'Não conseguimos abrir este arquivo como PDF', status: 422 },
  NAO_PDF: { mensagem: 'Por enquanto a leitura aceita PDF com texto', status: null },
}

for (const g of GABARITOS.filter((x) => ehErro(x.esperado))) {
  const { erro } = g.esperado as { erro: ErroEsperado }
  const { mensagem, status } = BORDAS[erro]

  test(`${g.arquivo}: ${erro} mostra mensagem amigável sem "Tentar de novo"`, async ({ page }) => {
    const enviados: Response[] = []
    page.on('response', (r) => { if (ehExtrair(r)) enviados.push(r) })
    const eventosAntes = (await lerEstado(page.request)).eventos.length

    await enviar(page, g)
    const falha = page.getByRole('alert')
    await expect(falha).toContainText(mensagem)
    await expect(falha.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0)
    await expect(page.getByTestId('conferencia')).toHaveCount(0)

    if (status === null) {
      expect(enviados, 'a tela deveria barrar antes de enviar').toHaveLength(0)
    } else {
      await expect.poll(() => enviados.length).toBe(1)
      expect(enviados[0].status()).toBe(status)
      expect((await enviados[0].json()).codigo).toBe(erro)
    }
    expect((await lerEstado(page.request)).eventos).toHaveLength(eventosAntes)
  })
}

/* O 413 do PDF grande fica nos testes de rota (server/routes/ia.test.ts): o servidor responde antes de
   ler o corpo, e o proxy do Vite devolve 502 (EPIPE) quando a conexão fecha no meio do envio. */
test('o servidor também recusa um arquivo que não é PDF', async ({ page }) => {
  const arquivo = '15-texto-simples.txt'
  const res = await page.request.post('/api/extrair', {
    headers: CSRF,
    multipart: { arquivo: { name: arquivo, mimeType: 'application/pdf', buffer: await readFile(caminho(arquivo)) } },
  })
  expect(res.status()).toBe(422)
  expect((await res.json()).codigo).toBe('PDF_INVALIDO')
})

test('o valor editado na conferência é o que fica salvo', async ({ page }) => {
  await page.getByRole('button', { name: 'Carregar exemplo' }).click()
  await page.getByTestId('fontes-ler-texto').click()
  const conferencia = page.getByTestId('conferencia')
  const linha = conferencia.locator('.medida-edicao').first()
  await expect(linha).toBeVisible()

  const nome = await linha.getByLabel('Nome').inputValue()
  const refMin = Number((await linha.getByLabel('Ref. mín.').inputValue()).replace(',', '.'))
  const refMax = Number((await linha.getByLabel('Ref. máx.').inputValue()).replace(',', '.'))
  /* Dentro da faixa: a linha editada ganha o sinal da comparação com a referência. */
  const editado = Math.round(((refMin + refMax) / 2) * 10 + 5) / 10
  await linha.getByLabel('Valor').fill(String(editado).replace('.', ','))
  const titulo = `Perfil lipídico conferido ${Date.now()}`
  await page.getByTestId('conferencia-titulo').fill(titulo)
  /* O laudo de exemplo é da Helena; a conta deste arquivo é do Marcos. */
  await page.getByTestId('conferencia-confirmo-meu').check()

  const gravacao = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/eventos')
  await page.getByTestId('conferencia-salvar').click()
  const salvo: Evento = await (await gravacao).json()
  expect(salvo.titulo).toBe(titulo)

  const persistido = (await lerEstado(page.request)).eventos.find((e) => e.id === salvo.id)!
  const medida = persistido.medidas!.find((m) => m.nome === nome)!
  expect(medida.valor).toBe(editado)
  expect(medida.sinal).toBe('normal')
  await expect(page.getByTestId('evento-detalhe').locator('.regua').filter({ hasText: nome })).toContainText(
    editado.toLocaleString('pt-BR'),
  )
})

/* Resumo de alta traz a mesma medida na entrada e na alta (SpO2 92% → 97%): as duas aparecem
   no detalhe, no resumo e na visão do médico, sem chave repetida no React (o vigia pega o console). */
test('medidas com o mesmo nome aparecem todas, sem erro de chave repetida', async ({ page, contas }) => {
  /* Conta própria: o resumo mostra só os 3 registros mais recentes. */
  await contas.criar({ request: page.request, modo: 'vazio' })
  const spo2 = (valor: number) => ({ nome: 'SpO2', valor, unidade: '%', refMin: 95, refMax: 100, sinal: valor < 95 ? 'alterado' : 'normal' })
  const res = await page.request.post('/api/eventos', {
    headers: CSRF,
    data: {
      id: `u${Date.now()}`, data: '2026-05-06', tipo: 'internacao', titulo: `Alta com SpO2 repetida ${Date.now()}`,
      instituicao: 'Hospital Teste', fonte: 'paciente', resumo: 'Entrada e alta.', sinal: 'alterado', tags: [],
      origem: 'OCR + IA', medidas: [spo2(92), spo2(97)],
    },
  })
  expect(res.status(), await res.text()).toBe(201)
  const salvo: Evento = await res.json()

  /* O beforeEach abriu o app com a conta do arquivo: só a troca de hash não recarrega o histórico. */
  await page.goto(`/#/app/linha/${salvo.id}`)
  await page.reload()
  await esperarApp(page)
  await expect(page.getByTestId('evento-detalhe').locator('.regua').filter({ hasText: 'SpO2' })).toHaveCount(2)
  await page.goto('/#/app/resumo')
  await expect(page.locator('.regua').filter({ hasText: 'SpO2' })).toHaveCount(2)
})

/* Exame de outra pessoa no histórico é erro grave: o nome impresso é comparado com o titular. */
test('documento de outro paciente exige confirmação antes de salvar', async ({ page, contas }) => {
  await contas.criar({ request: page.request, nome: 'Joana Prado Lima', modo: 'vazio' })
  await page.goto('/#/app/fontes')
  await page.reload()
  await esperarApp(page)

  const resposta = page.waitForResponse(ehExtrair)
  await page.getByTestId('fontes-pdf').setInputFiles(caminho('03-glicemia-hba1c-2026-03-19.pdf'))
  const extracao = await (await resposta).json()
  expect(extracao.alertas).toEqual([expect.objectContaining({ codigo: 'PACIENTE_DIVERGENTE' })])

  const alerta = page.getByTestId('conferencia-identidade')
  await expect(alerta).toContainText('Este documento parece ser de Marcos')
  await expect(alerta).toContainText('não de Joana Prado Lima')
  const salvar = page.getByTestId('conferencia-salvar')
  await expect(salvar).toBeDisabled()

  await expect(alerta).toContainText('Confirmo que este documento é de Joana Prado Lima')

  /* O botão desabilitado diz o porquê ao lado e leva até a caixa do topo. */
  const motivo = page.getByTestId('conferencia-motivo')
  const topo = page.getByTestId('conferencia-confirmo-meu')
  const rodape = page.getByTestId('conferencia-confirmo-meu-rodape')
  await expect(motivo).toContainText('Para salvar, confirme acima que o documento é de Joana Prado Lima')
  await page.getByTestId('conferencia-ir-confirmacao').click()
  await expect(topo).toBeFocused()
  await expect(topo).toBeInViewport()

  /* A confirmação repetida junto ao botão é o mesmo estado da do topo. */
  await rodape.check()
  await expect(topo).toBeChecked()
  await expect(salvar).toBeEnabled()
  await expect(motivo).toBeEmpty()
  await topo.uncheck()
  await expect(rodape).not.toBeChecked()
  await expect(salvar).toBeDisabled()
  await expect(motivo).toContainText('Para salvar')
  await topo.check()
  await expect(rodape).toBeChecked()

  const gravacao = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/eventos')
  await salvar.click()
  expect((await gravacao).status()).toBe(201)
})

test('documento do próprio titular não pede confirmação de identidade', async ({ page }) => {
  const resposta = page.waitForResponse(ehExtrair)
  await page.getByTestId('fontes-pdf').setInputFiles(caminho('03-glicemia-hba1c-2026-03-19.pdf'))
  expect((await (await resposta).json()).alertas).toEqual([])
  await expect(page.getByTestId('conferencia')).toBeVisible()
  await expect(page.getByTestId('conferencia-identidade')).toHaveCount(0)
  await expect(page.getByTestId('conferencia-salvar')).toBeEnabled()
  await page.getByTestId('conferencia-descartar').click()
})

/* "> 40" guarda só o piso: a régua mostra "≥ 40" e a faixa aberta, e o campo de máximo fica em branco. */
test('faixa só com piso ("> 40") vira medida com régua aberta e é salva', async ({ page }) => {
  const texto = [
    'Laboratório Quaresmeira — resultado de exame',
    'Paciente: Marcos Vinícius Teixeira',
    'Data da coleta: 12/03/2026',
    'HDL-colesterol      38 mg/dL     Desejável: > 40',
    'LDL-colesterol      138 mg/dL    Desejável: < 130',
  ].join('\n')
  await page.getByTestId('fontes-texto').fill(texto)
  const resposta = page.waitForResponse(ehExtrair)
  await page.getByTestId('fontes-ler-texto').click()
  const { evento, avisos } = await (await resposta).json()
  const indice = evento.medidas.findIndex((m: { nome: string }) => /hdl/i.test(m.nome))
  const hdl = evento.medidas[indice]
  expect(hdl).toMatchObject({ valor: 38, refMin: 40, sinal: 'alterado' })
  expect(hdl).not.toHaveProperty('refMax')
  expect(avisos.join(' ')).not.toMatch(/omitida/)

  const linha = page.getByTestId('conferencia').locator('.medida-edicao').nth(indice)
  await expect(linha.getByLabel('Ref. mín.')).toHaveValue('40')
  await expect(linha.getByLabel('Ref. máx.')).toHaveValue('')
  await expect(linha.locator('.regua')).toContainText('≥ 40')
  await expect(linha.locator('.regua__faixa--sem-teto')).toHaveCount(1)

  const gravacao = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/eventos')
  await page.getByTestId('conferencia-salvar').click()
  const salvo: Evento = await (await gravacao).json()
  expect(salvo.medidas!.find((m) => /hdl/i.test(m.nome))).toMatchObject({ refMin: 40 })
  await expect(page.getByTestId('evento-detalhe').locator('.regua').filter({ hasText: 'HDL' })).toContainText('≥ 40')
  await expect(page.getByTestId('evento-detalhe').locator('.regua').filter({ hasText: 'LDL' })).toContainText('≤ 130')
})

/* Achado do teste em produção: a espirometria do pacote demo (referências "≥ 80% do previsto" e
   LIN) tinha todas as medidas omitidas e confiança 0%. Só com IA real; o PDF fica em entrega/. */
const ESPIROMETRIA = join(process.cwd(), 'entrega/documentos-demo/05-espirometria-2025-03-11.pdf')

test('espirometria do demo: medidas com faixa só de piso entram, sem aviso de omissão', async ({ page }) => {
  test.skip(!REAL, 'a heurística do modo demonstração não lê a tabela da espirometria')
  test.skip(!existsSync(ESPIROMETRIA), 'pacote demo ausente')
  const resposta = page.waitForResponse(ehExtrair)
  await page.getByTestId('fontes-pdf').setInputFiles(ESPIROMETRIA)
  const { evento, avisos } = await (await resposta).json()
  test.info().annotations.push({ type: 'espirometria', description: `${evento.medidas?.length ?? 0} medidas, confiança ${evento.confianca}` })
  expect(evento.medidas?.length ?? 0).toBeGreaterThanOrEqual(6)
  expect(evento.medidas.some((m: { refMin?: number; refMax?: number }) => m.refMin !== undefined && m.refMax === undefined)).toBe(true)
  expect(avisos.join(' ')).not.toMatch(/limite inferior/)
  expect(evento.confianca).toBeGreaterThanOrEqual(0.7)
  await expect(page.getByTestId('conferencia').locator('.regua__faixa--sem-teto').first()).toBeVisible()
  await page.getByTestId('conferencia-descartar').click()
})
