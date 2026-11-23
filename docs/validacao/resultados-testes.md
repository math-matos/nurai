# Resultados dos testes · Fase 7

Transcrição anonimizada das fichas preenchidas pelo grupo durante as sessões, seguindo o [roteiro de testes](roteiro-testes.md). Os nomes dos participantes foram substituídos por códigos.

- **Aplicação testada:** https://nurai-one.vercel.app (demonstração com dados fictícios)
- **Data das sessões:** 21/11/2026
- **Condução:** integrantes do grupo

Os participantes, incluindo o médico (M1), são pessoas reais. O histórico mostrado no app é o da demonstração, com dados fictícios.

## 1. Participantes

| Código | Perfil | Cenário e familiaridade digital | Vínculo com o grupo |
|---|---|---|---|
| U1 | 58 anos; paciente com hipertensão e diabetes | 3 especialistas; guarda laudos em papel e no WhatsApp; baixa familiaridade | familiar de integrante |
| U2 | 42 anos; cuida da mãe, que tem condições crônicas | 2 especialistas (da mãe); organiza PDFs em pastas no celular e no computador; alta familiaridade | conhecido |
| U3 | 35 anos; paciente com hipertensão | 2 especialistas; exames entre e-mail, aplicativo do laboratório e capturas de tela; familiaridade intermediária | conhecida |
| M1 | 45 anos; clínico geral | consultas de cerca de 20 minutos; acompanha pacientes crônicos | não informado |

## 2. Tarefas

| Tarefa | U1 | U2 | U3 |
|---|---|---|---|
| T1 · exame repetido | com ajuda, 2min40s | sozinho, 45s | sozinha, 1min15s |
| T2 · anexar laudo | com ajuda, 3min10s | sozinho, 1min20s | sozinha, 1min50s |
| T3 · copiloto | sozinha, 1min30s | sozinho, 40s | sozinha, 55s |
| T4 · liberar ao médico | com ajuda, 3min00s | sozinho, 1min10s | com ajuda, 2min00s |
| T5 · baixar histórico | **não conseguiu**, 4min00s | sozinho, 50s | sozinha, 1min30s |

**Onde travaram:**

- **U1:**
  - T1: procurou na linha do tempo; não identificou "Próximos passos" sem orientação.
  - T2: encontrou "Fontes e anexos", mas não percebeu de imediato a etapa de conferência.
  - T3: sem bloqueio; clicou em uma citação depois de explorar.
  - T4: gerou o código, mas ficou insegura sobre como compartilhá-lo e por quanto tempo vale.
  - T5: não encontrou a opção, no fim da área de consentimento, no tempo reservado.
- **U2:**
  - T1: foi direto a "Próximos passos".
  - T2: concluiu; sugeriu mostrar melhor o indicador de salvamento.
  - T3: conferiu a referência.
  - T4: entendeu o acesso temporário.
  - T5: concluiu o download.
- **U3:**
  - T1: olhou primeiro a linha do tempo e depois achou o alerta.
  - T2: hesitou ao revisar os campos extraídos.
  - T3: questionou o significado da pendência.
  - T4: não soube se o médico poderia editar os dados.
  - T5: achou a exportação depois de rolar a tela.

## 3. Falas literais

**U1**
- "Tem muito exame aqui. Onde é que ele avisa o repetido?"
- "Eu já mandei o arquivo ou ainda tenho que confirmar?"
- "Gostei que ele mostra de onde tirou isso."
- "Esse número pode ficar com qualquer pessoa?"
- "Achei que baixar ficava junto dos exames."

**U2**
- "Ótimo, ele sinalizou o perfil lipídico repetido."
- "Daria para deixar mais visível que o laudo já foi salvo."
- "A citação ajuda a conferir o que ele está dizendo."
- "Seria útil copiar o código com um botão destacado."
- "O JSON é bom para exportar, mas não é fácil para a maioria das pessoas."

**U3**
- "Legal ele juntar os registros e avisar do que repetiu."
- "Eu teria que conferir todos os números que ele leu?"
- "Isso é uma sugestão ou é algo que meu médico já pediu?"
- "O médico vai só ver ou consegue mudar meu histórico?"
- "Seria melhor se tivesse um PDF para eu ler."

**M1**
- "Se eu identificar o exame, a data e a fonte em poucos segundos, já ajuda."
- "O copiloto não pode transformar hipótese em diagnóstico."
- "O acesso temporário é uma boa ideia, desde que eu veja claramente quando expira."

## 4. Perguntas finais

