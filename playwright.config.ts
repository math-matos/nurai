import { defineConfig, devices } from '@playwright/test'

/* Sem E2E_BASE_URL: roda contra o dev local (sobe `pnpm dev:all` se preciso).
   Com E2E_BASE_URL: roda contra um ambiente real (IA real é lenta e instável → 1 retry). */
const baseURLExterna = process.env.E2E_BASE_URL
const BASE_URL = baseURLExterna ?? 'http://localhost:5173'

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  outputDir: 'e2e/resultados',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: baseURLExterna ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'e2e/relatorio', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
  ],
  /* API e web separados para o Playwright esperar os dois (o /api/health sobe depois do Vite). */
  webServer: baseURLExterna
    ? undefined
    : [
        {
          command: 'pnpm dev:api',
          url: 'http://localhost:3001/api/health',
          reuseExistingServer: true,
          timeout: 120_000,
          stdout: 'ignore',
          stderr: 'pipe',
        },
        {
          command: 'pnpm dev:web',
          url: 'http://localhost:5173',
          reuseExistingServer: true,
          timeout: 120_000,
          stdout: 'ignore',
          stderr: 'pipe',
        },
      ],
})
