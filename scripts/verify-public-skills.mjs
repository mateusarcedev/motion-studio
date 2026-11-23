import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { treeHash } from "../packages/motion-cli/lib/bootstrap/util.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = path.join(root, "packages", "motion-skills");
const pkg = JSON.parse(await readFile(path.join(packageDir, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(packageDir, "public-skills.json"), "utf8"));

assert.equal(pkg.name, "@technomanceer/motion-studio-skills");
assert.equal(pkg.version, "1.1.1");
assert.equal(manifest.package.name, pkg.name);
assert.equal(manifest.package.version, pkg.version);
assert.equal(manifest.integrity.algorithm, "sha256");

const packageSkillDirs = pkg.files
  .filter((entry) => entry.startsWith("skills/") && entry.endsWith("/**"))
  .map((entry) => entry.slice("skills/".length, -"/**".length))
  .sort();
const manifestNames = manifest.skills.map((skill) => skill.name).sort();
assert.deepEqual(packageSkillDirs, manifestNames, "npm files allowlist must match the public manifest exactly");
assert.equal(new Set(manifestNames).size, manifestNames.length, "public Skill names must be unique");

for (const skill of manifest.skills) {
  assert.ok(skill.name && skill.path && skill.version, `missing identity/version for ${skill.name}`);
  assert.ok(skill.source?.repository && skill.source?.path && skill.source?.revision, `missing source for ${skill.name}`);
  assert.ok(skill.license?.spdx && skill.license?.file, `missing license for ${skill.name}`);
  assert.ok(skill.attribution, `missing attribution for ${skill.name}`);
  const skillPath = path.join(packageDir, skill.path);
  const bytes = await readFile(skillPath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  assert.equal(digest, skill.sha256, `stale SHA-256 in public-skills.json for ${skill.name}`);
  if (skill.treeSha256 !== undefined) assert.equal(await treeHash(path.dirname(skillPath)), skill.treeSha256, `stale treeSha256 for ${skill.name}`);
  await readFile(path.join(packageDir, skill.license.file));
  assert.ok(skill.version.endsWith(skill.sha256.slice(0, 12)), `version must identify the content snapshot for ${skill.name}`);
}

console.log(`Verified ${manifest.skills.length} public Skills, source records, license files, and content hashes.`);
