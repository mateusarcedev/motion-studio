/**
 * MOTION Core — reel/analyze.mjs
 * Deterministic media analysis with FFmpeg only: technical probe, EBU R128 loudness,
 * true peak, dynamics, an energy envelope (10 ms hop) and an energy-based voice activity
 * detector with hysteresis. Silences/pauses are derived from the same envelope, so every
 * downstream decision (cuts, noise estimate, caption sync QA) uses one measurement.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { lastJsonObject, mapLimit, monoDownmix, probeMedia, round, run, sha256File, requireFfmpeg, reelError, REEL_ERRORS } from "./util.mjs";

export const ENVELOPE_HOP_SEC = 0.01;
const SR = 16000;
const HOP = SR * ENVELOPE_HOP_SEC; // 160 samples

/**
 * Energy envelope in dBFS (RMS per 10 ms window) of a media file's first audio stream,
 * downmixed to mono at 16 kHz. Streams PCM so memory stays O(duration/hop).
 * `filter` lets callers measure a processed signal (e.g. a voice chain) without temp files.
 */
export async function energyEnvelope(file, { filter = null, start = null, duration = null, channels = null } = {}) {
  await requireFfmpeg();
  const args = ["-v", "error"];
  if (start !== null) args.push("-ss", String(start));
  args.push("-i", file);
  if (duration !== null) args.push("-t", String(duration));
  args.push("-vn");
  const chain = [monoDownmix(channels), filter].filter(Boolean).join(",");
  if (chain) args.push("-af", chain);
  args.push("-ac", "1", "-ar", String(SR));
  args.push("-f", "s16le", "-");
  const out = [];
  let carry = Buffer.alloc(0);
  let acc = 0, n = 0;
  const res = await run("ffmpeg", args, {
    onStdout: (chunk) => {
      const buf = carry.length ? Buffer.concat([carry, chunk]) : chunk;
      const usable = buf.length - (buf.length % 2);
      for (let i = 0; i < usable; i += 2) {
        const v = buf.readInt16LE(i) / 32768;
        acc += v * v; n++;
        if (n === HOP) { out.push(acc > 0 ? 10 * Math.log10(acc / HOP) : -120); acc = 0; n = 0; }
      }
      carry = buf.subarray(usable);
    },
  });
  if (res.code !== 0) throw reelError(REEL_ERRORS.INPUT_INVALID, "Não foi possível decodificar o áudio.", { details: res.stderr.trim().split("\n").slice(-2).join(" "), hint: "O arquivo tem uma faixa de áudio decodificável?" });
  if (n > HOP / 4) out.push(acc > 0 ? 10 * Math.log10(acc / n) : -120);
  return Float64Array.from(out);
}

export function percentile(values, p) {
  const arr = Array.from(values).filter((v) => v > -119).sort((a, b) => a - b);
  if (!arr.length) return -120;
  const idx = Math.min(arr.length - 1, Math.max(0, Math.round((p / 100) * (arr.length - 1))));
  return arr[idx];
}

function median5(env) {
  const out = new Float64Array(env.length);
  for (let i = 0; i < env.length; i++) {
    const w = [];
    for (let k = -2; k <= 2; k++) w.push(env[Math.min(env.length - 1, Math.max(0, i + k))]);
    w.sort((a, b) => a - b);
    out[i] = w[2];
  }
  return out;
}

/**
 * Energy VAD with hysteresis. Thresholds adapt to the recording: noise floor = P10,
 * speech level = P95. Returns speech intervals (s) plus the levels used.
 */
