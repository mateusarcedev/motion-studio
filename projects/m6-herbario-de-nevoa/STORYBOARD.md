# Storyboard — Herbário de Névoa

## Website

| Seção | Ponto focal / dispositivo | Diferença da anterior | Profundidade e mensagem |
|---|---|---|---|
| Abertura | título editorial + SVG da flor lunar | primeiro plano, composição horizontal assimétrica | papel / flor / “Um atlas para aquilo que ainda não existe.” |
| Caderno | linha de catálogo e nota curta | reduz escala, coluna de texto | regra de caderno; apresenta a ficção |
| Espécies | três cartões com SVGs distintos | ritmo em três colunas que empilham no celular | espécies explicitamente fictícias |
| Colofão | frase central e folha desenhada | volta ao espaço vazio da abertura | convite para imaginar; sem oferta comercial |

## Filme 16:9 · 240 frames · 24 fps · 10 s · seed 23

| Frames | Ponto focal / texto | Dispositivo | Diferença / pausa |
|---|---|---|---|
| 0–47 | “Herbário de Névoa” | capa tipográfica à esquerda, espécime à direita | abertura quieta, papel revela a flor |
| 48–95 | “Lunária cinza.” | pétalas e caule traçados por `__onFrame__` | sai da capa para o primeiro plano botânico |
| 96–143 | “Nascida do intervalo.” | órbita interrompida e anotação lateral | imagem circular vira campo aberto |
| 144–191 | “Um atlas inventado.” | folhas em escala ampliada, texto baixo | contraste da cena anterior: figura alta e texto superior |
| 192–239 | “Folheie o impossível.” | selo fictício e nome da coleção | simplifica para encerramento legível |

Os cinco stills amostrados são aprovados antes da montagem. Cada quadro usa estado puro derivado de `frame / fps`; nenhuma keyframe CSS, relógio ou aleatoriedade.

## Carrossel 4:5 · seis lâminas

1. Capa assimétrica: “Herbário de Névoa”.
2. Índice em papel aberto: “Um mapa para espécies que nunca existiram.”
3. Campo verde-escuro e desenho grande: “Lunária cinza.”
4. Lâmina clay, texto curto em coluna: “Floresce no intervalo.”
5. Nota de campo em duas colunas: “Cada espécie guarda uma paisagem.”
6. Plano escuro, pouco texto e convite: “Folheie o impossível.”

## Story 9:16 · 240 frames · 24 fps · 10 s · seed 23

| Frames | Ponto focal / texto | Dispositivo | Área segura |
|---|---|---|---|
| 0–47 | “Um herbário que não existe.” | título central, folha pequena surge abaixo | centro, sem conteúdo nas margens de UI |
| 48–95 | “Lunária cinza.” | flor em escala vertical, linha desenhada | dentro de x=6–86%, y=11–82% |
| 96–143 | “Uma espécie inventada.” | etiqueta lateral e caule alto | sem encostar nos controles à direita |
| 144–191 | “Um mundo para imaginar.” | duas folhas e amplo negativo | texto retido no miolo vertical |
| 192–239 | “Folheie o impossível.” | colofão e rótulo de ficção | nenhuma informação importante abaixo de 82% |
