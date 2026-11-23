/**
 * MOTION Core — reel/timeline.mjs
 * Versioned, deterministic edit timeline (motion.timeline@1).
 *
 * Source ranges are snapped to the output frame grid, so destination times are exact
 * multiples of 1/fps and the audio cut points fall on whole samples (48 kHz / 30 fps =
 * 1600 samples per frame). The same timeline + the same input files reproduce the same edit.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PRESETS } from "./presets.mjs";
import { reelError, REEL_ERRORS, round, sha256Text } from "./util.mjs";

export const TIMELINE_SCHEMA = "motion.timeline";
export const TIMELINE_VERSION = 1;

/** Assigns dst ranges by cumulative whole frames, in segment order. Mutates and returns. */
export function computeDst(segments, fps) {
  let frame = 0;
  for (const s of segments) {
    const f0 = Math.round(s.src[0] * fps), f1 = Math.round(s.src[1] * fps);
    s.src = [f0 / fps, f1 / fps].map((v) => round(v, 6));
    s.frames = f1 - f0;
    s.dst = [round(frame / fps, 6), round((frame + s.frames) / fps, 6)];
    frame += s.frames;
  }
  return segments;
}

export function totalFrames(segments) {
  return segments.reduce((n, s) => n + s.frames, 0);
}

/** src time → dst time, or null when the instant was removed. */
export function srcToDst(segments, t) {
  for (const s of segments) if (t >= s.src[0] - 1e-6 && t <= s.src[1] + 1e-6) return round(s.dst[0] + (t - s.src[0]), 6);
  return null;
}

/**
 * Trims recognizer word boundaries to detected speech energy: Whisper-style timestamps often
 * spill into the following pause. A word keeps its original span when no speech overlaps it.
 */
export function refineWordTiming(words, speech) {
  return words.map((w) => {
    const hits = speech.filter((s) => s.end > w.start && s.start < w.end);
    if (!hits.length) return w;
    const start = Math.max(w.start, hits[0].start), end = Math.min(w.end, hits.at(-1).end);
    return end - start >= 0.04 ? { ...w, start: round(start, 3), end: round(end, 3), refined: true } : w;
  });
}

/** Segments contiguous in the source (zoom cuts) play as one uninterrupted stretch of audio. */
export function audioRuns(segments) {
  const runs = [];
  for (const s of segments) {
    const last = runs.at(-1);
    if (last && Math.abs(s.src[0] - last.src[1]) < 1e-6 && Math.abs(s.dst[0] - last.dst[1]) < 1e-6) { last.src[1] = s.src[1]; last.dst[1] = s.dst[1]; last.segments.push(s); }
    else runs.push({ src: [...s.src], dst: [...s.dst], segments: [s] });
  }
  return runs;
}

/**
 * Maps source-timed words onto the destination timeline by what is actually audible. With
 * `energy` ({env, thresholdDb}, 10 ms frames of the source) the word's region is its frames of
 * speech energy; without it, its whole span. A word is captioned where enough of that region
 * survived, timed by the surviving frames. It is never moved to a neighbouring stretch: if its
 * region was cut, the caption goes away (lost[].lostReason says why).
 */
export function remapWords(words, segments, { excluded = [], energy = null, params = {} } = {}) {
  const P = { ...PRESETS.captions.remap, ...params };
  const runs = audioRuns(segments);
  const hop = 0.01;
  const out = [];
  const lost = [];
  const len = (ranges) => ranges.reduce((n, [a, b]) => n + (b - a), 0);
  const clip = (ranges, lo, hi) => ranges.map(([a, b]) => [Math.max(a, lo), Math.min(b, hi)]).filter(([a, b]) => b - a > 1e-6);
  for (const w of words) {
    let region = [[w.start, w.end]], measured = false;
    if (energy) {
      const f = [];
      for (let i = Math.floor(w.start / hop + 1e-6); i < Math.ceil(w.end / hop - 1e-6); i++) {
        if (!(energy.env[i] > energy.thresholdDb + P.levelMarginDb)) continue;
        const a = Math.max(w.start, i * hop), b = Math.min(w.end, (i + 1) * hop);
        if (f.length && a - f.at(-1)[1] < 1e-6) f.at(-1)[1] = b; else f.push([a, b]);
      }
      if (f.length) { region = f; measured = true; }
    }
    const total = Math.max(1e-6, len(region));
    const gone = excluded.reduce((n, [a, b]) => n + len(clip(region, a, b)), 0);
    if (gone >= 0.5 * total) { lost.push({ ...w, lostReason: "decision" }); continue; }
    const places = runs.map((r) => ({ r, kept: clip(region, r.src[0], r.src[1]) })).filter((x) => x.kept.length);
    const chosen = places.filter((x) => len(x.kept) >= P.minAudibleRatio * total - 1e-6 && len(x.kept) >= Math.min(P.minAudibleSec, total) - 1e-6);
    if (!chosen.length) { lost.push({ ...w, lostReason: places.length ? "energy-cut" : "removed", audibleRatio: round(len(places.flatMap((x) => x.kept)) / total, 2) }); continue; }
    // A replay (same source heard again) is a new occurrence; the rest of a word split by a cut is
    // not: the word is captioned once, where most of it is heard.
    const overlaps = (x, y) => x.kept.some(([a, b]) => y.kept.some(([c, d]) => Math.min(b, d) - Math.max(a, c) > 1e-6));
    const once = chosen.filter((x) => !chosen.some((y) => y !== x && !overlaps(x, y) && (len(y.kept) > len(x.kept) + 1e-9 || (Math.abs(len(y.kept) - len(x.kept)) <= 1e-9 && chosen.indexOf(y) < chosen.indexOf(x)))));
    once.forEach(({ r, kept }, k) => {
      const a = kept[0][0], b = kept.at(-1)[1], at = (t) => round(r.dst[0] + (t - r.src[0]), 3);
      out.push({ ...w, id: k ? `${w.id}#${k + 1}` : w.id, srcStart: w.start, srcEnd: w.end, start: at(a), end: at(b), segment: (r.segments.find((s) => a >= s.src[0] - 1e-6 && a < s.src[1] - 1e-6) ?? r.segments[0]).id,
        clipped: len(kept) < total - 1e-3, retimed: measured && (Math.abs(a - w.start) > 0.02 || Math.abs(b - w.end) > 0.02) });
    });
  }
  out.sort((x, y) => x.start - y.start || x.end - y.end);
  return { words: out, lost };
}

