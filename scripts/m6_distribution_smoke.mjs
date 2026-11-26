#!/usr/bin/env node
/** Mission 23 M6 — package the four publishable workspaces, install tarballs cleanly, and smoke-test CLI/MCP. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publishable = [
  ["cli", "packages/motion-cli"],
  ["core", "packages/motion-core"],
  ["skills", "packages/motion-skills"],
  ["installer", "packages/motion-studio"],
];
const temp = await mkdtemp(path.join(os.tmpdir(), "motion-m6-distribution-"));
const tarballs = path.join(temp, "tarballs");
const consumer = path.join(temp, "consumer");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, cwd, { timeout = 180_000 } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout, maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed (${result.status ?? result.error}):\n${result.stderr ?? ""}\n${result.stdout ?? ""}`);
  }
  return result.stdout;
}

await mkdir(tarballs, { recursive: true });
await mkdir(consumer, { recursive: true });
const packages = [];
for (const [key, rel] of publishable) {
  const stdout = run(npm, ["pack", "--json", "--pack-destination", tarballs], path.join(root, rel));
  const record = JSON.parse(stdout)[0];
  const file = path.join(tarballs, record.filename);
  const p = JSON.parse(await readFile(path.join(root, rel, "package.json"), "utf8"));
  assert.equal(record.name, p.name, `${key} packed name`);
  assert.equal(record.version, p.version, `${key} packed version`);
  assert.ok(record.entryCount > 0, `${key} tarball must not be empty`);
  packages.push({ key, name: record.name, version: record.version, filename: record.filename, tarballBytes: (await stat(file)).size, packedBytes: record.size, unpackedBytes: record.unpackedSize, files: record.entryCount });
}

const deps = Object.fromEntries(packages.map((p) => [p.name, `file:${path.relative(consumer, path.join(tarballs, p.filename))}`]));
await writeFile(path.join(consumer, "package.json"), `${JSON.stringify({ name: "motion-m6-clean-consumer", private: true, type: "module", dependencies: deps }, null, 2)}\n`);
run(npm, ["install", "--prefix", consumer, "--ignore-scripts", "--no-audit", "--no-fund"], root, { timeout: 300_000 });

const motion = path.join(consumer, "node_modules", "@technomanceer", "motion-cli", "bin", "motion.mjs");
const studio = path.join(consumer, "node_modules", "@technomanceer", "motion-studio", "bin", "motion-studio.mjs");
const consumerProject = path.join(consumer, "project");
const mcpWorkspace = path.join(consumer, "mcp-project");
await mkdir(consumerProject, { recursive: true });
await mkdir(mcpWorkspace, { recursive: true });
await writeFile(path.join(mcpWorkspace, "page.html"), "<!doctype html><html><body style='margin:0;background:#17392f;color:white;font:32px sans-serif'>M6 package smoke</body></html>\n");

const initOutput = run(process.execPath, [studio, "init", "--profile=integration", "--agents=codex", "--skip-install", "--json"], consumerProject);
const init = JSON.parse(initOutput);
assert.equal(init.ok, true, JSON.stringify(init));
const profileNames = ["studio-director", "motion-director", "web-director", "design-to-motion", "motion-to-design", "doop-bridge"];
for (const name of profileNames) await stat(path.join(consumerProject, ".agents", "skills", name, "SKILL.md"));
const publicCatalog = JSON.parse(await readFile(path.join(consumer, "node_modules/@technomanceer/motion-studio-skills/public-skills.json"), "utf8"));
assert.equal(publicCatalog.skills.length, 17, "installed public catalog size");
for (const entry of publicCatalog.skills) {
  const bytes = await readFile(path.join(consumer, "node_modules/@technomanceer/motion-studio-skills", entry.path));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, `${entry.name} public skill hash`);
}
run(process.execPath, [motion, "--version"], consumerProject);
run(process.execPath, [studio, "--version"], consumerProject);
const doctorText = run(process.execPath, [motion, "doctor", "--json"], consumerProject);
assert.match(doctorText, /Todas as dependências obrigatórias estão operacionais/, doctorText);
const doctor = { requiredDependencies: "PASS", installIntegrity: doctorText.includes("verificações de Skills/integração OK") };

const child = spawn(process.execPath, [motion, "mcp", `--workspace=${mcpWorkspace}`], { cwd: mcpWorkspace, stdio: ["pipe", "pipe", "pipe"] });
const lines = createInterface({ input: child.stdout });
const stderr = [];
child.stderr.on("data", (chunk) => stderr.push(chunk.toString()));
let nextId = 0;
const waiting = new Map();
lines.on("line", (line) => {
  const message = JSON.parse(line);
  const resolve = waiting.get(message.id);
  if (resolve) { waiting.delete(message.id); resolve(message); }
});
function rpc(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiting.delete(id); reject(new Error(`MCP request ${id} timed out`)); }, 30_000);
    waiting.set(id, (message) => { clearTimeout(timer); resolve(message); });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}
let mcpResult;
try {
  const initialized = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "m6-clean-package-smoke", version: "1" } });
  assert.equal(initialized.result.serverInfo.name, "motion-studio");
  const catalog = await rpc("tools/list");
  assert.equal(catalog.result.tools.length, 30);
  const render = await rpc("tools/call", { name: "render_static", arguments: { input: "page.html", output: "mcp.png", width: 320, height: 180, scale: 1 } });
  assert.equal(render.result.isError, false, JSON.stringify(render));
  const output = path.join(mcpWorkspace, "mcp.png");
  const image = await readFile(output);
  assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const cliOutput = path.join(mcpWorkspace, "cli.png");
  run(process.execPath, [motion, "render", "static", "page.html", "cli.png", "--width=320", "--height=180", "--scale=1"], mcpWorkspace);
  const cliImage = await readFile(cliOutput);
  const digest = (buffer) => createHash("sha256").update(buffer).digest("hex");
  assert.equal(digest(image), digest(cliImage), "installed CLI and MCP must use the same Motion Core renderer");
  const traversal = await rpc("tools/call", { name: "render_static", arguments: { input: "../outside.html", output: "escape.png", width: 320, height: 180, scale: 1 } });
  assert.equal(traversal.result.isError, true);
  assert.equal(traversal.result.structuredContent.error.code, "MOTION_BRIDGE_PATH_TRAVERSAL");
  mcpResult = { tools: catalog.result.tools.length, renderBytes: image.length, renderSha256: digest(image), cliMcpParity: true, traversalRejected: true };
} finally {
  child.stdin.end();
  const exitCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("packaged MCP did not shut down")); }, 10_000);
    child.once("close", (code) => { clearTimeout(timer); resolve(code); });
  });
  assert.equal(exitCode, 0, Buffer.concat(stderr.map((s) => Buffer.from(s))).toString("utf8"));
  lines.close();
}

console.log(JSON.stringify({ status: "PASS", temp, packages, installer: { profile: "integration", publicSkills: publicCatalog.skills.length, selectedSkills: profileNames }, doctor, mcp: mcpResult }, null, 2));
