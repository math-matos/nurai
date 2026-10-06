import { esperarApp, lerEstado } from './helpers/sessao.ts'
import { expect, test } from './helpers/test.ts'

const INSTITUICAO = 'Laboratório Vetor'

test('alternar um consentimento aparece em Fontes e no registro de acessos', async ({ page, contas }) => {
  const conta = await contas.criar({ request: page.request, nome: 'Helena Duarte Nogueira', modo: 'exemplo' })
  await page.goto('/#/app/privacidade')
  await esperarApp(page)

  const permissao = page.locator('.permissao').filter({ hasText: INSTITUICAO })
  const ativasAntes = (await lerEstado(page.request)).consentimentos.filter((c) => c.ativo).length
  await permissao.locator('.interruptor').click()
  await expect(permissao).toHaveClass(/permissao--off/)
  await expect(permissao.locator('.interruptor__estado')).toHaveText('revogado')
  await expect(page.getByRole('heading', { name: `${ativasAntes - 1} de 6 permissões estão ativas agora` })).toBeVisible()
  const revogacao = page.locator('.auditoria li').first()
  await expect(revogacao).toContainText('Revogou acesso')
  await expect(revogacao).toContainText(conta.nome)

  await page.goto('/#/app/fontes')
  const fonte = page.locator('.fonte').filter({ hasText: INSTITUICAO })
  await expect(fonte).toHaveClass(/fonte--revogada/)
  await expect(fonte).toContainText('acesso revogado')
  await fonte.getByRole('button', { name: 'Reativar em Privacidade' }).click()
  await expect(page).toHaveURL(/#\/app\/privacidade$/)

  await permissao.locator('.interruptor').click()
  await expect(permissao.locator('.interruptor__estado')).toHaveText('ativo')
  await expect(page.locator('.auditoria li').first()).toContainText('Concedeu acesso')
  const estado = await lerEstado(page.request)
  expect(estado.consentimentos.filter((c) => c.ativo)).toHaveLength(ativasAntes)
  expect(estado.acessos.slice(0, 2).map((a) => a.acao)).toEqual(['Concedeu acesso', 'Revogou acesso'])

  await page.goto('/#/app/fontes')
  await expect(fonte).not.toHaveClass(/fonte--revogada/)
  await expect(fonte).toContainText('conectada')
})

test('"Meus dados" salva o perfil e o nome muda na barra lateral', async ({ page, contas }) => {
  await contas.criar({ request: page.request, nome: 'Nome Antigo', modo: 'vazio' })
  await page.goto('/#/app/privacidade')
  await esperarApp(page)
  await expect(page.getByTestId('shell-perfil-nome')).toHaveText('Nome Antigo')

  const form = page.getByTestId('perfil-form')
  await form.getByLabel('Nome').fill('Marcos Vinícius Teixeira')
  await form.getByLabel('Cartão SUS').fill('898001234567890')
  await form.getByLabel('Condições de saúde').fill('Asma\nHipertensão')
  await page.getByTestId('perfil-salvar').click()
  await expect(page.getByTestId('perfil-salvo')).toBeVisible()

  const lateral = page.getByTestId('shell-perfil')
  await expect(page.getByTestId('shell-perfil-nome')).toHaveText('Marcos Vinícius Teixeira')
  await expect(lateral).toContainText('Cartão SUS 7890')
  await expect(page.getByRole('list', { name: 'Condições' })).toContainText('Hipertensão')

  await page.reload()
  await esperarApp(page)
  await expect(page.getByTestId('shell-perfil-nome')).toHaveText('Marcos Vinícius Teixeira')
  await expect(form.getByLabel('Condições de saúde')).toHaveValue('Asma\nHipertensão')
  const sessao = await (await page.request.get('/api/auth/sessao')).json()
  expect(sessao.perfil).toMatchObject({ nome: 'Marcos Vinícius Teixeira', condicoes: ['Asma', 'Hipertensão'], cartaoSus: '898001234567890' })

  await form.getByLabel('Nome').fill('   ')
  await page.getByTestId('perfil-salvar').click()
  await expect(page.locator('#perfil-nome-erro')).toHaveText('Informe o nome')
  await expect(form.getByLabel('Nome')).toBeFocused()
})

test('excluir a conta leva à landing e o login com ela deixa de funcionar', async ({ page, contas }) => {
  const conta = await contas.criar({ request: page.request, modo: 'exemplo' })
  await page.goto('/#/app/privacidade')
  await esperarApp(page)

  await page.getByRole('button', { name: 'Excluir minha conta' }).click()
  const confirmacao = page.getByTestId('excluir-confirmacao')
  await expect(confirmacao).toBeFocused()
  await confirmacao.fill('excluir')
  await expect(page.getByTestId('excluir-botao')).toBeDisabled()
  await confirmacao.fill('EXCLUIR')
  const exclusao = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().endsWith('/api/conta'))
  await page.getByTestId('excluir-botao').click()
  expect((await exclusao).status()).toBe(204)

  await expect(page).toHaveURL(/#\/$/)
  expect((await page.request.get('/api/auth/sessao')).status()).toBe(401)

  await page.goto('/#/entrar')
  await expect(page.getByTestId('aviso-sessao')).toContainText('foram excluídos')
  await page.getByTestId('entrar-email').fill(conta.email)
  await page.getByTestId('entrar-senha').fill(conta.senha)
  await page.getByTestId('entrar-enviar').click()
  await expect(page.getByTestId('erro-formulario')).toHaveText('E-mail ou senha incorretos.')
  await expect(page).toHaveURL(/#\/entrar$/)
})