function fail(errors) {
  return reelError(REEL_ERRORS.TIMELINE_INVALID, `Timeline inválida: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1})` : ""}`, { details: errors, hint: "Corrija o JSON ou regenere com motion edit plan." });
}

/** Structural validation; returns the list of errors (empty = valid). */
export function validateTimeline(t) {
  const e = [];
  if (!t || t.schema !== TIMELINE_SCHEMA) e.push(`schema deve ser "${TIMELINE_SCHEMA}"`);
  if (t?.schemaVersion !== TIMELINE_VERSION) e.push(`schemaVersion ${t?.schemaVersion} não suportado (esperado ${TIMELINE_VERSION})`);
  if (!t?.source?.path || !/^[0-9a-f]{64}$/.test(t?.source?.sha256 ?? "")) e.push("source.path e source.sha256 (64 hex) são obrigatórios");
  const o = t?.output ?? {};
  if (!(o.fps > 0) || !(o.width > 0) || !(o.height > 0)) e.push("output.width/height/fps obrigatórios");
  if (o.width % 2 || o.height % 2) e.push("output.width/height devem ser pares (yuv420p)");
  const segs = t?.segments ?? [];
  if (!segs.length) e.push("segments vazio: nada para renderizar");
  const dur = t?.source?.durationSec ?? Infinity;
  let expected = 0;
  const ids = new Set();
  for (const s of segs) {
    if (!s.id || ids.has(s.id)) e.push(`segmento sem id único: ${s.id}`);
    ids.add(s.id);
    if (!Array.isArray(s.src) || !(s.src[1] > s.src[0])) { e.push(`${s.id}: src inválido`); continue; }
    if (s.src[0] < -1e-6 || s.src[1] > dur + 0.05) e.push(`${s.id}: src fora da duração da fonte (${dur}s)`);
    if (Math.abs(s.dst[0] - expected) > 1e-4) e.push(`${s.id}: dst não é contíguo (esperado ${round(expected, 4)})`);
    expected = s.dst[1];
    const z = s.zoom ?? {};
    for (const k of ["from", "to"]) if (z[k] !== undefined && !(z[k] >= 1 && z[k] <= 2)) e.push(`${s.id}: zoom.${k} deve estar entre 1 e 2`);
  }
  if (o.durationSec !== undefined && Math.abs(o.durationSec - expected) > 1e-3) e.push(`output.durationSec (${o.durationSec}) ≠ soma dos segmentos (${round(expected, 3)})`);
  for (const ov of t?.overlays ?? []) {
    if (!ov.id || !Array.isArray(ov.dst) || !(ov.dst[1] > ov.dst[0])) e.push(`overlay inválido: ${ov.id ?? "?"}`);
    else if (ov.dst[1] > expected + 1e-3) e.push(`overlay ${ov.id} termina depois do fim do vídeo`);
  }
  return e;
}

export function assertTimeline(t) {
  const errors = validateTimeline(t);
  if (errors.length) throw fail(errors);
  return t;
}

function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

/** Content hash of everything that affects the render (provenance excluded). */
export function timelineHash(t) {
  const { provenance, hash, ...rest } = t;
  return sha256Text(canonical(rest));
}

export async function loadTimeline(file) {
  let t;
  try { t = JSON.parse(await readFile(file, "utf8")); } catch (error) {
    throw reelError(REEL_ERRORS.TIMELINE_INVALID, `Não foi possível ler a timeline ${file}: ${error.message}`);
  }
  assertTimeline(t);
  t.__file = path.resolve(file);
  return t;
}

export async function saveTimeline(t, file) {
  const { __file, ...clean } = t;
  clean.hash = timelineHash(clean);
  await writeFile(file, JSON.stringify(clean, null, 2) + "\n");
  return clean;
}

/** Resolves a path stored in the timeline relative to the timeline file. */
export function resolveFrom(t, p) {
  if (!p) return p;
  return path.isAbsolute(p) ? p : path.resolve(path.dirname(t.__file ?? process.cwd()), p);
}
