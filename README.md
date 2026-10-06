# Nurai — MVP

Protótipo do Challenge STO 2026 (FIAP · ESOA4). Uma plataforma centrada no paciente que
reúne o histórico clínico disperso — rede pública, rede privada e papel — em uma linha do
tempo única, estrutura com IA o que estava solto e devolve esse contexto como próximo
passo de cuidado.

**Equipe:** Lúcia Boutti · Thiago Eiji · Murilo Mansano · Pedro Eugênio · Matheus Matos

> Paciente, instituições, exames e resultados são **fictícios**. Não envie dados reais de
> saúde: tudo que você anexa é gravado no banco da demonstração e lido pela IA.

## Arquitetura

```
 Navegador                    Vercel Function (api/)           Oracle Cloud
┌──────────────────┐  /api/*  ┌────────────────────────┐       ┌───────────────────────────────┐
│ React 19 + Vite  │ ───────▶ │ Hono (server/app.ts)   │ ────▶ │ OCI Generative AI             │
│ telas, store,    │          │ rotas de estado e IA,  │       │ Llama 3.3 70B · sa-saopaulo-1 │
│ conversa local   │ ◀─────── │ validação com zod      │       │                               │
└──────────────────┘   JSON   │                        │ ────▶ │ Oracle Autonomous Database    │
                              └────────────────────────┘       │ node-oracledb thin + wallet   │
                                                               └───────────────────────────────┘
```

- **Front** (`src/`): React 19 + TypeScript sobre Vite. Toda leitura e escrita do histórico
  passa por `/api` (`src/lib/api.ts`); só a conversa com o copiloto fica no `localStorage`.
- **API** (`server/`): app Hono montado em `server/app.ts`. Em produção roda como Vercel
  Function (`api/index.ts`); em dev, como servidor Node na porta 3001
  (`server/dev.ts`), com o Vite fazendo proxy de `/api`.
- **IA** (`server/ai/`): extração de documento, explicação de exame, copiloto ancorado,
  resumo pré-consulta e análise de pendências via OCI Generative AI. Sem as variáveis
  `OCI_*`, cai para um provider **mock** determinístico.
- **Banco** (`server/db/`): Oracle Autonomous Database via `node-oracledb` em modo thin,
  com mTLS pela wallet. Sem as variáveis `ORACLE_DB_*`, usa um repositório **em memória**.
- `GET /api/health` responde `{ ok, genai, db, versao }` — `genai` é `oci` ou `mock`, `db` é
  `oracle` ou `memoria`. A barra lateral do app mostra os mesmos dois selos.

## Rodar localmente

Requer Node.js 22+ e pnpm.

```bash
pnpm install
cp .env.example .env.local   # só nos modos 2 e 3
pnpm dev:all                 # Vite em :5173 + API em :3001
```

### Modo 1 — mock total (sem credenciais)

Não crie `.env.local` (ou deixe as variáveis vazias) e rode `pnpm dev:all`. A IA responde
com o mock e o histórico vive em memória: reiniciar a API volta ao estado original.
`/api/health` mostra `genai: mock`, `db: memoria`.

### Modo 2 — Oracle local via Docker

Sobe um Oracle Database Free (`gvenzl/oracle-free`) só para teste:

```bash
docker compose up -d oracle
```

No `.env.local`, preencha apenas o banco (sem wallet):

```bash
ORACLE_DB_USER=nurai
ORACLE_DB_PASSWORD=NuraiApp123
ORACLE_DB_CONNECT_STRING=localhost:1521/FREEPDB1
```

Depois:

```bash
pnpm db:setup     # cria o schema e aplica o seed (use --reset para re-semear)
pnpm dev:all
```

Com `ORACLE_DB_*` presentes, a API **não** cai para memória: se a conexão falhar, o
startup falha com a mensagem do driver.

### Modo 3 — OCI real

Siga [docs/setup-oci.md](docs/setup-oci.md) para criar a API key, a policy e o Autonomous
Database Always Free, e preencha no `.env.local` todas as variáveis de `.env.example`
(`OCI_*` e `ORACLE_DB_*`, com a wallet em base64). Então:

```bash
pnpm test:oci     # smoke real do GenAI e do banco
pnpm db:setup
pnpm dev:all
```

O Generative AI não faz parte do Always Free: as chamadas consomem crédito da conta.

## Scripts

| Script                          | O quê                                                        |
| ------------------------------- | ------------------------------------------------------------ |
| `pnpm dev:all`                  | Front (Vite) e API (tsx watch) em paralelo                   |
| `pnpm dev:web` / `pnpm dev:api` | Só o front / só a API                                        |
| `pnpm build`                    | Typecheck (`tsc -b`) + build do front                        |
| `pnpm lint`                     | ESLint                                                       |
| `pnpm test`                     | Testes (Vitest) da API, da IA e do banco em memória          |
| `pnpm smoke:genai`              | Chamada real ao OCI Generative AI, com tempos                |
| `pnpm smoke:db`                 | Conexão real ao Oracle, com tempos                           |
| `pnpm test:oci`                 | `smoke:genai` + `smoke:db`                                   |
| `pnpm db:setup`                 | Aplica `server/db/schema.sql` e o seed no Oracle configurado |

## Testes

```bash
pnpm test
```

Rodam sem credenciais: a IA usa o mock e o banco usa memória. Os testes do repositório
Oracle ficam desligados por padrão; para rodá-los contra o Oracle do Docker:

