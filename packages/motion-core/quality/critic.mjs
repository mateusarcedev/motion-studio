/**
 * MOTION Core — quality/critic.mjs
 * The independent Critic returns JSON (motion.critic.findings@1) and never needs write access.
 * Production records the received bytes untouched, plus a findings.md generated from them.
 * QA regenerates findings.md and compares hashes: this detects later edits. It cannot prove
 * who authored the review; that stays with the recorded reviewer id and the session log.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { MotionError, ERROR_CODES } from "../lib/errors.mjs";

export const CRITIC_SCHEMA = "motion.critic.findings";
export const CRITIC_JSON_SCHEMA = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: "motion.critic.findings@1", type: "object", additionalProperties: false,
  required: ["schema", "schemaVersion", "subject", "reviewer", "verdict", "findings"],
  properties: {
    schema: { const: CRITIC_SCHEMA }, schemaVersion: { const: 1 },
    subject: { type: "object", additionalProperties: false, required: ["file", "sha256"], properties: { file: { type: "string" }, sha256: { type: "string", pattern: "^[0-9a-f]{64}$" } } },
    reviewer: { type: "object", additionalProperties: false, required: ["id", "freshContext"], properties: { id: { type: "string" }, freshContext: { const: true }, model: { type: "string" } } },
    round: { type: "integer", minimum: 0 }, verdict: { enum: ["approved", "rejected"] },
    scores: { type: "object", additionalProperties: { type: "number", minimum: 1, maximum: 10 } },
    notVerified: { type: "array", items: { type: "string" } }, summary: { type: "string" },
    findings: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "severity", "at", "observation", "why", "fix"], properties: {
      id: { type: "string" }, severity: { enum: ["blocker", "important", "minor"] }, at: { type: "string" }, observation: { type: "string" }, why: { type: "string" }, fix: { type: "string" }, preserve: { type: "string" }, recheck: { type: "string" }, evidence: { type: "string" } } } },
  },
});

const sha = (b) => createHash("sha256").update(b).digest("hex");

function check(schema, v, at, errors) {
  if (schema.const !== undefined && v !== schema.const) return errors.push(`${at}: esperado ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(v)) return errors.push(`${at}: use ${schema.enum.join(" | ")}`);
  const type = Array.isArray(v) ? "array" : Number.isInteger(v) && schema.type === "integer" ? "integer" : v === null ? "null" : typeof v;
  if (schema.type && type !== schema.type) return errors.push(`${at}: tipo ${type}, esperado ${schema.type}`);
  if (schema.pattern && !new RegExp(schema.pattern).test(v)) errors.push(`${at}: formato inválido`);
  if (schema.type === "string" && !v.trim()) errors.push(`${at}: vazio`);
  if (schema.minimum !== undefined && v < schema.minimum) errors.push(`${at}: < ${schema.minimum}`);
  if (schema.maximum !== undefined && v > schema.maximum) errors.push(`${at}: > ${schema.maximum}`);
  if (schema.type === "array") v.forEach((x, i) => check(schema.items, x, `${at}[${i}]`, errors));
  if (schema.type === "object") {
    for (const k of schema.required ?? []) if (!(k in v)) errors.push(`${at}.${k}: obrigatório`);
    for (const [k, x] of Object.entries(v)) {
      const s = schema.properties?.[k] ?? (typeof schema.additionalProperties === "object" ? schema.additionalProperties : null);
      if (s) check(s, x, `${at}.${k}`, errors); else if (schema.additionalProperties === false) errors.push(`${at}.${k}: campo desconhecido`);
    }
  }
}

export function validateCritic(v) {
  const errors = [];
  check(CRITIC_JSON_SCHEMA, v, "$", errors);
  if (!errors.length && v.verdict === "approved" && v.findings.some((f) => f.severity === "blocker")) errors.push("$.verdict: aprovado com defeito bloqueante");
  return errors;
}

const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");

/** Deterministic Markdown: same bytes in, same findings.md out. */
export function criticMarkdown(v, rawSha256) {
  const L = [`# Parecer do Crítico independente — rodada ${v.round ?? 0}`, "",
    "> Gerado de `" + `critic/round-${v.round ?? 0}.json` + "` sem edição. Não altere: o QA compara os hashes.", "",
    `- Veredito: **${v.verdict === "approved" ? "APROVADO" : "REPROVADO"}**`, `- Arquivo avaliado: \`${v.subject.file}\` (SHA-256 \`${v.subject.sha256}\`)`,
    `- Crítico: \`${v.reviewer.id}\`${v.reviewer.model ? ` (${v.reviewer.model})` : ""}, contexto novo`, `- SHA-256 do parecer: \`${rawSha256}\``, ""];
  if (v.summary) L.push(v.summary, "");
  if (v.scores) L.push("| Eixo | Nota |", "|---|---|", ...Object.entries(v.scores).map(([k, n]) => `| ${cell(k)} | ${n} |`), "");
  L.push("| # | Sev. | Onde | Observação | Por quê | Correção | Preservar | Reverificar | Evidência |", "|---|---|---|---|---|---|---|---|---|",
    ...v.findings.map((f) => `| ${[f.id, f.severity, f.at, f.observation, f.why, f.fix, f.preserve, f.recheck, f.evidence].map(cell).join(" | ")} |`), "");
  if (v.notVerified?.length) L.push("Não verificado:", "", ...v.notVerified.map((x) => `- ${x}`), "");
  return L.join("\n");
}

