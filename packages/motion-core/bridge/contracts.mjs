/**
 * MOTION Core Bridge — contracts.mjs
 * Versioned schema validators and normalizers for:
 *   - DesignTokenBundle@1
 *   - AssetProvenanceManifest@1
 *   - MotionDesignIR@1
 */
import { ERROR_CODES, MotionError } from "../lib/errors.mjs";
import { assessLicense } from "../visual-assets/license-policy.mjs";
import {
  assertSafeRelativePath,
  assertSafeRemoteUrl,
  sanitizeCssValue,
  sha256Json,
} from "./security.mjs";

export const SCHEMA_VERSION = "1.0.0";

export const TOKEN_TYPES = Object.freeze([
  "color",
  "opacity",
  "radius",
  "spacing",
  "container",
  "breakpoint",
  "fontFamily",
  "fontWeight",
  "fontSize",
  "lineHeight",
  "letterSpacing",
]);

const TOKEN_TYPE_SET = new Set(TOKEN_TYPES);
const SLUG_RE = /^[a-z0-9-]+$/;
const CSS_VAR_RE = /^--[a-zA-Z0-9_-]+$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const VAR_ALIAS_RE = /^var\(\s*(--[a-zA-Z0-9_-]+)\s*\)$/;

function failSchema(message, details = null) {
  throw new MotionError(ERROR_CODES.BRIDGE_SCHEMA_INVALID, message, { details });
}

export function extractAliasTarget(cssValue) {
  const m = String(cssValue ?? "").trim().match(VAR_ALIAS_RE);
  return m ? m[1] : null;
}

/** Validates and canonically normalizes a DesignTokenBundle@1 payload. */
export function validateTokenBundle(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    failSchema("DesignTokenBundle@1 deve ser um objeto.");
  }
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    failSchema(`schemaVersion inválido para DesignTokenBundle: esperado ${SCHEMA_VERSION}, recebido ${raw.schemaVersion}`);
  }
  if (typeof raw.sourceEditor !== "string" || !SLUG_RE.test(raw.sourceEditor)) {
    failSchema(`sourceEditor inválido: ${raw.sourceEditor}`);
  }
  if (typeof raw.brandSlug !== "string" || !SLUG_RE.test(raw.brandSlug)) {
    failSchema(`brandSlug inválido: ${raw.brandSlug}`);
  }
  if (!Array.isArray(raw.themes) || raw.themes.length > 8) {
    failSchema("themes deve ser um array com no máximo 8 temas.");
  }
  const themes = [];
  const seenThemes = new Set();
  for (const th of raw.themes) {
    if (typeof th !== "string" || !SLUG_RE.test(th) || th === "default") {
      failSchema(`Nome de tema inválido (use slug a-z0-9-, sem 'default'): ${th}`);
    }
    if (!seenThemes.has(th)) {
      seenThemes.add(th);
      themes.push(th);
    }
  }
  if (!Array.isArray(raw.tokens)) {
    failSchema("tokens deve ser um array.");
  }

  const byVar = new Map();
  const normalizedTokens = [];
  for (const tok of raw.tokens) {
    if (!tok || typeof tok !== "object" || Array.isArray(tok)) failSchema("Cada token deve ser um objeto.");
    if (typeof tok.cssVar !== "string" || !CSS_VAR_RE.test(tok.cssVar)) {
      failSchema(`cssVar inválido: ${tok.cssVar}`);
    }
    if (byVar.has(tok.cssVar)) {
      failSchema(`Token duplicado: ${tok.cssVar}`);
    }
    if (!TOKEN_TYPE_SET.has(tok.type)) {
      failSchema(`Tipo de token inválido '${tok.type}' em ${tok.cssVar}`);
    }
    const cleanVal = sanitizeCssValue(tok.value);
    const aliasOf = tok.aliasOf ?? extractAliasTarget(cleanVal) ?? null;

    const cleanThemes = {};
    if (tok.themes && typeof tok.themes === "object" && !Array.isArray(tok.themes)) {
      for (const [themeName, themeVal] of Object.entries(tok.themes)) {
        if (!seenThemes.has(themeName)) {
          failSchema(`Tema '${themeName}' referenciado em ${tok.cssVar} não está declarado em themes.`);
        }
        cleanThemes[themeName] = sanitizeCssValue(themeVal);
      }
    }

    const entry = {
      cssVar: tok.cssVar,
      type: tok.type,
      value: cleanVal,
      ...(Object.keys(cleanThemes).length ? { themes: cleanThemes } : {}),
      aliasOf,
      description: tok.description ?? null,
      motionGroup: tok.motionGroup ?? null,
      motionKey: tok.motionKey ?? null,
    };
    byVar.set(tok.cssVar, entry);
    normalizedTokens.push(entry);
  }

  // Validate alias DAG (no dangling references, no cycles across default or theme values)
  const checkAliasChain = (startVar, getVal) => {
    const visiting = new Set();
    let cur = startVar;
    while (cur) {
      if (visiting.has(cur)) {
        throw new MotionError(ERROR_CODES.BRIDGE_TOKEN_CYCLE, `Ciclo de alias detectado envolvendo ${cur}`);
      }
      visiting.add(cur);
      const token = byVar.get(cur);
      if (!token) {
        throw new MotionError(ERROR_CODES.BRIDGE_SCHEMA_INVALID, `Alias aponta para token inexistente: ${cur}`);
      }
      const next = extractAliasTarget(getVal(token));
      if (!next) break;
      if (!byVar.has(next)) {
        throw new MotionError(ERROR_CODES.BRIDGE_SCHEMA_INVALID, `Alias em ${cur} aponta para token inexistente: ${next}`);
      }
      cur = next;
    }
  };

  for (const tok of normalizedTokens) {
    checkAliasChain(tok.cssVar, (t) => t.value);
    for (const th of themes) {
      checkAliasChain(tok.cssVar, (t) => t.themes?.[th] ?? t.value);
    }
  }

  const fonts = {
    custom: Array.isArray(raw.fonts?.custom) ? raw.fonts.custom.map(String) : [],
    webFonts: Array.isArray(raw.fonts?.webFonts) ? raw.fonts.webFonts.map(String) : [],
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    sourceEditor: raw.sourceEditor,
    brandSlug: raw.brandSlug,
    themes,
    fonts,
    tokens: normalizedTokens,
  };
}

