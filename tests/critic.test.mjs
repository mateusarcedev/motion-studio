/** Mission 21.1 (B5) — structured Critic review, recorded unedited and verified by hash. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recordCritic, validateCritic, verifyCritic, reel as R } from "../packages/motion-core/index.js";
import { ff } from "./helpers/reel-fixtures.mjs";

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "packages/motion-cli/bin/motion.mjs");
const review = (o = {}) => ({ schema: "motion.critic.findings", schemaVersion: 1, round: 0, subject: { file: "reel.mp4", sha256: "a".repeat(64) }, reviewer: { id: "subagente-1", freshContext: true }, verdict: "rejected",
  findings: [{ id: "F1", severity: "important", at: "15.8s", observation: "página | rápida", why: "ilegível", fix: "dividir" }], ...o });
async function setup(v) { const dir = await mkdtemp(path.join(os.tmpdir(), "motion-critic-")); const f = path.join(dir, "in.json"); await writeFile(f, JSON.stringify(v)); return { dir, f, reviews: path.join(dir, "reviews") }; }

test("schema: campos, severidade, contexto novo e aprovado com bloqueante", () => {
  assert.deepEqual(validateCritic(review()), []);
  assert.ok(validateCritic(review({ verdict: "talvez" })).length);
  assert.ok(validateCritic(review({ reviewer: { id: "x", freshContext: false } })).length);
  assert.ok(validateCritic(review({ extra: 1 })).length);
  assert.ok(validateCritic(review({ verdict: "approved", findings: [{ ...review().findings[0], severity: "blocker" }] })).some((e) => /bloqueante/.test(e)));
});
test("gravação preserva os bytes; findings.md editado, JSON editado e rodada trocada são detectados", async () => {
  const { dir, f, reviews } = await setup(review());
  try {
    const rec = await recordCritic(f, reviews);
    assert.deepEqual(await readFile(path.join(reviews, "critic", "round-0.json")), await readFile(f));
    assert.equal((await verifyCritic(reviews)).state, "intact");
    const md = await readFile(rec.findings, "utf8");
    assert.match(md, /subagente-1/); assert.ok(md.includes(rec.jsonSha256));
    await writeFile(rec.findings, md.replace("REPROVADO", "APROVADO"));
    assert.equal((await verifyCritic(reviews)).state, "tampered");
    await recordCritic(f, reviews);
    const j = path.join(reviews, "critic", "round-0.json");
    await writeFile(j, (await readFile(j, "utf8")).replace("rejected", "approved"));
    assert.equal((await verifyCritic(reviews)).state, "tampered");
    await assert.rejects(recordCritic(f, reviews), /parecer diferente/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("fora do schema: recusado pela CLI, nada gravado", async () => {
  const { dir, f, reviews } = await setup({ verdict: "ok" });
  try {
    const r = spawnSync("node", [CLI, "qa", "critic-record", f, `--reviews=${reviews}`], { encoding: "utf8" });
    assert.notEqual(r.status, 0);
    assert.equal((await verifyCritic(reviews)).state, "none");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("QA: sem parecer NOT_TESTED; outro MP4 FAIL; reprovado FAIL; aprovado e íntegro PASS; escuta ligada ao arquivo", async () => {
  const { dir, reviews } = await setup(review());
  const mp4 = path.join(dir, "reel.mp4");
  try {
    assert.equal(ff(["-f", "lavfi", "-i", "color=black:s=108x192:r=30:d=1", "-f", "lavfi", "-i", "sine=d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", mp4]).status, 0);
    const sha256 = await R.sha256File(mp4);
    const st = async () => { const j = (await R.qaReel(mp4, { reviewsDir: reviews })).toJSON(); return (id) => j.checks.find((c) => c.id === id)?.status; };
    assert.equal((await st())("human.critic"), "NOT_TESTED");
    const put = async (v) => { const f = path.join(dir, `r${v.round}.json`); await writeFile(f, JSON.stringify(v)); await recordCritic(f, reviews); return st(); };
    assert.equal((await put(review({ round: 1 })))("human.critic"), "FAIL");
    const subject = { file: "reel.mp4", sha256 };
    assert.equal((await put(review({ round: 2, subject })))("human.critic"), "FAIL");
    const ok = await put(review({ round: 3, subject, verdict: "approved", findings: [] }));
    assert.equal(ok("human.critic"), "PASS"); assert.equal(ok("critic.integrity"), "PASS"); assert.equal(ok("human.listening"), "NOT_TESTED");
    await writeFile(path.join(reviews, "listening.json"), JSON.stringify({ schema: "motion.human.listening", approved: true, by: "dono", at: "2026-11-23", sha256: "b".repeat(64) }));
    assert.equal((await st())("human.listening"), "NOT_TESTED");
    await writeFile(path.join(reviews, "listening.json"), JSON.stringify({ schema: "motion.human.listening", approved: true, by: "dono", at: "2026-11-23", sha256 }));
    assert.equal((await st())("human.listening"), "PASS");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
