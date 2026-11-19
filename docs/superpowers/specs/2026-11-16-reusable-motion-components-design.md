# Reusable Motion Components — Design

## Intent

Add reusable, data-driven motion components and verifiable video output to MOTION while retaining the existing Creative Core, Playwright frame renderer, FFmpeg assembly, CLI, and skill ecosystem.

## Goals

- Provide eight parameterized primitives with stable IDs, input validation, explicit defaults, preview and render contracts, responsive aspect ratios, accessible long text handling, and provenance metadata.
- Export RGBA frame sequences as VP9 WebM with alpha, while preserving MP4 as the default video output.
- Add FFmpeg `xfade` transitions with named easing curves and configurable direction and timing.
- Compare sampled PNG hashes from separate fresh Playwright renderer processes and report useful failure evidence.
- Check declared important element bounds against versioned, editable social format presets across sampled timeline states.
- Expose these capabilities via `motion-core`, `motion` CLI, relevant director references, and an isolated package-consumer install.

## Non-goals

- A second rendering engine, required GSAP, fixed art direction, platform guarantees about safe areas, or binary identity guarantees for encoded video.
- Editing published TRAVESSIA or Máquinas de Estados videos, modifying the pending gallery, committing, pushing, deploying, or publishing npm packages.

## Current state and constraints

The public package is `packages/motion-core`; the CLI imports it and the npm package includes renderers, quality tools, exporters, and `presets.json`. In-repository skills also invoke `creative-core/renderers/*` paths directly. The frame driver and renderers are mirrored byte-for-byte in these trees, so changed shared scripts must be mirrored and checked. Existing MP4 assembly validates contiguous frame numbering, existing manifests hash assets, and `presets.json` has generic feed/story dimensions and margins but no platform provenance or temporal geometry checks.

The reference project (`skeattt/motion-graphics-programatico`) demonstrates parameterized HTML pieces, a fresh-browser double-render verifier, VP9 alpha export, safe-area evidence, and custom `xfade` expressions. Its repository license is MIT; GSAP and bundled fonts/assets have separate terms. This implementation will use the ideas and public contracts only; it will not copy reference files or make GSAP a dependency.

## Approaches

1. Add a new render engine and port the reference architecture. Rejected because the request forbids replacing or duplicating Creative Core.
2. Add small APIs to `motion-core` that generate deterministic SVG/HTML and delegate all frame capture and encoding to existing Playwright/FFmpeg tools. Selected because it fits the package boundary, keeps browser timing under `__MOTION__`, and gives CLI and programmatic consumers the same path.
3. Put the behavior only in agent skills. Rejected because capabilities must be available to every relevant specialist and to npm consumers.

## Architecture

`components/` owns stable component schemas, normalization, SVG/HTML generation, and importance bounds. `renderers/assemble_video.py` gains an opt-in WebM alpha mode; the existing MP4 mode stays the default. `transitions/` owns validated transition contracts and FFmpeg filter construction. `quality/` owns fresh-process determinism checks and safe-zone sampling/evidence, using Playwright and the existing frame protocol. CLI operations delegate to the package API. Safe-zone values are versioned MOTION defaults with explicit heuristic provenance and remain editable; they are not presented as platform-issued specifications.

## Contracts

- Component config: `{component, duration, fps, aspectRatio, theme, ...componentData}`. Duration and FPS are authoritative; values are validated and defaults are explicit in exported schemas.
- Component generation: `validateComponentConfig(config) -> normalizedConfig`; `generateComponentHtml(config) -> html`; `listMotionComponents() -> descriptors`.
- Rendering uses the existing `renderFrames` API, where each frame is a pure function of `window.__MOTION__`. Fonts and image assets settle before first measurement/capture.
- Determinism QA returns environment/provenance, selected frames, per-session SHA-256 hashes, static-risk diagnostics, and A/B/difference PNG evidence on mismatch. Pixel determinism is scoped to a recorded local environment.
- Safe-zone QA accepts a composition and named/custom preset, samples the beginning/end and intermediate timeline states, and checks only explicitly exposed important bounds. The overlay is a separate QA artifact.
- WebM alpha output is opt-in and validates stream metadata plus decoded alpha values. MP4 output remains unchanged.
- Transition contract: `{kind, duration, offset, direction, easing, accentColor?, ...}`. Scene transitions use `xfade`; transparent overlays remain a separate encode/composite stage.

## Validation

Use focused Node/Python unit tests, small real Playwright/FFmpeg renders, alpha decode and composite checks, independent package installation from generated tarballs, and three reproducible demonstration productions. Do not infer success from file existence; record commands, tool versions, hashes, and artifacts in `REUSABLE_MOTION_COMPONENTS_REPORT.md`.
