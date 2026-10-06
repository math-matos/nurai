import { SENHA_TESTE, emailTeste } from './helpers/conta.ts'
import { CSRF, SECOES_DO_APP, abrirMenuSePreciso, esperarApp, entrarPorApi, ipAleatorio } from './helpers/sessao.ts'
import { expect, test } from './helpers/test.ts'

const ERRO_CREDENCIAIS = 'E-mail ou senha incorretos.'

test.describe('cadastro', () => {
  test('cadastro válido leva às boas-vindas', async ({ page, contas }) => {
    const email = emailTeste()
    contas.registrar({ email, senha: SENHA_TESTE })

    await page.goto('/#/cadastro')
    await page.getByTestId('cadastro-nome').fill('Marcos Vinícius Teixeira')
    await page.getByTestId('cadastro-email').fill(email)
    await page.getByTestId('cadastro-senha').fill(SENHA_TESTE)
    await page.getByTestId('cadastro-lgpd').check()
    const resposta = page.waitForResponse('**/api/auth/cadastro')
    await page.getByTestId('cadastro-enviar').click()

    expect((await resposta).status()).toBe(201)
    await expect(page).toHaveURL(/#\/boas-vindas$/)
    await expect(page.getByRole('heading', { name: 'Boas-vindas, Marcos' })).toBeVisible()
    await expect(page.getByTestId('onboarding-vazio')).toBeVisible()
    await expect(page.getByTestId('onboarding-exemplo')).toBeVisible()
  })

  test('campos inválidos mostram erro no campo e levam o foco a ele', async ({ page }) => {
    let enviados = 0
    page.on('request', (r) => { if (r.url().includes('/api/auth/cadastro')) enviados++ })

    await page.goto('/#/cadastro')
    await page.getByTestId('cadastro-nome').fill('Pessoa Teste')
    await page.getByTestId('cadastro-email').fill('nao-e-um-email')
    await page.getByTestId('cadastro-senha').fill('curta')
    await page.getByTestId('cadastro-enviar').click()

    const email = page.getByTestId('cadastro-email')
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('#cadastro-email-erro')).toHaveText('E-mail inválido')
    await expect(page.locator('#cadastro-senha-erro')).toHaveText('A senha precisa ter pelo menos 8 caracteres')
    await expect(page.locator('#cadastro-lgpd-erro')).toContainText('é preciso concordar')

    await email.fill(emailTeste())
    await expect(page.locator('#cadastro-email-erro')).toHaveCount(0)
    await page.getByTestId('cadastro-enviar').click()
    await expect(page.getByTestId('cadastro-senha')).toBeFocused()

    await page.getByTestId('cadastro-senha').fill(SENHA_TESTE)
    await page.getByTestId('cadastro-enviar').click()
    const lgpd = page.getByTestId('cadastro-lgpd')
    await expect(lgpd).toBeFocused()
    await expect(lgpd).toHaveAttribute('aria-invalid', 'true')

    expect(enviados, 'formulário inválido não pode chegar ao servidor').toBe(0)
    await expect(page).toHaveURL(/#\/cadastro$/)
  })

  test('o servidor recusa o mesmo cadastro inválido, campo a campo', async ({ request }) => {
    const res = await request.post('/api/auth/cadastro', {
      data: { nome: 'Pessoa', email: 'nao-e-um-email', senha: 'curta', aceiteLgpd: false },
      headers: CSRF,
    })
    expect(res.status()).toBe(400)
    const corpo = await res.json()
    expect(corpo.codigo).toBe('VALIDACAO')
    expect(Object.keys(corpo.campos).sort()).toEqual(['aceiteLgpd', 'email', 'senha'])
  })

  test('e-mail já cadastrado responde 409 e mostra o erro no campo', async ({ page, contas }) => {
    const existente = await contas.criar()

    await page.goto('/#/cadastro')
    await page.getByTestId('cadastro-nome').fill('Outra Pessoa')
    await page.getByTestId('cadastro-email').fill(existente.email.toUpperCase())
    await page.getByTestId('cadastro-senha').fill(SENHA_TESTE)
    await page.getByTestId('cadastro-lgpd').check()
    const resposta = page.waitForResponse('**/api/auth/cadastro')
    await page.getByTestId('cadastro-enviar').click()

    expect((await resposta).status()).toBe(409)
    await expect(page.locator('#cadastro-email-erro')).toContainText('Este e-mail já tem uma conta')
    await expect(page.getByTestId('cadastro-email')).toBeFocused()
    await expect(page).toHaveURL(/#\/cadastro$/)
  })
})

test.describe('login', () => {
  test('senha errada e e-mail inexistente dão a mesma mensagem; a certa entra', async ({ page, contas }) => {
    const conta = await contas.criar({ modo: 'vazio' })
    await page.goto('/#/entrar')

    const tentar = async (email: string, senha: string) => {
      await page.getByTestId('entrar-email').fill(email)
      await page.getByTestId('entrar-senha').fill(senha)
      const resposta = page.waitForResponse('**/api/auth/login')
      await page.getByTestId('entrar-enviar').click()
      return (await resposta).status()
    }

    expect(await tentar(conta.email, 'senha-errada-123')).toBe(401)
    await expect(page.getByTestId('erro-formulario')).toHaveText(ERRO_CREDENCIAIS)
    await expect(page.getByTestId('entrar-senha')).toHaveValue('')
    await expect(page.getByTestId('entrar-senha')).toBeFocused()

    expect(await tentar(emailTeste(), 'qualquer-senha-123')).toBe(401)
    await expect(page.getByTestId('erro-formulario')).toHaveText(ERRO_CREDENCIAIS)

    expect(await tentar(conta.email, conta.senha)).toBe(200)
    await expect(page).toHaveURL(/#\/app\/linha$/)
    await expect(page.getByTestId('shell-perfil-nome')).toHaveText(conta.nome)
  })

  test('depois de 5 falhas o login responde 429 com o tempo de espera', async ({ novoNavegador, contas }) => {
    const conta = await contas.criar({ modo: 'vazio' })
    /* IP próprio: o limite é por IP + e-mail e não pode depender de outros testes. */
    const { pagina } = await novoNavegador({ ip: ipAleatorio() })
    await pagina.goto('/#/entrar')
    await pagina.getByTestId('entrar-email').fill(conta.email)

    for (let i = 1; i <= 5; i++) {
      await pagina.getByTestId('entrar-senha').fill(`senha-errada-${i}`)
      const resposta = pagina.waitForResponse('**/api/auth/login')
      await pagina.getByTestId('entrar-enviar').click()
      expect((await resposta).status(), `tentativa ${i}`).toBe(401)
      await expect(pagina.getByTestId('erro-formulario')).toHaveText(ERRO_CREDENCIAIS)
    }

    /* Bloqueado até com a senha certa: o limite vem antes da verificação. */
    await pagina.getByTestId('entrar-senha').fill(conta.senha)
    const resposta = pagina.waitForResponse('**/api/auth/login')
    await pagina.getByTestId('entrar-enviar').click()
    const bloqueio = await resposta
    expect(bloqueio.status()).toBe(429)
    expect(bloqueio.headers()['retry-after']).toBe('900')
    await expect(pagina.getByTestId('erro-formulario')).toHaveText('Muitas tentativas seguidas. Tente de novo em 15 min.')
    await expect(pagina).toHaveURL(/#\/entrar$/)
  })
})

test.describe('sessão', () => {
  test('sair encerra a sessão e as rotas do app pedem login com volta', async ({ page, contas }) => {
    await contas.criar({ request: page.request, modo: 'vazio' })
    await page.goto('/#/app/linha')
    await esperarApp(page)

    await abrirMenuSePreciso(page)
    await page.getByTestId('botao-sair').click()
    await expect(page).toHaveURL(/#\/$/)
    expect((await page.request.get('/api/estado')).status()).toBe(401)

    for (const secao of SECOES_DO_APP) {
      await page.goto(`/#/app/${secao}`)
      await expect(page).toHaveURL(new RegExp(`#/entrar\\?volta=%2Fapp%2F${secao}$`))
      await expect(page.getByTestId('form-entrar')).toBeVisible()
    }
  })

  test('a sessão sobrevive a recarregar a página', async ({ page, contas }) => {
    const conta = await contas.criar({ request: page.request, modo: 'vazio' })
    await page.goto('/#/app/fontes')
    await esperarApp(page)
    await page.reload()
    await expect(page).toHaveURL(/#\/app\/fontes$/)
    await esperarApp(page)
    await expect(page.getByTestId('shell-perfil-nome')).toHaveText(conta.nome)
    await expect(page.getByRole('heading', { level: 1, name: 'Fontes e anexos' })).toBeVisible()
  })

  test('o login volta para a tela pedida antes', async ({ page, contas }) => {
    const conta = await contas.criar({ modo: 'vazio' })
    await page.goto('/#/app/cuidado')
    await expect(page).toHaveURL(/#\/entrar\?volta=%2Fapp%2Fcuidado$/)
    await expect(page.getByText('Entre de novo para voltar à tela em que você estava.')).toBeVisible()

    await page.getByTestId('entrar-email').fill(conta.email)
    await page.getByTestId('entrar-senha').fill(conta.senha)
    await page.getByTestId('entrar-enviar').click()
    await expect(page).toHaveURL(/#\/app\/cuidado$/)
    await esperarApp(page)
  })

  test('volta para fora do app é ignorada', async ({ page, contas }) => {
    const conta = await contas.criar({ modo: 'vazio' })
    await page.goto(`/#/entrar?volta=${encodeURIComponent('https://exemplo.test/roubo')}`)
    await page.getByTestId('entrar-email').fill(conta.email)
    await page.getByTestId('entrar-senha').fill(conta.senha)
    await page.getByTestId('entrar-enviar').click()
    await expect(page).toHaveURL(/#\/app\/linha$/)
  })

  test('com sessão aberta, entrar e cadastro levam ao app', async ({ page, contas }) => {
    const conta = await contas.criar({ modo: 'vazio' })
    await entrarPorApi(page.request, conta)
    await page.goto('/#/entrar')
    await expect(page).toHaveURL(/#\/app\/linha$/)
    await page.goto('/#/cadastro')
    await expect(page).toHaveURL(/#\/app\/linha$/)
    await esperarApp(page)
  })

  test('"Experimentar sem cadastro" abre a conta demo com 24 registros @smoke @mobile', async ({ page, contas }) => {
    contas.apagarAoFim(page.request)
    await page.goto('/#/entrar')
    const resposta = page.waitForResponse('**/api/auth/demo')
    await page.getByRole('button', { name: 'Experimentar sem cadastro' }).click()
    expect((await resposta).status()).toBe(201)

    await expect(page).toHaveURL(/#\/app\/linha$/)
    await esperarApp(page)
    await expect(page.getByTestId('evento-item')).toHaveCount(24)
    await expect(page.locator('.filtros__conta')).toContainText('24 de 24 registros')
    await expect(page.getByTestId('shell-perfil-nome')).toHaveText('Visitante')
    await expect(page.getByTestId('selo-convidado')).toContainText('Conta de demonstração')
  })
})
