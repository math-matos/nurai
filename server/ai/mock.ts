import type { LlmProvider } from './provider.js'

export function criarLlmMock(): LlmProvider {
  return {
    nome: 'mock',
    async chat(mensagens, opcoes) {
      const usuario = mensagens.filter((m) => m.role === 'user').length
      if (opcoes?.json) return JSON.stringify({ mock: true, mensagensUsuario: usuario })
      return `Resposta simulada (mock) a ${usuario} mensagem(ns) do usuário.`
    },
  }
}
