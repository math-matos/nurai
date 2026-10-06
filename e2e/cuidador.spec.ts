import { join } from 'node:path'
import { DIR_DOCUMENTOS } from './fixtures/gerar.ts'
import { respostaDe } from './helpers/ia.ts'
import { CSRF, esperarApp, irParaSecao, lerEstado } from './helpers/sessao.ts'
import { expect, test } from './helpers/test.ts'

const RAFAEL = 'Rafael Lima'
const MARCOS = 'Marcos Vinícius Teixeira'
const PROFISSIONAL = 'Dra. Ana Lima — CRM-FIC 123456'
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
  await expect(page.getByLabel('Nome de quem você cuida')).toBeFocused()
  await expect(page).toHaveURL(/#\/boas-vindas$/)

  await page.getByLabel('Nome de quem você cuida').fill(MARCOS)
  await page.getByLabel('Data de nascimento').fill('1958-03-02')
  await page.getByLabel('O que você é dessa pessoa?').selectOption('filho')
  await page.getByTestId('onboarding-vazio').click()
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
