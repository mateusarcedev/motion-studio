import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyDeletion, parseArgs, scan } from "../scripts/storage-retention.mjs";

const NOW = Date.now();
const DAY = 86_400_000;

function age(file, days) {
  const t = new Date(NOW - days * DAY);
  utimesSync(file, t, t);
}

function write(file, content = "x", days = 30) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  age(file, days);
}

function fixture() {
  const repo = mkdtempSync(path.join(os.tmpdir(), "retention-"));
  execFileSync("git", ["init", "-q", repo]);
  return { repo, projects: path.join(repo, "projects") };
}

test("old frames with a newer final render are eligible; protected files are never listed", () => {
  const { repo, projects } = fixture();
  try {
    write(path.join(projects, "a/frames/0001.png"), "png", 30);
    write(path.join(projects, "a/out/final.mp4"), "mp4", 20);
    write(path.join(projects, "a/BRIEF.md"), "brief", 30);
    const items = scan({ repoRoot: repo, projectsRoot: projects, days: 7, now: NOW });
    assert.equal(items.length, 1);
    assert.equal(items[0].eligible, true);
    assert.ok(items.every((i) => !/BRIEF|out/.test(path.basename(i.path))));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("recent frames, missing final render, run marker and tracked files are all kept", () => {
  const { repo, projects } = fixture();
  try {
    // recent (in progress)
    write(path.join(projects, "recent/frames/0001.png"), "x", 1);
    write(path.join(projects, "recent/out/f.mp4"), "x", 0);
    // no final render: completion not proven
    write(path.join(projects, "nofinal/frames/0001.png"), "x", 30);
    // run marker
    write(path.join(projects, "locked/frames/0001.png"), "x", 30);
    write(path.join(projects, "locked/out/f.mp4"), "x", 20);
    write(path.join(projects, "locked/render.lock"), "", 1);
    // tracked file inside frames
    write(path.join(projects, "tracked/frames/keep.png"), "x", 30);
    write(path.join(projects, "tracked/out/f.mp4"), "x", 20);
    execFileSync("git", ["-C", repo, "add", "-f", "projects/tracked/frames/keep.png"]);
    // final render OLDER than frames: not proven
    write(path.join(projects, "stale/frames/0001.png"), "x", 10);
    write(path.join(projects, "stale/out/f.mp4"), "x", 20);

    const items = scan({ repoRoot: repo, projectsRoot: projects, days: 7, now: NOW });
    assert.equal(items.length, 5);
    assert.equal(items.filter((i) => i.eligible).length, 0, JSON.stringify(items, null, 1));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("symlinked frames dir is never followed or deleted", () => {
  const { repo, projects } = fixture();
  const outside = mkdtempSync(path.join(os.tmpdir(), "outside-"));
  try {
    write(path.join(outside, "precious.png"), "x", 30);
    mkdirSync(path.join(projects, "s"), { recursive: true });
    symlinkSync(outside, path.join(projects, "s/frames"));
    write(path.join(projects, "s/out/f.mp4"), "x", 20);
    const items = scan({ repoRoot: repo, projectsRoot: projects, days: 7, now: NOW });
    assert.equal(items.filter((i) => i.eligible).length, 0);
    applyDeletion(items, { repoRoot: repo, projectsRoot: projects, days: 7, now: NOW });
    assert.ok(existsSync(path.join(outside, "precious.png")));
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("applyDeletion removes only eligible frames and leaves sources, assets and finals", () => {
  const { repo, projects } = fixture();
  try {
    write(path.join(projects, "a/frames-16x9/0001.png"), "png", 30);
    write(path.join(projects, "a/out/final.mp4"), "mp4", 20);
    write(path.join(projects, "a/assets/logo.svg"), "svg", 30);
    write(path.join(projects, "a/STORYBOARD.md"), "sb", 30);
    write(path.join(projects, "a/.agents/skills/x/SKILL.md"), "s", 30);
    write(path.join(projects, "b/frames/0001.png"), "png", 1); // recent: must survive
    const items = scan({ repoRoot: repo, projectsRoot: projects, days: 7, now: NOW });
    const removed = applyDeletion(items, { repoRoot: repo, projectsRoot: projects, days: 7, now: NOW });
    assert.equal(removed.length, 1);
    assert.ok(!existsSync(path.join(projects, "a/frames-16x9")));
    for (const keep of ["a/out/final.mp4", "a/assets/logo.svg", "a/STORYBOARD.md", "a/.agents/skills/x/SKILL.md", "b/frames/0001.png"]) {
      assert.ok(existsSync(path.join(projects, keep)), `${keep} must be preserved`);
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("a stale eligible flag cannot delete a directory that became active", () => {
  const { repo, projects } = fixture();
  try {
    write(path.join(projects, "a/frames/0001.png"), "png", 30);
    write(path.join(projects, "a/out/final.mp4"), "mp4", 20);
    const items = scan({ repoRoot: repo, projectsRoot: projects, days: 7, now: NOW });
    assert.equal(items[0].eligible, true);
    write(path.join(projects, "a/frames/0002.png"), "new", 0); // run resumed after the scan
    const removed = applyDeletion(items, { repoRoot: repo, projectsRoot: projects, days: 7, now: NOW + 1000 });
    assert.equal(removed.length, 0);
    assert.ok(existsSync(path.join(projects, "a/frames/0001.png")));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("parseArgs rejects unknown flags and bad retention", () => {
  assert.throws(() => parseArgs(["--nuke"]));
  assert.throws(() => parseArgs(["--days=0"]));
  assert.equal(parseArgs([]).apply, false);
  assert.equal(parseArgs([]).days, 7);
});