/** Validates an AssetProvenanceManifest@1 payload against path traversal, SSRF, and license rules. */
export function validateAssetProvenance(raw, { commercial = true, allowLoopback = false } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    failSchema("AssetProvenanceManifest@1 deve ser um objeto.");
  }
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    failSchema(`schemaVersion inválido para AssetProvenanceManifest: ${raw.schemaVersion}`);
  }
  if (!Array.isArray(raw.assets)) {
    failSchema("assets deve ser um array.");
  }

  const VALID_KINDS = new Set(["image", "svg", "font", "lottie", "video", "audio"]);
  const normalized = [];
  const seenIds = new Set();
  for (const a of raw.assets) {
    if (!a || typeof a !== "object") failSchema("Cada asset deve ser um objeto.");
    if (typeof a.id !== "string" || !/^[a-zA-Z0-9._-]+$/.test(a.id)) failSchema(`id de asset inválido: ${a.id}`);
    if (seenIds.has(a.id)) failSchema(`id de asset duplicado: ${a.id}`);
    seenIds.add(a.id);

    const localPath = assertSafeRelativePath(a.localPath);
    const sourceUrl = a.sourceUrl ? assertSafeRemoteUrl(a.sourceUrl, { allowLoopback }) : null;
    if (typeof a.sha256 !== "string" || !SHA256_RE.test(a.sha256)) {
      failSchema(`sha256 inválido para asset ${a.id}`);
    }
    if (!VALID_KINDS.has(a.kind)) failSchema(`kind inválido '${a.kind}' em asset ${a.id}`);
    if (typeof a.origin !== "string" || !a.origin.trim()) failSchema(`origin obrigatório em asset ${a.id}`);
    if (typeof a.sanitized !== "boolean") failSchema(`sanitized deve ser boolean em asset ${a.id}`);

    const licenseVerdict = assessLicense(a.license ?? {}, { commercial });
    if (!licenseVerdict.allowed) {
      throw new MotionError(
        ERROR_CODES.BRIDGE_SECURITY_VIOLATION,
        `Licença bloqueada para asset '${a.id}': ${licenseVerdict.reason}`,
        { details: licenseVerdict }
      );
    }

    normalized.push({
      id: a.id,
      sourceUrl,
      localPath,
      sha256: a.sha256,
      kind: a.kind,
      origin: a.origin,
      license: a.license,
      sanitized: a.sanitized,
      trademark: Boolean(a.trademark || licenseVerdict.trademark),
    });
  }

  return { schemaVersion: SCHEMA_VERSION, assets: normalized };
}

/** Computes the canonical deterministic IR hash (over all fields except irHash). */
export function computeDesignIRHash(irWithoutHash) {
  const { irHash: _ignored, ...rest } = irWithoutHash;
  return sha256Json(rest);
}

