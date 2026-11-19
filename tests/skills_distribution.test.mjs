import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installSkills, listLocalSkills, listSkills } from "../packages/motion-skills/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(root, "packages", "motion-skills");

test("public Skills manifest identifies exactly the installable catalog", async () => {
  const manifest = JSON.parse(await readFile(path.join(skillsRoot, "public-skills.json"), "utf8"));
  const publicSkills = await listSkills();
  const localSkills = await listLocalSkills();

  assert.equal(manifest.package.version, "1.0.0");
  assert.equal(publicSkills.length, manifest.skills.length);
  assert.equal(localSkills.length, 51, "the complete local catalog remains intact");
  assert.deepEqual(publicSkills.map(({ name }) => name).sort(), manifest.skills.map(({ name }) => name).sort());

  for (const skill of manifest.skills) {
    const bytes = await readFile(path.join(skillsRoot, skill.path));
    const digest = createHash("sha256").update(bytes).digest("hex");
    assert.equal(digest, skill.sha256, `snapshot hash mismatch for ${skill.name}`);
    assert.ok(skill.source.repository && skill.license.spdx && skill.attribution);
  }
});

test("installer copies only Skills authorized by the public manifest", async () => {
  const targetDir = await mkdtemp(path.join(os.tmpdir(), "motion-public-skills-"));
  try {
    const result = await installSkills({ targetDir, profile: "all", agents: ["agents"] });
    const installed = await readdir(path.join(targetDir, ".agents", "skills"));
    assert.equal(installed.length, 11);
    assert.deepEqual(installed.sort(), result.installed.slice().sort());
    assert.ok(!installed.some((name) => name.startsWith("remotion-")));
    assert.ok(!installed.includes("ui-styling"));
  } finally {
    await rm(targetDir, { recursive: true, force: true });
  }
});
