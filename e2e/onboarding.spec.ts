import { CSRF, abrirMenuSePreciso, esperarApp, lerEstado } from './helpers/sessao.ts'
import { expect, test } from './helpers/test.ts'

const HISTORICO_VAZIO = 'Seu histórico ainda está vazio. Anexe um exame ou laudo em Fontes para eu poder responder com base nele.'

test('"Começar do zero" deixa todas as telas no estado vazio', async ({ page, contas }) => {
  await contas.criar({ request: page.request, nome: 'Rita Zero' })
  await page.goto('/#/app/linha')
  await expect(page).toHaveURL(/#\/boas-vindas$/)
  await page.getByTestId('onboarding-vazio').click()
  await expect(page).toHaveURL(/#\/app\/linha$/)
  await esperarApp(page)

  const vazio = page.getByTestId('estado-vazio')
  await expect(vazio).toContainText('Seu histórico ainda está vazio')
  await expect(page.getByTestId('evento-item')).toHaveCount(0)

  for (const [secao, titulo] of [
    ['copiloto', 'Anexe um documento para começar a conversa'],
    ['cuidado', 'Ainda não há o que cruzar'],
    ['resumo', 'O resumo nasce do seu histórico'],
    ['privacidade', 'Ainda não há dados de saúde para proteger aqui'],
  ]) {
    await page.goto(`/#/app/${secao}`)
    await expect(vazio, secao).toContainText(titulo)
    await expect(page.getByTestId('cta-primeiro-documento'), secao).toBeVisible()
  }

  /* Privacidade continua útil sem histórico: dados da conta e nenhuma permissão. */
  await expect(page.getByTestId('perfil-form')).toBeVisible()
  await expect(page.getByText('Nenhuma instituição tem permissão no momento')).toBeVisible()
  await page.getByTestId('cta-primeiro-documento').click()
  await expect(page).toHaveURL(/#\/app\/fontes$/)
  await expect(page.getByText('Nenhuma fonte conectada.')).toBeVisible()

  await page.goto('/#/app/copiloto')
  await page.getByTestId('copiloto-pergunta').fill('Como está minha glicemia?')
  await page.getByTestId('copiloto-enviar').click()
  await expect(page.getByTestId('copiloto-resposta')).toContainText(HISTORICO_VAZIO)

  const estado = await lerEstado(page.request)
  expect(estado.eventos).toEqual([])
  expect(estado.passos).toEqual([])
  expect(estado.consentimentos).toEqual([])
})

test('"Explorar com exemplo" carrega os 24 registros', async ({ page, contas }) => {
  await contas.criar({ request: page.request })
  await page.goto('/#/boas-vindas')
  await page.getByTestId('onboarding-exemplo').click()
  await expect(page).toHaveURL(/#\/app\/linha$/)
  await esperarApp(page)
  await expect(page.getByTestId('evento-item')).toHaveCount(24)
  await expect(page.getByTestId('estado-vazio')).toHaveCount(0)
  await expect(page.getByTestId('selo-convidado')).toHaveCount(0)

  /* Boas-vindas não volta depois de escolhido o ponto de partida. */
  await page.goto('/#/boas-vindas')
  await expect(page).toHaveURL(/#\/app\/linha$/)
})

test('reiniciar restaura o exemplo, e "Começar do zero" troca o modo', async ({ page, contas }) => {
  await contas.criar({ request: page.request, modo: 'exemplo' })
  await page.goto('/#/app/cuidado')
  await esperarApp(page)

  const primeiro = page.locator('.passo').first()
  await primeiro.locator('.passo__marcar').click()
  await expect(primeiro).toHaveClass(/passo--feito/)
  expect((await lerEstado(page.request)).passos.filter((p) => p.feito)).toHaveLength(1)

  await abrirMenuSePreciso(page)
  await page.getByTestId('botao-reiniciar').click()
  await page.getByTestId('reinicio-confirmar').click()
  await expect(page).toHaveURL(/#\/app\/linha$/)
  await expect(page.getByTestId('evento-item')).toHaveCount(24)
  await expect.poll(async () => (await lerEstado(page.request)).passos.filter((p) => p.feito).length).toBe(0)

  await abrirMenuSePreciso(page)
  await page.getByTestId('botao-reiniciar').click()
  await page.getByTestId('reinicio-zerar').click()
  await expect(page).toHaveURL(/#\/app\/linha$/)
  await expect(page.getByTestId('estado-vazio')).toBeVisible()
  expect((await lerEstado(page.request)).eventos).toEqual([])
  const sessao = await (await page.request.get('/api/auth/sessao')).json()
  expect(sessao.perfil.onboarding).toBe('vazio')

  /* No modo vazio, reiniciar apaga o que foi anexado e não traz o exemplo de volta. */
  const anexo = await page.request.post('/api/eventos', {
    headers: CSRF,
    data: {
      id: `u${Date.now()}`, data: '2026-03-10', tipo: 'exame', titulo: 'Hemograma completo', instituicao: 'Laboratório Quaresmeira',
      fonte: 'paciente', resumo: 'Anexado pelo teste.', sinal: 'info', tags: [], origem: 'OCR + IA',
    },
  })
  expect(anexo.status()).toBe(201)
  await page.reload()
  await esperarApp(page)
  await expect(page.getByTestId('evento-item')).toHaveCount(1)

  await abrirMenuSePreciso(page)
  await expect(page.getByTestId('botao-reiniciar')).toHaveText('Reiniciar meu histórico')
  await page.getByTestId('botao-reiniciar').click()
  await expect(page.getByTestId('reinicio-zerar')).toHaveCount(0)
  await page.getByTestId('reinicio-confirmar').click()
  await expect(page.getByTestId('estado-vazio')).toBeVisible()
  await expect.poll(async () => (await lerEstado(page.request)).eventos.length).toBe(0)
})