export function detectSpeech(env, {
  hop = ENVELOPE_HOP_SEC, minSpeech = 0.06, mergeGap = 0.18, hangover = 0.08, onsetFrames = 3,
  floorPercentile = 10, speechPercentile = 95, minMarginDb = 6, relMargin = 0.3,
} = {}) {
  const sm = median5(env);
  const floor = percentile(sm, floorPercentile);
  const speech = percentile(sm, speechPercentile);
  const spread = Math.max(0, speech - floor);
  const enter = floor + Math.max(minMarginDb, relMargin * spread);
  const exit = enter - 3;
  const raw = [];
  let inSpeech = false, startIdx = 0, above = 0, below = 0;
  const hangFrames = Math.round(hangover / hop);
  for (let i = 0; i < sm.length; i++) {
    const v = sm[i];
    if (!inSpeech) {
      above = v > enter ? above + 1 : 0;
      if (above >= onsetFrames) { inSpeech = true; startIdx = i - onsetFrames + 1; below = 0; }
    } else {
      below = v < exit ? below + 1 : 0;
      if (below > hangFrames) { raw.push([startIdx, i - below + 1]); inSpeech = false; above = 0; }
    }
  }
  if (inSpeech) raw.push([startIdx, sm.length]);
  // merge short gaps, then drop blips
  const merged = [];
  for (const [s, e] of raw) {
    const last = merged.at(-1);
    if (last && (s - last[1]) * hop < mergeGap) last[1] = e; else merged.push([s, e]);
  }
  const segments = merged
    .filter(([s, e]) => (e - s) * hop >= minSpeech)
    .map(([s, e]) => ({ start: round(s * hop, 3), end: round(e * hop, 3) }));
  return { segments, noiseFloorDb: round(floor, 1), speechLevelDb: round(speech, 1), thresholdDb: round(enter, 1), snrDb: round(spread, 1) };
}

/** Pauses = gaps between speech intervals, including leading and trailing silence. */
export function derivePauses(speech, durationSec) {
  const pauses = [];
  let cursor = 0;
  for (const s of speech) {
    if (s.start - cursor > 0.001) pauses.push({ start: round(cursor, 3), end: s.start, duration: round(s.start - cursor, 3), kind: cursor === 0 ? "leading" : "gap" });
    cursor = s.end;
  }
  if (durationSec - cursor > 0.001) pauses.push({ start: round(cursor, 3), end: round(durationSec, 3), duration: round(durationSec - cursor, 3), kind: "trailing" });
  return pauses;
}

/** EBU R128 measurement through loudnorm's analysis pass (integrated, true peak, LRA). */
export async function measureLoudness(file, { filter = null, targetLufs = -14, truePeakDb = -1.5, lra = 11 } = {}) {
  const chain = [filter, `loudnorm=I=${targetLufs}:TP=${truePeakDb}:LRA=${lra}:print_format=json`].filter(Boolean).join(",");
  const res = await run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", chain, "-f", "null", "-"]);
  const j = lastJsonObject(res.stderr);
  if (res.code !== 0 || !j) throw reelError(REEL_ERRORS.INPUT_INVALID, "Falha ao medir loudness (EBU R128).", { details: res.stderr.trim().split("\n").slice(-2).join(" ") });
  const num = (v) => (v === "-inf" || v === "inf" ? null : Number(v));
  return {
    integratedLufs: num(j.input_i), truePeakDbtp: num(j.input_tp), lraLu: num(j.input_lra), thresholdLufs: num(j.input_thresh),
    raw: j,
  };
}

/** Sample peak / RMS / crest factor / DC offset of the whole track (astats). */
export async function measureStats(file, { filter = null } = {}) {
  const chain = [filter, "astats=metadata=0:reset=0"].filter(Boolean).join(",");
  const res = await run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", chain, "-f", "null", "-"]);
  const overall = res.stderr.split("Overall").at(-1) ?? "";
  const pick = (label) => { const m = overall.match(new RegExp(`${label}:\\s*(-?[\\d.]+|-?inf)`)); return m ? (m[1].includes("inf") ? null : Number(m[1])) : null; };
  return { peakDb: pick("Peak level dB"), rmsDb: pick("RMS level dB"), crestFactor: pick("Crest factor"), dcOffset: pick("DC offset"), flatFactor: pick("Flat factor") };
}

