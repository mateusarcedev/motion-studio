/** Mission 21 — Smart Reel Editor, Voice Studio, Speech-to-Text, captions, render, QA, CLI and MCP. */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reel as R } from "../packages/motion-core/index.js";
import { handleMessage, TOOLS } from "../packages/motion-cli/lib/mcp.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const tmp = path.join(here, "tmp", "reel");
const CLI = path.join(root, "packages/motion-cli/bin/motion.mjs");
const ff = (args) => spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8" });
const haveFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
const haveFlite = haveFfmpeg && ff(["-f", "lavfi", "-i", "flite=text=ok", "-f", "null", "-"]).status === 0;
const byId = (r, id) => r.checks.find((c) => c.id === id);

const FIX = path.join(tmp, "talk.mp4");      // speech-like bursts + 60 Hz hum, 1080×1920
const SPEECH = path.join(tmp, "speech.mp4");  // real synthetic speech (flite) with a long leading pause
const BURSTS = [[0.5, 1.7], [2.6, 3.6], [3.8, 5.2]];
// evaluated at load time: test skip options are computed before before() runs
const sttReady = Boolean((await R.sttDoctor().catch(() => null))?.providers.find((p) => p.id === "faster-whisper")?.ok);

before(async () => {
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  if (!haveFfmpeg) return;
  const gate = BURSTS.map(([a, b]) => `between(t,${a},${b})`).join("+");
  const audio = `aevalsrc=exprs='(0.25*sin(2*PI*180*t)+0.12*sin(2*PI*360*t)+0.06*sin(2*PI*1200*t))*(0.6+0.4*sin(2*PI*4*t))*(${gate})+0.004*sin(2*PI*60*t)|(0.25*sin(2*PI*180*t)+0.12*sin(2*PI*360*t)+0.06*sin(2*PI*1200*t))*(0.6+0.4*sin(2*PI*4*t))*(${gate})+0.004*sin(2*PI*60*t)':s=48000:d=6`;
  let r = ff(["-f", "lavfi", "-i", "testsrc2=s=1080x1920:r=30:d=6", "-f", "lavfi", "-i", audio, "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", FIX]);
  assert.equal(r.status, 0, r.stderr);
  if (haveFlite) {
    r = ff(["-f", "lavfi", "-i", "testsrc2=s=1080x1920:r=30:d=6", "-f", "lavfi", "-i", "flite=text='the quick brown fox jumps over the lazy dog':voice=slt",
      "-filter_complex", "[1:a]aresample=48000,adelay=1500|1500,apad=whole_dur=6,pan=stereo|c0=c0|c1=c0[a]", "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-t", "6", SPEECH]);
    assert.equal(r.status, 0, r.stderr);
  }
});

