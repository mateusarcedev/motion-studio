/**
 * MOTION Core — reel/voice.mjs
 * Voice Studio: non-destructive speech treatment with FFmpeg (DeepFilterNet optional).
 *
 * Chain (v2, in order): high-pass → hum notches → denoise (afftdn with measured noise floor, or
 * a verified DeepFilterNet) → EQ → compression → optional de-esser → [cut/concat] → linear gain
 * to the loudness target, in the delivery channel layout → downward expander (last, so pauses
 * do not rise with the gain; keyed with boosted highs to spare sibilants) → [music + ducking] →
 * ONE gain readjustment → limiter only when peaks remain above the ceiling.
 *
 * The original file is only read. Original and treated audio are exported for A/B, with a
 * loudness-matched original so the comparison is not biased by level.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createQaReport } from "../quality/qa-status.mjs";
import { derivePauses, detectHum, detectSpeech, energyEnvelope, measureLoudness, measureStats } from "./analyze.mjs";
import { deepFilterBinary, deepFilterStatus } from "./denoisers.mjs";
import { merge, PRESETS, VOICE_PRESETS } from "./presets.mjs";
import { clamp, monoDownmix, probeMedia, reelError, REEL_ERRORS, requireFfmpeg, round, run, sha256File } from "./util.mjs";

export { VOICE_PRESETS };
/** Bumped whenever the treatment order or semantics change (recorded in timelines and reports). */
export const VOICE_CHAIN_VERSION = 2;

export function listVoicePresets() {
  return Object.entries(VOICE_PRESETS).map(([id, p]) => ({ id, description: p.description, loudness: p.loudness, highpassHz: p.highpassHz, denoiseDb: p.denoise?.strengthDb ?? 0, deesser: Boolean(p.deesser) }));
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
    if (lra !== undefined && lra !== null && lra < c.bypassBelowLraLu) {
      // measured on real footage: even 1.6:1 costs ~2.8 dB of speech-to-pause on such a source
      p.compressor = { ...c, bypassed: true, note: `fonte já comprimida (LRA ${lra} LU < ${c.bypassBelowLraLu}): compressor não aplicado` };
    } else if (lra !== undefined && lra !== null && lra < c.reduceBelowLraLu && c.ratio > c.reducedRatio) {
      c.requestedRatio = c.ratio;
      c.ratio = c.reducedRatio;
      c.note = `fonte já comprimida (LRA ${lra} LU): ratio reduzido para ${c.reducedRatio} para não achatar a voz nem subir o ruído`;
    }
  }
  if (p.dehum === undefined) p.dehum = "auto";
  if (p.dehum === "auto") p.dehum = analysis?.hum?.detected ? { baseHz: analysis.hum.baseHz, harmonics: analysis.hum.harmonics, source: "measured" } : null;
  return p;
}

/** FFmpeg filter chain for the per-sample treatment (everything before cuts, gain and expander). */
export function buildVoiceChain(p, { denoiser = "ffmpeg" } = {}) {
  const f = [];
  if (p.highpassHz) f.push(`highpass=f=${p.highpassHz}:poles=2`);
  // Tonal mains hum: narrow notches (≈4 Hz wide) at the measured fundamental and harmonics.
  for (const h of p.dehum?.harmonics ?? []) f.push(`equalizer=f=${h}:t=h:w=4:g=${h === p.dehum.baseHz ? -30 : -20}`);
  if (p.denoise && p.denoise.appliedDb > 0 && denoiser === "ffmpeg") f.push(`afftdn=nr=${p.denoise.appliedDb}:nf=${p.denoise.noiseFloorDb}:tn=${p.denoise.adaptive ? 1 : 0}`);
  for (const b of p.eq ?? []) f.push(`equalizer=f=${b.f}:t=q:w=${b.q}:g=${b.g}`);
  if (p.highShelf) f.push(`highshelf=f=${p.highShelf.f}:g=${p.highShelf.g}`);
  if (p.compressor && !p.compressor.bypassed) {
    const c = p.compressor;
    f.push(`acompressor=threshold=${c.thresholdDb}dB:ratio=${c.ratio}:attack=${c.attackMs}:release=${c.releaseMs}:makeup=${Math.pow(10, (c.makeupDb ?? 0) / 20).toFixed(4)}`);
  }
  if (p.deesser) f.push(`deesser=i=${p.deesser.intensity}:m=${p.deesser.maxReduction}:f=${p.deesser.frequency}:s=o`);
  return f.join(",") || "anull";
}

