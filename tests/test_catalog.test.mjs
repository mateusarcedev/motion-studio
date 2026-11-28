import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ROOT, buildTestCatalog, checkTestCatalog, writeTestCatalog } from "../scripts/test-catalog.mjs";
import { getChangedFiles, selectTestsForChanges } from "../scripts/lib/test-impact.mjs";

let catalogPromise;
const loadCatalog = () => catalogPromise ??= buildTestCatalog();

test("the catalog classifies every canonical test file and gives each an explicit CI/manual owner", async () => {
  const catalog = await loadCatalog();
  assert.ok(catalog.testCount >= 127);
  assert.equal(catalog.entries.length, catalog.testCount);
  for (const entry of catalog.entries) {
    assert.ok(entry.category && entry.module && entry.runner, entry.path);
    assert.ok(Array.isArray(entry.dependencies), entry.path);
    assert.ok(Array.isArray(entry.transitiveDependencies), entry.path);
    assert.ok(Array.isArray(entry.externalDependencies), entry.path);
    assert.ok(Array.isArray(entry.externalResources), entry.path);
    assert.deepEqual(Object.keys(entry.requires).sort(), ["chromium", "ffmpeg", "mcpSubprocess", "network", "python"].sort());
    assert.ok(entry.cost && entry.criticality && entry.groups.length, entry.path);
    assert.ok(entry.ci?.job, entry.path);
    assert.ok(["run", "manual", "blocked"].includes(entry.ci.status), entry.path);
    if (["manual", "blocked"].includes(entry.ci.status)) assert.ok(entry.ci.reason, entry.path);
  }
  const blocked = catalog.entries.filter((entry) => entry.ci.status === "blocked");
  assert.deepEqual(blocked.map((entry) => entry.path).sort(), [
    "packages/motion-skills/skills/ui-ux-pro-max/scripts/tests/test_catalog_refresh.py",
    "packages/motion-skills/skills/ui-ux-pro-max/scripts/tests/test_relevance_evaluator.py",
  ]);
  assert.ok(blocked.every((entry) => /Missing source:/.test(entry.ci.reason)));
  const catalogTest = catalog.entries.find((entry) => entry.path === "tests/test_catalog.test.mjs");
  assert.equal(catalogTest.category, "integration");
  assert.deepEqual(catalogTest.requires, { chromium: false, ffmpeg: false, python: true, mcpSubprocess: false, network: false });
  assert.ok(catalogTest.groups.includes("integration"));
  assert.ok(!catalogTest.groups.includes("media"));
  assert.ok(![...catalogTest.dependencies, ...catalogTest.transitiveDependencies].some((file) => /\.test\./.test(file)));
});

