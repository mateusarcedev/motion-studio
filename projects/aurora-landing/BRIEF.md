# BRIEF — Aurora Watch Landing Page

**Goal:** Landing page cinematográfica para o relógio Aurora Watch — hero 3D interativo, specs, CTA.

**Audience:** Early adopters, design/tech enthusiasts, 25-40 anos, mobile-first.

**Format:** Single-page landing (Vite + React + R3F), responsivo (mobile, tablet, desktop).

**Brand:** Aurora (tokens em creative-core/brands/mini-festa-da-rose/tokens.json — adaptado para Aurora).

**Sections:**
1. **Hero 3D** — AuroraHero (R3F) com auto-rotate, hotspots, lazy-load.
2. **Specs** — 3 cards (Case, Crystal, Movement) com icons.
3. **Story** — Copy narrativa + background parallax.
4. **CTA** — "Reserve seu Aurora" → WhatsApp.

**Stack:** Vite + React + R3F (Three.js + @react-three/fiber + @react-three/drei).
**Assets:** GLB em `models/aurora-watch.glb` (já exportado).
**Performance:** LCP < 2.5s, GLB < 1MB, lazy-load, dpr={[1,2]}, prefers-reduced-motion.
**A11y:** Contraste AA, navegação teclado, alt/aria no canvas.

**Deliverable:** `projects/aurora-landing/web/` (código editável), build em `dist/`, contact sheets por viewport, manifest.
