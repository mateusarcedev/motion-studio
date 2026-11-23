/**
 * MOTION Core — reel/voice.mjs
 * Voice Studio: non-destructive speech treatment with FFmpeg (DeepFilterNet optional).
 *
 * Chain (in order): high-pass → denoise (afftdn with measured noise floor + adaptive
 * tracking, or DeepFilterNet when installed) → gentle EQ (mud cut, presence, air) →
 * moderate compression → optional de-esser → [cut/concat] → [music + ducking] →
 * two-pass EBU R128 loudnorm (linear when possible) → peak limiter.
 *
 * The original file is only read. Original and treated audio are exported for A/B, with a
 * loudness-matched original so the comparison is not biased by level.
 */
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { createQaReport } from "../quality/qa-status.mjs";
import { derivePauses, detectHum, detectSpeech, energyEnvelope, measureLoudness, measureStats } from "./analyze.mjs";
import { clamp, monoDownmix, probeMedia, reelError, REEL_ERRORS, requireFfmpeg, round, run, sha256File } from "./util.mjs";

/** Presets are data: every value can be overridden per project (timeline.audio.params). */
export const VOICE_PRESETS = Object.freeze({
  natural: {
    description: "Toque mínimo: corta grave inútil, ruído leve, compressão suave. Preserva o máximo de timbre.",
    highpassHz: 70, denoise: { strengthDb: 6, adaptive: true }, expander: null, eq: [{ f: 3000, g: 1.5, q: 0.9 }], highShelf: null,
    compressor: { thresholdDb: "auto", thresholdBelowSpeechDb: 6, ratio: 2, attackMs: 20, releaseMs: 200, makeupDb: 1 }, deesser: null,
    loudness: { targetLufs: -14, truePeakDb: -1.5, lra: 11 },
  },
  clean: {
    description: "Uso geral para Reels: limpa ruído moderado, tira embolado em 250 Hz, dá presença.",
    highpassHz: 80, denoise: { strengthDb: 10, adaptive: true }, expander: { rangeDb: 6, position: 0.35 }, eq: [{ f: 250, g: -2, q: 1 }, { f: 3200, g: 2, q: 1 }], highShelf: { f: 10000, g: 1 },
    compressor: { thresholdDb: "auto", thresholdBelowSpeechDb: 8, ratio: 2.5, attackMs: 15, releaseMs: 180, makeupDb: 2 }, deesser: null,
    loudness: { targetLufs: -14, truePeakDb: -1.5, lra: 9 },
  },
  studio: {
    description: "Voz mais encorpada e próxima: EQ e compressão um pouco mais firmes, de-esser ligado. Não promete 'qualidade de estúdio' sem revisão auditiva.",
    highpassHz: 90, denoise: { strengthDb: 12, adaptive: true }, expander: { rangeDb: 8, position: 0.35 }, eq: [{ f: 300, g: -3, q: 1 }, { f: 3000, g: 2.5, q: 1 }], highShelf: { f: 10000, g: 2 },
    compressor: { thresholdDb: "auto", thresholdBelowSpeechDb: 10, ratio: 3, attackMs: 10, releaseMs: 150, makeupDb: 3 }, deesser: { intensity: 0.4, maxReduction: 0.5, frequency: 0.5 },
    loudness: { targetLufs: -14, truePeakDb: -1.5, lra: 7 },
  },
  "noisy-room": {
    description: "Sala com ruído/ventilador: passa-altas mais alto e redução de ruído mais forte, ainda limitada para não comer fonemas.",
    highpassHz: 100, denoise: { strengthDb: 18, adaptive: true }, expander: { rangeDb: 10, position: 0.35 }, eq: [{ f: 250, g: -2.5, q: 1 }, { f: 3200, g: 2, q: 1 }], highShelf: { f: 9000, g: 1 },
    compressor: { thresholdDb: "auto", thresholdBelowSpeechDb: 8, ratio: 2.5, attackMs: 15, releaseMs: 180, makeupDb: 2 }, deesser: { intensity: 0.3, maxReduction: 0.5, frequency: 0.5 },
    loudness: { targetLufs: -14, truePeakDb: -1.5, lra: 9 },
  },
});