| | U1 | U2 | U3 |
|---|---|---|---|
| Contexto: como guarda os exames hoje | "Guardo os resultados numa pasta de papel; às vezes minha filha fotografa e me manda." | "Organizo os PDFs da minha mãe em pastas e mando o que o médico pede." | "Procuro os exames no e-mail ou no aplicativo do laboratório quando preciso." |
| Contexto: refez exame ou faltou resultado | "Já levei um resultado antigo por engano e precisei pedir outro exame." | "Ela já repetiu um exame porque o resultado anterior não estava à mão." | "Já cheguei sem um exame porque não lembrava em qual laboratório tinha feito." |
| Mais confuso | onde fica "Baixar meu histórico"; o que significa a confirmação ao anexar | a diferença entre exportar JSON e ter um resumo legível | o que é recomendação da IA e o que é informação do registro |
| Confiança na IA (1–5) | 3 | 5 | 4 |
| Busca no laboratório e no SUS | depende: com autorização por instituição e explicação de quem acessa | sim, com consentimento específico, controle de acesso e revogação | depende: escolhendo as fontes, entendendo as permissões e podendo revogar |
| Usaria / pagaria | usaria com ajuda da filha; até R$ 15/mês se fosse simples | usaria; até R$ 20/mês | usaria a versão gratuita; R$ 10/mês por recursos extras |
| Maior dificuldade | achar a exportação; entender a validade do acesso temporário | o JSON não é amigável para leigos | permissões do médico e papel do copiloto |

## 5. Médico (M1)

Cenário apresentado: o resumo pré-consulta e a tela de acesso por código temporário. Duração: 20 minutos.

- **Cabe no tempo da consulta?** Sim, se o resumo for curto, com datas, fontes e alterações destacadas. Uma visualização longa exigiria triagem adicional.
- **O que leria primeiro?** Pendências relevantes, histórico recente, alterações em resultados e os documentos de origem.
- **O que falta ou sobra?** Falta um comparativo visual entre resultados e uma indicação clara de autoria e data. Sobra texto repetitivo quando a mesma informação aparece em várias seções.
- **Confiaria nos pontos em aberto?** Só como apoio de organização. Confirmaria nos laudos e com o paciente antes de qualquer conduta.
- **Usaria antes da consulta?** Sim, se o acesso fosse rápido, o material estivesse atualizado e houvesse consentimento do paciente.

## 6. Consolidação (U1–U3)

| Indicador | Resultado |
|---|---|
| Tarefas aplicadas | 15 (5 por participante) |
| Concluídas sem ajuda | 10 de 15 (66,7%) |
| Concluídas com ajuda | 4 de 15 (26,7%) |
| Não concluídas | 1 de 15 (6,7%), T5 por U1 |
| Confiança média na IA | 4,0 de 5 (3, 5 e 4) |
| Usariam o app | 3 de 3, com condições diferentes |

**Limitações:**
- A amostra é pequena.
- Os três participantes são do círculo próximo do grupo.
- As sessões usaram dados fictícios, não o histórico real de cada pessoa.
- Os tempos foram medidos por quem conduziu.

## 7. Ajustes feitos a partir dos testes

| Achado | Quem | Ajuste no app |
|---|---|---|
| Não achou a exportação no fim da página | U1 (não concluiu), U3 | "Baixar meu histórico" passou para o topo de Acessos e consentimento |
| O JSON não é legível; pediu um PDF | U2, U3 | Botão "Versão para ler ou imprimir", que leva ao resumo para consulta (salvável em PDF pela opção Imprimir) |
| Não achou o exame repetido sem saber de "Próximos passos" | U1 | A linha do tempo mostra no topo o ponto de atenção mais urgente, com atalho para Próximos passos |
| Não sabia se o laudo já tinha sido salvo | U1, U2 | Aviso "Ainda não foi salvo" na conferência e confirmação "foi salvo no histórico" na linha do tempo |
| Dúvida sobre a validade do código e quem pode usá-lo; queria copiar com destaque | U1, U2 | O cartão do código lista validade, quem pode usar, o que o profissional pode fazer e a revogação; "Copiar" virou o botão principal |
| Não sabia se o médico pode alterar o histórico | U3 | O cartão diz que o profissional só visualiza e não altera, anexa nem apaga nada |
| Não distinguia sugestão da IA de pedido médico | U3 (e M1) | As respostas do Copiloto e os Próximos passos indicam que são sugestão, não pedido nem diagnóstico; as citações aparecem como "De onde veio" |
| A expiração precisa estar à vista | M1 | A tela do profissional mostra a expiração no topo, o tempo todo |

**Próximos passos, sem ajuste nesta fase:**
- comparativo visual entre resultados (M1);
- menos texto repetido no resumo (M1);
- exportação direta em PDF (U3);
- escolha das fontes e permissões por instituição antes da busca automática (U1, U3).
