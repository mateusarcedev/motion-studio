/** timelineHash: same edit, same hash, wherever the project or edit.json lives. */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reel as R } from "../packages/motion-core/index.js";
import { burstTranscript, noisySpeechWav, verticalVideo } from "./helpers/reel-fixtures.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = path.join(root, "tests", "tmp", "timeline-hash");
const base = (dir, up) => ({ schema: "motion.timeline", schemaVersion: 1, source: { path: path.join(dir, "talk.mp4"), sha256: "a".repeat(64), durationSec: 5 }, brief: { path: `${up}BRIEF.md`, sha256: "b".repeat(64) },
  output: { width: 1080, height: 1920, fps: 30, durationSec: 1 }, segments: R.computeDst([{ id: "a", src: [0, 1] }], 30), overlays: [],
  captions: { fontsDir: `${up}fonts`, style: { fontsDir: `${up}fonts` } }, overlayStyle: { fontsDir: `${up}fonts` }, audio: { music: { path: `${up}music/a.wav` } } });
before(async () => {
  await rm(tmp, { recursive: true, force: true });
  for (const p of ["p1", "p2"]) { await mkdir(path.join(tmp, p, "out", "deep"), { recursive: true }); await writeFile(path.join(tmp, p, "BRIEF.md"), "x"); }
});
const save = async (dir, sub, up, change = (t) => t) => (await R.saveTimeline(change(base(dir, up)), path.join(dir, sub, "edit.json"))).hash;

test("mesmo hash em outra pasta, outra profundidade e outro projeto", async () => {
  const p1 = path.join(tmp, "p1"), p2 = path.join(tmp, "p2");
  const h = await save(p1, "", "");
  assert.equal(await save(p1, "out", "../"), h);
  assert.equal(await save(p1, "out/deep", "../../"), h);
  assert.equal(await save(p2, "out", "../"), h);
  const loaded = await R.loadTimeline(path.join(p1, "out", "edit.json"));
  assert.equal(R.timelineHash(loaded), h, "carregada do disco");
});
test("hash de timeline em memória normaliza assets sem depender do caminho absoluto do projeto", () => {
  const make = (dir) => {
    const t = base(dir, "");
    t.captions.fontsDir = path.join(dir, "fonts");
    t.captions.style.fontsDir = path.join(dir, "fonts");
    t.overlayStyle.fontsDir = path.join(dir, "fonts");
    t.audio.music.path = path.join(dir, "music", "a.wav");
    return t;
  };
  const a = make(path.join(tmp, "p1")), b = make(path.join(tmp, "p2"));
  assert.equal(R.timelineHash(a), R.timelineHash(b));
  assert.equal(R.timelineHash(a), R.timelineHash(a, { file: path.join(tmp, "p1", "out", "edit.json") }));
});
test("hash sem local de arquivo preserva caminhos relativos sem resolvê-los contra o cwd", () => {
  const a = base(path.join(tmp, "p1"), "");
  const b = base(path.join(tmp, "p2"), "");
  for (const t of [a, b]) {
    t.captions.fontsDir = "fonts";
    t.captions.style.fontsDir = "fonts";
    t.overlayStyle.fontsDir = "fonts";
    t.audio.music.path = "music/a.wav";
  }
  assert.equal(R.timelineHash(a), R.timelineHash(b));
});
test("conteúdo diferente continua mudando o hash", async () => {
  const p1 = path.join(tmp, "p1"), h = await save(p1, "", "");
  assert.notEqual(await save(p1, "", "", (t) => { t.source.sha256 = "c".repeat(64); return t; }), h);
  assert.notEqual(await save(p1, "", "", (t) => { t.audio.music.path = "music/b.wav"; return t; }), h);
  assert.notEqual(await save(p1, "", "", (t) => { t.captions.fontsDir = "other"; return t; }), h);
});
test("edit validate aceita o hash atual e o antigo, e acusa edição manual", async () => {
  const file = path.join(tmp, "p1", "out", "edit.json");
  await save(path.join(tmp, "p1"), "out", "../");
  const validate = () => JSON.parse(spawnSync("node", [path.join(root, "packages/motion-cli/bin/motion.mjs"), "edit", "validate", file, "--json"], { encoding: "utf8" }).stdout).hashMatches;
  const t = JSON.parse(await readFile(file, "utf8"));
  assert.equal(validate(), true);
  await writeFile(file, JSON.stringify({ ...t, hash: R.legacyTimelineHash(t) })); assert.equal(validate(), true);
  await writeFile(file, JSON.stringify({ ...t, preset: "edited" })); assert.equal(validate(), false);
});
test("captions.json idêntico e com o hash do edit.json, renderizado de pastas diferentes", { timeout: 300000 }, async () => {
  const p1 = path.join(tmp, "p1");
  const video = await verticalVideo(p1, await noisySpeechWav(p1));
  const plan = await R.planEdit(video, { transcript: burstTranscript(await R.sha256File(video), video), preset: "talking-head" });
  const out = [];
  for (const sub of ["out", "out/deep"]) {
    const dir = path.join(p1, sub);
    const saved = await R.saveTimeline(plan, path.join(dir, "edit.json"));
    await R.renderTimeline(await R.loadTimeline(path.join(dir, "edit.json")), { output: path.join(dir, "reel.mp4"), mode: "preview" });
    const text = await readFile(path.join(dir, "reel.captions.json"), "utf8");
    assert.equal(JSON.parse(text).timelineHash, saved.hash);
    out.push(text);
  }
  assert.equal(out[0], out[1]);
});