export function listVoicePresets() {
  return Object.entries(VOICE_PRESETS).map(([id, p]) => ({ id, description: p.description, loudness: p.loudness, highpassHz: p.highpassHz, denoiseDb: p.denoise?.strengthDb ?? 0, deesser: Boolean(p.deesser) }));
}

function merge(base, over) {
  if (over === undefined) return structuredClone(base);
  if (over === null || typeof over !== "object" || Array.isArray(over) || typeof base !== "object" || base === null || Array.isArray(base)) return structuredClone(over);
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(over)) out[k] = merge(base[k], v);
  return out;
}

/** Resolves preset + overrides + measured noise into concrete, recorded parameters. */
export function resolveVoiceParams(preset = "clean", overrides = {}, analysis = null) {
  if (!VOICE_PRESETS[preset]) throw reelError(REEL_ERRORS.INPUT_INVALID, `Preset de voz desconhecido: ${preset}`, { hint: `Use: ${Object.keys(VOICE_PRESETS).join(", ")}` });
  const p = merge(VOICE_PRESETS[preset], overrides);
  delete p.description;
  p.preset = preset;
  if (p.denoise) {
    const floor = analysis?.noiseFloorDb ?? -50;
    p.denoise.noiseFloorDb = round(clamp(floor, -80, -20), 1);
    const snr = analysis?.snrDb ?? 30;
    // A clean recording gets less reduction: denoising what is not there only adds artifacts.
    p.denoise.appliedDb = round(clamp(snr > 40 ? p.denoise.strengthDb * 0.5 : p.denoise.strengthDb, 0, 24), 1);
    p.denoise.measuredSnrDb = snr;
  }
  if (p.compressor) {
    const c = p.compressor;
    if (c.thresholdDb === "auto") {
      // Relative to the measured speech level (P95 of 10 ms RMS), so a quiet phone recording
      // is not over-compressed just because its absolute level is low.
      const speech = analysis?.speechLevelDb ?? -18;
      c.thresholdDb = round(clamp(speech - (c.thresholdBelowSpeechDb ?? 8), -45, -8), 1);
      c.thresholdSource = `fala medida ${speech} dBFS − ${c.thresholdBelowSpeechDb ?? 8} dB`;
    }
    const lra = analysis?.lraLu;
    if (lra !== undefined && lra !== null && lra < 4 && c.ratio > 1.6) {
      c.requestedRatio = c.ratio;
      c.ratio = 1.6;
      c.note = `fonte já comprimida (LRA ${lra} LU): ratio reduzido para 1.6 para não achatar a voz nem subir o ruído`;
    }
  }
  if (p.expander) {
    // Downward expander: attenuates pauses by at most rangeDb (never mutes). Threshold sits
    // between the measured floor and speech level; the suppression QA guards speech tails.
    const floor = analysis?.noiseFloorDb ?? -50, speech = analysis?.speechLevelDb ?? -18;
    p.expander.thresholdDb = round(floor + (p.expander.position ?? 0.35) * Math.max(6, speech - floor), 1);
  }
  if (p.dehum === undefined) p.dehum = "auto";
  if (p.dehum === "auto") p.dehum = analysis?.hum?.detected ? { baseHz: analysis.hum.baseHz, harmonics: analysis.hum.harmonics, source: "measured" } : null;
  return p;
}

