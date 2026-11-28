/** Mission 21.1 (D) — CLI and MCP stdio run the same analyze → plan → preview → render → QA flow. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmod, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reel as R } from "../packages/motion-core/index.js";
import { burstTranscript, noisySpeechWav, verticalVideo } from "./helpers/reel-fixtures.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = path.join(root, "tests", "tmp", "mcp-parity");
const CLI = path.join(root, "packages/motion-cli/bin/motion.mjs");
let video, f;
let originalPath = null;
before(async () => {
  await rm(tmp, { recursive: true, force: true }); await mkdir(path.join(tmp, "conf", "fonts"), { recursive: true });
  if (process.env.MOTION_MCP_PARITY_CAPTURE_FFMPEG === "1") {
    const detected = spawnSync("sh", ["-c", "command -v ffmpeg"], { encoding: "utf8" });
    assert.equal(detected.status, 0, `ffmpeg lookup failed: ${detected.stderr}`);
    const realFfmpeg = detected.stdout.trim();
    const version = spawnSync(realFfmpeg, ["-hide_banner", "-version"], { encoding: "utf8" });
    assert.equal(version.status, 0, `ffmpeg version probe failed: ${version.stderr}`);
    const binDir = path.join(tmp, "diagnostics-bin");
    const commandLog = path.join(tmp, "ffmpeg-commands.log");
    await mkdir(binDir);
    const quote = (value) => "'" + value.replace(/'/g, "'\\''") + "'";
    const wrapper = path.join(binDir, "ffmpeg");
    await writeFile(wrapper, [
      "#!/usr/bin/env bash",
      `{ printf 'pid=%s cwd=%q argv=' "$$" "$PWD"; printf '%q ' "$@"; printf '\\n'; } >> ${quote(commandLog)}`,
      `exec ${quote(realFfmpeg)} "$@"`,
      "",
    ].join("\n"));
    await chmod(wrapper, 0o755);
    originalPath = process.env.PATH ?? "";
    process.env.PATH = binDir + path.delimiter + originalPath;
    await writeFile(path.join(tmp, "environment.json"), JSON.stringify({
      node: process.version,
      v8: process.versions.v8,
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      osVersion: os.version(),
      cpu: os.cpus()[0]?.model ?? null,
      cpus: os.cpus().length,
      availableParallelism: os.availableParallelism?.() ?? null,
      testConcurrency: process.env.MOTION_TEST_CONCURRENCY ?? null,
      ffmpegVersionOutput: version.stdout.trim(),
    }, null, 2) + "\n");
  }
  video = await verticalVideo(tmp, await noisySpeechWav(tmp));
  await copyFile(path.join(root, "projects/reel-ia-programacao/fonts/Inter-700.woff2"), path.join(tmp, "conf", "fonts", "Inter-700.woff2"));
  f = { transcript: path.join(tmp, "t.json"), config: path.join(tmp, "conf", "edit.config.json"), brief: path.join(tmp, "BRIEF.md") };
  await writeFile(f.transcript, JSON.stringify(burstTranscript(await R.sha256File(video), video)));
  await writeFile(f.config, JSON.stringify({ faceBox: { x: 0.25, y: 0.25, w: 0.5, h: 0.4 }, captions: { fontsDir: "fonts" } }));
  await writeFile(f.brief, '```json motion-brief\n{"opening":"original","glossary":["Codex"]}\n```\n');
});
after(() => { if (originalPath !== null) process.env.PATH = originalPath; });

test("fluxo completo por CLI e por MCP: mesma timeline, mesmos quadros e mesmo veredito de QA", { timeout: 400000 }, async () => {
  const cli = (...a) => { const r = spawnSync("node", [CLI, ...a, "--json"], { encoding: "utf8", maxBuffer: 1 << 26 }); return { status: r.status, json: JSON.parse(r.stdout) }; };
  const dirs = { cli: path.join(tmp, "cli"), mcp: path.join(tmp, "mcp") };
  for (const d of Object.values(dirs)) await mkdir(d, { recursive: true });
  cli("edit", "analyze", video, `--output=${dirs.cli}/a.json`);
  cli("edit", "plan", video, `--transcript=${f.transcript}`, `--analysis=${dirs.cli}/a.json`, `--config=${f.config}`, `--brief=${f.brief}`, `--output=${dirs.cli}/edit.json`);
  assert.equal(cli("edit", "preview", `${dirs.cli}/edit.json`, `--output=${dirs.cli}/preview.mp4`).status, 0);
  assert.equal(cli("edit", "render", `${dirs.cli}/edit.json`, `--output=${dirs.cli}/reel.mp4`, "--keep-work").status, 0);
  const qc = cli("qa", "reel", `${dirs.cli}/reel.mp4`, `--timeline=${dirs.cli}/edit.json`).json;

  const child = spawn("node", [CLI, "mcp"], { stdio: ["pipe", "pipe", "ignore"] });
  const waiting = new Map(); let id = 0;
  createInterface({ input: child.stdout }).on("line", (l) => { const m = JSON.parse(l); waiting.get(m.id)?.(m); waiting.delete(m.id); });
  const rpc = (method, params) => new Promise((res) => { const k = ++id; waiting.set(k, res); child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: k, method, params }) + "\n"); });
  const call = async (name, args) => { const m = await rpc("tools/call", { name, arguments: args }); assert.ok(!m.result.isError, JSON.stringify(m.result)); return m.result.structuredContent; };
  const job = async (j) => { for (;;) { const s = await call("motion_job_status", { jobId: j.jobId }); if (s.status !== "running") { assert.equal(s.status, "done", JSON.stringify(s.error)); return s.result; } await new Promise((r) => setTimeout(r, 300)); } };
  try {
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
    await call("motion_edit_analyze", { input: video, output: `${dirs.mcp}/a.json` });
    await call("motion_edit_plan", { input: video, output: `${dirs.mcp}/edit.json`, transcript: f.transcript, analysis: `${dirs.mcp}/a.json`, config: f.config, brief: f.brief });
    await job(await call("motion_edit_render", { timeline: `${dirs.mcp}/edit.json`, output: `${dirs.mcp}/preview.mp4`, mode: "preview" }));
    await job(await call("motion_edit_render", { timeline: `${dirs.mcp}/edit.json`, output: `${dirs.mcp}/reel.mp4`, mode: "final", keepWork: true }));
    const qm = await call("motion_qa_reel", { input: `${dirs.mcp}/reel.mp4`, timeline: `${dirs.mcp}/edit.json` });
    const [tc, tm] = await Promise.all(Object.values(dirs).map(async (d) => JSON.parse(await readFile(`${d}/edit.json`, "utf8"))));
    assert.equal(tm.captions.fontsDir, "../conf/fonts", "o MCP também corrige caminhos do config");
    assert.equal(tc.hash, tm.hash);
    const cmp = await R.compareRenders(`${dirs.cli}/reel.mp4`, `${dirs.mcp}/reel.mp4`);
    // intermediates are deleted after each render: what survives says whether the audio chain or the composition diverged
    const stages = await Promise.all(Object.values(dirs).map(async (d) => { const r = JSON.parse(await readFile(`${d}/reel.render.json`, "utf8")); return { dir: path.basename(d), voiceWav: await R.sha256File(`${d}/reel.voice.wav`), preview: await R.sha256File(`${d}/preview.mp4`), captions: await R.sha256File(`${d}/reel.captions.ass`), latency: r.voice.latency, loudness: r.voice.loudnessPass, truePeak: r.truePeak, ffmpeg: r.ffmpeg }; }));
    const evidence = JSON.stringify({ cpu: os.cpus()[0]?.model, cpus: os.cpus().length, node: process.version, compare: cmp, stages }, null, 2);
    assert.notEqual(cmp.status, "read-error", `erro de leitura, não diferença de render: ${evidence}`);
    assert.equal(cmp.status, "identical", `streams diferentes (${cmp.different.join(", ")}): ${evidence}`);
    const strip = (r) => r.checks.map((c) => [c.id, c.status]);
    assert.deepEqual(strip(qm), strip(qc));
    assert.notEqual(qm.status, "FAIL", JSON.stringify(qm.checks.filter((c) => c.status === "FAIL")));
  } finally { child.kill(); }
});
