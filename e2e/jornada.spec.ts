import { join } from 'node:path'
import type { Evento } from '../src/data/types.ts'
import { compararExtracao, gabarito, type ExtracaoEsperada } from './fixtures/gabaritos.ts'
import { DIR_DOCUMENTOS } from './fixtures/gerar.ts'
import { SENHA_TESTE, emailTeste } from './helpers/conta.ts'
import { afirmarAncoras, afirmarTextoDeIa, respostaDe } from './helpers/ia.ts'
import { REAL, abrirMenuSePreciso, esperarApp, irParaSecao, lerEstado } from './helpers/sessao.ts'
import { expect, test } from './helpers/test.ts'

const HEMOGRAMA = gabarito('01-hemograma-2026-03-10.pdf')

/* A jornada inteira de quem chega pela primeira vez, numa conta só: é o smoke de produção. */
test('jornada: cadastro, histórico do zero, anexar PDF, persistir, perguntar, sair e entrar @smoke', async ({
  page, contas,
}) => {
  const conta = { nome: 'Marcos Vinícius Teixeira', email: emailTeste(), senha: SENHA_TESTE }
  contas.registrar(conta)

  await page.goto('/#/cadastro')
  await page.getByTestId('cadastro-nome').fill(conta.nome)
  await page.getByTestId('cadastro-email').fill(conta.email)
  await page.getByTestId('cadastro-senha').fill(conta.senha)
  await page.getByTestId('cadastro-lgpd').check()
  await page.getByTestId('cadastro-enviar').click()
  await expect(page).toHaveURL(/#\/boas-vindas$/)
  await page.getByTestId('onboarding-vazio').click()
  await expect(page).toHaveURL(/#\/app\/linha$/)
  await esperarApp(page)
  await expect(page.getByTestId('estado-vazio')).toBeVisible()

  await irParaSecao(page, 'Fontes e anexos')
  await expect(page).toHaveURL(/#\/app\/fontes$/)
  const extracao = respostaDe(page, 'POST', '/api/extrair')
  await page.getByTestId('fontes-pdf').setInputFiles(join(DIR_DOCUMENTOS, HEMOGRAMA.arquivo))
  const extraida = await extracao
  expect(extraida.status()).toBe(200)
  const { evento } = await extraida.json()
  await expect(page.getByTestId('conferencia')).toContainText(HEMOGRAMA.arquivo)
  if (REAL) {
    const { acertos, total, divergencias } = compararExtracao(evento, HEMOGRAMA.esperado as ExtracaoEsperada)
    test.info().annotations.push({ type: 'extracao', description: `${HEMOGRAMA.arquivo} (jornada): ${acertos}/${total}` })
    expect(acertos / total, JSON.stringify(divergencias)).toBeGreaterThanOrEqual(0.9)
  }

  const gravacao = respostaDe(page, 'POST', '/api/eventos')
  await page.getByTestId('conferencia-salvar').click()
  const gravada = await gravacao
  expect(gravada.status()).toBe(201)
  const salvo: Evento = await gravada.json()
  await expect(page).toHaveURL(new RegExp(`#/app/linha/${salvo.id}$`))

  await page.reload()
  await esperarApp(page)
  await expect(page.getByTestId('evento-detalhe').getByRole('heading', { level: 2 })).toHaveText(salvo.titulo)
  await expect(page.getByTestId('evento-item')).toHaveCount(1)

  await irParaSecao(page, 'Copiloto')
  const pergunta = respostaDe(page, 'POST', '/api/copiloto')
  await page.getByTestId('copiloto-pergunta').fill('Como está minha hemoglobina no último hemograma?')
  await page.getByTestId('copiloto-enviar').click()
  const respondida = await pergunta
  expect(respondida.status()).toBe(200)
  const resposta: { texto: string[]; ancoras: string[] } = await respondida.json()
  await expect(page.getByTestId('copiloto-resposta').last()).toContainText(resposta.texto[0])
  const eventos = (await lerEstado(page.request)).eventos
  afirmarTextoDeIa(resposta.texto, eventos, 'copiloto')
  afirmarAncoras(resposta.ancoras, eventos, 'copiloto')
  if (REAL) expect(resposta.ancoras).toContain(salvo.id)

  await abrirMenuSePreciso(page)
  await page.getByTestId('botao-sair').click()
  await expect(page).toHaveURL(/#\/$/)
  expect((await page.request.get('/api/estado')).status()).toBe(401)

  await page.goto('/#/entrar')
  await page.getByTestId('entrar-email').fill(conta.email)
  await page.getByTestId('entrar-senha').fill(conta.senha)
  await page.getByTestId('entrar-enviar').click()
  await expect(page).toHaveURL(/#\/app\/linha$/)
  await esperarApp(page)
  await expect(page.getByTestId('shell-perfil-nome')).toHaveText(conta.nome)
  await expect(page.locator(`#evento-${salvo.id}`)).toContainText(salvo.titulo)
})
