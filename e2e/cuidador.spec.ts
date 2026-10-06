import { join } from 'node:path'
import { DIR_DOCUMENTOS } from './fixtures/gerar.ts'
import { respostaDe } from './helpers/ia.ts'
import { CSRF, esperarApp, irParaSecao, lerEstado } from './helpers/sessao.ts'
import { expect, test } from './helpers/test.ts'

const RAFAEL = 'Rafael Lima'
const MARCOS = 'Marcos Vinícius Teixeira'
const PROFISSIONAL = 'Dra. Ana Lima — CRM-FIC 123456'
const AUTORIZACAO_FALTANDO = 'Confirme que você tem autorização para organizar os dados de saúde dessa pessoa'
const DECLARACAO_DO_MARCOS =
  `Declaro que sou responsável por ${MARCOS} ou tenho autorização para organizar os dados de saúde de ${MARCOS} nesta conta.`
/* Laudo impresso com "Paciente: Marcos Vinícius Teixeira". */
const PDF_DO_MARCOS = join(DIR_DOCUMENTOS, '03-glicemia-hba1c-2026-03-19.pdf')

/* Rafael cuida do histórico do pai: a conta é dele, o histórico é do Marcos. */
test('cuidador organiza o histórico do pai e o médico vê o paciente e quem enviou @smoke', async ({
  page, contas, novoNavegador,
}) => {
  await contas.criar({ request: page.request, nome: RAFAEL })
  await page.goto('/#/app/linha')
  await expect(page).toHaveURL(/#\/boas-vindas$/)
  await expect(page.getByRole('heading', { name: 'Boas-vindas, Rafael' })).toBeVisible()

  /* "Para mim" é o padrão; escolhendo cuidar de alguém, nome e relação são obrigatórios. */
  await expect(page.getByLabel('Para mim')).toBeChecked()
  await page.getByLabel('Para alguém que eu cuido').check()
  await page.getByTestId('onboarding-vazio').click()
  await expect(page.locator('#cuidado-nome-erro')).toHaveText('Informe o nome de quem você cuida')
  await expect(page.locator('#cuidado-relacao-erro')).toHaveText('Escolha o que você é dessa pessoa')
  await expect(page.locator('#cuidado-autorizacao-erro')).toHaveText(AUTORIZACAO_FALTANDO)
  await expect(page.getByLabel('Nome de quem você cuida')).toBeFocused()
  await expect(page).toHaveURL(/#\/boas-vindas$/)

  await page.getByLabel('Nome de quem você cuida').fill(MARCOS)
  await page.getByLabel('Data de nascimento').fill('1958-03-02')
  await page.getByLabel('O que você é dessa pessoa?').selectOption('filho')
  /* Sem a declaração (LGPD: dado de saúde de outra pessoa) o onboarding não segue. */
  await page.getByTestId('onboarding-vazio').click()
  await expect(page.locator('#cuidado-autorizacao-erro')).toHaveText(AUTORIZACAO_FALTANDO)
  const declaracao = page.getByTestId('onboarding-autorizacao')
  await expect(declaracao).toBeFocused()
  await expect(page.getByText(DECLARACAO_DO_MARCOS)).toBeVisible()
  await declaracao.check()
  await expect(page.locator('#cuidado-autorizacao-erro')).toHaveCount(0)
  const onboarding = page.waitForRequest((r) => r.url().endsWith('/api/onboarding'))
  await page.getByTestId('onboarding-vazio').click()
  expect((await onboarding).postDataJSON().paciente).toMatchObject({ nome: MARCOS, relacao: 'filho', autorizacao: true })
  await expect(page).toHaveURL(/#\/app\/linha$/)
  await esperarApp(page)

  await expect(page.getByTestId('shell-perfil-nome')).toHaveText(MARCOS)
  await expect(page.getByTestId('shell-responsavel')).toHaveText('Histórico de Marcos · gerenciado por você (filho)')

  /* O documento é do paciente do histórico (Marcos), não de quem usa a conta: sem alerta de divergência. */
  await irParaSecao(page, 'Fontes e anexos')
  const extracao = respostaDe(page, 'POST', '/api/extrair')
  await page.getByTestId('fontes-pdf').setInputFiles(PDF_DO_MARCOS)
  const extraido = await extracao
  expect(extraido.status()).toBe(200)
  expect((await extraido.json()).alertas).toEqual([])
  await expect(page.getByTestId('conferencia')).toBeVisible()
  await expect(page.getByTestId('conferencia-identidade')).toHaveCount(0)
  const gravacao = respostaDe(page, 'POST', '/api/eventos')
  await page.getByTestId('conferencia-salvar').click()
  expect((await gravacao).status()).toBe(201)

  /* Quem anexou foi o Rafael, como responsável. */
  const estado = await lerEstado(page.request)
  expect(estado.eventos).toHaveLength(1)
  expect(estado.acessos[0]).toMatchObject({ quem: RAFAEL, papel: 'Responsável (filho)', acao: 'Anexou documento ao histórico' })

  /* Meus dados mostram o paciente, o responsável e a relação. */
  await page.goto('/#/app/privacidade')
  await expect(page.getByLabel('Nome do paciente')).toHaveValue(MARCOS)
  await expect(page.locator('#perfil-cuidador')).toBeChecked()
  await expect(page.getByLabel('Seu nome (responsável)')).toHaveValue(RAFAEL)
  await expect(page.getByLabel('O que você é do paciente?')).toHaveValue('filho')
  /* Já declarado no onboarding: Meus dados mostra quando, sem pedir de novo. */
  await expect(page.getByTestId('perfil-autorizacao')).toHaveCount(0)
  await expect(page.locator('.meus-dados__declaracao')).toContainText(`ter autorização para organizar os dados de saúde de ${MARCOS}`)

  /* O resumo para a consulta (tela e impressão) também diz quem enviou. */
  await page.goto('/#/app/resumo')
  const folha = page.locator('.folha-resumo__cabeca')
  await expect(folha.getByRole('heading', { level: 2 })).toHaveText(MARCOS)
  await expect(folha).toContainText(`Informações enviadas por ${RAFAEL} (filho)`)
  await page.emulateMedia({ media: 'print' })
  await expect(folha.getByText(`Informações enviadas por ${RAFAEL} (filho)`)).toBeVisible()
  await page.emulateMedia({ media: 'screen' })

  const comp = await page.request.post('/api/compartilhamentos', { headers: CSRF, data: { para: 'Dra. Ana Lima' } })
  expect(comp.status()).toBe(201)
  const { codigo } = await comp.json() as { codigo: string }

  const { pagina } = await novoNavegador()
  await pagina.goto('/#/acesso')
  await pagina.getByTestId('medico-codigo').fill(codigo)
  await pagina.getByTestId('medico-profissional').fill(PROFISSIONAL)
  const abertura = respostaDe(pagina, 'POST', '/api/acesso-medico')
  await pagina.getByTestId('medico-entrar').click()
  const res = await abertura
  expect(res.status()).toBe(200)
  expect((await res.json()).paciente).toMatchObject({ nome: MARCOS, responsavel: { nome: RAFAEL, relacao: 'filho' } })
  /* O médico vê o paciente como dono do histórico e quem enviou as informações. */
  const cabeca = pagina.getByTestId('medico-paciente')
  await expect(cabeca.getByRole('heading', { level: 1 })).toHaveText(MARCOS)
  await expect(cabeca).toContainText(`Informações enviadas por ${RAFAEL} (filho)`)
})

/* A declaração não é só da tela: o servidor recusa o onboarding de cuidador sem ela. */
test('onboarding de cuidador sem a declaração é recusado pela API', async ({ page, contas }) => {
  await contas.criar({ request: page.request, nome: RAFAEL })
  const sem = await page.request.post('/api/onboarding', {
    headers: CSRF, data: { modo: 'vazio', paciente: { nome: MARCOS, relacao: 'filho' } },
  })
  expect(sem.status()).toBe(400)
  expect((await sem.json()).campos).toMatchObject({ 'paciente.autorizacao': AUTORIZACAO_FALTANDO })
})

/* Em Meus dados, passar a cuidar do histórico de alguém também pede a declaração. */
test('virar cuidador em Meus dados exige a declaração', async ({ page, contas }) => {
  await contas.criar({ request: page.request, nome: RAFAEL, modo: 'vazio' })
  await page.goto('/#/app/privacidade')
  await esperarApp(page)
  await page.locator('#perfil-cuidador').check()
  await page.getByLabel('Nome do paciente').fill(MARCOS)
  await page.getByLabel('O que você é do paciente?').selectOption('filho')
  await page.getByTestId('perfil-salvar').click()
  await expect(page.locator('#perfil-autorizacao-erro')).toHaveText(AUTORIZACAO_FALTANDO)
  await expect(page.getByTestId('perfil-autorizacao')).toBeFocused()
  await expect(page.getByText(DECLARACAO_DO_MARCOS)).toBeVisible()

  await page.getByTestId('perfil-autorizacao').check()
  const patch = page.waitForRequest((r) => r.url().endsWith('/api/perfil') && r.method() === 'PATCH')
  await page.getByTestId('perfil-salvar').click()
  expect((await patch).postDataJSON().responsavel).toEqual({ nome: RAFAEL, relacao: 'filho', autorizacao: true })
  await expect(page.getByTestId('perfil-salvo')).toBeVisible()
  await expect(page.getByTestId('perfil-autorizacao')).toHaveCount(0)
  await expect(page.locator('.meus-dados__declaracao')).toBeVisible()
  expect((await lerEstado(page.request)).acessos[0].acao).toBe(`Declarou autorização para gerir o histórico de ${MARCOS}`)
})

/* Conta cuidador criada antes da declaração existir: o app pede a declaração num aviso no topo. */
test('conta cuidador antiga vê o pedido de declaração e o confirma @mobile', async ({ page, contas }) => {
  await contas.criar({ request: page.request, nome: RAFAEL, modo: 'vazio' })
  /* A sessão volta como a de uma conta antiga (responsável gravado sem autorizadoEm). */
  await page.route('**/api/auth/sessao', async (rota) => {
    const resposta = await rota.fetch()
    const conta = await resposta.json()
    conta.perfil = { ...conta.perfil, nome: MARCOS, responsavel: { nome: RAFAEL, relacao: 'filho', autorizacaoPendente: true } }
    await rota.fulfill({ response: resposta, json: conta })
  })
  await page.goto('/#/app/linha')
  await esperarApp(page)
  const pedido = page.getByTestId('pedido-autorizacao')
  await expect(pedido).toBeVisible()
  await expect(pedido).toContainText('Falta a sua declaração como responsável')

  await pedido.getByRole('button', { name: 'Confirmar declaração' }).click()
  await expect(page.locator('#pedido-autorizacao-erro')).toHaveText(AUTORIZACAO_FALTANDO)
  await expect(pedido.getByLabel(DECLARACAO_DO_MARCOS)).toBeFocused()

  await pedido.getByLabel(DECLARACAO_DO_MARCOS).check()
  const patch = page.waitForRequest((r) => r.url().endsWith('/api/perfil') && r.method() === 'PATCH')
  await pedido.getByRole('button', { name: 'Confirmar declaração' }).click()
  expect((await patch).postDataJSON()).toEqual({ responsavel: { nome: RAFAEL, relacao: 'filho', autorizacao: true } })
  await expect(pedido).toContainText('Declaração registrada')
  await expect(page.getByRole('button', { name: 'Confirmar declaração' })).toHaveCount(0)
})
