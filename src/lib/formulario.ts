/* O foco espera o próximo quadro: durante o envio os campos ficam desabilitados, e um
   campo desabilitado recusa o foco até o React renderizar de novo. */
export function focar(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.focus())
}

/* Depois de um envio recusado, leva o foco ao primeiro campo com erro, na ordem visual. */
export function focarPrimeiroErro(ordem: { campo: string; id: string }[], erros: Record<string, string | undefined>) {
  const primeiro = ordem.find((o) => erros[o.campo])
  if (primeiro) focar(primeiro.id)
}
