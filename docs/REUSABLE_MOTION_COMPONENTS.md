# Reusable Motion Components & Advanced Rendering

The motion component API is an optional production aid built on the existing MOTION Creative Core frame driver, Playwright renderer, and FFmpeg assembler. It does not replace scene direction or require a shared visual style. A director can use a component, combine several, or write a custom composition when that serves the piece better.

## Components

The public `motion-core` API exposes eight versioned component IDs:

| ID | Main parameters |
|---|---|
| `animated-counter` | `label`, `from`, `value`, `decimals`, `prefix`, `suffix` |
| `animated-ranking` | `title`, `max`, `items[{label,value,detail?}]` |
| `comparison-panel` | `title`, `max`, `items[{label,value,detail?}]` |
| `timeline-sequence` | `title`, `events[{time,label,detail?}]` |
| `progress-gauge` | `label`, `value`, `max`, `suffix` |
| `kinetic-text-reveal` | `text`, `revealBy: word\|line\|block` |
| `image-reveal` | `src`, `alt`, `focalPoint` |
| `data-callout` | `value`, `label`, `detail` |

Each descriptor includes a JSON Schema, explicit defaults, stable ID/version, and native provenance metadata. Every instance also accepts `duration`, integer `fps`, `aspectRatio`, `instanceId`, `theme`, and `transparent`. The renderer loads `document.fonts.ready` and image assets before capturing; the component timeline is driven by the frame renderer's `window.__MOTION__` state.

```js
import { listMotionComponents, validateComponentConfig, renderMotionComponent } from "@technomanceer/motion-core";

console.log(listMotionComponents().map(({ id, schema }) => [id, schema.$id]));
const config = validateComponentConfig({
  component: "animated-ranking",
  title: "Top 3 linguagens (dados fictícios)",
  items: [{ label: "TypeScript", value: 95 }, { label: "Python", value: 90 }, { label: "Rust", value: 82 }],
  max: 100,
  duration: 6,
  fps: 30,
  aspectRatio: "9:16",
  theme: { primary: "#2563EB", background: "#101827", text: "#FFFFFF" }
});
await renderMotionComponent(config, "./ranking.mp4");
await renderMotionComponent({ ...config, transparent: true }, "./ranking.webm");
```

CLI equivalent:

```bash
motion components list
motion components preview animated-ranking --config=ranking.json --output=poster.png
motion components render animated-ranking --config=ranking.json --output=ranking.mp4
motion components render animated-ranking --config=ranking.json --output=ranking.webm
```

The same configuration can be reused with different data, theme tokens, aspect ratio, or duration. Component layouts adapt to the target composition ratio and constrain long copy to its declared text boxes. For `image-reveal`, provide a project-local asset path when possible; remote HTTPS inputs may depend on network availability. The safe-zone checker treats image/video semantics as requiring manual review.

## MP4 and transparent WebM

`motion render video` and normal `.mp4` component renders retain the existing H.264, `yuv420p`, CFR pipeline. A `.webm` component render or `motion render overlay ... --output=...webm` uses VP9 with `alpha_mode=1`, lossless encoding, and no forced opaque background. The exporter validates VP9 metadata and uses the libvpx VP9 decoder plus `alphaextract` at beginning/middle/end to check transparent and partially transparent pixels. Some FFprobe/native decoder summaries report `yuv420p` even when the WebM alpha side data exists; that field alone is not proof either way.

```bash
motion render overlay ./overlay.html --output=./overlay.webm --duration=5 --fps=30 --width=1080 --height=1920
```

Transparent overlay and scene-to-scene transitions are separate workflows. `motion transition` composes opaque scene clips; it does not silently merge the alpha overlay pipeline.

## FFmpeg transitions

The programmatic `listTransitions()` and `renderTransition(inputs, output, transition, options)` API, and the CLI, use the existing FFmpeg pipeline with custom `xfade` expressions. Supported kinds are `wipe`, `push`, `slide`, `reveal`, `mask-reveal`, `flash`, `split`, and `directional`. Curves are `linear`, `ease-in`, `ease-out`, `ease-in-out`, `cubic`, `quint`, or a monotonic custom cubic supplied as three coefficients that sum to 1. Direction, duration, offset, softness, mask scale, and accent color are configurable. No bounce/spring motion is added by default.

