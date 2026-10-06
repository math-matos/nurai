import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DIR_DOCUMENTOS } from './fixtures/gerar.ts'
import { CSRF, cabecalhosDeIp, esperarApp, lerEstado } from './helpers/sessao.ts'
import { expect, test } from './helpers/test.ts'

/* Toda rota de /api exceto /health, /auth/* e /acesso-medico/*. */
const ROTAS_PROTEGIDAS: { metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE'; caminho: string; corpo?: unknown }[] = [
  { metodo: 'GET', caminho: '/api/estado' },
  { metodo: 'GET', caminho: '/api/acessos' },
  { metodo: 'POST', caminho: '/api/eventos', corpo: {} },
  { metodo: 'DELETE', caminho: '/api/eventos/e01' },
  { metodo: 'PATCH', caminho: '/api/consentimentos/c1' },
  { metodo: 'PATCH', caminho: '/api/passos/p1' },
  { metodo: 'POST', caminho: '/api/fontes/f1/conectar' },
  { metodo: 'POST', caminho: '/api/compartilhamentos', corpo: { para: 'Dra. Teste' } },
  { metodo: 'DELETE', caminho: '/api/compartilhamentos/ABC234' },
  { metodo: 'POST', caminho: '/api/reiniciar' },
  { metodo: 'POST', caminho: '/api/onboarding', corpo: { modo: 'vazio' } },
  { metodo: 'PATCH', caminho: '/api/perfil', corpo: { nome: 'Intruso' } },
  { metodo: 'DELETE', caminho: '/api/conta', corpo: { confirmacao: 'EXCLUIR' } },
  { metodo: 'POST', caminho: '/api/copiloto', corpo: { pergunta: 'Quais exames eu fiz?' } },
  { metodo: 'POST', caminho: '/api/extrair', corpo: { texto: 'Hemoglobina: 14 g/dL (ref 13 a 17)' } },
  { metodo: 'POST', caminho: '/api/exames/e01/explicar' },
  { metodo: 'POST', caminho: '/api/resumo', corpo: { especialidade: 'Cardiologia' } },
  { metodo: 'POST', caminho: '/api/passos/gerar' },
]

test('B não vê na tela nem na API o documento que A anexou @smoke', async ({ page, contas, novoNavegador }) => {
  await contas.criar({ request: page.request, nome: 'Paciente A', modo: 'vazio' })
  const titulo = `Documento só da A ${Date.now()}`

  await page.goto('/#/app/fontes')
  await esperarApp(page)
  const texto = await readFile(join(DIR_DOCUMENTOS, '10-whatsapp-potassio-creatinina.txt'), 'utf8')
  await page.getByTestId('fontes-texto').fill(texto)
  await page.getByTestId('fontes-ler-texto').click()
  await page.getByTestId('conferencia-titulo').fill(titulo)
  await page.getByTestId('conferencia-salvar').click()
  await expect(page.getByTestId('evento-detalhe')).toContainText(titulo)
  const deA = (await lerEstado(page.request)).eventos
  expect(deA.map((e) => e.titulo)).toEqual([titulo])

  const b = await novoNavegador()
  await contas.criar({ request: b.contexto.request, nome: 'Paciente B', modo: 'vazio' })
  await b.pagina.goto('/#/app/linha')
  await esperarApp(b.pagina)
  await expect(b.pagina.getByTestId('estado-vazio')).toBeVisible()
  await expect(b.pagina.getByText(titulo)).toHaveCount(0)
  await b.pagina.goto('/#/app/privacidade')
  await expect(b.pagina.getByText('Nenhum acesso registrado ainda.')).toBeVisible()

  const deB = await lerEstado(b.contexto.request)
  expect(deB.eventos).toEqual([])
  expect(JSON.stringify(deB)).not.toContain(titulo)
  const explicar = await b.contexto.request.post(`/api/exames/${deA[0].id}/explicar`, { headers: CSRF })
  expect(explicar.status()).toBe(404)
})

