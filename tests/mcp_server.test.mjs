import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(root, "packages/motion-cli/bin/motion.mjs");
const workspace = await mkdtemp(path.join(os.tmpdir(), "motion-mcp-v2-"));
const outsideFile = `${workspace}-outside.html`;

before(async () => {
  await mkdir(path.join(workspace, "slides"), { recursive: true });
  await writeFile(path.join(workspace, "page.html"), "<!doctype html><html><body style='margin:0;background:#183b32'><h1 style='color:white'>Local MCP</h1><script>window.__onFrame__=({frame})=>{document.body.dataset.frame=frame};</script></body></html>");
  await writeFile(path.join(workspace, "slides", "01.html"), "<!doctype html><html><body style='margin:0;background:#183b32'><h1 style='color:white'>Slide</h1></body></html>");
  await writeFile(path.join(workspace, "slow.html"), "<!doctype html><html><body><script>window.__MOTION_READY__=new Promise(resolve=>setTimeout(resolve,1200));</script><p>slow local render</p></body></html>");
  await writeFile(outsideFile, "<!doctype html><html><body>outside</body></html>");
  await symlink(outsideFile, path.join(workspace, "escape.html"));
});

after(async () => {
  await rm(workspace, { recursive: true, force: true });
  await rm(outsideFile, { force: true });
});

async function connect(maxConcurrency = 1) {
  const client = new Client({ name: "motion-studio-mcp-integration-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [CLI, "mcp", `--workspace=${workspace}`, `--max-concurrency=${maxConcurrency}`],
    cwd: workspace,
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk) => { if (process.env.MOTION_MCP_TEST_TRACE) process.stderr.write(chunk); });
  await client.connect(transport);
  return { client, transport };
}

function structured(result) {
  assert.equal(result.isError, false, JSON.stringify(result));
  return result.structuredContent;
}

test("official MCP stdio client initializes, discovers the preserved 11 tools, and shuts down", async () => {
  const { client } = await connect();
  try {
    const { tools } = await client.listTools();
    const names = new Set(tools.map((item) => item.name));
    for (const name of [
      "motion_edit_presets", "motion_edit_analyze", "motion_stt_doctor", "motion_audio_doctor",
      "motion_edit_transcribe", "motion_edit_plan", "motion_edit_audio", "motion_edit_render",
      "motion_job_status", "motion_qa_reel", "motion_edit_export",
    ]) assert.ok(names.has(name), `missing legacy tool ${name}`);
    for (const name of [
      "render_static", "render_frames", "render_video", "render_carousel", "qa_determinism", "qa_safe_zones", "qa_viewports",
      "svg_validate", "svg_optimize", "bridge_validate_contract", "bridge_import_design", "bridge_import_tokens",
      "bridge_hydrate_assets", "bridge_normalize_design", "bridge_prototype_storyboard", "bridge_export_plan",
      "bridge_export_validate", "bridge_doop_payload", "bridge_export_tokens",
    ]) {
      assert.ok(names.has(name), `missing v2 tool ${name}`);
    }
    assert.equal(tools.length, 30, "catalog contains all 11 legacy and 19 v2 tools");
    assert.equal(new Set(tools.map((item) => item.name)).size, tools.length, "registry must not publish duplicate tool names");
    assert.ok(tools.every((item) => item.inputSchema && item.outputSchema), "every tool publishes input and output schemas");
    const presets = structured(await client.callTool({ name: "motion_edit_presets", arguments: {} }));
    assert.ok(Array.isArray(presets.edit));
  } finally {
    await client.close();
  }
});

