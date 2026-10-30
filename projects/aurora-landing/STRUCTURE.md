# STRUCTURE.md — Aurora Landing Page

## Páginas/Seções (Single Page)

| Ordem | Seção | ID | Conteúdo | Breakpoint Behavior |
|---|---|---|---|---|
| 1 | Hero 3D | `#hero` | AuroraHero (R3F) + headline + subheadline + CTA | Mobile: stacked; Desktop: side-by-side (hero esq, copy dir) |
| 2 | Specs | `#specs` | 3 cards (Case, Crystal, Movement) | Mobile: 1 col; Tablet: 2+1; Desktop: 3 col |
| 3 | Story | `#story` | Narrativa + background parallax | Mobile: stacked; Desktop: split (img esq, copy dir) |
| 3 | CTA Footer | `#cta` | "Reserve seu Aurora" + WhatsApp link | Full-width, centered |

## Hierarquia de Conteúdo (Mobile-First)

```html
<main>
  <section id="hero" class="hero">
    <div class="hero-3d"><AuroraHero /></div>
    <div class="hero-copy">
      <span class="kicker">Precisão encontra elegância</span>
      <h1>Aurora.<br>O relógio que<br>você <em>sente</em>.</h1>
      <p class="subhead">Precisão suíça, design brasileiro, feito para durar gerações.</p>
      <a href="#cta" class="btn btn-primary">Reserve seu Aurora</a>
    </div>
  </section>

  <section id="specs" class="specs">
    <header class="section-header">
      <span class="kicker">Especificações</span>
      <h2>Cada detalhe<br>pensado para durar.</h2>
    </header>
    <div class="specs-grid">
      <article class="spec-card">
        <div class="icon">🏷️</div>
        <h3>Case</h3>
        <p>Titânio Grau 5, acabamento escovado, 42mm, 11mm espessura.</p>
      </article>
      <article class="spec-card">
        <div class="icon">💎</div>
        <h3>Cristal</h3>
        <p>Safira com dupla camada antirreflexo, resistente a riscos.</p>
      </article>
      <article class="spec-card">
        <div class="icon">⚙️</div>
        <h3>Movimento</h3>
        <p>Automático suíço Sellita SW200-1, 38h reserva, 28.800 vph.</p>
      </article>
    </div>
  </section>

  <section id="story" class="story">
    <div class="story-bg"></div>
    <div class="story-content">
      <span class="kicker">A história</span>
      <h2>Feito para<br>ser <em>vivido</em>.</h2>
      <p>Não apenas um relógio. Um companheiro para as conquistas silenciosas,<br>os marcos invisíveis, o tempo que não volta — mas que fica gravado.</p>
      <a href="#cta" class="btn btn-ghost">Conheça a jornada</a>
    </div>
  </section>

  <section id="cta" class="cta">
    <span class="kicker">Pronto para o seu?</span>
    <h2>O tempo não espera.<br>Seu Aurora sim.</h2>
    <a href="https://wa.me/5511999999999" class="btn btn-primary" target="_blank" rel="noopener">
      Reserve no WhatsApp →
    </a>
    <p class="cta-note">Entrega em todo Brasil. Garantia de 2 anos.</p>
  </section>
</main>
```

## Estados de Entrada/Saída (Animações)

| Seção | Entrada (Scroll) | Saída | Gatilho |
|---|---|---|---|
| Hero | Imediato (0%) | — | Load |
| Specs | `opacity 0→1`, `translateY(40→0)` | — | 20% viewport |
| Story | `opacity 0→1`, `translateY(30→0)` | — | 40% viewport |
| CTA | `opacity 0→1`, `scale(0.95→1)` | — | 70% viewport |

## Hotspots (Hero 3D)

| ID | Posição (normalizada) | Label | Info |
|---|---|---|---|
| `case` | `[0, 0.02, 0.03]` | Case | "Titânio Grau 5, acabamento escovado" |
| `bezel` | `[0, 0.035, 0.025]` | Bezel | "Cerâmica polida, resistente a riscos" |
| `crystal` | `[0, 0.045, 0.015]` | Crystal | "Safira, dupla camada antirreflexo" |
| `crown` | `[0.022, 0, 0]` | Crown | "Titanio, knurled, rosca 1.5mm" |
| `strap` | `[0, -0.03, -0.03]` | Strap | "Couro italiano, costura à mão" |

## Assets Necessários

| Asset | Path | Status |
|---|---|---|
| GLB Hero | `/models/aurora-watch.glb` | ✅ Exportado (216KB) |
| Poster Fallback | `/images/hero-poster.webp` | 🔄 Gerar |
| Icons Specs | `/icons/spec-case.svg`, etc. | 🔄 Criar |
| Fontes | Instrument Serif + Geist (Google Fonts) | ✅ CDN |

## Checklist de Entrega

- [ ] `projects/aurora-landing/web/` — código fonte (Vite + React + R3F)
- [ ] `dist/` — build de produção
- [ ] `reviews/viewports/` — screenshots 5 viewports
- [ ] `assets.manifest.json` — SHA-256 de todos assets
- [ ] `README.md` — como rodar (`npm install && npm run dev`)
- [ ] `assets.manifest.json` no `dist/`
- [ ] Aprovação humana (gate final)
