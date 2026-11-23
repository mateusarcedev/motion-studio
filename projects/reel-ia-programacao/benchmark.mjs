#!/usr/bin/env node
/**
 * Benchmark reproduzível da homologação (Missão 21): original × edição MOTION × referência.
 * Uso: node benchmark.mjs  (a partir desta pasta; lê out/final e transcript/)
 * Saída: reviews/benchmark.json
 */
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reel as R } from "../../packages/motion-core/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// originals: MOTION_REEL_SOURCES, else the local copy of the raw video (out/source, not versioned)
const D = process.env.MOTION_REEL_SOURCES ?? path.join(here, "out/source");
const files = { original: `${D}/reels-motion.mp4`, motion: path.join(here, "out/final/reel.mp4"), reference: `${D}/reel-ia-programacao.mp4` };
const readJson = async (f) => JSON.parse(await readFile(path.join(here, f), "utf8"));
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);

function wer(ref, hyp) {
  const d = Array.from({ length: ref.length + 1 }, (_, i) => [i, ...Array(hyp.length).fill(0)]);
  for (let j = 1; j <= hyp.length; j++) d[0][j] = j;
  for (let i = 1; i <= ref.length; i++) for (let j = 1; j <= hyp.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
  return { wer: d[ref.length][hyp.length] / ref.length, edits: d[ref.length][hyp.length], refWords: ref.length };
}

function sceneCuts(file, threshold = 0.08) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-an", "-vf", `select='gt(scene,${threshold})',showinfo`, "-f", "null", "-"], { encoding: "utf8", maxBuffer: 64e6 });
  return [...r.stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
}

/** Caption sync against measured speech: share of cue/page words over speech, and onset offset. */
function captionSync(intervals, speech, tol = 0.12) {
  const over = intervals.filter(([a, b]) => speech.some((s) => s.end + tol > a && s.start - tol < b)).length;
  const offsets = intervals.map(([a]) => { const s = speech.reduce((m, x) => (Math.abs(x.start - a) < Math.abs(m - a) ? x.start : m), Infinity); return a - s; }).filter((x) => Math.abs(x) < 0.5);
  offsets.sort((x, y) => x - y);
  return { overSpeech: over / intervals.length, items: intervals.length, medianOnsetOffsetSec: offsets.length ? offsets[Math.floor(offsets.length / 2)] : null };
}

const out = { generatedBy: "projects/reel-ia-programacao/benchmark.mjs", files: {}, asr: {}, captions: {} };
const blocked = (f) => ({ status: "BLOCKED", reason: `${path.basename(f)} indisponível` });
for (const [k, f] of Object.entries(files)) {
  if (!existsSync(f)) { out.files[k] = blocked(f); continue; }
  const probe = await R.probeMedia(f);
  const ch = probe.audio.channels;
  const env = await R.energyEnvelope(f, { channels: ch });
  const vad = R.detectSpeech(env);
  const pauses = R.derivePauses(vad.segments, probe.durationSec);
  const loud = await R.measureLoudness(f); // stereo, as platforms measure (BS.1770 channel sum)
  const pn = R.pauseNoiseRatio(env, vad.segments, pauses);
  const longPauses = pauses.filter((p) => p.kind === "gap" && p.duration >= 0.3);
  out.files[k] = {
    path: path.relative(here, f), sha256: await R.sha256File(f), durationSec: probe.durationSec, video: `${probe.video.width}×${probe.video.height} ${probe.video.codec} ${probe.video.fps}fps`, audio: `${probe.audio.codec} ${probe.audio.sampleRate}Hz ${ch}ch`,
    loudness: { integratedLufs: loud.integratedLufs, truePeakDbtp: loud.truePeakDbtp, lraLu: loud.lraLu },
    speechSec: Math.round(vad.segments.reduce((n, s) => n + s.end - s.start, 0) * 100) / 100,
    speechRatio: Math.round((vad.segments.reduce((n, s) => n + s.end - s.start, 0) / probe.durationSec) * 1000) / 1000,
    pausesOver300ms: longPauses.length, pauseSecOver300ms: Math.round(longPauses.reduce((n, p) => n + p.duration, 0) * 100) / 100,
    speechToPauseDb: pn.ratioDb, noiseFloorDb: vad.noiseFloorDb, sceneCuts: sceneCuts(f).length,
  };
}

// ASR quality vs the human caption of the reference (upper bound: human captions drop/normalize words)
if (existsSync(`${D}/legendas.srt`) && existsSync(files.reference)) {
const human = R.parseSubtitles(await readFile(`${D}/legendas.srt`, "utf8"));
const refAsr = await readJson("transcript/reference.transcript.json");
const humanWords = norm(human.map((c) => c.text).join(" "));
out.asr.referenceVsHumanSrt = { ...wer(humanWords, norm(refAsr.words.map((w) => w.text).join(" "))), model: refAsr.provider.model, language: refAsr.language, note: "WER do faster-whisper small (glossário) sobre o áudio da referência contra a legenda humana dela; a legenda humana omite/normaliza palavras, então o valor é um limite superior do erro." };
} else out.asr.referenceVsHumanSrt = out.captions.reference = blocked("referência e legendas.srt");
const raw = await readJson("transcript/raw.transcript.json");
out.asr.raw = { words: raw.words.length, lowConfidence: raw.review.length, language: raw.language, languageProbability: raw.languageProbability, transcribeSec: raw.provider.timing.transcribeSec, durationSec: raw.durationSec };

// caption sync on the final audio of each edited video
const mEnv = await R.energyEnvelope(files.motion, { channels: 2 });
const mVad = R.detectSpeech(mEnv);
const tl = JSON.parse(await readFile(path.join(here, "out/final/reel.timeline.json"), "utf8"));
out.captions.motion = { ...captionSync(tl.captions.pages.map((p) => [p.start, p.end]), mVad.segments), pages: tl.captions.pages.length, words: tl.captions.words.length, source: "páginas da timeline (ASR revisado)" };
if (existsSync(`${D}/legendas.srt`) && existsSync(files.reference)) {
const human = R.parseSubtitles(await readFile(`${D}/legendas.srt`, "utf8"));
const rEnv = await R.energyEnvelope(files.reference, { channels: 2 });
const rVad = R.detectSpeech(rEnv);
out.captions.reference = { ...captionSync(human.map((c) => [c.start, c.end]), rVad.segments), pages: human.length, source: "legendas.srt (humana)" };
}
out.edit = { removedSec: tl.stats.removedSec, cuts: tl.stats.cuts, zoomCuts: tl.stats.zoomCuts, overlays: tl.overlays.length, decisions: tl.decisions, wordsLostUnexpected: tl.stats.wordsLostUnexpected };
await writeFile(path.join(here, "reviews/benchmark.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
