# Motion Studio — Operating Manual

This repository is an AI-operated motion design studio. The production agent directs, designs,
animates, renders, and reviews code-made films. The director workflow lives in
`.agents/skills/motion-director/SKILL.md`; these rules apply to **every** production.
The explicit handoff contract (who reads what, who writes where, which stages gate on human
approval) lives in **`pipeline.md`**.

_Para humanos: este arquivo é o manual de operação do estúdio. Toda produção segue estas regras;
um erro que se repete deve virar uma nova regra aqui. O tom de voz e os exemplos de marca ficam
em `brand/voice.md` — escrito à mão pelo dono do estúdio._

## Operating rules

1. **Never begin implementation before the storyboard exists.** STORYBOARD.md first, code second.
2. **Use only approved product assets.** Never invent UI, metrics, testimonials, dashboards, or
   product capabilities. If an essential screen is missing, ask for it instead of drawing a fake.
3. **Every animation is driven by frame number or deterministic time.** No random values, no
   wall-clock timing. The film must be reproducible frame-for-frame.
4. **One primary visual direction across the entire film.** STYLE.md, not vibes.
5. **Do not animate without a communication purpose.** If the motion doesn't carry meaning, it is
   decoration; delete it.
6. **Render representative still frames before any full render.** The main story must be legible
   in 4 stills (opening / action / result / closing) before spending render time.
7. **Review the rendered result, never the source code alone.** Successful render ≠ complete film.
8. **Repair locally.** A defect at frame 210 must not rewrite the storyboard. Only the creative
   concept being broken justifies restarting the design.
9. **Preserve all editable source.** The deliverable includes code that can re-render the film.
10. **Never skip an approval gate or weaken a verification to pass a review.**

## Creative restrictions (avoid everywhere)

- Generic gradient backgrounds
- Excessive bouncing / ease-out violations for enter animations
- Glowing particles and lens flares
- Unreadable text (small, low-contrast, or moving during the read)
- Fake product dashboards or invented UI screens
- Camera movement without purpose
- Random jumps between unrelated compositions (continuity rule: a scene's end state is the next
  scene's start state)

## Multiformat studio (v2)

The studio now produces beyond video: **carousels, stories (static/animated), feed posts and
campaign art**, through the same departments, independent critic and repair policy. Additions:

- **Routing:** `studio-director` is the front door; it dispatches to **motion-director**
  (video — v1 pipeline untouched) or **carousel-studio / story-studio / feed-studio** (static).
- **Agent-agnostic engines:** renderer (`creative-core/renderers/render_static.mjs`, Playwright +
  Chromium), validator (`validate_static.py`), exporter (`zip_export.py`) and gallery
  (`build_gallery.py`) run via CLI and belong to no agent.
- **Brand system:** `creative-core/brands/<slug>/` (PROFILE.md + tokens.json + assets/ +
  approved/). Visual memory: consult `approved/` before creating; every approved piece feeds the
  brand's `approved/`. Brands are isolated; `brand/voice.md` remains the studio's default voice.
- **Dimensional presets:** `creative-core/presets.json` — platform sizes are configurable,
  never hardcoded inside skill instructions.
- **Recomposition ≠ crop:** every aspect ratio gets its own hierarchy.
- **Honest editability:** only claim "editable" when the source (HTML/code) ships with the export.
- **Code-driven determinism (video/animated):** frame N reproduces bit-for-bit. Use
  `render_frames.mjs` (batch, one browser) + `assemble_video.py` ( CFR 30fps, audio aligned to
  the same time grid, t=0 = frame 0) + `design-system/frame.js` (pure per-frame state — never
  `Math.random()`/CSS keyframes in video). Seed and frame count go in the BRIEF.
- **Gates:** before any full render, produce beat stills and a contact sheet
  (`build_contact_sheet.py`) for the Critic — FFmpeg/Chromium finishing is **not** QA.
  Defect-free stills ≠ approved; approval is human/Critic sign-off.
- **Integrations:** nothing enters without a record in `creative-core/INTEGRATIONS.md`; untested
  agent compatibility is not compatibility (`creative-core/COMPATIBILITY.md`). License states
  (gratuito ≠ open source ≠ source available) live there with evidence; SBOM in
  `creative-core/THIRD_PARTY.md`.

## Departmental contracts

| Department | Produces | Approval gate |
|---|---|---|
| **Director** | BRIEF.md — message, audience, duration, formats, story | User approval BEFORE code |
| **Art Director** | STYLE.md — typography, color, composition, motion, texture, and an explicit "avoid" list | User approval |
| **Animator / Composer** | Source code — deterministic, frame-driven (video) or slide documents (static) | — |
| **Render Engineer** | Stills/previews first, then final exports; runtime QA (fonts, assets, fps, overflow) | — |
| **Critic** | reviews/findings.md — evidence-based defects with exact frames | Sign-off before delivery |

The Critic must not be the same context that animated/composed the piece: it reviews the render
artifact (contact sheet + moving preview), not the producer's description. Use a subagent or
fresh context when available.

## Repair policy

For every defect from the Critic:

1. Read the Critic's evidence.
2. Make the **smallest relevant change**; preserve approved decisions.
3. Patch affected source; re-render affected frames.
4. Inspect neighboring scene boundaries.
5. Return new evidence to the Critic.

**Maximum two repair rounds per defect.** If unresolved after two rounds: stop, explain the
blocker, request human direction. Never remove verification requirements just to make a review pass.

## Multi-format delivery

Never produce the vertical/ square versions by cropping the master. Each format (16:9, 1:1, 9:16)
gets its own composition/layout with its own stills and review — same story, changed composition.

A delivery package includes: final MP4s per format, poster frames, contact sheets, editable
source, and production notes (remaining limitations, reasoning behind creative calls).

**A film is not complete because the MP4 exists. It is complete when the approved brief and the
verification requirements are met.**

## Studio memory (keep the studio, replace the project)

Only project-specific inputs change between productions. When the Critic surfaces the same
mistake twice — or a rendered film reveals a better default — convert the lesson into:

- a new rule in this manual,
- a reusable component/token,
- or a new review check in the Critic stage.

Every finished film should leave the studio better than it found it.
