import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT, checkTestCatalog } from "./test-catalog.mjs";
import { getChangedFiles, selectTestsForChanges } from "./lib/test-impact.mjs";
import { runNodeTestFiles, runVitestFiles } from "./lib/test-execution.mjs";

const args = process.argv.slice(2);
const commandStarted = performance.now();
const preparationStarted = performance.now();
const valueAfter = (name) => {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const group = valueAfter("--group");
const base = valueAfter("--base");
const changedMode = args.includes("--changed") || args.includes("--explain") || Boolean(base);
const explain = args.includes("--explain") || args.includes("--dry-run");
const dryRun = args.includes("--dry-run");
const catalogResult = await checkTestCatalog();
if (!catalogResult.ok) {
  console.error(`FAIL: ${catalogResult.message}`);
  process.exit(2);
}
const catalog = { entries: catalogResult.entries };

let selection;
if (changedMode) {
  const changes = getChangedFiles(base);
  selection = await selectTestsForChanges(changes, catalog);
} else if (group) {
  const selected = catalog.entries.filter((entry) => entry.groups.includes(group) && entry.ci.status === "run");
  const blocked = catalog.entries.filter((entry) => entry.groups.includes(group) && entry.ci.status === "blocked");
  if (!selected.length) {
    console.error(`No tests classified in group '${group}'; refusing empty selection.`);
    process.exit(2);
  }
  selection = { changes: [], selected, blocked, affectedModules: [...new Set(selected.map((entry) => entry.module))].sort(), validations: [], mode: "group", reasons: [`Grupo solicitado: ${group}.`] };
  if (group === "media") selection.validations.push("determinism");
} else {
  console.error("Usage: run-test-selection.mjs --group=<quick|unit|integration|media|skills-node> or --changed [--base=REF] [--explain] [--dry-run]");
  process.exit(2);
}

function printSelection() {
  if (changedMode) {
    console.log(`Alterações detectadas (${selection.changes.length}):`);
    for (const change of selection.changes) console.log(`  ${change.status.padEnd(12)} ${change.path}`);
    console.log(`Módulos afetados: ${selection.affectedModules.join(", ") || "nenhum"}`);
    console.log(`Validações adicionais: ${selection.validations.join(", ") || "nenhuma"}`);
  }
  console.log(`Testes selecionados (${selection.selected.length}):`);
  for (const entry of selection.selected) console.log(`  ${entry.path} — ${entry.reasons?.join("; ") || entry.category}`);
  for (const entry of selection.blocked ?? []) console.log(`  BLOCKED ${entry.path} — ${entry.ci.reason}`);
  for (const reason of selection.reasons ?? []) console.log(`Justificativa: ${reason}`);
  if (!selection.selected.length) console.log("Nenhum teste de produto será executado; este resultado não significa aprovação de testes.");
  if (selection.blocked?.length) console.log(`ATENÇÃO: ${selection.blocked.length} teste(s) relevante(s) têm execução bloqueada por dependências-fonte ausentes.`);
}

if (explain || changedMode || selection.blocked?.length) printSelection();
if (dryRun) {
  console.log(`Seleção/preparação: ${((performance.now() - commandStarted) / 1000).toFixed(2)}s; execução: 0s (dry-run).`);
  console.log("DRY_RUN: nenhum comando de validação foi executado.");
  process.exit(0);
}

const runCommand = (command, commandArgs, cwd = ROOT) => {
  const result = spawnSync(command, commandArgs, { cwd, stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  return result.status ?? 1;
};
let failed = false;
const runnerResults = [];
const executionStarted = performance.now();
const selectedByRunner = (runner) => selection.selected.filter((entry) => entry.runner === runner).map((entry) => entry.path);

if (selection.validations.includes("docs-diff-check")) {
  const docPaths = [...new Set(selection.changes.filter((c) => /\.md$/i.test(c.path) || /^(?:AGENTS|CLAUDE|GEMINI)\.md$/.test(c.path)).map((c) => c.path))];
  const worktreeStatus = runCommand("git", ["diff", "--check", "HEAD", "--", ...docPaths]);
  failed ||= worktreeStatus !== 0;
  if (base) {
    const baseStatus = runCommand("git", ["diff", "--check", `${base}...HEAD`, "--", ...docPaths]);
    failed ||= baseStatus !== 0;
  }
  for (const change of selection.changes.filter((c) => c.status === "untracked" && /\.md$/i.test(c.path))) {
    const content = await readFile(path.join(ROOT, change.path), "utf8");
    if (content.split(/\r?\n/).some((line) => /[ \t]+$/.test(line))) {
      console.error(`Trailing whitespace in untracked documentation: ${change.path}`);
      failed = true;
    }
  }
}
if (selection.validations.includes("skills-verify") && runCommand(process.execPath, ["scripts/verify-public-skills.mjs"]) !== 0) failed = true;
if (selection.validations.includes("catalog-check") && runCommand(process.execPath, ["scripts/test-catalog.mjs", "--check"]) !== 0) failed = true;
if (selection.validations.includes("determinism") && runCommand(process.execPath, ["scripts/ci-determinism.mjs"]) !== 0) failed = true;

const nodeFiles = selectedByRunner("node:test");
if (nodeFiles.length) {
  const result = await runNodeTestFiles(nodeFiles, { label: group ?? "changed", rejectSkips: true, preparationMs: performance.now() - preparationStarted });
  runnerResults.push({ runner: "node:test", fileCount: nodeFiles.length, exitCode: result.exitCode, reportPath: path.relative(ROOT, result.reportPath) });
  if (result.exitCode !== 0) failed = true;
}

const pythonFiles = selectedByRunner("pytest");
if (pythonFiles.length) {
  const py = process.env.PYTHON ?? "python3";
  const exitCode = runCommand(py, ["scripts/ci_python_tests.py", ...pythonFiles.flatMap((file) => ["--path", file])]);
  runnerResults.push({ runner: "pytest", fileCount: pythonFiles.length, exitCode });
  if (exitCode !== 0) failed = true;
}

const vitestFiles = selectedByRunner("vitest");
if (vitestFiles.length) {
  const result = await runVitestFiles(vitestFiles, { label: group ?? "changed" });
  runnerResults.push({ runner: "vitest", fileCount: vitestFiles.length, exitCode: result.exitCode, reportPath: path.relative(ROOT, result.reportPath) });
  if (result.exitCode !== 0) failed = true;
}

if (selection.validations.includes("docs-diff-check") && !selection.selected.length) {
  console.log(failed ? "CHECKS_ONLY_FAIL: documentation checks failed; no product tests ran." : "CHECKS_ONLY_PASS: documentation checks passed; no product tests ran, so no test approval is implied.");
} else if (selection.selected.length === 0) {
  console.error("No tests were selected. Refusing to return a passing test status.");
  failed = true;
}
process.exitCode = failed ? 1 : 0;
if (!failed && selection.blocked?.length) {
  console.log(`EXECUTED_WITH_BLOCKED_COVERAGE: ${selection.selected.length} selected tests ran; ${selection.blocked.length} relevant test(s) remain blocked and are not counted as passing.`);
}
const totalMs = performance.now() - commandStarted;
const preparationMs = executionStarted - commandStarted;
const status = failed ? "FAIL" : selection.blocked?.length ? "PASS_WITH_BLOCKED_COVERAGE" : !selection.selected.length ? "CHECKS_ONLY_PASS" : "PASS";
const safeLabel = (group ?? "changed").toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 28);
const reportPath = path.join(ROOT, "tests/tmp", `test-report-command-${safeLabel}-${process.pid}.json`);
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify({
  schemaVersion: 1,
  label: group ?? "changed",
  status,
  mode: selection.mode,
  startedAt: new Date(Date.now() - totalMs).toISOString(),
  preparationMs,
  executionMs: Math.max(0, totalMs - preparationMs),
  totalMs,
  selectedTests: selection.selected.map((entry) => entry.path),
  blockedTests: (selection.blocked ?? []).map((entry) => ({ path: entry.path, reason: entry.ci.reason })),
  validations: selection.validations,
  runners: runnerResults,
}, null, 2)}\n`);
console.log(`Command metrics: prep ${(preparationMs / 1000).toFixed(2)}s; execute/validate ${((totalMs - preparationMs) / 1000).toFixed(2)}s; total ${(totalMs / 1000).toFixed(2)}s. Report: ${path.relative(ROOT, reportPath)}`);
