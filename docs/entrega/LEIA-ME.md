# Nurai · Entrega da Fase 7

Challenge STO 2026 · FIAP · ESOA4
Time: Lúcia Boutti, Thiago Eiji, Murilo Mansano, Pedro Eugênio e Matheus Matos.

## O que tem neste ZIP

| Arquivo | O que é |
|---|---|
| `01-documento-consolidado.pdf` | Documento da startup: problema, MVP e tecnologia Oracle (Parte 1), testes com usuários (Parte 2), modelo de negócio (Parte 3), estratégia de lançamento (Parte 4) e pitch (Parte 5) |
| `02-pitch-nurai.pdf` | Pitch em 13 slides: problema, solução, demonstração, mercado, modelo de negócio, tecnologia Oracle, diferencial, crescimento, projeções e time |
| `03-video-apresentacao.mp4` | Vídeo de até 7 minutos, com a demonstração do sistema em funcionamento |
| `04-codigo-fonte.zip` | Código-fonte completo do MVP |
| `LEIA-ME.md` | Este arquivo |

## MVP no ar

- **Endereço:** https://nurai-one.vercel.app
- **Como acessar:** clique em **Abrir a demonstração**. Não precisa de cadastro: a conta de exemplo já tem 24 registros fictícios.
- **Serviços em uso:** https://nurai-one.vercel.app/api/health mostra `"genai":"oci"` (OCI Generative AI) e `"db":"oracle"` (Oracle Autonomous Database).

## Rodar o MVP localmente

Não é preciso nenhuma credencial. Sem as variáveis da Oracle, o banco fica em memória e a IA é simulada, com o mesmo fluxo da versão publicada.

1. Instale o **Node.js 22 ou superior** e o **pnpm** (`npm install -g pnpm`).
2. Descompacte `04-codigo-fonte.zip` e, dentro da pasta, rode:
   ```
   pnpm install
   pnpm dev:all
   ```
3. Abra http://localhost:5173 e clique em **Abrir a demonstração**.

Para usar a Oracle Cloud localmente, siga `docs/setup-oci.md`, dentro do código-fonte.

## Onde estão os detalhes

Dentro do código-fonte:

- `docs/validacao/roteiro-testes.md`: o roteiro usado nos testes com usuários.
- `docs/validacao/resultados-testes.md`: os resultados anonimizados, com as falas dos participantes.
- `docs/setup-oci.md`: a configuração da Oracle Cloud (Autonomous Database, Generative AI e Document Understanding).
- `docs/entrega/roteiro-video.md`: o roteiro do vídeo.

Paciente, instituições e resultados da demonstração são fictícios. A Nurai é um protótipo acadêmico e não é um dispositivo médico.
