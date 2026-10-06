import type { Locator, Page } from '@playwright/test'
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

/* Visto em produção: logo após o F5 no detalhe, o 1º clique em "Excluir este registro" não abria a
   confirmação; só o 2º. Clica assim que o botão aparece e confere que a confirmação fica aberta. */
test('logo após o F5 no detalhe, um clique em "Excluir este registro" abre a confirmação @mobile', async ({ page, contas }) => {
  await contas.criar({ request: page.request, nome: 'Paciente Recarga', modo: 'exemplo' })
  const [{ id, titulo }] = (await lerEstado(page.request)).eventos
  await page.goto(`/#/app/linha/${id}`)
  await esperarApp(page)

  await page.reload()
  const detalhe = page.getByTestId('evento-detalhe')
  await detalhe.getByTestId('evento-excluir').click()
  const confirmacao = detalhe.getByRole('group', { name: /Excluir .* do seu histórico/ })
  await expect(confirmacao).toBeVisible()
  await expect(confirmacao).toContainText(titulo)
  await page.waitForLoadState('networkidle')
  await expect(confirmacao).toBeVisible()
  await expect(detalhe.getByTestId('evento-excluir')).toHaveCount(0)
})

/* Visto em produção (simulação R2, P12): o DELETE apagou no servidor, mas a resposta não chegou ao celular.
   A tela não mudou, o erro foi para o topo da página (fora da vista) e o 2º toque recebeu 404. */
test.describe('exclusão com resposta perdida ou repetida', () => {
  test.use({ ignorarErros: [/net::ERR_FAILED/] })

  const tocar = (alvo: Locator, isMobile: boolean) => (isMobile ? alvo.tap() : alvo.click())

  async function abrirConfirmacao(page: Page, id: string, isMobile: boolean) {
    await page.goto(`/#/app/linha/${id}`)
    await esperarApp(page)
    const detalhe = page.getByTestId('evento-detalhe')
    await tocar(detalhe.getByTestId('evento-excluir'), isMobile)
    const confirmar = detalhe.getByTestId('evento-excluir-confirmar')
    /* A confirmação aparece onde a pessoa está olhando, não abaixo da dobra. */
    await expect(confirmar).toBeInViewport()
    return confirmar
  }

  async function afirmarExcluido(page: Page, id: string, titulo: string) {
    await expect(page).toHaveURL(/#\/app\/linha$/)
    const aviso = page.getByTestId('evento-excluido')
    await expect(aviso).toContainText(`“${titulo}” foi excluído`)
    await expect(aviso).toBeInViewport()
    await expect(aviso).toBeFocused()
    await expect(page.locator(`#evento-${id}`)).toHaveCount(0)
    await expect(page.locator('.palco__falha')).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
  }

  test('a resposta do DELETE se perde: a tela confere e mostra a exclusão, sem erro @mobile', async ({ page, contas, isMobile }) => {
    await contas.criar({ request: page.request, nome: 'Paciente Resposta Perdida', modo: 'exemplo' })
    const { id, titulo } = (await lerEstado(page.request)).eventos.find((e) => e.id === 'e09')!
    const confirmar = await abrirConfirmacao(page, id, isMobile)

    /* O servidor apaga; a resposta é derrubada no caminho. */
    await page.route(`**/api/eventos/${id}`, async (rota) => {
      await rota.fetch()
      await rota.abort('failed')
    }, { times: 1 })
    await tocar(confirmar, isMobile)

    await afirmarExcluido(page, id, titulo)
    expect((await lerEstado(page.request)).eventos.map((e) => e.id)).not.toContain(id)
  })

  test('o registro já tinha sido excluído (404): a tela trata como excluído, sem erro @mobile', async ({ page, contas, isMobile }) => {
    await contas.criar({ request: page.request, nome: 'Paciente Já Excluído', modo: 'exemplo' })
    const { id, titulo } = (await lerEstado(page.request)).eventos.find((e) => e.id === 'e09')!
    const confirmar = await abrirConfirmacao(page, id, isMobile)

    expect((await page.request.delete(`/api/eventos/${id}`, { headers: CSRF })).status()).toBe(204)
    const exclusao = respostaDe(page, 'DELETE', `/api/eventos/${id}`)
    await tocar(confirmar, isMobile)
    expect((await exclusao).status()).toBe(404)

    await afirmarExcluido(page, id, titulo)
  })

  test('durante a exclusão o botão fica desabilitado; sem rede, o erro aparece na própria confirmação @mobile', async ({
    page, contas, isMobile,
  }) => {
    await contas.criar({ request: page.request, nome: 'Paciente Sem Rede', modo: 'exemplo' })
    const { id } = (await lerEstado(page.request)).eventos.find((e) => e.id === 'e09')!
    const confirmar = await abrirConfirmacao(page, id, isMobile)

    /* Nenhuma tentativa chega ao servidor. */
    let tentativas = 0
    let liberar = () => {}
    const segura = new Promise<void>((r) => { liberar = r })
    await page.route(`**/api/eventos/${id}`, async (rota) => {
      tentativas += 1
      await segura
      await rota.abort('failed')
    })
    await tocar(confirmar, isMobile)
    await expect(confirmar).toBeDisabled()
    await expect(confirmar).toHaveText('Excluindo…')
    liberar()

    const confirmacao = page.getByTestId('evento-detalhe').getByRole('group', { name: /Excluir .* do seu histórico/ })
    const erro = confirmacao.getByRole('alert')
    await expect(erro).toContainText('Não foi possível falar com o servidor')
    await expect(erro).toBeInViewport()
    await expect(confirmar).toBeEnabled()
    await expect(page.locator('.palco__falha')).toHaveCount(0)
    expect(tentativas).toBeGreaterThanOrEqual(1)
    expect((await lerEstado(page.request)).eventos.map((e) => e.id)).toContain(id)
  })
})

/* Ao recarregar, uma falha passageira ao buscar o histórico não vira tela de erro: o app tenta de novo sozinho. */
test.describe('recarga com servidor instável', () => {
  test.use({ ignorarErros: [/HTTP 502|status of 502/] })

  test('falha passageira ao carregar o histórico é repetida sem mostrar erro @mobile', async ({ page, contas }) => {
    await contas.criar({ request: page.request, nome: 'Paciente Recarga Instável', modo: 'exemplo' })
    await page.route('**/api/estado', (rota) => rota.fulfill({ status: 502, body: '' }), { times: 1 })
    await page.goto('/#/app/linha/nao-existe')
    await esperarApp(page)
    await expect(page.getByText('Registro não encontrado')).toBeVisible()
    await expect(page.getByText('Não foi possível carregar o histórico')).toHaveCount(0)
    await expect(page.getByTestId('evento-item').first()).toBeVisible()
  })
})
