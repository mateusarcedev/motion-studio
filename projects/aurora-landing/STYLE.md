# STYLE.md — Aurora Landing Page

## Direção Visual

**Conceito:** "Precisão encontra elegância" — minimalismo técnico, materiais premium, iluminação controlada.

## Paleta (tokens da marca Aurora)

| Token | Hex | Uso |
|---|---|---|
| `--aurora-bg` | `#0a0a0c` | Background principal |
| `--aurora-fg` | `#f2f2ee` | Texto principal |
| `--aurora-muted` | `#8a8a94` | Texto secundário |
| `--aurora-rose` | `#f38fa8` | Accent rosa (kickers, highlights) |
| `--aurora-blue` | `#62c8ea` | Accent azul (CTAs secundários) |
| `--aurora-navy` | `#173c5b` | Navy (botões, textos fortes) |
| `--aurora-cream` | `#fff9f6` | Cream (backgrounds alternativos) |
| `--aurora-gold` | `#d5a94e` | Dourado (apenas detalhes, barras, pins) |

## Tipografia

| Elemento | Fonte | Tamanho | Peso | Line-height | Tracking |
|---|---|---|---|---|---|
| Display/Headline | Instrument Serif | clamp(48px, 7vw, 96px) | 400 | 1.02 | -0.02em |
| Subheadline | Instrument Serif | clamp(22px, 2.5vw, 28px) | 400 | 1.3 | 0 |
| Body | Geist / system-ui | clamp(16px, 1.8vw, 18px) | 400 | 1.6 | 0 |
| Kicker/Label | Geist | 14px | 700 | 1.2 | 0.2em (uppercase) |
| Caption | Geist | 12px | 400 | 1.4 | 0.1em |
| Button/CTA | Geist | 16px | 700 | 1.2 | 0 |

## Espaçamento (escala 8px base)

| Token | Valor |
|---|---|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 16px |
| `--space-lg` | 32px |
| `--space-xl` | 64px |
| `--space-2xl` | 128px |

## Breakpoints (reflow real)

| Nome | Breakpoint | Colunas | Container |
|---|---|---|---|
| Mobile | < 640px | 1 | 100% - 32px |
| Tablet | 640–1023px | 2 | 100% - 64px |
| Desktop | 1024–1439px | 3 | 1200px |
| Wide | ≥ 1440px | 4 | 1400px |

## Hero 3D (AuroraHero)

- **Canvas:** full-screen, `dpr={[1,2]}`, `Suspense` + `LoadingFallback`.
- **Câmera:** `position: [0, 0.06, 0.12]`, `fov: 35`, `near: 0.005`.
- **Auto-rotate:** 0.3 rad/s (pausa no hover/touch).
- **Hotspots:** 5 pontos (Case, Bezel, Crystal, Crown, Strap) com `<Html>` overlay.
- **Fallback:** Imagem estática (poster) para `prefers-reduced-motion` / sem WebGL.
- **GLB:** `/models/aurora-watch.glb` (lazy-load via `useGLTF`).

## Motion

| Elemento | Entrada | Saída | Curva | Duração |
|---|---|---|---|---|
| Hero content | `opacity 0→1`, `translateY(40→0)` | — | `easeOutCubic` | 0.8s |
| Scroll sections | `opacity 0→1`, `translateY(30→0)` | — | `easeOutCubic` | 0.6s |
| Hotspot pulse | `scale(1) → scale(1.3)` | — | `easeInOutSine` | 2s (loop) |
| Scroll reveal | `opacity 0→1` | — | `easeOutExpo` | 0.8s |
| Parallax bg | `translateY(0→-50px)` | — | linear | scroll-linked |

**Reduced motion:** `prefers-reduced-motion` → desliga auto-rotate, animações instantâneas.

## Componentes UI

| Componente | Estilo |
|---|---|
| Button Primary | `bg: navy`, `color: cream`, `rounded-full`, `px-8 py-4`, `hover: gold` |
| Button Ghost | `border: 1px solid navy`, `color: navy`, `hover: bg-navy color-cream` |
| Card Spec | `bg: cream/10`, `border: 1px solid navy/20`, `rounded-2xl`, `p-6` |
| Hotspot Ring | `border: 2px solid gold`, `animate-pulse 2s`, `tooltip` on hover |
| Section Divider | `h-px`, `bg: gradient(transparent → gold → transparent)` |

## Assets

| Asset | Caminho | Formato | Tamanho máx |
|---|---|---|---|
| GLB Hero | `/models/aurora-watch.glb` | `.glb` | < 1 MB |
| Poster Fallback | `/images/hero-poster.webp` | `.webp` | < 200 KB |
| Icons Specs | `/icons/spec-*.svg` | `.svg` | < 10 KB cada |
| Fontes | System + Instrument Serif (Google Fonts) | — | — |

## Performance Budgets

| Métrica | Alvo |
|---|---|
| LCP | < 2.5s (4G simulado) |
| CLS | < 0.1 |
| JS inicial (gz) | < 200 KB |
| GLB | < 1 MB (meshopt/draco) |
| LCP Image | < 200 KB |

## Acessibilidade

- Contraste AA (texto vs bg).
- Navegação por teclado (foco visível).
- `aria-label` no canvas 3D (`"Relógio Aurora 3D interativo"`).
- `prefers-reduced-motion` → auto-rotate OFF, animações instantâneas.
- `alt` em imagens, `aria-label` em botões/icon-only.

## Evitar

- Stock photos genéricas.
- Gradientes "neon" ou "cyberpunk".
- Animações excessivas (bounce, elastic, spring excessivo).
- Texto sobre imagem sem overlay escuro.
- Layouts que quebram no mobile (overflow horizontal).
