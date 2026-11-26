#!/usr/bin/env node
/** Reproducible M6 production driver; every render and QA operation goes through Motion MCP stdio. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const project = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(project, "../..");
const cli = path.join(repository, "packages/motion-cli/bin/motion.mjs");
const evidenceDir = path.join(project, "evidence");
const runId = process.env.M6_RUN_ID ?? `m6-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`;
const outputPath = (relative) => `out/${runId}/${relative}`;
await mkdir(evidenceDir, { recursive: true });
const client = new Client({ name: "motion-studio-m6-production", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [cli, "mcp", `--workspace=${project}`, "--max-concurrency=2", "--max-execution-ms=3600000"],
  cwd: project,
  stderr: "pipe",
});
let serverDiagnostics = "";
transport.stderr?.on("data", (chunk) => { serverDiagnostics += chunk.toString(); });

const summaries = [];
function dataOf(result) { return result?.structuredContent ?? result?.content?.find((item) => item.type === "text")?.text ?? null; }
async function call(name, args = {}, expectedError = null) {
  const result = await client.callTool({ name, arguments: args });
  const data = dataOf(result);
  if (expectedError) {
    assert.equal(result.isError, true, `${name} should reject the adversarial input`);
    assert.equal(data?.error?.code, expectedError, `${name} error code`);
  } else {
    assert.equal(result.isError, false, `${name}: ${JSON.stringify(data)}`);
  }
  summaries.push({ tool: name, status: expectedError ? "REJECTED_AS_EXPECTED" : data?.status ?? data?.artifact?.kind ?? (result.isError ? "FAIL" : "PASS"), ...(expectedError ? { errorCode: data?.error?.code } : {}), ...(data?.artifact ? { artifact: data.artifact } : {}) });
  return data;
}

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.equal(tools.length, 30, "the current local registry must publish 30 MCP tools");
  assert.equal(new Set(tools.map((tool) => tool.name)).size, 30);
  assert.ok(tools.every((tool) => tool.inputSchema && tool.outputSchema));
  const legacyTools = ["motion_edit_presets", "motion_edit_analyze", "motion_stt_doctor", "motion_audio_doctor", "motion_edit_transcribe", "motion_edit_plan", "motion_edit_audio", "motion_edit_render", "motion_job_status", "motion_qa_reel", "motion_edit_export"];
  assert.ok(legacyTools.every((name) => tools.some((tool) => tool.name === name)), "all eleven compatible MCP tools remain discoverable");

  // Live campaign production: source files in this project are passed to the real stdio MCP.
  const website = await call("render_static", { input: "web/index.html", output: outputPath("web/hero.png"), width: 1440, height: 1000, scale: 1, seed: 23 });
  assert.equal(website.status, "PASS");
  const viewportQa = await call("qa_viewports", { input: "web/index.html", outputDir: outputPath("web/viewports"), wait: 0 });
  assert.equal(viewportQa.status, "PASS", JSON.stringify(viewportQa.report?.results));
  assert.equal(viewportQa.report.results.length, 5);

  const carousel = await call("render_carousel", { slidesDir: "carousel", outputDir: outputPath("carousel") });
  assert.equal(carousel.slides, 6);
  const carouselZones = [];
  for (const slide of ["01-capa", "02-indice", "03-lunaria", "04-intervalo", "05-paisagem", "06-colofao"]) {
    const check = await call("qa_safe_zones", { input: `carousel/${slide}.html`, outputDir: outputPath(`carousel-safe-zones/${slide}`), platform: "feed-4-5", duration: 0.5, fps: 2, width: 1080, height: 1350, sampleTimes: [0], seed: 23 });
    carouselZones.push({ slide, passed: check.passed, warnings: check.samples?.flatMap((sample) => sample.warnings ?? []) ?? [], provenance: check.provenance });
  }

  const videoFrames = await call("render_frames", { input: "video/promo.html", outputDir: outputPath("video/frames"), frames: 240, fps: 24, width: 1280, height: 720, scale: 1, seed: 23 });
  const video = await call("render_video", { framesDir: outputPath("video/frames"), output: outputPath("video/herbario-de-nevoa.mp4"), fps: 24, crf: 18 });
  const videoDeterminism = await call("qa_determinism", { input: "video/promo.html", outputDir: outputPath("video/determinism"), duration: 10, fps: 24, width: 1280, height: 720, sampleTimes: [0, 1.5, 3.5, 5.5, 7.5, 9.5], seed: 23 });
  const videoZones = await call("qa_safe_zones", { input: "video/promo.html", outputDir: outputPath("video/safe-zones"), platform: "youtube-horizontal", duration: 10, fps: 24, width: 1280, height: 720, sampleTimes: [0, 2, 4, 6, 8, 9.5], seed: 23 });

  const storyFrames = await call("render_frames", { input: "story/story.html", outputDir: outputPath("story/frames"), frames: 240, fps: 24, width: 720, height: 1280, scale: 1, seed: 23 });
  const story = await call("render_video", { framesDir: outputPath("story/frames"), output: outputPath("story/herbario-de-nevoa-story.mp4"), fps: 24, crf: 18 });
  const storyDeterminism = await call("qa_determinism", { input: "story/story.html", outputDir: outputPath("story/determinism"), duration: 10, fps: 24, width: 720, height: 1280, sampleTimes: [0, 1.5, 3.5, 5.5, 7.5, 9.5], seed: 23 });
  const storyZones = await call("qa_safe_zones", { input: "story/story.html", outputDir: outputPath("story/safe-zones"), platform: "instagram-stories", duration: 10, fps: 24, width: 720, height: 1280, sampleTimes: [0, 2, 4, 6, 8, 9.5], seed: 23 });
  assert.ok(videoDeterminism.passed && storyDeterminism.passed, "motion must repeat at all sampled times");

  // Local-only bridge coverage against the repository's verified M3 fixtures. This is not a real Doop canvas.
  const frameFixture = JSON.parse(await readFile(path.join(repository, "tests/fixtures/bridge/doop-frame-sample.json"), "utf8"));
  const tokenFixture = JSON.parse(await readFile(path.join(repository, "tests/fixtures/bridge/doop-tokens-sample.json"), "utf8"));
  const imported = await call("bridge_import_design", { documentId: "m6-local-fixture-only", frame: frameFixture });
  const designIR = imported.designIR;
  const designContract = await call("bridge_validate_contract", { contract: "designIR", value: designIR });
  assert.equal(designContract.valid, true);
  const importedTokens = await call("bridge_import_tokens", { tokens: tokenFixture, brandSlug: "m6-fixture-only" });
  const tokenContract = await call("bridge_validate_contract", { contract: "tokenBundle", value: importedTokens.tokenBundle });
  assert.equal(tokenContract.valid, true);
  const normalized = await call("bridge_normalize_design", { designIR, target: "frame", outDir: outputPath("bridge/normalized-fixture"), tokenBundle: importedTokens.tokenBundle, seed: 23, fps: 24 });
  const storyboard = await call("bridge_prototype_storyboard", { designIR, projectSlug: "m6-fixture-only", fps: 24, defaultHoldSec: 2, output: `evidence/fixture-prototype-storyboard-${runId}.md` });
  const exportPlan = await call("bridge_export_plan", { documentId: "doop-lab-not-created", designIR, tokenBundle: importedTokens.tokenBundle, artifacts: [
    { id: "campaign-landing", kind: "html", path: "web/index.html" },
    { id: "campaign-carousel-cover", kind: "image", path: outputPath("carousel/01-capa-1080x1350.png") },
    { id: "campaign-promo-video", kind: "video", path: outputPath("video/herbario-de-nevoa.mp4") },
  ] });
  assert.equal(exportPlan.executed, false);
  const exportValidation = await call("bridge_export_validate", { plan: exportPlan.plan });
  const doopPayload = await call("bridge_doop_payload", { plan: exportPlan.plan });
  assert.equal(doopPayload.executed, false);
  assert.equal(doopPayload.requiresDoopMcp, true);

  const flowerSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="#754652" d="M50 8 61 37 92 31 69 51 88 76 58 65 50 96 42 65 12 76 31 51 8 31 39 37z"/></svg>';
  const svgValidation = await call("svg_validate", { svg: flowerSvg, strict: true });
  const svgOptimization = await call("svg_optimize", { svg: flowerSvg, prefix: "m6-herbario", multipass: true });

  // Adversarial calls: they must fail before the renderer can read/write outside the selected workspace.
  await call("render_static", { input: "../AGENTS.md", output: outputPath("security/path-traversal.png") }, "MOTION_BRIDGE_PATH_TRAVERSAL");
  await call("qa_viewports", { input: "https://example.com/", outputDir: outputPath("security/ssrf") }, "MOTION_BRIDGE_UNSAFE_URL");
  await call("svg_validate", { svg: flowerSvg, strict: true, extra: "disallowed" }, "MOTION_INVALID_ARGUMENT");
  await call("bridge_hydrate_assets", { designIR, projectDir: outputPath("security/no-download"), allowRemoteDownloads: false }, "MOTION_INVALID_ARGUMENT");

  const result = {
    schemaVersion: 1,
    runDate: new Date().toISOString(),
    repositoryHead: "recorded separately in the M6 report",
    client: { name: "official @modelcontextprotocol/client over child stdio", server: "motion-studio", protocol: "stdio", discoveredTools: tools.length, inputAndOutputSchemas: tools.every((tool) => tool.inputSchema && tool.outputSchema), preservedLegacyTools: legacyTools },
    production: { website: website.artifact, viewportQa: viewportQa.report, carousel: carousel.artifact, carouselSafeZones: carouselZones, videoFrames: videoFrames.artifact, video: video.artifact, videoDeterminism: { passed: videoDeterminism.passed, hashesMatch: videoDeterminism.hashesMatch ?? null, sampleCount: videoDeterminism.samples?.length ?? null }, videoSafeZones: { passed: videoZones.passed, samples: videoZones.samples?.map(({ time, frame, warnings }) => ({ time, frame, warnings })) ?? [], provenance: videoZones.provenance }, storyFrames: storyFrames.artifact, story: story.artifact, storyDeterminism: { passed: storyDeterminism.passed, hashesMatch: storyDeterminism.hashesMatch ?? null, sampleCount: storyDeterminism.samples?.length ?? null }, storySafeZones: { passed: storyZones.passed, samples: storyZones.samples?.map(({ time, frame, warnings }) => ({ time, frame, warnings })) ?? [], provenance: storyZones.provenance } },
    bridge: { provenance: "synthetic repository fixture only; no Doop canvas was read or written", importFrame: { sourceFrameId: designIR.source.frameId, approvalStatusPreserved: designIR.source.approvalStatus }, designContractValid: designContract.valid, tokensContractValid: tokenContract.valid, normalized: normalized.artifact, prototypeStoryboard: storyboard.artifact, exportPlanStatus: exportPlan.status, exportPlanExecuted: exportPlan.executed, exportPlanValidation: exportValidation, doopPayloadExecuted: doopPayload.executed, doopToolsSuggested: doopPayload.verifiedToolNames },
    svg: { valid: svgValidation.ok, sanitizedBytes: Buffer.byteLength(svgValidation.svg ?? ""), optimizedBytes: Buffer.byteLength(svgOptimization.svg?.svg ?? "") },
    adversarial: summaries.filter((item) => item.status === "REJECTED_AS_EXPECTED"),
    operations: summaries,
    shutdown: "client.close() awaited in finally; MCP child process exits on stdio close",
  };
  await writeFile(path.join(evidenceDir, "mcp-run.json"), `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(path.join(evidenceDir, "dry-run-export.json"), `${JSON.stringify({ plan: exportPlan.plan, validation: exportValidation, doopPayload }, null, 2)}\n`);
  process.stdout.write(JSON.stringify({ operations: summaries.length, toolCount: tools.length, websiteQa: viewportQa.status, carouselSlides: carousel.slides, carouselSafeZones: carouselZones.map((item) => ({ slide: item.slide, passed: item.passed, warningCount: item.warnings.length })), videoDeterminism: videoDeterminism.passed, videoSafeZones: videoZones.passed, storyDeterminism: storyDeterminism.passed, storySafeZones: storyZones.passed, bridge: { valid: designContract.valid && tokenContract.valid, dryRunOnly: exportPlan.executed === false && doopPayload.executed === false }, artifacts: [website.artifact.path, carousel.artifact.path, video.artifact.path, story.artifact.path] }, null, 2) + "\n");
} finally {
  await client.close();
  await writeFile(path.join(evidenceDir, "mcp-stderr.log"), serverDiagnostics);
}
