/** Mission 21.1 (B1) — speech-to-pause metric, gain/expander order, AAC true peak, sibilants, A/B, denoiser trust. */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reel as R } from "../packages/motion-core/index.js";
import { BURSTS, burstTranscript, ff, noisySpeechWav, verticalVideo } from "./helpers/reel-fixtures.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = path.join(root, "tests", "tmp", "voice2");
const byId = (r, id) => r.checks.find((c) => c.id === id);
let wav, video;
before(async () => { await rm(tmp, { recursive: true, force: true }); await mkdir(tmp, { recursive: true }); wav = await noisySpeechWav(tmp); video = await verticalVideo(tmp, wav); });

describe("audio.speech-to-pause", () => {
  const env = (speech, pause) => { const e = new Float64Array(800).fill(pause); for (const [a, b] of BURSTS) for (let i = a * 100; i < b * 100; i++) e[Math.round(i)] = speech; return e; };
  const limits = R.PRESETS.voice.natural.speechToPause;
  test("PASS sem piora, WARN até o limite, FAIL acima, NOT_TESTED sem pausas", () => {
    const base = env(-18, -50);
    const st = (pause) => R.speechToPauseCheck(base, env(-18, pause), limits).status;
    assert.equal(st(-50), "PASS"); assert.equal(st(-53), "PASS");
    assert.equal(st(-49), "WARN"); assert.equal(st(-48.5), "WARN");
    assert.equal(st(-48.4), "FAIL");
    assert.equal(R.speechToPauseCheck(new Float64Array(300).fill(-18), new Float64Array(300).fill(-18), limits).status, "NOT_TESTED");
  });
  test("limites por preset vêm de presets.json: studio 3, natural 1,5, clean/noisy-room 2", () => {
    const l = Object.fromEntries(Object.entries(R.PRESETS.voice).map(([k, v]) => [k, v.speechToPause.maxWorseningDb]));
    assert.deepEqual(l, { natural: 1.5, clean: 2, studio: 3, "noisy-room": 2 });
  });
  test("regressão medida: ganho + compressão forte sem expansor é detectado (FAIL)", async () => {
    const r = await R.processVoice(wav, { output: path.join(tmp, "bad.wav"), preset: "natural", overrides: { denoise: null, expander: null, compressor: { thresholdDb: -40, ratio: 8, bypassBelowLraLu: 0, reduceBelowLraLu: 0 } } });
    assert.equal(byId(r.qa, "audio.speech-to-pause").status, "FAIL", r.speechToPause.details);
    assert.equal(r.qa.status, "FAIL");
  });
});

describe("Cadeia v2", () => {
  for (const preset of ["natural", "clean", "studio", "noisy-room"]) test(`${preset}: LUFS em ±0,5, true peak no teto, fala preservada, sem piora`, async () => {
    const r = await R.processVoice(wav, { output: path.join(tmp, `${preset}.wav`), preset, channels: 2 });
    for (const id of ["voice.loudness", "voice.truepeak", "voice.speech-preserved", "voice.latency", "voice.duration", "audio.speech-to-pause"]) assert.equal(byId(r.qa, id).status, "PASS", `${id}: ${byId(r.qa, id).details}`);
    assert.equal(r.chainVersion, 2);
    assert.equal(typeof r.loudnessPass.readjustGainDb, "number", "um único reajuste");
    assert.equal((await R.probeMedia(r.output)).audio.channels, 2);
  });
  test("expansor é o último e reduz as pausas; limitador só entra com pico acima do teto", async () => {
    const run = (expander, n) => R.processVoice(wav, { output: path.join(tmp, `${n}.wav`), preset: "clean", overrides: { expander } });
    const on = await run({}, "exp-on"), off = await run(null, "exp-off");
    assert.ok(off.speechToPause.after.pauseDb - on.speechToPause.after.pauseDb > 1, `${off.speechToPause.after.pauseDb} × ${on.speechToPause.after.pauseDb}`);
    assert.doesNotMatch(on.chain, /agate|sidechaingate/, "o expansor não fica antes do ganho");
    assert.equal(on.loudnessPass.limiter !== null, on.loudnessPass.peakBeforeLimiterDbtp > -1.5);
  });
  test("LUFS fora de ±0,5 depois do único reajuste vira WARN, sem nova iteração", async () => {
    // one loud click forces the limiter to remove level that is not compensated again
    const spiky = path.join(tmp, "spiky.wav");
    assert.equal(ff(["-i", wav, "-af", "asetnsamples=48,volume='if(between(mod(t,0.05),0,0.004),1,0.1)':eval=frame,volume=0.9", spiky]).status, 0);
    const r = await R.processVoice(spiky, { output: path.join(tmp, "spiky-out.wav"), preset: "natural", overrides: { denoise: null, compressor: null, loudness: { truePeakDb: -9 } } });
    assert.equal(byId(r.qa, "voice.loudness").status === "PASS", Math.abs(r.after.loudness.integratedLufs + 14) <= 0.5);
    assert.ok(Math.abs(r.after.loudness.integratedLufs + 14) > 0.5, String(r.after.loudness.integratedLufs));
    assert.notEqual(byId(r.qa, "voice.loudness").status, "PASS");
  });
});

describe("A/B por trechos", () => {
  test("3 a 5 trechos separados, índice com hashes, e arquivos alheios na pasta preservados", async () => {
    const dir = path.join(tmp, "ab"); await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "minhas-notas.txt"), "não apagar");
    const r = await R.processVoice(wav, { output: path.join(tmp, "ab.wav"), preset: "clean", abDir: dir, ab: { clips: 4, clipSec: 2, minSpeechRatio: 0.4 } });
    assert.ok(r.ab.clips.length >= 3 && r.ab.clips.length <= 5, String(r.ab.clips.length));
    r.ab.clips.forEach((c, i) => { if (i) assert.ok(c.start >= r.ab.clips[i - 1].end - 1e-6, "sem sobreposição"); });
    const idx = JSON.parse(await readFile(r.ab.index, "utf8"));
    assert.equal(idx.humanListening, "NOT_TESTED"); assert.match(idx.clips[0].beforeSha256, /^[0-9a-f]{64}$/);
    assert.ok(existsSync(path.join(dir, "minhas-notas.txt")));
  });
});