test("the catalog checker detects an added test file absent from its reviewed JSON", async () => {
  const repository = await mkdtemp(path.join(os.tmpdir(), "motion-test-catalog-git-"));
  const git = (...args) => execFileSync("git", args, { cwd: repository, stdio: "ignore" });
  try {
    git("init", "-q");
    await mkdir(path.join(repository, "tests"), { recursive: true });
    await writeFile(path.join(repository, "tests/existing.test.mjs"), "import test from 'node:test'; test('existing', () => {});\n");
    const initial = await writeTestCatalog(repository);
    assert.equal(initial.testCount, 1);
    assert.ok((await checkTestCatalog(repository)).ok);

    await writeFile(path.join(repository, "tests/new.test.mjs"), "import test from 'node:test'; test('new', () => {});\n");
    const stale = await checkTestCatalog(repository);
    assert.equal(stale.ok, false);
    assert.match(stale.message, /stale|not been classified/i);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test("documentation changes select documentary checks without media tests", async () => {
  const catalog = await loadCatalog();
  const selection = await selectTestsForChanges([{ path: "docs/WORKFLOW.md", status: "modified" }], catalog);
  assert.equal(selection.mode, "checks-only");
  assert.deepEqual(selection.validations, ["docs-diff-check"]);
  assert.equal(selection.selected.length, 0);
  const skillCopy = await selectTestsForChanges([{ path: ".agents/skills/anatomy/SKILL.md", status: "modified" }], catalog);
  assert.ok(skillCopy.validations.includes("skills-verify"));
  assert.equal(skillCopy.selected.length, 0);
});

test("catalog data changes run the catalog checker and its contract tests", async () => {
  const catalog = await loadCatalog();
  const selection = await selectTestsForChanges([{ path: "docs/testing/test-catalog.json", status: "unstaged-modified" }], catalog);
  assert.ok(selection.validations.includes("catalog-check"));
  assert.ok(selection.selected.some((entry) => entry.path === "tests/test_catalog.test.mjs"));
});

test("media, SVG and audio changes select their specific validation groups", async () => {
  const catalog = await loadCatalog();
  const svg = await selectTestsForChanges([{ path: "packages/motion-core/design-system/svg-motion.js", status: "modified" }], catalog);
  const audio = await selectTestsForChanges([{ path: "packages/motion-skills/skills/media-use/audio/scripts/lib/audio-meta.mjs", status: "modified" }], catalog);
  const render = await selectTestsForChanges([{ path: "packages/motion-core/renderers/new-renderer.mjs", status: "added" }], catalog);
  assert.ok(svg.selected.some((entry) => entry.groups.includes("svg-security")));
  assert.ok(audio.selected.some((entry) => entry.groups.includes("audio")));
  assert.ok(render.selected.some((entry) => entry.groups.includes("media")));
  assert.ok(render.validations.includes("determinism"));
  const skill = await selectTestsForChanges([{ path: "packages/motion-skills/skills/anatomy/kit/audit.mjs", status: "modified" }], catalog);
  assert.ok(skill.selected.some((entry) => entry.module === "skill:anatomy"));
  assert.ok(skill.validations.includes("skills-verify"));
});

test("an empty diff selects the quick fallback instead of passing without tests", async () => {
  const catalog = await loadCatalog();
  const selection = await selectTestsForChanges([], catalog);
  assert.equal(selection.mode, "quick-fallback");
  assert.ok(selection.selected.length > 0);
  assert.ok(selection.selected.every((entry) => entry.groups.includes("quick")));
});

test("group dry-run inspects that group rather than switching to the changed-files selector", () => {
  const run = spawnSync(process.execPath, [path.join(ROOT, "scripts/run-test-selection.mjs"), "--group=unit", "--dry-run"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /Testes selecionados \(\d+\)/);
  assert.doesNotMatch(run.stdout, /Alterações detectadas/);
  assert.match(run.stdout, /DRY_RUN: nenhum comando de validação foi executado/);
});

test("MCP and Design Bridge rules select their contract/security test groups", async () => {
  const catalog = await loadCatalog();
  const mcp = await selectTestsForChanges([{ path: "packages/motion-core/mcp/server.mjs", status: "modified" }], catalog);
  assert.ok(mcp.selected.some((entry) => entry.groups.includes("mcp")));
  const bridge = await selectTestsForChanges([{ path: "packages/motion-core/bridge/importer.mjs", status: "modified" }], catalog);
  assert.ok(bridge.selected.some((entry) => entry.groups.includes("bridge")));
  assert.ok(bridge.selected.some((entry) => entry.groups.includes("svg-security")));
});

test("unknown shared-code impact expands to the full runnable CI catalog", async () => {
  const catalog = await loadCatalog();
  const selection = await selectTestsForChanges([{ path: "creative-core/shared/runtime.mjs", status: "modified" }], catalog);
  assert.equal(selection.selected.length, catalog.entries.filter((entry) => entry.ci.status === "run").length);
  assert.ok(selection.reasons.some((reason) => reason.includes("ampliada a seleção")));
  const runner = await selectTestsForChanges([{ path: "scripts/lib/test-execution.mjs", status: "modified" }], catalog);
  assert.equal(runner.selected.length, catalog.entries.filter((entry) => entry.ci.status === "run").length);
  assert.ok(runner.validations.includes("catalog-check"));
});

test("shared impact reports blocked entries separately from runnable selections", async () => {
  const catalog = await loadCatalog();
  const selection = await selectTestsForChanges([{ path: "package-lock.json", status: "modified" }], catalog);
  assert.equal(selection.selected.length, catalog.entries.filter((entry) => entry.ci.status === "run").length);
  assert.deepEqual(selection.blocked.map((entry) => entry.path).sort(), catalog.entries.filter((entry) => entry.ci.status === "blocked").map((entry) => entry.path).sort());
});

test("a direct run request for a blocked Python test explains the missing implementation", () => {
  const blocked = "packages/motion-skills/skills/ui-ux-pro-max/scripts/tests/test_relevance_evaluator.py";
  const run = spawnSync("python3", ["scripts/ci_python_tests.py", "--path", blocked], { cwd: ROOT, encoding: "utf8" });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /Blocked Python tests cannot be executed/);
  assert.match(run.stderr, /evaluate-relevance\.py/);
});

test("direct and transitive imports select dependent tests with a reason", async () => {
  const catalog = await loadCatalog();
  const direct = catalog.entries.find((entry) => entry.dependencies.length);
  assert.ok(direct, "catalog has at least one test with local direct dependencies");
  const directSelection = await selectTestsForChanges([{ path: direct.dependencies[0], status: "modified" }], catalog);
  const directMatch = directSelection.selected.find((entry) => entry.path === direct.path);
  assert.ok(directMatch, `${direct.path} was selected for ${direct.dependencies[0]}`);
  assert.ok(directMatch.reasons.some((reason) => reason.includes("dependência direta")));

  const transitive = catalog.entries.find((entry) => entry.transitiveDependencies.length);
  assert.ok(transitive, "catalog has at least one test with local transitive dependencies");
  const transitiveSelection = await selectTestsForChanges([{ path: transitive.transitiveDependencies[0], status: "modified" }], catalog);
  const transitiveMatch = transitiveSelection.selected.find((entry) => entry.path === transitive.path);
  assert.ok(transitiveMatch, `${transitive.path} was selected for ${transitive.transitiveDependencies[0]}`);
  assert.ok(transitiveMatch.reasons.some((reason) => reason.includes("dependência transitiva")));
});

test("changed-file discovery distinguishes base, staged, unstaged, added, deleted, untracked and renamed paths", async () => {
  const repository = await mkdtemp(path.join(os.tmpdir(), "motion-test-impact-git-"));
  const git = (...args) => execFileSync("git", args, { cwd: repository, stdio: "ignore" });
  const put = async (relative, contents) => {
    const target = path.join(repository, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents);
  };
  try {
    git("init", "-q");
    git("config", "user.email", "motion-test@example.invalid");
    git("config", "user.name", "Motion test fixture");
    await put("base.mjs", "export const value = 1;\n");
    await put("renamed-from.mjs", "export const oldName = true;\n");
    await put("delete-me.mjs", "export const removeMe = true;\n");
    await put("committed.mjs", "export const value = 1;\n");
    git("add", ".");
    git("commit", "-qm", "base");
    const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim();

    await put("committed.mjs", "export const value = 2;\n");
    git("add", "committed.mjs");
    git("commit", "-qm", "base range change");
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim();

    await put("base.mjs", "export const value = 3;\n");
    await put("both.mjs", "export const first = true;\n");
    git("add", "both.mjs");
    await put("both.mjs", "export const second = true;\n");
    await put("staged.mjs", "export const staged = true;\n");
    git("add", "staged.mjs");
    git("mv", "renamed-from.mjs", "renamed-to.mjs");
    git("rm", "-q", "delete-me.mjs");
    await put("untracked.mjs", "export const untracked = true;\n");

    const changes = getChangedFiles(base, repository);
    const statuses = (filename) => changes.filter((change) => change.path === filename).map((change) => change.status);
    assert.ok(statuses("committed.mjs").includes("base-modified"));
    assert.ok(statuses("base.mjs").includes("unstaged-modified"));
    assert.ok(statuses("both.mjs").includes("staged-added"));
    assert.ok(statuses("both.mjs").includes("unstaged-modified"));
    assert.ok(statuses("staged.mjs").includes("staged-added"));
    assert.ok(statuses("untracked.mjs").includes("untracked"));
    assert.ok(statuses("renamed-from.mjs").some((status) => status.endsWith("renamed-from")));
    assert.ok(statuses("renamed-to.mjs").some((status) => status.endsWith("renamed-to")));
    assert.ok(statuses("delete-me.mjs").some((status) => status.endsWith("deleted")));
    assert.ok(head);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test("Python imports and unique script references become catalog dependencies", async () => {
  const catalog = await loadCatalog();
  const transition = catalog.entries.find((entry) => entry.path === "tests/test_transitions_ffmpeg.py");
  assert.ok(transition.dependencies.includes("packages/motion-core/transitions/ffmpeg.py"));
  const cinematic = catalog.entries.find((entry) => entry.path === "tests/test_cinematic_scripts.py");
  assert.ok(cinematic.dependencies.includes("packages/motion-skills/skills/cinematic-product-director/scripts/beat_map.py"));
  const anatomyBrowser = catalog.entries.find((entry) => entry.path === "packages/motion-skills/skills/anatomy/scripts/lines.test.mjs");
  assert.equal(anatomyBrowser.requires.chromium, true);
  const dynamicNavigation = catalog.entries.find((entry) => entry.path === "packages/motion-skills/skills/anatomy/scripts/navigation.test.mjs");
  assert.equal(dynamicNavigation.requires.chromium, true);
  assert.equal(dynamicNavigation.category, "integration");
  const anatomyTypescript = catalog.entries.find((entry) => entry.path === "packages/motion-skills/skills/anatomy/scripts/react-dots-opacity.test.mjs");
  assert.ok(anatomyTypescript.externalDependencies.includes("npm:typescript"));
});
