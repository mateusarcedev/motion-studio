/**
 * Determinism gate: plans and renders the same synthetic talk twice, in separate folders,
 * and compares hashes of decoded frames and samples. Exit 1 when they differ.
 * Every intermediate (segments, card PNG, captions, voice) is kept and hashed, so a difference is
 * located by stage; the folder is uploaded by the CI when the gate fails.
 */
import { appendFile, chmod, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { reel as R } from "../packages/motion-core/index.js";
import { launchBrowser } from "../packages/motion-core/lib/browser.mjs";
import { burstTranscript, noisySpeechWav, verticalVideo } from "../tests/helpers/reel-fixtures.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tests", "tmp", "ci-determinism");
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });

const sh = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28 }); return { ok: r.status === 0, out: r.stdout ?? "", err: r.stderr ?? r.error?.message ?? "" }; };
const attempt = async (fn) => { try { return await fn(); } catch (e) { return { error: e.message }; } };

// a pass-through ffmpeg that records each command line, so any stage can be replayed from the artifact
const realFfmpeg = sh("sh", ["-c", "command -v ffmpeg"]).out.trim();
const bin = path.join(root, "bin"), ffmpegLog = path.join(root, "ffmpeg-commands.log");
await mkdir(bin);
await writeFile(path.join(bin, "ffmpeg"), `#!/bin/bash\nprintf '%q ' "$@" >> "${ffmpegLog}"; echo >> "${ffmpegLog}"\nexec "${realFfmpeg}" "$@"\n`);
await chmod(path.join(bin, "ffmpeg"), 0o755);

const wav = await noisySpeechWav(root);
const video = await verticalVideo(root, wav);
const transcript = burstTranscript(await R.sha256File(video), video);
const runs = [];
const oldPath = process.env.PATH;
if (process.env.MOTION_DETERMINISM_WRAPPER !== "0") process.env.PATH = `${bin}${path.delimiter}${oldPath}`;
for (const k of ["a", "b"]) {
  const dir = path.join(root, k);
  await mkdir(dir, { recursive: true });
  const plan = await R.planEdit(video, { transcript, preset: "talking-head", faceBox: { x: 0.25, y: 0.25, w: 0.5, h: 0.4 },
    overlays: [{ id: "c1", kind: "title", at: { match: "legenda" }, durationSec: 1.2, lines: [{ text: "legenda no tempo" }] }] });
  const saved = await R.saveTimeline(plan, path.join(dir, "edit.json"));
  const timeline = await R.loadTimeline(path.join(dir, "edit.json"));
  const report = await R.renderTimeline(timeline, { output: path.join(dir, "reel.mp4"), keepWork: true });
  runs.push({ dir, work: path.join(dir, "reel.work"), hash: saved.hash, file: report.output, sha256: report.sha256 });
}
process.env.PATH = oldPath;

/** Decoded frames of a video or image: one hash per frame, in order. */
const frames = (file) => { const r = sh("ffmpeg", ["-v", "error", "-xerror", "-i", file, "-map", "0:v:0", "-f", "framehash", "-hash", "sha256", "-"]); return r.ok ? r.out.split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split(",").at(-1).trim()) : null; };
const diffFrames = (x, y) => { const out = []; for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) out.push(i); return out; };
/** PSNR per frame (dB), to size the difference. */
const psnr = (x, y) => [...sh("ffmpeg", ["-v", "error", "-i", x, "-i", y, "-lavfi", "[0:v][1:v]psnr=stats_file=-", "-f", "null", "-"]).out.matchAll(/psnr_avg:(\S+)/g)].map((m) => Number(m[1]));

