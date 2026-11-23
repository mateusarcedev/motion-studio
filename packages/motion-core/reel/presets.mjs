/**
 * MOTION Core — reel/presets.mjs
 * Every tunable of the reel engine lives in presets.json (data, not code). Projects override
 * any value; the effective values are recorded in the timeline and in the reports.
 */
import { readFileSync } from "node:fs";

const freeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
export const PRESETS = freeze(JSON.parse(readFileSync(new URL("./presets.json", import.meta.url), "utf8")));
export const VOICE_PRESETS = PRESETS.voice;
export const EDIT_PRESETS = PRESETS.edit;

/** Deep merge; arrays and scalars in `over` replace, objects merge. */
export function merge(base, over) {
  if (over === undefined) return structuredClone(base);
  if (over === null || typeof over !== "object" || Array.isArray(over) || typeof base !== "object" || base === null || Array.isArray(base)) return structuredClone(over);
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(over)) out[k] = merge(base[k], v);
  return out;
}

/** QA thresholds for an edit preset, with project overrides (`edit.config.json` → `qa`). */
export function resolveQaParams(preset = "talking-head", overrides = {}) {
  return merge(merge(PRESETS.qa.base, PRESETS.qa[preset] ?? {}), overrides ?? {});
}
