/* Motor de respostas do copiloto — determinístico, sobre os eventos do histórico.
   No MVP a "IA" é uma correspondência de intenção com resposta ancorada em eventos
   reais do acervo. O contrato de produto é o que importa aqui: nenhuma frase é dita
   sem os registros que a sustentam, e nenhuma conduta é decidida no lugar do médico. */

export interface Resposta {
  texto: string[]
  ancoras: string[]
  serie?: { nome: string; unidade: string; pontos: { data: string; valor: number }[] }
  aviso?: string
}

interface Intencao {
  chaves: string[]
  resposta: Resposta
}

export const SUGESTOES = [
  'Tem algum exame que eu não preciso repetir?',
  'Como minha glicada evoluiu desde o diagnóstico?',
  'O que já aconteceu com meu coração?',
  'Quais remédios eu tomo e quem receitou cada um?',
  'Ficou alguma coisa pendente no meu acompanhamento?',
  'Prepare um resumo para a cardiologista',
]

const INTENCOES: Intencao[] = [
  {
    chaves: ['repetir', 'repetido', 'duplicado', 'duplicidade', 'de novo', 'já fiz', 'nao preciso', 'não preciso', 'evitar exame'],
    resposta: {
      texto: [
        'Sim — o ultrassom de carótidas. Ele foi solicitado na UBS Vila Mariana em 08/07/2026, mas você já tinha feito o mesmo exame em 27/05/2026 no Instituto de Imagem Anhangá, seis semanas antes.',
        'O laudo de maio está no seu histórico e mostra espessamento médio-intimal difuso sem placas com repercussão hemodinâmica. Levá-lo à UBS costuma ser suficiente para a solicitação ser reavaliada — quem decide isso é a equipe que atende você.',
      ],
      ancoras: ['e22', 'e24'],
      aviso: 'Não cancele um exame por conta própria: leve o laudo e confirme com quem pediu.',
    },
  },
  {
    chaves: ['glicada', 'hba1c', 'diabetes', 'açúcar', 'acucar', 'glicemia'],
    resposta: {
      texto: [
        'Sua hemoglobina glicada tem cinco medições registradas em três instituições diferentes — duas na rede pública e três no Laboratório Vetor. Ela caiu de 7,8% em 2019 para 6,9% em 2024, subiu para 7,4% em 2025 e está em 7,2% na última medição, de 05/03/2026.',
        'Nenhuma dessas medições está dentro da faixa de referência de laboratório (4% a 5,7%), mas o alvo terapêutico de uma pessoa com diabetes é definido pelo médico e costuma ser diferente da faixa da folha de exame.',
      ],
      ancoras: ['e02', 'e11', 'e12', 'e18', 'e21'],
      serie: {
        nome: 'Hemoglobina glicada (HbA1c)', unidade: '%',
        pontos: [
          { data: '04/2019', valor: 7.8 }, { data: '08/2023', valor: 7.1 },
          { data: '03/2024', valor: 6.9 }, { data: '09/2025', valor: 7.4 },
          { data: '03/2026', valor: 7.2 },
        ],
      },
    },
  },
  {
    chaves: ['coração', 'coracao', 'fibrilação', 'fibrilacao', 'arritmia', 'holter', 'cardio', 'palpitação', 'palpitacao'],
    resposta: {
      texto: [
        'A história cardíaca começa em 27/01/2023, com uma ida ao pronto-socorro do Hospital Santa Clemência por palpitação e tontura. O eletrocardiograma mostrou fibrilação atrial, que reverteu sozinha em 6 horas.',
        'O Holter feito em 03/02/2023 confirmou fibrilação atrial paroxística ocupando 4,1% do registro. Em 15/02/2023 a cardiologia iniciou rivaroxabana 20 mg. O ecocardiograma de 2024 mostrou função de bombeamento preservada, com átrio esquerdo levemente aumentado.',
        'O ponto novo é o Holter de 12/06/2026, que você fotografou em papel: a carga de fibrilação subiu para 6,3%. Esse dado ainda não passou pela cardiologista — ele entrou pelo seu celular, não pela clínica.',
      ],
      ancoras: ['e08', 'e09', 'e10', 'e13', 'e23'],
      serie: {
        nome: 'Carga de fibrilação atrial', unidade: '% do tempo',
        pontos: [{ data: '02/2023', valor: 4.1 }, { data: '06/2026', valor: 6.3 }],
      },
    },
  },
  {
    chaves: ['remédio', 'remedio', 'medicamento', 'medicação', 'medicacao', 'receita', 'tomo', 'prescri'],
    resposta: {
      texto: [
        'São cinco medicamentos de uso contínuo, receitados por três serviços que não conversam entre si: metformina 850 mg duas vezes ao dia e atorvastatina 20 mg à noite pela endocrinologia; rivaroxabana 20 mg ao dia pela cardiologia; levotiroxina 50 mcg em jejum, também da endocrinologia; e losartana 50 mg ao dia pela clínica médica da UBS.',
        'Duas observações que valem levar à consulta: a rivaroxabana é anticoagulante, então qualquer anti-inflamatório comprado sem receita precisa ser conversado antes; e a levotiroxina foi iniciada em 2025 com pedido de reavaliação em 8 semanas que nunca apareceu no histórico.',
      ],
      ancoras: ['e05', 'e07', 'e10', 'e16'],
      aviso: 'Verificação de interação medicamentosa é atribuição do médico ou do farmacêutico. Aqui só reunimos o que está prescrito.',
    },
  },
  {
    chaves: ['rim', 'renal', 'creatinina', 'filtração', 'filtracao', 'albuminúria', 'albuminuria', 'nefro'],
    resposta: {
      texto: [
        'Há um movimento lento e consistente: a taxa de filtração glomerular era 74 mL/min em 08/2023, e está em 68 mL/min na medição de 03/2026. No meio disso, o exame da UBS de 14/09/2025 mostrou albuminúria de 42 mg/g, acima do limite de 30.',
        'Os três resultados vieram de duas fontes diferentes e nunca apareceram juntos na mesma tela para nenhum dos médicos que atendem você. É o tipo de padrão que só fica visível quando o histórico está reunido.',
      ],
      ancoras: ['e11', 'e18', 'e21'],
      serie: {
        nome: 'Taxa de filtração glomerular', unidade: 'mL/min',
        pontos: [{ data: '08/2023', valor: 74 }, { data: '03/2026', valor: 68 }],
      },
    },
  },
  {
    chaves: ['tireoide', 'tsh', 'levotiroxina', 'hipotireoidismo'],
    resposta: {
      texto: [
        'O TSH apareceu alterado uma única vez, em 22/01/2025: 6,8 mUI/L, com faixa de referência de 0,4 a 4,0. A endocrinologia iniciou levotiroxina 50 mcg em 10/02/2025 e pediu reavaliação em 8 semanas.',
        'Essa reavaliação não existe em nenhuma das quatro fontes conectadas. Foi por isso que ela entrou na sua lista de próximos passos.',
      ],
      ancoras: ['e15', 'e16'],
    },
  },
  {
    chaves: ['pendente', 'falta', 'esqueci', 'atrasado', 'devendo', 'próximos passos', 'proximos passos'],
    resposta: {
      texto: [
        'Encontrei quatro pontas soltas. A reavaliação de TSH pedida em fevereiro de 2025 nunca foi feita. O mapeamento de retina tinha recomendação de retorno anual e a última avaliação foi em novembro de 2024 — 21 meses atrás. O Holter de junho de 2026 ainda não foi visto pela cardiologia. E há um ultrassom de carótidas marcado que repete um exame de maio.',
        'Nenhuma dessas pontas é culpa de um profissional isolado: cada um viu só o pedaço do histórico que estava no seu próprio sistema.',
      ],
      ancoras: ['e14', 'e16', 'e22', 'e23', 'e24'],
    },
  },
  {
    chaves: ['resumo', 'consulta', 'cardiologista', 'levar para o médico', 'preparar'],
    resposta: {
      texto: [
        'Montei o resumo para a cardiologia com o que mudou desde o retorno de 18/02/2026: o Holter de 12/06/2026 com carga de fibrilação em 6,3%, contra 4,1% em 2023; a filtração glomerular em 68 mL/min, relevante para a dose do anticoagulante; e o ultrassom de carótidas de 27/05/2026 com espessamento médio-intimal.',
        'A versão completa, com a lista de medicamentos e as alergias, está na aba Resumo para consulta — de lá dá para gerar um acesso temporário de 30 dias para a médica.',
      ],
      ancoras: ['e20', 'e21', 'e22', 'e23'],
    },
  },
  {
    chaves: ['alergia', 'alérgica', 'alergica', 'dipirona'],
    resposta: {
      texto: [
        'Há uma alergia registrada: dipirona, com quadro de urticária. Ela está marcada no seu perfil e aparece no topo de qualquer resumo compartilhado com um profissional.',
      ],
      ancoras: [],
    },
  },
  {
    chaves: ['olho', 'retina', 'oftalmo', 'vista', 'enxergar'],
    resposta: {
      texto: [
        'A avaliação de 05/11/2024, feita na rede credenciada da operadora, encontrou retinopatia diabética não proliferativa leve nos dois olhos, com recomendação de retorno anual. Esse retorno está 21 meses atrasado.',
      ],
      ancoras: ['e14'],
    },
  },
]

const FALLBACK: Resposta = {
  texto: [
    'Não encontrei essa informação nos 24 registros que estão conectados ao seu histórico — e prefiro dizer isso a inventar uma resposta.',
    'Posso ajudar com o que está aqui: evolução de exames, história cardíaca, rim, tireoide, medicamentos em uso, pendências do acompanhamento e resumo para consulta.',
  ],
  ancoras: [],
}

const normaliza = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function responder(pergunta: string): Resposta {
  const p = normaliza(pergunta)
  let melhor: { intencao: Intencao; pontos: number } | null = null
  for (const intencao of INTENCOES) {
    const pontos = intencao.chaves.reduce(
      (soma, chave) => (p.includes(normaliza(chave)) ? soma + 1 : soma), 0,
    )
    if (pontos > 0 && (!melhor || pontos > melhor.pontos)) melhor = { intencao, pontos }
  }
  return melhor ? melhor.intencao.resposta : FALLBACK
}
