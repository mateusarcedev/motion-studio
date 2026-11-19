---
name: story-studio
description: Produces Instagram/WhatsApp-style stories — static (1080×1920 PNG via Chromium) and animated (Remotion when motion is needed) — with safe-zone handling, sequences, captions, versioning and gallery registration. Use when the user asks for stories ("stories para o lançamento", "sequência de stories"), and routed by studio-director. Reuses creative-core presets, renderer, quality and gallery.
---

# Story Studio — stories estáticos e animados

Vertical 1080×1920 é o formato-rei. O contrato de produção é o mesmo do `carousel-studio`
(brief → roteiro → arte → HTML/CSS → render → crítica → revisão → export), com estas diferenças:

## Safe zones (regra de ouro do formato)

Story tem interface em cima e embaixo. Preset `story` em `creative-core/presets.json`:
**topo 22% · base 16% · laterais 7%**. Texto, título, logo e CTA essenciais ficam DENTRO das
zonas; elementos decorativos podem sangrar. As zonas são configuráveis no preset (a plataforma
muda a UI; o preset acompanha).

## Sequências

- Referência: bloco inicial define o tom; cada story = 1 ideia; último com CTA/arraste-para-cima.
- Numeração: `stories/01.html`…; roteiro em tabela (story · texto · direção visual · CTA).
- Sequência deve funcionar **fora de ordem também** (cada frame se sustenta sozinho).

## Estático vs. animado

- **Estático:** HTML/CSS → `render_static.mjs --width=1080 --height=1920 --scale=2` (PNG 2160×3840).
  Validate com `validate_static.py --expected 2160x3840`.
- **Animado:** quando houver motivo real de movimento (contagem, marquee, transição de tempo),
  use Remotion via `hyperframes`/`remotion-*` com preset `video-vertical` (1080×1920, 30fps,
  5–15s por story). Geração de MP4 segue o contrato do `motion-director` (stills antes do
  render completo etc). **Nunca "esticar" um PNG estático como vídeo em alta resolução:
  renderize do HTML/assets originais.**

## Crítica e galeria

- Crítico independente: **legibilidade em movimento/deslize**, zonas seguras violadas, hierarquia,
  consistência da sequência, fidelity de marca.
- Versões e variações → galeria (`creative-core/gallery/`), com ZIP por versão.
- Aprovado → memória visual em `brands/<slug>/approved/`.

## Recursos visuais, SVG e QA automático (infraestrutura compartilhada)

O usuário descreve o resultado em linguagem natural: **você** escolhe os recursos. Nunca peça a ele bibliotecas de ícones, SVG, FFmpeg ou correção de imports.

1. **Ícones/pictogramas:** `motion assets resolve "<conceito>"` (API `createAssetSession` de `@technomanceer/motion-core`). Uma sessão por produção = um único estilo de ícone; conceitos diferentes recebem ícones diferentes. `fallback: true` ou confiança `low` ⇒ troque o conceito ou desenhe um SVG original.
2. **Fundos, ilustrações e diagramas vetoriais:** `motion svg component <waveLayers|networkGraph|ringProgress|flowArrow|orbitRings|gridPattern> --tokens=<tokens.json da marca>`. SVG de terceiros passa por `motion svg validate` (não confiável ⇒ sanitizado). Cores vêm dos tokens, nunca hard-coded.
3. **Animação vetorial:** `@technomanceer/motion-core/svg-motion` (`createSvgMotion` + `window.__onFrame__`). Proibido SMIL, CSS keyframes, `requestAnimationFrame` e `Math.random` em vídeo.
4. **Proveniência:** registre `session.manifest()` no `assets.manifest.json`. Logotipos/marcas só a partir de assets fornecidos pelo usuário — nunca recriar nem recolorir.
5. **Gates automáticos:** um render com `status: "FAIL"` (erro de JS, import quebrado, imagem essencial quebrada, controlador ausente) **nunca** segue adiante, mesmo que o arquivo exista. Antes do Crítico rode `motion qa precheck projects/<slug>` (gera `reviews/qa-report.{json,md}`; estados PASS/WARN/FAIL/BLOCKED/NOT_TESTED; heurística ≠ prova). O Crítico lê esse relatório **e** os renders.
6. **Direção de arte:** siga `docs/ART_DIRECTION.md` — ponto focal, dispositivo visual e diferença em relação à cena anterior por cena; sem cenas repetidas, vazias ou com excesso de texto.
