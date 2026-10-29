---
name: carousel-studio
description: Produces code-based social carousels (HTML/CSS → high-res PNG slides via Chromium), with slide-by-slide storytelling, thumbnails, captions, versioning, side-by-side comparison and ZIP export. Integrated into the MOTION gallery for persistent registration and visual memory per brand. Use when the user asks for a carousel ("carrossel de N slides"), a slide deck for Instagram/LinkedIn posts, or to rework/reuse an approved carousel version. Part of the MOTION multiformat studio — routed by studio-director.
---

# Carousel Studio — carrosséis em código

Pipeline: **Briefing → Roteiro → Direção de arte → HTML/CSS → Preview → Crítica → Revisão → Exportação**.

Regras gerais (`CLAUDE.md`), contratos de handoff (`pipeline.md`) e recursos compartilhados
(`creative-core/`) valem aqui. Este skill é o especialista no formato carrossel.

## 1 · Briefing e roteiro

- Resolve a **marca** (`creative-core/brands/<slug>`); sem marca declarada → `default`.
- Consulta `brands/<slug>/approved/` (memória visual): reúso das decisões aprovadas; ignorar
  identidade aprovada em nome de "novidade" é falha. Inovação sim, quebra de identidade não.
- Planejamento do storytelling: 1 ideia por slide; slide 01 gancho; último slide CTA; se o tema
  não couber em ≤10 slides, o tema está largo — converse.
- Roteiro em **tabela**: slide · título · texto · direção visual · CTA (se houver).
- Legenda completa do post é entregue junto (com hashtags quando úteis).

## 2 · Direção de arte (STYLE.md local)

Quando a marca não define tudo, produza o estilo em `projects/<projeto>/STYLE.md` a partir do
PROFILE.md + tokens + referências. Para qualidade tipográfica e de movimento use o vocabulário
`emil-design-eng` / `animate` nos estados estáticos e `apple-design` para hierarquia e
contraste. Uma direção só; slides irmãos compartilham o mesmo sistema.

## 3 · HTML/CSS — cada slide = 1 documento

- 1 arquivo HTML por slide (`slides/01.html`, `slides/02.html`…), todo CSS inline/embedded e
  assets locais com caminhos relativos.
- Tokens da marca entram como variáveis CSS no `<style>` de cada slide.
- Tipografia: fontes locais (`@font-face`) ou Google Fonts — o renderer espera `document.fonts.ready`.
- Título ≤ 5 palavras; texto por bloco ≤ 3 linhas; nada essencial fora das safe-zones (presets).

## 4 · Render (contrato técnico, não negociável)

```
node creative-core/renderers/render_static.mjs slides/01.html out/01.png \
  --width=1080 --height=1350 --scale=2        # preset feed-vertical
```

- `document.fonts.ready` + imagens completamente carregadas antes da captura (o renderer impõe).
- Saída nativa 2160×2700 (deviceScaleFactor 2). **Nunca amplificar PNG de baixa resolução.**
- O renderer imprime QA JSON (`overflow`, `fontIssues`) — trate WARN como defeito do Animador,
  não o ignore.
- valide cada PNG: `python3 creative-core/quality/validate_static.py out/01.png --expected 2160x2700`

## 5 · Crítica (o pipeline padrão)

Crítico independente (contexto fresco quando disponível) avalia a folha de todos os slides:
hierarquia, legibilidade, fidelidade de marca, overflows, consistência entre slides.
Saída: `reviews/findings.md` com slide exato, observação, menor correção útil, o que preservar.
Máximo **duas rodadas por defeito** (regra do CLAUDE.md).

## 6 · Exportação e galeria

```
python3 creative-core/exporters/zip_export.py projects/<p>/ entrega-<v>.zip
python3 creative-core/gallery/build_gallery.py          # registra + regenera index.html
```

Registre em `creative-core/gallery/gallery.json`: projeto, brief, conteúdo por slide, HTML fonte
(editável, incluído no pacote), assets, legenda, miniaturas, versões, status de aprovação e
arquivos exportados. A galeria oferece navegação por slider, comparação lado a lado e download —
`build_gallery.py` fornece isso pronto.

## 7 · Memória visual (composição de volta)

Peça aprovada → copie `STYLE.md` e um **resumo das decisões visuais** para
`creative-core/brands/<slug>/approved/<YYYY-MM>-<peca>/`, e marque `status: "approved"` na
galeria. A próxima produção da marca herda — e o estúdio fica mais rápido e mais fiel.

## Presets

Feed vertical 1080×1350 (default) · Square 1080×1080 · story 1080×1920 — sempre lidos de
`creative-core/presets.json`, nunca hardcode. Mudança de plataforma = ajuste no presets.json.