const listing = async ({ dir, work }) => ({
  ...Object.fromEntries((await readdir(work)).filter((f) => /^seg-.*\.mp4$/.test(f)).sort().map((f) => [`segment:${f}`, path.join(work, f)])),
  ...Object.fromEntries(existsSync(path.join(work, "overlays")) ? (await readdir(path.join(work, "overlays"))).filter((f) => f.endsWith(".png")).sort().map((f) => [`card:${f}`, path.join(work, "overlays", f)]) : []),
  ...Object.fromEntries(["ass", "srt", "words.srt", "json"].map((e) => [`caption:${e}`, path.join(dir, `reel.captions.${e}`)]).filter(([, f]) => existsSync(f))),
  voice: path.join(dir, "reel.voice.wav"),
  final: path.join(dir, "reel.mp4"),
});
const [fa, fb] = [await listing(runs[0]), await listing(runs[1])];
const stages = [];
for (const name of new Set([...Object.keys(fa), ...Object.keys(fb)])) {
  const [x, y] = [fa[name], fb[name]];
  const s = { stage: name, a: x ? await R.sha256File(x) : null, b: y ? await R.sha256File(y) : null };
  s.identical = s.a !== null && s.a === s.b;
  if (!s.identical && x && y && /^(segment|card|final)/.test(name)) {
    const [ha, hb] = [frames(x), frames(y)];
    if (!ha || !hb) s.frames = "erro de leitura";
    else { const d = diffFrames(ha, hb), q = d.length ? psnr(x, y) : []; s.frames = { total: [ha.length, hb.length], differing: d, psnrDb: Object.fromEntries(d.map((i) => [i, q[i] ?? null])) }; }
  }
  stages.push(s);
}

const env = { wrapper: process.env.MOTION_DETERMINISM_WRAPPER !== "0", cpu: os.cpus()[0]?.model ?? null, cpus: os.cpus().length, flags: sh("lscpu", []).out.match(/^Flags:\s*(.*)$/m)?.[1].split(" ").filter((f) => /^(sse|ssse|avx|fma|bmi)/.test(f)).join(" ") ?? null, memGb: Math.round(os.totalmem() / 2 ** 30), node: process.version, ffmpeg: sh("ffmpeg", ["-version"]).out.split("\n")[0] };
const cardHtml = existsSync(path.join(runs[0].work, "overlays")) ? (await readdir(path.join(runs[0].work, "overlays"))).filter((f) => f.endsWith(".html")) : [];
env.chromium = await attempt(async () => {
  const { browser } = await launchBrowser();
  try {
    const out = { version: browser.version(), cardFonts: {} };
    const page = await browser.newPage();
    const cdp = await page.context().newCDPSession(page);
    for (const f of cardHtml) {
      await page.goto(pathToFileURL(path.join(runs[0].work, "overlays", f)).href);
      await page.evaluate(() => document.fonts.ready);
      await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
      const { root: doc } = await cdp.send("DOM.getDocument");
      const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: doc.nodeId, selector: ".card, .card *" });
      const used = new Set();
      for (const nodeId of nodeIds) for (const x of (await cdp.send("CSS.getPlatformFontsForNode", { nodeId })).fonts) used.add(`${x.familyName} / ${x.postScriptName ?? ""}`);
      out.cardFonts[f] = [...used];
    }
    return out;
  } finally { await browser.close(); }
});
// the fonts libass really picked for the captions
const ass = path.join(runs[0].dir, "reel.captions.ass");
env.captionFonts = existsSync(ass) ? [...new Set(sh("ffmpeg", ["-hide_banner", "-loglevel", "verbose", "-f", "lavfi", "-i", "color=black:s=1080x1920:r=30:d=8", "-vf", `ass='${ass.replace(/:/g, "\\:")}'`, "-f", "null", "-"]).err.match(/fontselect:.*/g) ?? [])] : [];
env.systemFonts = sh("fc-list", ["--format", "%{file} %{family} %{style}\n"]).out.trim().split("\n").filter(Boolean).sort();

const cmp = await R.compareRenders(runs[0].file, runs[1].file);
const ok = cmp.identical && runs[0].hash === runs[1].hash;
const firstDiff = stages.find((s) => !s.identical)?.stage ?? null;
const { systemFonts, ...envShort } = env;
const text = `Determinismo: ${ok ? "PASS" : "FAIL"}\ntimeline ${runs[0].hash} / ${runs[1].hash}\nprimeira etapa diferente: ${firstDiff ?? "nenhuma"}\nambiente ${JSON.stringify({ ...envShort, systemFonts: systemFonts.length }, null, 2)}\netapas ${JSON.stringify(stages, null, 2)}\ncomparação ${JSON.stringify(cmp, null, 2)}\n`;
await writeFile(path.join(root, "report.json"), JSON.stringify({ ok, firstDiff, env, stages, compare: cmp }, null, 2));
console.log(text);
console.log(`fontes do sistema:\n${systemFonts.join("\n")}`);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Determinismo\n\n\`\`\`\n${text}\`\`\`\n`);
process.exit(ok ? 0 : 1);
