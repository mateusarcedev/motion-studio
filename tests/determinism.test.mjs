import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { verifyDeterminism } from "../packages/motion-core/quality/determinism.mjs";

const deterministicHtml = `<!doctype html><html><head><style>html,body{margin:0;background:transparent}</style></head><body>
<svg width="160" height="90"><rect id="box" width="30" height="30" fill="#2563eb"/></svg>
<script>window.__onFrame__=(M)=>{document.querySelector('#box').setAttribute('x',String(20+M.frame*11))}</script>
</body></html>`;

const nondeterministicHtml = `<!doctype html><html><head><style>html,body{margin:0;background:transparent}</style></head><body>
<svg width="160" height="90"><rect id="box" width="160" height="90"/></svg>
<script>window.__onFrame__=()=>{document.querySelector('#box').setAttribute('fill','#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'))}</script>
</body></html>`;

test("independent fresh renders report identical sampled-frame SHA-256 and environment", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "motion-determinism-pass-"));
  try {
    const input = path.join(root, "deterministic.html"), outputDir = path.join(root, "report");
    await writeFile(input, deterministicHtml);
    const report = await verifyDeterminism(input, {
      duration: 1, fps: 5, width: 160, height: 90, sampleTimes: [0, 0.4, 0.8], outputDir,
    });
    assert.equal(report.passed, true, JSON.stringify({ samples: report.samples, diagnostics: report.diagnostics, environment: report.environment }));
    assert.equal(report.framePixelDeterminism, true);
    assert.equal(report.samples.length, 3);
    assert.equal(report.samples[0].sessionA.sha256, report.samples[0].sessionB.sha256);
    assert.ok(report.environment.node);
    assert.ok(report.environment.chromium);
    assert.equal(report.environment.fontsReady, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("pixel mismatch blocks determinism approval and saves A/B/difference frames", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "motion-determinism-fail-"));
  try {
    const input = path.join(root, "random.html"), outputDir = path.join(root, "report");
    await writeFile(input, nondeterministicHtml);
    const report = await verifyDeterminism(input, {
      duration: 0.6, fps: 5, width: 160, height: 90, sampleTimes: [0, 0.4], outputDir,
    });
    assert.equal(report.passed, false);
    assert.equal(report.approval, "blocked");
    assert.ok(report.staticRisks.some((risk) => risk.category === "unseeded-random"));
    const mismatch = report.samples.find((sample) => !sample.identical);
    assert.ok(mismatch);
    assert.ok(await stat(mismatch.evidence.diff));
    assert.ok(await stat(mismatch.evidence.sessionA));
    assert.ok(await stat(mismatch.evidence.sessionB));
    assert.equal(JSON.parse(await readFile(report.reportPath, "utf8")).passed, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
