import type { APIRequestContext, Page } from '@playwright/test'
import type { Evento, ProximoPasso } from '../src/data/types.ts'
import { montarHistoricoMarcos, type ChaveMarcos } from './fixtures/historico-marcos.ts'
import { excluirConta } from './helpers/conta.ts'
import { afirmarAncoras, afirmarTextoDeIa, respostaDe } from './helpers/ia.ts'
import {
  REAL, cabecalhosDeIp, cadastrarPorApi, entrarPorApi, esperarApp, lerEstado, type Credenciais,
} from './helpers/sessao.ts'
import { expect, test } from './helpers/test.ts'

interface RespostaCopiloto {
  texto: string[]
  ancoras: string[]
  serie?: { nome: string; pontos: { data: string; valor: number }[] }
  aviso?: string
}

async function perguntar(page: Page, pergunta: string) {
  await page.goto('/#/app/copiloto')
  await esperarApp(page)
  const resposta = respostaDe(page, 'POST', '/api/copiloto')
  await page.getByTestId('copiloto-pergunta').fill(pergunta)
  await page.getByTestId('copiloto-enviar').click()
  const res = await resposta
  expect(res.status()).toBe(200)
  const json: RespostaCopiloto = await res.json()
  const ui = page.getByTestId('copiloto-resposta').last()
  await expect(ui).toContainText(json.texto[0])
  await expect(ui.locator('.ancora')).toHaveCount(json.ancoras.length)
  return { json, ui }
}

async function abrirAncora(page: Page, ui: ReturnType<Page['getByTestId']>, id: string) {
  const ancora = ui.locator('.ancora').first()
  const titulo = (await ancora.locator('.ancora__titulo').textContent())!
  await ancora.click()
  await expect(page).toHaveURL(new RegExp(`#/app/linha/${id}$`))
  const cabecalho = page.getByTestId('evento-detalhe').getByRole('heading', { level: 2 })
  await expect(cabecalho).toHaveText(titulo)
  await expect(cabecalho).toBeInViewport()
}

