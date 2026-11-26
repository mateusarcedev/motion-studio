import test from "node:test";
import assert from "node:assert/strict";
import { classifyDeterminismComparisons, parseDeterminismReplayArgs } from "../scripts/lib/determinism-investigation.mjs";

test("parses final-stage replay options without invoking the full determinism pipeline", () => {
  assert.deepEqual(parseDeterminismReplayArgs([
    "--source", "evidence/render-a", "--runs=4", "--evidence-dir", "/tmp/motion-evidence", "--expect-difference",
  ]), {
    source: "evidence/render-a",
    runs: 4,
    evidenceDir: "/tmp/motion-evidence",
    expectDifference: true,
    help: false,
  });
});

test("rejects missing source, invalid repeat count, and unknown options", () => {
  assert.throws(() => parseDeterminismReplayArgs([]), /--source is required/);
  assert.throws(() => parseDeterminismReplayArgs(["--source=x", "--runs=1"]), /integer from 2 to 8/);
  assert.throws(() => parseDeterminismReplayArgs(["--source=x", "--force-pass"]), /Unknown argument/);
});

test("reports a completed stream divergence as confirmed failure", () => {
  assert.deepEqual(classifyDeterminismComparisons([
    { status: "different", identical: false, different: ["video.decoded"] },
  ]), {
    status: "FAIL_CONFIRMED",
    exitCode: 1,
    confirmedDifferences: 1,
    inconclusiveComparisons: 0,
    reason: "at-least-one-completed-media-comparison-differed",
  });
});

test("reports unreadable renders and absent expected divergence as inconclusive", () => {
  assert.equal(classifyDeterminismComparisons([{ status: "read-error", identical: false }]).status, "INCONCLUSIVE");
  assert.equal(classifyDeterminismComparisons([{ status: "identical", identical: true }], { expectDifference: true }).status, "INCONCLUSIVE");
  assert.equal(classifyDeterminismComparisons([], { executionErrors: [{ message: "render failed" }] }).exitCode, 2);
  assert.equal(classifyDeterminismComparisons([]).status, "INCONCLUSIVE", "a missing comparison can never pass");
  assert.equal(classifyDeterminismComparisons([{ status: "unknown", identical: false }]).status, "INCONCLUSIVE");
});

test("reports pass only when every completed media comparison is identical", () => {
  assert.deepEqual(classifyDeterminismComparisons([
    { status: "identical", identical: true },
    { status: "identical", identical: true },
  ]), {
    status: "PASS",
    exitCode: 0,
    confirmedDifferences: 0,
    inconclusiveComparisons: 0,
    reason: "all-completed-comparisons-were-identical",
  });
});
