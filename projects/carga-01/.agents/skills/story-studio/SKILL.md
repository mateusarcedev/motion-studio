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