/** FFmpeg filter chain for the per-sample treatment (everything before cuts and loudness). */
export function buildVoiceChain(p, { denoiser = "ffmpeg" } = {}) {
  const f = [];
  if (p.highpassHz) f.push(`highpass=f=${p.highpassHz}:poles=2`);
  // Tonal mains hum: narrow notches (≈4 Hz wide) at the measured fundamental and harmonics.
  for (const h of p.dehum?.harmonics ?? []) f.push(`equalizer=f=${h}:t=h:w=4:g=${h === p.dehum.baseHz ? -30 : -20}`);
  if (p.denoise && p.denoise.appliedDb > 0 && denoiser === "ffmpeg") f.push(`afftdn=nr=${p.denoise.appliedDb}:nf=${p.denoise.noiseFloorDb}:tn=${p.denoise.adaptive ? 1 : 0}`);
  if (p.expander) f.push(`agate=threshold=${Math.pow(10, p.expander.thresholdDb / 20).toFixed(5)}:range=${Math.pow(10, -p.expander.rangeDb / 20).toFixed(4)}:ratio=2:attack=8:release=220:knee=4:detection=rms`);
  for (const b of p.eq ?? []) f.push(`equalizer=f=${b.f}:t=q:w=${b.q}:g=${b.g}`);
  if (p.highShelf) f.push(`highshelf=f=${p.highShelf.f}:g=${p.highShelf.g}`);
  if (p.compressor) {
    const c = p.compressor;
    f.push(`acompressor=threshold=${c.thresholdDb}dB:ratio=${c.ratio}:attack=${c.attackMs}:release=${c.releaseMs}:makeup=${Math.pow(10, (c.makeupDb ?? 0) / 20).toFixed(4)}`);
  }
  if (p.deesser) f.push(`deesser=i=${p.deesser.intensity}:m=${p.deesser.maxReduction}:f=${p.deesser.frequency}:s=o`);
  return f.join(",") || "anull";
}

export function deepFilterBinary() {
  const env = process.env.MOTION_DEEPFILTER;
  if (env && existsSync(env)) return env;
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    for (const name of ["deep-filter", "deepFilter"]) {
      const c = path.join(dir, name);
      if (existsSync(c)) return c;
    }
  }
  return null;
}

async function decodeMono(file, sr, start = 0, duration = 20) {
  const r = await run("ffmpeg", ["-v", "error", "-ss", String(start), "-t", String(duration), "-i", file, "-ac", "1", "-ar", String(sr), "-f", "f32le", "-"], { binary: true });
  const b = r.stdout;
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length - (b.length % 4)));
}

/**
 * Latency (samples at `sr`) of `processed` relative to `reference`, by cross-correlation:
 * coarse on 1 ms energy envelopes (±maxMs), then refined on raw samples. Positive = processed
 * is late. Works for any chain (FFT denoisers, DeepFilterNet...), so A/V sync is measured,
 * never assumed.
 */
export async function measureLatency(reference, processed, { sr = 48000, maxMs = 150, start = 0, duration = 20 } = {}) {
  const a = await decodeMono(reference, sr, start, duration), b = await decodeMono(processed, sr, start, duration);
  const n = Math.min(a.length, b.length);
  const hop = Math.round(sr / 1000);
  const env = (x) => { const o = new Float64Array(Math.floor(n / hop)); for (let i = 0; i < o.length; i++) { let e = 0; for (let j = 0; j < hop; j++) e += x[i * hop + j] ** 2; o[i] = Math.log10(e + 1e-10); } return o; };
  const ea = env(a), eb = env(b);
  const corr = (x, y, lag) => { let s = 0, sx = 0, sy = 0, sxx = 0, syy = 0, k = 0; for (let i = Math.max(0, -lag); i < x.length && i + lag < y.length; i++) { const u = x[i], v = y[i + lag]; s += u * v; sx += u; sy += v; sxx += u * u; syy += v * v; k++; } const cov = s / k - (sx / k) * (sy / k); return cov / Math.sqrt((sxx / k - (sx / k) ** 2) * (syy / k - (sy / k) ** 2) + 1e-12); };
  let bestLag = 0, best = -2;
  for (let lag = -maxMs; lag <= maxMs; lag++) { const c = corr(ea, eb, lag); if (c > best) { best = c; bestLag = lag; } }
  let fine = bestLag * hop, fineBest = -Infinity;
  for (let lag = bestLag * hop - hop; lag <= bestLag * hop + hop; lag++) {
    let s = 0; for (let i = Math.max(0, -lag); i < n && i + lag < n; i += 2) s += a[i] * b[i + lag];
    if (s > fineBest) { fineBest = s; fine = lag; }
  }
  return { samples: fine, seconds: fine / sr, envelopeCorrelation: round(best, 4) };
}

async function ff(args, what) {
  const r = await run("ffmpeg", ["-hide_banner", "-nostats", "-y", ...args]);
  if (r.code !== 0) throw reelError(REEL_ERRORS.RENDER_FAILED, `FFmpeg falhou: ${what}`, { details: r.stderr.trim().split("\n").slice(-4).join(" | ") });
  return r;
}