/** Validates a MotionDesignIR@1 object and verifies/attaches deterministic irHash. */
export function validateDesignIR(raw, { verifyHash = true } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    failSchema("MotionDesignIR@1 deve ser um objeto.");
  }
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    failSchema(`schemaVersion inválido para MotionDesignIR: ${raw.schemaVersion}`);
  }
  const src = raw.source;
  if (!src || typeof src !== "object" || !SLUG_RE.test(src.editor ?? "") || !src.documentId || !src.frameId) {
    failSchema("source inválido em MotionDesignIR@1 (editor, documentId e frameId são obrigatórios).");
  }
  const vp = raw.viewport;
  if (
    !vp || typeof vp !== "object" ||
    !Number.isInteger(vp.width) || vp.width < 1 ||
    !Number.isInteger(vp.height) || vp.height < 1 ||
    typeof vp.theme !== "string" || !vp.theme ||
    typeof vp.deviceScaleFactor !== "number" || vp.deviceScaleFactor <= 0
  ) {
    failSchema("viewport inválido em MotionDesignIR@1.");
  }
  if (raw.tokensRef) assertSafeRelativePath(raw.tokensRef);
  if (raw.assetsRef) assertSafeRelativePath(raw.assetsRef);

  if (typeof raw.sanitizedHtml !== "string") {
    failSchema("sanitizedHtml deve ser string.");
  }
  if (/<script\b|<iframe\b|<foreignObject\b|\son[a-z]+\s*=/i.test(raw.sanitizedHtml)) {
    throw new MotionError(
      ERROR_CODES.BRIDGE_SECURITY_VIOLATION,
      "sanitizedHtml ainda contém construções executáveis proibidas (<script>/<iframe>/<foreignObject>/on*)."
    );
  }

  const normalized = {
    schemaVersion: SCHEMA_VERSION,
    source: {
      editor: src.editor,
      workspaceId: src.workspaceId ?? null,
      documentId: String(src.documentId),
      pageId: src.pageId ?? null,
      frameId: String(src.frameId),
      frameName: src.frameName ?? null,
      revision: src.revision ?? null,
      approvalStatus: src.approvalStatus ?? null,
      capturedAt: src.capturedAt ?? null,
    },
    viewport: {
      width: vp.width,
      height: vp.height,
      theme: vp.theme,
      deviceScaleFactor: vp.deviceScaleFactor,
    },
    tokensRef: raw.tokensRef ?? null,
    assetsRef: raw.assetsRef ?? null,
    componentsUsed: Array.isArray(raw.componentsUsed) ? raw.componentsUsed : [],
    prototypeFlows: Array.isArray(raw.prototypeFlows) ? raw.prototypeFlows : [],
    referencedAssets: Array.isArray(raw.referencedAssets) ? raw.referencedAssets : [],
    sanitizedHtml: raw.sanitizedHtml,
    securityFindings: Array.isArray(raw.securityFindings) ? raw.securityFindings : [],
    compatibilityDiagnostics: Array.isArray(raw.compatibilityDiagnostics) ? raw.compatibilityDiagnostics : [],
  };

  const expectedHash = computeDesignIRHash(normalized);
  if (verifyHash && raw.irHash && raw.irHash !== expectedHash) {
    failSchema(`irHash divergente: esperado ${expectedHash}, recebido ${raw.irHash}`);
  }

  return { ...normalized, irHash: expectedHash };
}

export const EXPORT_POLICIES = Object.freeze([
  "create-new-frame",
  "update-existing-frame",
  "duplicate-as-draft",
  "export-assets-only",
  "dry-run",
]);

const EXPORT_POLICY_SET = new Set(EXPORT_POLICIES);
const EXPORT_RESULT_STATUSES = new Set(["DRY_RUN", "COMPLETED", "PARTIAL", "FAILED", "BLOCKED", "CANCELLED"]);
const EXPORT_OP_STATUSES = new Set(["planned", "skipped", "succeeded", "failed", "ambiguous"]);