async function bandRms(file, start, duration, f, widthHz, pre) {
  const chain = [pre, `bandpass=f=${f}:t=h:w=${widthHz}`, `bandpass=f=${f}:t=h:w=${widthHz}`, "astats=metadata=0"].filter(Boolean).join(",");
  const r = await run("ffmpeg", ["-hide_banner", "-nostats", "-ss", String(start), "-t", String(duration), "-i", file, "-vn", "-af", chain, "-f", "null", "-"]);
  const m = r.stderr.match(/RMS level dB:\s*(-?[\d.]+|-inf)/);
  return m && !m[1].includes("inf") ? Number(m[1]) : -140;
}

/**
 * Mains hum detector: in the longest pauses, compares narrow-band energy at 50/60 Hz and
 * their harmonics against neighbouring reference bands. Tonal hum is stationary and can be
 * notched without touching the voice; broadband/non-stationary noise is reported, not "fixed".
 */
export async function detectHum(file, pauses, { channels = null, minExcessDb = 8 } = {}) {
  const regions = [...pauses].filter((p) => p.duration >= 0.25).sort((a, b) => b.duration - a.duration).slice(0, 3);
  if (!regions.length) return { detected: false, reason: "sem pausas ≥ 0,25 s para medir" };
  const pre = monoDownmix(channels);
  const refs = [70, 85, 95, 135, 165];
  const probe = [50, 60, 100, 120, 150, 180, 200, 240];
  const jobs = [];
  for (const r of regions) for (const f of [...refs, ...probe]) jobs.push({ r, f });
  const vals = await mapLimit(jobs, 4, ({ r, f }) => bandRms(file, r.start, r.duration, f, 6, pre));
  const level = new Map();
  jobs.forEach((j, i) => level.set(j.f, (level.get(j.f) ?? []).concat(vals[i])));
  const avg = (f) => { const a = level.get(f); return a.reduce((x, y) => x + y, 0) / a.length; };
  const refLevel = refs.map(avg).sort((a, b) => a - b)[Math.floor(refs.length / 2)];
  const excess = (f) => round(avg(f) - refLevel, 1);
  const base = excess(60) >= excess(50) ? 60 : 50;
  if (excess(base) < minExcessDb) return { detected: false, referenceDb: round(refLevel, 1), excessDb: { 50: excess(50), 60: excess(60) } };
  const harmonics = [1, 2, 3, 4].map((k) => base * k).filter((f) => level.has(f) && (f === base || excess(f) >= minExcessDb / 2));
  return { detected: true, baseHz: base, harmonics, referenceDb: round(refLevel, 1), excessDb: Object.fromEntries(harmonics.map((f) => [f, excess(f)])), regions: regions.map((r) => [r.start, r.end]) };
}

/**
 * Discontinuities already inside the source (phone-app splices, dropped frames): frames whose
 * scene score is far above the local median. They behave like hard cuts the editor did not
 * make, so the planner must not leave orphan frames or micro-shots around them.
 */
export async function detectSourceCuts(file, { fps = null, minScore = 0.05, ratio = 15 } = {}) {
  const r = await run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-an", "-vf", "scale=180:-2,select='gte(scene,0)',metadata=print:key=lavfi.scene_score", "-f", "null", "-"]);
  const t = [], v = [];
  const re = /pts_time:([\d.]+)[\s\S]*?scene_score=([\d.]+)/g;
  let m;
  while ((m = re.exec(r.stderr))) { t.push(Number(m[1])); v.push(Number(m[2])); }
  const out = [];
  for (let i = 1; i < v.length; i++) {
    const win = v.slice(Math.max(0, i - 15), i + 16).filter((_, k, arr) => k !== Math.min(i, 15)).sort((a, b) => a - b);
    const med = win[Math.floor(win.length / 2)] ?? 0;
    if (v[i] >= Math.max(minScore, ratio * Math.max(med, 0.001))) out.push({ t: round(t[i], 4), frame: fps ? Math.round(t[i] * fps) : null, score: round(v[i], 3), localMedian: round(med, 4) });
  }
  return out;
}

/**
 * Full analysis of a source video/audio file.
 * @returns JSON-serializable report (schema motion.reel.analysis@1)
 */
