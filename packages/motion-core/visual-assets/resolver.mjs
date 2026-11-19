/**
 * MOTION Core — visual-assets/resolver.mjs
 * Visual Asset Intelligence: turns a visual intent ("segurança dos dados") into the best icon,
 * with ranked alternatives, confidence, style harmonization, fallback and provenance.
 *
 * Ranking blends: curated concept lexicon (PT/EN) + icon name + icon tags (IDF-weighted).
 * It is dependency-free and offline. A semantic backend can be plugged in via `rerank`
 * (async (query, candidates) => candidates) without changing callers.
 */
import { ERROR_CODES, MotionError } from "../lib/errors.mjs";
import { iconProvenance, loadIconPacks, renderIcon } from "../icons/icon-library.mjs";
import { LEXICON } from "./lexicon.mjs";
import { fallbackGlyph } from "../svg/shapes.mjs";

const STOP = new Set(("a o as os um uma uns umas de do da dos das em no na nos nas por para com sem sobre entre e ou que como mais menos muito muita ao aos à às pelo pela " +
  "the an of to in on for with without and or about between more less very is are icon icone ícone imagem simbolo símbolo representando representa ilustrando").split(/\s+/));

export const normalize = (text) => String(text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const stem = (w) => (w.length > 4 && w.endsWith("es") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);
export function tokenize(text) {
  return normalize(text).split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w)).map(stem);
}

// ---- lexicon index (normalized once) ----
const LEX = LEXICON.map((c) => ({
  ...c,
  phrases: c.terms.map((t) => normalize(t)),
  termTokens: new Set(c.terms.flatMap((t) => tokenize(t))),
}));

