#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const project = path.resolve(process.argv[2] ?? "");
if (!path.isAbsolute(project) || path.basename(project) !== "04691291-53a3-44d0-b4ce-5d1cb1bb091e") {
  throw new Error("Refusing to access a workspace other than the new authorized Integration Lab.");
}
const production = path.join(project, "design-output/production");
const qaRoot = path.join(production, "qa");
const qaDirs = (await readdir(qaRoot, { withFileTypes: true }))
  .filter((item) => item.isDirectory() && /^mcp-\d{14}$/u.test(item.name))
  .map((item) => item.name).sort();
const runId = qaDirs.at(-1);
assert.ok(runId, "a completed Motion MCP render run must exist");
const runDir = path.join(qaRoot, runId);
const viewportReport = JSON.parse(await readFile(path.join(runDir, "web-viewports/report.json"), "utf8"));
assert.equal(viewportReport.results.length, 5);
assert.ok(viewportReport.results.every((result) => result.ok && result.issues.length === 0));

const labels = ["index", "website", "dashboard", "mobile", "carousel-cover", "story", "storyboard", "specimen-component", "svg-showcase"];
const digestFile = async (absolute, relative) => {
  const bytes = await readFile(absolute);
  return { path: relative, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
};
const rendered = await Promise.all(labels.map((label) => digestFile(path.join(runDir, `${label}.png`), `design-output/production/qa/${runId}/${label}.png`)));
const viewportNames = ["mobile-s-fold.png", "mobile-s-full.png", "mobile-fold.png", "mobile-full.png", "tablet-fold.png", "tablet-full.png", "desktop-fold.png", "desktop-full.png", "wide-fold.png", "wide-full.png"];
const viewportShots = await Promise.all(viewportNames.map((name) => digestFile(path.join(runDir, "web-viewports", name), `design-output/production/qa/${runId}/web-viewports/${name}`)));
const smoke = await digestFile(path.join(project, "design-output/mcp-smoke.png"), "design-output/mcp-smoke.png");
const manifestBytes = await readFile(path.join(production, "manifest.json"));

const client = new Client({ name: "motion-studio-opendesign-evidence", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(root, "packages/motion-cli/bin/motion.mjs"), "mcp", `--workspace=${project}`, "--max-concurrency=1"],
  cwd: project,
  stderr: "pipe",
});
transport.stderr?.on("data", () => {});
let toolCount = 0;
let svgStatus = "NOT_TESTED";
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  toolCount = tools.length;
  assert.equal(toolCount, 30);
  assert.ok(tools.every((tool) => tool.inputSchema && tool.outputSchema));
  const flower = await readFile(path.join(production, "assets/specimen-flower.svg"), "utf8");
  const result = await client.callTool({ name: "svg_validate", arguments: { svg: flower, strict: true } });
  assert.equal(result.isError, false);
  svgStatus = result.structuredContent?.status;
  assert.equal(svgStatus, "PASS");
} finally {
  await client.close();
}

const report = {
  createdAt: new Date().toISOString(),
  project: "Motion Studio — Integration Lab",
  campaign: "Herbário de Névoa",
  workspace: project,
  motionMcp: { transport: "stdio", toolCount, schemas: "30/30 input and output schemas discovered", renderStatic: "9/9 PASS", qaViewports: "5/5 PASS", svgValidate: svgStatus },
  runId,
  websiteViewports: viewportReport.results.map(({ viewport, size, ok, issues, metrics }) => ({ viewport, size, status: ok ? "PASS" : "FAIL", issues, overflowX: metrics.overflowX })),
  productionManifest: { files: JSON.parse(manifestBytes.toString("utf8")).files.length, sha256: createHash("sha256").update(manifestBytes).digest("hex") },
  renderScreenshots: rendered,
  viewportScreenshots: viewportShots,
  openCodeMcpSmoke: smoke,
  limitations: [
    "OpenDesign's in-app agent run did not complete: its subprocess exited before artifacts were produced.",
    "A subsequent OpenCode project-agent run discovered Skills and Motion MCP, then stopped at the configured provider's free usage limit.",
    "Direct project-scoped OpenCode MCP smoke rendered the PNG above; the in-app OpenDesign agent did not complete the requested video production.",
    "The project files were rendered locally by Motion MCP; native OpenDesign canvas import or design-layer editability was not verified.",
  ],
};
const destination = path.join(root, "projects/m6-herbario-de-nevoa/evidence/opendesign/motion-mcp-results.json");
await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ destination: path.relative(root, destination), runId, toolCount, svgStatus, renders: rendered.length, viewportScreenshots: viewportShots.length, manifestSha256: report.productionManifest.sha256 }, null, 2));
