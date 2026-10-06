export const SUGESTOES = [
  'Tem algum exame que eu não preciso repetir?',
  'Como minha glicada evoluiu desde o diagnóstico?',
  'O que já aconteceu com meu coração?',
  'Quais remédios eu tomo e quem receitou cada um?',
  'Ficou alguma coisa pendente no meu acompanhamento?',
  'Prepare um resumo para a cardiologista',
]

/* Conta de cuidador: as mesmas perguntas, sobre o paciente e não sobre quem digita. */
export function sugestoesPara(nome: string | null) {
  if (!nome) return SUGESTOES
  return [
    `Tem algum exame que ${nome} não precisa repetir?`,
    `Como a glicada de ${nome} evoluiu desde o diagnóstico?`,
    `O que já aconteceu com o coração de ${nome}?`,
    `Quais remédios ${nome} toma e quem receitou cada um?`,
    `Ficou alguma coisa pendente no acompanhamento de ${nome}?`,
    'Prepare um resumo para a cardiologista',
  ]
}
