/**
 * AnimateIcons adapter (animated icons) — HONEST SCOPE.
 *
 * AnimateIcons (animateicons.in, MIT; shapes from Lucide ISC and Hugeicons) ships React components driven by
 * `motion/react` in REAL TIME (hover/imperative start). That is not seekable per frame, so the components
 * cannot be used as-is in deterministic renders, and their TSX is not redistributed here.
 *
 * What this provider does:
 *   - serves the equivalent Lucide static shape (same icon names as AnimateIcons' `lu-*` items), and
 *   - attaches a DETERMINISTIC motion preset (MOTION's own, pure functions of time, via svg-motion),
 *     chosen by icon semantics (bell → ring, refresh → spin, heart → pulse, check/shield → draw …).
 * An optional, opt-in catalog fetch (cached) confirms that an icon exists in the AnimateIcons catalog.
 */
import { iconProvenance, renderIcon } from "../../icons/icon-library.mjs";
import { matchConcepts, normalize, scorePack, tokenize } from "../resolver.mjs";

export const MOTION_PRESETS = {
  draw: { description: "traça os contornos em sequência", steps: [{ target: ":scope > *", effect: "draw", start: 0, duration: 0.7, stagger: 0.08, easing: "outCubic" }] },
  ring: { description: "balança como um sino e assenta", steps: [{ target: ":scope", effect: "wobble", start: 0, duration: 1.1, amplitude: 14, cycles: 3, origin: "top" }] },
  pulse: { description: "pulsa suavemente", steps: [{ target: ":scope", effect: "pulse", start: 0, duration: 0.9, amplitude: 0.14, cycles: 2 }] },
  spin: { description: "gira uma volta", steps: [{ target: ":scope", effect: "rotate", start: 0, duration: 1, from: 0, to: 360, easing: "inOutCubic" }] },
  pop: { description: "entra com um pop contido", steps: [{ target: ":scope", effect: "pop", start: 0, duration: 0.5, easing: "outBack" }] },
};
const BY_NAME = [[/bell|alarm|notification|siren/, "ring"], [/refresh|rotate|sync|loader|repeat|orbit/, "spin"], [/heart|star|sparkle|thumbs|award|trophy|party/, "pulse"], [/check|shield|lock|key|badge|circle-check/, "draw"], [/rocket|zap|bolt|flame/, "pop"]];
export const presetFor = (iconName) => BY_NAME.find(([re]) => re.test(iconName))?.[1] ?? "draw";

export function createAnimatedIconProvider({ lucide, fetchCatalog = null }) {
  const license = { code: "MIT (animateicons)", assets: "ISC (Lucide shapes) + MOTION presets (Apache-2.0)", spdx: "ISC", attribution: "Icon shapes: Lucide (ISC). Motion presets: MOTION Studio. Catalog reference: AnimateIcons (MIT)." };
  return {
    id: "animateicons", name: "AnimateIcons (adapter: Lucide shapes + deterministic presets)", kinds: ["animated-icon"],
    capabilities: { offline: true, animated: true, deterministicAnimation: true, customizable: true, cache: Boolean(fetchCatalog), renderers: ["frames", "web", "static"] },
    license,
    async status() { return { state: "limited", reason: "componentes React/motion em tempo real não são seekable; usa formas Lucide + presets determinísticos próprios" }; },
    async search(intent, { limit = 8 } = {}) {
      const tokens = tokenize(intent.replace(/\b(animad[oa]s?|animation|animated|anima[çc][aã]o)\b/gi, " ")), concepts = matchConcepts(intent).map((c) => ({ ...c, termTokens: new Set(c.terms.flatMap((t) => tokenize(t))) }));
      let catalog = null; if (fetchCatalog) { try { catalog = await fetchCatalog(); } catch {} }
      return scorePack(lucide, tokens, concepts, normalize(intent).trim()).map((c) => {
        const inCatalog = catalog ? catalog.has(`lu-${c.name}`) || catalog.has(c.name) : null;
        return { id: `animateicons:${c.name}`, kind: "animated-icon", score: c.score + (inCatalog ? 2 : 0), reasons: [...c.reasons, `preset ${presetFor(c.name)}`, ...(inCatalog ? ["presente no catálogo AnimateIcons"] : [])], style: { kind: "stroke", strokeWidth: lucide.style.strokeWidth }, license, meta: { name: c.name, preset: presetFor(c.name), inCatalog } };
      }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
    },
    async resolve(candidate, { size = 48, strokeWidth, color, idPrefix, title, preset } = {}) {
      const name = candidate.meta.name, p = preset ?? candidate.meta.preset;
      const svg = renderIcon(lucide, name, { size, strokeWidth, color, idPrefix, title });
      const prov = iconProvenance(lucide, name);
      return { id: candidate.id, kind: "animated-icon", svg, motion: { preset: p, ...MOTION_PRESETS[p] }, width: size, height: size, sha256: prov.sha256, license,
        provenance: { ...prov, kind: "animated-icon", id: candidate.id, note: "forma Lucide + preset determinístico MOTION; componentes AnimateIcons não redistribuídos", catalog: candidate.meta.inCatalog } };
    },
  };
}
