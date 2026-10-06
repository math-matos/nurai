import type { Page } from '@playwright/test'
import { SENHA_TESTE, emailTeste } from './helpers/conta.ts'
import { respostaDe } from './helpers/ia.ts'
import { CSRF, SECOES_DO_APP, abrirMenuSePreciso, esperarApp, irParaSecao } from './helpers/sessao.ts'
import { expect, test } from './helpers/test.ts'

test.skip(({ isMobile }) => !isMobile, 'jornada de celular: só no projeto mobile')

async function semRolagemHorizontal(page: Page, onde: string) {
  const { largura, janela } = await page.evaluate(() => ({
    largura: document.documentElement.scrollWidth,
    janela: window.innerWidth,
  }))
  expect(largura, `${onde}: scrollWidth ${largura} > innerWidth ${janela}`).toBeLessThanOrEqual(janela)
}

test('jornada no celular: cadastro, exemplo, linha do tempo, detalhe e copiloto', async ({ page, contas }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await semRolagemHorizontal(page, 'landing')
  await page.goto('/#/projeto')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await semRolagemHorizontal(page, 'dossiê')
  await page.goto('/#/entrar')
  await expect(page.getByTestId('form-entrar')).toBeVisible()
  await semRolagemHorizontal(page, 'entrar')

  const email = emailTeste()
  contas.registrar({ email, senha: SENHA_TESTE })
  await page.goto('/#/cadastro')
  await semRolagemHorizontal(page, 'cadastro')
  await page.getByTestId('cadastro-nome').fill('Marcos Vinícius Teixeira')
  await page.getByTestId('cadastro-email').fill(email)
  await page.getByTestId('cadastro-senha').fill(SENHA_TESTE)
  await page.getByTestId('cadastro-lgpd').check()
  await page.getByTestId('cadastro-enviar').click()
  await expect(page).toHaveURL(/#\/boas-vindas$/)
  await semRolagemHorizontal(page, 'boas-vindas')

  await page.getByTestId('onboarding-exemplo').click()
  await expect(page).toHaveURL(/#\/app\/linha$/)
  await esperarApp(page)
  await expect(page.getByTestId('evento-item')).toHaveCount(24)
  await semRolagemHorizontal(page, 'linha do tempo')

  /* O detalhe fica empilhado abaixo da lista: escolher um registro leva a tela até ele. */
  const item = page.getByTestId('evento-item').filter({ hasText: 'Ultrassom Doppler de carótidas' })
  await item.click()
  await expect(page).toHaveURL(/#\/app\/linha\/e22$/)
  const titulo = page.getByTestId('evento-detalhe').getByRole('heading', { level: 2 })
  await expect(titulo).toHaveText('Ultrassom Doppler de carótidas')
  await expect(titulo).toBeInViewport()
  await semRolagemHorizontal(page, 'detalhe')
  /* "Voltar à lista" fecha o detalhe e devolve o foco ao item de onde a pessoa veio (simulação R2, P7). */
  await page.getByRole('button', { name: 'Voltar à lista' }).tap()
  await expect(page).toHaveURL(/#\/app\/linha$/)
  await expect(page.getByTestId('evento-detalhe')).toBeHidden()
  await expect(item).toBeInViewport()
  await expect(item).toBeFocused()
  await item.tap()
  await expect(page).toHaveURL(/#\/app\/linha\/e22$/)
  await expect(titulo).toBeInViewport()

  await irParaSecao(page, 'Copiloto')
  await expect(page).toHaveURL(/#\/app\/copiloto$/)
  const resposta = respostaDe(page, 'POST', '/api/copiloto')
  await page.getByRole('button', { name: 'Como minha glicada evoluiu desde o diagnóstico?' }).click()
  expect((await resposta).status()).toBe(200)
  const turno = page.getByTestId('copiloto-resposta').last()
  await expect(turno).toBeVisible()
  await expect(turno.locator('.serie')).toBeVisible()
  await semRolagemHorizontal(page, 'copiloto com resposta')
})

test('nenhuma tela do app rola na horizontal no celular', async ({ page, contas }) => {
  await contas.criar({ request: page.request, modo: 'exemplo' })
  await page.goto('/#/app/linha')
  await esperarApp(page)

  for (const secao of SECOES_DO_APP) {
    await page.goto(`/#/app/${secao}`)
    await esperarApp(page)
    await expect(page.locator('.palco__corpo > *').first()).toBeVisible()
    await semRolagemHorizontal(page, secao)
  }

  await abrirMenuSePreciso(page)
  await semRolagemHorizontal(page, 'menu aberto')
  await page.getByRole('button', { name: 'Fechar menu' }).first().click()

  await page.goto('/#/app/fontes')
  await page.getByRole('button', { name: 'Carregar exemplo' }).click()
  await page.getByTestId('fontes-ler-texto').click()
  await expect(page.getByTestId('conferencia')).toBeVisible()
  await semRolagemHorizontal(page, 'conferência')

  await page.goto('/#/app/resumo')
  await page.getByTestId('ia-resumo').click()
  await expect(page.getByTestId('resumo-sintese').locator('.sintese-ia__texto').first()).toBeVisible()
  await page.getByTestId('acesso-gerar').click()
  await expect(page.getByTestId('acesso-codigo')).toBeVisible()
  await semRolagemHorizontal(page, 'resumo com síntese e acesso')

  await page.goto('/#/app/linha/e23')
  await page.getByTestId('ia-explicar').click()
  await expect(page.getByTestId('ia-explicacao')).toBeVisible()
  await semRolagemHorizontal(page, 'explicação')

  const { codigo } = await (await page.request.post('/api/compartilhamentos', { headers: CSRF, data: { para: 'Dra. Teste' } })).json()
  await page.goto('/#/acesso')
  await semRolagemHorizontal(page, 'acesso do médico')
  await page.getByTestId('medico-codigo').fill(codigo)
  await page.getByTestId('medico-profissional').fill('Dra. Ana Lima — CRM-FIC 123456')
  await page.getByTestId('medico-entrar').click()
  await expect(page.getByTestId('medico-evento')).toHaveCount(24)
  await page.getByTestId('medico-evento').first().locator('summary').click()
  await page.getByTestId('medico-gerar-resumo').click()
  await expect(page.getByTestId('medico-resumo').locator('.sintese-ia__texto').first()).toBeVisible()
  await semRolagemHorizontal(page, 'visão do médico')
})
