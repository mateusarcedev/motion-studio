# OpenDesign integration pilot — Mission 23 M6

**Date:** 2026-11-26 · **Result:** partial, with verified local renders and indirect OpenCode MCP; native OpenDesign MCP handoff not homologated.

## Installation audited

| Item | Verified value |
|---|---|
| OpenDesign | 0.27.2, release commit `d9691d7a8ba21ab57c52916dcf07ea87598e04fc` |
| Installed app | Electron desktop in `C:\Users\marce\AppData\Local\Programs\Open Design` |
| Profile/workspace | `C:\Users\marce\AppData\Roaming\Open Design\namespaces\release-stable-win\data` |
| New project | `Motion Studio — Integration Lab`, ID `04691291-53a3-44d0-b4ce-5d1cb1bb091e` |
| App agent | OpenCode embedded 1.19.6; separately installed WSL OpenCode CLI 2.2.5 |
| CLI | Packaged `resources/app/prebundled/daemon/daemon-cli.mjs`; `od` was not available in WSL `PATH` |
| App architecture | Electron renderer plus local project daemon/CLI. Agent loop delegates to an agent adapter; it is not a new Motion runtime. |
| Protocols | Packaged source includes an OpenDesign stdio MCP server, project/file/artifact tools and a local daemon endpoint. The runtime handshake was not established from this WSL session. |
| Native external MCP | Not established for the OpenDesign panel. In the observed panel run `toolBundle.mcpServers` was empty. |
| Indirect external MCP | Project-local OpenCode v2 config connected Motion MCP. Direct CLI agent rendered a real file. |
| Personal settings | No global OpenDesign, OpenCode, Codex, Claude or other personal configuration changed. |

