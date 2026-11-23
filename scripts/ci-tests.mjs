/**
 * Runs the full node:test suite and refuses silent skips: a skipped test is listed, and only
 * reasons in ALLOWED_SKIPS are accepted (the CI never downloads a speech model).
 */
import { appendFile, readdir } from "node:fs/promises";
import path from "node:path";
import { run } from "node:test";
import { spec } from "node:test/reporters";
import { fileURLToPath } from "node:url";

const ALLOWED_SKIPS = [/^transcrição real/i];
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tests");
const files = (await readdir(dir)).filter((f) => f.endsWith(".test.mjs")).sort().map((f) => path.join(dir, f));
const skipped = [], failed = [];
let passed = 0;
const stream = run({ files, concurrency: Number(process.env.MOTION_TEST_CONCURRENCY) || true });
stream.on("test:pass", (e) => { if (e.details?.type === "suite") return; if (e.skip !== undefined) skipped.push({ name: e.name, reason: e.skip }); else passed++; });
stream.on("test:fail", (e) => { if (e.details?.type !== "suite") failed.push(e.name); });
stream.compose(spec).pipe(process.stdout);
stream.on("end", async () => {
  const refused = skipped.filter((s) => !ALLOWED_SKIPS.some((r) => r.test(s.name)));
  const lines = [`${passed} aprovados, ${failed.length} falhos, ${skipped.length} pulados (NOT_TESTED)`, ...skipped.map((s) => `- pulado${refused.includes(s) ? " SEM AUTORIZAÇÃO" : ""}: ${s.name}${typeof s.reason === "string" ? ` — ${s.reason}` : ""}`)];
  console.log(`\n${lines.join("\n")}`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Testes (Node ${process.version})\n\n${lines.join("\n")}\n`);
  process.exitCode = failed.length || refused.length ? 1 : 0;
});
