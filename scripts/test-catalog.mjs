import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CATALOG_PATH = path.join(ROOT, "docs/testing/test-catalog.json");

const TEST_FILE = /(?:\.(?:test|spec)\.(?:mjs|cjs|js|mts|cts|ts|tsx)|(?:^|\/)(?:test_[^/]+|[^/]+_test|smoke_test)\.py)$/i;
const QUICK_FILES = new Set([
  "tests/bridge_contracts.test.mjs",
  "tests/compare_renders.test.mjs",
  "tests/qa_routing.test.mjs",
  "tests/delivery_integrity.test.mjs",
]);
const NODE_PYTHON_FILES = new Set([
  "packages/motion-skills/skills/brand/scripts/tests/test_sync_brand_to_tokens.py",
  "packages/motion-skills/skills/design-system/scripts/tests/test_validate_tokens.py",
  "packages/motion-skills/skills/ui-styling/scripts/tests/test_shadcn_add.py",
  "packages/motion-skills/skills/ui-styling/scripts/tests/test_tailwind_config_gen.py",
]);
const MANUAL_EXTERNAL = new Map([
  ["packages/motion-skills/skills/video-shotcraft/jianying-export/smoke_test.py", "Requires a macOS Jianying installation and installs a draft into the user application's library; interactive smoke test only."],
]);
const BLOCKED_TESTS = new Map([
  ["packages/motion-skills/skills/ui-ux-pro-max/scripts/tests/test_catalog_refresh.py", {
    sources: ["packages/motion-skills/skills/ui-ux-pro-max/scripts/refresh-google-fonts.py", "packages/motion-skills/skills/ui-ux-pro-max/scripts/refresh-icon-catalog.py"],
    reason: "The test requires its catalog refresh source scripts. The test remains blocked until those implementations are restored.",
  }],
  ["packages/motion-skills/skills/ui-ux-pro-max/scripts/tests/test_relevance_evaluator.py", {
    sources: ["packages/motion-skills/skills/ui-ux-pro-max/scripts/evaluate-relevance.py"],
    reason: "The test requires scripts/evaluate-relevance.py. The test remains blocked until that implementation is restored.",
  }],
]);
// This test names example source paths as selector inputs. They are not imports;
// only its actual runner entrypoints are execution dependencies.
const EXPLICIT_DEPENDENCIES = new Map([
  ["tests/test_catalog.test.mjs", ["scripts/run-test-selection.mjs", "scripts/ci_python_tests.py"]],
  ["scripts/test-catalog.mjs", []],
]);
const METADATA_OVERRIDES = new Map([
  ["tests/test_catalog.test.mjs", {
    category: "integration",
    externalResources: ["Git", "Node.js subprocess", "Python"],
    requires: { chromium: false, ffmpeg: false, python: true, mcpSubprocess: false, network: false },
    cost: "medium",
    groups: ["core-node", "integration"],
    externalDependencies: [],
  }],
]);