/** Validates a single deterministic ExportOperation@1. */
export function validateExportOperation(raw, { verifyHash = true } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) failSchema("ExportOperation@1 deve ser um objeto.");
  if (typeof raw.id !== "string" || !/^op-[0-9]{3,}-[a-f0-9]{8}$/.test(raw.id)) failSchema(`id inválido em ExportOperation@1: ${raw.id}`);
  if (typeof raw.kind !== "string" || !/^[a-z][a-z0-9_-]*$/.test(raw.kind)) failSchema(`kind inválido na operação '${raw.id}'.`);
  for (const key of ["source", "target", "preconditions", "payload"]) {
    if (!raw[key] || typeof raw[key] !== "object" || Array.isArray(raw[key])) failSchema(`ExportOperation '${raw.id}' exige ${key} como objeto.`);
  }
  if (!Array.isArray(raw.dependsOn) || raw.dependsOn.some((id) => typeof id !== "string")) failSchema(`ExportOperation '${raw.id}' exige dependsOn como array de IDs.`);
  if (new Set(raw.dependsOn).size !== raw.dependsOn.length || raw.dependsOn.includes(raw.id)) failSchema(`ExportOperation '${raw.id}' contém dependências duplicadas ou cíclicas.`);
  if (typeof raw.reversible !== "boolean" || typeof raw.compensable !== "boolean") failSchema(`ExportOperation '${raw.id}' exige reversible e compensable booleanos.`);
  if (typeof raw.expectedOutcome !== "string" || !raw.expectedOutcome.trim()) failSchema(`ExportOperation '${raw.id}' exige expectedOutcome.`);
  const inputHash = sha256Json({ kind: raw.kind, source: raw.source, target: raw.target, preconditions: raw.preconditions, payload: raw.payload });
  if (verifyHash && raw.inputHash !== inputHash) failSchema(`inputHash divergente na operação '${raw.id}'.`);
  return { ...raw, inputHash };
}

/** Validates the versioned export compatibility report. */
export function validateExportCompatibilityReport(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.schemaVersion !== SCHEMA_VERSION) failSchema("ExportCompatibilityReport@1 inválido.");
  const c = raw.classifications;
  if (!c || typeof c !== "object" || ["editable", "rasterized", "referential", "blocked"].some((k) => !Number.isInteger(c[k]) || c[k] < 0)) {
    failSchema("classifications inválido em ExportCompatibilityReport@1.");
  }
  for (const key of ["items", "tokenConflicts", "privacyBlocked", "warnings", "unverifiedCapabilities"]) {
    if (!Array.isArray(raw[key] ?? [])) failSchema(`${key} deve ser um array em ExportCompatibilityReport@1.`);
  }
  for (const value of [...(raw.warnings ?? []), ...(raw.unverifiedCapabilities ?? [])]) {
    if (typeof value !== "string") failSchema("warnings e unverifiedCapabilities devem conter strings.");
  }
  if (raw.normalizationReport !== undefined && raw.normalizationReport !== null && (typeof raw.normalizationReport !== "object" || Array.isArray(raw.normalizationReport))) {
    failSchema("normalizationReport deve ser objeto ou null.");
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    classifications: { editable: c.editable, rasterized: c.rasterized, referential: c.referential, blocked: c.blocked },
    items: raw.items ?? [],
    tokenConflicts: raw.tokenConflicts ?? [],
    privacyBlocked: raw.privacyBlocked ?? [],
    warnings: raw.warnings ?? [],
    unverifiedCapabilities: [...new Set(raw.unverifiedCapabilities ?? [])].sort(),
    normalizationReport: raw.normalizationReport ?? null,
  };
}

/** Computes deterministic SHA-256 hash over an ExportPlan@1 (excluding planId and planHash). */
export function computeExportPlanHash(planWithoutHash) {
  const { planId: _pid, planHash: _ph, ...rest } = planWithoutHash;
  return sha256Json(rest);
}