```bash
motion transition list
motion transition render scene-a.mp4 scene-b.mp4 scene-c.mp4 \
  --output=joined.mp4 --kind=directional --direction=left --easing=quint --duration=0.7
motion transition preview scene-a.mp4 scene-b.mp4 --output=transition-preview.mp4 --kind=wipe
```

Preview renders default to 640×360 at 15 fps unless overridden. Composition outputs are CFR H.264, scaled to a shared canvas and tagged BT.709. Transition offsets describe the first cut; subsequent cuts continue after the accumulated prior scene duration.

## Determinism QA

`verifyDeterminism(html, options)` starts the existing frame renderer twice as separate processes, which creates independent Chromium sessions. It samples the same frame indices, hashes PNG bytes with SHA-256, records environment and font data, and writes A/B frames plus a difference image when hashes diverge. Static diagnostics for wall-clock reads, unseeded random calls, unmanaged timers, CSS animations, and autonomous RAF loops supplement the dynamic result. Missing fonts, browser page errors, or different sampled frame hashes block deterministic approval.

```bash
motion qa determinism ./composition.html --output=./qa/determinism --duration=8 --fps=30
```

This proves sampled pixel determinism in the recorded environment; it does not promise byte-identical MP4 containers across different Chromium, FFmpeg, font, or codec builds. Artifact file hashes and temporal frame reproducibility are reported separately.

## Safe zones QA

`qaSafeZones(html, options)` samples the timeline at half-second intervals and the final frame by default. Important geometry is declared with `[data-motion-important="name"]`; visibility follows opacity. An element without trustworthy bounds is not assigned semantic importance automatically. The QA report includes the preset and provenance, sampled bounds, a JSON report, frame overlays, and overlay-only PNG previews. These overlays never enter the final video.

Presets: `instagram-reels`, `instagram-stories`, `tiktok`, `youtube-shorts`, `youtube-horizontal`, `feed-4-5`, `square-1-1`, and user-configured. Platform UI changes; built-in social margins and UI regions are versioned MOTION heuristics, not official permanent platform specifications. Review/update them for the target app version. Image/video elements require manual visual inspection because bounding boxes cannot identify important content inside the media.

```bash
motion qa safe-zones ./composition.html --platform=instagram-reels --output=./qa/safe-zones --duration=8
motion qa safe-zones ./composition.html --platform=custom --preset-file=./safe-zones.json --width=1600 --height=900
```

Custom preset example:

```json
{
  "id": "client-16-9-v1", "platform": "Custom client canvas", "aspectRatio": "16:9",
  "referenceResolution": [1920, 1080],
  "margins": { "top": 5, "bottom": 8, "left": 5, "right": 5 },
  "reservedRegions": [], "attentionRegions": [],
  "sourceKind": "user-defined", "provenance": "Supplied by the production operator.", "version": "1"
}
```

## Director integration

`studio-director` routes the creative intent and format. `motion-director` or the relevant specialist then discovers candidates with `motion components list`, validates the contract against the approved data/storyboard, and combines components only when they fit the art direction. `explainer-motion` may use counters, timelines, callouts, and kinetic text; it may also implement a custom visual. This is infrastructure, not a mandatory template catalog.

## Provenance and licensing

The component, safe-zone, determinism, and transition code in this package is original MOTION Apache-2.0 code. The reference repository `skeattt/motion-graphics-programatico` is MIT; it informed feature research only. No reference source files were copied into this repository. GSAP is not a dependency. FFmpeg, Chromium, Playwright, fonts, and production assets retain their separate licenses; see `docs/LICENSES.md` and each asset's production attribution record. The reference's third-party assets and GSAP distribution are not re-bundled here.

## Consumer installation

The public API is packaged through `motion-core` exports (`.`, `./components`, `./transitions`, `./safe-zones`, and `./quality/determinism`) and the CLI binary. See `REUSABLE_MOTION_COMPONENTS_REPORT.md` for the independently installed consumer fixture and exact package-version result. No npm publication is performed by this implementation task.
