# Nurai — MVP

Protótipo navegável do Challenge STO 2026 (FIAP · ESOA4). Uma plataforma centrada no
paciente que reúne o histórico clínico disperso — rede pública, rede privada e papel —
em uma linha do tempo única, estrutura com IA o que estava solto e devolve esse contexto
como próximo passo de cuidado.

**Equipe:** Lúcia Boutti · Thiago Eiji · Murilo Mansano · Pedro Eugênio · Matheus Matos

## Rodar

```bash
npm install
```

```bash
npm run dev
```

Sem backend, sem banco, sem variável de ambiente. Todo o estado vive em `localStorage`
e some quando você clica em "Reiniciar a demonstração" na barra lateral.

## O que existe

| Rota | O quê |
|---|---|
| `#/` | Landing: o problema, os quatro movimentos do produto e o diferencial |
| `#/projeto` | Dossiê da fase: Partes 1 a 4, com persona, instrumento de validação, corte do MVP e arquitetura |
| `#/app/linha` | Linha do tempo unificada — 24 registros de 6 fontes, busca, filtros e painel de detalhe |
| `#/app/fontes` | Conectar fontes e anexar documento, com extração simulada e conferência |
| `#/app/copiloto` | Copiloto ancorado: toda resposta cita os registros que a sustentam |
| `#/app/cuidado` | Pendências encontradas, centros de referência e ensaios clínicos compatíveis |
| `#/app/resumo` | Resumo pré-consulta por especialidade, imprimível e compartilhável |
| `#/app/privacidade` | Consentimento por instituição, revogável, e registro de acessos |

## Roteiro de demonstração (3 minutos)

1. **Landing** — a espinha à direita mostra fragmentos de seis fontes assentando na mesma linha.
2. **Linha do tempo** — filtre por "SUS" e depois por "Papel": o mesmo histórico, fontes que
   nunca se falaram. Abra *Ultrassom Doppler de carótidas* (27 mai 2026).
3. **Copiloto** — pergunte "Tem algum exame que eu não preciso repetir?". A resposta aponta a
   duplicidade e cita os dois registros que a provam; clique em uma âncora para voltar à linha.
4. **Fontes e anexos** — "Usar o laudo de exemplo": o PDF vira três valores com faixa de
   referência e grau de confiança, e só entra no histórico depois da sua conferência.
5. **Próximos passos** — cinco pendências que nenhum médico isolado enxergava.
6. **Resumo para consulta** — gere o acesso temporário de 30 dias para a cardiologista.
7. **Acessos e consentimento** — revogue uma permissão e veja o registro de auditoria crescer.

## Stack

React 19 + TypeScript sobre Vite. Sem dependência de runtime além do React: roteamento
por hash próprio, store própria com assinatura, CSS autoral com tokens, ícones e
diagramas desenhados no projeto.

```
src/
  data/        modelo de domínio, acervo sintético e motor de respostas do copiloto
  lib/         roteador, store em localStorage, formatação
  components/  ícones, marca, régua de faixa de referência, série temporal
  routes/      landing, dossiê e as seis telas do produto
  styles/      tokens em index.css + uma folha por superfície
```

## Avisos

- Paciente, instituições, exames e resultados são **sintéticos**. Nenhum dado real.
- Não é dispositivo médico, não emite diagnóstico e não substitui avaliação profissional.
- As integrações com RNDS, laboratórios e hospitais são **simuladas** nesta fase.
- A camada gerenciada em nuvem está desenhada e marcada como próxima fase — ver
  `#/projeto`, Parte 4.

Decisões visuais em [DESIGN.md](DESIGN.md); verdade do produto em [PRODUCT.md](PRODUCT.md).