export function relativeImports(source) {
  const values = new Set();
  const patterns = [
    /^\s*import\s+(?:[^'";\n]+?\s+from\s+)?["']([^"']+)["']/gm,
    /^\s*export\s+[^'";\n]*?\s+from\s+["']([^"']+)["']/gm,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) if (match[1].startsWith(".")) values.add(match[1]);
  }
  return [...values].sort();
}

export function packageImports(source) {
  const values = new Set();
  const patterns = [
    /^\s*import\s+(?:[^'";\n]+?\s+from\s+)?["']([^"']+)["']/gm,
    /^\s*export\s+[^'";\n]*?\s+from\s+["']([^"']+)["']/gm,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire(?:\.resolve)?\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  const builtins = new Set(builtinModules.map((name) => name.replace(/^node:/, "")));
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("node:")) continue;
      const parts = specifier.split("/");
      const name = specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
      if (name && !builtins.has(name)) values.add("npm:" + name);
    }
  }
  return [...values].sort();
}

export function pythonImports(source) {
  const values = new Set();
  for (const line of source.split(/\r?\n/)) {
    const from = line.match(/^\s*from\s+([.\w]+)\s+import\s+/);
    if (from) values.add(from[1]);
    const imported = line.match(/^\s*import\s+(.+?)\s*(?:#.*)?$/);
    if (imported) {
      for (const part of imported[1].split(",")) {
        const name = part.trim().split(/\s+as\s+/)[0];
        if (/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(name)) values.add(name);
      }
    }
  }
  return [...values].sort();
}

export function pythonFileReferences(source) {
  return [...new Set([...source.matchAll(/["']([^"'\/]+\.py)["']/g)].map((match) => match[1]))].sort();
}

export function sourceFileReferences(source) {
  return [...new Set([...source.matchAll(/["']([^"']+\.(?:mjs|cjs|js|mts|cts|ts|tsx|py|json|html|svg|css|ya?ml|txt|md|csv))["']/g)].map((match) => match[1]))].sort();
}

const PYTHON_STDLIB = new Set([
  "__future__", "argparse", "ast", "asyncio", "base64", "collections", "contextlib", "copy", "csv", "dataclasses", "datetime", "difflib",
  "enum", "fnmatch", "glob", "hashlib", "http", "importlib", "io", "itertools", "json", "math", "os",
  "pathlib", "random", "re", "shutil", "statistics", "string", "struct", "subprocess", "sys", "tempfile",
  "mimetypes", "platform", "resource", "stat", "textwrap", "time", "types", "typing", "unittest", "unicodedata",
  "socket", "urllib", "uuid", "warnings", "wave", "xml", "zlib", "zipfile",
]);

const RESOLVE_EXTENSIONS = ["", ".mjs", ".js", ".cjs", ".ts", ".tsx", ".json", ".py", ".html", ".svg", ".css", ".yaml", ".yml", ".txt", ".md", ".csv", "/index.mjs", "/index.js"];
export async function resolveLocalImport(importer, specifier) {
  const base = path.resolve(ROOT, path.dirname(importer), specifier);
  for (const suffix of RESOLVE_EXTENSIONS) {
    const candidate = `${base}${suffix}`;
    try {
      await readFile(candidate);
      return path.relative(ROOT, candidate).split(path.sep).join("/");
    } catch { /* try the next conventional module suffix */ }
  }
  return null;
}

export async function resolvePythonImport(importer, specifier, pythonFiles) {
  const importerDir = path.dirname(path.join(ROOT, importer));
  const relativeDots = specifier.match(/^\.+/)?.[0].length ?? 0;
  const moduleName = specifier.slice(relativeDots);
  const modulePath = moduleName.replaceAll(".", "/");
  const bases = [];
  if (relativeDots) {
    let base = importerDir;
    for (let index = 1; index < relativeDots; index++) base = path.dirname(base);
    bases.push(base);
  } else {
    for (let base = importerDir; base.startsWith(ROOT); base = path.dirname(base)) {
      bases.push(base);
      if (base === ROOT) break;
    }
  }
  const known = new Set(pythonFiles);
  for (const base of bases) {
    const candidates = modulePath
      ? [path.join(base, modulePath + ".py"), path.join(base, modulePath, "__init__.py")]
      : [];
    for (const candidate of candidates) {
      const relative = path.relative(ROOT, candidate).split(path.sep).join("/");
      if (known.has(relative)) return relative;
    }
  }
  if (!relativeDots && modulePath) {
    const suffixes = ["/" + modulePath + ".py", "/" + modulePath + "/__init__.py"];
    const matches = pythonFiles.filter((file) => suffixes.some((suffix) => file.endsWith(suffix)));
    if (matches.length === 1) return matches[0];
  }
  return null;
}

async function resolveSourceReference(importer, specifier, sourceFiles, pythonFiles) {
  if (importer.endsWith(".py")) {
    const pythonImport = await resolvePythonImport(importer, specifier, pythonFiles);
    if (pythonImport) return pythonImport;
  }
  const normalized = specifier.replaceAll("\\", "/");
  const skillRoot = importer.match(/^(packages\/motion-skills\/skills\/[^/]+)/)?.[1];
  const rootRelative = normalized.startsWith("packages/") || normalized.startsWith("creative-core/");
  const roots = rootRelative
    ? [ROOT]
    : [path.dirname(path.join(ROOT, importer)), ...(skillRoot ? [path.join(ROOT, skillRoot)] : []), ROOT];
  for (const root of roots) {
    const base = rootRelative ? path.join(ROOT, normalized) : path.resolve(root, normalized);
    for (const suffix of RESOLVE_EXTENSIONS) {
      const candidate = base + suffix;
      const relative = path.relative(ROOT, candidate).split(path.sep).join("/");
      if (sourceFiles.has(relative)) return relative;
    }
  }
  if (importer.endsWith(".py") && !normalized.includes("/") && normalized.endsWith(".py")) {
    const matches = [...sourceFiles].filter((file) => path.basename(file) === normalized);
    if (matches.length === 1) return matches[0];
  }
  return null;
}

async function directDependencies(file, source, sourceFiles, pythonFiles) {
  const direct = new Set();
  const explicitDependencies = EXPLICIT_DEPENDENCIES.get(file);
  const specifiers = file.endsWith(".py")
    ? [...pythonImports(source), ...(explicitDependencies ?? sourceFileReferences(source))]
    : [...relativeImports(source), ...(explicitDependencies ?? sourceFileReferences(source))];
  const skillRoot = file.match(/^(packages\/motion-skills\/skills\/[^/]+)/)?.[1];
  const dynamicScriptKinds = [...new Set([...source.matchAll(/\b(?:run|execute)\(\s*["']([a-z][a-z0-9-]*)["']/gi)].map((match) => match[1]))];
  if (skillRoot && /["']scripts\/["']\s*\+/.test(source)) {
    for (const name of dynamicScriptKinds) specifiers.push(skillRoot + "/scripts/" + name + ".mjs");
  }
  if (skillRoot && /new URL\s*\(/.test(source) && /import\.meta\.url/.test(source) && /\.mjs/.test(source)) {
    const loopValues = [...source.matchAll(/\bfor\s*\(\s*const\s+\w+\s+of\s+\[([^\]]+)\]/g)]
      .flatMap((loop) => [...loop[1].matchAll(/["']([a-z][a-z0-9-]*)["']/gi)].map((match) => match[1]));
    for (const name of loopValues) {
      const candidate = skillRoot + "/scripts/" + name + ".mjs";
      if (sourceFiles.has(candidate)) specifiers.push(candidate);
    }
  }
  for (const specifier of specifiers) {
    const resolved = await resolveSourceReference(file, specifier, sourceFiles, pythonFiles);
    if (resolved && resolved !== file) direct.add(resolved);
  }
  return [...direct].sort();
}

async function analyzeDependencies(file, source, sourceFiles, pythonFiles) {
  const direct = await directDependencies(file, source, sourceFiles, pythonFiles);
  const transitive = new Set();
  const analyzed = new Set([file, ...direct]);
  const sources = [{ path: file, source }];
  const queue = [...direct];
  while (queue.length) {
    const dependency = queue.shift();
    transitive.add(dependency);
    const dependencySource = await readFile(path.join(ROOT, dependency), "utf8").catch(() => null);
    if (dependencySource === null) continue;
    sources.push({ path: dependency, source: dependencySource });
    for (const child of await directDependencies(dependency, dependencySource, sourceFiles, pythonFiles)) {
      if (!analyzed.has(child)) {
        analyzed.add(child);
        queue.push(child);
      }
    }
  }
  for (const dependency of direct) transitive.delete(dependency);
  return { direct, transitive: [...transitive].sort(), sources };
}

function getModule(file) {
  const segments = file.split("/");
  if (segments[0] === "tests") return "motion-studio";
  if (segments[0] === "packages" && segments[1] === "motion-skills") {
    const skillsIndex = segments.indexOf("skills");
    return skillsIndex >= 0 && segments[skillsIndex + 1] ? `skill:${segments[skillsIndex + 1]}` : "motion-skills";
  }
  if (segments[0] === "packages" && segments[1]) return segments[1];
  return segments.slice(0, 2).join("/");
}

function classify(file, source, dependencyPaths = []) {
  if (MANUAL_EXTERNAL.has(file)) {
    return {
      runner: "manual",
      category: "external",
      module: getModule(file),
      externalResources: ["macOS", "Jianying desktop application", "local application library"],
      requires: { chromium: false, ffmpeg: true, python: true, mcpSubprocess: false, network: false },
      cost: "high",
      criticality: "optional",
      groups: ["manual"],
      ci: { job: "manual", status: "manual", reason: MANUAL_EXTERNAL.get(file) },
    };
  }

  const isPython = file.endsWith(".py");
  const isVitest = file.endsWith(".test.ts") || file.endsWith(".spec.ts") || file.endsWith(".test.tsx") || file.endsWith(".spec.tsx");
  const runner = isPython ? "pytest" : isVitest ? "vitest" : "node:test";
  const lower = file.toLowerCase();
  const analyzedPaths = [file, ...dependencyPaths].join("\n").toLowerCase();
  const browser = /drive\.mjs|capture\.mjs|chrome|chromium|playwright/.test(source.toLowerCase()) || /renderFrames|renderTimeline|renderVideo|renderCarousel/.test(source) || /drive\.mjs|capture\.mjs|chromium|playwright/.test(analyzedPaths);
  const ffmpeg = /ffmpeg|ffprobe/.test(source.toLowerCase()) || /transitions_ffmpeg|determinism|reel_(?:voice|editor|captions)|carve|dither/.test(analyzedPaths);
  const python = isPython || /python(?:3)?\b/.test(source) || dependencyPaths.some((dependency) => dependency.endsWith(".py"));
  const mcpSubprocess = /(?:^|\/)mcp_|mcp[_-](?:server|parity|resources)/i.test(analyzedPaths) || /motion\s+mcp|mcp.*stdio/i.test(source);
  const subprocess = /child_process|subprocess|execFile|spawn\s*\(/.test(source);
  const requiresNode = isPython && NODE_PYTHON_FILES.has(file);
  const module = getModule(file);
  const skillFile = file.startsWith("packages/motion-skills/");
  const manualCategory = /test_upload_post/.test(lower) ? "integration" : null;

  let category = "unit";
  if (/determinism/.test(analyzedPaths) || (ffmpeg && (/^tests\//.test(file) || skillFile))) category = "media";
  else if (browser || mcpSubprocess || /^(?:tests\/)?(?:e2e_|installer|skills_distribution|m5_skills|bridge_(?:doop_adapter|export_to_editor|hydrator))/.test(file) || manualCategory) category = "integration";
  else if (ffmpeg && skillFile) category = "media";

  const groups = new Set([category]);
  if (isPython) groups.add("python");
  if (skillFile) groups.add("skills");
  if (skillFile && (runner === "node:test" || runner === "vitest")) groups.add("skills-node");
  if (requiresNode) groups.add("node-python");
  if (!requiresNode && isPython) groups.add("python-standalone");
  if (mcpSubprocess) groups.add("mcp");
  if (/bridge/.test(lower)) groups.add("bridge");
  if (/svg|safe.zone|hydrator|parser/.test(lower)) groups.add("svg-security");
  if (/audio|voice|caption|transcri|bgm|tts|sfx|carve/.test(lower)) groups.add("audio");
  if (/determinism|render|reel|transition|ffmpeg|visual_assets/.test(lower)) groups.add("render");
  if (QUICK_FILES.has(file)) groups.add("quick");
  if (!skillFile && runner === "node:test") groups.add("core-node");

  let ciJob = "node-matrix";
  if (isPython) ciJob = requiresNode ? "node-matrix" : "python";
  else if (isVitest) ciJob = "skills-node";
  else if (skillFile) ciJob = "skills-node";

  const cost = browser || ffmpeg || /e2e|parity|voice|determinism/.test(lower) ? "high" : subprocess ? "medium" : "low";
  const criticality = /mcp|bridge|determinism|security|delivery|reliability/.test(lower) ? "critical" : "standard";

  return {
    runner,
    category,
    module,
    externalResources: [browser && "Chromium", ffmpeg && "FFmpeg", python && "Python", mcpSubprocess && "local MCP subprocess"].filter(Boolean),
    requires: { chromium: browser, ffmpeg, python, mcpSubprocess, network: false },
    cost,
    criticality,
    groups: [...groups].sort(),
    ci: { job: ciJob, status: "run" },
  };
}

export async function buildTestCatalog(root = ROOT) {
  const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" });
  const trackedFiles = tracked.split("\0").filter(Boolean);
  const sourceFiles = new Set(trackedFiles.filter((file) => /^(?:tests|packages|scripts|creative-core|web)\//.test(file) && /\.(?:mjs|cjs|js|mts|cts|ts|tsx|py|json|html|svg|css|ya?ml|txt|md|csv)$/.test(file)));
  const pythonFiles = [...sourceFiles].filter((file) => file.endsWith(".py"));
  const discovered = trackedFiles.filter((file) => /^(?:tests|packages|scripts)\//.test(file) && TEST_FILE.test(file)).sort().map((file) => ({ path: file, absolute: path.join(root, file) }));
  const entries = [];
  for (const item of discovered) {
    const file = item.path;
    const source = await readFile(item.absolute, "utf8");
    const graph = await analyzeDependencies(file, source, sourceFiles, pythonFiles);
    const analyzedSource = graph.sources.map((item) => item.source).join("\n");
    const dependencies = [...new Set(graph.direct)].sort();
    const transitiveDependencies = [...new Set(graph.transitive)].sort();
    const metadata = { ...classify(file, analyzedSource, [...dependencies, ...transitiveDependencies]), ...METADATA_OVERRIDES.get(file) };
    const blockedRecord = BLOCKED_TESTS.get(file);
    const missingSources = blockedRecord ? await Promise.all(blockedRecord.sources.map(async (sourcePath) => {
      try { await access(path.join(root, sourcePath)); return null; }
      catch { return sourcePath; }
    })).then((values) => values.filter(Boolean)) : [];
    if (missingSources.length) {
      metadata.ci.status = "blocked";
      metadata.ci.reason = `${blockedRecord.reason} Missing source: ${missingSources.join(", ")}.`;
    }
    const externalDependencies = new Set();
    for (const record of graph.sources) {
      if (record.path.endsWith(".py")) {
        if (record.path === file && !MANUAL_EXTERNAL.has(file)) externalDependencies.add("python:pytest");
        for (const specifier of pythonImports(record.source)) {
          const resolved = await resolvePythonImport(record.path, specifier, pythonFiles);
          const topLevel = specifier.replace(/^\.+/, "").split(".")[0];
          if (!resolved && topLevel && !PYTHON_STDLIB.has(topLevel)) {
            externalDependencies.add("python:" + (topLevel === "PIL" ? "pillow" : topLevel));
          }
        }
      } else if (/\.(?:mjs|cjs|js|mts|cts|ts|tsx)$/.test(record.path)) {
        for (const dependency of packageImports(record.source)) externalDependencies.add(dependency);
      }
    }
    if (metadata.runner === "vitest") externalDependencies.add("npm:vitest");
    entries.push({
      path: file,
      ...metadata,
      dependencies,
      transitiveDependencies,
      externalDependencies: metadata.externalDependencies ?? [...externalDependencies].sort(),
    });
  }
  return { version: 1, generatedAt: "source-controlled", testCount: entries.length, entries };
}

export async function writeTestCatalog(root = ROOT) {
  const catalog = await buildTestCatalog(root);
  const catalogPath = path.join(root, "docs/testing/test-catalog.json");
  await mkdir(path.dirname(catalogPath), { recursive: true });
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  return catalog;
}

export async function checkTestCatalog(root = ROOT) {
  const catalogPath = path.join(root, "docs/testing/test-catalog.json");
  const expected = `${JSON.stringify(await buildTestCatalog(root), null, 2)}\n`;
  let actual;
  try { actual = await readFile(catalogPath, "utf8"); }
  catch { return { ok: false, message: `Catalog missing: ${path.relative(root, catalogPath)}. Run npm run test:catalog:write.` }; }
  if (actual !== expected) return { ok: false, message: "Test catalog is stale or a discovered test file has not been classified. Run npm run test:catalog:write and review the diff." };

  const entries = JSON.parse(actual).entries;
  const validJobs = new Set(["node-matrix", "skills-node", "python", "manual"]);
  const missingCoverage = entries.filter((entry) => !validJobs.has(entry.ci?.job) || !["run", "manual", "blocked"].includes(entry.ci.status) || (["manual", "blocked"].includes(entry.ci.status) && !entry.ci.reason));
  if (missingCoverage.length) return { ok: false, message: `Tests without explicit CI/manual coverage: ${missingCoverage.map((entry) => entry.path).join(", ")}` };
  const counts = Object.fromEntries(["run", "manual", "blocked"].map((status) => [status, entries.filter((entry) => entry.ci.status === status).length]));
  return { ok: true, count: entries.length, counts, entries };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] ?? "--check";
  if (mode === "--write") {
    const catalog = await writeTestCatalog();
    console.log(`Wrote ${catalog.testCount} test records to ${path.relative(ROOT, CATALOG_PATH)}`);
  } else {
    const result = await checkTestCatalog();
    if (result.ok) {
      const { run, manual, blocked } = result.counts;
      const message = blocked
        ? `COVERAGE WITH BLOCKERS: ${result.count} classified; ${run} runnable in CI, ${manual} documented manual, ${blocked} blocked. See each blocked entry's reason in ${path.relative(ROOT, CATALOG_PATH)}.`
        : `PASS: ${result.count} tests classified and assigned to CI or documented manual coverage.`;
      console.log(message);
      if (blocked && process.env.GITHUB_STEP_SUMMARY) {
        const details = result.entries.filter((entry) => entry.ci.status === "blocked").map((entry) => `- \`${entry.path}\`: ${entry.ci.reason}`).join("\n");
        await writeFile(process.env.GITHUB_STEP_SUMMARY, `## Test catalog coverage\n\n${message}\n\n${details}\n`, { flag: "a" });
      }
    } else console.log(`FAIL: ${result.message}`);
    if (!result.ok) process.exitCode = 1;
  }
}
