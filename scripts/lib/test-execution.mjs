import { access, appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { run } from "node:test";
import { spec } from "node:test/reporters";
import { ROOT } from "../test-catalog.mjs";

export function metricsFromLines(lines) {
  const records = lines.split("\n").filter(Boolean).map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
  const counts = { processes: 0, renders: 0, chromiumStarts: 0, ffmpegRuns: 0, ffprobeRuns: 0, pythonRuns: 0, mcpSubprocesses: 0, fixturesPrepared: 0 };
  const resources = [];
  for (const entry of records) {
    if (entry.type === "fixture") counts.fixturesPrepared++;
    if (entry.type === "process-start") {
      counts.processes++;
      if (entry.kind === "render" || entry.kind === "ffmpeg-render") counts.renders++;
      if (entry.kind === "chromium") counts.chromiumStarts++;
      if (entry.kind === "ffmpeg" || entry.kind === "ffmpeg-render") counts.ffmpegRuns++;
      if (entry.kind === "ffprobe") counts.ffprobeRuns++;
      if (entry.kind === "python") counts.pythonRuns++;
      if (entry.kind === "mcp") counts.mcpSubprocesses++;
    }
    if (entry.type === "resource") resources.push(entry);
  }
  return { counts, resources: { instrumentedProcesses: resources.length, maxProcessRssKB: Math.max(0, ...resources.map((item) => item.maxRssKB ?? 0)), cpuUserMs: resources.reduce((sum, item) => sum + (item.userCpuMs ?? 0), 0), cpuSystemMs: resources.reduce((sum, item) => sum + (item.systemCpuMs ?? 0), 0) } };
}

export async function runVitestFiles(files, { label = "skills-vitest" } = {}) {
  const setupStarted = performance.now();
  if (!files.length) throw new Error("No Vitest files selected; refusing empty selection.");
  const packageDir = path.join(ROOT, "packages/motion-skills/skills/video-shotcraft");
  const vitestPath = path.join(packageDir, "node_modules/vitest/vitest.mjs");
  try { await access(vitestPath); }
  catch { throw new Error(`Vitest is not installed at ${vitestPath}; run npm ci --prefix packages/motion-skills/skills/video-shotcraft.`); }

  const testDir = path.join(ROOT, "tests/tmp");
  await mkdir(testDir, { recursive: true });
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 28);
  const metricsFile = path.join(testDir, `test-metrics-${safeLabel}-vitest-${process.pid}.jsonl`);
  const rawReportFile = path.join(testDir, `vitest-raw-${safeLabel}-${process.pid}.json`);
  const reportFile = path.join(testDir, `test-report-${safeLabel}-vitest-${process.pid}.json`);
  await Promise.all([rm(metricsFile, { force: true }), rm(rawReportFile, { force: true })]);

  const oldNodeOptions = process.env.NODE_OPTIONS;
  const oldMetricsFile = process.env.MOTION_TEST_METRICS_FILE;
  const oldTestRoot = process.env.MOTION_TEST_ROOT;
  const preload = pathToFileURL(path.join(ROOT, "scripts/test-metrics-preload.mjs")).href;
  process.env.NODE_OPTIONS = `${oldNodeOptions ? `${oldNodeOptions} ` : ""}--import=${preload}`;
  process.env.MOTION_TEST_METRICS_FILE = metricsFile;
  process.env.MOTION_TEST_ROOT = ROOT;
  const preparationMs = performance.now() - setupStarted;
  const runnerStarted = performance.now();
  let result;
  let raw = null;
  try {
    const relativeFiles = files.map((file) => path.relative(packageDir, path.isAbsolute(file) ? file : path.join(ROOT, file)));
    result = spawnSync(process.execPath, [vitestPath, "run", "--reporter=json", `--outputFile=${rawReportFile}`, ...relativeFiles], {
      cwd: packageDir,
      env: process.env,
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    raw = JSON.parse(await readFile(rawReportFile, "utf8"));
  } catch (error) {
    console.error(`Vitest report could not be collected: ${error.message}`);
  } finally {
    if (oldNodeOptions === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = oldNodeOptions;
    if (oldMetricsFile === undefined) delete process.env.MOTION_TEST_METRICS_FILE;
    else process.env.MOTION_TEST_METRICS_FILE = oldMetricsFile;
    if (oldTestRoot === undefined) delete process.env.MOTION_TEST_ROOT;
    else process.env.MOTION_TEST_ROOT = oldTestRoot;
  }

  const durationMs = performance.now() - runnerStarted;
  const totalMs = performance.now() - setupStarted;
  const testResults = Array.isArray(raw?.testResults) ? raw.testResults : [];
  const filesSeen = testResults.map((entry) => ({
    file: path.relative(ROOT, entry.name ?? "").split(path.sep).join("/"),
    durationMs: Number.isFinite(entry.startTime) && Number.isFinite(entry.endTime) ? Math.max(0, entry.endTime - entry.startTime) : null,
    status: entry.status ?? "unknown",
    tests: entry.assertionResults?.length ?? 0,
    failed: entry.assertionResults?.filter((assertion) => assertion.status === "failed").length ?? 0,
    skipped: entry.assertionResults?.filter((assertion) => ["pending", "todo"].includes(assertion.status)).length ?? 0,
  })).sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0));
  const metricsLines = await readFile(metricsFile, "utf8").catch(() => "");
  const instrumentation = metricsFromLines(metricsLines);
  const skipped = (raw?.numPendingTests ?? 0) + (raw?.numTodoTests ?? 0);
  const failed = raw?.numFailedTests ?? 0;
  const expectedFiles = files.map((file) => path.resolve(ROOT, path.isAbsolute(file) ? path.relative(ROOT, file) : file)).sort();
  const actualFiles = testResults.map((entry) => path.resolve(packageDir, entry.name ?? "")).sort();
  const completeFileSet = testResults.length === expectedFiles.length && actualFiles.every((file, index) => file === expectedFiles[index]);
  const status = result?.status === 0 && raw?.success === true && !failed && !skipped && completeFileSet ? "PASS" : "FAIL";
  const report = {
    schemaVersion: 1,
    label: `${label}:vitest`,
    runner: "vitest",
    status,
    node: process.version,
    startedAt: new Date(Date.now() - totalMs).toISOString(),
    preparationMs,
    durationMs,
    totalMs,
    fileCount: files.length,
    filesSeen: testResults.length,
    passed: raw?.numPassedTests ?? 0,
    failed,
    skipped,
    files: filesSeen,
    ...instrumentation,
  };
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  await Promise.all([rm(metricsFile, { force: true }), rm(rawReportFile, { force: true })]);
  console.log(`Vitest ${label}: ${report.passed} passed; ${failed} failed; ${skipped} skipped; ${filesSeen.length}/${files.length} files. Prep ${(preparationMs / 1000).toFixed(2)}s; runner ${(durationMs / 1000).toFixed(2)}s; total ${(totalMs / 1000).toFixed(2)}s.`);
  console.log(`Slowest Vitest files: ${filesSeen.slice(0, 5).map((entry) => `${entry.file} ${((entry.durationMs ?? 0) / 1000).toFixed(2)}s`).join(" | ") || "file timing unavailable"}`);
  console.log(`Metrics report: ${path.relative(ROOT, reportFile)}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n### Vitest metrics: ${label}\n\n- Prep: ${(preparationMs / 1000).toFixed(2)}s; runner: ${(durationMs / 1000).toFixed(2)}s; total: ${(totalMs / 1000).toFixed(2)}s\n- ${report.passed} passed, ${failed} failed, ${skipped} skipped; selected/collected files: ${files.length}/${testResults.length}\n- Processes: ${report.counts.processes}; renders: ${report.counts.renders}; Chromium: ${report.counts.chromiumStarts}; FFmpeg: ${report.counts.ffmpegRuns}; ffprobe: ${report.counts.ffprobeRuns}; Python: ${report.counts.pythonRuns}; MCP: ${report.counts.mcpSubprocesses}; fixtures: ${report.counts.fixturesPrepared}\n`);
  }
  return { exitCode: status === "PASS" ? 0 : 1, report, reportPath: reportFile };
}