test("stdio keeps protocol messages on stdout and writes startup diagnostics to stderr", async () => {
  const child = spawn(process.execPath, [CLI, "mcp", `--workspace=${workspace}`], { cwd: workspace, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
  child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
  child.stdin.end(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "stdio-test", version: "1" } } })}\n`);
  const [code] = await once(child, "close");
  assert.equal(code, 0);
  const lines = stdout.trim().split("\n");
  assert.equal(lines.length, 1, "exactly one protocol response belongs on stdout");
  assert.equal(JSON.parse(lines[0]).result.serverInfo.name, "motion-studio");
  assert.match(stderr, /pronto \(stdio;/);
});

test("notifications/cancelled aborts a running render and returns a structured cancellation error", async () => {
  const child = spawn(process.execPath, [CLI, "mcp", `--workspace=${workspace}`, "--max-execution-ms=30000"], { cwd: workspace, stdio: ["pipe", "pipe", "pipe"] });
  const closePromise = once(child, "close");
  child.stderr.setEncoding("utf8").on("data", (chunk) => { if (process.env.MOTION_MCP_TEST_TRACE) process.stderr.write(chunk); });
  const lines = (await import("node:readline")).createInterface({ input: child.stdout });
  const responses = new Map(), waiters = new Map();
  lines.on("line", (line) => {
    const response = JSON.parse(line);
    if (response.id == null) return;
    const waiter = waiters.get(response.id);
    if (waiter) { waiters.delete(response.id); waiter(response); }
    else responses.set(response.id, response);
  });
  const responseFor = (id) => responses.has(id) ? Promise.resolve(responses.get(id)) : new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiters.delete(id); reject(new Error(`Timed out waiting for MCP response ${id}`)); }, 10000);
    waiters.set(id, (response) => { clearTimeout(timer); resolve(response); });
  });
  try {
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "cancel-test", version: "1" } } })}\n`);
    await responseFor(1);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "render_static", arguments: { input: "slow.html", output: "cancelled.png", width: 320, height: 200, scale: 1 } } })}\n`);
    await new Promise((resolve) => setTimeout(resolve, 250));
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 2, reason: "integration test" } })}\n`);
    const response = await responseFor(2);
    assert.equal(response.result.isError, true);
    assert.equal(response.result.structuredContent.error.code, "MOTION_CANCELLED");
  } finally {
    child.stdin.end();
    if (child.exitCode === null) child.kill("SIGTERM");
    await closePromise;
    lines.close();
  }
});

test("concurrent calls cannot claim the same output and resource caps return structured errors", async () => {
  const { client } = await connect(2);
  try {
    const first = client.callTool({ name: "render_static", arguments: { input: "slow.html", output: "contended.png", width: 320, height: 200, scale: 1 } });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const second = await client.callTool({ name: "render_static", arguments: { input: "slow.html", output: "contended.png", width: 320, height: 200, scale: 1 } });
    assert.equal(second.isError, true);
    assert.equal(second.structuredContent.error.code, "MOTION_OUTPUT_BUSY");
    assert.equal(structured(await first).status, "PASS");

    const limited = await client.callTool({ name: "render_frames", arguments: { input: "page.html", outputDir: "oversized", frames: 30000, width: 7680, height: 7680, scale: 4 } });
    assert.equal(limited.isError, true);
    assert.equal(limited.structuredContent.error.code, "MOTION_INVALID_ARGUMENT");
    const existing = await client.callTool({ name: "render_static", arguments: { input: "page.html", output: "contended.png" } });
    assert.equal(existing.isError, true);
    assert.equal(existing.structuredContent.error.code, "MOTION_OUTPUT_EXISTS");
  } finally {
    await client.close();
  }
});

test("local render returns hash integrity matching the CLI and rejects path escape and invalid schema", async () => {
  const cliResult = await import("node:child_process").then(({ spawnSync }) => spawnSync(process.execPath, [CLI, "render", "static", "page.html", "cli.png", "--width=320", "--height=200", "--scale=1"], { cwd: workspace, encoding: "utf8" }));
  assert.equal(cliResult.status, 0, cliResult.stderr);
  const { client } = await connect();
  try {
    const rendered = structured(await client.callTool({ name: "render_static", arguments: { input: "page.html", output: "mcp.png", width: 320, height: 200, scale: 1, seed: 7 } }));
    const cliPng = await readFile(path.join(workspace, "cli.png"));
    const mcpPng = await readFile(path.join(workspace, "mcp.png"));
    const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
    assert.equal(digest(cliPng), digest(mcpPng), "CLI and MCP use the same deterministic Motion Core renderer");
    assert.equal(rendered.artifact.sha256, digest(mcpPng));
    assert.equal(rendered.artifact.bytes, mcpPng.length);

    const escape = await client.callTool({ name: "render_static", arguments: { input: "escape.html", output: "blocked.png" } });
    assert.equal(escape.isError, true);
    assert.equal(escape.structuredContent.error.code, "MOTION_BRIDGE_PATH_TRAVERSAL");
    const invalid = await client.callTool({ name: "svg_validate", arguments: { svg: "<svg/>", unexpected: true } });
    assert.equal(invalid.isError, true);
    assert.equal(invalid.structuredContent.error.code, "MOTION_INVALID_ARGUMENT");
  } finally {
    await client.close();
  }
});

