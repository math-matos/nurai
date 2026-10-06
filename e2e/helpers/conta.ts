import type { APIRequestContext } from '@playwright/test'

export const SENHA_TESTE = 'Nurai-e2e-2026!'

export function emailTeste(): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `e2e+${Date.now()}-${rand}@nurai.test`
}

/* Contrato: DELETE /api/conta com {confirmacao:'EXCLUIR'}, header x-nurai e cookie da sessão.
   O `request` precisa ser o do contexto logado (context.request / page.request) para levar o cookie. */
export async function excluirConta(request: APIRequestContext): Promise<number> {
  const res = await request.delete('/api/conta', {
    data: { confirmacao: 'EXCLUIR' },
    headers: { 'x-nurai': '1' },
  })
  return res.status()
}
