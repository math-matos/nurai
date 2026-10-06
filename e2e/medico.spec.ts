import type { Page } from '@playwright/test'
import { montarHistoricoMarcos } from './fixtures/historico-marcos.ts'
import { respostaDe } from './helpers/ia.ts'
import { CSRF, REAL, esperarApp, lerEstado } from './helpers/sessao.ts'
import { expect, test } from './helpers/test.ts'

const PROFISSIONAL = 'Dra. Ana Lima — CRM-FIC 123456'
const CODIGO_INVALIDO = 'Código inválido, expirado ou revogado. Confira com o paciente se o acesso ainda está ativo.'
const ACOES_DE_ESCRITA = /salvar|excluir|revogar|reiniciar|marcar|anexar|conectar|editar|apagar|acesso temporário|perguntar/i

async function informarCodigo(pagina: Page, codigo: string, profissional = PROFISSIONAL) {
  await pagina.getByTestId('medico-codigo').fill(codigo)
  await pagina.getByTestId('medico-profissional').fill(profissional)
  const resposta = respostaDe(pagina, 'POST', '/api/acesso-medico')
  await pagina.getByTestId('medico-entrar').click()
  return resposta
}

test('profissional abre o histórico pelo código, só lê, e perde o acesso quando a paciente revoga @smoke', async ({
  page, contas, novoNavegador,
}) => {
  const conta = await contas.criar({ request: page.request, nome: 'Helena Duarte Nogueira', modo: 'exemplo' })
  const estado = await lerEstado(page.request)

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/#/app/resumo')
  await esperarApp(page)
  await page.getByTestId('acesso-gerar').click()
  const codigo = (await page.getByTestId('acesso-codigo').textContent())!.trim()
  expect(codigo).toMatch(/^[A-HJKMNP-Z2-9]{6}$/)
  await expect(page.getByTestId('acesso-validade')).toContainText('Válido até')
  await page.getByTestId('acesso-copiar').click()
  await expect(page.getByTestId('acesso-painel')).toContainText('Copiado.')
  const copiado = await page.evaluate(() => navigator.clipboard.readText())
  expect(copiado).toContain(codigo)
  expect(copiado).toContain('/#/acesso')

  /* Profissional sem conta, noutro navegador, digitando o código em minúsculas e com espaços. */
  const { pagina, api } = await novoNavegador()
  await pagina.goto('/#/acesso')
  const abertura = await informarCodigo(pagina, ` ${codigo.slice(0, 3)} ${codigo.slice(3)} `.toLowerCase())
  expect(abertura.status()).toBe(200)
  const corpo = await abertura.text()
  expect(corpo).not.toContain(conta.email)
  expect(corpo).not.toMatch(/pacienteId|"email"/)
  const { pontosEmAberto } = JSON.parse(corpo) as { pontosEmAberto: { texto: string }[] }

  await expect(pagina.getByTestId('medico-paciente')).toContainText(conta.nome)
  await expect(pagina.getByTestId('medico-evento')).toHaveCount(estado.eventos.length)
  /* A seção mostra o que o servidor calculou no acesso, não os passos gravados pela paciente. */
  await expect(pagina.getByTestId('medico-ponto')).toHaveCount(pontosEmAberto.length)
  for (const p of pontosEmAberto) await expect(pagina.getByTestId('medico-pendencias')).toContainText(p.texto)
  if (pontosEmAberto.length === 0) {
    await expect(pagina.getByTestId('medico-pendencias')).toContainText('Nenhum ponto em aberto identificado nos registros')
  }
  await expect(pagina.getByTestId('medico-aviso')).toContainText(PROFISSIONAL)
  await expect(pagina.locator('body')).not.toContainText(conta.email)

  /* Nenhum controle de escrita: só o campo opcional de especialidade do resumo. */
  await expect(pagina.locator('textarea, select, input[type=checkbox], input[type=file]')).toHaveCount(0)
  await expect(pagina.locator('input')).toHaveCount(1)
  await expect(pagina.locator('input#medico-especialidade')).toHaveCount(1)
  const botoes = await pagina.getByRole('button').allTextContents()
  expect(botoes.filter((b) => ACOES_DE_ESCRITA.test(b))).toEqual([])
  await expect(pagina.getByTestId('evento-excluir')).toHaveCount(0)
  expect((await api.get('/api/estado')).status()).toBe(401)
  expect((await api.delete(`/api/eventos/${estado.eventos[0].id}`, { headers: CSRF })).status()).toBe(401)

  const gerado = respostaDe(pagina, 'POST', '/api/acesso-medico/resumo')
  await pagina.getByTestId('medico-gerar-resumo').click()
  const resumo = await gerado
  expect(resumo.status()).toBe(200)
  const sintese: string[] = (await resumo.json()).sintese
  await expect(pagina.getByTestId('medico-resumo')).toContainText(sintese[0])

  await page.goto('/#/app/privacidade')
  const auditoria = page.locator('.auditoria')
  await expect(auditoria.locator('li').filter({ hasText: 'Abriu o histórico pelo código' })).toContainText(PROFISSIONAL)
  await expect(auditoria.locator('li').filter({ hasText: 'Gerou resumo pré-consulta pelo código' })).toContainText(PROFISSIONAL)

  await page.goto('/#/app/resumo')
  await page.getByTestId('acesso-revogar').click()
  await expect(page.getByTestId('acesso-painel')).toHaveCount(0)
  /* O painel some, mas a confirmação fica, com o foco nela. */
  const revogado = page.getByTestId('acesso-revogado')
  await expect(revogado).toContainText(`O código ${codigo} não abre mais o histórico.`)
  await expect(revogado).toContainText(/Acesso revogado em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/)
  await expect(revogado).toBeFocused()
  expect((await lerEstado(page.request)).compartilhamento).toBeNull()

  /* Na tela já aberta, pedir o resumo de novo é recusado e os dados saem da tela; recarregando, o código não abre mais. */
  const negado = respostaDe(pagina, 'POST', '/api/acesso-medico/resumo')
  await pagina.getByTestId('medico-gerar-resumo').click()
  expect((await negado).status()).toBe(404)
  await expect(pagina.getByTestId('medico-encerrado')).toContainText('Este acesso foi encerrado pelo paciente')
  await expect(pagina.getByTestId('medico-paciente')).toHaveCount(0)
  await expect(pagina.getByTestId('medico-evento')).toHaveCount(0)
  await expect(pagina.locator('body')).not.toContainText(conta.nome)

  await pagina.reload()
  expect((await informarCodigo(pagina, codigo)).status()).toBe(404)
  await expect(pagina.locator('#medico-codigo-erro')).toHaveText(CODIGO_INVALIDO)
  await expect(pagina.getByTestId('medico-paciente')).toHaveCount(0)
})

