/**
 * Visual Asset license policy.
 * Distinguishes the license of a library's CODE from the license of each ASSET it ships,
 * and decides whether an asset may be used in a commercial production.
 *
 * Verdicts: allowed (bool), attributionRequired, trademark, warnings[], reason (when blocked).
 */
const PERMISSIVE = new Set(["MIT", "ISC", "Apache-2.0", "CC0-1.0", "0BSD", "BSD-2-Clause", "BSD-3-Clause", "Unlicense", "MPL-2.0", "OFL-1.1"]);
const ATTRIBUTION = new Set(["CC-BY-4.0", "CC-BY-3.0"]);
const BLOCKED = [
  [/^CC-BY-NC/i, "uso comercial proibido (NonCommercial)"],
  [/^CC-BY(?:-NC)?-ND/i, "derivações proibidas (NoDerivatives): recolorir/redimensionar seria uma derivação"],
  [/^CC-BY-SA/i, "share-alike exigiria licenciar a produção sob a mesma licença"],
  [/GPL/i, "licença copyleft forte: incompatível com redistribuição junto à produção"],
];

/**
 * @param {{spdx?:string, scope?:"code"|"assets", attributionRequired?:boolean, trademark?:boolean, grant?:string, commercialUse?:boolean, attribution?:string}} license
 * @param {{commercial?: boolean}} [ctx]
 */
export function assessLicense(license = {}, { commercial = true } = {}) {
  const spdx = license.spdx ?? "UNKNOWN";
  const warnings = [];
  const trademark = Boolean(license.trademark);
  if (trademark) warnings.push("marca registrada: usar apenas para NOMEAR a tecnologia, sem recolorir, distorcer ou sugerir endosso");
  if (license.scope === "code") warnings.push("a licença declarada cobre o código da biblioteca; os assets seguem suas próprias condições");
  // user-supplied proprietary packs: explicit grant required
  if (license.grant === "user-licensed") {
    if (commercial && license.commercialUse !== true) return { allowed: false, attributionRequired: false, trademark, warnings, reason: "pacote licenciado pelo usuário sem confirmação de uso comercial (commercialUse: true)" };
    return { allowed: true, attributionRequired: Boolean(license.attributionRequired), trademark, warnings: [...warnings, "licença própria do usuário: ele responde pela conformidade e pela redistribuição"] };
  }
  for (const [re, why] of BLOCKED) if (re.test(spdx)) return { allowed: !commercial && /NC/.test(spdx), attributionRequired: true, trademark, warnings, reason: why };
  if (PERMISSIVE.has(spdx)) return { allowed: true, attributionRequired: Boolean(license.attributionRequired), trademark, warnings };
  if (ATTRIBUTION.has(spdx)) return { allowed: true, attributionRequired: true, trademark, warnings };
  return { allowed: false, attributionRequired: false, trademark, warnings, reason: `licença desconhecida ou ausente (${spdx}): não é possível confirmar o uso comercial` };
}

/** Builds CREDITS text for every asset that requires attribution (or is a trademark). */
export function buildCredits(assets) {
  const seen = new Map();
  for (const a of assets) {
    const l = a.license ?? {};
    if (!(l.attributionRequired || l.attribution) && !l.trademark) continue;
    const key = `${a.pack}|${l.attribution ?? ""}`;
    if (!seen.has(key)) seen.set(key, { pack: a.pack, attribution: l.attribution ?? null, spdx: l.spdx, required: Boolean(l.attributionRequired), trademark: Boolean(l.trademark), count: 0 });
    seen.get(key).count++;
  }
  const lines = ["# Créditos de recursos visuais", ""];
  for (const c of seen.values()) {
    lines.push(`- **${c.pack}** (${c.spdx})${c.required ? " — atribuição obrigatória" : ""}: ${c.attribution ?? "sem texto de atribuição"}${c.trademark ? " · Marcas pertencem aos respectivos titulares." : ""} (${c.count} uso${c.count > 1 ? "s" : ""})`);
  }
  return { entries: [...seen.values()], markdown: lines.join("\n") + "\n" };
}
