import { readFileSync } from 'node:fs'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

/* Os headers de segurança vivem no vercel.json (produção); preview e dev leem de lá para
   a CSP ser exercitada localmente com o mesmo texto. */
interface VercelJson { headers: { source: string; headers: { key: string; value: string }[] }[] }
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as VercelJson
const HEADERS = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]))

/* Só no dev: o Vite injeta o preâmbulo do React Refresh como <script> inline e o CSS como <style>. */
const HEADERS_DEV = {
  ...HEADERS,
  'Content-Security-Policy': HEADERS['Content-Security-Policy']
    .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
    .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'"),
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    headers: HEADERS_DEV,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  preview: {
    headers: HEADERS,
  },
})