/**
 * Cuts a mono WAV into concatenated segments (src ranges in destination order) with 5 ms
 * fades at every boundary to avoid clicks. Uses one input per segment (bounded memory).
 */
async function cutWav(input, segments, output, { fadeMs = 5 } = {}) {
  if (!segments?.length) return ff(["-i", input, "-c:a", "pcm_f32le", output], "cópia do áudio");
  const args = [];
  const parts = [];
  segments.forEach(([s, e], i) => {
    args.push("-ss", s.toFixed(6), "-t", (e - s).toFixed(6), "-i", input);
    const d = e - s, fd = Math.min(fadeMs / 1000, d / 4);
    parts.push(`[${i}:a]asetpts=PTS-STARTPTS,afade=t=in:d=${fd.toFixed(4)},afade=t=out:st=${(d - fd).toFixed(6)}:d=${fd.toFixed(4)}[a${i}]`);
  });
  const graph = `${parts.join(";")};${segments.map((_, i) => `[a${i}]`).join("")}concat=n=${segments.length}:v=0:a=1[out]`;
  return ff([...args, "-filter_complex", graph, "-map", "[out]", "-ar", "48000", "-ac", "1", "-c:a", "pcm_f32le", output], "corte/concatenação do áudio");
}

/**
 * Linear EBU R128 normalization: measure, apply one static gain, catch inter-sample peaks
 * with a limiter running at 4× oversampling, re-measure and refine (≤ 4 passes).
 * loudnorm's single-pass/"dynamic" mode is avoided on purpose: it behaves like an AGC and
 * raises the noise floor in pauses.
 */
async function normalize(input, output, { targetLufs, truePeakDb, lra }, { codec = "pcm_s24le" } = {}) {
  const first = await measureLoudness(input, { targetLufs, truePeakDb, lra });
  if (first.integratedLufs === null) throw reelError(REEL_ERRORS.RENDER_FAILED, "Áudio sem sinal mensurável: não é possível normalizar.");
  let gain = targetLufs - first.integratedLufs;
  let limit = truePeakDb - 0.3;
  const passes = [];
  let m = null;
  for (let i = 0; i < 4; i++) {
    const chain = `volume=${gain.toFixed(3)}dB,aresample=192000,alimiter=limit=${Math.pow(10, limit / 20).toFixed(5)}:attack=1:release=60:level=false:asc=1,aresample=48000`;
    await ff(["-i", input, "-af", chain, "-ar", "48000", "-c:a", codec, output], "normalização EBU R128 (linear)");
    m = await measureLoudness(output, { targetLufs, truePeakDb, lra });
    passes.push({ gainDb: round(gain, 3), limiterDb: round(limit, 2), integratedLufs: m.integratedLufs, truePeakDbtp: m.truePeakDbtp });
    const dI = targetLufs - m.integratedLufs;
    const overTp = (m.truePeakDbtp ?? -99) - truePeakDb;
    if (Math.abs(dI) <= 0.2 && overTp <= 0) break;
    if (overTp > 0) limit -= overTp + 0.1;
    gain += dI;
  }
  return { measured: first, normalizationType: "linear-gain+oversampled-limiter", passes, result: { integratedLufs: m.integratedLufs, truePeakDbtp: m.truePeakDbtp, lraLu: m.lraLu } };
}

/**
 * Per-frame speech suppression: inside the speech intervals of the reference (before), how
 * many 10 ms frames lost > `dropDb` relative to the median gain? A denoiser that eats
 * consonants shows up here even when overall loudness looks fine.
 */
export function speechSuppression(envBefore, envAfter, speech, { hop = 0.01, dropDb = 10, minLevelDb = -70 } = {}) {
  const diffs = [];
  for (const s of speech) {
    for (let i = Math.floor(s.start / hop); i < Math.min(envBefore.length, envAfter.length, Math.ceil(s.end / hop)); i++) {
      // only frames that carry speech energy (above the VAD threshold) can be "eaten"
      if (envBefore[i] > minLevelDb) diffs.push(envAfter[i] - envBefore[i]);
    }
  }
  if (!diffs.length) return { frames: 0, suppressedRatio: 0, medianGainDb: 0 };
  const sorted = [...diffs].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const suppressed = diffs.filter((d) => d < med - dropDb).length;
  return { frames: diffs.length, suppressedRatio: round(suppressed / diffs.length, 4), medianGainDb: round(med, 2) };
}

