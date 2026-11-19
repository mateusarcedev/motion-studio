/**
 * Iconify provider — unified catalog (200k+ icons across collections), OPT-IN network.
 * Never enabled implicitly: `allowNetwork: true` required. Each collection has its OWN license, read live from
 * Iconify's collection metadata and checked by the license policy (NonCommercial/NoDerivatives/unknown → blocked).
 * Results are cached (content-hashed) so a production stays reproducible offline after the first resolution.
 * Remote SVG bodies pass through the SVG sanitizer before use.
 */
import { ERROR_CODES, MotionError } from "../../lib/errors.mjs";
import { validateSvg } from "../../svg/svg-tools.mjs";
import { createAssetCache } from "../cache.mjs";
import { assessLicense } from "../license-policy.mjs";
import { normalize } from "../resolver.mjs";

const API = "https://api.iconify.design";
const DEFAULT_PREFIXES = ["tabler", "ph", "solar", "mingcute", "iconoir", "carbon"];

export function createIconifyProvider({ allowNetwork = false, fetchImpl = globalThis.fetch, cache = createAssetCache(), prefixes = DEFAULT_PREFIXES, baseUrl = API, timeoutMs = 8000 } = {}) {
  const get = async (url) => {
    const key = `GET ${url}`;
    const hit = await cache.get(key);
    if (hit && !hit.stale) return JSON.parse(hit.body);
    if (!allowNetwork) { if (hit) return JSON.parse(hit.body); throw new MotionError(ERROR_CODES.ICON_NOT_FOUND, "Iconify requer rede e allowNetwork não está ativo."); }
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { signal: ctl.signal });
      if (!res.ok) throw new MotionError(ERROR_CODES.ICON_NOT_FOUND, `Iconify respondeu HTTP ${res.status}`);
      const text = JSON.stringify(await res.json());
      await cache.put(key, text, { source: url, provider: "iconify" });
      return JSON.parse(text);
    } catch (e) { if (hit) return JSON.parse(hit.body); throw e; } finally { clearTimeout(t); }
  };
  const collectionLicense = async (prefix) => {
    const data = await get(`${baseUrl}/collections?prefixes=${prefix}`);
    const info = data[prefix] ?? {};
    return { spdx: info.license?.spdx ?? "UNKNOWN", title: info.license?.title, url: info.license?.url, attribution: info.author?.name ? `${info.name ?? prefix} by ${info.author.name}${info.license?.title ? ` (${info.license.title})` : ""}` : undefined, scope: "assets", attributionRequired: /^CC-BY/.test(info.license?.spdx ?? ""), palette: info.palette, name: info.name ?? prefix };
  };
  return {
    id: "iconify", name: "Iconify (catálogo unificado)", kinds: ["icon"],
    capabilities: { offline: false, customizable: true, cache: true, renderers: ["static", "frames", "web"] },
    license: { code: "MIT (Iconify)", assets: "por coleção (verificada em tempo de execução)" },
    async status() { return allowNetwork ? { state: "ready", reason: `coleções: ${prefixes.join(", ")}` } : { state: "opt-in", reason: "rede desativada por padrão (allowNetwork)" }; },
    async search(intent, { limit = 6 } = {}) {
      const q = normalize(intent).replace(/[^a-z0-9 ]/g, " ").trim().split(/\s+/).slice(0, 4).join(" ");
      const data = await get(`${baseUrl}/search?query=${encodeURIComponent(q)}&limit=${limit * 3}&prefixes=${prefixes.join(",")}`);
      const out = [];
      for (const id of data.icons ?? []) {
        const [prefix, name] = id.split(":");
        const lic = await collectionLicense(prefix);
        out.push({ id: `iconify:${id}`, kind: "icon", score: 10 - out.length * 0.5, reasons: [`busca Iconify "${q}" em ${prefix}`], style: { kind: lic.palette ? "color" : "mono", collection: prefix }, license: lic, meta: { prefix, name } });
      }
      return out.slice(0, limit);
    },
    async resolve(candidate, { size = 48, color = "currentColor" } = {}) {
      const { prefix, name } = candidate.meta;
      const verdict = assessLicense(candidate.license);
      if (!verdict.allowed) throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, `Coleção ${prefix} bloqueada: ${verdict.reason}`);
      const data = await get(`${baseUrl}/${prefix}.json?icons=${name}`);
      const icon = data.icons?.[name];
      if (!icon) throw new MotionError(ERROR_CODES.ICON_NOT_FOUND, `Iconify não tem ${prefix}:${name}.`);
      const w = icon.width ?? data.width ?? 24, h = icon.height ?? data.height ?? 24;
      const checked = validateSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${size}" height="${size}" fill="${color === "currentColor" ? "currentColor" : color}">${icon.body.replaceAll("currentColor", color)}</svg>`, { strict: true }); // remote content is untrusted: unsafe constructs reject the asset instead of being silently stripped
      if (!checked.ok) throw new MotionError(ERROR_CODES.SVG_UNSAFE, `Ícone remoto ${prefix}:${name} rejeitado pela validação.`, { details: checked.findings });
      const { createHash } = await import("node:crypto");
      const sha256 = createHash("sha256").update(checked.svg).digest("hex");
      return { id: candidate.id, kind: "icon", svg: checked.svg, width: w, height: h, sha256, license: candidate.license,
        provenance: { kind: "icon", id: candidate.id, pack: candidate.license.name ?? prefix, version: "iconify-api", sha256, license: candidate.license.spdx, licenseDetail: candidate.license, attributionRequired: Boolean(candidate.license.attributionRequired), attribution: candidate.license.attribution ?? null, source: `${baseUrl}/${prefix}.json`, modified: "recolored/resized via MOTION" } };
    },
  };
}
