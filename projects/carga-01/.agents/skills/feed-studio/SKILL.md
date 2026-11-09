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
