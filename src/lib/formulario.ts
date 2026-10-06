/* O foco é síncrono: quem chama já deve ter renderizado (flushSync) os campos reabilitados e
   os erros. Adiar o foco para um quadro futuro faz ele cair no meio do que a pessoa já
   começou a digitar em outro campo; e um campo ainda desabilitado recusa o foco. */
export function focar(id: string) {
  document.getElementById(id)?.focus()
}

/* Depois de um envio recusado, leva o foco ao primeiro campo com erro, na ordem visual. */
export function focarPrimeiroErro(ordem: { campo: string; id: string }[], erros: Record<string, string | undefined>) {
  const primeiro = ordem.find((o) => erros[o.campo])
  if (primeiro) focar(primeiro.id)
}