export { deepFilterBinary };

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
export async function cutWav(input, segments, output, { fadeMs = 5 } = {}) {
  if (!segments?.length) return ff(["-i", input, "-c:a", "pcm_f32le", output], "cópia do áudio");
  const args = [];
  const parts = [];
  segments.forEach(([s, e], i) => {
    // exact sample count per segment (48 kHz): frame-grid cuts stay sample-aligned over many segments
    const n = Math.round((e - s) * 48000);
    args.push("-ss", s.toFixed(6), "-t", ((n + 64) / 48000).toFixed(6), "-i", input);
    const d = n / 48000, fd = Math.min(fadeMs / 1000, d / 4);
    parts.push(`[${i}:a]aresample=48000,apad=whole_len=${n},atrim=end_sample=${n},asetpts=PTS-STARTPTS,afade=t=in:d=${fd.toFixed(4)},afade=t=out:st=${(d - fd).toFixed(6)}:d=${fd.toFixed(4)}[a${i}]`);
  });
  const graph = `${parts.join(";")};${segments.map((_, i) => `[a${i}]`).join("")}concat=n=${segments.length}:v=0:a=1[out]`;
  return ff([...args, "-filter_complex", graph, "-map", "[out]", "-ar", "48000", "-ac", "1", "-c:a", "pcm_f32le", output], "corte/concatenação do áudio");
}

/** Mono → delivery layout. Dual mono keeps the LUFS and gives each channel 3 dB of headroom. */
const layoutFilter = (channels) => (channels === 2 ? "pan=stereo|c0=0.707107*c0|c1=0.707107*c0" : "anull");

/**
 * Downward expander at the end of the voice chain. The key is the voice itself with boosted
 * highs (an /s/ has little broadband energy) and the signal is delayed against the key
 * (lookahead), so onsets and sibilants open the gate before they arrive.
 */
export function expanderGraph(e, thresholdDb) {
  const amp = (db) => Math.pow(10, db / 20).toFixed(6);
  const n = Math.round((e.lookaheadMs / 1000) * 48000);
  return `[0:a]asplit=2[m][k];[k]highshelf=f=${e.sibilantHz}:g=${e.sibilantBoostDb}[key];[m]adelay=delays=${n}S:all=1[late];` +
    `[late][key]sidechaingate=threshold=${amp(thresholdDb)}:range=${amp(-e.rangeDb)}:ratio=${e.ratio}:attack=${e.attackMs}:release=${e.releaseMs}:knee=4:detection=rms[g];` +
    `[g]atrim=start_sample=${n},asetpts=PTS-STARTPTS[out]`;
}

async function applyExpander(input, output, e) {
  const env = await energyEnvelope(input, { channels: 1 });
  const vad = detectSpeech(env);
  const thresholdDb = round(vad.noiseFloorDb + (e.position ?? 0.35) * Math.max(6, vad.speechLevelDb - vad.noiseFloorDb), 1);
  const samples = (await probeMedia(input)).audio.durationSec * 48000;
  await ff(["-i", input, "-filter_complex", `${expanderGraph(e, thresholdDb)};[out]apad=whole_len=${Math.round(samples)},atrim=end_sample=${Math.round(samples)}[o]`, "-map", "[o]", "-ar", "48000", "-ac", "1", "-c:a", "pcm_f32le", output], "expansor");
  return { ...e, thresholdDb, floorDb: vad.noiseFloorDb, speechDb: vad.speechLevelDb };
}

