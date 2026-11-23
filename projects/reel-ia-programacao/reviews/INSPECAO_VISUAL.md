# Inspeção visual (lado da produção) — reel.mp4

> Feita por quem produziu, sobre o render (não sobre o código). O parecer independente está em
> `findings.md` (Crítico em contexto separado). Evidências: `frames/final-stills.png`,
> `frames/final-contact-sheet.png` (1 quadro a cada 2,5 s), `frames/stills-4.png` (prévia).

## Gate de stills (regra 6) — 4 quadros

| Quadro | O que comunica | Resultado |
|---|---|---|
| abertura (q. 30) | card de tese "IA na programação / já é realidade" + legenda "…não temos para onde fugir" | legível; card acima da cabeça |
| ação (q. 330) | card "// e logo vieram" revelando Antigravity → Codex → Claude Code junto da fala | chips entram na palavra falada |
| resultado (q. 815) | lista "// seu foco passa a ser" código → regra de negócio → produto | item ativo em verde, anteriores esmaecidos |
| fecho (q. 1530) | card "// o que o cliente quer / o sistema funcionando" + chips dinheiro · tempo · ambos | último chip acende em "ambos" |

## Achados durante a produção (corrigidos antes do render final)

| # | Achado | Evidência | Correção |
|---|---|---|---|
| 1 | Texto queimado na fonte ("ESCUTA ISSO" 0,13–1,83 s; "E VOCÊ, O QUE ACHA?" 63,90–66,40 s) apareceu na 1ª prévia e parecia gerado pelo motor | quadros da fonte em 0,6 s e 65,9 s | registrado no BRIEF como restrição; intro excluída por decisão editorial; CTA do autor preservado |
| 2 | 1ª prévia com legenda sobre a boca (rosto padrão do preset) | prévia anterior | `faceBox` declarado pelo operador a partir dos stills → legenda em y ≈ 0,72 |
| 3 | Cards sobrepostos no topo por ~0,5 s (tese × opcional) | plano | motor encerra o card anterior quando o próximo entra na mesma região |
| 4 | Plano de 23 s sem mudança de enquadramento | plano | zoom cuts em fronteiras de palavra (sem cortar tempo) |
| 5 | Corte do operador começando ~30 ms dentro do "s" de "se" (26,87 s) | envelope de energia | bordas de remoção dentro de fala vão para o mínimo de energia ±80 ms (26,90 → 26,83 s) |
| 6 | Rótulos `//` dos cards fora da safe zone vertical conservadora (topo 15%) e pequenos (24 px) | QA DOM do render_static | cards descem para y = 0,15; rótulo 28 px |

## Rodada de reparo 1 (após o Crítico)

Ver `REPAIR_LOG.md`. Render atual: 53,17 s, 1595 quadros. Fim: o CTA queimado do autor fica
~2,5 s sozinho na base (legenda cede o espaço) com o card "o que o cliente quer" no topo
acendendo "ambos". Legendas com maiúscula de 54 px, páginas semânticas; cards em uma linha por
elemento, sem fantasma no cross-fade.

## Pontos que continuam para revisão humana

- Cards no topo (y = 0,10) passam perto do cabelo nos planos com zoom e cabeça alta.
- Palavras de baixa confiança sem evidência ("te", "Mas", "e quer") seguem como o ASR ouviu; a
  frase final "então esse é o meu […]" é falada sem legenda (fica sob o CTA do autor).
- Escuta do A/B (`out/final/audio-ab/ab-before.wav` × `ab-after.wav`) pendente.
