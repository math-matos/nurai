# Roteiro do vídeo · Fase 7 (até 7 minutos)

O vídeo intercala o pitch (`pitch-nurai.pdf`) com a demonstração do sistema real em https://nurai-one.vercel.app, gravada pela tela.

**Preparação**

- Abrir https://nurai-one.vercel.app/api/health e confirmar que aparecem `"genai":"oci"` e `"db":"oracle"`.
- Deixar aberto o PDF de teste `01-hemograma-2026-03-10.pdf` (pasta `e2e/fixtures/documentos/` do código-fonte) e uma janela anônima.
- Gravar em 1080p, com o navegador em tela cheia e zoom entre 110% e 125%.
- Fazer um ensaio cronometrado. Se passar de 7 minutos, encurtar as partes faladas e manter a demonstração inteira.

| Tempo | Quem fala | Tela | Conteúdo |
|---|---|---|---|
| 0:00–0:30 | Integrante 1 | Slide 1 (capa) | Apresentação do grupo e a frase: "a Nurai é o histórico de saúde que fica com você e chega pronto à consulta". |
| 0:30–1:15 | Integrante 1 | Slide 2 (problema) | 52% dos adultos têm doença crônica (IBGE). O histórico fica espalhado, e o resultado é exame refeito e consulta sem informação. Leitura de uma das falas dos participantes. |
| 1:15–1:45 | Integrante 2 | Slide 3 (solução) | Os quatro passos: reunir, ler com IA, apontar o que falta e preparar a consulta. O paciente é o dono do dado. |
| 1:45–4:15 | Integrante 2 | **App ao vivo** | Demonstração, descrita abaixo. |
| 4:15–4:45 | Integrante 3 | Slide 6 (validação) | 3 usuários e 1 médico, 14 de 15 tarefas concluídas, 7 ajustes. Exemplo de ajuste: a exportação levada para o topo da tela. |
| 4:45–5:15 | Integrante 3 | Slides 7 e 8 (mercado e modelo) | Público prioritário e cuidador; planos Grátis, Plus a R$ 14,90 e B2B2C a R$ 4 por vida. A Nurai não vende dados. |
| 5:15–5:45 | Integrante 4 | Slide 9 (tecnologia) | Autonomous Database, OCI Generative AI e Document Understanding. Toda resposta da IA cita um registro do histórico. |
| 5:45–6:30 | Integrante 4 | Slides 10, 11 e 12 | Diferencial, aquisição (médico como canal, cuidadores, piloto B2B2C) e equilíbrio financeiro em 2029, com captação de R$ 1,2 milhão. |
| 6:30–7:00 | Integrante 5 | Slide 13 (time) | O time e o convite: "experimente em nurai-one.vercel.app". |

## Demonstração (2 minutos e 30 segundos)

1. **Entrada (10 s).** Página inicial → **Abrir a demonstração**. Mostrar no topo os selos "IA: OCI Generative AI" e "Dados: Oracle DB".
2. **Linha do tempo (25 s).** 24 registros de SUS, laboratório, hospital, clínica, operadora e papel. Mostrar o aviso "Ponto de atenção" no topo e abrir um registro.
3. **Anexar laudo (40 s).** **Fontes e anexos** → enviar `01-hemograma-2026-03-10.pdf`. Mostrar os valores lidos, a confiança e o aviso "Ainda não foi salvo". Marcar a confirmação de identidade, salvar e mostrar a mensagem "foi salvo no histórico".
4. **Copiloto (30 s).** Perguntar "Ficou alguma coisa pendente?" e clicar numa citação de "De onde veio".
5. **Próximos passos (15 s).** Mostrar o ultrassom de carótidas pedido de novo 42 dias depois.
6. **Médico (30 s).** **Resumo para consulta** → **Gerar acesso temporário** → copiar o código. Na janela anônima, clicar em "Sou profissional de saúde — tenho um código" e digitar o código. Mostrar "somente leitura · expira em…" e os pontos em aberto. Voltar e clicar em **Revogar acesso**: a tela do médico se fecha.

Se a resposta da IA demorar durante a gravação, a espera pode ser cortada na edição. A demonstração usa sempre o sistema real, e não a versão simulada.