async function speechMetrics(file) {
  const env = await energyEnvelope(file);
  const vad = detectSpeech(env);
  const speechSec = vad.segments.reduce((n, s) => n + (s.end - s.start), 0);
  return { ...vad, speechSec: round(speechSec, 2), env };
}

/** Speech seconds measured with a FIXED threshold (so before/after are comparable). */
/**
 * Speech-to-pause ratio on fixed regions: energy-averaged level of speech intervals versus
 * the core of pauses (≥ 0.25 s, 60 ms trimmed each side). Same regions before and after,
 * so it measures what the treatment did to noise between phrases.
 */
export function pauseNoiseRatio(env, speech, pauses, { hop = 0.01 } = {}) {
  const avg = (ranges) => {
    let acc = 0, n = 0;
    for (const [a, b] of ranges) for (let i = Math.floor(a / hop); i < Math.min(env.length, Math.ceil(b / hop)); i++) { acc += Math.pow(10, env[i] / 10); n++; }
    return n ? 10 * Math.log10(acc / n) : null;
  };
  const core = pauses.filter((p) => p.duration >= 0.25).map((p) => [p.start + 0.06, p.end - 0.06]);
  const speechDb = avg(speech.map((s) => [s.start, s.end]));
  const pauseDb = avg(core);
  return { speechDb: round(speechDb, 1), pauseDb: round(pauseDb, 1), ratioDb: speechDb !== null && pauseDb !== null ? round(speechDb - pauseDb, 1) : null, pauses: core.length };
}

export function speechAbove(env, thresholdDb, hop = 0.01) {
  let n = 0;
  for (const v of env) if (v > thresholdDb) n++;
  return round(n * hop, 2);
}

function bestSpeechWindow(speech, durationSec, windowSec) {
  if (durationSec <= windowSec) return [0, durationSec];
  let best = [0, windowSec], bestScore = -1;
  for (let s = 0; s + windowSec <= durationSec; s += 0.5) {
    const score = speech.reduce((n, x) => n + Math.max(0, Math.min(x.end, s + windowSec) - Math.max(x.start, s)), 0);
    if (score > bestScore) { bestScore = score; best = [s, s + windowSec]; }
  }
  return best.map((v) => round(v, 2));
}

/**
 * Treats speech audio of a media file.
 * @param {string} input  video or audio file (never modified)
 * @param {object} o
 *   output: treated WAV path (required) · preset · overrides · segments: [[srcStart,srcEnd],...] in output order
 *   denoiser: "auto"|"ffmpeg"|"deepfilternet"|"none" · music: {path, gainDb=-18, duck:{thresholdDb,ratio,attackMs,releaseMs}}
 *   abDir: folder for A/B files · workDir · abWindowSec
 */