describe("Speech-to-Text — provedores, importação, correções", () => {
  test("registro de provedores: faster-whisper implementado; whisper-cpp/openai/gemini declarados e não implementados", async () => {
    const list = R.listSttProviders();
    assert.ok(list.find((p) => p.id === "faster-whisper" && p.implemented));
    for (const id of ["whisper-cpp", "openai", "gemini"]) assert.equal(list.find((p) => p.id === id).implemented, false);
    await assert.rejects(R.transcribeMedia(FIX, { provider: "openai" }), (e) => e.code === "MOTION_STT_PROVIDER_NOT_IMPLEMENTED");
    await assert.rejects(R.transcribeMedia(FIX, { provider: "inexistente" }), (e) => e.code === "MOTION_STT_UNAVAILABLE");
  });
  test("falha honesta quando o ambiente Python do STT não existe (sem fallback silencioso)", { skip: !haveFfmpeg }, async () => {
    const old = process.env.MOTION_STT_PYTHON;
    process.env.MOTION_STT_PYTHON = path.join(tmp, "nao-existe", "python");
    try { await assert.rejects(R.transcribeMedia(FIX), (e) => e.code === "MOTION_STT_UNAVAILABLE" && /STT/.test(e.message)); }
    finally { if (old === undefined) delete process.env.MOTION_STT_PYTHON; else process.env.MOTION_STT_PYTHON = old; }
  });
  test("SRT e VTT: parsing, palavras interpoladas e escopo restrito à mídia da legenda", () => {
    const srt = "1\n00:00:00,060 --> 00:00:00,540\nse você\n\n2\n00:00:00,540 --> 00:00:00,860\n<i>dev</i>\n";
    const cues = R.parseSubtitles(srt);
    assert.deepEqual(cues.map((c) => c.text), ["se você", "dev"]);
    const vtt = R.parseSubtitles("WEBVTT\n\n00:01.000 --> 00:02.500\nolá mundo\n");
    assert.equal(vtt[0].start, 1); assert.equal(vtt[0].end, 2.5);
    const t = R.subtitlesToTranscript(cues, { durationSec: 1 });
    assert.equal(t.scope, "imported-subtitle");
    assert.equal(t.words[0].timing, "interpolated");
    assert.equal(t.words[2].timing, "cue");
    assert.match(t.warnings[0], /não substitui a transcrição/);
    assert.throws(() => R.parseSubtitles("1\n00:00:02,000 --> 00:00:01,000\nx\n"), /inválido/);
  });
  test("plano ignora transcrição de outro arquivo (legenda de referência não é transcrição do bruto)", { skip: !haveFfmpeg }, async () => {
    const t = R.subtitlesToTranscript([{ start: 0.5, end: 1.5, text: "palavra inventada" }], { durationSec: 6, appliesTo: { path: "/outro.mp4", sha256: "0".repeat(64) } });
    const plan = await R.planEdit(FIX, { transcript: t });
    assert.equal(plan.captions.pages.length, 0);
    assert.match(plan.warnings.join(" "), /pertence a outro arquivo/);
  });
  test("correções exigem proveniência, palavras consecutivas e preservam os tempos", () => {
    const words = ["para", "o", "pro", "-aroclente", "aquilo"].map((w, i) => ({ id: `w${i + 1}`, text: w, start: i, end: i + 0.5, confidence: 0.3, timing: "word", segment: 0 }));
    const t = { words, segments: [{ wordIds: words.map((w) => w.id), text: "" }], review: words.map((w) => ({ wordId: w.id })), corrections: [] };
    assert.throws(() => R.applyCorrections(t, [{ wordIds: ["w1"], text: "x" }]), /proveniência/);
    assert.throws(() => R.applyCorrections(t, [{ wordIds: ["w1", "w3"], text: "x", reason: "r", by: "operator" }]), /consecutivas/);
    const c = R.applyCorrections(t, [{ wordIds: ["w1", "w2", "w3", "w4"], text: "pro próprio cliente", reason: "ASR", by: "operator", evidence: "legenda humana" }]);
    assert.deepEqual(c.words.map((w) => w.text), ["pro", "próprio", "cliente", "aquilo"]);
    assert.equal(c.words[0].start, 0); assert.equal(c.words[2].end, 3.5);
    assert.equal(c.corrections[0].before, "para o pro -aroclente");
    assert.equal(c.review.length, 1);
    assert.equal(t.words.length, 5, "o original não é mutado");
  });
  test("normalização do faster-whisper marca alucinação em loop e baixa confiança para revisão", () => {
    const loop = Array.from({ length: 12 }, (_, i) => ({ text: " refinar,", start: 1 + i * 0.2, end: 1.18 + i * 0.2, probability: 0.9 }));
    const raw = { durationSec: 5, language: "pt", languageProbability: 0.98, model: { name: "small" }, versions: {}, decoding: {},
      segments: [{ start: 0, end: 1, text: "olá", avgLogprob: -0.2, noSpeechProb: 0.01, compressionRatio: 1.2, words: [{ text: " olá", start: 0.1, end: 0.5, probability: 0.3 }] },
        { start: 1, end: 3.6, text: "refinar...", avgLogprob: -0.1, noSpeechProb: 0.0, compressionRatio: 3.1, words: loop }] };
    const t = R.normalizeFasterWhisper(raw, {});
    assert.equal(t.segments[1].hallucinationSuspected, true);
    assert.equal(t.words.filter((w) => w.suspect).length, 11);
    assert.ok(t.review.some((r) => r.reason.includes("baixa confiança") && r.text === "olá"));
    assert.ok(t.silences.some((s) => s.kind === "trailing"));
    const pages = R.buildPages(t.words.map((w) => ({ ...w })), {});
    assert.equal(pages.flatMap((p) => p.words).filter((w) => w.text === "refinar,").length, 1, "palavras suspeitas nunca viram legenda");
  });
  test("transcrição real (faster-whisper local): idioma, palavras, timestamps alinhados à fala e silêncio inicial", { skip: !haveFlite || !sttReady ? "faster-whisper/flite indisponível" : false, timeout: 300000 }, async () => {
    const before = await R.sha256File(SPEECH);
    const t = await R.transcribeMedia(SPEECH, { language: "en", threads: 2 });
    assert.equal(t.schema, "motion.transcript");
    assert.equal(t.provider.id, "faster-whisper");
    assert.ok(t.provider.model.revision, "revisão do modelo registrada");
    assert.ok(t.provider.versions.faster_whisper && t.provider.versions.ctranslate2);
    const text = t.words.map((w) => w.text.toLowerCase().replace(/[^a-z]/g, "")).join(" ");
    for (const w of ["quick", "brown", "fox", "lazy", "dog"]) assert.ok(text.includes(w), `"${w}" em: ${text}`);
    // Whisper word timestamps are approximate (often a few hundred ms early); the engine
    // refines them against measured speech energy before cutting/captioning.
    assert.ok(t.words[0].start >= 0.9 && t.words[0].start <= 1.9, `ASR: primeira palavra em ${t.words[0].start}s (fala começa em 1,5 s)`);
    // independent ground truth: first 10 ms window above −50 dBFS in the isolated flite audio, + 1.5 s delay
    const solo = path.join(tmp, "flite-solo.wav");
    ff(["-f", "lavfi", "-i", "flite=text='the quick brown fox jumps over the lazy dog':voice=slt", "-ar", "48000", solo]);
    const env = await R.energyEnvelope(solo);
    const truth = 1.5 + env.findIndex((v) => v > -50) * 0.01;
    const a = await R.analyzeMedia(SPEECH);
    const onset = a.audio.speech[0].start;
    assert.ok(Math.abs(onset - truth) < 0.08, `VAD: fala começa em ${onset}s (referência ${truth}s)`);
    const refined = R.refineWordTiming(t.words, a.audio.speech);
    assert.ok(Math.abs(refined[0].start - onset) < 0.05, `alinhamento refinado: ${refined[0].start}s × fala ${onset}s`);
    assert.ok(t.words.every((w, i) => w.end > w.start && (i === 0 || w.start >= t.words[i - 1].start)));
    assert.ok(t.silences[0].kind === "leading" && t.silences[0].duration >= 0.9, "silêncio inicial identificado (tolerância do ASR)");
    assert.equal(await R.sha256File(SPEECH), before, "arquivo original intacto");
    await writeFile(path.join(tmp, "speech.transcript.json"), JSON.stringify(t));
  });
});

