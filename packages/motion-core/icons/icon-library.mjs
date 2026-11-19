/**
 * MOTION Core — icons/icon-library.mjs
 * Icon Library Manager: offline-first icon packs with search, rendering and provenance.
 *
 * Packs use an Iconify-compatible shape ({ prefix, icons: { name: { body, tags? } }, width?, height? })
 * extended with `license` and `style` metadata. Bundled: Lucide (ISC). Extra packs are discovered from
 *   - $MOTION_ICON_PACKS (path-delimited list of dirs/files)
 *   - ./.motion/icon-packs/*.json
 * so Tabler/Phosphor/any Iconify JSON can be dropped in without code changes. Nothing is downloaded unless
 * a `fetchIcon` function is explicitly supplied (Iconify API adapter provided, cached on disk).
 *
 * Brand marks (logos) are never modified or synthesized here: they must come from user-approved assets.
 */
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ERROR_CODES, MotionError } from "../lib/errors.mjs";
import { validateSvg } from "../svg/svg-tools.mjs";

const ASSETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/icons");
const packCache = new Map();

const KNOWN_LICENSES = {
  ISC: { openSource: true, attributionRequired: false, noticeMustBePreserved: true },
  MIT: { openSource: true, attributionRequired: false, noticeMustBePreserved: true },
  "Apache-2.0": { openSource: true, attributionRequired: false, noticeMustBePreserved: true },
  "CC0-1.0": { openSource: true, attributionRequired: false, noticeMustBePreserved: false },
  "CC-BY-4.0": { openSource: true, attributionRequired: true, noticeMustBePreserved: true },
};

function normalizePack(raw, source) {
  if (!raw || typeof raw !== "object" || !raw.icons || typeof raw.icons !== "object") {
    throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, `Pacote de ícones inválido: ${source}`);
  }
  const prefix = String(raw.prefix ?? path.basename(source).replace(/\.json$/, "").replace(/\.pack$/, ""));
  const width = raw.width ?? raw.style?.width ?? 24;
  const height = raw.height ?? raw.style?.height ?? 24;
  const license = raw.license ?? raw.info?.license ?? { spdx: "UNKNOWN" };
  const spdx = license.spdx ?? license.title ?? "UNKNOWN";
  const icons = {};
  for (const [name, icon] of Object.entries(raw.icons)) {
    if (!icon?.body) continue;
    icons[name] = { body: icon.body, tags: icon.tags ?? [], aliases: icon.aliases ?? [], pose: icon.pose, sha: icon.sha, width: icon.width ?? width, height: icon.height ?? height };
  }
  for (const [alias, def] of Object.entries(raw.aliases ?? {})) {
    const base = icons[def.parent];
    if (base && !icons[alias]) icons[alias] = { ...base, tags: [...base.tags] };
  }
  const kind = raw.kind ?? "icon";
  const style = { kind: raw.style?.kind ?? "stroke", strokeWidth: raw.style?.strokeWidth ?? 2, linecap: raw.style?.linecap ?? "round", linejoin: raw.style?.linejoin ?? "round" };
  return {
    prefix, kind, name: raw.name ?? prefix, version: raw.version ?? null, homepage: raw.homepage ?? raw.info?.url ?? null,
    license: { ...(KNOWN_LICENSES[spdx] ?? { openSource: null, attributionRequired: null }), ...license, spdx },
    style, width, height, icons, source,
  };
}

export async function loadPackFile(file) {
  const abs = path.resolve(file);
  if (packCache.has(abs)) return packCache.get(abs);
  const pack = normalizePack(JSON.parse(await readFile(abs, "utf8")), abs);
  packCache.set(abs, pack);
  return pack;
}

async function packFilesIn(dir) {
  try {
    const st = await readdir(dir, { withFileTypes: true });
    return st.filter((e) => e.isFile() && e.name.endsWith(".json")).map((e) => path.join(dir, e.name));
  } catch { return []; }
}

/** Lists/loads all available packs (bundled + user-provided). Invalid user packs are skipped and reported. */
export async function loadIconPacks({ cwd = process.cwd(), env = process.env, extra = [] } = {}) {
  const files = new Set((await packFilesIn(ASSETS)).filter((f) => f.endsWith(".pack.json")));
  for (const entry of (env.MOTION_ICON_PACKS ?? "").split(path.delimiter).filter(Boolean)) {
    if (entry.endsWith(".json")) files.add(path.resolve(entry)); else for (const f of await packFilesIn(entry)) files.add(f);
  }
  for (const f of await packFilesIn(path.join(cwd, ".motion", "icon-packs"))) files.add(f);
  for (const f of extra) files.add(path.resolve(f));
  const packs = [], skipped = [];
  for (const file of files) {
    try { packs.push(await loadPackFile(file)); } catch (error) { skipped.push({ file, error: error.message }); }
  }
  packs.sort((a, b) => (a.prefix === "lucide" ? -1 : b.prefix === "lucide" ? 1 : a.prefix.localeCompare(b.prefix)));
  return { packs, skipped };
}

