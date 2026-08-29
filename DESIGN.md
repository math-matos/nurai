# Nurai — sistema visual

Escrito a partir do que foi construído, não do que se pretendia construir.

## Tese

Um histórico clínico disperso vira um único instrumento de leitura. O produto recusa
o dashboard de saúde feito de cartões macios iguais e do verde-menta amigável.

## Mundo

**Caderneta de saúde e folha de exame.** Fundo off-white frio (nunca creme), malha
milimetrada discreta como material de fundo, tinta quase preta, verde-clínico profundo
como única cor de ação. A codificação de fonte aparece em faixa fina de 3px — vocabulário
de sinalização hospitalar. O estado clínico (normal, limítrofe, fora da faixa) só colore
notação de dado, nunca decoração.

Claro, sem tema escuro. A cena de uso decide: sala de espera com luz de dia, celular na
mão, e o monitor do consultório. `color-scheme: light` é declarado.

## Componente-assinatura

**A régua de faixa de referência** (`.regua`): nome do exame, valor em numeral tabular,
pista com a faixa de referência desenhada em verde pálido e um marcador vertical na
posição do resultado. É a mesma notação da folha de laboratório, e a mesma gramática que
governa a espinha da linha do tempo — um eixo com marcações e eventos assentados nele.

## Tokens

Definidos em `src/index.css`, em `:root`.

| Papel | Token | Valor |
|---|---|---|
| Papel de fundo | `--paper` | `#f6f7f5` |
| Painel / lateral | `--panel` | `#edf0ec` |
| Cartão | `--card` | `#ffffff` |
| Tinta principal | `--ink` | `#14201c` |
| Tinta secundária | `--ink-2` | `#47554f` |
| Tinta terciária | `--ink-3` | `#5c6a64` (piso 4,5:1 sobre papel e painel) |
| Ação | `--accent` / `--accent-deep` | `#0b5c4e` / `#073f35` |
| Traço | `--line` / `--line-2` / `--line-strong` | `#d8ded7` / `#c2cabf` / `#a9b3a8` |
| Notação clínica | `--sig-normal` `--sig-atencao` `--sig-alterado` `--sig-info` | verde, âmbar, tijolo, azul |
| Fontes de dado | `--src-sus` `--src-lab` `--src-hospital` `--src-clinica` `--src-operadora` `--src-paciente` | azul, ocre, vinho, verde, índigo, grafite |

Escala de espaço `--sp-1` a `--sp-9` (4 → 96). Raios 3/5/8px. Sombras com deslocamento
e desfoque, nunca halo colorido.

## Tipografia

**Public Sans**, uma família só, via Google Fonts. Pesos 400/550/650/700/800/900.
Registro de documento regulado — a face de um sistema de design de governo, coerente
com caderneta e prontuário. Numerais tabulares (`.num`, tabelas, `time`) em todo dado.

- Produto: escala fixa em px, 12 → 24. `letter-spacing` negativo cresce com o tamanho.
- Landing e capa do dossiê: `clamp()` até 4,15rem, peso 900, tracking −0,042em.
- Medida de leitura entre 66ch e 78ch em texto corrido.

## Ícones

Conjunto autoral em `src/components/Icon.tsx`: grade de 24, traço 1,6, terminações retas,
junções em esquadro. Nenhum emoji, nenhum glifo Unicode como ícone, nenhuma biblioteca.

## Movimento

Um só momento autoral: os fragmentos da espinha do herói assentam uma vez no
carregamento, com atraso escalonado de 78ms e saída exponencial. No produto, transições
de estado de 180ms e nada além disso. `prefers-reduced-motion` desliga tudo.

## Superfícies do navegador

Seleção, cursor, anel de foco, barra de rolagem e sublinhado de link são tematizados a
partir da paleta. Nenhum default de navegador ficou de pé.

## Padrões de composição

- **Linha do tempo:** eixo à esquerda, nó colorido por fonte, painel de detalhe grudento
  à direita em telas largas, empilhado abaixo em telas estreitas.
- **Folha:** listas de definição com filete superior de 1,5px em tinta, usadas para números
  e proveniência.
- **Tabela:** cabeçalho em versalete espaçado sobre filete de tinta, corpo em `--ink-2`.
  Sempre dentro de `.rolagem-x` quando pode exceder a largura.
- **Diagramas:** SVG autoral com a mesma gramática das telas — traço fino, canto de 4px,
  tracejado para o que ainda não existe.

## Exceção deliberada ao detector

`codex-grid-background` (advisory) permanece: a malha milimetrada é o material declarado
do mundo e cobre superfície de medição — herói, capa do dossiê e fecho. Não é ornamento
genérico de fundo.
