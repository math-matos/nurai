import { REAL } from './helpers/sessao.ts'
import { expect, test } from './helpers/test.ts'

test('abre a home com o título Nurai @smoke', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Nurai/)
})

test('GET /api/health responde 200 @smoke', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.status()).toBe(200)
  const saude = await res.json()
  expect(saude).toMatchObject({ ok: true })
  /* Em modo real, uma IA ou um banco simulado respondendo seria um falso verde da suíte inteira. */
  if (REAL) expect(saude).toMatchObject({ genai: 'oci', db: 'oracle' })
})
