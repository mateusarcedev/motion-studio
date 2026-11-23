# STYLE — Reel "IA na programação"

> Gate de aprovação humana: **pendente**. Direção única para o filme inteiro.

## Direção

"Terminal editorial": a fala é a protagonista; o estúdio só sublinha. Cards escuros e
discretos no topo (acima da cabeça), legendas grandes e legíveis abaixo da boca, punch-ins
para marcar mudança de frase. Família visual da marca vista em `capa.jpg` (escuro + verde
menta), mas com composição e textos próprios.

## Tipografia (fontes do projeto, OFL, versionadas em `fonts/`)

- **Inter 700** — legendas (tamanho ASS 96 → altura de maiúscula medida 54 px; caixa alta; auto-ajuste se a linha passar de 675 px) e títulos dos cards.
- **JetBrains Mono 700** — rótulos `// comentário` e chips dos cards (32 px).

## Cor

| Token | Valor | Uso |
|---|---|---|
| texto | `#FFFFFF` | legendas, títulos |
| acento | `#2EE6A6` | palavra ativa na legenda, linha de destaque, chip ativo |
| card | `rgba(18,22,20,.94)` + borda `rgba(46,230,166,.35)` | fundo dos cards |
| palavra-chave | `#FFD23F` | "TRÁS" na virada (distinta da palavra ativa) |
| apoio | `#9FB3AA` | rótulos mono |

## Composição

- Legenda: abaixo da faixa olhos→boca do rosto declarado, largura ≤ 675 px (fora dos controles
  laterais do Reels), ≤ 2 linhas, 3 palavras por página (até 5 quando a fala é rápida), quebras em
  pontuação, nunca terminando em artigo/preposição/conjunção, mínimo 0,65 s por página.
- Enquanto o texto queimado do autor está na base (fim), a legenda cede o espaço.
- Cards: topo em y = 0,10 (abaixo do cabeçalho do app; preset Reels 8%), largura ≤ 78%, uma linha
  por elemento; estados progressivos reservam o layout final.
- Zoom: 1,00 / 1,12 alternados em cortes e "zoom cuts" (plano mínimo 0,7 s); 1,20 cobrindo a
  frase de abertura inteira ("se você dev … ficando para trás").

## Movimento

- Legenda: entrada da página com pop 86→100% em 90 ms + fade 60 ms; palavra ativa troca de cor
  (sem reflow).
- Cards: entrada ease-out cúbica 300 ms (fade + 28 px de subida); saída fade 200 ms; novos itens
  em cross-fade 150 ms.
- Cortes secos (jump cut) — nenhuma transição decorativa.

## Evitar

Gradientes genéricos, brilhos/partículas, bounce, texto se movendo durante a leitura, cards
sobre o rosto, qualquer elemento na faixa inferior reservada do app, textos que não estejam na
fala, CTA inventado (a fonte já tem o CTA do autor queimado no fim).
