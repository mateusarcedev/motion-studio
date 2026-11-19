# STYLE — "Terminal editorial"

**Status:** aprovado pelo dono em 2026-11-19. Ajuste D2 (cor secundária) e D3 (comando final 56 px) aplicados na rodada 1 de reparo.

- **Tipografia:** terminal em mono (**Ubuntu Mono**, instalada no sistema; Geist Mono se o dono fornecer em `public/fonts/`). Títulos em sans bold (**DejaVu Sans Bold** como fallback local; Geist se fornecida). Título 120 px / terminal 40 px / legenda 44 px; peso bold só no título.
- **Cor:** fundo `#0F0F0D` liso (sem gradiente), texto `#F2EFE6`, secundário `#B5B1A5` (era #8A877D; elevado no reparo D2 do Crítico, ≈ 9:1), **um** acento `#E5A93B` (comando e check). Contraste texto principal/fundo ≥ 12:1.
- **Composição:** margem 160 px; título alinhado à esquerda no terço superior; bloco de terminal à esquerda com largura 1500 px; um único ponto focal por cena.
- **Movimento:** tudo por número de frame, sem aleatoriedade. Entradas ease-out (cubic), 12–18 frames, sem bounce. Digitação: 1 caractere a cada 2 frames. Linhas do terminal: 1 a cada ~30 frames, cada uma pousa e fica parada. **Leitura parada:** nenhum texto se move enquanto é lido (≥ 45 frames de hold por bloco).
- **Câmera:** estática. Sem zoom/pan.
- **Textura:** nenhuma (sem grain, sem blur, sem sombra).
- **Continuidade:** estado final de cada cena = estado inicial da próxima (fundo e margens idênticos; o comando da cena 1 persiste em topo reduzido na cena 2).

## Avoid
Gradientes e orbs de fundo · partículas/glow/lens flare · bounce · texto pequeno (< 36 px) ou em movimento durante a leitura · UI de produto inventada · emojis do terminal real **não** serão renderizados (substituídos por marcador `✓` mono) · câmera sem propósito · cortes entre composições não relacionadas.
