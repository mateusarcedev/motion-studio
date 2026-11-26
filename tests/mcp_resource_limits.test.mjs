import { test } from "node:test";
import assert from "node:assert/strict";
import { createMcpRuntime, runLimited, startJob } from "../packages/motion-cli/lib/mcp-tools.mjs";
import { MAX_MCP_OUTSTANDING_REQUESTS, overCapacityResponse } from "../packages/motion-cli/lib/mcp.mjs";

test("MCP outstanding request cap rejects requests and silently drops excess notifications", () => {
  assert.equal(MAX_MCP_OUTSTANDING_REQUESTS, 64);
  assert.equal(overCapacityResponse(63, 4), null);
  assert.deepEqual(overCapacityResponse(64, 5), {
    drop: true,
    response: { jsonrpc: "2.0", id: 5, error: { code: -32001, message: "Too many outstanding MCP requests (limit 64)" } },
  });
  assert.deepEqual(overCapacityResponse(64, undefined), { drop: true, response: null });
});

test("MCP operation queue has a fixed bound and resumes queued work after a slot opens", async () => {
  const runtime = { active: 0, maxConcurrency: 1, maxQueuedOperations: 1, waiters: [] };
  let releaseFirst;
  const first = runLimited(runtime, () => new Promise((resolve) => { releaseFirst = resolve; }));
  await new Promise((resolve) => setImmediate(resolve));
  const second = runLimited(runtime, async () => "queued result");
  await assert.rejects(runLimited(runtime, async () => "overflow"), { code: "MOTION_QUEUE_FULL" });
  releaseFirst("first result");
  assert.equal(await first, "first result");
  assert.equal(await second, "queued result");
  assert.equal(runtime.active, 0);
  assert.equal(runtime.waiters.length, 0);
});

test("MCP job history prunes completed entries and stays within its retention bound", async () => {
  const runtime = createMcpRuntime({ maxConcurrency: 4 });
  const waitForJobs = async (jobs) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (jobs.every((job) => job.status !== "running")) return;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    assert.fail("jobs did not settle within the test window");
  };

  let firstJob;
  for (let offset = 0; offset < 129; offset += 32) {
    const batch = [];
    for (let index = offset; index < Math.min(offset + 32, 129); index++) {
      const job = startJob("limit-test", async () => index, { index }, runtime);
      firstJob ??= job;
      batch.push(job);
    }
    await waitForJobs(batch);
  }

  assert.equal(runtime.jobs.size, 128);
  assert.equal(runtime.jobs.has(firstJob.id), false);
  assert.equal([...runtime.jobs.values()].every((job) => job.status === "done"), true);
});
