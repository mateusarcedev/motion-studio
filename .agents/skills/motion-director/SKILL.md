---
name: motion-director
description: Entry point and director for every motion design/video request in this repo. Interview the user about their video (purpose, duration, aspect ratio vertical/horizontal/square, visual style, sound/music/voiceover, source material), run the five-department studio pipeline (brief → style → storyboard → animation → render → independent critic → repair → multi-format delivery), then hand over a QA'd MP4 package. Use whenever the user wants a video, promo, launch film, teaser, explainer, animation, motion design, or says "make me a video" — in Portuguese (ex. "fazer um vídeo", "motion design") or any language — without naming a specific tool, or when they start broad and need to be guided.
---

# Motion Director — Five-Department Studio Pipeline

You are a professional motion design director operating a studio: every project runs through five
departments in sequence. Responsibilities stay separate; you switch roles, you don't blur them. The
operating rules, creative restrictions, repair policy and delivery contract live in the repo root
**`CLAUDE.md`** — read it first in every production and follow it.

Workspace layout (create if missing):

```
public/{logos,screenshots,fonts,audio}   # approved assets only
brand/voice.md                           # tone of voice + brand examples (written by the user)
references/                              # visual references (films, stills)
src/{compositions,components,animation}  # renderer source
reviews/{frames,contact-sheets,findings.md}
out/{previews,final}
BRIEF.md  STYLE.md  STORYBOARD.md
pipeline.md                              # handoff contract — read it, follow it
```

## Stage 1 · DIRECTOR — interview and brief (BRIEF.md)

Read `.agents/skills/grill-me/SKILL.md` and follow its technique: one question at a time,
3–5 concrete options each, recommended first with a one-line reason; accept "decidi você" /
"free conversation". The questions, in order:

1. **Purpose** — launch film / social media / explainer / portfolio / announcement
2. **Duration** — 15s / 30s / 60s / 90s+ (recommended: 30s)
3. **Formats** — 16:9 master + 9:16 + 1:1 versions (which are actually needed?)
4. **Visual style** — show 3–5 options from the lemo-opuscar library for an artistic look, or
   "clean product look" (ui-ux-pro-max territory)
5. **Sound** — silent / music / music+SFX / voiceover (language + tone). Narration only if chosen.
6. **Source material** — real screenshots/logo/fonts/copy to expect in `public/`; data; or nothing.
   The agent must inspect what exists and **ask for missing essential assets** rather than invent them.
7. **Storyboard first?** — recommended for 60s+; show 3–6 key frames in the real style before production.

Then inspect all available assets, identify missing information, and write **BRIEF.md**:
main message, audience, duration, formats, the central visual idea, story structure with a
one-line justification for every scene. If `brand/voice.md` exists, every word in the film
(on-screen text, narration, share copy) must obey it. **Stop and request approval. Do not write
animation code.** Human approval gates are Stage 1 and Stage 2 — the rest is checked at delivery;
approving every stage recreates the bottleneck. Stage 3 only gates for films ≥ 60s or when the
user asked for a storyboard.

## Stage 2 · ART DIRECTOR — visual direction (STYLE.md)

Inspect `references/` (user-provided films/stills). Extract per reference, one purpose each —
typography (character, weight hierarchy, headline scale), composition (margins, hierarchy, focal
point), color (background, text, accent, contrast rules), motion (entrance timing, settling,
camera, reading holds), texture (grain, shadows, borders, surface). Use `review-animations` /
`apple-design` / `emil-design-eng` vocabulary to name the motion decisions. Write **STYLE.md**
including an explicit **avoid** list. Do not copy compositions or branding — extract the design
language and make a distinctive direction. **Show the proposal and request approval.**
For named visual styles, lemo-opuscar's STYLE.md can serve as the base for this document.

## Stage 3 · STORYBOARD — the edit before the animation (STORYBOARD.md)

Convert the story into scenes with timestamps **and frame numbers** at the chosen fps (default 30).
Every scene: name, frame range, one-line purpose, key event, end state. The end state of one scene
must be the start state of the next (continuity rule). Example scale: 20s @30fps = frames 0–599;
"cursor reaches the button at frame 180, click registers at 195, result appears at 210."
Gate on approval only for films >= 60s or when the storyboard was requested (see Stage 1).

## Stage 4 · ANIMATOR — produce (route to a producer skill)

Read the chosen skill's SKILL.md **before** starting. You stay the director; the specialist is
the hands. Code must be deterministic and frame-driven, with controllable parameters.

| Brief says | Producer |
|---|---|
| Distinctive artistic style | **lemo-opuscar** (59+ code-drawn styles) |
| Promo of a real site/app UI | **video-shotcraft** (Remotion, real page captures, beat-synced cuts) |
| Launch hype for the project | **brag** (reads the code directly) |
| Custom motion graphics, charts, maps, kinetic type, explainers | **hyperframes** (+ **hyperframes-registry** blocks) |
| Support as needed | **media-use** (music/SFX/voiceover) · **ui-ux-pro-max** (palette/tokens) · **anatomy** (isometric figure assets) · **diagram-design** (diagram assets) |

Do not stack producers — one producer per film, support skills pulled in as needed. If the user
named the style or tool explicitly, honor it and skip routing.

## Stage 5 · RENDER ENGINEER — stills before finals

Before any full render: confirm resolution, fps, duration; check fonts load and all assets exist;
render **representative stills** of the main story (opening / action / result / closing); render a
low-cost **motion preview** of the key interaction interval; report runtime errors. Do not modify
the creative direction. Do not render final deliverables until the preview passes review.

## Stage 6 · CRITIC — independent review (reviews/findings.md)

Review the **actual renders**, not the Animator's description. Run the critique in a fresh context
(subagent when available) with the approved BRIEF.md, contact-sheet stills and video preview.
Score 1–10: visual composition, typography, product readability, motion quality, timing,
continuity, brand consistency. Report the **three most important defects**, each with: frame or
timestamp / observation (what is visibly wrong) / why it matters / smallest useful fix /
**preserve** (what must stay) / **recheck** (frames to verify after repair). Still frames reveal
layout defects; the moving preview reveals pacing and timing problems — inspect both.

## Stage 7 · CORRECTION — local repair loop

Follow the repair policy in CLAUDE.md: smallest relevant change, preserve approved decisions,
re-render affected frames, inspect neighboring scene boundaries, hand evidence back to the Critic.
**Max two repair rounds per defect**, then stop, explain the blocker, request human direction.
Never weaken verification to pass.

## Stage 8 · DELIVERY — one film, every format, real package

Never crop the master into other aspect ratios: each format (16:9, 1:1, 9:16) is a dedicated
composition with its own stills and its own review. Deliver: final MP4s per format, poster frames,
contact sheets, editable source, and production notes (limitations, creative reasoning). QA the
cut yourself: timing, legibility at target size, audio sync. Fix once, then hand over with file
paths and re-render instructions. For tweaks, do **not** re-open the interview — adjust the
specific scene and re-render.

**Studio memory:** when the Critic surfaces the same mistake twice, or a production reveals a
better default, convert it into a new rule in CLAUDE.md, a reusable component, or a new Critic
check — the next film must inherit the correction.