/** Adds a pack object directly (tests, programmatic use). */
export function createPack(raw, source = "memory") { return normalizePack(raw, source); }

/**
 * Renders an icon to a standalone SVG string with consistent size/stroke/color.
 * @param {object} pack
 * @param {string} name
 * @param {{size?: number, strokeWidth?: number, color?: string, title?: string, idPrefix?: string}} [opts]
 */
export function renderIcon(pack, name, { size = 24, strokeWidth, color = "currentColor", title, idPrefix } = {}) {
  const icon = pack.icons[name];
  if (!icon) throw new MotionError(ERROR_CODES.ICON_NOT_FOUND, `Ícone "${pack.prefix}:${name}" não existe.`, { hint: "Use a busca semântica (resolveIcon) em vez de nomes exatos." });
  if (!(size > 0)) throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, "size deve ser positivo.");
  let body = icon.body;
  if (idPrefix) body = body.replace(/\bid="([^"]+)"/g, `id="${idPrefix}__$1"`).replace(/url\(#([^)]+)\)/g, `url(#${idPrefix}__$1)`);
  const sw = strokeWidth ?? pack.style.strokeWidth;
  const t = title ? `<title>${String(title).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]))}</title>` : "";
  const a11y = title ? ' role="img"' : ' aria-hidden="true"';
  // multi-color logos and illustrations keep their own paint; `size` is the larger side (aspect ratio preserved)
  if (pack.style.kind === "color" || pack.style.kind === "illustration") {
    const k = size / Math.max(icon.width, icon.height);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(icon.width * k * 100) / 100}" height="${Math.round(icon.height * k * 100) / 100}" viewBox="0 0 ${icon.width} ${icon.height}"${a11y}>${t}${body}</svg>`;
  }
  const attrs = pack.style.kind === "stroke"
    ? `fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="${pack.style.linecap}" stroke-linejoin="${pack.style.linejoin}"`
    : `fill="${color}"`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${icon.width} ${icon.height}" ${attrs}${a11y}>${t}${body}</svg>`;
  return svg;
}

/** Provenance record for assets.manifest / credits. */
export function iconProvenance(pack, name) {
  return {
    kind: pack.kind ?? "icon", id: `${pack.prefix}:${name}`, pack: pack.name, sha256: pack.icons[name]?.sha ?? null,
    licenseDetail: { spdx: pack.license.spdx, scope: pack.license.scope ?? "assets", attributionRequired: Boolean(pack.license.attributionRequired), attribution: pack.license.attribution ?? null, trademark: Boolean(pack.license.trademark), note: pack.license.assetsNote ?? null }, version: pack.version, homepage: pack.homepage,
    license: pack.license.spdx, licenseUrl: pack.license.url ?? null, attribution: pack.license.attribution ?? null,
    attributionRequired: pack.license.attributionRequired, source: path.relative(process.cwd(), pack.source) || pack.source,
    modified: "recolored/resized via MOTION (geometry unchanged)",
  };
}

/** Optional Iconify API adapter (network). Only used when the caller passes it explicitly. Results are cached on disk. */
export function createIconifyFetcher({ cacheDir = path.join(os.homedir(), ".cache", "motion-studio", "icons"), fetchImpl = globalThis.fetch, baseUrl = "https://api.iconify.design" } = {}) {
  return async function fetchIcon(prefix, name) {
    if (!/^[a-z0-9-]+$/.test(prefix) || !/^[a-z0-9-]+$/.test(name)) throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, "Nome de ícone inválido.");
    const file = path.join(cacheDir, `${prefix}__${name}.json`);
    try { return JSON.parse(await readFile(file, "utf8")); } catch {}
    const res = await fetchImpl(`${baseUrl}/${prefix}.json?icons=${name}`);
    if (!res.ok) throw new MotionError(ERROR_CODES.ICON_NOT_FOUND, `Iconify respondeu HTTP ${res.status} para ${prefix}:${name}.`);
    const data = await res.json();
    const icon = data.icons?.[name];
    if (!icon) throw new MotionError(ERROR_CODES.ICON_NOT_FOUND, `Iconify não tem ${prefix}:${name}.`);
    // never trust remote bodies: sanitize through the SVG allowlist
    const checked = validateSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon.width ?? data.width ?? 24} ${icon.height ?? data.height ?? 24}">${icon.body}</svg>`);
    if (!checked.ok) throw new MotionError(ERROR_CODES.SVG_UNSAFE, `Ícone remoto ${prefix}:${name} rejeitado pela validação.`, { details: checked.findings });
    const body = checked.svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    const result = { prefix, name, width: icon.width ?? data.width ?? 24, height: icon.height ?? data.height ?? 24, body, license: data.info?.license ?? null };
    await mkdir(cacheDir, { recursive: true });
    await writeFile(file, JSON.stringify(result));
    return result;
  };
}
