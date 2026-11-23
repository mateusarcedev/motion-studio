/**
 * MOTION Core — reel/sibilants.mjs
 * A final /s/ or /f/ carries little broadband energy and falls below the VAD threshold, so a
 * cut there truncates it. Edges are extended while the high band stays above its own floor.
 */
import { energyEnvelope, percentile } from "./analyze.mjs";
import { round } from "./util.mjs";

const HOP = 0.01;

export async function highBandEnvelope(file, { hz, marginDb, channels = null }) {
  const env = await energyEnvelope(file, { channels, filter: `highpass=f=${hz}:poles=2` });
  const floorDb = percentile(env, 10);
  return { env, floorDb: round(floorDb, 1), thresholdDb: round(floorDb + marginDb, 1) };
}

/** Pure edge walk: from `t` in direction `dir`, tolerating `maxGapSec` before and inside the sibilant. */
export function walkHighBand(env, thresholdDb, t, dir, { maxGapSec, maxExtendSec, limit }) {
  let last = null, gap = 0;
  const start = dir > 0 ? Math.round(t / HOP) : Math.round(t / HOP) - 1;
  for (let k = 0; k < Math.round(maxExtendSec / HOP); k++) {
    const i = start + dir * k;
    const time = dir > 0 ? (i + 1) * HOP : i * HOP;
    if (i < 0 || i >= env.length || (dir > 0 ? time > limit + 1e-9 : time < limit - 1e-9)) break;
    if (env[i] > thresholdDb) { last = time; gap = 0; } else if ((gap += HOP) > maxGapSec + 1e-9) break;
  }
  return last === null ? t : round(last, 3);
}

export async function extendSpeechToSibilants(file, speech, cfg, { channels = null, durationSec }) {
  const hb = await highBandEnvelope(file, { ...cfg, channels });
  const extended = [];
  const out = speech.map((s, i) => {
    const start = walkHighBand(hb.env, hb.thresholdDb, s.start, -1, { ...cfg, limit: speech[i - 1]?.end ?? 0 });
    const end = walkHighBand(hb.env, hb.thresholdDb, s.end, 1, { ...cfg, limit: speech[i + 1]?.start ?? durationSec });
    if (start < s.start) extended.push({ edge: "start", from: s.start, to: start });
    if (end > s.end) extended.push({ edge: "end", from: s.end, to: end });
    return { ...s, start: Math.min(start, s.start), end: Math.max(end, s.end) };
  });
  // neighbours may now touch: keep them ordered and disjoint
  for (let i = 1; i < out.length; i++) if (out[i].start < out[i - 1].end) { const m = round((out[i].start + out[i - 1].end) / 2, 3); out[i - 1].end = m; out[i].start = m; }
  return { speech: out, extended, floorDb: hb.floorDb, thresholdDb: hb.thresholdDb };
}