export async function analyzeMedia(file, { stillsDir = null, stills = 6, loudnessTarget = -14 } = {}) {
  const probe = await probeMedia(file);
  const sha256 = await sha256File(file);
  const result = {
    schema: "motion.reel.analysis", schemaVersion: 1,
    source: { path: path.resolve(file), sha256, bytes: probe.bytes },
    probe, audio: null, warnings: [], recommendations: {},
  };
  if (!probe.video) result.warnings.push("Arquivo sem faixa de vídeo: apenas o Voice Studio se aplica.");
  if (probe.video?.vfr) result.warnings.push("Taxa de quadros variável (VFR): o render converte para CFR na grade da timeline.");
  if (probe.video?.rotation) result.warnings.push(`Rotação de exibição ${probe.video.rotation}°: dimensões já corrigidas.`);
  if (probe.audio) {
    const channels = probe.audio.channels;
    const env = await energyEnvelope(file, { channels });
    const vad = detectSpeech(env);
    const pauses = derivePauses(vad.segments, probe.durationSec);
    const hum = await detectHum(file, pauses, { channels });
    const loud = await measureLoudness(file, { targetLufs: loudnessTarget });
    const stats = await measureStats(file, { filter: monoDownmix(channels) });
    const speechSec = vad.segments.reduce((n, s) => n + (s.end - s.start), 0);
    const cuttable = pauses.filter((p) => p.duration >= 0.3);
    result.audio = {
      loudness: { integratedLufs: loud.integratedLufs, truePeakDbtp: loud.truePeakDbtp, lraLu: loud.lraLu, thresholdLufs: loud.thresholdLufs },
      stats,
      hum,
      noiseFloorDb: vad.noiseFloorDb, speechLevelDb: vad.speechLevelDb, vadThresholdDb: vad.thresholdDb, snrDb: vad.snrDb,
      speech: vad.segments, pauses,
      speechSec: round(speechSec, 2), speechRatio: round(speechSec / Math.max(0.001, probe.durationSec), 3),
      cutOpportunities: { pausesOver300ms: cuttable.length, removableSec: round(cuttable.reduce((n, p) => n + Math.max(0, p.duration - 0.24), 0), 2) },
      envelope: { hopSec: ENVELOPE_HOP_SEC, frames: env.length, note: "envelope completo não é serializado; recalculado sob demanda" },
    };
    const snr = vad.snrDb;
    result.recommendations.voicePreset = snr < 25 ? "noisy-room" : snr < 35 ? "clean" : "natural";
    if (stats.peakDb !== null && stats.peakDb > -0.3) result.warnings.push(`Pico de amostra ${stats.peakDb} dBFS: possível clipping já na captação (não recuperável por normalização).`);
    if (loud.integratedLufs !== null && loud.integratedLufs < -30) result.warnings.push(`Gravação muito baixa (${loud.integratedLufs} LUFS): o ruído subirá junto com a normalização.`);
  } else {
    result.warnings.push("Arquivo sem áudio: transcrição, cortes por pausa e Voice Studio indisponíveis.");
  }
  if (probe.video) {
    result.video = { sourceCuts: await detectSourceCuts(file, { fps: Math.round(probe.video.fps) }) };
    if (result.video.sourceCuts.length) result.warnings.push(`${result.video.sourceCuts.length} descontinuidade(s) já existentes na fonte (emendas/saltos): ${result.video.sourceCuts.map((c) => `${c.t}s`).join(", ")}.`);
  }
  if (stillsDir && probe.video) {
    await mkdir(stillsDir, { recursive: true });
    const sheet = path.join(stillsDir, "analysis-contact-sheet.png");
    const step = Math.max(0.5, probe.durationSec / stills);
    const cols = Math.min(stills, 6), rows = Math.ceil(stills / cols);
    const r = await run("ffmpeg", ["-v", "error", "-y", "-i", file, "-vf", `fps=1/${step.toFixed(3)},scale=270:-2,tile=${cols}x${rows}`, "-frames:v", "1", sheet]);
    if (r.code === 0) result.stills = { contactSheet: sheet, everySec: round(step, 2) };
    else result.warnings.push("Não foi possível gerar a folha de contato da análise.");
  }
  return result;
}
