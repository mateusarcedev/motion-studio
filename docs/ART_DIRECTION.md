# Direção de arte — checklist de qualidade visual

Arquivo-ponte entre o Diretor de Arte (STYLE.md), o Animador e o **Crítico** (`reviews/findings.md`).
Arquivos tecnicamente válidos não bastam: estes eixos são avaliados sobre **o render**, nunca sobre o código.

| Eixo | Pergunta | Sinal automático (heurístico) | Falha típica |
|---|---|---|---|
| Hierarquia | Um único ponto focal por cena? Título > apoio > detalhe? | `qa-visual`: texto pequeno, excesso de texto (> 45 palavras/quadro) | Tudo com o mesmo peso; parágrafos em cena. |
| Composição | Respiro, alinhamento, áreas seguras respeitadas? | `qa safe-zones`, texto cortado/fora do quadro | Elemento colado na borda; texto sob a UI da plataforma. |
| Contraste / legibilidade | Texto legível durante a leitura? | `qa-visual`: razão de contraste (4.5 / 3 para texto grande) | Texto cinza sobre fundo médio; texto se movendo enquanto é lido. |
| Profundidade | Há planos (fundo/meio/frente) ou tudo é chapado? | — (olho do Crítico) | Cena "vazia": uma forma no meio do nada. Use `waveLayers`, `networkGraph`, camadas com `data-depth`. |
| Ritmo | Alterna cena densa/leve, rápida/calma? | `qa frames`: repetição | Todas as cenas com o mesmo tempo e a mesma entrada. |
| Variação entre cenas | Cenas consecutivas diferem em composição **e** dispositivo visual? | `qa frames`: "gêmeos visuais" não adjacentes | Cena 2, 4 e 6 são a mesma tela com outro texto. |
| Iluminação / tom | Escuro é intencional (contraste de luz)? | `qa frames`: % de quadros escuros | Preto chapado "porque sim". |
| Consistência de estilo | Um único conjunto de ícones, espessura, paleta, easing? | sessão de assets (estilo travado) | Ícones de famílias diferentes; gradientes genéricos. |
| Propósito do movimento | Cada animação comunica algo? | — | Movimento decorativo, bounce excessivo (regra 5 e "Creative restrictions"). |
| Adequação | Formato e público certos? Recomposição ≠ crop? | dimensões/safe zones por formato | Mesmo layout 16:9 esticado em 9:16. |

## Plano obrigatório no STYLE.md / STORYBOARD.md

Para cada cena (ou slide) registrar: **ponto focal**, **dispositivo visual** (ícone, diagrama, SVG, imagem aprovada, tipografia),
**diferença em relação à cena anterior** (composição + dispositivo), **plano de profundidade** e **palavras na tela**.
Duas cenas consecutivas com o mesmo dispositivo e a mesma composição são reprovadas antes de qualquer código.

## Ciclo do Crítico (mecanismo existente, agora com evidência medida)

1. `motion qa precheck projects/<slug>` → `reviews/qa-report.{json,md}` (estados `PASS/WARN/FAIL/BLOCKED/NOT_TESTED`).
2. O Crítico (contexto novo) lê **renders + BRIEF + qa-report**. Heurística indica risco; só o olho e o brief decidem arte.
3. Cada defeito: **ID · quadro/timestamp · composição afetada (arquivo/seletor) · observação · por que importa · correção mínima · preservar · rechecar**.
4. Correção local (máx. 2 rodadas/defeito) → re-render **só dos quadros afetados** (`--sample-frames`) → comparação antes/depois no contact sheet.
5. Resultado registrado em `findings.md` (“Resultado da revisão”: corrigido / persistente / bloqueado). Nunca remover verificação para passar.
