const STATUS = {
  IA_INDISPONIVEL: 503,
  IA_RESPOSTA_INVALIDA: 502,
  NAO_CLINICO: 422,
  PDF_SEM_TEXTO: 422,
  PDF_INVALIDO: 422,
  ARQUIVO_GRANDE: 413,
} as const

export type CodigoErroIa = keyof typeof STATUS

/* A mensagem vai para o cliente: nunca incluir conteúdo clínico nem detalhes de credenciais. */
export class ErroIa extends Error {
  readonly codigo: CodigoErroIa

  constructor(codigo: CodigoErroIa, mensagem: string) {
    super(mensagem)
    this.name = 'ErroIa'
    this.codigo = codigo
  }

  get status(): (typeof STATUS)[CodigoErroIa] {
    return STATUS[this.codigo]
  }
}