test('B não altera passos, consentimentos nem o acesso compartilhado de A', async ({ page, contas, novoNavegador }) => {
  await contas.criar({ request: page.request, nome: 'Paciente A', modo: 'exemplo' })
  const compartilhamento = await page.request.post('/api/compartilhamentos', { headers: CSRF, data: { para: 'Dra. Teste' } })
  expect(compartilhamento.status()).toBe(201)
  const antes = await lerEstado(page.request)
  const passo = antes.passos[0]
  const consentimento = antes.consentimentos[0]

  const b = await novoNavegador()
  await contas.criar({ request: b.contexto.request, nome: 'Paciente B', modo: 'vazio' })
  const api = b.contexto.request
  const tentativas = [
    await api.patch(`/api/passos/${passo.id}`, { headers: CSRF }),
    await api.patch(`/api/consentimentos/${consentimento.id}`, { headers: CSRF }),
    await api.post(`/api/fontes/${antes.fontes[0].id}/conectar`, { headers: CSRF }),
    await api.delete(`/api/compartilhamentos/${antes.compartilhamento!.codigo}`, { headers: CSRF }),
  ]
  expect(tentativas.map((r) => r.status())).toEqual([404, 404, 404, 404])

  const depois = await lerEstado(page.request)
  expect(depois.passos.find((p) => p.id === passo.id)!.feito).toBe(passo.feito)
  expect(depois.consentimentos.find((c) => c.id === consentimento.id)!.ativo).toBe(consentimento.ativo)
  expect(depois.compartilhamento?.codigo).toBe(antes.compartilhamento!.codigo)
  expect((await lerEstado(api)).eventos).toEqual([])
})

test('sem sessão, toda rota protegida responde 401', async ({ playwright, baseURL }) => {
  const anonimo = await playwright.request.newContext({ baseURL, extraHTTPHeaders: cabecalhosDeIp() })
  const forjado = await playwright.request.newContext({
    baseURL, extraHTTPHeaders: { ...cabecalhosDeIp(), cookie: 'nurai_sessao=token-forjado-pelo-teste' },
  })
  for (const api of [anonimo, forjado]) {
    for (const { metodo, caminho, corpo } of ROTAS_PROTEGIDAS) {
      const res = await api.fetch(caminho, { method: metodo, headers: CSRF, ...(corpo !== undefined && { data: corpo }) })
      expect(res.status(), `${metodo} ${caminho}`).toBe(401)
      expect((await res.json()).codigo, `${metodo} ${caminho}`).toBe('NAO_AUTENTICADO')
    }
    expect((await api.get('/api/auth/sessao')).status()).toBe(401)
    expect((await api.get('/api/health')).status()).toBe(200)
  }
  await anonimo.dispose()
  await forjado.dispose()
})

test('escrita sem o cabeçalho x-nurai responde 403, mesmo com sessão', async ({ page, contas }) => {
  await contas.criar({ request: page.request, modo: 'exemplo' })
  const semCabecalho = [
    await page.request.post('/api/compartilhamentos', { data: { para: 'Site de terceiros' } }),
    await page.request.patch('/api/perfil', { data: { nome: 'Trocado por CSRF' } }),
    await page.request.patch('/api/passos/p1'),
    await page.request.delete('/api/conta', { data: { confirmacao: 'EXCLUIR' } }),
    await page.request.post('/api/auth/logout'),
  ]
  for (const res of semCabecalho) {
    expect(res.status(), res.url()).toBe(403)
    expect((await res.json()).codigo).toBe('CSRF')
  }

  const estado = await lerEstado(page.request)
  expect(estado.compartilhamento).toBeNull()
  expect(estado.passos.find((p) => p.id === 'p1')!.feito).toBe(false)
  const sessao = await (await page.request.get('/api/auth/sessao')).json()
  expect(sessao.perfil.nome).toBe('Paciente E2E')
})
