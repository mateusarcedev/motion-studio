---
name: feed-studio
description: Produces single-feed posts — promotional cards, typographic posts, editorial compositions, infographics and ad art — as code (HTML/CSS → PNG 2160px via Chromium) with brand fitting, proportions to presets, variations and versioning. Use when the user asks for a professional post for feed, an ad visual, an infographic or a typographic post, and routed by studio-director. Reuses creative-core renderer/quality/gallery/brands.
---

# Feed Studio — posts únicos e artes de campanha

Mesma produção do `carousel-studio`, adaptada para **peça única** (ou variações):

## Gêneros

| Gênero | Direção |
|---|---|
| Card promocional | oferta clara, hierarquia título → subtítulo → CTA, foto real o mínimo necessário |
| Post tipográfico | o TEXTO é a forma; não há arte além da própria composição tipográfica |
| Editorial/composição | foto + tipografia sobreposta/adjacente; o corte é decisão de arte |
| Infográfico | leitura única; grid claro; ícones em SVG inline editável |
| Arte publicitária | ad art: alto impacto, focada no produto/oferta, dentro da direção da marca |

## A proporção é preset, não dogma

Presets (`creative-core/presets.json`): feed-vertical 1080×1350 (default) · feed-square 1080×1080 ·
story 1080×1920. A MESMA peça pode ser recomposta para outra proporção — **recomposição real
(hierarquia própria), nunca crop automático**. Cada exportação revê o próprio frame.

## Variações

O usuário pode pedir **N variações** explorando a margem criativa DENTRO da identidade da marca
(cor de destaque, composição, tipografia, foto). Registre as variações na galeria com status
`draft`; a aprovada vira `approved` e entra em `brands/<slug>/approved/`. "Compare as versões e
mate a última aprovada como referência" é fluxo da galeria (`build_gallery.py`).

## Render & crítica

Idêntico ao contrato do `carousel-studio` (`render_static.mjs` com deviceScaleFactor 2, QA JSON
de overflow, `validate_static.py`, Crítico independente, ZIP de entrega). Legenda vai no pacote.

## Recursos visuais, SVG e QA automático (infraestrutura compartilhada)

O usuário descreve o resultado em linguagem natural: **você** escolhe os recursos. Nunca peça a ele bibliotecas de ícones, SVG, FFmpeg ou correção de imports.

1. **Ícones/pictogramas:** `motion assets resolve "<conceito>"` (API `createAssetSession` de `@technomanceer/motion-core`). Uma sessão por produção = um único estilo de ícone; conceitos diferentes recebem ícones diferentes. `fallback: true` ou confiança `low` ⇒ troque o conceito ou desenhe um SVG original.
2. **Fundos, ilustrações e diagramas vetoriais:** `motion svg component <waveLayers|networkGraph|ringProgress|flowArrow|orbitRings|gridPattern> --tokens=<tokens.json da marca>`. SVG de terceiros passa por `motion svg validate` (não confiável ⇒ sanitizado). Cores vêm dos tokens, nunca hard-coded.
3. **Animação vetorial:** `@technomanceer/motion-core/svg-motion` (`createSvgMotion` + `window.__onFrame__`). Proibido SMIL, CSS keyframes, `requestAnimationFrame` e `Math.random` em vídeo.
4. **Proveniência:** registre `session.manifest()` no `assets.manifest.json`. Logotipos/marcas só a partir de assets fornecidos pelo usuário — nunca recriar nem recolorir.
5. **Gates automáticos:** um render com `status: "FAIL"` (erro de JS, import quebrado, imagem essencial quebrada, controlador ausente) **nunca** segue adiante, mesmo que o arquivo exista. Antes do Crítico rode `motion qa precheck projects/<slug>` (gera `reviews/qa-report.{json,md}`; estados PASS/WARN/FAIL/BLOCKED/NOT_TESTED; heurística ≠ prova). O Crítico lê esse relatório **e** os renders.
6. **Direção de arte:** siga `docs/ART_DIRECTION.md` — ponto focal, dispositivo visual e diferença em relação à cena anterior por cena; sem cenas repetidas, vazias ou com excesso de texto.
