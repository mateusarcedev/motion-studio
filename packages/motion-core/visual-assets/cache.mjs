/**
 * Content-addressed local asset cache with provenance (version, source, license) and integrity check.
 * Entries are re-hashed on read; a tampered/corrupt entry is treated as a miss and removed.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const keyFile = (key) => `${createHash("sha256").update(key).digest("hex").slice(0, 32)}.json`;

export function createAssetCache({ dir = path.join(os.homedir(), ".cache", "motion-studio", "assets"), ttlMs = 30 * 24 * 3600 * 1000, now = () => Date.now() } = {}) {
  return {
    dir,
    async get(key) {
      const file = path.join(dir, keyFile(key));
      try {
        const entry = JSON.parse(await readFile(file, "utf8"));
        if (entry.key !== key || sha256(entry.body) !== entry.sha256) { await rm(file, { force: true }); return null; }
        if (ttlMs && now() - entry.storedAt > ttlMs) return { ...entry, stale: true };
        return entry;
      } catch { return null; }
    },
    async put(key, body, meta = {}) {
      await mkdir(dir, { recursive: true });
      const entry = { key, body, sha256: sha256(body), storedAt: now(), ...meta };
      await writeFile(path.join(dir, keyFile(key)), JSON.stringify(entry));
      return entry;
    },
    async stats() { try { return { entries: (await readdir(dir)).length }; } catch { return { entries: 0 }; } },
    async clear() { await rm(dir, { recursive: true, force: true }); },
  };
}