export async function processVoice(input, o = {}) {
  await requireFfmpeg(["afftdn", "loudnorm", "acompressor", "alimiter", "highpass", "equalizer"]);
  if (!o.output) throw reelError(REEL_ERRORS.INPUT_INVALID, "Informe o arquivo de saída do áudio tratado (output).");
  const probe = await probeMedia(input);
  if (!probe.audio) throw reelError(REEL_ERRORS.INPUT_INVALID, "A mídia não tem faixa de áudio.");
  const sha256 = await sha256File(input);
  const output = path.resolve(o.output);
  const work = path.resolve(o.workDir ?? path.join(path.dirname(output), ".voice-work"));
  await mkdir(work, { recursive: true });
  await mkdir(path.dirname(output), { recursive: true });

  // 1) analysis of the source (measured, not assumed)
  const channels = probe.audio.channels;
  const srcEnv = await energyEnvelope(input, { channels });
  const srcVad = detectSpeech(srcEnv);
  const hum = o.overrides?.dehum === false || o.overrides?.dehum === null ? null : await detectHum(input, derivePauses(srcVad.segments, probe.durationSec), { channels });
  const srcLoud = await measureLoudness(input, { filter: monoDownmix(channels) });
  const params = resolveVoiceParams(o.preset ?? "clean", o.overrides ?? {}, { ...srcVad, hum, lraLu: srcLoud.lraLu });
  if (o.denoiser === "none") params.denoise = null;

  // 2) denoiser selection (DeepFilterNet optional, FFmpeg fallback)
  const dfBin = deepFilterBinary();
  let denoiser = "ffmpeg";
  if (o.denoiser === "deepfilternet" && !dfBin) throw reelError(REEL_ERRORS.INPUT_INVALID, "DeepFilterNet pedido, mas o binário deep-filter não foi encontrado.", { hint: "Instale deep-filter (DeepFilterNet) ou use --denoiser=ffmpeg.", exitCode: 3 });
  if ((o.denoiser === "auto" || o.denoiser === "deepfilternet") && dfBin && params.denoise) denoiser = "deepfilternet";

  const extracted = path.join(work, "source-48k.wav");
  await ff(["-i", input, "-vn", ...(monoDownmix(channels) ? ["-af", monoDownmix(channels)] : []), "-ac", "1", "-ar", "48000", "-c:a", "pcm_f32le", extracted], "extração do áudio");
  let chainInput = extracted;
  if (denoiser === "deepfilternet") {
    const dfOut = path.join(work, "df");
    await mkdir(dfOut, { recursive: true });
    const atten = Math.round(params.denoise.appliedDb + 6);
    const r = await run(dfBin, ["--atten-lim", String(atten), "-o", dfOut, extracted]);
    const produced = path.join(dfOut, path.basename(extracted));
    if (r.code !== 0 || !existsSync(produced)) throw reelError(REEL_ERRORS.RENDER_FAILED, "DeepFilterNet falhou.", { details: r.stderr.trim().split("\n").slice(-3).join(" | ") });
    chainInput = produced;
    params.denoise.engine = "deepfilternet"; params.denoise.attenuationLimitDb = atten;
  } else if (params.denoise) params.denoise.engine = "ffmpeg-afftdn";

  // 3) per-sample treatment on the full source (denoise needs context), then cut
  const chain = buildVoiceChain(params, { denoiser });
  const treatedFull = path.join(work, "treated-full.wav");
  const treatedRaw = path.join(work, "treated-uncompensated.wav");
  await ff(["-i", chainInput, "-af", chain, "-ar", "48000", "-ac", "1", "-c:a", "pcm_f32le", treatedRaw], "cadeia de voz");
  // Latency compensation: FFT denoisers delay the signal; re-align to the source sample grid.
  const latStart = Math.max(0, Math.min(probe.durationSec - 20, (srcVad.segments[0]?.start ?? 0)));
  const latency = await measureLatency(extracted, treatedRaw, { start: latStart, duration: Math.min(20, probe.durationSec) });
  if (latency.samples > 0) {
    await ff(["-i", treatedRaw, "-af", `atrim=start_sample=${latency.samples},asetpts=PTS-STARTPTS,apad=pad_len=${latency.samples}`, "-c:a", "pcm_f32le", treatedFull], "compensação de latência");
  } else if (latency.samples < 0) {
    await ff(["-i", treatedRaw, "-af", `adelay=delays=${-latency.samples}S:all=1,atrim=end_sample=${Math.round(probe.audio.durationSec * 48000)}`, "-c:a", "pcm_f32le", treatedFull], "compensação de latência");
  } else {
    await ff(["-i", treatedRaw, "-c:a", "pcm_f32le", treatedFull], "cópia");
  }
  const residual = await measureLatency(extracted, treatedFull, { start: latStart, duration: Math.min(20, probe.durationSec) });
  const segments = o.segments?.length ? o.segments : null;
  const treatedCut = path.join(work, "treated-cut.wav");
  const originalCut = path.join(work, "original-cut.wav");
  await cutWav(treatedFull, segments, treatedCut);
  await cutWav(extracted, segments, originalCut);

  // 4) optional music bed with sidechain ducking keyed by the voice
  let toNormalize = treatedCut;
  let music = null;
  if (o.music?.path) {
    const mp = path.resolve(o.music.path);
    const duck = { thresholdDb: -30, ratio: 8, attackMs: 20, releaseMs: 350, ...(o.music.duck ?? {}) };
    const gain = o.music.gainDb ?? -18;
    const mixed = path.join(work, "mixed.wav");
    const dur = (await probeMedia(treatedCut)).durationSec;
    const graph = `[1:a]aresample=48000,aformat=channel_layouts=mono,atrim=0:${dur},asetpts=PTS-STARTPTS,volume=${gain}dB[m];` +
      `[0:a]asplit=2[v][key];[m][key]sidechaincompress=threshold=${Math.pow(10, duck.thresholdDb / 20).toFixed(5)}:ratio=${duck.ratio}:attack=${duck.attackMs}:release=${duck.releaseMs}[md];` +
      `[v][md]amix=inputs=2:duration=first:normalize=0[out]`;
    await ff(["-i", treatedCut, "-stream_loop", "-1", "-i", mp, "-filter_complex", graph, "-map", "[out]", "-ar", "48000", "-c:a", "pcm_f32le", mixed], "mixagem com ducking");
    toNormalize = mixed;
    music = { path: mp, sha256: await sha256File(mp), gainDb: gain, duck };
  }

  // 5) loudness: two-pass EBU R128 + limiter
  const norm = await normalize(toNormalize, output, params.loudness);
  let originalMatched = null;
  const abFiles = {};
  if (o.abDir) {
    const ab = path.resolve(o.abDir);
    await mkdir(ab, { recursive: true });
    originalMatched = path.join(ab, "original-loudness-matched.wav");
    await normalize(originalCut, originalMatched, params.loudness);
    const rawCopy = path.join(ab, "original.wav");
    await ff(["-i", originalCut, "-c:a", "pcm_s24le", rawCopy], "cópia do original (A/B)");
    abFiles.original = rawCopy;
    abFiles.originalLoudnessMatched = originalMatched;
    abFiles.treated = output;
  }

  // 6) after-measurements and QA
  const after = await measureLoudness(output, params.loudness);
  const afterStats = await measureStats(output);
  const beforeLoud = await measureLoudness(originalCut, params.loudness);
  const beforeStats = await measureStats(originalCut);
  const beforeSp = await speechMetrics(originalCut);
  const afterSp = await speechMetrics(output);
  const outDur = (await probeMedia(output)).durationSec;

  if (o.abDir) {
    const [ws, we] = bestSpeechWindow(afterSp.segments, outDur, o.abWindowSec ?? 12);
    abFiles.window = { start: ws, end: we };
    abFiles.beforeSample = path.join(path.resolve(o.abDir), "ab-before.wav");
    abFiles.afterSample = path.join(path.resolve(o.abDir), "ab-after.wav");
    await ff(["-ss", String(ws), "-t", String(we - ws), "-i", originalMatched, "-c:a", "pcm_s24le", abFiles.beforeSample], "amostra A");
    await ff(["-ss", String(ws), "-t", String(we - ws), "-i", output, "-c:a", "pcm_s24le", abFiles.afterSample], "amostra B");
  }

  // SNR comparison on a common footing: floor in pauses vs speech level, both relative.
  const report = createQaReport({ subject: path.basename(output), kind: "voice" });
  const tp = after.truePeakDbtp, lim = params.loudness.truePeakDb;
  report.add({ id: "voice.truepeak", title: `True peak ≤ ${lim} dBTP (sem clipping)`, status: tp !== null && tp <= lim + 0.3 ? "PASS" : "FAIL", details: `${tp} dBTP (antes: ${beforeLoud.truePeakDbtp} dBTP)` });
  report.add({ id: "voice.samplepeak", title: "Pico de amostra < 0 dBFS", status: afterStats.peakDb !== null && afterStats.peakDb < 0 ? "PASS" : "FAIL", details: `${round(afterStats.peakDb, 2)} dBFS` });
  const dL = Math.abs((after.integratedLufs ?? -99) - params.loudness.targetLufs);
  report.add({ id: "voice.loudness", title: `Loudness integrado ${params.loudness.targetLufs} LUFS ±1 LU`, status: dL <= 1 ? "PASS" : dL <= 2 ? "WARN" : "FAIL", details: `${after.integratedLufs} LUFS (antes: ${beforeLoud.integratedLufs} LUFS)` });
  const sup = speechSuppression(beforeSp.env, afterSp.env, beforeSp.segments, { minLevelDb: beforeSp.thresholdDb });
  const cutPauses = derivePauses(beforeSp.segments, outDur);
  const pnBefore = pauseNoiseRatio(beforeSp.env, beforeSp.segments, cutPauses);
  const pnAfter = pauseNoiseRatio(afterSp.env, beforeSp.segments, cutPauses);
  report.add({ id: "voice.speech-preserved", title: "Fala preservada (quadros de fala suprimidos > 10 dB)", heuristic: true, status: sup.suppressedRatio <= 0.02 ? "PASS" : sup.suppressedRatio <= 0.05 ? "WARN" : "FAIL", details: `${round(sup.suppressedRatio * 100, 2)}% de ${sup.frames} quadros de 10 ms (ganho mediano ${sup.medianGainDb} dB)` });
  if (pnBefore.ratioDb === null) report.add({ id: "voice.noise", title: "Relação fala/pausa (ruído entre frases)", status: "NOT_TESTED", required: false, details: "sem pausas ≥ 0,25 s para medir" });
  else {
    const gainDb = round(pnAfter.ratioDb - pnBefore.ratioDb, 1);
    report.add({ id: "voice.noise", title: "Relação fala/pausa não piorou (ruído entre frases)", heuristic: true, status: gainDb < -1 ? "WARN" : gainDb > 25 ? "WARN" : "PASS", details: `${pnBefore.ratioDb} → ${pnAfter.ratioDb} dB (${gainDb >= 0 ? "+" : ""}${gainDb} dB em ${pnBefore.pauses} pausas)${gainDb > 25 ? " — redução agressiva demais pode soar artificial" : ""}` });
  }
  report.add({ id: "voice.latency", title: "Áudio tratado alinhado à fonte (latência compensada)", status: Math.abs(residual.seconds) <= 0.001 ? "PASS" : Math.abs(residual.seconds) <= 0.01 ? "WARN" : "FAIL", details: `cadeia atrasava ${round(latency.seconds * 1000, 2)} ms; residual ${round(residual.seconds * 1000, 2)} ms (correlação ${residual.envelopeCorrelation})` });
  report.add({ id: "voice.duration", title: "Duração preservada pelo tratamento", status: Math.abs(outDur - (await probeMedia(originalCut)).durationSec) <= 0.02 ? "PASS" : "FAIL", details: `${outDur}s` });
  if (params.dehum) report.add({ id: "voice.dehum", title: `Zumbido de rede ${params.dehum.baseHz} Hz tratado (notch)`, status: "PASS", required: false, details: `harmônicos ${params.dehum.harmonics.join(", ")} Hz; excesso medido ${JSON.stringify(hum?.excessDb ?? {})} dB` });
  report.add({ id: "voice.listening", title: "Revisão auditiva humana (timbre, artefatos, fonemas)", status: "NOT_TESTED", required: false, details: "Obrigatória antes de declarar qualidade; use os arquivos A/B com loudness casado." });

  if (!o.keepWork) await rm(work, { recursive: true, force: true });
  const sourceAfter = await sha256File(input);
  return {
    schema: "motion.voice.report", schemaVersion: 1,
    source: { path: path.resolve(input), sha256, unchanged: sourceAfter === sha256 },
    output, durationSec: outDur, denoiser, deepFilterAvailable: Boolean(dfBin),
    params, chain, hum, latency: { measured: latency, residual }, segments: segments ? segments.length : null, music,
    loudnessPass: norm,
    before: { loudness: beforeLoud, stats: beforeStats, noiseFloorDb: beforeSp.noiseFloorDb, speechLevelDb: beforeSp.speechLevelDb, snrDb: beforeSp.snrDb },
    after: { loudness: { integratedLufs: after.integratedLufs, truePeakDbtp: after.truePeakDbtp, lraLu: after.lraLu }, stats: afterStats, noiseFloorDb: afterSp.noiseFloorDb, speechLevelDb: afterSp.speechLevelDb, snrDb: afterSp.snrDb },
    speechToPause: { before: pnBefore, after: pnAfter }, speechSuppression: sup,
    ab: o.abDir ? abFiles : null,
    qa: report.toJSON(),
  };
}

export { derivePauses };
