# Reusable Motion Components & Advanced Rendering Implementation Plan

> **For agentic workers:** execute these tasks in order; do not commit, push, deploy, or publish.

**Goal:** Extend MOTION's existing Creative Core with reusable motion components and verifiable alpha, transition, determinism, and safe-zone workflows.

**Architecture:** `motion-core` owns the distributable APIs and continues to delegate capture to its existing Playwright frame renderer and video encoding to FFmpeg. The parallel `creative-core` script paths stay compatible and mirrored where existing skills call them directly.

**Tech Stack:** Node.js ESM, Playwright Chromium, SVG/HTML, Python stdlib, FFmpeg/FFprobe.

**Spec:** `docs/superpowers/specs/2026-11-16-reusable-motion-components-design.md`

## Global Constraints

- Keep Creative Core and its deterministic frame renderer as the only render engine.
- Do not make GSAP mandatory or copy third-party reference files/assets.
- Preserve MP4 assembly defaults and existing CLI commands.
- Treat platform safe-zone defaults as versioned editable heuristics with provenance.
- Do not commit, push, deploy, publish npm, alter the pending gallery, or modify published TRAVESSIA/Máquinas de Estados video projects.

## Review Focus

- Long/Unicode text and malicious markup: component validation and escaping.
- Transparent Chromium screenshots and VP9 decode: transparent pixels, partial alpha, metadata, halos.
- FFmpeg expression boundaries and consecutive transitions: first/last frames, duration, no gaps/black.
- Async fonts/assets and timer use: report risk and dynamic cross-session pixel differences.
- Safe-zone inputs without declared important bounds: report visual-inspection requirement instead of inferring semantics.

### Task 1: Component registry and generation contract

**Files:** `packages/motion-core/components/index.js`, `packages/motion-core/index.js`, `tests/motion_components.test.mjs`, and mirrored Core docs.

- [ ] Export `animated-counter`, `animated-ranking`, `comparison-panel`, `timeline-sequence`, `progress-gauge`, `kinetic-text-reveal`, `image-reveal`, and `data-callout` with explicit schemas/defaults.
- [ ] Normalize/validate config and generate deterministic, responsive SVG/HTML with importance bounds and provenance.
- [ ] Cover valid defaults, invalid values, escaping, aspect ratios, duration, and all IDs in Node tests.

### Task 2: Transparent WebM export

**Files:** `packages/motion-core/renderers/render_frames.mjs`, `packages/motion-core/renderers/assemble_video.py`, `packages/motion-core/index.js`, CLI render integration, and mirrored in-repository render scripts.

- [ ] Add opt-in transparent Playwright PNG captures and VP9 alpha assembly.
- [ ] Keep MP4 output unchanged and expose programmatic/CLI overlay rendering.
- [ ] Verify a real title overlay by decoding alpha and compositing on light, dark, and moving backgrounds.

### Task 3: FFmpeg transitions

**Files:** `packages/motion-core/transitions/ffmpeg.py`, `packages/motion-core/index.js`, CLI transition integration, and `tests/transitions.test.py`.

- [ ] Implement validated `xfade` filters for wipe, push, slide, reveal, mask reveal, flash, split, and directional transitions.
- [ ] Implement linear, ease-in, ease-out, ease-in-out, cubic, quint, and bounded custom easing expressions.
- [ ] Render a comparison sheet/video and validate boundaries, consecutive composition, frame rate, duration, aspect, and color metadata.

### Task 4: Determinism and safe-zone QA

**Files:** `packages/motion-core/quality/determinism.mjs`, `packages/motion-core/quality/safe_zones.mjs`, `packages/motion-core/safe-zones/presets.json`, `packages/motion-core/index.js`, CLI QA integration, and focused tests.

- [ ] Render selected frames in two independent fresh renderer processes and compare SHA-256.
- [ ] Record runtime/browser/font/FFmpeg provenance and produce A/B/difference evidence on mismatches.
- [ ] Add versioned presets for Instagram Reels/Stories, TikTok, YouTube Shorts/horizontal, feed 4:5, square, and custom formats; identify each default as an editable MOTION heuristic with source/version metadata.
- [ ] Sample key timeline times and check declared important bounds.
- [ ] Save a QA-only overlay and clearly mark media without trustworthy internal bounds for visual inspection.

### Task 5: Public integration and guidance

**Files:** `packages/motion-cli/bin/motion.mjs`, `packages/motion-cli/lib/*`, package exports/files, Core/CLI READMEs, component/QA docs, and relevant director skill references.

- [ ] Add working component, overlay render, transition, determinism, and safe-zone commands with argument errors/help.
- [ ] Ensure npm tarballs include runtime files and API exports.
- [ ] Teach studio-director, motion-director, and explainer-motion to discover/use components without requiring them.

### Task 6: Homologation and report

**Files:** `projects/mission-19/`, `REUSABLE_MOTION_COMPONENTS_REPORT.md`, and only if needed focused test fixtures.

- [ ] Render the parameterized ranking at 9:16 and 16:9, MP4 and WebM, with poster/QA frames, then change data without changing component source.
- [ ] Render a short API explainer and a synthetic authorized overlay-composition demo.
- [ ] Run sampled independent determinism, safe-zone, font, FPS, size, duration, FFprobe, contact-sheet, and moving-video checks.
- [ ] Install packed package tarballs in a separate temporary consumer directory without reading monorepo files and record the result.
- [ ] Report audited baseline, tested results, artifacts, environment, licensing, limitations, and final Git status.