describe("Análise e Voice Studio", () => {
  test("análise: fala por energia, pausas, loudness e zumbido de 60 Hz", { skip: !haveFfmpeg }, async () => {
    const a = await R.analyzeMedia(FIX);
    assert.equal(a.probe.video.width, 1080); assert.equal(a.probe.video.height, 1920);
    assert.equal(a.audio.speech.length, 3, JSON.stringify(a.audio.speech));
    a.audio.speech.forEach((s, i) => { assert.ok(Math.abs(s.start - BURSTS[i][0]) < 0.08 && Math.abs(s.end - BURSTS[i][1]) < 0.12, JSON.stringify(s)); });
    assert.ok(a.audio.pauses.some((p) => p.kind === "gap" && p.duration > 0.8));
    assert.equal(a.audio.hum.detected, true); assert.equal(a.audio.hum.baseHz, 60);
    assert.ok(Number.isFinite(a.audio.loudness.integratedLufs));
  });
  test("presets de voz: natural/clean/studio/noisy-room configuráveis e não destrutivos", () => {
    assert.deepEqual(R.listVoicePresets().map((p) => p.id).sort(), ["clean", "natural", "noisy-room", "studio"]);
    const p = R.resolveVoiceParams("studio", { highpassHz: 120, deesser: null }, { noiseFloorDb: -60, snrDb: 45, speechLevelDb: -16, lraLu: 8 });
    assert.equal(p.highpassHz, 120); assert.equal(p.deesser, null);
    assert.equal(p.denoise.appliedDb, 6, "gravação limpa recebe metade da redução");
    assert.equal(p.compressor.thresholdDb, -26, "limiar relativo à fala medida");
    const chain = R.buildVoiceChain(p);
    assert.match(chain, /highpass=f=120/); assert.doesNotMatch(chain, /deesser/);
    const squashed = R.resolveVoiceParams("clean", {}, { speechLevelDb: -14, lraLu: 2.5 });
    assert.equal(squashed.compressor.ratio, 1.6, "fonte já comprimida não é comprimida de novo");
    assert.throws(() => R.resolveVoiceParams("radio"), /desconhecido/);
  });
  test("tratamento: sem clipping, loudness no alvo, fala preservada, latência compensada, A/B com loudness casado", { skip: !haveFfmpeg, timeout: 120000 }, async () => {
    const before = await R.sha256File(FIX);
    const r = await R.processVoice(FIX, { output: path.join(tmp, "voice.wav"), preset: "noisy-room", abDir: path.join(tmp, "ab") });
    assert.equal(byId(r.qa, "voice.truepeak").status, "PASS", JSON.stringify(r.after));
    assert.equal(byId(r.qa, "voice.samplepeak").status, "PASS");
    assert.equal(byId(r.qa, "voice.loudness").status, "PASS");
    assert.equal(byId(r.qa, "voice.speech-preserved").status, "PASS", byId(r.qa, "voice.speech-preserved").details);
    assert.equal(byId(r.qa, "voice.latency").status, "PASS", byId(r.qa, "voice.latency").details);
    assert.equal(byId(r.qa, "voice.listening").status, "NOT_TESTED", "qualidade de estúdio nunca é declarada sem escuta");
    assert.ok(r.params.dehum && r.params.dehum.baseHz === 60);
    for (const k of ["original", "originalLoudnessMatched", "beforeSample", "afterSample"]) assert.ok(existsSync(r.ab[k]), k);
    const lm = await R.measureLoudness(r.ab.originalLoudnessMatched);
    assert.ok(Math.abs(lm.integratedLufs - r.after.loudness.integratedLufs) < 1.2, "A/B no mesmo nível");
    assert.equal(r.source.unchanged, true); assert.equal(await R.sha256File(FIX), before);
  });
  test("cortes + música com ducking: duração exata em amostras e sem clipping", { skip: !haveFfmpeg, timeout: 120000 }, async () => {
    const music = path.join(tmp, "music.wav");
    ff(["-f", "lavfi", "-i", "sine=f=440:d=3:sample_rate=48000", "-af", "volume=0.5", music]);
    const segs = [[0.4, 1.8], [2.5, 3.7]];
    const r = await R.processVoice(FIX, { output: path.join(tmp, "voice-music.wav"), preset: "clean", segments: segs, music: { path: music, gainDb: -12 } });
    const expected = segs.reduce((n, [a, b]) => n + Math.round((b - a) * 48000), 0);
    const info = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=duration_ts,sample_rate", "-of", "json", r.output], { encoding: "utf8" });
    assert.equal(JSON.parse(info.stdout).streams[0].duration_ts, expected);
    assert.equal(byId(r.qa, "voice.truepeak").status, "PASS");
    assert.ok(r.music.sha256 && r.music.duck.ratio > 1);
  });
  test("DeepFilterNet pedido sem binário → erro claro (sem trocar de motor em silêncio)", { skip: !haveFfmpeg || Boolean(R.deepFilterBinary()) }, async () => {
    await assert.rejects(R.processVoice(FIX, { output: path.join(tmp, "df.wav"), denoiser: "deepfilternet" }), /DeepFilterNet/);
  });
});