/**
 * Loudness finish: one linear readjustment, then a 4× oversampled limiter only if the true peak
 * is above the ceiling. Never iterates on LUFS: what remains is reported (WARN).
 */
async function finishLoudness(input, output, L, { channels = 1, codec = "pcm_s24le" } = {}) {
  const measured = await measureLoudness(input, L);
  if (measured.integratedLufs === null) throw reelError(REEL_ERRORS.RENDER_FAILED, "Áudio sem sinal mensurável: não é possível normalizar.");
  const gain = L.targetLufs - measured.integratedLufs;
  const pre = `volume=${gain.toFixed(3)}dB,${layoutFilter(channels)}`;
  const write = (extra) => ff(["-i", input, "-af", [pre, extra].filter(Boolean).join(","), "-ar", "48000", "-ac", String(channels), "-c:a", codec, output], "ajuste final de loudness");
  // float intermediate: a peak above 0 dBFS must be measured, not clipped
  const probeOut = output.replace(/\.wav$/i, "") + ".pre.wav";
  await ff(["-i", input, "-af", pre, "-ar", "48000", "-ac", String(channels), "-c:a", "pcm_f32le", probeOut], "medição do pico restante");
  const beforeLimit = await measureLoudness(probeOut, L);
  await rm(probeOut, { force: true });
  let limiter = null;
  if (beforeLimit.truePeakDbtp !== null && beforeLimit.truePeakDbtp > L.truePeakDb) {
    // alimiter is not a true-peak limiter: the result is measured and its threshold lowered by
    // the measured overshoot (peaks only, bounded; the loudness gain is not touched again)
    let limit = L.truePeakDb - L.limiterMarginDb;
    for (let i = 0; i < 3; i++) {
      await write(`aresample=192000,alimiter=limit=${Math.pow(10, limit / 20).toFixed(5)}:attack=1:release=60:level=false:asc=1,aresample=48000`);
      const tp = (await measureLoudness(output, L)).truePeakDbtp;
      limiter = { limitDb: round(limit, 2), truePeakDbtp: tp, attempts: i + 1 };
      if (tp <= L.truePeakDb) break;
      limit -= tp - L.truePeakDb + 0.1;
    }
  } else await write(null);
  const m = await measureLoudness(output, L);
  return { readjustGainDb: round(gain, 3), peakBeforeLimiterDbtp: beforeLimit.truePeakDbtp, limiter, channels, result: { integratedLufs: m.integratedLufs, truePeakDbtp: m.truePeakDbtp, lraLu: m.lraLu } };
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

async function speechMetrics(file, channels = 1) {
  const env = await energyEnvelope(file, { channels });
  const vad = detectSpeech(env);
  const speechSec = vad.segments.reduce((n, s) => n + (s.end - s.start), 0);
  return { ...vad, speechSec: round(speechSec, 2), env };
}

/**
 * audio.speech-to-pause: how much the treatment worsened speech RMS − pause RMS, on regions
 * detected once (in the untreated cut) and reused for both signals.
 */
export function speechToPauseCheck(envBefore, envAfter, { maxWorseningDb, minPauseSec, trimSec, maxImprovementDb }, { durationSec = envBefore.length * 0.01 } = {}) {
  const vad = detectSpeech(envBefore);
  const pauses = derivePauses(vad.segments, durationSec);
  const before = pauseNoiseRatio(envBefore, vad.segments, pauses, { minPauseSec, trimSec });
  const after = pauseNoiseRatio(envAfter, vad.segments, pauses, { minPauseSec, trimSec });
  const base = { id: "audio.speech-to-pause", title: `Relação fala − pausa não piora (limite ${maxWorseningDb} dB)`, before, after, worseningDb: null, limitDb: maxWorseningDb };
  if (before.ratioDb === null || after.ratioDb === null) return { ...base, status: "NOT_TESTED", details: `sem fala ou pausas ≥ ${minPauseSec} s para medir` };
  const worseningDb = round(before.ratioDb - after.ratioDb, 2);
  const status = worseningDb > maxWorseningDb ? "FAIL" : worseningDb > 0 || -worseningDb > maxImprovementDb ? "WARN" : "PASS";
  return { ...base, worseningDb, status, details: `antes ${before.ratioDb} dB → depois ${after.ratioDb} dB (piora ${worseningDb} dB; ${before.pauses} pausas; fala ${before.speechDb}→${after.speechDb}, pausa ${before.pauseDb}→${after.pauseDb} dBFS)${-worseningDb > maxImprovementDb ? " — redução agressiva demais pode soar artificial" : ""}` };
}

/** Non-overlapping excerpts spread over the programme, each mostly speech. */
export function pickAbWindows(speech, durationSec, { clips, clipSec, minSpeechRatio }) {
  const n = Math.max(3, Math.min(5, clips));
  if (durationSec <= clipSec) return [[0, round(durationSec, 2)]];
  const out = [];
  const zone = durationSec / n;
  for (let z = 0; z < n; z++) {
    let best = null;
    for (let s = z * zone; s <= Math.min((z + 1) * zone, durationSec) - Math.min(clipSec, zone) + 1e-6; s += 0.25) {
      const e = Math.min(durationSec, s + Math.min(clipSec, zone));
      const ratio = speech.reduce((k, x) => k + Math.max(0, Math.min(x.end, e) - Math.max(x.start, s)), 0) / (e - s);
      if (!best || ratio > best.ratio + 1e-9) best = { ratio, w: [round(s, 2), round(e, 2)] };
    }
    if (best && best.ratio >= minSpeechRatio) out.push(best.w);
  }
  return out.length ? out : [bestSpeechWindow(speech, durationSec, clipSec)];
}

/** Writes before/after excerpts at the same LUFS with linear gain only (never a limiter). */
async function writeAbClips(original, treated, windows, dir, L) {
  const clips = [];
  for (const [i, [a, b]] of windows.entries()) {
    const id = String(i + 1).padStart(2, "0");
    const raw = {};
    for (const [k, f] of [["before", original], ["after", treated]]) {
      raw[k] = path.join(dir, `.raw-${id}-${k}.wav`);
      await ff(["-ss", String(a), "-t", String(b - a), "-i", f, "-ar", "48000", "-c:a", "pcm_f32le", raw[k]], "trecho A/B");
    }
    const m = { before: await measureLoudness(raw.before, L), after: await measureLoudness(raw.after, L) };
    const headroom = (x) => x.integratedLufs + (L.truePeakDb - x.truePeakDbtp); // loudest level without limiting
    const level = Math.min(L.targetLufs, headroom(m.before), headroom(m.after));
    const clip = { id, start: a, end: b, levelLufs: round(level, 2) };
    for (const k of ["before", "after"]) {
      clip[k] = path.join(dir, `clip-${id}-${k}.wav`);
      await ff(["-i", raw[k], "-af", `volume=${(level - m[k].integratedLufs).toFixed(3)}dB`, "-c:a", "pcm_s24le", clip[k]], "A/B com volume igualado");
      clip[`${k}Sha256`] = await sha256File(clip[k]);
      await rm(raw[k], { force: true });
    }
    clips.push(clip);
  }
  return clips;
}

/** Speech seconds measured with a FIXED threshold (so before/after are comparable). */
/**
 * Speech-to-pause ratio on fixed regions: energy-averaged level of speech intervals versus
 * the core of pauses (≥ 0.25 s, 60 ms trimmed each side). Same regions before and after,
 * so it measures what the treatment did to noise between phrases.
 */
export function pauseNoiseRatio(env, speech, pauses, { hop = 0.01, minPauseSec = 0.25, trimSec = 0.06 } = {}) {
  const avg = (ranges) => {
    let acc = 0, n = 0;
    for (const [a, b] of ranges) for (let i = Math.floor(a / hop); i < Math.min(env.length, Math.ceil(b / hop)); i++) { acc += Math.pow(10, env[i] / 10); n++; }
    return n ? 10 * Math.log10(acc / n) : null;
  };
  const core = pauses.filter((p) => p.duration >= minPauseSec).map((p) => [p.start + trimSec, p.end - trimSec]);
  const speechDb = avg(speech.map((s) => [s.start, s.end]));
  const pauseDb = avg(core);
  return { speechDb: round(speechDb, 2), pauseDb: round(pauseDb, 2), ratioDb: speechDb !== null && pauseDb !== null ? round(speechDb - pauseDb, 2) : null, pauses: core.length };
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
 *   abDir: folder for A/B files · ab: {clips, clipSec} · workDir · channels: delivery layout (1 or 2)
 */
export async function processVoice(input, o = {}) {
  await requireFfmpeg(["afftdn", "loudnorm", "acompressor", "alimiter", "highpass", "equalizer", "sidechaingate"]);
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

  // 2) denoiser selection: explicit request without a usable binary is an error; "auto" falls
  // back to FFmpeg and says so in the report
  const df = await deepFilterStatus();
  const wanted = o.denoiser ?? "auto";
  let denoiser = "ffmpeg";
  if (wanted === "deepfilternet" && !df.usable) throw reelError(REEL_ERRORS.INPUT_INVALID, `DeepFilterNet pedido, mas não utilizável: ${df.reason}.`, { hint: "Rode motion audio doctor, ou use --denoiser=ffmpeg.", exitCode: 3 });
  if ((wanted === "auto" || wanted === "deepfilternet") && df.usable && params.denoise) denoiser = "deepfilternet";
  const denoiserFallback = wanted === "auto" && params.denoise && !df.usable ? `auto: DeepFilterNet ${df.state} (${df.reason}) → ffmpeg-afftdn` : null;

  const extracted = path.join(work, "source-48k.wav");
  await ff(["-i", input, "-vn", ...(monoDownmix(channels) ? ["-af", monoDownmix(channels)] : []), "-ac", "1", "-ar", "48000", "-c:a", "pcm_f32le", extracted], "extração do áudio");
  let chainInput = extracted;
  if (denoiser === "deepfilternet") {
    const dfOut = path.join(work, "df");
    await mkdir(dfOut, { recursive: true });
    const atten = Math.round(params.denoise.appliedDb + 6);
    const r = await run(df.binary, ["--atten-lim", String(atten), "-o", dfOut, extracted]);
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

  // 4) linear gain to target in the delivery layout, expander, optional music bed
  const outChannels = o.channels ?? 1;
  const L = params.loudness;
  const cutLoud = await measureLoudness(treatedCut, L);
  if (cutLoud.integratedLufs === null) throw reelError(REEL_ERRORS.RENDER_FAILED, "Áudio sem sinal mensurável: não é possível normalizar.");
  const gainDb = L.targetLufs - cutLoud.integratedLufs;
  const gained = path.join(work, "gained.wav");
  await ff(["-i", treatedCut, "-af", `volume=${gainDb.toFixed(3)}dB`, "-c:a", "pcm_f32le", gained], "ganho linear");
  let toFinish = gained;
  if (params.expander) {
    toFinish = path.join(work, "expanded.wav");
    params.expander = await applyExpander(gained, toFinish, params.expander);
  }
  let music = null;
  if (o.music?.path) {
    const mp = path.resolve(o.music.path);
    const duck = { thresholdDb: -30, ratio: 8, attackMs: 20, releaseMs: 350, ...(o.music.duck ?? {}) };
    const gain = o.music.gainDb ?? -18;
    const mixed = path.join(work, "mixed.wav");
    const dur = (await probeMedia(toFinish)).durationSec;
    const graph = `[1:a]aresample=48000,aformat=channel_layouts=mono,atrim=0:${dur},asetpts=PTS-STARTPTS,volume=${gain}dB[m];` +
      `[0:a]asplit=2[v][key];[m][key]sidechaincompress=threshold=${Math.pow(10, duck.thresholdDb / 20).toFixed(5)}:ratio=${duck.ratio}:attack=${duck.attackMs}:release=${duck.releaseMs}[md];` +
      `[v][md]amix=inputs=2:duration=first:normalize=0[out]`;
    await ff(["-i", toFinish, "-stream_loop", "-1", "-i", mp, "-filter_complex", graph, "-map", "[out]", "-ar", "48000", "-c:a", "pcm_f32le", mixed], "mixagem com ducking");
    toFinish = mixed;
    music = { path: mp, sha256: await sha256File(mp), gainDb: gain, duck };
  }

  // 5) one readjustment + limiter for what is left
  const finish = await finishLoudness(toFinish, output, L, { channels: outChannels });
  const norm = { order: "gain → expander → [music] → readjust(1×) → limiter(peaks)", measured: { integratedLufs: cutLoud.integratedLufs, truePeakDbtp: cutLoud.truePeakDbtp }, gainDb: round(gainDb, 3), ...finish };

  // 6) after-measurements and QA
  const after = await measureLoudness(output, params.loudness);
  const afterStats = await measureStats(output);
  const beforeLoud = await measureLoudness(originalCut, params.loudness);
  const beforeStats = await measureStats(originalCut);
  const beforeSp = await speechMetrics(originalCut);
  const afterSp = await speechMetrics(output, outChannels);
  const outDur = (await probeMedia(output)).durationSec;

  const abFiles = {};
  if (o.abDir) {
    const ab = path.resolve(o.abDir);
    await mkdir(ab, { recursive: true });
    // only files this function generates are replaced; the folder belongs to the caller
    for (const f of await readdir(ab)) if (/^(clip-\d{2}-(before|after)\.wav|ab\.json)$/.test(f)) await rm(path.join(ab, f), { force: true });
    abFiles.original = path.join(ab, "original.wav");
    await ff(["-i", originalCut, "-c:a", "pcm_s24le", abFiles.original], "cópia do original (A/B)");
    abFiles.treated = output;
    const cfg = { ...PRESETS.ab, ...(o.ab ?? {}) };
    abFiles.clips = await writeAbClips(originalCut, output, pickAbWindows(beforeSp.segments, outDur, cfg), ab, L);
    abFiles.beforeSample = abFiles.clips[0].before;
    abFiles.afterSample = abFiles.clips[0].after;
    abFiles.index = path.join(ab, "ab.json");
    const rel = (f) => path.basename(f);
    await writeFile(abFiles.index, JSON.stringify({ schema: "motion.voice.ab", schemaVersion: 1, preset: params.preset, chainVersion: VOICE_CHAIN_VERSION, treatedSha256: await sha256File(output), matching: "ganho linear por trecho, mesmo LUFS dos dois lados, sem limitador", clips: abFiles.clips.map((c) => ({ ...c, before: rel(c.before), after: rel(c.after) })), humanListening: "NOT_TESTED" }, null, 2) + "\n");
  }

  // SNR comparison on a common footing: floor in pauses vs speech level, both relative.
  const report = createQaReport({ subject: path.basename(output), kind: "voice" });
  const tp = after.truePeakDbtp, lim = params.loudness.truePeakDb;
  report.add({ id: "voice.truepeak", title: `True peak ≤ ${lim} dBTP (sem clipping)`, status: tp !== null && tp <= lim ? "PASS" : "FAIL", details: `${tp} dBTP (antes: ${beforeLoud.truePeakDbtp} dBTP)` });
  report.add({ id: "voice.samplepeak", title: "Pico de amostra < 0 dBFS", status: afterStats.peakDb !== null && afterStats.peakDb < 0 ? "PASS" : "FAIL", details: `${round(afterStats.peakDb, 2)} dBFS` });
  const dL = Math.abs((after.integratedLufs ?? -99) - params.loudness.targetLufs);
  report.add({ id: "voice.loudness", title: `Loudness integrado ${params.loudness.targetLufs} LUFS ±${L.toleranceLu} LU`, status: dL <= L.toleranceLu ? "PASS" : dL <= L.failLu ? "WARN" : "FAIL", details: `${after.integratedLufs} LUFS (antes: ${beforeLoud.integratedLufs} LUFS)` });
  const sup = speechSuppression(beforeSp.env, afterSp.env, beforeSp.segments, { minLevelDb: beforeSp.thresholdDb });
  const stp = speechToPauseCheck(beforeSp.env, afterSp.env, params.speechToPause, { durationSec: outDur });
  report.add({ id: "voice.speech-preserved", title: "Fala preservada (quadros de fala suprimidos > 10 dB)", heuristic: true, status: sup.suppressedRatio <= 0.02 ? "PASS" : sup.suppressedRatio <= 0.05 ? "WARN" : "FAIL", details: `${round(sup.suppressedRatio * 100, 2)}% de ${sup.frames} quadros de 10 ms (ganho mediano ${sup.medianGainDb} dB)` });
  if (music) Object.assign(stp, { status: "NOT_TESTED", details: "trilha musical nas pausas: a métrica mede só voz" });
  report.add({ id: stp.id, title: stp.title, heuristic: true, required: stp.status !== "NOT_TESTED", status: stp.status, details: stp.details });
  if (denoiserFallback) report.add({ id: "voice.denoiser", title: "Redução de ruído: provedor usado", status: "WARN", required: false, details: denoiserFallback });
  report.add({ id: "voice.latency", title: "Áudio tratado alinhado à fonte (latência compensada)", status: Math.abs(residual.seconds) <= 0.001 ? "PASS" : Math.abs(residual.seconds) <= 0.01 ? "WARN" : "FAIL", details: `cadeia atrasava ${round(latency.seconds * 1000, 2)} ms; residual ${round(residual.seconds * 1000, 2)} ms (correlação ${residual.envelopeCorrelation})` });
  report.add({ id: "voice.duration", title: "Duração preservada pelo tratamento", status: Math.abs(outDur - (await probeMedia(originalCut)).durationSec) <= 0.02 ? "PASS" : "FAIL", details: `${outDur}s` });
  if (params.dehum) report.add({ id: "voice.dehum", title: `Zumbido de rede ${params.dehum.baseHz} Hz tratado (notch)`, status: "PASS", required: false, details: `harmônicos ${params.dehum.harmonics.join(", ")} Hz; excesso medido ${JSON.stringify(hum?.excessDb ?? {})} dB` });
  report.add({ id: "voice.listening", title: "Revisão auditiva humana (timbre, artefatos, fonemas)", status: "NOT_TESTED", required: false, details: "Obrigatória antes de declarar qualidade; use os arquivos A/B com loudness casado." });

  if (!o.keepWork) await rm(work, { recursive: true, force: true });
  const sourceAfter = await sha256File(input);
  return {
    schema: "motion.voice.report", schemaVersion: 2, chainVersion: VOICE_CHAIN_VERSION,
    source: { path: path.resolve(input), sha256, unchanged: sourceAfter === sha256 },
    output, durationSec: outDur, denoiser, denoiserFallback, deepFilter: df,
    params, chain, hum, latency: { measured: latency, residual }, segments: segments ? segments.length : null, music,
    loudnessPass: norm,
    before: { loudness: beforeLoud, stats: beforeStats, noiseFloorDb: beforeSp.noiseFloorDb, speechLevelDb: beforeSp.speechLevelDb, snrDb: beforeSp.snrDb },
    after: { loudness: { integratedLufs: after.integratedLufs, truePeakDbtp: after.truePeakDbtp, lraLu: after.lraLu }, stats: afterStats, noiseFloorDb: afterSp.noiseFloorDb, speechLevelDb: afterSp.speechLevelDb, snrDb: afterSp.snrDb },
    speechToPause: stp, speechSuppression: sup,
    ab: o.abDir ? abFiles : null,
    qa: report.toJSON(),
  };
}

export { derivePauses };