/** Validates and canonically hashes an ExportPlan@1 payload. */
export function validateExportPlan(raw, { verifyHash = true } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) failSchema("ExportPlan@1 deve ser um objeto.");
  if (raw.schemaVersion !== SCHEMA_VERSION) failSchema(`schemaVersion inválido para ExportPlan: ${raw.schemaVersion}`);
  if (typeof raw.targetEditor !== "string" || !SLUG_RE.test(raw.targetEditor)) failSchema(`targetEditor inválido: ${raw.targetEditor}`);
  if (typeof raw.documentId !== "string" || !raw.documentId.trim()) failSchema("documentId obrigatório em ExportPlan@1.");
  if (!EXPORT_POLICY_SET.has(raw.policy)) failSchema(`policy inválida em ExportPlan@1: ${raw.policy}`);
  if (typeof raw.dryRun !== "boolean") failSchema("dryRun deve ser boolean.");
  if (!raw.authorization || typeof raw.authorization !== "object") failSchema("authorization obrigatório em ExportPlan@1.");
  for (const key of ["allowUpdateExisting", "allowTokenMutation", "allowComponentMutation", "allowPublicUpload", "approvedFrameOverride"]) {
    if (typeof raw.authorization[key] !== "boolean") failSchema(`authorization.${key} deve ser boolean.`);
  }
  const compatibilityReport = validateExportCompatibilityReport(raw.compatibilityReport);
  if (!Array.isArray(raw.operations)) failSchema("operations deve ser um array.");

  const seenOpIds = new Set();
  const operations = raw.operations.map((op) => {
    const normalized = validateExportOperation(op, { verifyHash });
    if (seenOpIds.has(normalized.id)) failSchema(`Operação duplicada em ExportPlan@1: ${normalized.id}`);
    for (const dep of normalized.dependsOn) {
      if (!seenOpIds.has(dep)) failSchema(`Dependência '${dep}' deve aparecer antes da operação '${normalized.id}'.`);
    }
    seenOpIds.add(normalized.id);
    return { ...normalized, dependsOn: [...normalized.dependsOn] };
  });

  const normalized = {
    schemaVersion: SCHEMA_VERSION,
    targetEditor: raw.targetEditor,
    documentId: String(raw.documentId),
    policy: raw.policy,
    dryRun: raw.dryRun,
    authorization: {
      allowUpdateExisting: Boolean(raw.authorization.allowUpdateExisting),
      allowTokenMutation: Boolean(raw.authorization.allowTokenMutation),
      allowComponentMutation: Boolean(raw.authorization.allowComponentMutation),
      allowPublicUpload: Boolean(raw.authorization.allowPublicUpload),
      approvedFrameOverride: Boolean(raw.authorization.approvedFrameOverride),
    },
    compatibilityReport,
    operations,
  };
  const planHash = computeExportPlanHash(normalized);
  if (verifyHash && raw.planHash && raw.planHash !== planHash) {
    failSchema(`planHash divergente: esperado ${planHash}, recebido ${raw.planHash}`);
  }
  return {
    ...normalized,
    planId: raw.planId ?? `exp-${planHash.slice(0, 12)}`,
    planHash,
  };
}

/** Validates an ExportResult@1 payload. */
export function validateExportResult(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) failSchema("ExportResult@1 deve ser um objeto.");
  if (raw.schemaVersion !== SCHEMA_VERSION) failSchema(`schemaVersion inválido para ExportResult: ${raw.schemaVersion}`);
  if (!EXPORT_RESULT_STATUSES.has(raw.status)) failSchema(`status inválido em ExportResult@1: ${raw.status}`);
  if (!EXPORT_POLICY_SET.has(raw.policy)) failSchema(`policy inválida em ExportResult@1: ${raw.policy}`);
  if (typeof raw.planId !== "string" || !raw.planId || !/^[a-f0-9]{64}$/.test(raw.planHash ?? "")) failSchema("planId/planHash inválidos em ExportResult@1.");
  if (typeof raw.targetEditor !== "string" || !SLUG_RE.test(raw.targetEditor) || typeof raw.documentId !== "string" || !raw.documentId) failSchema("targetEditor/documentId inválidos em ExportResult@1.");
  if (typeof raw.dryRun !== "boolean") failSchema("dryRun deve ser boolean em ExportResult@1.");
  if (!Array.isArray(raw.operations)) failSchema("operations em ExportResult@1 deve ser um array.");
  const seen = new Set();
  for (const op of raw.operations) {
    if (!op || typeof op.id !== "string" || seen.has(op.id) || !EXPORT_OP_STATUSES.has(op.status) || !Number.isInteger(op.attempts) || op.attempts < 0 || typeof op.reversible !== "boolean") {
      failSchema(`Estado de operação inválido em ExportResult@1: ${op?.id} (${op?.status})`);
    }
    seen.add(op.id);
  }
  if (!raw.reconciliation || typeof raw.reconciliation !== "object") failSchema("reconciliation obrigatório em ExportResult@1.");
  const statusCounts = {
    completedCount: raw.operations.filter((o) => o.status === "succeeded").length,
    skippedCount: raw.operations.filter((o) => o.status === "skipped").length,
    failedCount: raw.operations.filter((o) => o.status === "failed").length,
    ambiguousCount: raw.operations.filter((o) => o.status === "ambiguous").length,
  };
  for (const [key, count] of Object.entries(statusCounts)) if (raw.reconciliation[key] !== count) failSchema(`reconciliation.${key} não corresponde às operações.`);
  if (raw.dryRun && raw.status !== "DRY_RUN") failSchema("Resultado dryRun deve ter status DRY_RUN.");
  if (raw.status === "COMPLETED" && (statusCounts.failedCount || statusCounts.ambiguousCount)) failSchema("COMPLETED não pode conter operações falhas/ambíguas.");
  if (raw.status === "PARTIAL" && (!statusCounts.completedCount || !(statusCounts.failedCount || statusCounts.ambiguousCount))) failSchema("PARTIAL exige operações concluídas e falhas/ambíguas.");
  return raw;
}
