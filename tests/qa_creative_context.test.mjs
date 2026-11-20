import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { qaMedia, qaFrames } from "../packages/motion-core/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(root, "packages/motion-cli/bin/motion.mjs");
const temp = await mkdtemp(path.join(os.tmpdir(), "motion-creative-qa-"));
const haveFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0 && spawnSync("ffprobe", ["-version"]).status === 0;
const haveBrowser = existsSync(chromium.executablePath());
test.after(async () => rm(temp, { recursive: true, force: true }));
function ff(args) { return spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8" }); }
function check(report, id) { return report.checks.find((x) => x.id === id); }
function parseCli(result) { const start = result.stdout.indexOf("{"); return start < 0 ? null : JSON.parse(result.stdout.slice(start)); }

test("mobile legibility QA reports small secondary text, overlapping copy, and text outside social safe zones", { skip: !haveBrowser && "NOT_TESTED: Playwright Chromium indisponível" }, async (t) => {
  const html = path.join(temp, "creative.html"), png = path.join(temp, "creative.png");
  await writeFile(html, `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;width:360px;height:640px}p{position:absolute;left:12px;top:10px;font:10px sans-serif}.muted{color:#888}</style><p class="muted">Supporting line</p><p>Overlapping line</p>`);
  const base = spawnSync(process.execPath, [CLI, "render", "static", html, png, "--width=360", "--height=640", "--scale=1", "--qa-visual", "--qa-context=web"], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  assert.equal(base.status, 0, base.stderr || base.stdout);
  const report = parseCli(base); assert.ok(report?.visual);
  assert.ok(report.visual.secondaryTiny.length > 0, "secondary copy below mobile threshold is reported");
  assert.ok(report.visual.overlap.length > 0, "colliding text boxes are reported");

  const vertical = spawnSync(process.execPath, [CLI, "render", "static", html, png, "--width=360", "--height=640", "--scale=1", "--qa-visual", "--qa-context=story-vertical"], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  assert.equal(vertical.status, 0, vertical.stderr || vertical.stdout);
  assert.ok(parseCli(vertical).visual.outsideSafeZone.length > 0);
});

test("intentional dark scenes and reading holds are explained while accidental freeze remains visible", { skip: !haveFfmpeg && "NOT_TESTED: FFmpeg/FFprobe indisponíveis" }, async () => {
  const black = path.join(temp, "intentional-black.mp4"), hold = path.join(temp, "reading-hold.mp4");
  const b = ff(["-f", "lavfi", "-i", "color=c=black:s=64x64:r=10:d=3", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", black]);
  assert.equal(b.status, 0, b.stderr);
  const h = ff(["-f", "lavfi", "-i", "color=c=0x526780:s=64x64:r=10:d=3", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", hold]);
  assert.equal(h.status, 0, h.stderr);

  const unannotated = await qaMedia(hold);
  assert.equal(check(unannotated, "video.frozen").status, "WARN", "scene with no storyboard context remains a risk");
  const paused = await qaMedia(hold, { sceneContext: [{ startSec: 0, endSec: 3, kind: "reading-pause", label: "hold para leitura" }] });
  assert.equal(check(paused, "video.frozen").status, "PASS");
  assert.match(check(paused, "video.frozen").details, /pausa planejada/);

  const darkContext = await qaMedia(black, { sceneContext: [{ startSec: 0, endSec: 3, kind: "intentional-dark", tags: ["reading-pause"], label: "cartela escura" }] });
  assert.equal(check(darkContext, "video.black").status, "PASS");
  assert.equal(check(darkContext, "video.frozen").status, "PASS");
  const scopedFile = path.join(temp, "storyboard-context.json");
  await writeFile(scopedFile, JSON.stringify({ videos: { [path.basename(black)]: { scenes: [{ startSec: 0, endSec: 3, kind: "intentional-dark", label: "cartela escura" }] } } }));
  const cli = spawnSync(process.execPath, [CLI, "qa", "media", black, `--context=${scopedFile}`, "--json"], { encoding: "utf8", maxBuffer: 1024 * 1024 });
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  assert.equal(parseCli(cli).checks.find((x) => x.id === "video.black").status, "PASS", "CLI resolves per-file storyboard context");
  const unplannedBlack = await qaMedia(black);
  assert.equal(check(unplannedBlack, "video.black").status, "WARN");
  assert.equal(check(unplannedBlack, "video.frozen").status, "WARN");
});

test("frame similarity keeps the detector active but respects a declared static end card", { skip: !haveFfmpeg && "NOT_TESTED: FFmpeg indisponível" }, async () => {
  const dir = path.join(temp, "static-card"); await mkdir(dir, { recursive: true });
  const source = path.join(temp, "black.png");
  const made = ff(["-f", "lavfi", "-i", "color=c=black:s=32x18", "-frames:v", "1", source]);
  assert.equal(made.status, 0, made.stderr);
  for (let i = 0; i < 6; i++) await writeFile(path.join(dir, `${String(i).padStart(4, "0")}.png`), await readFile(source));
  const plain = await qaFrames(dir);
  assert.equal(check(plain, "static").status, "FAIL", "unannotated all-identical frames are still detected");
  assert.equal(check(plain, "dark").status, "WARN");
  const context = { scenes: [{ startFrame: 0, endFrame: 5, kind: "final-hold", tags: ["intentional-dark"], label: "cartela final" }] };
  const planned = await qaFrames(dir, { sceneContext: context });
  assert.equal(check(planned, "static").status, "PASS");
  assert.equal(check(planned, "dark").status, "PASS");
  assert.ok(check(planned, "repetition").details.includes("pares adjacentes"));
});
