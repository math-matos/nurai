# Setup da Oracle Cloud (OCI) para o back-end do Nurai

Guia passo a passo para criar as credenciais que o back-end (Node/TypeScript na Vercel) precisa para:

1. chamar o **OCI Generative AI** (Chat, modelo `meta.llama-3.3-70b-instruct`) via SDK `oci-generativeaiinference`, autenticando com **API signing key**;
2. conectar num **Autonomous Database Always Free** via `node-oracledb` (thin mode) usando **mTLS com wallet**.

> Os nomes de menu do console da OCI mudam com frequência. Quando um nome não pôde ser confirmado na documentação oficial, o guia marca **(o nome do menu pode variar)**.

---

## 1. Visão geral

O que você vai criar:

| Recurso                                            | Para quê                         | Custo                    |
| -------------------------------------------------- | -------------------------------- | ------------------------ |
| API signing key (par de chaves RSA) no seu usuário | Autenticar o SDK OCI do back-end | Grátis                   |
| Compartment `nurai` (opcional)                     | Isolar os recursos do projeto    | Grátis                   |
| Policy de IAM (só se seu usuário não for admin)    | Permitir chamar o Generative AI  | Grátis                   |
| Autonomous Database Always Free                    | Banco do app                     | **Grátis** (Always Free) |
| Instance Wallet                                    | Certificados para a conexão mTLS | Grátis                   |
| Projeto na Vercel (plano Hobby)                    | Hospedar o back-end              | Grátis                   |

**Atenção ao custo do Generative AI:** o Generative AI **não faz parte do Always Free**. As chamadas on-demand consomem os créditos do trial (Free Trial). Quando os créditos ou o período de trial acabarem, o serviço para de funcionar a menos que a conta seja convertida para Pay As You Go. Teste com prompts curtos e acompanhe o consumo em **Billing & Cost Management** (o nome do menu pode variar).

Limites do Autonomous Database Always Free (doc oficial):

- até **2** bancos Always Free por tenancy, **20 GB** de storage cada, **30** sessões simultâneas;
- o banco é **parado automaticamente após 7 dias sem atividade** (dados preservados);
- um banco parado por **90 dias** (cumulativo) pode ser **excluído permanentemente**. Entre no console e dê _Start_ se ele parar.

Região: este guia assume a home region **Brazil East (São Paulo) — `sa-saopaulo-1`**. O Llama 3.3 70B está disponível on-demand nessa região.

Docs:

