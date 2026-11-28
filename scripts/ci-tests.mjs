import { runNodeTestFiles } from "./lib/test-execution.mjs";
import { checkTestCatalog } from "./test-catalog.mjs";

const preparationStarted = performance.now();
const result = await checkTestCatalog();
if (!result.ok) {
  console.error(`FAIL: ${result.message}`);
  process.exit(2);
}
const files = result.entries.filter((entry) => entry.ci.job === "node-matrix" && entry.runner === "node:test").map((entry) => entry.path);
if (!files.length) {
  console.error("No core Node.js tests assigned to CI; refusing empty suite.");
  process.exit(2);
}
const outcome = await runNodeTestFiles(files, { label: "ci-node-matrix", rejectSkips: true, preparationMs: performance.now() - preparationStarted });
process.exitCode = outcome.exitCode;