describe("Timeline, cortes e legendas", () => {
  test("grade de quadros: dst contíguo, quadros inteiros, validação e hash estável", () => {
    const segs = R.computeDst([{ id: "a", src: [0.51, 1.73] }, { id: "b", src: [2.6, 3.61] }], 30);
    assert.equal(segs[0].frames, 37); assert.equal(segs[1].dst[0], segs[0].dst[1]);
    assert.ok(Math.abs(segs[1].dst[1] * 30 - (segs[0].frames + segs[1].frames)) < 1e-4, "fim exatamente sobre a grade de quadros");
    const t = { schema: "motion.timeline", schemaVersion: 1, source: { path: "x", sha256: "a".repeat(64), durationSec: 5 }, output: { width: 1080, height: 1920, fps: 30, durationSec: segs[1].dst[1] }, segments: segs, overlays: [] };
    assert.deepEqual(R.validateTimeline(t), []);
    assert.equal(R.timelineHash(t), R.timelineHash(structuredClone(t)));
    assert.ok(R.validateTimeline({ ...t, output: { ...t.output, width: 1081 } }).some((e) => /pares/.test(e)));
    assert.ok(R.validateTimeline({ ...t, segments: [segs[1], segs[0]] }).some((e) => /contíguo/.test(e)));
  });
  test("sincronização após cortes: palavras remapeadas, removidas por decisão nunca reaparecem", () => {
    const segs = R.computeDst([{ id: "a", src: [0, 2] }, { id: "b", src: [3, 5] }], 30);
    const words = [{ id: "w1", text: "um", start: 0.5, end: 0.9 }, { id: "w2", text: "cortado", start: 2.2, end: 2.8 }, { id: "w3", text: "dois", start: 3.4, end: 3.8 }, { id: "w4", text: "borda", start: 1.8, end: 2.4 }];
    const { words: out, lost } = R.remapWords(words, segs, { excluded: [[2.1, 2.9]] });
    assert.deepEqual(lost.map((w) => w.id), ["w2"]);
    assert.equal(out.find((w) => w.id === "w3").start, 2.4, "3.4 − 1 s removido");
    assert.equal(out.find((w) => w.id === "w4").end, 2, "palavra na borda é recortada ao segmento");
    const refined = R.refineWordTiming([{ id: "x", start: 1, end: 2 }], [{ start: 1.1, end: 1.5 }]);
    assert.deepEqual([refined[0].start, refined[0].end], [1.1, 1.5]);
  });
  test("plano: remove pausa longa, mantém fala com folga, nunca corta dentro de palavra", { skip: !haveFfmpeg }, async () => {
    const sha = await R.sha256File(FIX);
    const words = [["olá", 0.55, 1.0], ["pessoal", 1.05, 1.65], ["hoje", 2.65, 3.0], ["vamos", 3.05, 3.55], ["falar", 3.85, 4.4], ["disso", 4.5, 5.15]].map(([text, start, end], i) => ({ id: `w${i + 1}`, text, start, end, confidence: 0.95, timing: "word" }));
    const transcript = { schema: "motion.transcript", schemaVersion: 1, source: { path: FIX, sha256: sha }, scope: "full-media", provider: { id: "fixture" }, language: "pt", words, segments: [{ start: 0.55, end: 5.15, text: "", wordIds: words.map((w) => w.id) }] };
    const t = await R.planEdit(FIX, { transcript, preset: "talking-head", faceBox: { x: 0.25, y: 0.25, w: 0.5, h: 0.4 } });
    assert.deepEqual(R.validateTimeline(t), []);
    assert.ok(t.removed.some((r) => r.reason === "pause" && r.src[0] >= 1.7 && r.src[1] <= 2.6), JSON.stringify(t.removed));
    assert.ok(!t.removed.some((r) => r.reason === "pause" && r.src[0] > 3.5 && r.src[1] < 3.85), "pausa curta (0,2 s) preservada");
    for (const w of words) assert.ok(t.segments.some((s) => s.src[0] <= w.start - 0.05 && s.src[1] >= w.end + 0.05), `folga em ${w.text}`);
    assert.equal(t.stats.wordsLostUnexpected, 0);
    assert.ok(t.output.durationSec < 5.5 && Math.abs(t.output.durationSec * 30 - t.output.frames) < 1e-6);
    assert.ok(t.captions.pages.length >= 2, `${t.captions.pages.length} páginas`);
    assert.ok(t.captions.placement.y - t.captions.placement.blockH / 2 > 0.25 + 0.7 * 0.4, "legenda abaixo da boca do rosto declarado");
    await R.saveTimeline(t, path.join(tmp, "edit.json"));
  });
  test("repetições: falso começo × gagueira × ênfase", () => {
    const w = (s) => s.split(" ").map((text, i) => ({ id: `w${i}`, text, start: i, end: i + 0.4 }));
    assert.deepEqual(R.findRepetitions(w("Já é uma realidade, já é uma realidade, não")).map((r) => r.kind), ["phrase"]);
    assert.deepEqual(R.findRepetitions(w("eu eu vou")).map((r) => r.kind), ["stutter"]);
    assert.deepEqual(R.findRepetitions(w("refinar, refinar, refinar, refinar, mas")).map((r) => r.kind), ["emphasis"]);
  });
  test("legendas: paginação, linhas equilibradas, posição fora de olhos/boca e da UI do app", () => {
    const words = "você passa a focar não somente em código".split(" ").map((text, i) => ({ id: `w${i}`, text, start: i * 0.3, end: i * 0.3 + 0.25 }));
    const pages = R.buildPages(words, { maxWordsPerPage: 3 });
    assert.ok(pages.every((p) => p.words.length <= 5), "até 3 palavras; até 5 só para fundir páginas-relâmpago");
    assert.ok(pages.slice(0, -1).every((p) => !["a", "em", "de", "e", "o"].includes(p.words.at(-1).text)), pages.map((p) => p.words.map((w) => w.text).join(" ")).join(" / "));
    assert.ok(pages.every((p) => p.end - p.start >= 0.6), "sem páginas-relâmpago");
    const slow = "uma frase falada devagar com pausas".split(" ").map((text, i) => ({ id: `s${i}`, text, start: i * 0.9, end: i * 0.9 + 0.7 }));
    assert.ok(R.buildPages(slow, { maxWordsPerPage: 3 }).every((p) => p.words.length <= 3), "fala lenta não é fundida");
    assert.ok(pages.every((p, i) => !i || p.start >= pages[i - 1].end));
    assert.deepEqual(R.balanceLines(["NÃO", "SOMENTE", "EM"], 10, 2), [1, 2]);
    const pl = R.placeCaptions({ width: 1080, height: 1920, faceBox: { x: 0.18, y: 0.31, w: 0.62, h: 0.5 } });
    assert.ok(pl.y - pl.blockH / 2 > 0.31 + 0.7 * 0.5, "abaixo da boca");
    assert.ok(pl.y + pl.blockH / 2 < 0.81, "acima da UI inferior do Reels");
    assert.ok(pl.maxWidthPx <= 2 * (0.84 - 0.5) * 1080);
    const ass = R.buildAss(pages, { width: 1080, height: 1920, styleIn: {}, placement: pl });
    assert.match(ass, /PlayResY: 1920/); assert.match(ass, /Dialogue: 0,/);
    assert.equal(R.displayWord("código,", { uppercase: true, punctuation: "minimal" }), "CÓDIGO");
    assert.equal(R.displayWord("você?", { uppercase: false, punctuation: "minimal" }), "você?", "? e ! preservados");
  });
});