/** Records a review exactly as received. Refuses to overwrite a different review of the same round. */
export async function recordCritic(input, reviewsDir) {
  const raw = await readFile(input);
  let v;
  try { v = JSON.parse(raw.toString("utf8")); } catch (e) { throw new MotionError(ERROR_CODES.INVALID_ARGUMENT ?? "MOTION_INVALID_ARGUMENT", `Parecer não é JSON: ${e.message}`, { exitCode: 2 }); }
  const errors = validateCritic(v);
  if (errors.length) throw new MotionError(ERROR_CODES.INVALID_ARGUMENT ?? "MOTION_INVALID_ARGUMENT", `Parecer fora do schema ${CRITIC_JSON_SCHEMA.$id}: ${errors[0]}`, { details: errors, hint: "Peça ao Crítico um JSON válido; não corrija por ele.", exitCode: 2 });
  const dir = path.join(reviewsDir, "critic");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `round-${v.round ?? 0}.json`);
  if (existsSync(file) && sha(await readFile(file)) !== sha(raw)) throw new MotionError("MOTION_CRITIC_EXISTS", `Já existe um parecer diferente para a rodada ${v.round ?? 0}.`, { hint: "Use um novo número de rodada.", exitCode: 2 });
  await writeFile(file, raw);
  const md = criticMarkdown(v, sha(raw));
  const findings = path.join(reviewsDir, "findings.md");
  await writeFile(findings, md);
  const seal = { schema: "motion.critic.seal", schemaVersion: 1, round: v.round ?? 0, json: path.basename(file), jsonSha256: sha(raw), findingsSha256: sha(md), reviewer: v.reviewer, subject: v.subject };
  await writeFile(path.join(dir, `round-${v.round ?? 0}.seal.json`), JSON.stringify(seal, null, 2) + "\n");
  return { ...seal, findings, verdict: v.verdict, count: v.findings.length };
}

/** {state: "none"|"intact"|"tampered", ...} for the latest recorded round. */
export async function verifyCritic(reviewsDir) {
  const dir = path.join(reviewsDir, "critic");
  const rounds = existsSync(dir) ? (await readdir(dir)).map((f) => f.match(/^round-(\d+)\.json$/)?.[1]).filter(Boolean).map(Number).sort((a, b) => b - a) : [];
  const findings = path.join(reviewsDir, "findings.md");
  if (!rounds.length) return { state: "none", reason: existsSync(findings) ? "findings.md sem parecer estruturado" : "nenhum parecer gravado" };
  const raw = await readFile(path.join(dir, `round-${rounds[0]}.json`));
  let v = null;
  try { v = JSON.parse(raw.toString("utf8")); } catch { /* reported below */ }
  const problems = [];
  if (!v) problems.push("JSON ilegível"); else problems.push(...validateCritic(v));
  const sealFile = path.join(dir, `round-${rounds[0]}.seal.json`);
  if (!existsSync(sealFile)) problems.push("selo ausente");
  else { try { if (JSON.parse(await readFile(sealFile, "utf8")).jsonSha256 !== sha(raw)) problems.push("o parecer JSON mudou depois de gravado"); } catch { problems.push("selo ilegível"); } }
  if (v && !problems.length) {
    const actual = existsSync(findings) ? await readFile(findings, "utf8") : null;
    if (actual === null) problems.push("findings.md ausente"); else if (actual !== criticMarkdown(v, sha(raw))) problems.push("findings.md não corresponde ao parecer");
  }
  return { state: problems.length ? "tampered" : "intact", round: rounds[0], jsonSha256: sha(raw), problems, verdict: v?.verdict ?? null, subject: v?.subject ?? null, reviewer: v?.reviewer ?? null, findings: v?.findings?.length ?? 0 };
}

/** Human listening sign-off: reviews/listening.json {schema, approved, by, at, sha256}. */
export async function readListening(reviewsDir) {
  const f = path.join(reviewsDir, "listening.json");
  if (!existsSync(f)) return null;
  try { const v = JSON.parse(await readFile(f, "utf8")); return v.schema === "motion.human.listening" && typeof v.approved === "boolean" && v.by && v.at && /^[0-9a-f]{64}$/.test(v.sha256 ?? "") ? v : { invalid: true }; } catch { return { invalid: true }; }
}
