/* Depois de um envio recusado, leva o foco ao primeiro campo com erro, na ordem visual. */
export function focarPrimeiroErro(ordem: { campo: string; id: string }[], erros: Record<string, string | undefined>) {
  const primeiro = ordem.find((o) => erros[o.campo])
  if (primeiro) document.getElementById(primeiro.id)?.focus()
}