describe("Cards, render determinístico e QA do reel", () => {
  test("cards progressivos: estado vazio, passos e HTML escapado", () => {
    const layers = R.overlayLayers([{ id: "c", kind: "label", dst: [1, 6], chips: ["a", "b"], steps: [{ dst: 2 }, { dst: 3 }] }]);
    assert.deepEqual(layers.map((l) => l.step), [-1, 0, 1]);
    assert.equal(layers[0].enter, true); assert.equal(layers.at(-1).exit, true);
    const html = R.overlayHtml({ kind: "title", lines: [{ text: "<script>x</script>" }] }, { width: 1080, height: 1920 });
    assert.ok(!html.includes("<script>x"));
    assert.throws(() => R.overlayHtml({ kind: "dashboard" }, { width: 1080, height: 1920 }), /desconhecido/);
  });
  test("render final vertical H.264/AAC, quadros exatos, legendas + card, QA sem FAIL e render reprodutível", { skip: !haveFfmpeg, timeout: 300000 }, async () => {
    const t = await R.loadTimeline(path.join(tmp, "edit.json"));
    t.overlays = [{ id: "c1", kind: "label", eyebrow: "// teste", title: "Card", dst: [0, 1.5] }];
    await R.saveTimeline(t, path.join(tmp, "edit-card.json"));
    const tl = await R.loadTimeline(path.join(tmp, "edit-card.json"));
    const a = await R.renderTimeline(tl, { output: path.join(tmp, "out", "reel.mp4") });
    const b = await R.renderTimeline(tl, { output: path.join(tmp, "out2", "reel.mp4") });
    const probe = await R.probeMedia(a.output);
    assert.equal(probe.video.codec, "h264"); assert.equal(probe.audio.codec, "aac");
    assert.equal(probe.video.width, 1080); assert.equal(probe.video.height, 1920); assert.equal(probe.video.fps, 30);
    assert.equal(probe.video.frames, tl.output.frames);
    for (const k of ["voice", "captionsSrt", "captionsAss", "captionsJson", "timeline", "report"]) assert.ok(existsSync(a.files[k]), k);
    const qa = await R.qaReel(a.output, { timeline: tl, renderReport: a, compareWith: b.output });
    const json = qa.toJSON();
    assert.notEqual(json.status, "FAIL", JSON.stringify(json.checks.filter((c) => c.status === "FAIL")));
    for (const id of ["source.preserved", "cuts.speech", "captions.sync", "captions.safe-zone", "av.sync", "determinism", "audio.true-peak"]) assert.equal(byId(qa, id).status, "PASS", `${id}: ${byId(qa, id).details}`);
    assert.equal(byId(qa, "human.listening").status, "NOT_TESTED");
    const p = await R.readProgress(a.output);
    assert.equal(p.status, "done");
  });
  test("fonte alterada depois do plano → render recusado (SOURCE_CHANGED)", { skip: !haveFfmpeg }, async () => {
    const copy = path.join(tmp, "copy.mp4");
    await copyFile(FIX, copy);
    const t = await R.loadTimeline(path.join(tmp, "edit.json"));
    t.source.path = copy;
    await writeFile(copy, Buffer.concat([await readFile(copy), Buffer.from("x")]));
    await assert.rejects(R.renderTimeline(t, { output: path.join(tmp, "bad", "x.mp4") }), (e) => e.code === "MOTION_SOURCE_CHANGED");
  });
  test("entrada inválida → erro estruturado", { skip: !haveFfmpeg }, async () => {
    const bad = path.join(tmp, "bad.mp4");
    await writeFile(bad, "não é vídeo");
    await assert.rejects(R.analyzeMedia(bad), (e) => e.code === "MOTION_REEL_INPUT_INVALID");
  });
  test("transcrição real → plano com corte do silêncio inicial → legendas sincronizadas no vídeo final", { skip: !haveFlite || !sttReady ? "faster-whisper/flite indisponível" : false, timeout: 300000 }, async () => {
    const tr = JSON.parse(await readFile(path.join(tmp, "speech.transcript.json"), "utf8"));
    const t = await R.planEdit(SPEECH, { transcript: tr, preset: "talking-head", captions: { uppercase: false } });
    assert.ok(t.removed.some((r) => r.reason === "leading-silence" && r.src[1] > 1.2));
    assert.ok(t.captions.words[0].start < 0.3, `primeira palavra em ${t.captions.words[0].start}s após o corte`);
    await R.saveTimeline(t, path.join(tmp, "speech-edit.json"));
    const tl = await R.loadTimeline(path.join(tmp, "speech-edit.json"));
    const r = await R.renderTimeline(tl, { output: path.join(tmp, "speech-out", "reel.mp4"), mode: "preview" });
    tl.output = { ...tl.output, width: r.width, height: r.height };
    const qa = await R.qaReel(r.output, { timeline: tl, renderReport: r, preview: true });
    assert.equal(byId(qa, "captions.sync").status, "PASS", byId(qa, "captions.sync").details);
    assert.equal(byId(qa, "cuts.speech").status, "PASS", byId(qa, "cuts.speech").details);
  });
});

