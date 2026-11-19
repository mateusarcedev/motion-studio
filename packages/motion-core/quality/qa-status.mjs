/**
 * MOTION Core — quality/qa-status.mjs
 * Standard QA vocabulary and report builder.
 *
 *   PASS        executed, requirement met
 *   WARN        executed, non-blocking concern (heuristics land here, never as proof)
 *   FAIL        executed, requirement not met
 *   BLOCKED     could not run because the environment prevents it (reproduction steps recorded)
 *   NOT_TESTED  not executed at all
 *
 * A check that did not run can never contribute to PASS.
 */
export const QA_STATUS = Object.freeze({ PASS: "PASS", WARN: "WARN", FAIL: "FAIL", BLOCKED: "BLOCKED", NOT_TESTED: "NOT_TESTED" });
const ORDER = ["FAIL", "BLOCKED", "NOT_TESTED", "WARN", "PASS"]; // worst → best

/** Overall verdict: any FAIL → FAIL; else BLOCKED; else NOT_TESTED (a required check never ran); else WARN; else PASS. */
export function combineStatuses(statuses) {
  if (!statuses.length) return QA_STATUS.NOT_TESTED;
  for (const s of ORDER) if (statuses.includes(s)) return s;
  return QA_STATUS.NOT_TESTED;
}

export function createQaReport({ subject, kind = "production" } = {}) {
  const checks = [];
  return {
    add({ id, title, status, details = null, evidence = null, heuristic = false, required = true, reproduce = null }) {
      if (!QA_STATUS[status]) throw new Error(`QA: estado inválido "${status}"`);
      if (status === QA_STATUS.BLOCKED && !reproduce) throw new Error(`QA: check BLOCKED "${id}" precisa de instruções de reprodução (reproduce)`);
      checks.push({ id, title, status, required, heuristic, details, evidence, reproduce });
      return this;
    },
    /** Merges another report's checks with a prefix. */
    merge(other, prefix = "") { for (const c of other.checks) checks.push({ ...c, id: prefix ? `${prefix}.${c.id}` : c.id }); return this; },
    get checks() { return checks; },
    summary() {
      const counts = Object.fromEntries(Object.keys(QA_STATUS).map((k) => [k, 0]));
      for (const c of checks) counts[c.status]++;
      const considered = checks.filter((c) => c.required || c.status === "FAIL");
      return { status: combineStatuses(considered.map((c) => c.status)), counts };
    },
    toJSON() {
      return { subject: subject ?? null, kind, generatedBy: "motion-core/qa", ...this.summary(), checks, note: "Heurísticas (heuristic:true) indicam risco; não provam qualidade artística. Aprovação final é do Crítico/humano." };
    },
    toMarkdown() {
      const s = this.summary();
      const icon = { PASS: "✅", WARN: "⚠️", FAIL: "❌", BLOCKED: "⛔", NOT_TESTED: "⚪" };
      const lines = [`# QA automatizado — ${subject ?? "produção"}`, "", `**Veredito: ${icon[s.status]} ${s.status}** (${Object.entries(s.counts).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(", ")})`, ""];
      for (const c of checks) {
        lines.push(`- ${icon[c.status]} **${c.title}** [${c.status}]${c.heuristic ? " _(heurística)_" : ""}${c.details ? ` — ${c.details}` : ""}`);
        if (c.reproduce) lines.push(`  - Como validar externamente: ${c.reproduce}`);
      }
      return lines.join("\n") + "\n";
    },
  };
}