/** Finds concepts that match a query: phrase containment (strong) or shared token (weaker). */
export function matchConcepts(query) {
  const q = ` ${normalize(query).replace(/[^a-z0-9]+/g, " ").trim()} `;
  const tokens = new Set(tokenize(query));
  const out = [];
  for (const c of LEX) {
    let weight = 0;
    for (const p of c.phrases) {
      const pp = ` ${p.replace(/[^a-z0-9]+/g, " ").trim()} `;
      const at = q.indexOf(pp);
      // head-first: in PT/EN the main subject usually leads ("crescimento das vendas"), so earlier matches weigh more
      if (at >= 0) weight = Math.max(weight, (pp.trim().includes(" ") ? 1.2 : 1) * (1 - 0.3 * (at / q.length)));
    }
    if (!weight) {
      for (const t of tokens) if (c.termTokens.has(t) && t.length > 2) { weight = Math.max(weight, 0.55); break; }
    }
    if (weight) out.push({ id: c.id, weight, icons: c.icons, terms: c.terms });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

const indexCache = new WeakMap();
function indexPack(pack) {
  if (indexCache.has(pack)) return indexCache.get(pack);
  const entries = [], df = new Map();
  for (const [name, icon] of Object.entries(pack.icons)) {
    const nameTokens = name.split("-").map(stem);
    const tagTokens = [...new Set((icon.tags ?? []).flatMap((t) => tokenize(t)))];
    for (const t of new Set([...nameTokens, ...tagTokens])) df.set(t, (df.get(t) ?? 0) + 1);
    entries.push({ name, nameTokens, tagTokens });
  }
  const idx = { entries, df, n: entries.length };
  indexCache.set(pack, idx);
  return idx;
}

function scorePack(pack, tokens, concepts, queryNorm) {
  const { entries, df, n } = indexPack(pack);
  const idf = (t) => Math.log(1 + n / (1 + (df.get(t) ?? 0))) / Math.log(1 + n);
  const expanded = new Map(); // token -> weight, from the concept terms (EN tags match here)
  for (const c of concepts) for (const t of c.termTokens ?? []) expanded.set(t, Math.max(expanded.get(t) ?? 0, 0.5 * c.weight));
  const curated = new Map();
  for (const c of concepts) c.icons.forEach((icon, i) => curated.set(icon, Math.max(curated.get(icon) ?? 0, c.weight * (14 - i * 1.6)))); // index 0 → 14

  const out = [];
  for (const e of entries) {
    let score = 0; const reasons = [];
    const cur = curated.get(e.name);
    if (cur) { score += cur; reasons.push(`conceito curado (+${cur.toFixed(1)})`); }
    if (queryNorm.replace(/[^a-z0-9]+/g, "-") === e.name) { score += 12; reasons.push("nome idêntico (+12)"); }
    for (const t of tokens) {
      if (e.nameTokens.includes(t)) { const s = 5 * (0.5 + idf(t)); score += s; reasons.push(`nome contém "${t}" (+${s.toFixed(1)})`); }
      else if (e.tagTokens.includes(t)) { const s = 3 * (0.5 + idf(t)); score += s; reasons.push(`tag "${t}" (+${s.toFixed(1)})`); }
    }
    for (const [t, w] of expanded) {
      if (tokens.includes(t)) continue;
      if (e.tagTokens.includes(t) || e.nameTokens.includes(t)) { const s = 2 * w * (0.5 + idf(t)); score += s; reasons.push(`sinônimo "${t}" (+${s.toFixed(1)})`); }
    }
    if (score > 0) out.push({ pack: pack.prefix, name: e.name, id: `${pack.prefix}:${e.name}`, score: Math.round(score * 100) / 100, reasons });
  }
  return out;
}

const confidenceOf = (score) => (score >= 12 ? "high" : score >= 6 ? "medium" : score > 0 ? "low" : "none");

/**
 * Ranks icons for an intent.
 * @param {string} query natural language ("segurança dos dados")
 * @param {{packs: object[], limit?: number, avoid?: Set<string>, rerank?: Function}} options
 */
export async function searchIcons(query, { packs, limit = 6, avoid = new Set(), rerank } = {}) {
  if (!packs?.length) throw new MotionError(ERROR_CODES.ICON_NOT_FOUND, "Nenhum pacote de ícones disponível.");
  const tokens = tokenize(query);
  const concepts = matchConcepts(query).map((c) => ({ ...c, termTokens: new Set(c.terms.flatMap((t) => tokenize(t))) }));
  const queryNorm = normalize(query).trim();
  let candidates = packs.flatMap((p) => scorePack(p, tokens, concepts, queryNorm)).filter((c) => !avoid.has(c.id));
  candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  candidates = candidates.slice(0, Math.max(limit * 3, 12));
  if (rerank) candidates = await rerank(query, candidates);
  candidates = candidates.slice(0, limit);
  return { query, tokens, concepts: concepts.map((c) => ({ id: c.id, weight: c.weight })), candidates, confidence: confidenceOf(candidates[0]?.score ?? 0) };
}

/**
 * A production-wide asset session: locks ONE icon style (pack + stroke width + size + color),
 * avoids using the same icon for different concepts, falls back to a geometric glyph, and
 * records provenance for every asset used.
 */
export async function createAssetSession({ pack: packPrefix = "lucide", size = 48, strokeWidth, color = "currentColor", packs, cwd, rerank, minScore = 4 } = {}) {
  const loaded = packs ? { packs, skipped: [] } : await loadIconPacks({ cwd });
  const primary = loaded.packs.find((p) => p.prefix === packPrefix) ?? loaded.packs[0];
  if (!primary) throw new MotionError(ERROR_CODES.ICON_NOT_FOUND, "Nenhum pacote de ícones disponível.");
  // style lock: only packs with the same drawing kind may be mixed in
  const compatible = loaded.packs.filter((p) => p.style.kind === primary.style.kind);
  const byConcept = new Map(); // normalized intent -> resolved asset (same intent → same icon)
  const usedIds = new Map();   // icon id -> intent that claimed it
  const records = [];
  const style = { pack: primary.prefix, kind: primary.style.kind, size, strokeWidth: strokeWidth ?? primary.style.strokeWidth, color };

  async function icon(intent, overrides = {}) {
    const key = normalize(intent).trim();
    if (byConcept.has(key) && !overrides.size && !overrides.color) return byConcept.get(key);
    const avoid = new Set([...usedIds].filter(([, who]) => who !== key).map(([id]) => id));
    const res = await searchIcons(intent, { packs: compatible, avoid, rerank, limit: 5 });
    const best = res.candidates[0];
    const opts = { size: overrides.size ?? size, strokeWidth: overrides.strokeWidth ?? style.strokeWidth, color: overrides.color ?? color, idPrefix: overrides.idPrefix };
    let asset;
    if (best && best.score >= minScore) {
      const pack = compatible.find((p) => p.prefix === best.pack);
      asset = {
        intent, id: best.id, svg: renderIcon(pack, best.name, { ...opts, title: overrides.title }), fallback: false,
        confidence: res.confidence, score: best.score, reasons: best.reasons.slice(0, 4),
        alternatives: res.candidates.slice(1, 4).map((c) => c.id), provenance: iconProvenance(pack, best.name),
      };
      usedIds.set(best.id, key);
    } else {
      const glyph = fallbackGlyph(intent, { size: opts.size, strokeWidth: opts.strokeWidth, color: opts.color });
      asset = {
        intent, id: `motion:glyph-${glyph.motif}`, svg: glyph.svg, fallback: true, confidence: "none", score: 0,
        reasons: ["nenhum ícone suficientemente relevante; usado glifo geométrico neutro"], alternatives: res.candidates.map((c) => c.id),
        provenance: { kind: "icon", id: `motion:glyph-${glyph.motif}`, pack: "MOTION generated", license: "Apache-2.0", attributionRequired: false, modified: "generated" },
      };
    }
    byConcept.set(key, asset);
    records.push(asset);
    return asset;
  }

  return {
    style,
    icon,
    /** Resolves a list of intents, guaranteeing distinct icons. */
    async assign(intents) { const out = []; for (const i of intents) out.push(await icon(i)); return out; },
    /** Provenance for credits / assets.manifest.json (unique). */
    manifest() {
      const seen = new Map();
      for (const r of records) seen.set(r.provenance.id, r.provenance);
      return { style, assets: [...seen.values()] };
    },
    report() {
      const fallbacks = records.filter((r) => r.fallback).map((r) => r.intent);
      const low = records.filter((r) => !r.fallback && r.confidence === "low").map((r) => r.intent);
      const status = fallbacks.length ? "WARN" : low.length ? "WARN" : "PASS";
      return { status, resolved: records.length, unique: new Set(records.map((r) => r.id)).size, fallbacks, lowConfidence: low, skippedPacks: loaded.skipped };
    },
  };
}
