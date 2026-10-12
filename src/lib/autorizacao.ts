/* LGPD: os dados de saúde são de outra pessoa, e quem cuida declara que pode tratá-los.
   Texto neutro de gênero: repete o nome em vez de "dele(a)". */
export function textoDeclaracao(nomePaciente: string) {
  const nome = nomePaciente.trim()
  return nome
    ? `Declaro que sou responsável por ${nome} ou tenho autorização para organizar os dados de saúde de ${nome} nesta conta.`
    : 'Declaro que sou responsável por essa pessoa ou tenho autorização para organizar os dados de saúde dela nesta conta.'
}

/* Mesmo texto que o servidor devolve no campo `autorizacao` quando a declaração falta. */
export const ERRO_AUTORIZACAO = 'Confirme que você tem autorização para organizar os dados de saúde dessa pessoa'
