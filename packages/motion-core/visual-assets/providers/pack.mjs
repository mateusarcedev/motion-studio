/**
 * Generic offline pack provider (icons, logos, characters, illustrations) on top of the existing
 * scoring in resolver.mjs. Specializations:
 *   - logos: ALIAS-ONLY matching (a brand mark is returned only when the technology is named),
 *            with context guards for names that are also common words ("Next", "Go", "React"…).
 *   - characters/illustrations: tag + pose scoring; only when the need is classified as such.
 */
import { iconProvenance, renderIcon } from "../../icons/icon-library.mjs";
import { matchConcepts, normalize, scorePack, tokenize } from "../resolver.mjs";

const LOGO_SYNONYMS = { postgres: "postgresql", postgre: "postgresql", ts: "typescript", k8s: "kubernetes", mongo: "mongodb", node: "nodejs", next: "nextjs", vue: "vuejs", golang: "go", tailwind: "tailwindcss", "c++": "cplusplus", "c#": "csharp", gha: "githubactions", mui: "materialui" };
const AMBIGUOUS = new Set(["next", "nextjs", "go", "swift", "arc", "ava", "bun", "ember", "mocha", "flask", "react", "cypress", "express", "spring", "unity", "atom", "notion", "slack", "linear", "figma", "meta", "stripe", "ruby", "rust", "dart", "chrome", "sketch", "vite"]);
const CONTEXT = /\b(tecnologia|tecnologias|linguagem|linguagens|framework|biblioteca|stack|logo|logotipo|ferramenta|ferramentas|plataforma|banco de dados|developer|desenvolvedor|desenvolvimento|programacao|language|library|tool|platform|database|tech|technology|devops)\b/;
const squash = (s) => normalize(s).replace(/[^a-z0-9+#]/g, "");

function logoKeys(name, icon) {
  return new Set([squash(name), ...(icon.aliases ?? []).map(squash), squash(name.replace(/-js$/, "")), squash(name.replace(/-js$/, "") + "js")].filter(Boolean));
}

/** A name that is also a common word only counts when written capitalized mid-sentence ("usar React") — or with explicit tech context. */
function capitalizedInText(intent, key) {
  const words = intent.trim().split(/\s+/);
  return words.some((w, i) => (i > 0 || words.length === 1) && /^[A-Z]/.test(w) && (squash(w) === key || LOGO_SYNONYMS[normalize(w)] === key));
}

/** Returns the set of squashed n-grams (1–3 tokens) present in the intent. */
function ngrams(intent) {
  const raw = normalize(intent).replace(/[^a-z0-9+#.\s-]/g, " ").split(/\s+/).filter(Boolean);
  const out = new Set();
  for (let i = 0; i < raw.length; i++) for (let n = 1; n <= 3 && i + n <= raw.length; n++) {
    const g = squash(raw.slice(i, i + n).join(""));
    if (g) out.add(g);
    if (n === 1 && LOGO_SYNONYMS[raw[i]]) out.add(LOGO_SYNONYMS[raw[i]]);
  }
  return out;
}

export function createPackProvider({ pack, id = pack.prefix, kind = pack.kind ?? "icon", name = pack.name, capabilities = {}, deterministicAnimation = false }) {
  const isLogo = kind === "logo";
  const isChar = kind === "character" || kind === "illustration";
  const license = { code: pack.license.scope === "code" ? pack.license.spdx : pack.license.spdx, assets: pack.license.scope === "code" ? "per-asset (see assetsNote)" : pack.license.spdx, ...pack.license };
  return {
    id, name, kinds: [kind],
    capabilities: { offline: true, customizable: !isLogo, cache: false, ...capabilities },
    license,
    pack,
    async status() { return { state: "ready", reason: `${Object.keys(pack.icons).length} assets offline` }; },
    async search(intent, { limit = 8 } = {}) {
      if (isLogo) {
        const grams = ngrams(intent), norm = normalize(intent), hasContext = CONTEXT.test(norm);
        const found = [];
        for (const [n, icon] of Object.entries(pack.icons)) {
          const key = [...logoKeys(n, icon)].find((k) => grams.has(k));
          if (!key) continue;
          if ((AMBIGUOUS.has(key) || key.length <= 2) && !hasContext && !capitalizedInText(intent, key)) continue;
          // light/dark/wordmark variants rank below the plain mark
          const variantPenalty = /-(light|dark|wordmark|text|logo)$/.test(n) ? 3 : 0;
          found.push({ id: `${pack.prefix}:${n}`, kind, score: 30 - variantPenalty, reasons: [`tecnologia citada: "${key}"`], style: { kind: "color" }, license, meta: { pack: pack.prefix, name: n } });
        }
        return found.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
      }
      const tokens = tokenize(intent), concepts = matchConcepts(intent).map((c) => ({ ...c, termTokens: new Set(c.terms.flatMap((t) => tokenize(t))) }));
      if (isChar) {
        const q = new Set([...tokens, ...concepts.flatMap((c) => [...c.termTokens])]);
        const wantsSitting = /\b(sentad|sit|seated|laptop|notebook|computador|trabalh|work|escritorio|office|estud|study)/.test(normalize(intent));
        const wantsStanding = /\b(em pe|standing|apresent|present|caminh|walk|lider|lead|pitch|palestr)/.test(normalize(intent));
        return Object.entries(pack.icons).map(([n, icon]) => {
          let score = 8; const reasons = ["ilustração de pessoa adequada ao pedido"];
          for (const t of icon.tags ?? []) if (q.has(...[tokenize(t)[0] ?? t])) { score += 1.5; }
          if (wantsSitting && icon.pose === "sitting") { score += 4; reasons.push("pose sentada combina com trabalho/estudo"); }
          if (wantsStanding && icon.pose === "standing") { score += 4; reasons.push("pose em pé combina com apresentação/liderança"); }
          return { id: `${pack.prefix}:${n}`, kind, score: Math.round(score * 100) / 100, reasons, style: { kind: "illustration" }, license, meta: { pack: pack.prefix, name: n, pose: icon.pose } };
        }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
      }
      return scorePack(pack, tokens, concepts, normalize(intent).trim())
        .map((c) => ({ id: c.id, kind, score: c.score, reasons: c.reasons, style: { kind: pack.style.kind, strokeWidth: pack.style.strokeWidth }, license, meta: { pack: pack.prefix, name: c.name } }))
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
    },
    async resolve(candidate, { size = 48, strokeWidth, color, idPrefix, title } = {}) {
      const n = candidate.meta?.name ?? candidate.id.split(":")[1];
      const svg = renderIcon(pack, n, { size, strokeWidth, color, idPrefix, title });
      return { id: candidate.id, kind, svg, width: pack.icons[n].width, height: pack.icons[n].height, provenance: iconProvenance(pack, n), license, sha256: pack.icons[n].sha ?? null, pack: pack.name };
    },
  };
}
