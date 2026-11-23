/**
 * Determinism gate: plans and renders the same synthetic talk twice, in separate folders,
 * and compares hashes of decoded frames and samples. Exit 1 when they differ.
 */
import { appendFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reel as R } from "../packages/motion-core/index.js";
import { burstTranscript, noisySpeechWav, verticalVideo } from "../tests/helpers/reel-fixtures.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tests", "tmp", "ci-determinism");
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
const wav = await noisySpeechWav(root);
const video = await verticalVideo(root, wav);
const transcript = burstTranscript(await R.sha256File(video), video);
const runs = [];
for (const k of ["a", "b"]) {
  const dir = path.join(root, k);
  await mkdir(dir, { recursive: true });
  const plan = await R.planEdit(video, { transcript, preset: "talking-head", faceBox: { x: 0.25, y: 0.25, w: 0.5, h: 0.4 },
    overlays: [{ id: "c1", kind: "title", at: { match: "legenda" }, durationSec: 1.2, lines: [{ text: "legenda no tempo" }] }] });
  const saved = await R.saveTimeline(plan, path.join(dir, "edit.json"));
  const timeline = await R.loadTimeline(path.join(dir, "edit.json"));
  const report = await R.renderTimeline(timeline, { output: path.join(dir, "reel.mp4") });
  runs.push({ hash: saved.hash, file: report.output, sha256: report.sha256 });
}
const cmp = await R.compareRenders(runs[0].file, runs[1].file);
const ok = cmp.identical && runs[0].hash === runs[1].hash;
const text = `Determinismo: ${ok ? "PASS" : "FAIL"}\ntimeline ${runs[0].hash} / ${runs[1].hash}\nA ${cmp.a}\nB ${cmp.b}\n`;
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Determinismo\n\n\`\`\`\n${text}\`\`\`\n`);
process.exit(ok ? 0 : 1);
