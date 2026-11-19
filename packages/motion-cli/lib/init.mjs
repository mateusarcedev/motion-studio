import { runBootstrap } from "./bootstrap/index.mjs";

/** `motion init` — thin wrapper over the shared bootstrap (same code path as the public installer). */
export async function runInit(options = {}) {
  const report = await runBootstrap(options);
  process.exitCode = report.exitCode;
  return report;
}