describe("Sibilantes", () => {
  test("/s/ fraco no fim da fala estende a borda; silêncio não estende", async () => {
    const f = path.join(tmp, "sib.wav");
    assert.equal(ff(["-f", "lavfi", "-i", "aevalsrc=exprs='0.25*sin(2*PI*200*t)*between(t,0.5,1.5)+0.25*sin(2*PI*200*t)*between(t,2.5,3.2)':s=48000:d=4", "-f", "lavfi", "-i", "anoisesrc=color=white:seed=3:sample_rate=48000:duration=4:amplitude=0.02",
      "-f", "lavfi", "-i", "anoisesrc=color=white:seed=9:sample_rate=48000:duration=4:amplitude=0.0004", "-filter_complex", "[1:a]highpass=f=5000,volume='between(t,1.53,1.65)':eval=frame[s];[0:a][s][2:a]amix=inputs=3:normalize=0[o]", "-map", "[o]", f]).status, 0);
    const speech = [{ start: 0.5, end: 1.5 }, { start: 2.5, end: 3.2 }];
    const cfg = R.PRESETS.edit["talking-head"].cut.sibilants;
    const r = await R.extendSpeechToSibilants(f, speech, cfg, { durationSec: 4 });
    assert.ok(Math.abs(r.speech[0].end - 1.65) <= 0.04, JSON.stringify(r));
    assert.ok(r.speech[1].end - 3.2 <= 0.02, JSON.stringify(r));
  });
});

describe("True peak no arquivo entregue e QA final", () => {
  test("AAC acima do teto é recodificado com menos ganho; medido no MP4", { timeout: 180000 }, async () => {
    const plan = await R.planEdit(video, { transcript: burstTranscript(await R.sha256File(video), video), preset: "talking-head", audio: { preset: "clean" } });
    plan.export.loudness.truePeakDb = -8; // below what the voice stage delivers: forces the post-encode loop
    const file = path.join(tmp, "tp.json"); await R.saveTimeline(plan, file);
    const rep = await R.renderTimeline(await R.loadTimeline(file), { output: path.join(tmp, "tp.mp4"), skipOverlays: true });
    assert.ok(rep.truePeak.attempts.length >= 2, JSON.stringify(rep.truePeak));
    assert.equal(rep.truePeak.ok, true, JSON.stringify(rep.truePeak));
    const m = await R.measureLoudness(rep.output);
    assert.ok(m.truePeakDbtp <= -8, String(m.truePeakDbtp));
    const qa = (await R.qaReel(rep.output, { timeline: await R.loadTimeline(file), renderReport: rep })).toJSON();
    assert.equal(byId(qa, "audio.true-peak").status, "PASS");
    assert.ok(["PASS", "WARN"].includes(byId(qa, "audio.speech-to-pause").status), byId(qa, "audio.speech-to-pause").details);
    assert.equal(byId(qa, "timeline.frames").status, "PASS", "o vídeo copiado não muda");
  });
});

describe("Denoiser externo só com hash conferido", () => {
  const withEnv = async (env, fn) => { const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]])); Object.assign(process.env, env); try { return await fn(); } finally { for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v); } };
  test("sem hash de referência ou com hash diferente: não é usado", async () => {
    const fake = path.join(tmp, "deep-filter"); await writeFile(fake, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    await withEnv({ MOTION_DEEPFILTER: fake, MOTION_DEEPFILTER_SHA256: "" }, async () => assert.equal((await R.deepFilterStatus()).state, "unverified"));
    await withEnv({ MOTION_DEEPFILTER: fake, MOTION_DEEPFILTER_SHA256: "0".repeat(64) }, async () => {
      assert.equal((await R.deepFilterStatus()).state, "mismatch");
      await assert.rejects(R.processVoice(wav, { output: path.join(tmp, "df.wav"), denoiser: "deepfilternet" }), /DeepFilterNet pedido/);
      const r = await R.processVoice(wav, { output: path.join(tmp, "auto.wav"), preset: "clean", denoiser: "auto" });
      assert.equal(r.denoiser, "ffmpeg"); assert.match(r.denoiserFallback, /mismatch/);
      assert.equal(byId(r.qa, "voice.denoiser").status, "WARN");
    });
  });
  test("motion audio doctor --json informa o provedor do modo auto", () => {
    const r = spawnSync("node", [path.join(root, "packages/motion-cli/bin/motion.mjs"), "audio", "doctor", "--json"], { encoding: "utf8" });
    const j = JSON.parse(r.stdout);
    assert.equal(j.ok, true); assert.ok(["ffmpeg-afftdn", "deepfilternet"].includes(j.autoDenoiser));
  });
});

describe("Presets são dados", () => {
  test("ritmos reel, aula, entrevista e institucional; QA configurável por projeto", () => {
    for (const id of ["talking-head", "tutorial", "interview", "institucional", "podcast"]) assert.ok(R.EDIT_PRESETS[id], id);
    assert.equal(R.resolveQaParams("tutorial").shots.minSec, 1);
    assert.equal(R.resolveQaParams("tutorial", { shots: { minSec: 2 } }).shots.minSec, 2);
    assert.throws(() => { R.PRESETS.voice.clean.highpassHz = 1; }, TypeError);
  });
});
