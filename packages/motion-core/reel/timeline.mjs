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

/**
 * Maps source-timed words onto the destination timeline. A word is placed in every kept
 * segment holding ≥ 50% of it (the hook may repeat a range: occurrence ids are suffixed);
 * otherwise in the segment with the largest overlap. Only zero-overlap words are lost.
 */
export function remapWords(words, segments, { excluded = [] } = {}) {
  const out = [];
  const lost = [];
  for (const w of words) {
    const dur = Math.max(1e-6, w.end - w.start);
    // words deliberately removed (filler/repetition/operator) never get the max-overlap fallback
    const inExcluded = excluded.reduce((n, [a, b]) => n + Math.max(0, Math.min(w.end, b) - Math.max(w.start, a)), 0);
    if (inExcluded >= 0.5 * dur) { lost.push(w); continue; }
    const overlaps = segments.map((s) => ({ s, a: Math.max(w.start, s.src[0]), b: Math.min(w.end, s.src[1]) })).map((o) => ({ ...o, ov: o.b - o.a })).filter((o) => o.ov > 1e-6);
    let chosen = overlaps.filter((o) => o.ov >= 0.5 * dur);
    if (!chosen.length && overlaps.length) chosen = [overlaps.reduce((m, o) => (o.ov > m.ov ? o : m))];
    if (!chosen.length) { lost.push(w); continue; }
    chosen.forEach((o, k) => out.push({ ...w, id: k ? `${w.id}#${k + 1}` : w.id, srcStart: w.start, srcEnd: w.end, start: round(o.s.dst[0] + (o.a - o.s.src[0]), 3), end: round(o.s.dst[0] + (o.b - o.s.src[0]), 3), segment: o.s.id, clipped: o.ov < dur - 1e-3 }));
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
