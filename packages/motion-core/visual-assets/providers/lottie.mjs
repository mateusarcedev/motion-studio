/**
 * Lottie / dotLottie provider (local files). Security: Lottie JSON is DATA, but expressions are JavaScript.
 * The bundled runtime is lottie-web "light" (no expression engine); validation additionally rejects
 * expressions and external asset references so nothing executes or loads from the network.
 */
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { ERROR_CODES, MotionError } from "../../lib/errors.mjs";
import { matchConcepts, normalize, tokenize } from "../resolver.mjs";

const MAX_BYTES = 8 * 1024 * 1024;

/** @returns {{ok:boolean, findings:object[], info?:object}} */
export function validateLottie(json) {
  const findings = [];
  const bad = (m, code = ERROR_CODES.SVG_INVALID) => findings.push({ severity: "error", code, message: m });
  if (!json || typeof json !== "object" || Array.isArray(json)) { bad("Lottie inválido: não é um objeto JSON."); return { ok: false, findings }; }
  for (const k of ["fr", "ip", "op", "w", "h"]) if (!Number.isFinite(json[k])) bad(`Lottie inválido: campo "${k}" ausente ou não numérico.`);
  if (!Array.isArray(json.layers)) bad('Lottie inválido: "layers" ausente.');
  if (Number.isFinite(json.fr) && json.fr <= 0) bad("Lottie inválido: fr deve ser > 0.");
  if (Number.isFinite(json.op) && Number.isFinite(json.ip) && json.op <= json.ip) bad("Lottie inválido: op deve ser maior que ip.");
  if (findings.length) return { ok: false, findings };
  // expressions (JS) and external references
  const walk = (node, trail) => {
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${trail}[${i}]`));
    if (!node || typeof node !== "object") return;
    if (typeof node.x === "string" && node.x.trim() && /ks|k\b/.test(trail + Object.keys(node).join())) findings.push({ severity: "error", code: ERROR_CODES.SVG_UNSAFE, message: `Expressão JavaScript bloqueada em ${trail}.x` });
    if (typeof node.u === "string" && node.u && /^(?:[a-z]+:)?\/\//i.test(node.u)) findings.push({ severity: "error", code: ERROR_CODES.SVG_UNSAFE, message: `Asset externo bloqueado: ${node.u}` });
    if (typeof node.p === "string" && /^https?:/i.test(node.p)) findings.push({ severity: "error", code: ERROR_CODES.SVG_UNSAFE, message: `Imagem externa bloqueada: ${node.p}` });
    if (typeof node.p === "string" && /^data:/i.test(node.p) && !/^data:image\/(png|jpe?g|webp|gif|svg\+xml);/i.test(node.p)) findings.push({ severity: "error", code: ERROR_CODES.SVG_UNSAFE, message: "data: URI não permitida em asset Lottie" });
    for (const [k, v] of Object.entries(node)) walk(v, `${trail}.${k}`);
  };
  walk(json, "$");
  const ok = !findings.some((f) => f.severity === "error");
  return { ok, findings, info: { width: json.w, height: json.h, fps: json.fr, inPoint: json.ip, outPoint: json.op, frames: json.op - json.ip, durationSec: (json.op - json.ip) / json.fr, layers: json.layers.length, name: json.nm ?? null } };
}

/** Minimal, bounds-checked ZIP reader for .lottie (dotLottie) files. Only deflate/stored entries. */
export function readDotLottie(buffer) {
  if (buffer.length > MAX_BYTES) throw new MotionError(ERROR_CODES.SVG_INVALID, "Arquivo .lottie grande demais.");
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new MotionError(ERROR_CODES.SVG_INVALID, ".lottie inválido: não é um ZIP.");
  const count = buffer.readUInt16LE(eocd + 10); let off = buffer.readUInt32LE(eocd + 16);
  const files = new Map(); let total = 0;
  for (let n = 0; n < count; n++) {
    if (off + 46 > buffer.length || buffer.readUInt32LE(off) !== 0x02014b50) throw new MotionError(ERROR_CODES.SVG_INVALID, ".lottie corrompido.");
    const method = buffer.readUInt16LE(off + 10), csize = buffer.readUInt32LE(off + 20), usize = buffer.readUInt32LE(off + 24);
    const nlen = buffer.readUInt16LE(off + 28), xlen = buffer.readUInt16LE(off + 30), clen = buffer.readUInt16LE(off + 32), lho = buffer.readUInt32LE(off + 42);
    const name = buffer.subarray(off + 46, off + 46 + nlen).toString("utf8");
    off += 46 + nlen + xlen + clen;
    if (name.includes("..") || name.startsWith("/") || name.endsWith("/")) continue;
    total += usize; if (total > 32 * 1024 * 1024) throw new MotionError(ERROR_CODES.SVG_INVALID, ".lottie descomprime além do limite.");
    const dstart = lho + 30 + buffer.readUInt16LE(lho + 26) + buffer.readUInt16LE(lho + 28);
    const raw = buffer.subarray(dstart, dstart + csize);
    files.set(name, method === 0 ? raw : method === 8 ? inflateRawSync(raw, { maxOutputLength: 32 * 1024 * 1024 }) : null);
  }
  const manifest = files.get("manifest.json") ? JSON.parse(files.get("manifest.json").toString("utf8")) : null;
  const first = manifest?.animations?.[0]?.id;
  const entry = [`animations/${first}.json`, `a/${first}.json`].find((p) => files.get(p)) ?? [...files.keys()].find((k) => /^(animations|a)\/.+\.json$/.test(k));
  if (!entry) throw new MotionError(ERROR_CODES.SVG_INVALID, ".lottie sem animação JSON.");
  return { manifest, animation: JSON.parse(files.get(entry).toString("utf8")), entry };
}

export async function loadLottieFile(file) {
  const buf = await readFile(file);
  if (buf.length > MAX_BYTES) throw new MotionError(ERROR_CODES.SVG_INVALID, "Arquivo Lottie grande demais (> 8 MB).");
  const animation = file.endsWith(".lottie") ? readDotLottie(buf).animation : JSON.parse(buf.toString("utf8"));
  const check = validateLottie(animation);
  return { animation, check, sha256: createHash("sha256").update(buf).digest("hex") };
}

/** Provider for Lottie files in the given directories (+ optional `<name>.license.json` sidecar with spdx/attribution/tags). */
export function createLottieProvider({ dirs = [] } = {}) {
  const scan = async () => {
    const items = [];
    for (const dir of dirs) {
      for (const f of (await readdir(dir).catch(() => [])).filter((n) => /\.(json|lottie)$/i.test(n) && !/\.license\.json$/i.test(n)).sort()) {
        const file = path.join(dir, f), base = f.replace(/\.(json|lottie)$/i, "");
        let side = {}; try { side = JSON.parse(await readFile(path.join(dir, `${base}.license.json`), "utf8")); } catch {}
        items.push({ file, base, side });
      }
    }
    return items;
  };
  const license = { code: "per-file", assets: "per-file (sidecar .license.json)" };
  return {
    id: "lottie", name: "Lottie / dotLottie (local)", kinds: ["lottie"],
    capabilities: { offline: true, animated: true, deterministicAnimation: true, customizable: false, cache: false, renderers: ["frames", "web"] },
    license,
    async status() { const n = (await scan()).length; return n ? { state: "ready", reason: `${n} animações locais` } : { state: "unavailable", reason: "nenhum arquivo Lottie nas pastas configuradas" }; },
    async search(intent, { limit = 8 } = {}) {
      const tokens = tokenize(intent), concepts = matchConcepts(intent);
      const terms = new Set([...tokens, ...concepts.flatMap((c) => c.terms.flatMap((t) => tokenize(t)))]);
      const out = [];
      for (const it of await scan()) {
        const words = new Set([...tokenize(it.base.replace(/[-_]/g, " ")), ...(it.side.tags ?? []).flatMap((t) => tokenize(t))]);
        let score = 0; const reasons = [];
        for (const w of words) if (terms.has(w)) { score += 6; reasons.push(`tag/nome "${w}"`); }
        if (score) out.push({ id: `lottie:${it.base}`, kind: "lottie", score, reasons, style: { kind: "lottie" }, license: { spdx: it.side.spdx ?? "UNKNOWN", attribution: it.side.attribution, attributionRequired: it.side.attributionRequired, grant: it.side.grant, commercialUse: it.side.commercialUse }, meta: { file: it.file } });
      }
      return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
    },
    async resolve(candidate) {
      const { animation, check, sha256 } = await loadLottieFile(candidate.meta.file);
      if (!check.ok) throw new MotionError(check.findings[0].code, check.findings[0].message, { details: check.findings });
      return { id: candidate.id, kind: "lottie", lottie: animation, info: check.info, sha256, width: animation.w, height: animation.h,
        provenance: { kind: "lottie", id: candidate.id, pack: "Lottie (local)", source: path.basename(candidate.meta.file), sha256, license: candidate.license.spdx, licenseDetail: candidate.license, attributionRequired: Boolean(candidate.license.attributionRequired), modified: "none" },
        license: candidate.license };
    },
  };
}
