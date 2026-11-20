# Direção de arte — checklist de qualidade visual

Arquivo-ponte entre o Diretor de Arte (STYLE.md), o Animador e o **Crítico** (`reviews/findings.md`).
Arquivos tecnicamente válidos não bastam: estes eixos são avaliados sobre **o render**, nunca sobre o código.

## Narrativa que mostra o efeito

Quando a peça apresenta uma ferramenta, serviço ou processo, prefira mostrar uma mudança concreta:
pedido ou situação → trabalho relevante → resultado que o público pode ver. Funcionalidades entram
quando ajudam a entender essa mudança. Isso orienta a escolha da história; não é uma estrutura
obrigatória para poesia, identidade, arte abstrata, documentação ou peças em que outro ritmo atende
melhor ao brief.

## Variação com direção

Planeje a diferença entre peças com uma pequena matriz escrita no STYLE/STORYBOARD: ponto focal,
escala dominante, alinhamento, densidade, uso de imagem/diagrama/tipografia, posição do texto e ritmo.
Alterne esses eixos por intenção, mantendo paleta, tipografia e linguagem de marca. Uma sequência não
precisa trocar tudo: cada variação deve dar suporte à mensagem. Ícones só entram quando identificam,
explicam ou conectam algo; enfeites sem função narrativa saem. Títulos grandes são uma opção de
hierarquia, não o layout padrão de todas as peças.

| Eixo | Pergunta | Sinal automático (heurístico) | Falha típica |
|---|---|---|---|
| Hierarquia | O ponto focal e os textos de apoio têm tamanho adequado à mídia final? | `qa-visual`: texto pequeno e texto secundário pequeno; limite de palavras conforme contexto | Texto secundário ilegível; todas as mensagens com o mesmo peso. |
| Composição | Respiro, alinhamento, áreas seguras respeitadas? Textos se sobrepõem? | `qa safe-zones`, `render static --qa-visual --qa-context=story-vertical`, corte, sobreposição | Elemento sob a UI da plataforma; textos colidindo. Sobreposição intencional pode ser marcada com `data-motion-overlap="intentional"`. |
| Contraste / legibilidade | Texto legível durante a leitura? | `qa-visual`: razão de contraste (4.5 / 3 para texto grande) | Texto cinza sobre fundo médio; texto se movendo enquanto é lido. |
| Profundidade | Há planos (fundo/meio/frente) ou tudo é chapado? | — (olho do Crítico) | Cena "vazia": uma forma no meio do nada. Use `waveLayers`, `networkGraph`, camadas com `data-depth`. |
| Ritmo | Alterna cena densa/leve, rápida/calma? Há pausas de leitura justificadas? | `qa frames` e `qa media`: repetição/quadros parados, com contexto temporal opcional | Todas as cenas com o mesmo tempo; pausa legítima tratada como erro ou congelamento acidental ignorado. |
| Variação entre cenas | Cenas consecutivas diferem em composição **e** dispositivo visual? | `qa frames`: "gêmeos visuais" não adjacentes | Cena 2, 4 e 6 são a mesma tela com outro texto. |
| Iluminação / tom | Escuro é intencional (contraste de luz)? | `qa frames`: % de quadros escuros, com cenas intencionais declaradas | Fundo de marca confundido com falha; preto acidental sem revisão. |
| Consistência de estilo | Um único conjunto de ícones, espessura, paleta, easing? | sessão de assets (estilo travado) | Ícones de famílias diferentes; gradientes genéricos. |
| Propósito do movimento | Cada animação comunica algo? | — | Movimento decorativo, bounce excessivo (regra 5 e "Creative restrictions"). |
| Adequação | Formato e público certos? Recomposição ≠ crop? | dimensões/safe zones por formato | Mesmo layout 16:9 esticado em 9:16. |

## Plano obrigatório no STYLE.md / STORYBOARD.md

Para cada cena (ou slide) registrar: **ponto focal**, **dispositivo visual** (ícone, diagrama, SVG, imagem aprovada, tipografia),
**diferença em relação à cena anterior** (composição + dispositivo), **plano de profundidade**, **palavras na tela** e pausas planejadas.
Repetição sem propósito precisa ser redesenhada; unidade de marca e continuidade continuam valendo. Uma composição recorrente
com função narrativa clara pode permanecer, desde que a sequência tenha variação de ritmo e hierarquia.

## Ciclo do Crítico (mecanismo existente, agora com evidência medida)

1. `motion qa precheck projects/<slug>` → `reviews/qa-report.{json,md}` (estados `PASS/WARN/FAIL/BLOCKED/NOT_TESTED`).
2. O Crítico (contexto novo) lê **renders + BRIEF + qa-report**. Heurística indica risco; só o olho e o brief decidem arte.
3. Cada defeito: **ID · quadro/timestamp · composição afetada (arquivo/seletor) · observação · por que importa · correção mínima · preservar · rechecar**.
4. Correção local (máx. 2 rodadas/defeito) → re-render **só dos quadros afetados** (`--sample-frames`) → comparação antes/depois no contact sheet.
5. Resultado registrado em `findings.md` (“Resultado da revisão”: corrigido / persistente / bloqueado). Nunca remover verificação para passar.
