import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { DOOP_MCP_TOOL_NAMES } from "../packages/motion-core/bridge/adapters/doop.mjs";
import { TOOLS } from "../packages/motion-cli/lib/mcp-tools.mjs";
import { EXTERNAL_INTEGRATIONS, listSkills, resolveSkillsForProfile } from "../packages/motion-skills/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const names = ["design-to-motion", "motion-to-design", "doop-bridge"];
const packageSkills = path.join(root, "packages/motion-skills/skills");

function simulateCoordinator({ doopConnected, discoveredToolNames = [], externalWriteAuthorized = false }) {
  const liveTools = new Set(discoveredToolNames);
  const externalReads = ["get_canvas", "get_frame", "get_prototype"].filter((name) => liveTools.has(name));
  const externalWrites = ["create_frame", "set_frame_html", "append_frame_html", "edit_frame_html", "upload_asset"]
    .filter((name) => liveTools.has(name));
  return {
    motionAvailable: TOOLS.some((tool) => tool.name === "bridge_normalize_design"),
    doopAvailable: Boolean(doopConnected && liveTools.size),
    externalReads: doopConnected ? externalReads : [],
    externalWrites: doopConnected && externalWriteAuthorized ? externalWrites : [],
    executed: false,
  };
}

test("M5 Skills are public, licensed, mirrored for local agents, and locked by content hash", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "packages/motion-skills/public-skills.json"), "utf8"));
  const lock = JSON.parse(await readFile(path.join(root, "skills-lock.json"), "utf8"));
  const publicSkills = await listSkills();
  assert.equal(manifest.skills.length, 17);
  for (const name of names) {
    const entry = manifest.skills.find((skill) => skill.name === name);
    assert.ok(entry, `${name} is missing from public-skills.json`);
    assert.equal(entry.source.type, "first-party");
    assert.equal(entry.license.spdx, "Apache-2.0");
    assert.ok(publicSkills.some((skill) => skill.name === name));
    const canonical = await readFile(path.join(packageSkills, name, "SKILL.md"));
    const mirror = await readFile(path.join(root, ".agents/skills", name, "SKILL.md"));
    assert.deepEqual(mirror, canonical, `${name} local agent mirror differs from package catalog`);
    assert.equal(lock.skills[name]?.computedHash, entry.sha256, `${name} lock hash differs from public manifest`);
    assert.match(canonical.toString("utf8"), new RegExp(`^---\\nname: ${name}\\n`));
  }
});

test("M5 selective profiles install the requested public integration Skills", async () => {
  const expected = {
    "design-to-motion": ["design-to-motion"],
    "motion-to-design": ["motion-to-design"],
    "doop-bridge": names,
    integration: names,
  };
  for (const [profile, required] of Object.entries(expected)) {
    const resolved = resolveSkillsForProfile(profile);
    for (const skill of required) assert.ok(resolved.includes(skill), `${profile} omits ${skill}`);
  }
  assert.equal(EXTERNAL_INTEGRATIONS["doop-mcp"].kind, "mcp-server");
  assert.equal(EXTERNAL_INTEGRATIONS["doop-mcp"].installCommand, undefined);

  const targetDir = await mkdtemp(path.join(os.tmpdir(), "motion-m5-profile-"));
  try {
    const cli = path.join(root, "packages/motion-cli/bin/motion.mjs");
    const result = spawnSync(process.execPath, [cli, "init", "--profile=integration", "--skip-install", "--agents=codex", "--json"], {
      cwd: targetDir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).ok, true);
    const installed = await readdir(path.join(targetDir, ".agents/skills"));
    assert.deepEqual(installed.sort(), ["design-to-motion", "doop-bridge", "motion-director", "motion-to-design", "studio-director", "web-director"]);
    for (const skill of names) assert.ok(installed.includes(skill), `integration profile did not install ${skill}`);
  } finally {
    await rm(targetDir, { recursive: true, force: true });
  }
});

test("Doop bridge simulation uses only discovered verified tools and keeps Motion available offline", async () => {
  const fixture = JSON.parse(await readFile(path.join(root, "tests/fixtures/doop-mcp-verified-tools.json"), "utf8"));
  assert.deepEqual(fixture.tools.slice().sort(), Object.values(DOOP_MCP_TOOL_NAMES).sort());
  const skill = await readFile(path.join(packageSkills, "doop-bridge/SKILL.md"), "utf8");
  for (const term of ["If Doop is unavailable", "input schema and descriptions", "executed: false", "authorization", "Doop MCP directly"]) {
    assert.ok(skill.toLowerCase().includes(term.toLowerCase()), `doop-bridge is missing guidance: ${term}`);
  }

  const offline = simulateCoordinator({ doopConnected: false });
  assert.equal(offline.motionAvailable, true);
  assert.equal(offline.doopAvailable, false);
  assert.deepEqual(offline.externalReads, []);
  assert.deepEqual(offline.externalWrites, []);
  assert.equal(offline.executed, false);

  const partial = simulateCoordinator({ doopConnected: true, discoveredToolNames: ["get_canvas", "set_frame_html"] });
  assert.deepEqual(partial.externalReads, ["get_canvas"]);
  assert.deepEqual(partial.externalWrites, [], "a discovered write tool is still gated by explicit authorization");
  assert.equal(partial.executed, false);
});

test("studio-director and repository routing delegate the two directions without requiring Doop", async () => {
  for (const file of [
    "packages/motion-skills/skills/studio-director/SKILL.md",
    ".agents/skills/studio-director/SKILL.md",
    "CLAUDE.md",
  ]) {
    const content = await readFile(path.join(root, file), "utf8");
    for (const name of names) assert.ok(content.includes(name), `${file} does not route ${name}`);
  }
});
