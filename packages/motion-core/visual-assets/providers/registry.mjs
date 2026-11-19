/**
 * Provider registry: registration, status, federated search with license policy, resolution.
 */
import { ERROR_CODES, MotionError } from "../../lib/errors.mjs";
import { assessLicense } from "../license-policy.mjs";
import { defineProvider } from "./contract.mjs";

export function createProviderRegistry({ providers = [], commercial = true } = {}) {
  const map = new Map();
  const api = {
    register(def) {
      const p = defineProvider(def);
      if (map.has(p.id)) throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, `Provider já registrado: ${p.id}`);
      map.set(p.id, p);
      return api;
    },
    unregister(id) { map.delete(id); return api; },
    get: (id) => map.get(id) ?? null,
    list: () => [...map.values()],
    /** Provider descriptors + live status (never throws). */
    async describe(ctx = {}) {
      const out = [];
      for (const p of map.values()) {
        let status;
        try { status = await p.status(ctx); } catch (e) { status = { state: "unavailable", reason: e.message }; }
        out.push({ id: p.id, name: p.name, kinds: p.kinds, capabilities: p.capabilities, license: p.license, status });
      }
      return out;
    },
    /**
     * Federated search. Providers that are unavailable are skipped (and reported), never fatal.
     * Candidates whose license is not allowed are removed and listed in `blocked`.
     */
    async search(intent, { kinds, limit = 8, ctx = {} } = {}) {
      const candidates = [], blocked = [], skipped = [];
      for (const p of map.values()) {
        if (kinds && !p.kinds.some((k) => kinds.includes(k))) continue;
        let st;
        try { st = await p.status(ctx); } catch (e) { st = { state: "unavailable", reason: e.message }; }
        if (st.state === "unavailable" || st.state === "opt-in") { skipped.push({ provider: p.id, state: st.state, reason: st.reason ?? null }); continue; }
        let found = [];
        try { found = await p.search(intent, { ...ctx, kinds: kinds ?? p.kinds, limit }); } catch (e) { skipped.push({ provider: p.id, state: "error", reason: e.message }); continue; }
        for (const c of found) {
          if (kinds && !kinds.includes(c.kind)) continue;
          const verdict = assessLicense(c.license ?? p.license, { commercial });
          if (!verdict.allowed) { blocked.push({ id: c.id, provider: p.id, reason: verdict.reason }); continue; }
          candidates.push({ ...c, provider: p.id, licenseVerdict: verdict });
        }
      }
      candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
      return { intent, candidates: candidates.slice(0, limit), blocked, skipped };
    },
    async resolve(candidate, options = {}) {
      const p = map.get(candidate.provider);
      if (!p) throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, `Provider desconhecido: ${candidate.provider}`);
      const asset = await p.resolve(candidate, options);
      return { ...asset, provider: p.id, licenseVerdict: candidate.licenseVerdict ?? assessLicense(asset.license ?? p.license, { commercial }) };
    },
  };
  for (const p of providers) api.register(p);
  return api;
}
