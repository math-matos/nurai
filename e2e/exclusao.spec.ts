import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DIR_DOCUMENTOS } from './fixtures/gerar.ts'
import { respostaDe } from './helpers/ia.ts'
import { CSRF, esperarApp, irParaSecao, lerEstado } from './helpers/sessao.ts'
import { expect, test } from './helpers/test.ts'

const ACAO = 'Excluiu registro do histórico'

/* Documento anexado por engano (inclusive de outra pessoa): a paciente precisa conseguir apagá-lo. */
test('anexar e excluir um registro: some da tela, da API e do F5, e fica no log @mobile', async ({
  page, contas, novoNavegador,
}) => {
  await contas.criar({ request: page.request, nome: 'Paciente Exclusão', modo: 'exemplo' })
  const titulo = `Anexado por engano ${Date.now()}`

  await page.goto('/#/app/fontes')
  await esperarApp(page)
  await page.getByTestId('fontes-texto').fill(await readFile(join(DIR_DOCUMENTOS, '10-whatsapp-potassio-creatinina.txt'), 'utf8'))
  await page.getByTestId('fontes-ler-texto').click()
  await page.getByTestId('conferencia-titulo').fill(titulo)
  await page.getByTestId('conferencia-salvar').click()
  const detalhe = page.getByTestId('evento-detalhe')
  await expect(detalhe.getByRole('heading', { level: 2 })).toHaveText(titulo)
  const antes = await lerEstado(page.request)
  const { id } = antes.eventos.find((e) => e.titulo === titulo)!

  /* Outro usuário não alcança o registro: 404, igual a um id que não existe. */
  const b = await novoNavegador()
  await contas.criar({ request: b.contexto.request, nome: 'Paciente Intrusa', modo: 'vazio' })
  expect((await b.contexto.request.delete(`/api/eventos/${id}`, { headers: CSRF })).status()).toBe(404)
  expect((await lerEstado(page.request)).eventos.map((e) => e.id)).toContain(id)

  /* Cancelar não apaga nada. */
  await detalhe.getByTestId('evento-excluir').click()
  await detalhe.getByRole('button', { name: 'Cancelar' }).click()
  await expect(detalhe.getByTestId('evento-excluir-confirmar')).toHaveCount(0)
  expect((await lerEstado(page.request)).eventos).toHaveLength(antes.eventos.length)

  await detalhe.getByTestId('evento-excluir').click()
  const confirmacao = detalhe.getByRole('group', { name: /Excluir .* do seu histórico/ })
  await expect(confirmacao).toContainText('A exclusão é definitiva')
  await expect(confirmacao).toContainText('Resumos e próximos passos gerados antes podem continuar citando')
  const exclusao = respostaDe(page, 'DELETE', `/api/eventos/${id}`)
  await detalhe.getByTestId('evento-excluir-confirmar').click()
  expect((await exclusao).status()).toBe(204)

  await expect(page).toHaveURL(/#\/app\/linha$/)
  await expect(page.getByTestId('evento-excluido')).toContainText(titulo)
  await expect(page.getByTestId('evento-excluido')).toBeInViewport()
  await expect(page.locator(`#evento-${id}`)).toHaveCount(0)
  await expect(page.getByTestId('evento-item')).toHaveCount(antes.eventos.length - 1)

  const depois = await lerEstado(page.request)
  expect(depois.eventos.map((e) => e.id)).not.toContain(id)
  expect(depois.eventos).toHaveLength(antes.eventos.length - 1)
  expect(depois.acessos[0]).toMatchObject({ papel: 'Titular', acao: ACAO })
  expect(depois.acessos[0].itens).toContain(titulo)

  await page.reload()
  await esperarApp(page)
  await expect(page.getByTestId('evento-item')).toHaveCount(antes.eventos.length - 1)
  await expect(page.getByText(titulo)).toHaveCount(0)
  await page.goto(`/#/app/linha/${id}`)
  await expect(page.getByText('Registro não encontrado')).toBeVisible()

  await irParaSecao(page, 'Acessos e consentimento')
  await expect(page.getByText(ACAO).first()).toBeVisible()
  await expect(page.getByText(titulo).first()).toBeVisible()
})
