import test from "node:test";
import assert from "node:assert/strict";
import { resolveQualityRouting } from "../packages/motion-core/quality/qa-routing.mjs";

const registeredMcpTools = new Set([
  "motion_edit_presets", "motion_edit_analyze", "motion_stt_doctor", "motion_audio_doctor",
  "motion_edit_transcribe", "motion_edit_plan", "motion_edit_audio", "motion_edit_render",
  "motion_job_status", "motion_qa_reel", "motion_edit_export", "render_static", "render_frames",
  "render_video", "render_carousel", "qa_determinism", "qa_safe_zones", "qa_viewports", "svg_validate",
  "svg_optimize", "bridge_validate_contract", "bridge_import_design", "bridge_import_tokens",
  "bridge_hydrate_assets", "bridge_normalize_design", "bridge_prototype_storyboard", "bridge_export_plan",
  "bridge_export_validate", "bridge_doop_payload", "bridge_export_tokens",
]);

test("composition QA routes use only registered MCP tools and separate automated from manual checks", () => {
  const cases = [
    [{ target: "web-director" }, "responsive-website", ["qa_viewports", "render_static"], []],
    [{ target: "frame" }, "fixed-artboard", ["render_static"], []],
    [{ target: "carousel" }, "carousel", ["render_carousel", "qa_safe_zones"], ["qaFrames"]],
    [{ target: "story" }, "story", ["render_frames", "qa_determinism", "qa_safe_zones"], ["qaFrames"]],
    [{ target: "video" }, "video", ["render_frames", "qa_determinism", "render_video"], ["qaFrames", "qaMedia"]],
    [{ target: "frame", animated: true }, "animated-composition", ["render_frames", "qa_determinism"], ["qaFrames"]],
  ];

  for (const [input, category, expectedTools, expectedCore] of cases) {
    const route = resolveQualityRouting(input);
    assert.equal(route.category, category);
    for (const tool of route.tools) assert.ok(registeredMcpTools.has(tool), `${category} advertises unregistered MCP tool ${tool}`);
    for (const { tool } of route.conditionalTools) assert.ok(registeredMcpTools.has(tool), `${category} conditionally advertises unregistered MCP tool ${tool}`);
    for (const tool of expectedTools) assert.ok(route.tools.includes(tool), `${category} omitted ${tool}`);
    assert.deepEqual(route.coreChecks, expectedCore);
    assert.ok(route.manualReview.length > 0, `${category} must state its human review criteria`);
    assert.ok(!route.coreChecks.some((check) => check.startsWith("manual_")), "manual review is not a core engine gate");
  }
});

test("responsive, carousel, and social video gates expose conditional checks explicitly", () => {
  const web = resolveQualityRouting({ target: "web-director", animated: true });
  assert.deepEqual(web.conditionalTools.map(({ tool }) => tool), ["render_frames", "qa_determinism"]);

  const carousel = resolveQualityRouting({ target: "carousel" });
  assert.deepEqual(carousel.conditionalTools.map(({ tool }) => tool), ["render_frames", "qa_determinism"]);

  const video = resolveQualityRouting({ target: "video" });
  assert.deepEqual(video.conditionalTools, [{ tool: "qa_safe_zones", when: "vertical or social delivery" }]);
  assert.deepEqual(video.manualReview, ["pacing", "transitions", "typographic timing", "sound-image relationship"]);
});