test("Bridge imports sanitize an authorized fixture and exports only a dry-run plan for the official Doop MCP", async () => {
  const frame = JSON.parse(await readFile(path.join(root, "tests/fixtures/bridge/doop-frame-sample.json"), "utf8"));
  const { client } = await connect();
  try {
    const imported = structured(await client.callTool({ name: "bridge_import_design", arguments: { documentId: frame.canvasId, frame } }));
    assert.equal(imported.designIR.source.frameId, frame.id);
    assert.ok(imported.designIR.compatibilityDiagnostics.some((item) => item.code === "CSS_KEYFRAMES_DETECTED"));
    const checked = structured(await client.callTool({ name: "bridge_validate_contract", arguments: { contract: "designIR", value: imported.designIR } }));
    assert.equal(checked.valid, true);

    const planResult = structured(await client.callTool({ name: "bridge_export_plan", arguments: { documentId: frame.canvasId, designIR: imported.designIR, artifacts: [{ id: "hero", kind: "html", path: "page.html" }] } }));
    assert.equal(planResult.executed, false);
    assert.equal(planResult.status, "DRY_RUN");
    assert.equal(planResult.plan.dryRun, true);
    const payload = structured(await client.callTool({ name: "bridge_doop_payload", arguments: { plan: planResult.plan } }));
    assert.equal(payload.executed, false);
    assert.equal(payload.requiresDoopMcp, true);
    assert.ok(payload.verifiedToolNames.includes("create_frame"));
    assert.ok(payload.operations.every((operation) => !operation.status || operation.status !== "BLOCKED"));

    const deniedHydration = await client.callTool({ name: "bridge_hydrate_assets", arguments: { designIR: imported.designIR, projectDir: "hydrated-denied", allowRemoteDownloads: false } });
    assert.equal(deniedHydration.isError, true, "asset downloads need an explicit opt-in");
    assert.equal(deniedHydration.structuredContent.error.code, "MOTION_INVALID_ARGUMENT");
  } finally {
    await client.close();
  }
});

test("render, QA, carousel, video, SVG and Bridge tools report real output integrity through stdio", async () => {
  const { client } = await connect();
  try {
    const frames = structured(await client.callTool({ name: "render_frames", arguments: { input: "page.html", outputDir: "frames", frames: 2, fps: 2, width: 320, height: 200, sampleFrames: [0, 1] } }));
    assert.equal(frames.status, "PASS");
    assert.equal(frames.artifact.fileCount, 2);
    const video = structured(await client.callTool({ name: "render_video", arguments: { framesDir: "frames", output: "from-frames.mp4", fps: 2 } }));
    assert.equal(video.artifact.kind, "file");
    assert.match(video.artifact.sha256, /^[a-f0-9]{64}$/);

    const carousel = structured(await client.callTool({ name: "render_carousel", arguments: { slidesDir: "slides", outputDir: "carousel-out" } }));
    assert.equal(carousel.slides, 1);
    assert.equal(carousel.artifact.fileCount, 2);

    const deterministic = structured(await client.callTool({ name: "qa_determinism", arguments: { input: "page.html", outputDir: "qa-determinism", duration: 1, fps: 2, width: 320, height: 200, sampleTimes: [0, 0.5] } }));
    assert.equal(deterministic.passed, true);
    assert.equal(deterministic.artifact.kind, "directory");

    const safeZones = structured(await client.callTool({ name: "qa_safe_zones", arguments: { input: "page.html", outputDir: "qa-safe-zones", duration: 0.5, fps: 2, width: 320, height: 568, sampleTimes: [0] } }));
    assert.equal(safeZones.schema, "motion-safe-zone-report@1");
    assert.equal(safeZones.artifact.kind, "directory");

    const viewports = structured(await client.callTool({ name: "qa_viewports", arguments: { input: "page.html", outputDir: "qa-viewports", wait: 0 } }));
    assert.equal(viewports.status, "PASS");
    assert.equal(viewports.report.results.length, 5);

    const svg = structured(await client.callTool({ name: "svg_validate", arguments: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>' } }));
    assert.equal(svg.ok, true);
    assert.equal(typeof svg.svg, "string");
  } finally {
    await client.close();
  }
});