/* A tela do profissional não fica mostrando o histórico depois da revogação: ao voltar para a aba, ela confere o código. */
test('tela aberta do profissional se fecha quando ele volta à aba depois da revogação', async ({ page, contas, novoNavegador }) => {
  const conta = await contas.criar({ request: page.request, nome: 'Helena Duarte Nogueira', modo: 'exemplo' })
  const criado = await page.request.post('/api/compartilhamentos', { headers: CSRF, data: { para: 'Dra. Teste' } })
  const { codigo } = await criado.json()

  const { pagina } = await novoNavegador()
  await pagina.goto('/#/acesso')
  expect((await informarCodigo(pagina, codigo)).status()).toBe(200)
  await expect(pagina.getByTestId('medico-paciente')).toContainText(conta.nome)

  expect((await page.request.delete(`/api/compartilhamentos/${codigo}`, { headers: CSRF })).status()).toBeLessThan(300)

  /* A conferência usa /verificar, que não registra uma nova abertura no histórico do paciente. */
  const conferencia = respostaDe(pagina, 'POST', '/api/acesso-medico/verificar')
  await pagina.evaluate(() => window.dispatchEvent(new Event('focus')))
  expect((await conferencia).status()).toBe(404)
  const aviso = pagina.getByTestId('medico-encerrado')
  await expect(aviso).toContainText('Este acesso foi encerrado pelo paciente')
  await expect(aviso).toBeFocused()
  await expect(pagina.getByTestId('medico-paciente')).toHaveCount(0)
  await expect(pagina.locator('body')).not.toContainText(conta.nome)
  const aberturas = (await lerEstado(page.request)).acessos.filter((a) => a.acao === 'Abriu o histórico pelo código')
  expect(aberturas).toHaveLength(1)

  /* Um código novo abre de novo e tira o aviso. */
  const novo = await (await page.request.post('/api/compartilhamentos', { headers: CSRF, data: { para: 'Dra. Teste' } })).json()
  expect((await informarCodigo(pagina, novo.codigo)).status()).toBe(200)
  await expect(pagina.getByTestId('medico-paciente')).toContainText(conta.nome)
  await expect(aviso).toHaveCount(0)
})

