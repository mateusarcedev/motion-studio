/**
 * Visual Asset Provider contract.
 *
 * A provider is a plain object. Adding a library = writing one of these and registering it;
 * the resolver/registry core never changes.
 *
 *   {
 *     id: "my-lib", name: "My Lib",
 *     kinds: ["icon" | "animated-icon" | "logo" | "illustration" | "character" | "lottie"],
 *     capabilities: { search, resolve, offline, animated, deterministicAnimation, customizable, cache,
 *                     renderers: ["static","frames","web"] },
 *     license: { code: "MIT", assets: "…", note?: "…" },     // code license ≠ asset license
 *     async status(ctx)  -> { state: "ready"|"opt-in"|"limited"|"unavailable", reason? },
 *     async search(intent, ctx) -> Candidate[]               // ctx: { kinds, limit, tokens, concepts, … }
 *     async resolve(candidate, options) -> ResolvedAsset
 *   }
 *
 * Candidate:      { id, provider, kind, score, reasons[], style?, license, meta? }
 * ResolvedAsset:  { id, kind, svg?, lottie?, motion?, provenance, license, sha256, width?, height? }
 */
import { ERROR_CODES, MotionError } from "../../lib/errors.mjs";

export const ASSET_KINDS = Object.freeze(["icon", "animated-icon", "logo", "illustration", "character", "lottie"]);
export const READY = "ready";

export function defineProvider(def) {
  const fail = (m) => { throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, `Provider inválido (${def?.id ?? "?"}): ${m}`); };
  if (!def || typeof def !== "object") fail("não é um objeto");
  if (!/^[a-z0-9-]+$/.test(def.id ?? "")) fail("id deve ser kebab-case");
  if (!Array.isArray(def.kinds) || !def.kinds.length || def.kinds.some((k) => !ASSET_KINDS.includes(k))) fail(`kinds deve usar ${ASSET_KINDS.join("|")}`);
  if (typeof def.search !== "function" || typeof def.resolve !== "function") fail("search() e resolve() são obrigatórios");
  if (!def.license?.code) fail("license.code é obrigatório (e license.assets quando difere)");
  const caps = { search: true, resolve: true, offline: false, animated: false, deterministicAnimation: false, customizable: false, cache: false, renderers: ["static", "frames", "web"], ...def.capabilities };
  return Object.freeze({ name: def.id, status: async () => ({ state: READY }), ...def, capabilities: caps });
}
