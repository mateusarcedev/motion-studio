---
name: motion-to-design
description: Prepare Motion Studio productions for a design editor by exporting representative frames, carousels, storyboards, SVGs, assets, tokens, or editable HTML when supported. Use for safe design handoff and editor export planning.
license: Apache-2.0
metadata:
  author: Mateus Arce
  version: "1.0.0"
---

# Motion to Design

Prepare a traceable handoff from Motion Studio to a design editor. The Motion MCP inspects and
validates local material, then creates a dry-run export plan. The connected editor's official MCP,
when available, performs external reads and writes. This Skill never claims that a plan was
published.

## Workflow

1. **Inventory the production.** Confirm the project root and intended canvas. Read the local
   `BRIEF.md`, `STYLE.md`, `STORYBOARD.md`, token source, asset manifest, and delivery contract as
   applicable. Preserve all existing files. Do not include secrets, private configs, or unrelated
   project data.
2. **Choose useful deliverables.**
   - Render representative frames with `render_frames`; use `render_static` for standalone HTML.
   - Use `render_carousel` for a directory of slide HTML. Include PNG output and source HTML when
     the editor can accept it.
   - Include storyboard beats and local SVGs/assets only after validation.
   - Preserve token bundles with `bridge_export_tokens` where the known export format applies.
   - HTML is editable only when the source HTML is included and accepted by the destination. An
     image of HTML remains rasterized.
3. **Classify each item.** Report each as **editable**, **rasterized**, **referential**, or
   **blocked**:
   - HTML/source code that the destination accepts: editable, with implementation details and
     unsupported behavior stated.
   - PNG/JPEG/WebP and rendered frames: rasterized.
   - Video, audio, 3D, or external references: referential unless the destination confirms native
     support in its currently discovered tools.
   - Sensitive files, unsupported operations, unsafe content, missing authorization, or approved
     `ready_for_dev` frames: blocked. Never downgrade this state to bypass a protection.
4. **Discover the destination.** If the destination is Doop, use `doop-bridge` to confirm that its
   official MCP is connected and inspect the live tool names and schemas. Do not infer an API from
   an old snapshot or this Skill. If it is absent, deliver the local files and the export plan; the
   Motion workflow remains usable without Doop.
5. **Plan and validate.** Call `bridge_export_plan` with the destination document ID, relevant
   DesignIR/tokens, local artifact descriptors, and storyboard data. Review the generated
   `ExportPlan@1`, then call `bridge_export_validate`. Call `bridge_doop_payload` only to create
   candidate payloads for tools the agent has just discovered. These bridge calls are dry-run:
   their responses must say `executed: false`.
6. **Obtain authorization for remote writes.** Before changing a canvas, confirm the exact target
   and operations with the user unless the current request already explicitly authorizes those
   changes. Do not overwrite approved content, modify an unrequested canvas, or send local assets
   automatically. Execute only through the destination's official MCP and only with its live
   schema. A Motion MCP payload is neither an authorization grant nor a successful write.
7. **Verify and report.** Read back the affected frames using available official tools and inspect
   a screenshot when supported. Compare it with the intended handoff. Report completed, failed,
   blocked, and unverified operations separately, with artifact paths, hashes, compatibility
   notes, and any remaining visual differences.

## Export checklist

- Include representative states and frames, not every generated frame by default.
- Preserve brand tokens, typography, color, safe zones, source links, and asset provenance.
- Keep editable source alongside raster previews. Do not promise animation or interaction playback
  in an editor unless the target confirms it.
- Validate SVG with `svg_validate` before export; use `svg_optimize` only after validation.
- Do not include credentials, local configuration, copyrighted assets without a suitable grant, or
  files marked confidential.
- Record whether HTML, CSS, SVG, fonts, motion, and responsive behavior are native, approximated,
  referenced, or unavailable in the target.

## Motion MCP tools used

`render_static`, `render_frames`, `render_carousel`, `svg_validate`, `svg_optimize`,
`bridge_export_tokens`, `bridge_export_plan`, `bridge_export_validate`, and
`bridge_doop_payload`. Use `bridge_validate_contract` when input contracts need explicit checking.
Discover each tool's current schema before calling it. The tool registry documents the
Motion-side interface; it does not define the Doop server's live methods.
