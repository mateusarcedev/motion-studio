<div align="center">

# 🎬 motion

**Um estúdio criativo multiformato profissional — construído com Agent Skills.**
**A professional AI multiformat creative studio — built out of Agent Skills.**

Confie o briefing. O estúdio escolhe o produtor certo, produz, renderiza e entrega — MP4, carrossel, stories ou post.
You bring the intent. The studio picks the right producer, crafts the piece, renders and ships it — MP4, carousel, stories or post.

`45+ Agent Skills · Claude Code · OpenCode · Codex · Copilot · Gemini · qualquer agente compatível`

</div>

---

## 🇧🇷 Português (Brasil)

### O que é isto?

`motion` é um **estúdio criativo multiformato operado por agentes de IA** — vídeo, carrosséis,
stories, posts de feed e artes de campanha. Ele transforma qualquer pedido ("quero um promo do meu
produto", "transforma esse artigo num carrossel") em material renderizado, através de um **diretor**
que entrevista você, decide **quem produz** entre um time de skills especializadas, e entrega
com QA assistido.

Nada é um gerador genérico. Cada quadro é escrito em código (HTML/CSS/Remotion/canvas/render
engines), determinístico, editável e re-renderizável para sempre — o mesmo rigor do cinema para
todo formato.

### Como funciona

```
"Quero um vídeo" ───►  🎬 motion-director — 1 agente, 5 departamentos
                       │
                       ├─ 1 · DIRETOR      briefing estilo grill-me: objetivo, duração,
                       │   │                formatos, estilo, som, material de origem
                       │   └──► BRIEF.md ✋ aprovação
                       ├─ 2 · DIRETOR DE ARTE  referências ► tipografia, cor, composição,
                       │   │                    movimento, textura + lista de "evitar"
                       │   └──► STYLE.md ✋ aprovação
                       ├─ 3 · STORYBOARD   cena a cena, timestamps + NÚMEROS DE FRAME,
                       │   │                continuidade entre cenas
                       │   └──► STORYBOARD.md ✋ aprovação
                       ├─ 4 · ANIMADOR     code-driven e determinístico — roteado para
                       │                    o produtor ideal (lemo-opuscar / video-shotcraft /
                       │                    brag / hyperframes + media-use, ui-ux-pro-max…)
                       ├─ 5 · ENGENHEIRO DE RENDER  stills representativos ANTES do render
                       │                    completo · checagem de fontes, assets, fps, erros
                       ├─ 6 · CRÍTICO ⚖️   revisão independente (contexto novo) do render
                       │                    real: notas 1-10, 3 defeitos com frame exato,
                       │                    menor correção útil, o que preservar
                       ├─ 7 · CORREÇÃO     reparo local · máx. 2 rodadas por defeito ·
                       │                    depois: stop e escalado pra você
                       └─ 8 · DELIVERY     16:9 + 1:1 + 9:16 (composições próprias, nunca
                                            crop) · MP4s, poster frames, contact sheets,
                                            código editável, notas de produção
```

O estúdio aprende: erro que se repete vira regra no `CLAUDE.md` — o próximo filme herda a correção.

### Studio multiformato (v2)

Além de vídeo, o estúdio produz **carrosséis, stories, posts de feed e artes de campanha** —
mesmo padrão de departamentos, crítica independente e política de reparo:

```
"Transforme este lançamento em carrossel + stories + post"
        │
        ▼
🚪 studio-director — despacha o formato (porta de entrada do estúdio)
        ├─ vídeo / motion          ──► motion-director (pipeline v1, intocado)
        ├─ carrossel de slides     ──► carousel-studio (HTML/CSS → PNG 2160×2700)
        ├─ stories (est./animado)  ──► story-studio (safe zones 1080×1920; animado via Remotion)
        └─ post de feed / arte     ──► feed-studio (1 peça ou variações)

        Fundação compartilhada ── creative-core/
        ├─ render_static.mjs     Playwright + Chromium (deviceScaleFactor 2, nunca upscale)
        ├─ validate_static.py    dimensões, overflow, escala nativa
        ├─ zip_export.py         entrega empacotada (fonte editável incluída)
        ├─ build_gallery.py      galeria persistente: slider, comparação lado a lado, download
        └─ brands/<slug>/        PROFILE.md + tokens.json + approved/ (memória visual)
```

Regras do lado estático: presets dimensionais em `creative-core/presets.json` (configuráveis,
nunca hardcode) · memória visual por marca (consulte `approved/` antes de criar) ·
recomposição ≠ crop · editabilidade só com o fonte HTML na entrega ·
integrações só entram com registro em `creative-core/INTEGRATIONS.md`.

### O elenco (skills instaladas)

**🚪 Roteamento multiformato (v2)**

| Skill | Origem | O que faz |
|---|---|---|
| `studio-director` | *este repo (autoral)* | Porta de entrada: identifica o formato e despacha para o estúdio certo |
| `carousel-studio` | *este repo (autoral)* | Carrosséis em código: HTML/CSS → PNG de alta resolução, versões, legenda, ZIP, galeria |
| `story-studio` | *este repo (autoral)* | Stories estáticos e animados com zonas seguras e sequências |
| `feed-studio` | *este repo (autoral)* | Posts de feed, cards, tipográficos, infográficos e artes de campanha |

**🎥 Produção de vídeo**

| Skill | Origem | O que faz |
|---|---|---|
| `motion-director` | *este repo (autoral)* | O diretor: briefing, roteamento e delivery |
| `hyperframes` + `hyperframes-cli` + `hyperframes-registry` + `media-use` | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | Motor de render HTML→MP4, ~450 blocos prontos, produção de mídia (música, narração, SFX) |
| `video-shotcraft` | [Vincentwei1021/video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) | Promos cinematográficos com Remotion: captura páginas reais, 124 cards de shot recipes, cortes no beat |
| `brag` | [latent-spaces/brag](https://github.com/latent-spaces/brag) | Filmes de launch lendo o código do projeto direto |
| `lemo-opuscar` | [lemomo-ai/lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) | 59 estilos de filme 100% em código (aquarela, ukiyo-e, data storytelling…) |

**🎥 Vídeo**

| Skill | Origem | O que faz |
|---|---|---|
| `remotion-*` (12 skills oficiais) | [remotion-dev/skills](https://github.com/remotion-dev/skills) | Boas práticas do time do Remotion: animação, áudio/composições, fontes, legendas com marcação de tempo, render, maps — evita os erros clássicos de timing e asset |

**🎨 Design & suporte**

| Skill | Origem | O que faz |
|---|---|---|
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Design system generator: 79 estilos, 192 paletas, 74 font pairings |
| `impeccable` | [impeccable.style](https://impeccable.style) | 24 comandos de design frontend + 62 regras detectoras |
| `animate`, `animation-vocabulary`, `review-animations`, `improve-animations`, `animation-performance`, `find-animation-opportunities`, `emil-design-eng` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | A escola de animação de UI do Emil Kowalski (Vercel/Linear): curvas corretas, duração, interrupção, performance |
| `apple-design` | idem | Princípios de motion e design da Apple traduzidos para a web |
| `prototype` | idem | Prototipa versões alternativas de uma peça de UI e deixa você alternar entre elas |
| `anatomy` | [wheresryan22/anatomy](https://github.com/wheresryan22/anatomy) | Figuras isométricas SVG/WebGL/3D interativas para explicar ideias |
| `diagram-design` | [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) | 45 tipos de diagramas editoriais em HTML/SVG/PNG |
| `banner-design`, `brand`, `design`, `design-system`, `slides`, `ui-styling` | ui-ux-pro-max suite | Identidade, banners, decks e design tokens |
| `revenue-centric-design` | [heliocosta-dev/revenue-centric-design](https://github.com/heliocosta-dev/revenue-centric-design) | 134 princípios de design que converte, retém e monetiza |

**🧭 Direção & qualidade**

| Skill | O que faz |
|---|---|
| `grill-me` | Entrevista implacável para afiar briefing e design |
| `diagnosing-bugs` | Loop de diagnóstico para falhas de render/áudio/timeline |
| `thermo-nuclear-code-quality-review` | Review de qualidade de código extremamente rigoroso (invocação manual) |

### Como usar

```bash
# Em qualquer agente compatível (Claude Code, OpenCode, Codex…):
"Quero um vídeo do meu produto"        # abre o briefing
"Faça um teaser vertical de 30s com narração em pt-br"
"Preciso de um promo no estilo Swiss motion graphics"
"Transforme esse artigo num carrossel de 7 slides"      # carousel-studio
"Crie 5 stories para o lançamento do produto"           # story-studio
"Crie 3 variações de post na identidade da marca"       # feed-studio
"Vídeo de lançamento + adapta pra stories e carrossel"  # campanha multiformato
```

Sem comando decorado: o `studio-director` dispara quando você pede qualquer entrega —
vídeo/motion roteia para o `motion-director`; carrossel, stories e post seguem a pista estática.
Se você já sabe o estilo/ferramenta, cite-o — e a rota pula a decisão.
(Você ainda pode chamar individualmente: `/brag`, `/motion-director`, `use hyperframes…`.)

### Requisitos

| Requisito | Se usa |
|---|---|
| Node.js 22+ | tudo |
| FFmpeg no PATH (`sudo apt install ffmpeg`) | qualquer render |
| Python 3 (stdlib) | `ui-ux-pro-max` |
| Chrome/Chromium headless | checks do `anatomy`, export PNG do `diagram-design` |

> ⚠️ Aviso honesto: os estilos do `lemo-opuscar` foram calibrados para o **Claude Opus 5.5** —
> com outros modelos os filmes podem sair menos fiéis ao estilo.

### Estrutura

```
motion/
├── CLAUDE.md                              # 📕 manual de operações: 10 regras, restrições criativas,
│                                          #   política de reparo, entrega multi-formato, memória
├── README.md
├── pipeline.md                            # contratos de handoff: pista audiovisual + pista estática
├── .agents/skills/                        # fonte das skills (formato Agent Skills / skills.sh)
├── .claude/skills/                        # symlinks → descoberta pelo Claude Code
├── .opencode/skills/                      # symlinks → descoberta nativa do OpenCode
│
├── creative-core/                         # ⚙️ fundação compartilhada (agnóstica de agente)
│   ├── presets.json                       #   dimensões por plataforma (configuráveis)
│   ├── renderers/render_static.mjs        #   HTML/CSS → PNG via Playwright + Chromium
│   ├── quality/validate_static.py         #   dimensões, overflow, escala nativa
│   ├── exporters/zip_export.py            #   entrega empacotada
│   ├── gallery/                           #   galeria persistente (index.html + registry)
│   ├── brands/<slug>/                     #   marcas: PROFILE + tokens + approved/ (memória)
│   ├── INTEGRATIONS.md                    #   catálogo de integrações (nada entra sem registro)
│   └── COMPATIBILITY.md                   #   status honesto por agente
│
├── projects/<peca>/                       # produções estáticas (brief, estilo, slides/, out/)
├── public/{logos,screenshots,fonts,audio} # assets aprovados (somente reais, nunca fake)
├── references/                            # referências visuais (filmes, stills)
├── src/{compositions,components,animation}# código do renderer audiovisual
├── reviews/{frames,contact-sheets,findings.md} # trabalho do Crítico
├── out/{previews,final}                   # saída de render
├── BRIEF.md · STYLE.md · STORYBOARD.md    # artefatos do pipeline (por produção)
```

Qualquer agente compatível com [Agent Skills](https://skills.sh) descobre as skills automaticamente.

### Créditos

O estúdio é uma curadoria — todo o mérito da expertise pertence aos autores das skills:
**Emil Kowalski** (animação de UI · Vercel/Linear) · **LemoLab** (lemo-opuscar) · **HeyGen** (HyperFrames) ·
**Vincent Wei** (video-shotcraft) · **latent-spaces** (brag) · **Cathryn Lavery** (diagram-design) ·
**Ryan** (anatomy) · **nextlevelbuilder** (ui-ux-pro-max) · **Richard @richardrx** via heliocosta-dev (RCD) ·
**Matt Pocock** (grill-me) · **Impeccable**.
O `motion-director` e a camada multiformato v2 (`studio-director`, `carousel-studio`,
`story-studio`, `feed-studio`, `creative-core`) são os membros autorais deste repo.

---

## 🇺🇸 English

### What is this?

`motion` is an **AI-operated multiformat creative studio** — video, carousels, stories, feed posts
and campaign art. Any request ("make a promo for my product", "turn this article into a carousel")
becomes rendered output through a **director** that interviews you, decides **who produces** the
piece from its roster of specialist skills, and ships it with QA.

Not a generic generator. Every frame is written in code (HTML/CSS/Remotion/canvas/render engines),
deterministic, editable and re-renderable forever — the same cinematic rigor applied to every format.

### How it works

```
"I want a video" ───►  🎬 motion-director — one agent, five departments
                       │
                       ├─ 1 · DIRECTOR      grill-me-style briefing: purpose, duration,
                       │   │                 formats, style, sound, source material
                       │   └──► BRIEF.md ✋ approval
                       ├─ 2 · ART DIRECTOR  references ► typography, color, composition,
                       │   │                 motion, texture + explicit "avoid" list
                       │   └──► STYLE.md ✋ approval
                       ├─ 3 · STORYBOARD    scene by scene, timestamps + FRAME NUMBERS,
                       │   │                 continuity between scenes
                       │   └──► STORYBOARD.md ✋ approval
                       ├─ 4 · ANIMATOR      deterministic, frame-driven code — routed to
                       │                     the right producer (lemo-opuscar / video-shotcraft /
                       │                     brag / hyperframes + media-use, ui-ux-pro-max…)
                       ├─ 5 · RENDER ENGINEER  representative stills BEFORE any full render ·
                       │                 fonts, assets, fps, runtime checks
                       ├─ 6 · CRITIC ⚖️     independent review (fresh context) of the actual
                       │                 render: 1-10 scores, top-3 defects with exact frames,
                       │                 smallest useful fix, what to preserve
                       ├─ 7 · CORRECTION    local repair · max 2 rounds per defect ·
                       │                 then stop and escalate to you
                       └─ 8 · DELIVERY      16:9 + 1:1 + 9:16 (dedicated compositions, never
                                           crops) · MP4s, poster frames, contact sheets,
                                           editable source, production notes
```

The studio learns: a repeated mistake becomes a rule in `CLAUDE.md` — the next film inherits the fix.

### Multiformat studio (v2)

Beyond video, the studio produces **carousels, stories, feed posts and campaign art** —
same departments, independent critic, repair policy:

```
"Turn this launch into carousel + stories + post"
        │
        ▼
🚪 studio-director — dispatches the format (front door of the studio)
        ├─ video / motion          ──► motion-director (v1 pipeline, untouched)
        ├─ slide carousel          ──► carousel-studio (HTML/CSS → PNG 2160×2700)
        ├─ stories (static/anim.)  ──► story-studio (safe zones 1080×1920; animated via Remotion)
        └─ feed post / ad art      ──► feed-studio (single piece or variations)

        Shared foundation ── creative-core/
        ├─ render_static.mjs     Playwright + Chromium (deviceScaleFactor 2, never upscale)
        ├─ validate_static.py    dimensions, overflow, native scale
        ├─ zip_export.py         packaged delivery (editable source included)
        ├─ build_gallery.py      persistent gallery: slider, side-by-side compare, download
        └─ brands/<slug>/        PROFILE.md + tokens.json + approved/ (visual memory)
```

Static-track rules: platform sizes live in `creative-core/presets.json` (configurable, never
hardcoded) · visual memory per brand (consult `approved/` before creating) ·
recomposition ≠ crop · editability only when the HTML source ships with the export ·
integrations enter only with a record in `creative-core/INTEGRATIONS.md`.

### The roster (installed skills)

**🚪 Multiformat routing (v2)**

| Skill | Source | What it does |
|---|---|---|
| `studio-director` | *this repo (original)* | Front door: identifies the deliverable format and dispatches to the right studio |
| `carousel-studio` | *this repo (original)* | Code-based carousels: HTML/CSS → hi-res PNG, versioning, captions, ZIP, gallery |
| `story-studio` | *this repo (original)* | Static and animated stories with safe zones and sequences |
| `feed-studio` | *this repo (original)* | Feed posts, cards, typographic posts, infographics, campaign art |

**🎥 Video production**

| Skill | Source | What it does |
|---|---|---|
| `motion-director` | *this repo (original)* | The director: brief, route, deliver |
| `hyperframes` + `hyperframes-cli` + `hyperframes-registry` + `media-use` | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | HTML→MP4 render core, ~450 ready blocks, media production (music, voiceover, SFX) |
| `video-shotcraft` | [Vincentwei1021/video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) | Cinematic promos with Remotion: captures real pages, 124 shot recipe cards, beat-synced cuts |
| `brag` | [latent-spaces/brag](https://github.com/latent-spaces/brag) | Launch films by reading the project's code directly |
| `lemo-opuscar` | [lemomo-ai/lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) | 59 fully-code-drawn film styles (watercolor, ukiyo-e, data storytelling…) |

**🎥 Video production**

| Skill | Source | What it does |
|---|---|---|
| `remotion-*` (12 official skills) | [remotion-dev/skills](https://github.com/remotion-dev/skills) | The Remotion team's own best practices: animation, audio/compositions, fonts, time-stamped captions, rendering, maps — avoids the classic timing and asset mistakes |

**🎨 Design & support**

| Skill | Source | What it does |
|---|---|---|
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Design system generator: 79 styles, 192 palettes, 74 font pairings |
| `impeccable` | [impeccable.style](https://impeccable.style) | 24 frontend design commands + 62 deterministic detector rules |
| `animate`, `animation-vocabulary`, `review-animations`, `improve-animations`, `animation-performance`, `find-animation-opportunities`, `emil-design-eng` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | Emil Kowalski's UI animation school (Vercel/Linear): correct curves, duration, interruption, performance |
| `apple-design` | same | Apple's design & fluid motion principles, translated for the web |
| `prototype` | same | Build multiple versions of a UI piece and switch between them |
| `anatomy` | [wheresryan22/anatomy](https://github.com/wheresryan22/anatomy) | Interactive isometric SVG/WebGL/3D figures that explain ideas |
| `diagram-design` | [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) | 45 editorial diagram types as HTML/SVG/PNG |
| `banner-design`, `brand`, `design`, `design-system`, `slides`, `ui-styling` | ui-ux-pro-max suite | Identity, banners, decks and design tokens |
| `revenue-centric-design` | [heliocosta-dev/revenue-centric-design](https://github.com/heliocosta-dev/revenue-centric-design) | 134 principles for products that convert, retain and monetize |

**🧭 Direction & quality**

| Skill | What it does |
|---|---|
| `grill-me` | A relentless interview to sharpen plans and designs |
| `diagnosing-bugs` | Diagnosis loop for render/audio/timeline failures |
| `thermo-nuclear-code-quality-review` | Extremely strict maintainability review (manual invocation) |

### Usage

```bash
# In any compatible agent (Claude Code, OpenCode, Codex…):
"I want a video of my product"                    # opens the briefing
"Make a 30s vertical teaser with pt-br narration"
"I need a promo in Swiss motion graphics style"
"Turn this article into a 7-slide carousel"       # carousel-studio
"Create 5 stories for the product launch"         # story-studio
"Create 3 post variations in the brand identity"  # feed-studio
"Launch video + adapt it into stories and a carousel"  # multiformat campaign
```

No command to memorize: `studio-director` triggers whenever you ask for any deliverable —
video/motion routes to `motion-director`; carousels, stories and posts follow the static track.
Already know the style or tool? Name it — routing skips the decision.
(You can still invoke skills directly: `/brag`, `/motion-director`, `use hyperframes…`.)

### Requirements

| Requirement | Needed by |
|---|---|
| Node.js 22+ | everything |
| FFmpeg on PATH (`sudo apt install ffmpeg`) | any render |
| Python 3 (stdlib only) | `ui-ux-pro-max` |
| headless Chrome/Chromium | `anatomy` checks, `diagram-design` PNG export |

> ⚠️ Honest disclosure: `lemo-opuscar` styles are tuned for **Claude Opus 5.5** —
> other models may not reproduce them faithfully.

### Structure

```
motion/
├── CLAUDE.md                              # 📕 operating manual: 10 rules, creative restrictions,
│                                          #   repair policy, multi-format delivery, studio memory
├── README.md
├── pipeline.md                            # handoff contracts: audiovisual track + static track
├── .agents/skills/                        # skill source of truth (Agent Skills / skills.sh format)
├── .claude/skills/                        # symlinks → Claude Code discovery
├── .opencode/skills/                      # symlinks → native OpenCode discovery
│
├── creative-core/                         # ⚙️ shared foundation (agent-agnostic)
│   ├── presets.json                       #   per-platform dimensions (configurable)
│   ├── renderers/render_static.mjs        #   HTML/CSS → PNG via Playwright + Chromium
│   ├── quality/validate_static.py         #   dimensions, overflow, native scale
│   ├── exporters/zip_export.py            #   packaged delivery
│   ├── gallery/                           #   persistent gallery (index.html + registry)
│   ├── brands/<slug>/                     #   brands: PROFILE + tokens + approved/ (memory)
│   ├── INTEGRATIONS.md                    #   integration catalog (nothing enters unregistered)
│   └── COMPATIBILITY.md                   #   honest per-agent status
│
├── projects/<piece>/                      # static productions (brief, style, slides/, out/)
├── public/{logos,screenshots,fonts,audio} # approved assets (real ones only, never faked)
├── references/                            # visual references (films, stills)
├── src/{compositions,components,animation}# audiovisual renderer source
├── reviews/{frames,contact-sheets,findings.md} # the Critic's workspace
├── out/{previews,final}                   # render output
├── BRIEF.md · STYLE.md · STORYBOARD.md    # pipeline artifacts (per production)
```

Any agent compatible with [Agent Skills](https://skills.sh) discovers these automatically.

### Credits

The studio is a curation — all domain expertise belongs to the skill authors:
**Emil Kowalski** (UI animation · Vercel/Linear) · **LemoLab** (lemo-opuscar) · **HeyGen** (HyperFrames) ·
**Vincent Wei** (video-shotcraft) · **latent-spaces** (brag) · **Cathryn Lavery** (diagram-design) ·
**Ryan** (anatomy) · **nextlevelbuilder** (ui-ux-pro-max) · **Richard @richardrx** via heliocosta-dev (RCD) ·
**Matt Pocock** (grill-me) · **Impeccable**.
The v2 multiformat layer (`studio-director`, `carousel-studio`, `story-studio`, `feed-studio`,
`creative-core`) is original to this repo, alongside `motion-director`.