describe("CLI e MCP (agnósticos de agente)", () => {
  const cli = (args) => spawnSync("node", [CLI, ...args], { encoding: "utf8", cwd: root, timeout: 120000 });
  test("motion edit presets --json e motion stt providers --json", () => {
    const r = cli(["edit", "presets", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const j = JSON.parse(r.stdout);
    assert.equal(j.ok, true); assert.ok(j.edit.find((p) => p.id === "talking-head"));
    const s = JSON.parse(cli(["stt", "providers", "--json"]).stdout);
    assert.ok(s.providers.find((p) => p.id === "faster-whisper"));
  });
  test("erro em JSON com código estável quando a entrada não existe", () => {
    const r = cli(["edit", "analyze", path.join(tmp, "nao-existe.mp4"), "--json"]);
    assert.notEqual(r.status, 0);
    const j = JSON.parse(r.stdout);
    assert.equal(j.ok, false); assert.equal(j.error.code, "MOTION_REEL_INPUT_INVALID");
  });
  test("motion edit validate detecta timeline inválida", { skip: !haveFfmpeg }, async () => {
    const t = JSON.parse(await readFile(path.join(tmp, "edit.json"), "utf8"));
    t.output.width = 1081;
    await writeFile(path.join(tmp, "edit-bad.json"), JSON.stringify(t));
    const r = cli(["edit", "validate", path.join(tmp, "edit-bad.json"), "--json"]);
    assert.equal(r.status, 2);
    assert.equal(JSON.parse(r.stdout).valid, false);
  });
  test("MCP: initialize, tools/list, tools/call e erros de protocolo", async () => {
    const init = await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
    assert.equal(init.result.serverInfo.name, "motion-studio");
    assert.ok(init.result.capabilities.tools);
    const list = await handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    assert.equal(list.result.tools.length, TOOLS.length);
    for (const name of ["motion_edit_analyze", "motion_edit_transcribe", "motion_edit_plan", "motion_edit_audio", "motion_edit_render", "motion_job_status", "motion_qa_reel", "motion_edit_export"]) assert.ok(list.result.tools.find((t) => t.name === name), name);
    const call = await handleMessage({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "motion_edit_presets", arguments: {} } });
    assert.equal(call.result.isError, false);
    assert.ok(JSON.parse(call.result.content[0].text).voice.length === 4);
    const unknown = await handleMessage({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "rm_rf", arguments: {} } });
    assert.equal(unknown.error.code, -32602);
    assert.equal((await handleMessage({ jsonrpc: "2.0", id: 5, method: "nope" })).error.code, -32601);
    assert.equal(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
    const bad = await handleMessage({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "motion_job_status", arguments: { jobId: "x" } } });
    assert.equal(bad.result.isError, true);
  });
  test("MCP via stdio: processo `motion mcp` responde ao handshake", async () => {
    const child = spawn("node", [CLI, "mcp"], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
    const lines = [];
    child.stdout.on("data", (d) => lines.push(...d.toString().split("\n").filter(Boolean)));
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }) + "\n");
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n");
    child.stdin.end();
    await new Promise((res) => child.on("close", res));
    const msgs = lines.map((l) => JSON.parse(l));
    assert.equal(msgs.find((m) => m.id === 1).result.protocolVersion, "2025-06-18");
    assert.ok(msgs.find((m) => m.id === 2).result.tools.length >= 10);
  });
});
