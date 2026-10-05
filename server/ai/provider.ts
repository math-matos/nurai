export interface MensagemLlm {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpcoesChat {
  json?: boolean
  maxTokens?: number
  temperatura?: number
  timeoutMs?: number
}

export interface LlmProvider {
  nome: 'oci' | 'mock'
  chat(mensagens: MensagemLlm[], opcoes?: OpcoesChat): Promise<string>
}
