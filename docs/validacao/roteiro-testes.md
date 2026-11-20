# Roteiro de testes — Fase 7

Dois roteiros:

1. **Conferência da aplicação**: a equipe confere que o fluxo principal funciona antes das sessões.
2. **Testes com o público-alvo e entrevista com médico**: o que a Parte 2 da Fase 7 pede (pelo menos 3 usuários do público-alvo).

Paciente, instituições e resultados da demonstração são fictícios. **Ninguém informa dados reais de saúde** durante os testes.

---

## 1. Conferência da aplicação (cerca de 15 minutos)

Suba com `pnpm dev:all` e abra `http://localhost:5173`. Clique em **"Abrir a demonstração"**.

Os PDFs citados estão em `e2e/fixtures/documentos/`.

| # | Onde (menu lateral) | O que fazer | O que deve acontecer |
|---|---|---|---|
| 1 | Linha do tempo | Olhar a lista | 24 registros de fontes diferentes |
| 2 | Fontes e anexos | **Escolher PDF** → `01-hemograma-2026-03-10.pdf` | Abre a conferência com os valores lidos. Ao salvar, o registro aparece na linha do tempo. |
| 3 | Fontes e anexos | Enviar `11-escaneado-sem-texto.pdf` | Mensagem de PDF sem texto (com o OCR desligado; ver `docs/setup-oci.md`, seção 10) |
| 4 | Perguntar ao Copiloto | "Ficou alguma coisa pendente?" | A resposta cita registros; clicar numa citação abre o registro |
| 5 | Próximos passos | Ver as pendências | Aparece o exame repetido (perfil lipídico) |
| 6 | Resumo para consulta | **Gerar acesso temporário** e anotar o código | Aparece um código de 6 caracteres |
| 7 | Janela anônima | Página inicial → "Sou profissional de saúde — tenho um código" e digitar o código | O médico vê o histórico e os pontos em aberto |
| 8 | Resumo para consulta | Revogar o código e voltar à janela anônima | A tela do médico se fecha |
| 9 | Acessos e consentimento | Rolar até **"Baixar meu histórico"** → **"Baixar arquivo JSON"** | O arquivo baixa e o Registro de acessos mostra "Exportou o histórico" |

Com `OCI_*` e `ORACLE_DB_*` configurados, cada ação de IA consome crédito da OCI e a conta de demonstração fica no Oracle (é apagada sozinha 24 h depois de a sessão vencer). Para conferir o modo: `http://localhost:3001/api/health`.

Se um passo falhar, anote o número do passo e a mensagem de erro.

---

## 2. Testes com o público-alvo e entrevista com médico

### Quem recrutar

- **3 pessoas do público-alvo**: adultos com doença crônica (diabetes, hipertensão, cardiopatia) que consultam mais de um especialista, **ou** quem cuida dos exames de alguém assim. Não podem ser familiares de integrantes da equipe.
- **1 médico ou médica**: de preferência clínico geral ou especialista que atenda pacientes crônicos.

### Antes de cada sessão

- Reservar 30 minutos (20 para o médico), pessoalmente ou em chamada com compartilhamento de tela.
- Usar o computador ou celular **de quem conduz**, com a demonstração aberta. Assim a pessoa não precisa dos arquivos de teste.
- Explicar que os dados são fictícios e pedir que a pessoa **não** informe dados reais de saúde.
- Pedir permissão para anotar, sem nome: usar os códigos **U1, U2, U3** (usuários) e **M1** (médico).
- Ter um cronômetro.
- Uma pessoa conduz e outra anota, se possível.

### Sessão com cada usuário (30 minutos)

**1. Contexto (5 min)**

- "Como você guarda seus exames hoje?"
- "Já teve que refazer algum exame, ou chegou a uma consulta sem um resultado?"

**2. Tarefas no app (15 min)**

Ler uma tarefa por vez. **Não ajudar.** Cronometrar. Pedir que a pessoa pense em voz alta.

| Tarefa | O que dizer |
|---|---|
| T1 | "Encontre um exame que foi feito duas vezes sem necessidade." |
| T2 | "Anexe este laudo ao histórico." (usar `01-hemograma-2026-03-10.pdf`) |
| T3 | "Pergunte ao app se ficou alguma coisa pendente." |
| T4 | "Libere o seu histórico para um médico ver." |
| T5 | "Baixe uma cópia do seu histórico." |

Para cada tarefa, anotar: conseguiu **sozinha**, **com ajuda** ou **não conseguiu**; o tempo; onde travou; o que falou em voz alta.

**3. Perguntas finais (10 min)**

- "O que foi mais confuso?"
- "Você confiaria nas respostas da IA? Dê uma nota de 1 a 5."
- "Você autorizaria o app a buscar seus exames direto no laboratório e no SUS? Por quê?"
- "Você usaria isso? Pagaria? Quanto?"

### Entrevista com o médico (20 minutos)

1. Mostrar a tela do médico pelo código (passos 6 e 7 da seção 1) e o resumo pré-consulta.
2. Perguntar:
   - "Isso cabe no tempo da sua consulta?"
   - "O que você leria primeiro?"
   - "O que falta ou sobra?"
   - "Confiaria nos pontos em aberto?"
   - "Usaria antes da consulta?"

---

## 3. Modelos de anotação

Preencher logo depois de cada sessão, enquanto a memória está fresca. Copiar as **frases literais**, não resumos.

### Usuário (U1, U2, U3)

```
Código: U_   Data:          Duração:          Conduziu:
Perfil: idade, condição ou papel (paciente/cuidador), nº de especialistas, como guarda os exames hoje

T1 exame repetido:    sozinha / com ajuda / não   tempo:      onde travou:
T2 anexar laudo:      sozinha / com ajuda / não   tempo:      onde travou:
T3 copiloto:          sozinha / com ajuda / não   tempo:      onde travou:
T4 liberar ao médico: sozinha / com ajuda / não   tempo:      onde travou:
T5 baixar histórico:  sozinha / com ajuda / não   tempo:      onde travou:

Frases literais:
-
-

Confiança na IA (1-5):
Autorizaria buscar exames no laboratório/SUS? (sim / não / depende — por quê):
Usaria? Pagaria? Quanto?
Maior dificuldade:
```

### Médico (M1)

```
Código: M1   Data:          Duração:          Conduziu:
Especialidade e tempo médio de consulta:

Cabe no tempo da consulta?
O que leria primeiro?
O que falta ou sobra?
Confiaria nos pontos em aberto?
Usaria antes da consulta?

Frases literais:
-
-
```

---

## 4. Depois das sessões

Com as 4 anotações em mãos:

1. Preencher a tabela "Onde registrar os aprendizados" e o registro de dificuldades na página do projeto (`src/routes/Projeto.tsx`, Parte 2).
2. Corrigir no app o que as pessoas travaram, quando for viável, e registrar o ajuste e o commit na mesma tabela.
3. Reescrever a análise "O MVP resolve o problema identificado?" com os dados reais.

Não inventar números: o que não foi medido fica como "não testado".
