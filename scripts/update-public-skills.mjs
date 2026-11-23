/**
 * Regenerates content hashes in public-skills.json. Nothing else in the manifest is touched.
 * Usage: node scripts/update-public-skills.mjs [--check] [skill ...]   (default: every public Skill)
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { treeHash } from "../packages/motion-cli/lib/bootstrap/util.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "packages", "motion-skills");
const file = path.join(dir, "public-skills.json");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const only = args.filter((a) => a !== "--check");
const manifest = JSON.parse(await readFile(file, "utf8"));
const stale = [];
for (const s of manifest.skills) {
  if (only.length && !only.includes(s.name)) continue;
  const sha = createHash("sha256").update(await readFile(path.join(dir, s.path))).digest("hex");
  const tree = s.treeSha256 === undefined ? undefined : await treeHash(path.dirname(path.join(dir, s.path)));
  if (sha === s.sha256 && tree === s.treeSha256) continue;
  stale.push(s.name);
  s.sha256 = sha;
  s.version = `snapshot-${sha.slice(0, 12)}`;
  if (tree !== undefined) s.treeSha256 = tree;
}
if (stale.length && !checkOnly) await writeFile(file, JSON.stringify(manifest, null, 2) + "\n");
console.log(stale.length ? `${checkOnly ? "Stale" : "Updated"}: ${stale.join(", ")}` : "All hashes are current.");
process.exitCode = checkOnly && stale.length ? 1 : 0;
