/** TEMPORARY: full render time and output hash per CPU-independence variant (nothing is applied to the engine). */
import { chmod, mkdir, rm, writeFile, readdir } from "node:fs/promises"; import { spawnSync } from "node:child_process"; import os from "node:os"; import path from "node:path";
import { reel as R } from "../packages/motion-core/index.js"; import { burstTranscript, noisySpeechWav, verticalVideo } from "../tests/helpers/reel-fixtures.mjs";
const REPS = Number(process.argv[2] ?? 3), root = path.resolve("tests/tmp/bench-cpu");
await rm(root, { recursive: true, force: true }); await mkdir(root, { recursive: true });
const real = spawnSync("sh", ["-c", "command -v ffmpeg"], { encoding: "utf8" }).stdout.trim();
// the fixture is built without variants, so every variant gets the same source
const video = await verticalVideo(root, await noisySpeechWav(root));
const plan = await R.planEdit(video, { transcript: burstTranscript(await R.sha256File(video), video), preset: "talking-head", faceBox: { x: .25, y: .25, w: .5, h: .4 }, overlays: [{ id: "c1", kind: "title", at: { match: "legenda" }, durationSec: 1.2, lines: [{ text: "legenda no tempo" }] }] });
await R.saveTimeline(plan, path.join(root, "edit.json")); const tl = await R.loadTimeline(path.join(root, "edit.json"));
const V = { base: "", cpuflags0: "C", x264asm0: "X", sws: "S", all: "CXS", "x264asm0+sws": "XS" };
const oldPath = process.env.PATH, res = [];
console.log("BENCH cpu", os.cpus()[0].model, "source", (await R.sha256File(video)).slice(0, 12));
await R.renderTimeline(tl, { output: path.join(root, "warm.mp4") }); // warm-up
for (const [name, f] of Object.entries(V)) {
  const bin = path.join(root, `bin-${name}`); await mkdir(bin);
  await writeFile(path.join(bin, "ffmpeg"), `#!/bin/bash
a=(); x=0
${f.includes("C") ? "a+=(-cpuflags 0)" : ""}
for v in "$@"; do
  ${f.includes("S") ? `v="\${v//flags=lanczos/flags=lanczos+accurate_rnd+bitexact}"; [ "$prev" = -filter_complex ] && v="sws_flags=accurate_rnd+bitexact;$v"; [ "$v" = -vf ] && a+=(-sws_flags +accurate_rnd+bitexact)` : ":"}
  a+=("$v"); ${f.includes("X") ? `[ "$v" = libx264 ] && a+=(-x264-params asm=0)` : ":"}
  prev="$v"
done
exec "${real}" "\${a[@]}"
`); await chmod(path.join(bin, "ffmpeg"), 0o755);
  process.env.PATH = `${bin}:${oldPath}`;
  const t = [], h = new Set(), seg = new Set(); let parts;
  try { for (let i = 0; i < REPS; i++) {
    const d = path.join(root, `${name}-${i}`); await mkdir(d); const t0 = process.hrtime.bigint();
    const r = await R.renderTimeline(tl, { output: path.join(d, "reel.mp4"), keepWork: true });
    t.push(Number(process.hrtime.bigint() - t0) / 1e9); parts = r.timings;
    const c = await R.compareRenders(r.output, r.output); h.add(c.streams.video.decoded.a.slice(0, 12) + "/" + c.streams.audio.decoded.a.slice(0, 12));
    for (const s of (await readdir(path.join(d, "reel.work"))).filter((s) => /^seg.*mp4$/.test(s)).sort()) seg.add(`${s}:${(await R.sha256File(path.join(d, "reel.work", s))).slice(0, 12)}`);
    await rm(d, { recursive: true, force: true });
  } } catch (e) { console.log("BENCH", name, "ERRO", e.message, e.details); continue; } finally { process.env.PATH = oldPath; }
  t.sort((a, b) => a - b); const med = t[t.length >> 1]; res.push([name, med]);
  console.log("BENCH", JSON.stringify({ name, medianSec: +med.toFixed(2), min: +t[0].toFixed(2), max: +t.at(-1).toFixed(2), factor: +(med / res[0][1]).toFixed(2), timings: parts, av: [...h], seg: [...seg] }));
}
