#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const project = path.resolve(process.argv[2] ?? "");
if (!path.isAbsolute(project) || path.basename(project) !== "04691291-53a3-44d0-b4ce-5d1cb1bb091e") {
  throw new Error("Refusing to access a workspace other than the new authorized Integration Lab.");
}
const cli = path.join(root, "packages/motion-cli/bin/motion.mjs");
const base = "design-output/production";
const runId = `mcp-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`;
const runDir = `${base}/qa/${runId}`;
const client = new Client({ name: "motion-studio-opendesign-m6", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [cli, "mcp", `--workspace=${project}`, "--max-concurrency=1"],
  cwd: project,
  stderr: "pipe",
});
let diagnostics = "";
transport.stderr?.on("data", (chunk) => { diagnostics += chunk.toString(); });
const calls = [];
const call = async (name, args) => {
  const response = await client.callTool({ name, arguments: args });
  const value = response.structuredContent;
  if (response.isError) throw new Error(`${name}: ${JSON.stringify(value ?? response.content)}`);
  calls.push({ tool: name, input: args.input ?? null, output: args.output ?? args.outputDir ?? null, status: value?.status ?? "PASS" });
  console.log(`${name}: ${calls.at(-1).status} ${calls.at(-1).input ?? ""}`);
  return value;
};

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.equal(tools.length, 30);
  assert.equal(new Set(tools.map(({ name }) => name)).size, 30);
  assert.ok(tools.every(({ inputSchema, outputSchema }) => inputSchema && outputSchema));

  const renders = [
    ["index.html", "index", 1280, 900],
    ["website/index.html", "website", 1440, 1000],
    ["dashboard/index.html", "dashboard", 1280, 900],
    ["mobile/index.html", "mobile", 390, 844],
    ["carousel/01-capa.html", "carousel-cover", 1080, 1350],
    ["story/index.html", "story", 720, 1280],
    ["storyboard/index.html", "storyboard", 1280, 800],
    ["components/specimen-card.html", "specimen-component", 420, 520],
    ["svg-elements/index.html", "svg-showcase", 1280, 800],
  ];
  for (const [input, label, width, height] of renders) {
    const output = `${runDir}/${label}.png`;
    const result = await call("render_static", { input: `${base}/${input}`, output, width, height, scale: 1, seed: 23 });
    assert.equal(result.status, "PASS", `${label} render`);
  }

  const viewportQa = await call("qa_viewports", { input: `${base}/website/index.html`, outputDir: `${runDir}/web-viewports`, wait: 0 });
  assert.equal(viewportQa.status, "PASS", JSON.stringify(viewportQa.report?.results));
  assert.equal(viewportQa.report?.results?.length, 5);
  const svg = await readFile(path.join(project, base, "assets/specimen-flower.svg"), "utf8");
  const svgQa = await call("svg_validate", { svg, strict: true });
  assert.equal(svgQa.status, "PASS");

  const artifacts = [];
  for (const [, label] of renders) {
    const relative = `${runDir}/${label}.png`;
    const bytes = await readFile(path.join(project, relative));
    artifacts.push({ path: relative, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  const report = {
    createdAt: new Date().toISOString(),
    runId,
    client: "@modelcontextprotocol/client 2.x",
    server: "Motion MCP local stdio; workspace is the new OpenDesign Integration Lab project",
    toolCatalog: { count: tools.length, inputAndOutputSchemas: true },
    calls,
    websiteViewports: viewportQa.report.results.map(({ viewport, width, height, status, issues }) => ({ viewport, width, height, status, issues })),
    svg: { status: svgQa.status, errors: svgQa.errors ?? [] },
    artifacts,
    diagnostics: diagnostics.trim(),
  };
  const reportPath = path.join(root, "projects/m6-herbario-de-nevoa/evidence/opendesign/motion-mcp-results.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ catalog: tools.length, renders: artifacts.length, viewports: report.websiteViewports, report: path.relative(root, reportPath) }, null, 2));
} finally {
  await client.close();
}
