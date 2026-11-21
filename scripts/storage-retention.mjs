#!/usr/bin/env node
// Storage retention report for regenerable render intermediates.
//
// Default mode is READ-ONLY. Nothing is deleted unless --apply is given AND the
// operator types the confirmation phrase (or passes --confirm=DELETE when not in a TTY).
//
// What counts as a regenerable candidate (all already git-ignored):
//   projects/<p>/frames, projects/<p>/frames-*, projects/<p>/reviews/frames
// A candidate is only eligible when ALL of these hold:
//   1. older than --days (default 7), judged by the newest file inside it;
//   2. completion is proven: <p>/out contains a final deliverable
//      (.mp4 .webm .mov .gif .zip) not older than the newest frame;
//   3. no run marker in the project (*.lock, *.pid, render.lock);
//   4. it is a real directory (not a symlink), inside the projects root;
//   5. it holds no git-tracked file.
// Everything else (sources, assets, configs, out/, reviews/*.md, skills, .agents,
// final renders) is never touched.
//
// Usage: node scripts/storage-retention.mjs [--days N] [--root DIR] [--dry-run]
//                                           [--apply] [--confirm=DELETE] [--json]
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, realpathSync, rmSync } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const FINAL_EXT = new Set([".mp4", ".webm", ".mov", ".gif", ".zip"]);
const RUN_MARKERS = [/\.lock$/i, /\.pid$/i];
const DAY_MS = 86_400_000;

export function parseArgs(argv) {
  const opts = { days: 7, root: null, apply: false, dryRun: false, json: false, confirm: null };
  for (const arg of argv) {
    if (arg === "--apply") opts.apply = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--json") opts.json = true;
    else if (arg.startsWith("--days=")) opts.days = Number(arg.slice(7));
    else if (arg.startsWith("--root=")) opts.root = arg.slice(7);
    else if (arg.startsWith("--confirm=")) opts.confirm = arg.slice(10);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isFinite(opts.days) || opts.days < 1) throw new Error("--days must be >= 1");
  return opts;
}

/** Walk a dir without following symlinks; returns { bytes, files, newestMs }. */
export function measure(dir) {
  let bytes = 0;
  let files = 0;
  let newestMs = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        const st = lstatSync(full);
        bytes += st.size;
        files += 1;
        if (st.mtimeMs > newestMs) newestMs = st.mtimeMs;
      }
    }
  }
  return { bytes, files, newestMs };
}

