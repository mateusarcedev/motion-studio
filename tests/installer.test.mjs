import assert from "node:assert/strict";
import { test } from "node:test";
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runBootstrap, readManifest, verifyInstall } from "../packages/motion-cli/lib/bootstrap/index.mjs";
import { detectPackageManager, planDependencies } from "../packages/motion-cli/lib/bootstrap/packages.mjs";
import { compareVersions, exists, treeHash } from "../packages/motion-cli/lib/bootstrap/util.mjs";
import * as skillsMod from "../packages/motion-skills/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const binPath = path.join(root, "packages", "motion-cli", "bin", "motion.mjs");
const studioBin = path.join(root, "packages", "motion-studio", "bin", "motion-studio.mjs");
const PUBLIC = (await skillsMod.listSkills()).map((s) => s.name).sort();
const base = { skipInstall: true, skipDoctor: true, noProbe: true, json: true };

async function tmp(prefix = "motion-installer-") {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}
async function quiet(fn) {
  const log = console.log;
  console.log = () => {};
  try {
    return await fn();
  } finally {
    console.log = log;
  }
}
const run = (dir, opts = {}) => quiet(() => runBootstrap({ ...base, cwd: dir, ...opts }));

test("empty directory → standalone: 14 public skills, no package.json/node_modules created", async () => {
  const dir = await tmp();
  try {
    const r = await run(dir);
    assert.equal(r.ok, true, JSON.stringify(r.error));
    assert.equal(r.mode, "standalone");
    assert.equal(PUBLIC.length, 14);
    assert.deepEqual((await readdir(path.join(dir, ".agents", "skills"))).sort(), PUBLIC);
    assert.ok(!(await exists(path.join(dir, "package.json"))));
    assert.ok(!(await exists(path.join(dir, "node_modules"))));
    assert.ok(await exists(path.join(dir, "motion.config.json")));
    const m = await readManifest(dir);
    assert.equal(m.status, "complete");
    assert.equal(Object.keys(m.skills).length, 14);
    // universal install also links Claude Code when nothing is detected
    assert.deepEqual((await readdir(path.join(dir, ".claude", "skills"))).sort(), PUBLIC);
    assert.ok(!(await exists(path.join(dir, ".opencode"))), "no duplicate .opencode copy");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("never ships the non-redistributable skills", async () => {
  const dir = await tmp();
  try {
    await run(dir);
    const installed = await readdir(path.join(dir, ".agents", "skills"));
    for (const banned of ["remotion-docs", "ui-styling", "impeccable", "brand", "design", "hyperframes", "grill-me"]) {
      assert.ok(!installed.includes(banned), banned);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("existing Node repo: package.json untouched in skip-install mode; rerun is idempotent", async () => {
  const dir = await tmp();
  try {
    const pkg = JSON.stringify({ name: "consumer", version: "1.0.0" }, null, 2) + "\n";
    await writeFile(path.join(dir, "package.json"), pkg);
    const a = await run(dir);
    assert.equal(a.ok, true);
    assert.equal(await readFile(path.join(dir, "package.json"), "utf8"), pkg);
    const before = await treeHash(path.join(dir, ".agents", "skills"));
    const cfgBefore = await readFile(path.join(dir, "motion.config.json"), "utf8");
    const b = await run(dir);
    assert.equal(b.ok, true);
    assert.ok(b.skills.every((s) => s.status === "unchanged"), "second run changes nothing");
    assert.equal(await treeHash(path.join(dir, ".agents", "skills")), before);
    assert.equal(await readFile(path.join(dir, "motion.config.json"), "utf8"), cfgBefore);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("conflict: user's own skill is preserved; --force replaces with backup", async () => {
  const dir = await tmp();
  try {
    const mine = path.join(dir, ".agents", "skills", "studio-director");
    await mkdir(mine, { recursive: true });
    await writeFile(path.join(mine, "SKILL.md"), "---\nname: studio-director\ndescription: mine\n---\nCUSTOM\n");
    const r = await run(dir);
    assert.equal(r.ok, true);
    assert.equal(r.skills.find((s) => s.name === "studio-director").status, "conflict");
    assert.ok(r.warnings.some((w) => w.includes("studio-director")));
    assert.match(await readFile(path.join(mine, "SKILL.md"), "utf8"), /CUSTOM/);
    assert.equal(r.skills.filter((s) => s.status === "installed").length, 13);

    const f = await run(dir, { force: true });
    assert.equal(f.skills.find((s) => s.name === "studio-director").status, "replaced");
    assert.doesNotMatch(await readFile(path.join(mine, "SKILL.md"), "utf8"), /CUSTOM/);
    const backups = await readdir(path.join(dir, ".motion", "backups"));
    assert.ok(backups.some((b) => b.startsWith("studio-director-")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("config conflict: existing motion.config.json preserved; invalid JSON fails without touching it", async () => {
  const dir = await tmp();
  try {
    const cfg = JSON.stringify({ name: "x", custom: true }) + "\n";
    await writeFile(path.join(dir, "motion.config.json"), cfg);
    const r = await run(dir);
    assert.equal(r.ok, true);
    assert.equal(await readFile(path.join(dir, "motion.config.json"), "utf8"), cfg);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  const bad = await tmp();
  try {
    await writeFile(path.join(bad, "motion.config.json"), "{ not json");
    const r = await run(bad);
    assert.equal(r.ok, false);
    assert.equal(r.error.code, "INVALID_JSON");
    assert.equal(await readFile(path.join(bad, "motion.config.json"), "utf8"), "{ not json");
  } finally {
    await rm(bad, { recursive: true, force: true });
  }
});

test("skills package unavailable → explicit failure, nothing written", async () => {
  const dir = await tmp();
  try {
    const r = await run(dir, { catalogLoader: async () => null });
    assert.equal(r.ok, false);
    assert.equal(r.exitCode, 1);
    assert.equal(r.error.code, "SKILLS_UNAVAILABLE");
    assert.deepEqual(await readdir(dir), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("tampered Skill script (treeSha256 mismatch) is rejected", async () => {
  const dir = await tmp();
  const copy = await tmp("motion-skills-copy-");
  try {
    await cp(path.join(root, "packages", "motion-skills"), copy, { recursive: true, filter: (s) => !s.includes(`${path.sep}node_modules`) });
    await writeFile(path.join(copy, "skills", "cinematic-product-director", "scripts", "export_whatsapp.sh"), "tampered\n");
    const r = await run(dir, { catalogLoader: async () => ({ SKILLS_DIR: path.join(copy, "skills"), resolveSkillsForProfile: skillsMod.resolveSkillsForProfile }) });
    assert.equal(r.ok, false);
    assert.equal(r.error.code, "SKILL_INTEGRITY");
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(copy, { recursive: true, force: true });
  }
});

test("tampered skills package (sha256 mismatch) is rejected", async () => {
  const dir = await tmp();
  const copy = await tmp("motion-skills-copy-");
  try {
    await cp(path.join(root, "packages", "motion-skills"), copy, { recursive: true, filter: (s) => !s.includes(`${path.sep}node_modules`) });
    await writeFile(path.join(copy, "skills", "studio-director", "SKILL.md"), "tampered\n");
    const r = await run(dir, { catalogLoader: async () => ({ SKILLS_DIR: path.join(copy, "skills"), resolveSkillsForProfile: skillsMod.resolveSkillsForProfile }) });
    assert.equal(r.ok, false);
    assert.equal(r.error.code, "SKILL_INTEGRITY");
    assert.ok(!(await exists(path.join(dir, ".agents"))));
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(copy, { recursive: true, force: true });
  }
});

test("interrupted install is detected and repaired on rerun", async () => {
  const dir = await tmp();
  try {
    await run(dir);
    // simulate crash: manifest in-progress + half-written skill
    const m = await readManifest(dir);
    await writeFile(path.join(dir, ".motion", "install.json"), JSON.stringify({ ...m, status: "in-progress", pending: ["web-director"] }));
    const half = path.join(dir, ".agents", "skills", "web-director");
    await rm(path.join(half, "SKILL.md"));
    const r = await run(dir);
    assert.equal(r.ok, true);
    assert.ok(r.warnings.some((w) => w.includes("incompleta")));
    assert.equal(r.skills.find((s) => s.name === "web-director").status, "repaired");
    assert.ok(await exists(path.join(half, "SKILL.md")));
    assert.equal((await readManifest(dir)).status, "complete");
    assert.ok((await verifyInstall(dir)).every((c) => c.ok));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("unmodified old install is updated; locally edited skill is preserved", async () => {
  const dir = await tmp();
  try {
    await run(dir);
    const m = await readManifest(dir);
    // pretend previous release shipped different bytes for two skills
    const a = path.join(dir, ".agents", "skills", "anatomy", "OLD.txt");
    const b = path.join(dir, ".agents", "skills", "story-studio", "OLD.txt");
    await writeFile(a, "old");
    await writeFile(b, "old");
    m.skills.anatomy.treeHash = await treeHash(path.join(dir, ".agents", "skills", "anatomy")); // recorded as shipped
    await writeFile(path.join(dir, ".motion", "install.json"), JSON.stringify(m));
    const r = await run(dir);
    assert.equal(r.skills.find((s) => s.name === "anatomy").status, "updated");
    assert.ok(!(await exists(a)));
    assert.equal(r.skills.find((s) => s.name === "story-studio").status, "conflict");
    assert.ok(await exists(b));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("claude link: existing real directory is preserved, broken symlink is healed", async () => {
  const dir = await tmp();
  try {
    await mkdir(path.join(dir, ".claude", "skills", "anatomy"), { recursive: true });
    await writeFile(path.join(dir, ".claude", "skills", "anatomy", "SKILL.md"), "mine");
    const r = await run(dir, { agents: "claude" });
    assert.equal(r.ok, true);
    assert.match(await readFile(path.join(dir, ".claude", "skills", "anatomy", "SKILL.md"), "utf8"), /mine/);
    assert.ok(r.warnings.some((w) => w.includes(".claude/anatomy")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("agent selection: --agents=codex does not create .claude", async () => {
  const dir = await tmp();
  try {
    const r = await run(dir, { agents: "codex" });
    assert.equal(r.ok, true);
    assert.ok(!(await exists(path.join(dir, ".claude"))));
    assert.ok(await exists(path.join(dir, ".agents", "skills", "motion-director", "SKILL.md")));
    assert.equal((await run(dir, { agents: "vim" })).error.code, "BAD_AGENT");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("recursion and self-install guards", async () => {
  const dir = await tmp();
  try {
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "@technomanceer/motion-cli" }));
    assert.equal((await run(dir)).error.code, "SELF_INSTALL");
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "ok" }));
    process.env.MOTION_STUDIO_INSTALLING = "1";
    try {
      assert.equal((await run(dir)).error.code, "RECURSION");
    } finally {
      delete process.env.MOTION_STUDIO_INSTALLING;
    }
    const nm = path.join(dir, "node_modules", "x");
    await mkdir(nm, { recursive: true });
    assert.equal((await run(nm)).error.code, "INSIDE_NODE_MODULES");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("network failure: exit 2, nothing half-installed, rerun recovers", async () => {
  const dir = await tmp();
  try {
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "consumer" }));
    const env = { npm_config_registry: "http://127.0.0.1:9", npm_config_fetch_retries: "0", npm_config_fetch_retry_mintimeout: "1", npm_config_fetch_retry_maxtimeout: "1", npm_config_cache: path.join(dir, ".npm-cache") };
    const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
    Object.assign(process.env, env);
    let r;
    try {
      r = await quiet(() => runBootstrap({ cwd: dir, skipDoctor: true, noProbe: true, json: true }));
    } finally {
      for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v);
    }
    assert.equal(r.ok, false);
    assert.equal(r.exitCode, 2);
    assert.equal(r.error.code, "NETWORK");
    assert.ok(!(await exists(path.join(dir, ".agents"))), "no skills before deps succeed");
    assert.ok(!(await exists(path.join(dir, "motion.config.json"))));
    assert.equal((await readManifest(dir)).status, "in-progress");
    const ok = await run(dir); // offline-capable recovery path
    assert.equal(ok.ok, true);
    assert.equal((await readManifest(dir)).status, "complete");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("package manager detection and version planning", async () => {
  const dir = await tmp();
  try {
    assert.equal((await detectPackageManager(dir, null)).name, "npm");
    await writeFile(path.join(dir, "pnpm-lock.yaml"), "");
    assert.equal((await detectPackageManager(dir, {})).name, "pnpm");
    assert.equal((await detectPackageManager(dir, { packageManager: "yarn@4.1.0" })).name, "yarn");
    await rm(path.join(dir, "pnpm-lock.yaml"));
    await writeFile(path.join(dir, "bun.lock"), "");
    assert.equal((await detectPackageManager(dir, {})).name, "bun");

    const nm = (n, v) => mkdir(path.join(dir, "node_modules", ...n.split("/")), { recursive: true }).then(() => writeFile(path.join(dir, "node_modules", ...n.split("/"), "package.json"), JSON.stringify({ name: n, version: v })));
    await nm("@technomanceer/motion-cli", "1.0.0-rc.4");
    await nm("@technomanceer/motion-core", "1.0.0-rc.9");
    const pkg = { devDependencies: { "@technomanceer/motion-cli": "1.0.0-rc.4", "@technomanceer/motion-core": "1.0.0-rc.9" } };
    const plan = await planDependencies(dir, pkg, { "@technomanceer/motion-cli": "1.0.0-rc.5", "@technomanceer/motion-core": "1.0.0-rc.4", "@technomanceer/motion-studio-skills": "1.0.0-rc.4" });
    assert.equal(plan["@technomanceer/motion-cli"].action, "install");
    assert.equal(plan["@technomanceer/motion-core"].action, "newer");
    assert.equal(plan["@technomanceer/motion-studio-skills"].action, "install");
    assert.equal(compareVersions("1.0.0-rc.5", "1.0.0-rc.10"), -1);
    assert.equal(compareVersions("1.0.0", "1.0.0-rc.10"), 1);
    assert.equal(compareVersions("1.0.0-rc.4", "1.0.0-rc.4"), 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CLI binaries: motion init and motion-studio init share one implementation", async () => {
  for (const bin of [binPath, studioBin]) {
    const dir = await tmp();
    try {
      const r = spawnSync(process.execPath, [bin, "init", "--skip-install", "--json", "--agents=codex"], { cwd: dir, encoding: "utf8", env: { ...process.env, PATH: process.env.PATH } });
      assert.equal(r.status, 0, r.stderr);
      const report = JSON.parse(r.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.skills.length, 14);
      assert.equal(spawnSync(process.execPath, [bin, "--version"], { encoding: "utf8" }).status, 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

test("--skills-dir: only that folder, agent folders untouched, rerun keeps the choice, escapes refused", async () => {
  const dir = await tmp();
  try {
    await mkdir(path.join(dir, ".claude"), { recursive: true });
    const r = await quiet(() => runBootstrap({ ...base, cwd: dir, "skills-dir": "tools/skills" }));
    assert.equal(r.ok, true, JSON.stringify(r.error));
    assert.deepEqual((await readdir(path.join(dir, "tools/skills"))).sort(), PUBLIC);
    assert.ok(!(await exists(path.join(dir, ".agents"))));
    assert.deepEqual(await readdir(path.join(dir, ".claude")), []);
    assert.equal((await readManifest(dir)).skillsDir, "tools/skills");
    const again = await quiet(() => runBootstrap({ ...base, cwd: dir }));
    assert.equal(again.ok, true);
    assert.ok(again.skills.every((s) => s.status === "unchanged"));
    assert.ok(!(await exists(path.join(dir, ".agents"))));
    assert.ok((await verifyInstall(dir)).every((c) => c.ok));
    const { symlink } = await import("node:fs/promises");
    await symlink(os.tmpdir(), path.join(dir, "fora"));
    for (const bad of ["../x", "/tmp/x", ".", "fora/skills", "node_modules/x", true]) {
      const b = await quiet(() => runBootstrap({ ...base, cwd: dir, "skills-dir": bad }));
      assert.equal(b.error?.code, "BAD_SKILLS_DIR", String(bad));
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("--no-skills: config and manifest only; conflicts with --skills-dir", async () => {
  const dir = await tmp();
  try {
    const r = await quiet(() => runBootstrap({ ...base, cwd: dir, "no-skills": true }));
    assert.equal(r.ok, true, JSON.stringify(r.error));
    assert.ok(!(await exists(path.join(dir, ".agents")))); assert.ok(!(await exists(path.join(dir, ".claude"))));
    assert.ok(await exists(path.join(dir, "motion.config.json")));
    assert.ok((await verifyInstall(dir)).every((c) => c.ok));
    const b = await quiet(() => runBootstrap({ ...base, cwd: dir, "no-skills": true, "skills-dir": "x" }));
    assert.equal(b.error.code, "BAD_SKILLS_DIR");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