```bash
ORACLE_DB_TEST=1 ORACLE_DB_USER=nurai ORACLE_DB_PASSWORD=NuraiApp123 \
  ORACLE_DB_CONNECT_STRING=localhost:1521/FREEPDB1 pnpm test server/db
```

## Deploy na Vercel

O projeto usa o preset Vite para o front e publica `api/index.ts` como Function
(`maxDuration` de 60 s em `vercel.json`). Em **Settings → Environment Variables**,
cadastre as mesmas variáveis de `.env.example`:

- `OCI_TENANCY_OCID`, `OCI_USER_OCID`, `OCI_FINGERPRINT`, `OCI_PRIVATE_KEY`,
  `OCI_PRIVATE_KEY_PASSPHRASE` (opcional), `OCI_REGION` (`sa-saopaulo-1`),
  `OCI_COMPARTMENT_OCID`, `OCI_GENAI_MODEL_ID`, `OCI_GENAI_ENDPOINT` (opcional);
- `ORACLE_DB_USER`, `ORACLE_DB_PASSWORD`, `ORACLE_DB_CONNECT_STRING`,
  `ORACLE_DB_WALLET_PEM_BASE64`, `ORACLE_DB_WALLET_PASSWORD`.

Rode `pnpm db:setup` uma vez contra o Autonomous DB antes do primeiro deploy. Depois,
confira `https://<seu-deploy>/api/health`: deve responder `genai: oci` e `db: oracle`.
Detalhes e troubleshooting em [docs/setup-oci.md](docs/setup-oci.md).

## O que existe

| Rota                | O quê                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `#/`                | Landing: o problema, os quatro movimentos do produto e o diferencial                             |
| `#/projeto`         | Dossiê da fase: Partes 1 a 4, com persona, instrumento de validação, corte do MVP e arquitetura  |
| `#/app/linha`       | Linha do tempo unificada — 24 registros de 6 fontes, busca, filtros, detalhe e explicação com IA |
| `#/app/fontes`      | Conectar fontes e enviar documento (PDF ou texto colado), com extração por IA e conferência      |
| `#/app/copiloto`    | Copiloto ancorado: toda resposta cita os registros que a sustentam                               |
| `#/app/cuidado`     | Pendências, reanálise do histórico com IA, centros de referência e ensaios clínicos              |
| `#/app/resumo`      | Resumo pré-consulta por especialidade, com síntese por IA, imprimível e compartilhável           |
| `#/app/privacidade` | Consentimento por instituição, revogável, e registro de acessos                                  |

## Roteiro de demonstração (3 minutos)

1. **Landing** — a espinha à direita mostra fragmentos de seis fontes assentando na mesma
   linha. Clique em "Abrir a demonstração" e confira os selos de IA e banco na barra lateral.
2. **Linha do tempo** — filtre por "SUS" e depois por "Papel": o mesmo histórico, fontes que
   nunca se falaram. Abra _Ultrassom Doppler de carótidas_ (27 mai 2026) e clique em
   "Explicar em linguagem simples".
3. **Copiloto** — clique na sugestão "Tem algum exame que eu não preciso repetir?". A
   resposta aponta a duplicidade e cita os registros que a provam; clique em uma âncora para
   voltar à linha.
4. **Fontes e anexos** — "Carregar exemplo" e depois "Ler texto com IA" (ou "Escolher PDF"):
   o laudo vira valores com faixa de referência, e só entra no histórico depois da sua
   conferência em "Salvar no histórico".
5. **Próximos passos** — "Reanalisar meu histórico": a IA cruza o histórico atual e
   aponta as pendências que nenhum médico isolado enxergava.
6. **Resumo para consulta** — em Cardiologia, "Gerar resumo com IA" e depois "Gerar acesso
   temporário" para a cardiologista.
7. **Acessos e consentimento** — revogue uma permissão e veja o registro de auditoria crescer.

"Reiniciar a demonstração", na barra lateral, restaura o histórico original no servidor.

## Limites

- PDF de até **4 MB** e com **texto selecionável**. Foto ou digitalização não é lida por
  OCR: cole o texto do documento no campo de texto.
- Não é dispositivo médico, não emite diagnóstico e não substitui avaliação profissional.
- Sem autenticação: o MVP atende uma única titular fictícia, e toda ação é atribuída a ela.
- As integrações com RNDS, laboratórios e hospitais (botão "Conectar") são **simuladas**.

## Estrutura

```
src/
  data/        modelo de domínio, acervo sintético e motor determinístico do copiloto
  lib/         roteador, cliente da API, store, formatação
  components/  ícones, marca, régua de faixa de referência, série temporal
  routes/      landing, dossiê e as telas do produto
  styles/      tokens em index.css + uma folha por superfície
server/
  app.ts       app Hono (estado, eventos, consentimentos, compartilhamentos, acessos)
  routes/      rotas de IA (/copiloto, /extrair, /exames/:id/explicar, /resumo, /passos/gerar)
  ai/          provider OCI e mock, prompts, extração de PDF
  db/          repositório Oracle e em memória, schema e conexão
  scripts/     smoke tests e db:setup
api/           entrypoint da Vercel Function
```

Decisões visuais em [DESIGN.md](DESIGN.md); verdade do produto em [PRODUCT.md](PRODUCT.md).
