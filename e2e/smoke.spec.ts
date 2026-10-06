import { expect, test } from './helpers/test.ts'

test('abre a home com o título Nurai', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Nurai/)
})

test('GET /api/health responde 200', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.status()).toBe(200)
  expect(await res.json()).toMatchObject({ ok: true })
})