export async function runNodeTestFiles(files, { label = "selected", rejectSkips = true, allowedSkips = [/^transcrição real/i], concurrency, preparationMs = 0 } = {}) {
  if (!files.length) throw new Error("No Node test files selected; refusing empty selection.");
  const testDir = path.join(ROOT, "tests/tmp");
  await mkdir(testDir, { recursive: true });
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 35);
  const metricsFile = path.join(testDir, `test-metrics-${safeLabel}-${process.pid}.jsonl`);
  const reportFile = path.join(testDir, `test-report-${safeLabel}-${process.pid}.json`);
  await rm(metricsFile, { force: true });

  const oldNodeOptions = process.env.NODE_OPTIONS;
  const oldNodePath = process.env.NODE_PATH;
  const preload = pathToFileURL(path.join(ROOT, "scripts/test-metrics-preload.mjs")).href;
  process.env.NODE_OPTIONS = `${oldNodeOptions ? `${oldNodeOptions} ` : ""}--import=${preload}`;
  process.env.NODE_PATH = [...new Set([ROOT, ...(oldNodePath ?? "").split(path.delimiter).filter(Boolean)])].join(path.delimiter);
  process.env.MOTION_TEST_METRICS_FILE = metricsFile;
  process.env.MOTION_TEST_ROOT = ROOT;

  const started = performance.now();
  const fileDurations = new Map();
  const skipped = [];
  const failed = [];
  let passed = 0;
  const concurrencyValue = concurrency ?? (Number(process.env.MOTION_TEST_CONCURRENCY) || true);
  const cwdGroups = new Map();
  for (const file of files) {
    const absolute = path.isAbsolute(file) ? file : path.join(ROOT, file);
    const skillSources = path.join(ROOT, "packages/motion-skills/skills") + path.sep;
    const skillRelative = absolute.startsWith(skillSources) ? path.relative(skillSources, absolute) : null;
    const skillName = skillRelative?.split(path.sep)[0];
    const cwd = skillName
      ? path.join(skillSources, skillName)
      : absolute.startsWith(path.join(ROOT, "packages/motion-skills") + path.sep)
        ? path.join(ROOT, "packages/motion-skills")
        : ROOT;
    const groupFiles = cwdGroups.get(cwd) ?? [];
    groupFiles.push(absolute);
    cwdGroups.set(cwd, groupFiles);
  }

  let exitCode = 0;
  try {
    for (const [cwd, groupFiles] of cwdGroups) {
      process.chdir(cwd);
      const stream = run({ files: groupFiles, concurrency: concurrencyValue });
      stream.on("test:pass", (event) => {
        if (event.details?.type === "suite") return;
        if (event.skip !== undefined) skipped.push({ name: event.name, reason: event.skip });
        else passed++;
      });
      stream.on("test:fail", (event) => { if (event.details?.type !== "suite") failed.push(event.name); });
      stream.on("test:complete", (event) => {
        if (event.nesting === 0 && event.file && event.details?.duration_ms !== undefined) {
          const file = path.relative(ROOT, event.file).split(path.sep).join("/");
          fileDurations.set(file, event.details.duration_ms);
        }
      });
      stream.compose(spec).pipe(process.stdout);
      const groupExit = await new Promise((resolve) => stream.on("end", () => resolve(stream.failed ? 1 : 0)));
      exitCode ||= groupExit;
    }
  } finally {
    process.chdir(ROOT);
  }
  const durationMs = performance.now() - started;
  const refused = skipped.filter((entry) => rejectSkips && !allowedSkips.some((pattern) => pattern.test(entry.name)));
  let instrumentation = { counts: { processes: 0, renders: 0, chromiumStarts: 0, ffmpegRuns: 0, ffprobeRuns: 0, pythonRuns: 0, mcpSubprocesses: 0, fixturesPrepared: 0 }, resources: {} };
  try { instrumentation = metricsFromLines(await readFile(metricsFile, "utf8")); } catch { /* no spawned processes is a valid zero */ }
  const report = {
    schemaVersion: 1,
    label,
    status: exitCode || failed.length || refused.length ? "FAIL" : "PASS",
    node: process.version,
    startedAt: new Date(Date.now() - (preparationMs + durationMs)).toISOString(),
    preparationMs,
    durationMs,
    totalMs: preparationMs + durationMs,
    fileCount: files.length,
    passed,
    failed: failed.length,
    skipped: skipped.length,
    refusedSkips: refused.length,
    files: [...fileDurations].map(([file, duration]) => ({ file, durationMs: duration })).sort((a, b) => b.durationMs - a.durationMs),
    ...instrumentation,
  };
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  await rm(metricsFile, { force: true });
  if (oldNodeOptions === undefined) delete process.env.NODE_OPTIONS;
  else process.env.NODE_OPTIONS = oldNodeOptions;
  if (oldNodePath === undefined) delete process.env.NODE_PATH;
  else process.env.NODE_PATH = oldNodePath;
  delete process.env.MOTION_TEST_METRICS_FILE;
  delete process.env.MOTION_TEST_ROOT;

  console.log(`\n${passed} passed; ${failed.length} failed; ${skipped.length} skipped; ${files.length} files. Prep ${(preparationMs / 1000).toFixed(2)}s; runner ${(durationMs / 1000).toFixed(2)}s; total ${(report.totalMs / 1000).toFixed(2)}s.`);
  console.log(`Instrumentation: ${report.counts.processes} process starts, ${report.counts.renders} renders, ${report.counts.chromiumStarts} Chromium, ${report.counts.ffmpegRuns} FFmpeg, ${report.counts.ffprobeRuns} ffprobe, ${report.counts.pythonRuns} Python, ${report.counts.mcpSubprocesses} MCP, ${report.counts.fixturesPrepared} temp fixtures; peak worker RSS ${report.resources.maxProcessRssKB || "unavailable"} KB.`);
  console.log(`Slowest files: ${report.files.slice(0, 5).map((entry) => `${entry.file} ${(entry.durationMs / 1000).toFixed(2)}s`).join(" | ") || "file-level timing unavailable"}`);
  console.log(`Metrics report: ${path.relative(ROOT, reportFile)}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n### Test metrics: ${label}\n\n- Prep: ${(preparationMs / 1000).toFixed(2)}s; runner: ${(durationMs / 1000).toFixed(2)}s; total: ${(report.totalMs / 1000).toFixed(2)}s\n- ${passed} passed, ${failed.length} failed, ${skipped.length} skipped\n- Processes: ${report.counts.processes}; renders: ${report.counts.renders}; Chromium: ${report.counts.chromiumStarts}; FFmpeg: ${report.counts.ffmpegRuns}; ffprobe: ${report.counts.ffprobeRuns}; Python: ${report.counts.pythonRuns}; MCP: ${report.counts.mcpSubprocesses}; fixtures: ${report.counts.fixturesPrepared}\n- Peak worker RSS: ${report.resources.maxProcessRssKB || "unavailable"} KB\n- Slow files: ${report.files.slice(0, 10).map((entry) => `${entry.file} ${(entry.durationMs / 1000).toFixed(2)}s`).join(", ")}\n`);
  }
  return { exitCode: exitCode || failed.length || refused.length ? 1 : 0, report, reportPath: reportFile, skipped, failed };
}