- [Always Free Autonomous AI Database](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/autonomous-always-free.html)
- [Meta Llama 3.3 (70B)](https://docs.oracle.com/en-us/iaas/Content/generative-ai/meta-llama-3-3-70b.htm)
- [Generative AI disponível em Brazil East (São Paulo)](https://docs.oracle.com/en-us/iaas/releasenotes/generative-ai/new-region-sao-paulo.htm)

---

## 2. API signing key (tenancy, user, fingerprint, region, private key)

1. No console da OCI, clique no ícone de **Profile** (avatar, canto superior direito) e escolha **User settings**. Em consoles mais novos a opção pode se chamar **My profile** (o nome do menu pode variar).
2. Na página do usuário, abra **API Keys**. Na doc ela fica em **Resources** (canto inferior esquerdo); em consoles mais novos pode estar numa aba como **Tokens and keys** (o nome do menu pode variar).
3. Clique em **Add API Key**.
4. Deixe selecionado **Generate API key pair** e clique em **Download Private Key**. Guarde o `.pem` fora do repositório (ex.: `~/.oci/nurai_api_key.pem`) e restrinja a permissão:
   ```bash
   mkdir -p ~/.oci
   mv ~/Downloads/*.pem ~/.oci/nurai_api_key.pem
   chmod go-rwx ~/.oci/nurai_api_key.pem
   ```
5. Clique em **Add**. O console mostra o **Configuration File Preview**, parecido com isto:
   ```ini
   [DEFAULT]
   user=ocid1.user.oc1..aaaa...
   fingerprint=12:34:56:...:ab
   tenancy=ocid1.tenancy.oc1..aaaa...
   region=sa-saopaulo-1
   key_file=<path to your private keyfile> # TODO
   ```
6. Copie esse texto. Se você usa a OCI CLI, pode colar em `~/.oci/config` e ajustar o `key_file`.

De onde vem cada variável:

| Env var                      | Origem                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `OCI_TENANCY_OCID`           | `tenancy=` do Configuration File Preview                                                             |
| `OCI_USER_OCID`              | `user=` do Configuration File Preview                                                                |
| `OCI_FINGERPRINT`            | `fingerprint=` do Configuration File Preview                                                         |
| `OCI_REGION`                 | `region=` (deve ser `sa-saopaulo-1`)                                                                 |
| `OCI_PRIVATE_KEY`            | conteúdo inteiro do `.pem` baixado (inclusive as linhas `-----BEGIN ...-----` e `-----END ...-----`) |
| `OCI_PRIVATE_KEY_PASSPHRASE` | opcional: só se a chave tiver passphrase. A chave gerada pelo console **não** tem, então deixe vazio |

> Perdeu o Configuration File Preview? Na lista de API Keys, abra o menu de ações da chave e escolha **View configuration file** (o nome do menu pode variar).

Docs:

- [Required Keys and OCIDs — How to Upload the Public Key](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm)

---

## 3. Compartment e policy

### 3.1 Compartment OCID

Você tem duas opções:

- **Usar o root compartment** (mais simples): o OCID do root compartment é o próprio OCID da tenancy. Nesse caso `OCI_COMPARTMENT_OCID` = `OCI_TENANCY_OCID`.
- **Criar o compartment `nurai`** (mais organizado):
  1. Menu de navegação → **Identity & Security** → **Compartments** (o nome do menu pode variar).
  2. **Create Compartment**, nome `nurai`, parent = root.
  3. Abra o compartment criado e copie o **OCID**.

| Env var                | Origem                                                           |
| ---------------------- | ---------------------------------------------------------------- |
| `OCI_COMPARTMENT_OCID` | OCID do compartment `nurai`, ou o OCID da tenancy se usar o root |

Use o **mesmo compartment** para criar o Autonomous Database (seção 5) e selecione-o no Playground (seção 4).

### 3.2 Policy (só se o seu usuário NÃO for administrador)

Quem criou a conta trial já está no grupo **Administrators** e **não precisa** de policy. Se outro integrante do grupo usar um usuário próprio, sem permissão de administrador, crie um grupo (ex.: `NuraiDevs`), adicione o usuário a ele e crie uma policy em **Identity & Security → Policies → Create Policy** (o nome do menu pode variar).

Permissão mínima para chamar o Chat (documentada pela Oracle — o verbo `use` em `generative-ai-chat` libera `POST Chat`):

```
allow group NuraiDevs to use generative-ai-chat in compartment nurai
```

Acesso completo ao Generative AI no compartment (útil para usar o Playground e listar modelos; a Oracle recomenda dar isso só a admins ou grupos de sandbox):

```
allow group NuraiDevs to manage generative-ai-family in compartment nurai
```

Notas:

- Se usar o root compartment, troque `in compartment nurai` por `in tenancy`.
- Em tenancies com **Identity Domains**, um grupo fora do domínio `Default` precisa ser referenciado com o nome do domínio, ex.: `allow group 'MeuDominio'/'NuraiDevs' to ...` (verifique na doc de policies do seu domínio).
- Não foi confirmado na doc qual permissão mínima exata o **Playground** exige além de `generative-ai-chat`. Se o Playground der erro de permissão com a policy mínima, use a policy `generative-ai-family`.

Docs:

- [Getting Access to Generative AI (IAM policies)](https://docs.oracle.com/en-us/iaas/Content/generative-ai/iam-policies.htm)
- [API-Level Permissions for Chat](https://docs.oracle.com/en-us/iaas/Content/generative-ai/chat-permissions.htm)

---

## 4. Testar no Playground

Antes de mexer no código, confirme que o modelo responde na sua conta:

1. Menu de navegação → **Analytics & AI** → em **AI Services**, **Generative AI**.
2. Confira se a região selecionada no topo do console é **Brazil East (Sao Paulo)**.
3. Selecione o **compartment** (o mesmo de `OCI_COMPARTMENT_OCID`).
4. Clique em **Playground** → **Chat**.
5. Escolha o modelo **meta.llama-3.3-70b-instruct** e mande uma mensagem curta (ex.: "Olá, responda em uma frase").

   > **Licença da Meta (passo único, obrigatório):** o Llama 3.3 só responde depois que a licença da Meta é aceita no Playground. No primeiro uso do modelo, o console mostra os termos; aceite-os antes de rodar `pnpm smoke:genai` ou o back-end. Sem isso, a primeira chamada pela API falha. Vale para cada conta/tenancy nova.
6. Clique em **View code**, escolha **TypeScript** e confira no código gerado:
   - o `modelId` (deve ser `meta.llama-3.3-70b-instruct`) → `OCI_GENAI_MODEL_ID`;
   - o `compartmentId` → deve bater com `OCI_COMPARTMENT_OCID`;
   - o endpoint → `OCI_GENAI_ENDPOINT` (opcional).

| Env var              | Valor                                                                                                                                                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OCI_GENAI_MODEL_ID` | `meta.llama-3.3-70b-instruct`                                                                                                                                                                                                                                                      |
| `OCI_GENAI_ENDPOINT` | opcional. Formato `https://inference.generativeai.<region>.oci.oraclecloud.com`; para São Paulo: `https://inference.generativeai.sa-saopaulo-1.oci.oraclecloud.com`. Se vazio, o SDK deriva o endpoint da `OCI_REGION`. Use o endpoint que aparece no "View code" se for diferente |

Se o menu **Generative AI** não aparecer ou o modelo não estiver na lista, verifique a região selecionada e se a conta trial tem acesso ao serviço.

Docs:

- [Chat in OCI Generative AI (Playground)](https://docs.oracle.com/en-us/iaas/Content/generative-ai/use-playground-chat.htm)
- [Copying the Code (View code)](https://docs.oracle.com/en-us/iaas/Content/generative-ai/get-code.htm)
- [Accessing Generative AI in the Console](https://docs.oracle.com/en-us/iaas/Content/generative-ai/access-generative-ai.htm)
- [OCI OpenAI-Compatible Endpoints (formato do host `inference.generativeai.<region>`)](https://docs.oracle.com/en-us/iaas/Content/generative-ai/openai-compatible-api.htm)

---

## 5. Autonomous Database Always Free

### 5.1 Criar o banco

1. Menu de navegação → **Oracle AI Database** → **Autonomous AI Database** (em consoles mais antigos: **Oracle Database → Autonomous Database**; o nome do menu pode variar).
2. Selecione o compartment do projeto e clique em **Create Autonomous AI Database**.
3. Preencha:
   - **Display name**: `nurai`
   - **Database name**: `nurai` (só letras e números, até 30 caracteres, único por tenancy/região). O nome do banco define os aliases do `tnsnames.ora` (`nurai_low`, `nurai_high`, ...).
   - **Workload type**: **Transaction Processing** (ou **JSON**, se o time preferir documentos JSON).
   - Ative o toggle **Always Free**. Confira que a tela mostra o banco como Always Free antes de continuar.
   - **Choose database version**: a mais recente disponível (ex.: _Oracle AI Database 26ai_).
4. **Administrator credentials**: o usuário é `ADMIN` (fixo). Defina e anote a senha; o console mostra as regras de complexidade na hora.
5. **Network access**: escolha **Secure access from everywhere**.
   - Motivo: a Vercel não tem IP fixo, então não dá para usar **Secure access from allowed IPs and VCNs only**, e **Private endpoint access only** exige uma VCN que a Vercel não alcança.
6. Deixe marcado **Require mutual TLS (mTLS) authentication**. Com ele, só conexões mTLS (com wallet) são aceitas. É isso que mantém o banco protegido mesmo estando acessível de qualquer IP. Se a opção não aparecer na criação, ajuste depois em **Network → Mutual TLS (mTLS) authentication → Edit** na página do banco (o nome do menu pode variar).
7. Clique em **Create** e aguarde o status ficar **Available**.

### 5.2 Baixar o Instance Wallet

1. Na página de detalhes do banco, clique em **Database connection**.
2. Em **Wallet type**, escolha **Instance wallet** (só deste banco).
3. Clique em **Download wallet**, defina uma senha em **Password** / **Confirm password** (mínimo 8 caracteres, com pelo menos 1 letra, 1 número e 1 caractere especial) e clique em **Download**.
4. Descompacte o `Wallet_nurai.zip` **fora do repositório**:
   ```bash
   mkdir -p ~/.oci/wallet_nurai
   unzip ~/Downloads/Wallet_nurai.zip -d ~/.oci/wallet_nurai
   ls ~/.oci/wallet_nurai
   # cwallet.sso  ewallet.p12  ewallet.pem  keystore.jks  ojdbc.properties
   # README  sqlnet.ora  tnsnames.ora  truststore.jks
   ```
5. Os arquivos que importam para o `node-oracledb` em thin mode:
   - **`ewallet.pem`**: certificados PEM usados no mTLS (o thin mode usa o PEM, não o `cwallet.sso`);
   - **`tnsnames.ora`**: os connect descriptors, um por alias (`nurai_high`, `nurai_medium`, `nurai_low`, `nurai_tp`, `nurai_tpurgent`).
6. Use o alias **`_low`** (`nurai_low`): ele tem menor prioridade e paralelismo, o que basta para um app pequeno e economiza os recursos do Always Free.
7. Gere o base64 do `ewallet.pem`, em uma linha só:
   ```bash
   base64 -w0 ~/.oci/wallet_nurai/ewallet.pem
   ```
   (no macOS: `base64 -i ~/.oci/wallet_nurai/ewallet.pem`, que já sai sem quebra de linha).

> O `README` do wallet informa a **data de expiração** dos certificados. Quando ela chegar, baixe um wallet novo e atualize `ORACLE_DB_WALLET_PEM_BASE64`.

### 5.3 Usuário da aplicação `NURAI` (opcional, recomendado)

Evite usar `ADMIN` no app. Na página do banco, abra **Database actions** → **SQL** (o nome do menu pode variar), faça login como `ADMIN` e rode:

```sql
CREATE USER NURAI IDENTIFIED BY "TroqueEstaSenha#2026";
GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE, CREATE VIEW TO NURAI;
GRANT UNLIMITED TABLESPACE TO NURAI;
```

Alternativa a `UNLIMITED TABLESPACE`, mais restrita: `ALTER USER NURAI QUOTA UNLIMITED ON DATA;` (`DATA` é o tablespace padrão do Autonomous Database).

### 5.4 Variáveis do banco

| Env var                       | Origem                                                                                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ORACLE_DB_USER`              | `NURAI` (ou `ADMIN` se pulou o 5.3)                                                                                                                                                                                                                                      |
| `ORACLE_DB_PASSWORD`          | senha do usuário acima                                                                                                                                                                                                                                                   |
| `ORACLE_DB_CONNECT_STRING`    | alias do `tnsnames.ora`, ex. `nurai_low`. **Na Vercel não existe o arquivo `tnsnames.ora`**, então prefira colar o **descriptor completo** do alias, que é o texto `(description= ... )` à direita de `nurai_low =` no `tnsnames.ora`. Ele funciona em qualquer ambiente |
| `ORACLE_DB_WALLET_PEM_BASE64` | saída do `base64 -w0 ewallet.pem`                                                                                                                                                                                                                                        |
| `ORACLE_DB_WALLET_PASSWORD`   | senha definida no **Download wallet** (não é a senha do ADMIN)                                                                                                                                                                                                           |

Docs:

- [Provision Autonomous AI Database](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/autonomous-provision.html)
- [Network access options](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/network-access-options.html)
- [Allow TLS or require only mTLS](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/support-tls-mtls-authentication.html)
- [Download client credentials (wallet)](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/connect-download-wallet.html)
- [node-oracledb — Connecting to Oracle Database (thin mode, `walletLocation`/`walletPassword`/`configDir`)](https://node-oracledb.readthedocs.io/en/latest/user_guide/connection_handling.html)

---

## 6. Preencher `.env.local` e a Vercel

### 6.1 Local

```bash
cp .env.example .env.local
```

O `.env.local` **nunca** deve ser commitado (confira que ele está no `.gitignore` antes do primeiro `git add`).

Exemplo preenchido (valores fictícios):

```dotenv
OCI_TENANCY_OCID=ocid1.tenancy.oc1..aaaaexemplo
OCI_USER_OCID=ocid1.user.oc1..aaaaexemplo
OCI_FINGERPRINT=12:34:56:78:9a:bc:de:f0:12:34:56:78:9a:bc:de:f0
OCI_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqh...\n...\n-----END PRIVATE KEY-----\n"
OCI_PRIVATE_KEY_PASSPHRASE=
OCI_REGION=sa-saopaulo-1
OCI_COMPARTMENT_OCID=ocid1.compartment.oc1..aaaaexemplo
OCI_GENAI_MODEL_ID=meta.llama-3.3-70b-instruct
OCI_GENAI_ENDPOINT=https://inference.generativeai.sa-saopaulo-1.oci.oraclecloud.com

ORACLE_DB_USER=NURAI
ORACLE_DB_PASSWORD=TroqueEstaSenha#2026
ORACLE_DB_CONNECT_STRING=nurai_low
ORACLE_DB_WALLET_PEM_BASE64=LS0tLS1CRUdJTi...
ORACLE_DB_WALLET_PASSWORD=SenhaDoWallet#1
```

**`OCI_PRIVATE_KEY` em uma linha no `.env.local`:** use aspas duplas e troque cada quebra de linha por `\n` literal. Este comando gera o valor pronto a partir do `.pem`:

```bash
awk 'NF {sub(/\r/, ""); printf "%s\\n", $0}' ~/.oci/nurai_api_key.pem
```

Cole a saída entre aspas: `OCI_PRIVATE_KEY="<saída>"`. O back-end converte `\n` de volta em quebras de linha antes de passar a chave para o SDK.

### 6.2 Vercel

No projeto da Vercel: **Settings → Environment Variables**. Cadastre **as mesmas variáveis** (marque os ambientes Production/Preview/Development conforme a necessidade).

- **`OCI_PRIVATE_KEY`**: na Vercel, **cole o conteúdo do `.pem` direto**, com as quebras de linha reais e sem aspas (o campo aceita várias linhas). O formato com `\n` também funciona, porque o back-end aceita os dois.
- `ORACLE_DB_CONNECT_STRING`: use o **descriptor completo** (ver 5.4), já que não há `tnsnames.ora` no deploy.
- Depois de alterar variáveis, faça um **redeploy**. Os deploys já existentes não pegam os valores novos.

### 6.3 Deploy na Vercel pela CLI

Foi assim que a versão em produção (`https://nurai-iota.vercel.app`) foi publicada. Rode na raiz do repositório, com o `.env.local` já preenchido (seção 6.1):

```bash
npx vercel@latest login
npx vercel link --project nurai
```

Cadastre as variáveis no ambiente de produção lendo do `.env.local`, **sem imprimir os valores** (o `node --env-file` entende aspas e o PEM multilinha; variáveis vazias são puladas):

```bash
for NOME in OCI_TENANCY_OCID OCI_USER_OCID OCI_FINGERPRINT OCI_PRIVATE_KEY \
  OCI_PRIVATE_KEY_PASSPHRASE OCI_REGION OCI_COMPARTMENT_OCID OCI_GENAI_MODEL_ID \
  OCI_GENAI_ENDPOINT ORACLE_DB_USER ORACLE_DB_PASSWORD ORACLE_DB_CONNECT_STRING \
  ORACLE_DB_WALLET_PEM_BASE64 ORACLE_DB_WALLET_PASSWORD; do
  VALOR_OK=$(node --env-file=.env.local -e 'process.stdout.write(process.env[process.argv[1]] ? "1" : "")' "$NOME")
  [ -n "$VALOR_OK" ] || { echo "pulando $NOME (vazia)"; continue; }
  node --env-file=.env.local -e 'process.stdout.write(process.env[process.argv[1]])' "$NOME" \
    | npx vercel env add "$NOME" production
done
```

Publique e confira:

```bash
npx vercel deploy --prod
curl -s https://<seu-projeto>.vercel.app/api/health
# esperado: {"ok":true,"genai":"oci","db":"oracle",...}
```

Para mudanças de roteamento ou de `vercel.json`, valide antes num deploy de preview (`npx vercel deploy`, sem `--prod`): o ambiente local (Hono puro) não reproduz o roteamento da Vercel. Foi num deploy assim que apareceu o 404 das rotas aninhadas corrigido no commit `3640cdd`.

Depois do `link`/`deploy`, confira o `git status`:

- A Vercel CLI pode acrescentar `VERCEL_OIDC_TOKEN` ao `.env.local`. O arquivo não é versionado (`*.local` no `.gitignore`), mas o token é uma credencial: não o copie para outro lugar.
- A CLI pode acrescentar `.env*` ao `.gitignore`. **Reverta essa linha**: ela esconderia o `.env.example`, que precisa continuar versionado. O `.gitignore` do projeto já ignora `.env`, `*.local` e `.vercel`.

---

## 7. Como validar

Os comandos abaixo serão criados pelo time no back-end:

1. Local: `pnpm test:oci` faz uma chamada real ao Generative AI e ao banco com as credenciais do `.env.local`.
2. Com o servidor rodando (local ou na Vercel): `GET /api/health` deve retornar algo com:
   ```json
   { "genai": "oci", "db": "oracle" }
   ```
   Se aparecer outro valor (ex.: um fallback/mock), alguma variável está faltando ou inválida. Veja a seção 8.

---

## 8. Troubleshooting

| Sintoma                                                                       | Causas prováveis                                                                                                                                                                                                                     | O que fazer                                                                                                                                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **401 `NotAuthenticated`** no Generative AI                                   | fingerprint não bate com a chave; `OCI_PRIVATE_KEY` mal formatada (quebras de linha perdidas, faltando `BEGIN`/`END`); OCID de user/tenancy trocado; relógio da máquina fora de sincronia (a assinatura da requisição inclui a data) | Compare `OCI_FINGERPRINT` com o que aparece em API Keys; regere o valor com o `awk` da seção 6.1; sincronize o relógio (`timedatectl`)                        |
| **404 `NotAuthorizedOrNotFound`**                                             | falta policy (usuário não admin); `OCI_COMPARTMENT_OCID` errado ou de outro compartment; modelo não disponível na região/endpoint usado                                                                                              | Revise a seção 3.2; confira o `compartmentId` e o `modelId` no "View code" do Playground; confira se `OCI_REGION`/`OCI_GENAI_ENDPOINT` são de `sa-saopaulo-1` |
| **ORA-12506** (_listener rejected connection based on service ACL filtering_) | o banco está com ACL (_allowed IPs and VCNs only_) e o IP de origem (Vercel ou sua máquina) não está na lista                                                                                                                        | Volte o Network access para **Secure access from everywhere** com mTLS obrigatório (seção 5.1) ou adicione seu IP à ACL para testes locais                    |
| Erros de wallet / TLS (ex.: falha no handshake, senha de wallet inválida)     | `ORACLE_DB_WALLET_PEM_BASE64` com quebras de linha ou de outro arquivo (precisa ser o `ewallet.pem`); `ORACLE_DB_WALLET_PASSWORD` com a senha do ADMIN em vez da do wallet; wallet expirado; wallet de outro banco                   | Regere com `base64 -w0 ewallet.pem`; confira a senha do download; baixe um Instance Wallet novo                                                               |
| Alias `nurai_low` não resolve na Vercel                                       | não há `tnsnames.ora` no deploy                                                                                                                                                                                                      | Use o descriptor completo em `ORACLE_DB_CONNECT_STRING`                                                                                                       |
| Banco não responde depois de dias parado                                      | Always Free para após 7 dias sem atividade                                                                                                                                                                                           | Dê **Start** no banco pelo console                                                                                                                            |

Docs:

- [ORA-12506](https://docs.oracle.com/en/error-help/db/ora-12506/)
- [Configure Network Access with ACLs](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/access-control-rules-autonomous.html)
- [Required Keys and OCIDs](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm)

---

## 9. Segurança

- **Nunca** commite o `.pem`, o wallet (`Wallet_*.zip`, `ewallet.pem`, `cwallet.sso`, ...) ou o `.env.local`. Guarde-os fora do repositório (ex.: `~/.oci/`).
- **Nunca** cole a private key, o base64 do wallet ou senhas em chat (WhatsApp, Discord, IA, issue, PR). Para compartilhar com o grupo, cada integrante cria a **própria** API key no próprio usuário, ou vocês usam um cofre de senhas.
- **Se a chave vazar:** em **API Keys**, apague a chave comprometida, gere uma nova e atualize `OCI_PRIVATE_KEY` e `OCI_FINGERPRINT` no `.env.local` e na Vercel. O mesmo vale para o wallet: baixe um novo e, se houver suspeita, gire o wallet na página do banco (**Database connection**, opção de rotação do wallet; o nome do menu pode variar) e troque as senhas do ADMIN e do `NURAI`.
- Use o usuário `NURAI` com privilégios mínimos no app, e não o `ADMIN`.
- Mantenha o **mTLS obrigatório** no banco. É ele que protege o banco aberto para qualquer IP.

Docs:

- [Required Keys and OCIDs](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm)
- [Download client credentials (wallet)](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/connect-download-wallet.html)