test.describe('conferência da tela aberta', () => {
  /* O Chromium loga a requisição abortada de propósito como erro de console. */
  test.use({ ignorarErros: [/net::ERR_FAILED/] })

  test('429 ou falha de rede na conferência não fecham a tela; a conferência do ciclo seguinte ainda encerra', async ({
    page, contas, novoNavegador,
  }) => {
    const conta = await contas.criar({ request: page.request, nome: 'Helena Duarte Nogueira', modo: 'exemplo' })
    const criado = await page.request.post('/api/compartilhamentos', { headers: CSRF, data: { para: 'Dra. Teste' } })
    const { codigo } = await criado.json()

    const { pagina } = await novoNavegador()
    await pagina.clock.install()
    await pagina.goto('/#/acesso')
    expect((await informarCodigo(pagina, codigo)).status()).toBe(200)
    const paciente = pagina.getByTestId('medico-paciente')
    const aviso = pagina.getByTestId('medico-encerrado')
    await expect(paciente).toContainText(conta.nome)

    const VERIFICAR = '**/api/acesso-medico/verificar'
    const proximoCiclo = () => pagina.clock.fastForward(60_000)

    await pagina.route(VERIFICAR, (rota) => rota.fulfill({
      status: 429, headers: { 'retry-after': '60' },
      json: { erro: 'Muitas tentativas seguidas. Tente de novo em 1 min.', codigo: 'MUITAS_TENTATIVAS' },
    }), { times: 1 })
    const limitada = respostaDe(pagina, 'POST', '/api/acesso-medico/verificar')
    await proximoCiclo()
    expect((await limitada).status()).toBe(429)
    await expect(paciente).toContainText(conta.nome)
    await expect(aviso).toHaveCount(0)

    await pagina.route(VERIFICAR, (rota) => rota.abort(), { times: 1 })
    const semRede = pagina.waitForEvent('requestfailed', (r) => r.url().includes('/api/acesso-medico/verificar'))
    await proximoCiclo()
    await semRede
    await expect(paciente).toContainText(conta.nome)
    await expect(aviso).toHaveCount(0)

    /* A tela continuou conferindo: revogado o código, o ciclo seguinte encerra o acesso. */
    expect((await page.request.delete(`/api/compartilhamentos/${codigo}`, { headers: CSRF })).status()).toBeLessThan(300)
    const recusada = respostaDe(pagina, 'POST', '/api/acesso-medico/verificar')
    await proximoCiclo()
    expect((await recusada).status()).toBe(404)
    await expect(aviso).toContainText('Este acesso foi encerrado pelo paciente')
    await expect(paciente).toHaveCount(0)
  })
})

test('código inexistente e campos inválidos mostram erro no campo', async ({ novoNavegador }) => {
  const { pagina } = await novoNavegador()
  await pagina.goto('/#/acesso')

  await pagina.getByTestId('medico-entrar').click()
  await expect(pagina.locator('#medico-codigo-erro')).toHaveText('Informe o código que o paciente compartilhou')
  await expect(pagina.locator('#medico-profissional-erro')).toHaveText('Informe seu nome e registro profissional')
  await expect(pagina.getByTestId('medico-codigo')).toBeFocused()

  expect((await informarCodigo(pagina, 'ZZZ999')).status()).toBe(404)
  await expect(pagina.locator('#medico-codigo-erro')).toHaveText(CODIGO_INVALIDO)
  await expect(pagina.getByTestId('medico-codigo')).toBeFocused()

  expect((await informarCodigo(pagina, 'ZZZ999', 'Jo')).status()).toBe(400)
  await expect(pagina.locator('#medico-profissional-erro')).toContainText('pelo menos 3 caracteres')
  await expect(pagina.getByTestId('medico-profissional')).toBeFocused()
})