function hasTrackedFiles(repoRoot, dir) {
  try {
    const out = execFileSync("git", ["-C", repoRoot, "ls-files", "--", dir], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim().length > 0;
  } catch {
    return true; // cannot prove it is untracked: protect it
  }
}

function newestFinalMs(outDir) {
  if (!existsSync(outDir)) return 0;
  let newest = 0;
  for (const entry of readdirSync(outDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!FINAL_EXT.has(path.extname(entry.name).toLowerCase())) continue;
    const st = lstatSync(path.join(outDir, entry.name));
    if (st.size > 0 && st.mtimeMs > newest) newest = st.mtimeMs;
  }
  return newest;
}

function hasRunMarker(projectDir) {
  return readdirSync(projectDir, { withFileTypes: true }).some(
    (e) => e.isFile() && RUN_MARKERS.some((re) => re.test(e.name)),
  );
}

function candidateDirs(projectDir) {
  const found = [];
  for (const entry of readdirSync(projectDir, { withFileTypes: true })) {
    if (entry.isDirectory() && (entry.name === "frames" || entry.name.startsWith("frames-"))) {
      found.push(path.join(projectDir, entry.name));
    }
  }
  const reviewFrames = path.join(projectDir, "reviews", "frames");
  if (existsSync(reviewFrames)) found.push(reviewFrames);
  return found;
}

/** Classify every candidate. Pure with respect to the filesystem: never deletes. */
export function scan({ repoRoot, projectsRoot, days = 7, now = Date.now() }) {
  const realProjects = realpathSync(projectsRoot);
  const results = [];
  for (const proj of readdirSync(projectsRoot, { withFileTypes: true })) {
    if (!proj.isDirectory()) continue;
    const projectDir = path.join(projectsRoot, proj.name);
    for (const dir of candidateDirs(projectDir)) {
      const item = { project: proj.name, path: dir, bytes: 0, files: 0, eligible: false, reason: "" };
      const st = lstatSync(dir);
      if (st.isSymbolicLink() || !st.isDirectory()) {
        item.reason = "protected: not a plain directory (symlink)";
        results.push(item);
        continue;
      }
      if (!realpathSync(dir).startsWith(realProjects + path.sep)) {
        item.reason = "protected: outside projects root";
        results.push(item);
        continue;
      }
      const m = measure(dir);
      Object.assign(item, { bytes: m.bytes, files: m.files });
      const ageDays = (now - m.newestMs) / DAY_MS;
      if (hasTrackedFiles(repoRoot, dir)) item.reason = "protected: contains git-tracked files";
      else if (hasRunMarker(projectDir)) item.reason = "protected: run marker present (run may be active)";
      else if (m.files > 0 && ageDays < days)
        item.reason = `kept: newest file is ${ageDays.toFixed(1)}d old (< ${days}d retention)`;
      else if (newestFinalMs(path.join(projectDir, "out")) < m.newestMs)
        item.reason = "protected: completion not proven (no final render in out/ newer than frames)";
      else {
        item.eligible = true;
        item.reason = `eligible: ${ageDays.toFixed(1)}d old, final render present`;
      }
      results.push(item);
    }
  }
  return results;
}

/** Deletes only eligible items, re-validating each right before removal. */
export function applyDeletion(items, { repoRoot, projectsRoot, days, now = Date.now() }) {
  const fresh = scan({ repoRoot, projectsRoot, days, now });
  const allowed = new Set(fresh.filter((i) => i.eligible).map((i) => i.path));
  const removed = [];
  for (const item of items) {
    if (!item.eligible || !allowed.has(item.path)) continue;
    rmSync(item.path, { recursive: true, force: false });
    removed.push(item);
  }
  return removed;
}

const fmt = (b) => (b >= 2 ** 30 ? `${(b / 2 ** 30).toFixed(2)} GB` : `${(b / 2 ** 20).toFixed(1)} MB`);

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "..");
  const projectsRoot = path.resolve(opts.root ?? path.join(repoRoot, "projects"));
  const items = scan({ repoRoot, projectsRoot, days: opts.days });
  const eligible = items.filter((i) => i.eligible);
  const reclaim = eligible.reduce((s, i) => s + i.bytes, 0);

  if (opts.json) console.log(JSON.stringify({ items, reclaimableBytes: reclaim }, null, 2));
  else {
    for (const i of items) console.log(`${i.eligible ? "[candidate]" : "[keep]     "} ${fmt(i.bytes).padStart(10)}  ${i.path}\n             ${i.reason}`);
    console.log(`\nReclaimable (eligible only): ${fmt(reclaim)} in ${eligible.length} dir(s). Mode: ${opts.apply && !opts.dryRun ? "APPLY" : "read-only"}.`);
  }
  if (!opts.apply || opts.dryRun || eligible.length === 0) return;

  let confirmed = opts.confirm === "DELETE";
  if (!confirmed) {
    if (!process.stdin.isTTY) {
      console.error("Refusing to delete: not a TTY and --confirm=DELETE not given.");
      process.exitCode = 2;
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    confirmed = (await rl.question(`Type DELETE to remove ${eligible.length} dir(s) (${fmt(reclaim)}): `)).trim() === "DELETE";
    rl.close();
  }
  if (!confirmed) {
    console.error("Not confirmed. Nothing deleted.");
    process.exitCode = 2;
    return;
  }
  const removed = applyDeletion(eligible, { repoRoot, projectsRoot, days: opts.days });
  console.log(`Removed ${removed.length} dir(s), ${fmt(removed.reduce((s, i) => s + i.bytes, 0))}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
