import { createHash } from "node:crypto";
import { lstat, mkdir, readdir, readFile, readlink, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export class BootstrapError extends Error {
  constructor(code, message, hint) {
    super(message);
    this.code = code;
    this.hint = hint;
  }
}

export async function exists(p) {
  try {
    await lstat(p);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(p, label = p) {
  let raw;
  try {
    raw = await readFile(p, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new BootstrapError("INVALID_JSON", `${label} não é um JSON válido.`, `Corrija ${label} manualmente; o instalador não sobrescreve arquivos que ele não consegue interpretar.`);
  }
}

export async function writeJsonAtomic(p, data) {
  await mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}`;
  await writeFile(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  await rename(tmp, p);
}

/** sha256 over relative paths + file bytes (symlinks hash their target string). */
export async function treeHash(dir) {
  const hash = createHash("sha256");
  async function walk(current, rel) {
    const entries = (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isSymbolicLink()) {
        hash.update(`L:${r}:${await readlink(full)}\0`);
      } else if (ent.isDirectory()) {
        hash.update(`D:${r}\0`);
        await walk(full, r);
      } else if (ent.isFile()) {
        hash.update(`F:${r}\0`);
        hash.update(await readFile(full));
        hash.update("\0");
      }
    }
  }
  await walk(dir, "");
  return hash.digest("hex");
}

export async function fileSha256(p) {
  return createHash("sha256").update(await readFile(p)).digest("hex");
}

/** Minimal semver compare (x.y.z[-pre.release]). Returns -1, 0, 1. */
export function compareVersions(a, b) {
  const [am, ap] = String(a).split(/-(.+)/);
  const [bm, bp] = String(b).split(/-(.+)/);
  const an = am.split(".").map(Number);
  const bn = bm.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((an[i] || 0) !== (bn[i] || 0)) return (an[i] || 0) < (bn[i] || 0) ? -1 : 1;
  }
  if (!ap && !bp) return 0;
  if (!ap) return 1;
  if (!bp) return -1;
  const aa = ap.split(".");
  const bb = bp.split(".");
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
    if (aa[i] === undefined) return -1;
    if (bb[i] === undefined) return 1;
    const x = /^\d+$/.test(aa[i]) ? Number(aa[i]) : aa[i];
    const y = /^\d+$/.test(bb[i]) ? Number(bb[i]) : bb[i];
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "string") return -1;
    if (typeof x === "string" && typeof y === "number") return 1;
    return x < y ? -1 : 1;
  }
  return 0;
}