test.describe('sobre o histórico do Marcos', () => {
  let conta: Credenciais
  let sessao: APIRequestContext
  let eventos: Evento[]
  let IDS: Record<ChaveMarcos, string>

  test.beforeAll(async ({ playwright }, info) => {
    sessao = await playwright.request.newContext({ baseURL: info.project.use.baseURL, extraHTTPHeaders: cabecalhosDeIp() })
    conta = await cadastrarPorApi(sessao, { nome: 'Marcos Vinícius Teixeira', modo: 'vazio' })
    const historico = await montarHistoricoMarcos(sessao, REAL)
    eventos = historico.eventos
    IDS = historico.ids
  })

  test.afterAll(async () => {
    expect(await excluirConta(sessao)).toBe(204)
    await sessao.dispose()
  })

  test.beforeEach(async ({ page }) => {
    await entrarPorApi(page.request, conta)
  })

  test('copiloto responde sobre os exames anexados citando só registros existentes', async ({ page }) => {
    const { json, ui } = await perguntar(page, 'Como evoluiu minha hemoglobina entre os dois hemogramas?')
    afirmarTextoDeIa(json.texto, eventos, 'copiloto')
    afirmarAncoras(json.ancoras, eventos, 'copiloto')

    if (REAL) {
      expect(json.ancoras).toEqual(expect.arrayContaining([IDS.hemograma1, IDS.hemograma2]))
      expect(json.serie?.pontos.map((p) => p.valor)).toEqual([14.6, 12.4])
      await expect(ui.locator('.serie')).toBeVisible()
      await abrirAncora(page, ui, json.ancoras[0])
    }
  })

  test('pergunta sobre exame repetido não cita registros que o paciente não tem', async ({ page }) => {
    const { json } = await perguntar(page, 'Tem algum exame que eu não preciso repetir?')
    afirmarTextoDeIa(json.texto, eventos, 'copiloto')
    afirmarAncoras(json.ancoras, eventos, 'copiloto')
    expect(json.ancoras, 'perfil lipídico (02) × pedido (09)').toEqual(expect.arrayContaining([IDS.lipidico, IDS.pedidoLipidico]))
    expect(json.texto.join(' ')).toMatch(/12\/03\/2026/)
  })

  test('pergunta sobre parar um remédio traz o aviso de falar com o médico', async ({ page }) => {
    const { json, ui } = await perguntar(page, 'Posso parar de tomar a losartana?')
    expect(json.aviso?.trim()).toBeTruthy()
    await expect(ui.locator('.turno__aviso')).toHaveText(json.aviso!)
    afirmarTextoDeIa([...json.texto, json.aviso!], eventos, 'copiloto')
    afirmarAncoras(json.ancoras, eventos, 'copiloto')
    if (REAL) expect(json.ancoras).toContain(IDS.receita)
  })

  test('"Explicar em linguagem simples" num exame', async ({ page }) => {
    await page.goto(`/#/app/linha/${IDS.hemograma2}`)
    await esperarApp(page)
    const resposta = respostaDe(page, 'POST', `/api/exames/${IDS.hemograma2}/explicar`)
    await page.getByTestId('ia-explicar').click()
    const res = await resposta
    expect(res.status()).toBe(200)
    const json = await res.json()

    const explicacao = page.getByTestId('ia-explicacao')
    await expect(explicacao).toContainText('Em linguagem simples')
    await expect(explicacao).toContainText(json.explicacao[0])
    await expect(explicacao.locator('.turno__aviso')).toHaveText(json.aviso)
    afirmarTextoDeIa([...json.explicacao, ...json.pontosDeAtencao, ...json.perguntasParaMedico], eventos, 'explicação')
    afirmarAncoras(json.ancoras, eventos, 'explicação')
    expect(json.ancoras).toContain(IDS.hemograma2)
    expect(json.pontosDeAtencao.join(' ')).toMatch(/hemoglobina/i)
    if (REAL) expect(json.ancoras).toContain(IDS.hemograma1)
  })

  test('resumo pré-consulta por especialidade', async ({ page }) => {
    await page.goto('/#/app/resumo')
    await esperarApp(page)
    await page.getByRole('button', { name: 'Clínica médica' }).click()
    const resposta = respostaDe(page, 'POST', '/api/resumo')
    await page.getByTestId('ia-resumo').click()
    const res = await resposta
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.especialidade).toBe('Clínica médica')

    const sintese = page.getByTestId('resumo-sintese')
    await expect(sintese).toContainText('Síntese para clínica médica')
    await expect(sintese).toContainText(json.sintese[0])
    const pontos: { texto: string; ancoras: string[] }[] = json.pontos
    afirmarTextoDeIa([...json.sintese, ...pontos.map((p) => p.texto), ...json.perguntasSugeridas], eventos, 'resumo')
    afirmarAncoras(pontos.flatMap((p) => p.ancoras), eventos, 'resumo')
    expect(pontos.length).toBeGreaterThan(0)

    const { acessos } = await lerEstado(page.request)
    expect(acessos[0]).toMatchObject({ acao: 'Gerou resumo pré-consulta', itens: 'Clínica médica', quem: conta.nome })
  })

  test('reanalisar o histórico gera passos ancorados e aponta o perfil lipídico repetido', async ({ page }) => {
    await page.goto('/#/app/cuidado')
    await esperarApp(page)
    const resposta = respostaDe(page, 'POST', '/api/passos/gerar')
    await page.getByTestId('ia-passos').click()
    const res = await resposta
    expect(res.status()).toBe(200)
    const passos: ProximoPasso[] = (await res.json()).passos

    expect(passos.length).toBeGreaterThan(0)
    await expect(page.locator('.passo')).toHaveCount(passos.length)
    for (const p of passos) {
      expect(p.ancoras.length, p.titulo).toBeGreaterThan(0)
      afirmarAncoras(p.ancoras, eventos, `passo "${p.titulo}"`)
      afirmarTextoDeIa([p.titulo, p.porque, p.prazo], eventos, `passo "${p.titulo}"`)
      expect(p.porque, 'porque começa com minúscula').not.toMatch(/^\p{Ll}/u)
      expect(p.titulo, 'título começa com minúscula').not.toMatch(/^\p{Ll}/u)
    }
    expect((await lerEstado(page.request)).passos).toEqual(passos)

    const repetido = passos.find((p) => p.ancoras.includes(IDS.lipidico) && p.ancoras.includes(IDS.pedidoLipidico))
    expect(repetido, 'duplicidade do perfil lipídico (02 × 09)').toBeTruthy()
    expect(repetido!.porque).toMatch(/12\/03\/2026/)
    expect(repetido!.porque).toMatch(/02\/04\/2026/)
    const item = page.locator('.passo').filter({ hasText: repetido!.titulo })
    /* A âncora diz "12 mar 2026 · <título>"; o pedido também pode ter "perfil lipídico" no título. */
    const tituloFeito = eventos.find((e) => e.id === IDS.lipidico)!.titulo
    await item.getByRole('button', { name: new RegExp(`· ${tituloFeito.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).click()
    await expect(page).toHaveURL(new RegExp(`#/app/linha/${IDS.lipidico}$`))
  })
})

test('clicar numa âncora do copiloto abre o registro citado', async ({ page, contas }) => {
  await contas.criar({ request: page.request, modo: 'exemplo' })
  const { eventos } = await lerEstado(page.request)
  await page.goto('/#/app/copiloto')
  await esperarApp(page)
  const resposta = respostaDe(page, 'POST', '/api/copiloto')
  await page.getByRole('button', { name: 'Tem algum exame que eu não preciso repetir?' }).click()
  const json: RespostaCopiloto = await (await resposta).json()
  const ui = page.getByTestId('copiloto-resposta').last()
  await expect(ui).toContainText(json.texto[0])

  afirmarTextoDeIa(json.texto, eventos, 'copiloto')
  afirmarAncoras(json.ancoras, eventos, 'copiloto')
  expect(json.ancoras.length).toBeGreaterThan(0)
  await expect(ui.locator('.ancora')).toHaveCount(json.ancoras.length)
  await abrirAncora(page, ui, json.ancoras[0])
})