The installed source and official release documentation were consulted at the exact commit. Relevant links: [agent adapters](https://github.com/nexu-io/open-design/blob/d9691d7a8ba21ab57c52916dcf07ea87598e04fc/docs/agent-adapters.md), [Skills protocol](https://github.com/nexu-io/open-design/blob/d9691d7a8ba21ab57c52916dcf07ea87598e04fc/docs/skills-protocol.md), and [plugin spec](https://github.com/nexu-io/open-design/blob/d9691d7a8ba21ab57c52916dcf07ea87598e04fc/docs/plugins-spec.md). OpenCode project configuration and Skills behavior were checked against its [MCP](https://opencode.ai/docs/mcp-servers/) and [Skills](https://opencode.ai/docs/skills/) docs.

## Skills and setup

The isolated project used Motion's existing installer and profiles. Sixteen Skills were installed under `.agents/skills`; the 11 requested Skills were present. OpenCode loaded nine that fit this task: `studio-director`, `motion-director`, `web-director`, `design-to-motion`, `motion-to-design`, `carousel-studio`, `story-studio`, `shorts-director`, `cinematic-product-director`. `reel-editor` was not applicable because this task did not edit an existing reel; `3d-scene-director` was not applicable to the 2D campaign.

`opencode.json` is project-scoped and uses the v2 `mcp.servers` shape, local Node, the Motion CLI entrypoint, and an explicit project workspace. The checked-in example has placeholders in [`opencode.project.example.json`](../../projects/m6-herbario-de-nevoa/evidence/opendesign/opencode.project.example.json). The project configuration demonstrated that **the underlying OpenCode CLI** can see Motion MCP; the OpenDesign panel process did not share that server list in the observed run.

## Project and assets

The new local project reuses the fictional campaign Herbário de Névoa produced in M6. It contains the responsive landing, dashboard, mobile layout, six editorial carousel slides, vertical story, storyboard, promotional video, representative animation frames, design tokens, an SVG illustration and an HTML specimen-card component.

The HTML/CSS/JSON/SVG files are editable text files in the local project. The card is not an OpenDesign native component instance. The video and PNGs are project files/visual references, not editable motion layers. The campaign palette and type stack come from the original `STYLE.md` and `tokens.json`; no second identity was created.

Project output `design-output/production/` has 41 manifested production files, 1,927,522 bytes. Manifest SHA-256: `f7c5b091025079f49037a1cecabf5b2c6b3ad65ebecfe7318414216e50e9aa5b`. Motion MCP's local screenshots and call record are in [`motion-mcp-results.json`](../../projects/m6-herbario-de-nevoa/evidence/opendesign/motion-mcp-results.json). The render reproduction script is [`verify-project-with-motion-mcp.mjs`](../../projects/m6-herbario-de-nevoa/evidence/opendesign/verify-project-with-motion-mcp.mjs); the project materializer only allows the approved project ID: [`materialize-project.mjs`](../../projects/m6-herbario-de-nevoa/evidence/opendesign/materialize-project.mjs).

## Motion MCP calls and QA

The official MCP client discovered **30 tools**, all with input and output schemas. In the approved project workspace it executed nine `render_static` calls for the project index, website, dashboard, mobile, carousel cover, story, storyboard, specimen card and SVG showcase. All nine returned `PASS`. It then called `qa_viewports` for the responsive website and `svg_validate` for the standalone SVG; both passed.

| Viewport | Result | Issues | Horizontal overflow |
|---|---|---|---:|
| 360×740 | PASS | none | 0 |
| 390×844 | PASS | none | 0 |
| 768×1024 | PASS | none | 0 |
| 1280×800 | PASS | none | 0 |
| 1920×1080 | PASS | none | 0 |

The nine render screenshot hashes and ten viewport screenshot hashes are persisted in `motion-mcp-results.json`. The separate OpenCode agent smoke produced `design-output/mcp-smoke.png`, 37,814 bytes, SHA-256 `91e3a1dc5a3dd193bd04a6fb4f54bebfb8489f585805c49446ef92b0650788ef`.

Manual review of dashboard, mobile and carousel screenshots found they retain the existing paper, ink, moss, clay and berry system. This review is visual comparison to the source campaign. It is not proof of OpenDesign native import, component editability, or round-trip fidelity.

## Agent production result

The OpenDesign panel's initial agent run terminated with `process_exit` code `3221225786` before producing project artifacts. The direct OpenCode 2.2.5 run loaded the nine Skills and called Motion MCP; one run hit the configured provider's `429 FreeUsageLimitError` before completing the requested 15-second production prompt. We did not switch to a paid provider. A separate direct OpenCode smoke did finish `render_static`, as recorded above. The videos and animation scenes exist from the earlier M6 Motion Studio production, but were not generated by the OpenDesign panel agent.

Therefore the row **“produção usando Motion MCP” is PARTIAL**: the agent successfully called a real Motion MCP render, while the end-to-end video workflow through the app agent was not completed.

## Import/export findings

OpenDesign's installed MCP code includes project-scoped read/write/list/search and artifact operations for local project files; its text-file contract covers HTML, JSX, CSS, JSON, SVG and Markdown. The packaged CLI also includes a local stdio MCP entrypoint. The local daemon could not be reached through this WSL/Windows test path, so project file operations were not verified through that MCP connection.

The pilot placed HTML, CSS, JSON, SVG and media files in the newly created project directory and rendered them through Motion MCP. It did not import these as native OpenDesign layers and did not verify readback through the OpenDesign MCP. The current `bridge_import_design` entrypoint accepts a frame JSON from the Doop MCP and calls a Doop-only adapter (`source.editor: "doop"`); it is not an OpenDesign project importer. `bridge_normalize_design` accepts a validated `MotionDesignIR@1`, but Motion Studio has no supported extractor that maps the OpenDesign project tree and its document/component semantics into that IR. We did not relabel OpenDesign files as Doop or hand-build an unverified adapter. The project's file HTML was rendered directly, which proves local rendering only; it does not prove Design Bridge import, semantic token preservation, component fidelity, or native layer editability. An OpenDesign source adapter is a concrete candidate for the generic Universal Design Bridge roadmap, outside this pilot. Classifications:

| Item | Pilot classification |
|---|---|
| HTML/CSS/tokens/SVG | Editable local text files; native canvas-layer import not tested |
| Image/animation frames | Rasterized visual references |
| MP4 video | Reference/playback artifact; native editable timeline not tested |
| Dashboard/mobile HTML | Editable files; native components and responsive behavior inside the app not tested |
| Storyboard | Editable Markdown/HTML files; native editor support not tested |
| Design tokens | Editable JSON/CSS; OpenDesign semantic token model not verified |
| Reusable card | HTML/CSS source only; native component library not verified |

No source adapter was implemented. The format gap above is documented for future consideration; the pilot does not justify a complete editor-specific adapter, and none is required for direct rendering of local HTML/CSS/SVG files.

## Doop cross-check

Doop is separate and remains optional. The exact authorized canvas is [`Motion Studio — Integration Lab`](https://doop.design/c/Gz620okdHY); it still has only the original six frames. The Doop MCP public tool schemas show image upload for local assets, but the user has not authorized the five new uploads in the current Motion-to-Design plan. No frames or assets from that plan were sent.

The verified dry-run plan for that same canvas is [`export-plan.dry-run.json`](../../projects/m6-herbario-de-nevoa/evidence/doop-lab/motion-to-design/export-plan.dry-run.json), SHA-256 `8c4c7ac53a3834e7fbf0136e80e7ee586da03787c88f5c2064e22f0f08491e50`. It plans 15 HTML frames (landing; six carousel slides; story; five video stills; storyboard; SVG showcase), 5 PNG `upload_asset` operations, and 15 `get_frame_screenshot` readbacks. It is `DRY_RUN`, `executed:false`, validation `ok:true`, zero findings, and zero blocked operations. Each PNG upload would create a permanent public URL. The Doop pilot remains pending authorization for these exact writes and readback.

Doop limitations verified in the public tool catalogue: no global token API, no global component-library inspection/expansion, no font upload tool, no `<doop-use>` expansion, and no atomic compare-and-set. These constraints do not block local Motion Core operations or the OpenDesign file pilot.

## Status and evidence paths

| Track | Result |
|---|---|
| Local Motion MCP + OpenDesign project | PASS for 30-tool discovery, 9 renders, SVG validation and 5/5 website viewports |
| Skills through OpenCode | PASS for nine relevant Skill loads; 16 installed locally |
| OpenDesign native MCP | BLOCKED in this WSL/Windows session; bundled server code found, runtime handshake not proven |
| OpenDesign panel agent | PARTIAL; first run exited before output, subsequent agent reached model free limit |
| Doop six-frame Design-to-Motion | PASS for readback, six local imports, normalizations and renders |
| Doop new Motion-to-Design writes | BLOCKED pending explicit authorization; dry-run only |
| Package publication | Not done |

Primary report: [`MISSION_23_M6_REPORT.md`](MISSION_23_M6_REPORT.md). Integration guide and comparison: [`OPENDESIGN.md`](../integrations/OPENDESIGN.md). Future generic gaps: [`UNIVERSAL_DESIGN_BRIDGE.md`](../roadmap/UNIVERSAL_DESIGN_BRIDGE.md).
