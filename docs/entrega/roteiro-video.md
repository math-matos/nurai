# Roteiro do vídeo — Fase 7 (até 7 minutos)

O vídeo precisa mostrar o **sistema real em funcionamento**. Grave a tela em https://nurai-one.vercel.app, com o pitch (`pitch-nurai.pdf`) para as partes faladas.

**Antes de gravar**

- Abra https://nurai-one.vercel.app/api/health e confira que aparecem `"genai":"oci"` e `"db":"oracle"`.
- Deixe à mão o PDF `e2e/fixtures/documentos/01-hemograma-2026-03-10.pdf` e uma janela anônima.
- Grave em 1080p, com o navegador em tela cheia e zoom de 110% a 125%.
- Faça um ensaio cronometrado. Se passar de 7 minutos, corte nas partes faladas, não na demonstração.

| Tempo | Quem fala | Tela | O que dizer |
|---|---|---|---|
| 0:00–0:30 | Integrante 1 | Slide 1 (capa) | Quem somos e a frase: "a Nurai é o histórico de saúde que fica com você e chega pronto à consulta". |
| 0:30–1:15 | Integrante 1 | Slide 2 (problema) | 52% dos adultos têm doença crônica (IBGE). O histórico fica espalhado, e o resultado é exame refeito e consulta sem informação. Ler uma das falas dos participantes. |
| 1:15–1:45 | Integrante 2 | Slide 3 (solução) | Os quatro passos: reúne, lê com IA, aponta o que falta e prepara a consulta. O paciente é o dono do dado. |
| 1:45–4:15 | Integrante 2 | **App ao vivo** | Demonstração, abaixo. |
| 4:15–4:45 | Integrante 3 | Slide 6 (validação) | 3 usuários e 1 médico, 14 de 15 tarefas concluídas, 7 ajustes. Citar um ajuste, por exemplo a exportação levada para o topo. |
| 4:45–5:15 | Integrante 3 | Slides 7 e 8 (mercado e modelo) | Público prioritário e cuidador; Grátis, Plus a R$ 14,90 e B2B2C a R$ 4 por vida. A Nurai não vende dado. |
| 5:15–5:45 | Integrante 4 | Slide 9 (tecnologia) | Autonomous Database, OCI Generative AI e Document Understanding. Toda frase da IA cita um registro. |
| 5:45–6:30 | Integrante 4 | Slides 10, 11 e 12 | Diferencial, aquisição (médico como canal, cuidadores, piloto B2B2C) e equilíbrio em 2029 com R$ 1,2 milhão. |
| 6:30–7:00 | Integrante 5 | Slide 13 (time) | O time e o convite: "experimente em nurai-one.vercel.app". |

## Demonstração (2 minutos e 30 segundos)

1. **Entrar (10 s).** Página inicial → **Abrir a demonstração**. Mostrar no topo os selos "IA: OCI Generative AI" e "Dados: Oracle DB".
2. **Linha do tempo (25 s).** 24 registros de SUS, laboratório, hospital, clínica, operadora e papel. Mostrar o aviso "Ponto de atenção" no topo e abrir um registro.
3. **Anexar laudo (40 s).** **Fontes e anexos** → enviar `01-hemograma-2026-03-10.pdf`. Mostrar os valores lidos, a confiança e o aviso "Ainda não foi salvo". Marcar a confirmação de identidade, salvar e mostrar "foi salvo no histórico".
4. **Copiloto (30 s).** Perguntar "Ficou alguma coisa pendente?" e clicar numa citação de "De onde veio".
5. **Próximos passos (15 s).** Mostrar o ultrassom de carótidas pedido de novo 42 dias depois.
6. **Médico (30 s).** **Resumo para consulta** → **Gerar acesso temporário** → copiar o código. Na janela anônima: "Sou profissional de saúde — tenho um código". Mostrar "somente leitura · expira em…" e os pontos em aberto. Voltar e **Revogar acesso**: a tela do médico se fecha.

Se a IA demorar ao vivo, corte a espera na edição. Não troque pela versão simulada: o vídeo precisa mostrar o sistema real.
