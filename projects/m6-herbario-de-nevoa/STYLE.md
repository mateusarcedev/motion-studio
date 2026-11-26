# Direção de arte — Herbário de Névoa

## Conceito

Um caderno de campo encontrado depois da chuva: papel quente, tinta de gravura, uma margem anotada e espécimes desenhados com linhas deliberadas. O mundo deve parecer um pequeno arquivo literário, não uma interface de laboratório ou uma loja.

## Sistema visual

| Token | Valor | Uso |
|---|---|---|
| `paper` | `#EAE6DA` | papel e planos de leitura |
| `paper-light` | `#F4F0E6` | cartões e reserva de luz |
| `ink` | `#26352E` | texto e fundo escuro |
| `moss` | `#56694F` | folhas e anotação |
| `clay` | `#91503D` | acento quente e transição |
| `berry` | `#754652` | flor e acento secundário |
| `line` | `#C7C1B1` | regras e molduras |

Tipografia: Ubuntu (sans-serif) para índices, navegação e legenda; Georgia/serif do sistema para títulos e nomes inventados. Números de catálogo usam algarismos tabulares. Nenhuma fonte remota.

## Composição e ritmo

- Página: uma folha editorial larga no desktop; no celular, cabeçalho compacto, título antes do espécime, e seções empilhadas. A ilustração é o ponto focal da abertura.
- Filme: tipografia desloca-se pouco e abre espaço para a flor desenhada; cada cena troca escala e relação entre texto e espécime. Entrada e saída são conduzidas pelo frame.
- Carrossel: alterna capa assimétrica, página de índice, campo escuro de espécime, lâmina clay, nota em duas colunas e encerramento em negativo.
- Story: composição vertical redesenhada, espécime central e texto dentro da área útil de Instagram Stories. Não é o filme horizontal esticado.
- Microinterações da página confirmam foco/expansão; reduzem movimento quando `prefers-reduced-motion` está ativo.

## Evitar

Gradientes genéricos, brilho, partículas, textura fotográfica falsa, selos de autoridade, logotipos inventados, elementos “científicos” como se fossem medições, transições decorativas e texto minúsculo.

## Proveniência

SVG inline desenhado para a campanha, sem assets externos. Fontes selecionadas do stack local (`Ubuntu`, `Georgia`, fallback `serif`/`sans-serif`). As plantas e seus nomes são invenção editorial.