test('a 11ª tentativa de código no mesmo minuto responde 429', async ({ novoNavegador }) => {
  const { pagina, api } = await novoNavegador()
  for (let i = 0; i < 10; i++) {
    const res = await api.post('/api/acesso-medico', {
      headers: CSRF,
      data: { codigo: 'ZZZ999', profissional: PROFISSIONAL },
    })
    expect(res.status(), `tentativa ${i + 1}`).toBe(404)
  }

  await pagina.goto('/#/acesso')
  const bloqueio = await informarCodigo(pagina, 'ZZZ999')
  expect(bloqueio.status()).toBe(429)
  expect(bloqueio.headers()['retry-after']).toBe('60')
  await expect(pagina.getByTestId('medico-erro')).toHaveText('Muitas tentativas seguidas. Tente de novo em 1 min.')
})

/* Simulação de usabilidade: a visão do médico dizia "Nenhum ponto em aberto" com um exame repetido no
   histórico, porque lia os passos gravados — que só existem depois de o paciente clicar em "Reanalisar". */
test('pontos em aberto vêm do histórico mesmo sem "Reanalisar"; tentativa com código revogado fica no log', async ({
  page, contas, novoNavegador,
}) => {
  await contas.criar({ request: page.request, nome: 'Marcos Vinícius Teixeira', modo: 'vazio' })
  const { ids } = await montarHistoricoMarcos(page.request, REAL)
  expect((await lerEstado(page.request)).passos).toEqual([])
  const comp = await page.request.post('/api/compartilhamentos', { headers: CSRF, data: { para: 'Dra. Ana Lima' } })
  const { codigo } = await comp.json() as { codigo: string }

  const { pagina, api } = await novoNavegador()
  await pagina.goto('/#/acesso')
  const abertura = await informarCodigo(pagina, codigo)
  expect(abertura.status()).toBe(200)
  const corpo = await abertura.json() as { passos: unknown[]; pontosEmAberto: { tipo: string; texto: string; ancoras: string[] }[] }
  expect(corpo.passos).toEqual([])
  /* Perfil lipídico pedido 21 dias depois de feito. */
  expect(corpo.pontosEmAberto).toContainEqual({
    tipo: 'repeticao', ancoras: [ids.lipidico, ids.pedidoLipidico], texto: expect.stringMatching(/^Possível exame repetido: pedido de perfil lipídico/),
  })

  /* Na tela, não só na API: o ponto aparece no grupo de repetições e o chip leva ao registro na linha do tempo. */
  const pontos = pagina.getByTestId('medico-pendencias')
  await expect(pontos.getByRole('heading', { name: 'Possíveis exames repetidos' })).toBeVisible()
  const repetido = pagina.getByTestId('medico-ponto').filter({ hasText: /^Possível exame repetido: pedido de perfil lipídico/ })
  await expect(repetido).toHaveCount(1)
  await expect(pontos).not.toContainText('Nenhum ponto em aberto')
  const lipidico = pagina.locator(`#medico-evento-${ids.lipidico}`)
  await expect(lipidico).not.toHaveAttribute('open', '')
  await repetido.getByRole('button').first().click()
  await expect(lipidico).toHaveAttribute('open', '')
  await expect(lipidico.locator('summary')).toBeFocused()

  const verificar = () => api.post('/api/acesso-medico/verificar', { headers: CSRF, data: { codigo } })
  expect((await verificar()).status()).toBe(204)

  await page.goto('/#/app/resumo')
  await esperarApp(page)
  await page.getByTestId('acesso-revogar').click()
  await expect(page.getByTestId('acesso-painel')).toHaveCount(0)
  expect((await verificar()).status()).toBe(404)

  await pagina.reload()
  expect((await informarCodigo(pagina, codigo)).status()).toBe(404)
  await expect(pagina.locator('#medico-codigo-erro')).toHaveText(CODIGO_INVALIDO)

  const [recusa] = (await lerEstado(page.request)).acessos
  expect(recusa).toMatchObject({
    quem: PROFISSIONAL, papel: 'Profissional de saúde (via código)', acao: 'Tentativa recusada: código revogado',
    itens: `••••${codigo.slice(-2)}`,
  })
  await page.goto('/#/app/privacidade')
  await expect(page.locator('.auditoria li').filter({ hasText: 'Tentativa recusada: código revogado' })).toContainText(PROFISSIONAL)
})
