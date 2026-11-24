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
