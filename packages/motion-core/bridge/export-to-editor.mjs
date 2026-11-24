/**
 * MOTION Core Bridge — export-to-editor.mjs
 * Editor-agnostic, 5-stage Motion-to-Design Exporter:
 *   1. inspectExportSource
 *   2. planExportToEditor
 *   3. validateExportPlanAndPreconditions
 *   4. executeExportPlan
 *   5. verifyExportResult
 *
 * Guarantees:
 *   - Mandatory dry-run without write side effects
 *   - Explicit policies (create-new-frame, update-existing-frame, duplicate-as-draft, export-assets-only, dry-run)
 *   - Protection of approved frames (ready_for_dev), existing tokens, shared components, and data-doop-* attributes
 *   - Zero inline base64 URIs in exported frames; SVGs <= 20 KB inline or promoted to upload_asset
 *   - Binary MIME/signature checks, SVGO sanitization, PNG metadata stripping, privacy/confidentiality blocks
 *   - Rate-limited sequential upload queue, SHA-256 deduplication, retry with backoff (never auto-retrying ambiguous ops),
 *     cancellation, resumption, and pre-write revision conflict checks.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ERROR_CODES, MotionError } from "../lib/errors.mjs";
import { assertSafeSvg } from "../svg/svg-tools.mjs";
import { assessLicense } from "../visual-assets/license-policy.mjs";
import { supportsExportOperations } from "./adapter.mjs";
import { inspectAndSanitizeAssetBinary } from "./assets.mjs";
import {
  EXPORT_POLICIES,
  SCHEMA_VERSION,
  validateAssetProvenance,
  validateDesignIR,
  validateExportPlan,
  validateExportResult,
  validateTokenBundle,
} from "./contracts.mjs";
import {
  assertSafeProjectPath,
  assertSafeRelativePath,
  assertSafeRemoteUrl,
  detectPromptInjection,
  parseSrcset,
  scanUntrustedHtml,
  serializeHtmlTokens,
  sha256Json,
  tokenizeHtml,
} from "./security.mjs";

const DEFAULT_MAX_IMAGE_BYTES = 5_000_000; // Conservative 5 MB limit from Doop's import docs
const DEFAULT_MAX_INLINE_SVG_BYTES = 20 * 1024; // ~20 KB inline SVG threshold
const DEFAULT_UPLOADS_PER_MIN = 15; // Doop account rate limit for upload_asset
const DEFAULT_TIMEOUT_MS = 15_000;
const UPLOAD_RATE_LIMIT_QUEUES = new WeakMap();

const SENSITIVE_PATH_PATTERNS = [
  /(?:^|\/)\.env(?:\.|$)/i,
  /(?:^|\/)[^/]*(?:secret|credential|password|private[-_]?key|oauth|api[-_]?key)[^/]*$/i,
  /\.(?:pem|key|p12|pfx|kdbx)$/i,
  /(?:^|\/)(?:motion\.config\.json|delivery\.contract\.json|assets\.manifest\.json|assets\.provenance\.v1\.json)$/i,
];

const REFERENTIAL_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".m4v", ".mp3", ".wav", ".ogg", ".glb", ".gltf", ".js", ".mjs"]);
const RASTER_OR_SVG_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);
const FONT_EXTENSIONS = new Set([".woff", ".woff2", ".ttf", ".otf"]);
const EDITABLE_EXTENSIONS = new Set([".html", ".htm"]);

function sha256Buf(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function getUploadRateLimitState(adapter) {
  let scope = adapter?.uploadRateLimitScope ?? adapter;
  if (!scope || (typeof scope !== "object" && typeof scope !== "function")) scope = adapter;
  if (!scope || (typeof scope !== "object" && typeof scope !== "function")) {
    return { timestamps: [], active: false, waiters: new Set() };
  }
  let state = UPLOAD_RATE_LIMIT_QUEUES.get(scope);
  if (!state) {
    state = { timestamps: [], active: false, waiters: new Set() };
    UPLOAD_RATE_LIMIT_QUEUES.set(scope, state);
  }
  return state;
}

function validateNormalizationReport(raw) {
  if (raw == null) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.schemaVersion !== SCHEMA_VERSION || typeof raw.target !== "string") {
    throw new MotionError(ERROR_CODES.BRIDGE_SCHEMA_INVALID, "NormalizationReport@1 inválido.");
  }
  if (Array.isArray(raw.slides)) {
    for (const slide of raw.slides) validateNormalizationReport(slide);
  } else {
    for (const key of ["preserved", "converted", "removedForSecurity", "incompatible", "missingAssets", "fallbacksApplied", "diagnostics"]) {
      if (raw[key] !== undefined && !Array.isArray(raw[key])) throw new MotionError(ERROR_CODES.BRIDGE_SCHEMA_INVALID, `NormalizationReport.${key} deve ser um array.`);
    }
    if (raw.stats !== undefined && (!raw.stats || typeof raw.stats !== "object" || Object.values(raw.stats).some((n) => !Number.isInteger(n) || n < 0))) {
      throw new MotionError(ERROR_CODES.BRIDGE_SCHEMA_INVALID, "NormalizationReport.stats inválido.");
    }
  }
  return structuredClone(raw);
}

function validateStoryboardInput(raw, label) {
  if (raw == null) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new MotionError(ERROR_CODES.BRIDGE_SCHEMA_INVALID, `${label} deve ser objeto.`);
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== SCHEMA_VERSION) throw new MotionError(ERROR_CODES.BRIDGE_SCHEMA_INVALID, `${label}.schemaVersion inválido.`);
  if (raw.markdown !== undefined && typeof raw.markdown !== "string") throw new MotionError(ERROR_CODES.BRIDGE_SCHEMA_INVALID, `${label}.markdown deve ser string.`);
  return structuredClone(raw);
}

function escapeHtmlText(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Strips non-critical PNG text metadata chunks (tEXt, iTXt, zTXt, eXIf) before public upload. */
export function stripPngMetadata(buf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!Buffer.isBuffer(buf) || buf.length < 24 || !buf.subarray(0, 8).equals(sig)) return buf;
  const out = [sig];
  let pos = 8;
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString("ascii");
    const end = pos + 12 + len;
    if (end > buf.length) return buf;
    const chunkPayload = buf.subarray(pos + 8, pos + 8 + len);
    const expectedCrc = buf.readUInt32BE(pos + 8 + len);
    const actualCrc = crc32(buf.subarray(pos + 4, pos + 8 + len));
    if (expectedCrc !== actualCrc) return buf;
    if (!["tEXt", "iTXt", "zTXt", "eXIf", "tIME"].includes(type)) {
      out.push(buf.subarray(pos, end));
    }
    pos = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(out);
}

/** Removes common identifying metadata from JPEG/WebP while preserving image payload and color profiles. */
export function stripImageMetadata(buf, mime = "") {
  if (!Buffer.isBuffer(buf)) return buf;
  if (mime === "image/png") return stripPngMetadata(buf);
  if (mime === "image/jpeg" && buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    const parts = [buf.subarray(0, 2)];
    let pos = 2;
    while (pos + 4 <= buf.length) {
      if (buf[pos] !== 0xff) return buf;
      const markerStart = pos;
      while (buf[pos] === 0xff) pos++;
      if (pos >= buf.length) return buf;
      const marker = buf[pos++];
      if (marker === 0xda) {
        parts.push(buf.subarray(markerStart));
        return Buffer.concat(parts);
      }
      if ([0xd8, 0xd9, 0x01, ...Array.from({ length: 8 }, (_, i) => 0xd0 + i)].includes(marker)) {
        parts.push(buf.subarray(markerStart, pos));
        if (marker === 0xd9) break;
        continue;
      }
      if (pos + 2 > buf.length) return buf;
      const segmentLength = buf.readUInt16BE(pos);
      const end = pos + segmentLength;
      if (segmentLength < 2 || end > buf.length) return buf;
      if (![0xe1, 0xed, 0xfe].includes(marker)) parts.push(buf.subarray(markerStart, end));
      pos = end;
    }
    if (pos < buf.length) parts.push(buf.subarray(pos));
    return Buffer.concat(parts);
  }
  if (mime === "image/webp" && buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunks = [];
    let pos = 12;
    while (pos + 8 <= buf.length) {
      const fourcc = buf.toString("ascii", pos, pos + 4);
      const size = buf.readUInt32LE(pos + 4);
      const end = pos + 8 + size + (size % 2);
      if (end > buf.length) return buf;
      if (fourcc !== "EXIF" && fourcc !== "XMP ") chunks.push(buf.subarray(pos, end));
      pos = end;
    }
    if (pos !== buf.length) return buf;
    const body = Buffer.concat(chunks);
    const header = Buffer.from(buf.subarray(0, 12));
    header.writeUInt32LE(body.length + 4, 4);
    return Buffer.concat([header, body]);
  }
  return buf;
}

function isSensitiveArtifact(item, textSnippet = "") {
  const rel = String(item.path ?? item.name ?? "");
  if (item.confidential === true || item.visibility === "internal" || item.allowPublicUpload === false) {
    return `Marcado como confidencial/interno (${rel || item.id})`;
  }
  if (SENSITIVE_PATH_PATTERNS.some((rx) => rx.test(rel.replace(/\\/g, "/")))) {
    return `Arquivo sensível ou de configuração interna bloqueado para upload público (${rel})`;
  }
  if (textSnippet && (/\b(?:BEGIN (?:RSA|EC|OPENSSH) PRIVATE KEY|AKIA[0-9A-Z]{16}|sk-[a-zA-Z0-9]{20,})\b/.test(textSnippet) || detectPromptInjection(textSnippet).length > 0)) {
    return `Possível credencial ou prompt injection detectado em ${rel || item.id}`;
  }
  return null;
}

function rewriteExportAssetReference(rawValue, { localAssetMap, assetLicense }) {
  const value = String(rawValue ?? "").trim();
  if (!value || value.startsWith("#") || /^var\(/i.test(value) || /^\{\{uploaded:[a-f0-9]{64}\}\}$/.test(value)) return value;
  if (/^data:/i.test(value)) throw new MotionError(ERROR_CODES.BRIDGE_EXPORT_BLOCKED, "URI data em CSS/SVG requer extração e validação como asset independente.");
  if (/^https?:/i.test(value)) {
    const safeUrl = assertSafeRemoteUrl(value);
    if (!assessLicense(assetLicense ?? {}, { commercial: true }).allowed) {
      throw new MotionError(ERROR_CODES.BRIDGE_EXPORT_BLOCKED, "Asset remoto sem licença comercial verificável; hidrate-o com Asset Hydrator antes da exportação.");
    }
    return safeUrl;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//")) {
    throw new MotionError(ERROR_CODES.BRIDGE_UNSAFE_URL, `Referência de asset com esquema/origem não permitida: ${value.slice(0, 80)}`);
  }
  const cleanRel = value.replace(/^(?:\.\/|\/)+/, "");
  assertSafeRelativePath(cleanRel);
  const sha = localAssetMap.get(cleanRel);
  if (!sha) throw new MotionError(ERROR_CODES.BRIDGE_EXPORT_BLOCKED, `Asset local '${cleanRel}' não foi incluído nem hidratado para a exportação.`);
  return `{{uploaded:${sha}}}`;
}

function rewriteCssAssetUrls(cssText, context) {
  return String(cssText).replace(/url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)/gi, (whole, quote, quoted, bare) => {
    const value = (quoted ?? bare ?? "").trim();
    if (!value) return whole;
    const rewritten = rewriteExportAssetReference(value, context);
    return `url(${quote ?? "\""}${rewritten}${quote ?? "\""})`;
  });
}

function rewriteLocalAssetReferencesInHtml(rawHtml, context) {
  const tokens = tokenizeHtml(String(rawHtml ?? ""));
  for (const token of tokens) {
    if (token.type === "startTag") {
      token.attrs = token.attrs.map((attr) => {
        const name = attr.name.toLowerCase();
        if (attr.value === null) return attr;
        if (name === "style") return { ...attr, value: rewriteCssAssetUrls(attr.value, context) };
        if ((token.tagName === "img" || token.tagName === "source") && name === "src") {
          if (/^data:/i.test(attr.value)) return attr;
          return { ...attr, value: rewriteExportAssetReference(attr.value, context) };
        }
        if (token.tagName === "image" && ["href", "xlink:href"].includes(name)) {
          return { ...attr, value: rewriteExportAssetReference(attr.value, context) };
        }
        if (["srcset", "imagesrcset"].includes(name)) {
          const candidates = parseSrcset(attr.value).map((candidate) => ({
            ...candidate,
            url: /^data:/i.test(candidate.url) ? candidate.url : rewriteExportAssetReference(candidate.url, context),
          }));
          return { ...attr, value: candidates.map(({ url, descriptor }) => `${url}${descriptor ? ` ${descriptor}` : ""}`).join(", ") };
        }
        return attr;
      });
    } else if (token.type === "text" && token.rawtextFor === "style") {
      token.text = rewriteCssAssetUrls(token.text, context);
    }
  }
  return serializeHtmlTokens(tokens);
}

/**
 * Prepares frame HTML for safe editor export:
 *   - Sanitizes untrusted scripts/events/unsafe CSS via scanUntrustedHtml
 *   - Strips frame-level :root palette overrides (editor tokens live at canvas scope)
 *   - Rejects or extracts inline base64 data URIs (promotes small raster images to asset upload queue)
 *   - Sanitizes inline <svg>; promotes SVGs > maxInlineSvgBytes to .svg upload + <img> placeholder
 *   - Rewrites local ./assets/... paths to {{uploaded:<sha256>}} tokens and preserves all data-doop-* attrs
 */
export function prepareOutgoingFrameHtml(
  rawHtml,
  {
    maxInlineSvgBytes = DEFAULT_MAX_INLINE_SVG_BYTES,
    localAssetMap = new Map(),
    extractedInlineAssets = [],
    assetLicense = null,
  } = {}
) {
  const localRewrittenHtml = rewriteLocalAssetReferencesInHtml(String(rawHtml ?? ""), { localAssetMap, assetLicense });
  const { sanitizedHtml, securityFindings } = scanUntrustedHtml(localRewrittenHtml, {
    allowLoopback: false,
    stripAnimations: false,
  });

  const tokens = tokenizeHtml(sanitizedHtml);
  const out = [];
  const warnings = [];
  const dataDoopIds = [];
  const componentsPreserved = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type === "startTag") {
      const tag = tok.tagName;
      const attrs = [...tok.attrs];

      for (const a of attrs) {
        const ln = a.name.toLowerCase();
        if (ln === "data-doop-id" && a.value) dataDoopIds.push(a.value);
      }
      if (tag === "doop-use") {
        const comp = attrs.find((a) => a.name.toLowerCase() === "component")?.value;
        const id = attrs.find((a) => a.name.toLowerCase() === "id")?.value ?? null;
        if (comp) componentsPreserved.push({ id, component: comp });
      } else {
        const motionComp = attrs.find((a) => a.name.toLowerCase() === "data-motion-component")?.value;
        if (motionComp) {
          const id = attrs.find((a) => a.name.toLowerCase() === "id")?.value ?? null;
          componentsPreserved.push({ id, component: motionComp });
        }
      }

      // Remove Motion studio scaffolding scripts/reset styles before returning editable markup to Doop
      if (tag === "script") {
        const typeAttr = attrs.find((a) => a.name.toLowerCase() === "type")?.value ?? "";
        const isMotionModule = typeAttr.toLowerCase() === "module" || attrs.some((a) => a.name === "data-motion-driver");
        if (isMotionModule) {
          warnings.push("Script de driver determinístico (@technomanceer/motion-core) omitido do frame editável do editor.");
          while (i + 1 < tokens.length && !(tokens[i + 1].type === "endTag" && tokens[i + 1].tagName === "script")) i++;
          if (tokens[i + 1]?.type === "endTag") i++;
          continue;
        }
      }

      // Keep frame-local token/theme declarations intact; the adapter never mutates global tokens.

      // Check inline <svg> byte size (> 20 KB must upload via upload_asset and embed as <img>)
      if (tag === "svg" && !tok.selfClosing) {
        const svgTokens = [tok];
        let depth = 1;
        while (i + 1 < tokens.length && depth > 0) {
          i++;
          svgTokens.push(tokens[i]);
          if (tokens[i].type === "startTag" && tokens[i].tagName === "svg" && !tokens[i].selfClosing) depth++;
          else if (tokens[i].type === "endTag" && tokens[i].tagName === "svg") depth--;
        }
        const rawSvg = svgTokens.map((t) => t.raw ?? t.text ?? `</${t.rawName ?? t.tagName}>`).join("");
        const cleanSvg = assertSafeSvg(rawSvg, { strict: false });
        const svgBytes = Buffer.byteLength(cleanSvg, "utf8");
        if (svgBytes > maxInlineSvgBytes) {
          const buf = Buffer.from(cleanSvg, "utf8");
          const sha = sha256Buf(buf);
          extractedInlineAssets.push({
            id: `svg-${sha.slice(0, 10)}`,
            kind: "svg",
            mime: "image/svg+xml",
            buffer: buf,
            sha256: sha,
            origin: "motion:inline-svg-promoted",
            license: assetLicense,
          });
          warnings.push(`SVG inline (${svgBytes} bytes > ${maxInlineSvgBytes}) promovido para upload_asset + <img>.`);
          out.push(`<img src="{{uploaded:${sha}}}" alt="Vector illustration" style="max-width:100%;height:auto;display:block" />`);
        } else {
          out.push(cleanSvg);
        }
        continue;
      }

      // Rewrite <img> src attributes: reject base64 data: URIs or promote to upload_asset, localize relative paths
      if ((tag === "img" || tag === "source") && attrs.some((a) => a.name.toLowerCase() === "src")) {
        const rewrittenAttrs = attrs.map((a) => {
          if (a.name.toLowerCase() === "style" && a.value !== null) {
            return { ...a, value: rewriteCssAssetUrls(a.value, { localAssetMap, assetLicense }) };
          }
          if (["srcset", "imagesrcset"].includes(a.name.toLowerCase()) && a.value) {
            const candidates = parseSrcset(a.value).map((candidate) => ({
              ...candidate,
              url: rewriteExportAssetReference(candidate.url, { localAssetMap, assetLicense }),
            }));
            return { ...a, value: candidates.map(({ url, descriptor }) => `${url}${descriptor ? ` ${descriptor}` : ""}`).join(", ") };
          }
          if (a.name.toLowerCase() !== "src" || !a.value) return a;
          const val = a.value.trim();
          const dataMatch = val.match(/^data:(image\/(?:png|jpe?g|webp|gif|avif|svg\+xml));base64,([a-z0-9+/=\s]+)$/i);
          if (dataMatch) {
            const buf = Buffer.from(dataMatch[2].replace(/\s+/g, ""), "base64");
            const verified = inspectAndSanitizeAssetBinary(buf, { contentType: dataMatch[1], expectedKind: "image", url: "inline-data-uri" });
            const stripped = stripImageMetadata(verified.buffer, verified.mime);
            const sha = sha256Buf(stripped);
            extractedInlineAssets.push({
              id: `inline-${sha.slice(0, 10)}`,
              kind: verified.kind,
              mime: verified.mime,
              buffer: stripped,
              sha256: sha,
              origin: "motion:data-uri-extracted",
              license: assetLicense,
            });
            warnings.push(`Data URI base64 em <${tag}> extraída para upload_asset (Doop recusa base64 em frames).`);
            return { ...a, value: `{{uploaded:${sha}}}` };
          }
          const utf8SvgMatch = val.match(/^data:image\/svg\+xml;utf8,(.*)$/i);
          if (utf8SvgMatch) {
            const rawSvg = decodeURIComponent(utf8SvgMatch[1]);
            const cleanSvg = assertSafeSvg(rawSvg, { strict: false });
            const buf = Buffer.from(cleanSvg, "utf8");
            const sha = sha256Buf(buf);
            extractedInlineAssets.push({
              id: `inline-svg-${sha.slice(0, 10)}`,
              kind: "svg",
              mime: "image/svg+xml",
              buffer: buf,
              sha256: sha,
              origin: "motion:svg-data-uri-extracted",
              license: assetLicense,
            });
            warnings.push(`Data URI SVG utf8 em <${tag}> promovida para upload_asset.`);
            return { ...a, value: `{{uploaded:${sha}}}` };
          }
          if (/^data:/i.test(val)) {
            throw new MotionError(ERROR_CODES.BRIDGE_EXPORT_BLOCKED, "Data URI não suportada em frame exportado.");
          }
          return { ...a, value: rewriteExportAssetReference(val, { localAssetMap, assetLicense }) };
        });
        const attrStr = rewrittenAttrs.map((a) => (a.value === null ? ` ${a.name}` : ` ${a.name}="${escapeHtmlText(a.value)}"`)).join("");
        out.push(`<${tok.rawName ?? tok.tagName}${attrStr}${tok.selfClosing ? " />" : ">"}`);
        continue;
      }

      const attrStr = attrs.map((a) => {
        const value = a.name.toLowerCase() === "style" && a.value !== null
          ? rewriteCssAssetUrls(a.value, { localAssetMap, assetLicense })
          : a.value;
        return value === null ? ` ${a.name}` : ` ${a.name}="${escapeHtmlText(value)}"`;
      }).join("");
      out.push(`<${tok.rawName ?? tok.tagName}${attrStr}${tok.selfClosing ? " />" : ">"}`);
      continue;
    }

    if (tok.type === "endTag") {
      out.push(`</${tok.rawName ?? tok.tagName}>`);
      continue;
    }
    if (tok.type === "text" || tok.type === "comment" || tok.type === "doctype") {
      // Preserve local token and theme declarations for editable round-trip fidelity.
      let txt = tok.raw ?? tok.text ?? "";
      if (tok.rawtextFor === "style") txt = rewriteCssAssetUrls(txt, { localAssetMap, assetLicense });
      out.push(txt);
    }
  }

  return {
    html: out.join("").trim(),
    warnings,
    securityFindings,
    dataDoopIds: [...new Set(dataDoopIds)],
    componentsPreserved,
  };
}

/**
 * Builds a clean, referential HTML card for non-playable Motion media (MP4/WebM/Three.js/GSAP/cinematic)
 * referencing a poster image upload and storyboard summary without putting video or JS bundles into Doop.
 */
function buildReferentialPosterFrameHtml({ title, format, durationSec = null, fps = null, posterRef, storyboardSummary = null, repoRef = null }) {
  const safeTitle = escapeHtmlText(title);
  const safeFormat = escapeHtmlText(String(format).toUpperCase());
  const metaParts = [safeFormat];
  if (durationSec) metaParts.push(`${durationSec}s`);
  if (fps) metaParts.push(`${fps} fps`);
  const safeRepo = repoRef ? escapeHtmlText(repoRef) : null;
  const safeSummary = storyboardSummary ? escapeHtmlText(storyboardSummary.slice(0, 600)) : null;

  return `<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:var(--color-surface,#111827);color:var(--color-ink,#f8fafc);padding:32px;display:flex;flex-direction:column;gap:20px;min-height:100vh}.badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;background:var(--color-primary,#2563eb);color:#fff;width:fit-content}.poster{width:100%;border-radius:12px;border:1px solid rgba(148,163,184,.25);display:block;max-height:540px;object-fit:contain;background:#0f172a}.meta{font-size:14px;opacity:.8}.notes{font-size:13px;line-height:1.5;opacity:.85;white-space:pre-wrap;background:rgba(15,23,42,.35);padding:16px;border-radius:10px}</style></head><body><div class="badge">MOTION REFERENTIAL · ${safeFormat}</div><h1 style="font-size:28px;line-height:1.2">${safeTitle}</h1><div class="meta">${metaParts.join(" · ")} — Render externo (reprodução de vídeo/WebGL não suportada nativamente em frames do canvas).</div>${posterRef ? `<img class="poster" src="${posterRef}" alt="${safeTitle} poster" />` : ""}${safeSummary ? `<div class="notes">${safeSummary}</div>` : ""}${safeRepo ? `<div class="meta">Artefato de referência: ${safeRepo}</div>` : ""}</body></html>`;
}

/**
 * STAGE 1 — INSPECT: inspects source artifacts, tokens, IR, provenance, and optional remote editor snapshot.
 */
export async function inspectExportSource(
  input = {},
  {
    adapter = null,
    documentId = null,
    projectDir = null,
    maxImageBytes = DEFAULT_MAX_IMAGE_BYTES,
    maxInlineSvgBytes = DEFAULT_MAX_INLINE_SVG_BYTES,
    commercial = true,
  } = {}
) {
  const ir = input.ir ? validateDesignIR(input.ir) : null;
  const tokenBundle = input.tokenBundle ? validateTokenBundle(input.tokenBundle) : null;
  const provenanceManifest = input.provenanceManifest
    ? validateAssetProvenance(input.provenanceManifest, { commercial })
    : null;
  const docId = String(documentId ?? ir?.source?.documentId ?? "");
  if (!docId) {
    throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, "inspectExportSource exige documentId (canvasId).");
  }
  const normalizationReport = validateNormalizationReport(input.normalizationReport);
  const storyboard = validateStoryboardInput(input.storyboard, "Storyboard");
  const prototypeToStoryboard = validateStoryboardInput(input.prototypeToStoryboard, "Prototype-to-Storyboard");

  const rootAbs = projectDir ? path.resolve(projectDir) : null;
  const items = [];
  const privacyBlocked = [];
  const uploadCandidates = [];
  const localAssetMap = new Map();

  // Inspect provenance assets if provided
  const provAssets = provenanceManifest?.assets ?? [];
  const provByPath = new Map(provAssets.map((a) => [a.localPath, a]));

  const artifactInputs = Array.isArray(input.artifacts) ? input.artifacts : [];
  for (let i = 0; i < artifactInputs.length; i++) {
    const art = artifactInputs[i];
    const relPath = art.path ? String(art.path) : null;
    if (relPath) assertSafeRelativePath(relPath);
    const id = art.id ?? `art-${String(i + 1).padStart(3, "0")}`;
    const ext = relPath ? path.extname(relPath).toLowerCase() : (art.format ? `.${String(art.format).toLowerCase().replace(/^\./, "")}` : "");
    const privacyIssue = isSensitiveArtifact(art, typeof art.content === "string" ? art.content : "");
    if (privacyIssue) {
      privacyBlocked.push({ id, path: relPath ?? id, reason: privacyIssue });
      items.push({ id, sourcePath: relPath ?? id, format: ext || art.kind || "unknown", category: "blocked", strategy: "privacy-blocked", warnings: [privacyIssue] });
      continue;
    }

    // Load bytes when path is inside projectDir (preventing traversal & symlinks!)
    let bytes = art.buffer ? Buffer.from(art.buffer) : typeof art.content === "string" ? Buffer.from(art.content, "utf8") : null;
    if (!bytes && relPath && rootAbs) {
      const safeAbs = await assertSafeProjectPath(rootAbs, relPath);
      if (existsSync(safeAbs)) bytes = await readFile(safeAbs);
    }

    const textArtifact = EDITABLE_EXTENSIONS.has(ext) || art.kind === "html" || [".css", ".json", ".md", ".txt", ".js", ".mjs"].includes(ext);
    if (bytes && textArtifact) {
      const contentIssue = isSensitiveArtifact(art, bytes.toString("utf8"));
      if (contentIssue) {
        privacyBlocked.push({ id, path: relPath ?? id, reason: contentIssue });
        items.push({ id, sourcePath: relPath ?? id, format: ext || art.kind || "unknown", category: "blocked", strategy: "privacy-blocked", warnings: [contentIssue] });
        continue;
      }
    }

    if (art.kind === "threejs" || art.kind === "gsap" || art.kind === "cinematic" || art.kind === "video" || REFERENTIAL_EXTENSIONS.has(ext)) {
      let posterSha = null;
      if (art.posterBuffer) {
        const posterPath = art.posterPath ? String(art.posterPath).replace(/^\.\//, "") : null;
        const posterLicense = art.posterLicense ?? art.license ?? (posterPath ? provByPath.get(posterPath)?.license : null);
        const licenseVerdict = assessLicense(posterLicense ?? {}, { commercial });
        if (!licenseVerdict.allowed) {
          privacyBlocked.push({ id: `${id}-poster`, path: art.posterPath ?? `${id}-poster`, reason: `Licença bloqueada para publicação: ${licenseVerdict.reason}` });
        } else {
          const verifiedPoster = inspectAndSanitizeAssetBinary(Buffer.from(art.posterBuffer), {
            contentType: art.posterMime ?? "image/png",
            expectedKind: "image",
            url: `${id}-poster`,
          });
          const cleanedPoster = stripImageMetadata(verifiedPoster.buffer, verifiedPoster.mime);
          if (cleanedPoster.length <= maxImageBytes) {
            posterSha = sha256Buf(cleanedPoster);
            uploadCandidates.push({
              id: `${id}-poster`,
              sourcePath: `${id}-poster.${verifiedPoster.ext}`,
              kind: verifiedPoster.kind,
              mime: verifiedPoster.mime,
              ext: verifiedPoster.ext,
              buffer: cleanedPoster,
              sha256: posterSha,
              bytes: cleanedPoster.length,
              origin: "motion:referential-poster",
              trademark: Boolean(art.trademark || licenseVerdict.trademark),
              license: posterLicense,
            });
          } else {
            privacyBlocked.push({ id: `${id}-poster`, path: art.posterPath ?? `${id}-poster`, reason: `Tamanho ${cleanedPoster.length} excede o limite Doop de ${maxImageBytes} bytes.` });
          }
        }
      }
      items.push({
        id,
        sourcePath: relPath ?? id,
        format: art.kind ?? ext.slice(1),
        category: "referential",
        strategy: "poster-plus-storyboard-reference",
        warnings: [`Formato '${art.kind ?? ext}' não executa nativamente em frame do editor; será exportado como poster estático + notas/referência.`],
        meta: {
          title: art.title ?? path.basename(relPath ?? id),
          posterPath: art.posterPath ?? null,
          posterSha,
          durationSec: art.durationSec ?? null,
          fps: art.fps ?? null,
        },
      });
      continue;
    }

    if (EDITABLE_EXTENSIONS.has(ext) || art.kind === "html") {
      if (!bytes) {
        items.push({ id, sourcePath: relPath ?? id, format: "html", category: "blocked", strategy: "missing-file", warnings: [`HTML ausente: ${relPath ?? id}`] });
        continue;
      }
      items.push({
        id,
        sourcePath: relPath ?? id,
        format: "html",
        category: "editable",
        strategy: "sanitized-html-frame",
        warnings: [],
        rawHtml: bytes ? bytes.toString("utf8") : "",
        name: art.name ?? path.basename(relPath ?? id, ext || ".html"),
        width: art.width ?? 1280,
        height: art.height ?? 800,
        targetFrameId: art.targetFrameId ?? (artifactInputs.length === 1 ? ir?.source?.frameId ?? null : null),
        pageId: art.pageId ?? null,
        license: art.license ?? (relPath ? provByPath.get(relPath)?.license ?? provByPath.get(relPath.replace(/^\.\//, ""))?.license : null) ?? null,
      });
      continue;
    }

    if (FONT_EXTENSIONS.has(ext) || art.kind === "font") {
      items.push({
        id,
        sourcePath: relPath ?? id,
        format: ext.slice(1) || "font",
        category: "blocked",
        strategy: "unsupported-editor-upload",
        warnings: ["O MCP Doop disponível não declara upload_font; o exportador não envia nem incorpora fontes."],
      });
      continue;
    }

    if (RASTER_OR_SVG_EXTENSIONS.has(ext) || ["image", "svg"].includes(art.kind)) {
      if (!bytes) {
        items.push({ id, sourcePath: relPath ?? id, format: ext.slice(1) || art.kind, category: "blocked", strategy: "missing-file", warnings: [`Arquivo ausente: ${relPath}`] });
        continue;
      }
      const prov = relPath ? provByPath.get(relPath) ?? provByPath.get(relPath.replace(/^\.\//, "")) : null;
      const license = art.license ?? prov?.license ?? null;
      const licVerdict = assessLicense(license ?? {}, { commercial });
      if (!licVerdict.allowed) {
        privacyBlocked.push({ id, path: relPath ?? id, reason: `Licença bloqueada para publicação: ${licVerdict.reason}` });
        items.push({ id, sourcePath: relPath ?? id, format: ext.slice(1), category: "blocked", strategy: "license-blocked", warnings: [licVerdict.reason] });
        continue;
      }

      const expectedKind = FONT_EXTENSIONS.has(ext) || art.kind === "font" ? "font" : ext === ".svg" || art.kind === "svg" ? "svg" : "image";
      const verified = inspectAndSanitizeAssetBinary(bytes, { contentType: art.mime ?? "", expectedKind, url: relPath ?? id });
      const cleanedBuf = stripImageMetadata(verified.buffer, verified.mime);
      const maxAllowed = maxImageBytes;
      if (cleanedBuf.length > maxAllowed) {
        items.push({
          id,
          sourcePath: relPath ?? id,
          format: verified.ext,
          category: "blocked",
          strategy: "size-limit-exceeded",
          warnings: [`Tamanho ${cleanedBuf.length} bytes excede limite do editor (${maxAllowed} bytes).`],
        });
        continue;
      }
      const sha = sha256Buf(cleanedBuf);
      if (relPath) localAssetMap.set(relPath.replace(/^\.\//, ""), sha);
      uploadCandidates.push({
        id,
        sourcePath: relPath ?? `${id}.${verified.ext}`,
        kind: verified.kind,
        mime: verified.mime,
        ext: verified.ext,
        buffer: cleanedBuf,
        sha256: sha,
        bytes: cleanedBuf.length,
        origin: art.origin ?? prov?.origin ?? "motion:export",
        trademark: Boolean(art.trademark || prov?.trademark || licVerdict.trademark),
        license,
      });
      items.push({
        id,
        sourcePath: relPath ?? id,
        format: verified.ext,
        category: "rasterized",
        strategy: "upload_asset",
        warnings: [
          ...(cleanedBuf.length < verified.buffer.length ? ["Metadados de imagem não essenciais removidos antes do upload."] : []),
          ...(verified.mime === "image/gif" ? ["GIF exportado como asset de imagem; reprodução animada no canvas não foi verificada."] : []),
        ],
      });
      continue;
    }

    items.push({ id, sourcePath: relPath ?? id, format: ext.slice(1) || art.kind || "unknown", category: "blocked", strategy: "unsupported-format", warnings: [`Formato '${ext || art.kind || "desconhecido"}' não possui estratégia de exportação implementada.`] });
  }

  let remoteSnapshot = null;
  if (supportsExportOperations(adapter) && typeof adapter.inspectRemoteState === "function") {
    remoteSnapshot = await adapter.inspectRemoteState({
      documentId: docId,
      frameIds: items.map((x) => x.targetFrameId).filter(Boolean),
    });
  }

  return {
    documentId: docId,
    adapterEditor: adapter?.editor ?? "doop",
    ir,
    tokenBundle,
    storyboard,
    prototypeToStoryboard,
    normalizationReport,
    provenanceManifest,
    items,
    uploadCandidates,
    localAssetMap,
    privacyBlocked,
    remoteSnapshot,
    maxInlineSvgBytes,
  };
}

/**
 * STAGE 2 — PLAN: produces a deterministic ExportPlan@1 with token conflict analysis,
 * preservation policies, stable operation IDs, dependencies, and input hashes.
 */
export function planExportToEditor(
  inspected,
  {
    adapter = null,
    policy = "create-new-frame",
    targetPageId = null,
    dryRun: dryRunOption = false,
    allowUpdateExisting = false,
    allowTokenMutation = false,
    allowComponentMutation = false,
    allowPublicUpload = false,
    approvedFrameOverride = false,
    agentName = "MotionStudio",
  } = {}
) {
  if (!EXPORT_POLICIES.includes(policy)) {
    throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, `Política de exportação inválida: ${policy}`);
  }
  const dryRun = dryRunOption === true || policy === "dry-run";
  const operationPolicy = policy === "dry-run" ? "create-new-frame" : policy;
  const operations = [];
  const tokenConflicts = [];
  const unavailableTokenNames = new Set();
  const extractedInlineAssets = [];
  const compatItems = inspected.items.map((item) => ({ ...item, warnings: [...(item.warnings ?? [])] }));
  const remote = inspected.remoteSnapshot ?? { verified: false, tokensVerified: false, componentsVerified: false, tokens: [], components: [], frames: {}, pages: [], approvedFrameCount: 0 };
  const remoteTokensByVar = new Map((remote.tokens ?? []).map((t) => [String(t.cssVar ?? t.name ?? "").startsWith("--") ? (t.cssVar ?? t.name) : `--${t.cssVar ?? t.name}`, t]));
  const remoteComponentNames = new Set((remote.components ?? []).map((component) => typeof component === "string" ? component : component?.name ?? component?.componentName).filter(Boolean));
  const privacyBlocked = [...(inspected.privacyBlocked ?? [])];
  const unverifiedCapabilities = [];
  if (!remote.tokensVerified && inspected.tokenBundle) unverifiedCapabilities.push("remote-token-read");
  if (!remote.componentsVerified) unverifiedCapabilities.push("remote-component-read");
  const approvedFrameCount = remote.approvedFrameCount ?? Object.values(remote.frames ?? {}).filter((f) => f?.approvalStatus === "ready_for_dev").length;

  let opSeq = 0;
  const pushOp = ({ kind, source, target, dependsOn = [], preconditions = {}, payload = {}, reversible = false, compensable = true, expectedOutcome }) => {
    const inputHash = sha256Json({ kind, source, target, preconditions, payload });
    const id = `op-${String(++opSeq).padStart(3, "0")}-${inputHash.slice(0, 8)}`;
    operations.push({
      id,
      kind,
      source,
      target,
      dependsOn,
      preconditions,
      payload,
      inputHash,
      reversible,
      compensable,
      expectedOutcome,
    });
    return id;
  };

  // 1) Tokens reconciliation. The connected Doop MCP schema is read-only for tokens.
  if (inspected.tokenBundle) {
    const exportedTokenPayload = adapter?.exportTokens
      ? adapter.exportTokens(inspected.tokenBundle)
      : { themes: inspected.tokenBundle.themes ?? [], tokens: inspected.tokenBundle.tokens.map((t) => ({ name: t.cssVar, type: t.type, value: t.value, themes: t.themes })) };

    for (const tok of exportedTokenPayload.tokens ?? []) {
      const name = String(tok.name ?? tok.cssVar ?? "");
      const tokenName = name.startsWith("--") ? name : `--${name}`;
      const existing = remoteTokensByVar.get(tokenName);
      if (!remote.tokensVerified) {
        tokenConflicts.push({
          cssVar: tokenName,
          existingValue: null,
          incomingValue: tok.value,
          action: "unverified",
          impactWarning: "O schema MCP disponível não expõe leitura de tokens; valores globais não serão criados nem alterados.",
        });
      } else if (!existing) {
        unavailableTokenNames.add(tokenName);
        tokenConflicts.push({
          cssVar: tokenName,
          existingValue: null,
          incomingValue: tok.value,
          action: "unsupported-create",
          impactWarning: "O MCP Doop disponível não expõe create_tokens; o exportador não cria tokens globais.",
        });
      } else if (
        String(existing.value).trim() === String(tok.value).trim() &&
        (!existing.type || existing.type === tok.type) &&
        sha256Json(existing.themes ?? {}) === sha256Json(tok.themes ?? {})
      ) {
        tokenConflicts.push({
          cssVar: tokenName,
          existingValue: existing.value,
          incomingValue: tok.value,
          action: "reuse-existing",
          impactWarning: null,
        });
      } else {
        unavailableTokenNames.add(tokenName);
        const warning = approvedFrameCount > 0
          ? `Conflito em '${tokenName}': alterar token global pode impactar ${approvedFrameCount} frame(s) aprovado(s) (ready_for_dev).`
          : `Conflito em '${tokenName}': valor existente '${existing.value}' diverge de '${tok.value}'.`;
        tokenConflicts.push({
          cssVar: tokenName,
          existingValue: existing.value,
          incomingValue: tok.value,
          action: allowTokenMutation ? "unsupported-update" : "conflict-blocked",
          impactWarning: `${warning} O MCP Doop disponível não expõe set_tokens.`,
        });
      }
    }
  }

  // 2) Prepare editable frames & detect inline base64 / large inline SVGs before queuing uploads
  const preparedEditableItems = [];
  if (operationPolicy !== "export-assets-only") {
    for (let index = 0; index < compatItems.length; index++) {
      const item = compatItems[index];
      if (item.category !== "editable") continue;
      const prep = prepareOutgoingFrameHtml(item.rawHtml, {
        maxInlineSvgBytes: inspected.maxInlineSvgBytes,
        localAssetMap: inspected.localAssetMap,
        extractedInlineAssets,
        assetLicense: item.license,
      });
      item.warnings.push(...prep.warnings);
      item.warnings.push(...prep.securityFindings.map((finding) => finding.message));
      const missingTokens = remote.tokensVerified
        ? [...new Set([...prep.html.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)].map((match) => match[1]))].filter((name) => unavailableTokenNames.has(name) || !remoteTokensByVar.has(name))
        : [];
      if (!remote.tokensVerified && /var\(\s*--[a-zA-Z0-9_-]+/i.test(prep.html)) {
        if (!unverifiedCapabilities.includes("remote-token-read")) unverifiedCapabilities.push("remote-token-read");
        item.warnings.push("Referências CSS a tokens globais preservadas; o MCP conectado não permite confirmar os valores atuais do canvas.");
      }
      if (missingTokens.length) {
        item.category = "blocked";
        item.strategy = "missing-global-token";
        item.warnings.push(`Tokens globais ausentes no canvas e sem ferramenta MCP de criação: ${missingTokens.join(", ")}`);
      }
      if (remote.componentsVerified) {
        const missingComponents = prep.componentsPreserved.map((c) => c.component).filter((name) => !remoteComponentNames.has(name));
        if (missingComponents.length) {
          item.category = "blocked";
          item.strategy = "missing-shared-component";
          item.warnings.push(`Componentes Doop ausentes e sem ferramenta MCP de criação: ${[...new Set(missingComponents)].join(", ")}`);
        }
      } else if (prep.componentsPreserved.length) {
        item.warnings.push("Referências a componentes compartilhados foram preservadas; o MCP conectado não permite verificar a biblioteca atual.");
        if (!unverifiedCapabilities.includes("remote-component-read")) unverifiedCapabilities.push("remote-component-read");
      }
      preparedEditableItems.push({ item, prep });
    }
  }

  // 3) Upload assets queue (deduplicated by SHA-256!)
  const allUploadsBySha = new Map();
  for (const cand of inspected.uploadCandidates) {
    if (!allUploadsBySha.has(cand.sha256)) allUploadsBySha.set(cand.sha256, cand);
  }
  for (const extra of extractedInlineAssets) {
    if (!allUploadsBySha.has(extra.sha256)) {
      allUploadsBySha.set(extra.sha256, {
        id: extra.id,
        sourcePath: `${extra.id}.${extra.kind === "svg" ? "svg" : "png"}`,
        kind: extra.kind,
        mime: extra.mime,
        ext: extra.kind === "svg" ? "svg" : "png",
        buffer: extra.buffer,
        sha256: extra.sha256,
        bytes: extra.buffer.length,
        origin: extra.origin,
        trademark: false,
        license: extra.license ?? null,
      });
    }
  }

  const uploadOpBySha = new Map();
  for (const [sha, asset] of [...allUploadsBySha.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const kind = "upload_asset";
    const licenseVerdict = assessLicense(asset.license ?? {}, { commercial: true });
    if (asset.bytes > DEFAULT_MAX_IMAGE_BYTES || !licenseVerdict.allowed) {
      privacyBlocked.push({
        id: asset.id,
        path: asset.sourcePath,
        reason: asset.bytes > DEFAULT_MAX_IMAGE_BYTES
          ? `Asset excede o limite Doop de ${DEFAULT_MAX_IMAGE_BYTES} bytes.`
          : `Licença bloqueada para upload público: ${licenseVerdict.reason}`,
      });
      continue;
    }
    const opId = pushOp({
      kind,
      source: { kind: asset.kind, path: asset.sourcePath, sha256: sha, bytes: asset.bytes },
      target: { canvasId: inspected.documentId },
      preconditions: {
        requireNonConfidential: true,
        allowPublicUpload,
        licenseAllowed: licenseVerdict.allowed,
        license: asset.license ?? null,
        maxBytes: DEFAULT_MAX_IMAGE_BYTES,
        sha256: sha,
      },
      payload: {
        canvas_id: inspected.documentId,
        agent_name: agentName,
        mime: asset.mime,
        file_name: path.basename(asset.sourcePath),
        sha256: sha,
        bytes: asset.bytes,
      },
      reversible: false,
      compensable: false,
      expectedOutcome: `Upload ${asset.mime} (${asset.bytes} bytes, sha256=${sha.slice(0, 12)}) como asset público do Doop.`,
    });
    uploadOpBySha.set(sha, opId);
  }

  // 5) Plan frame operations (respecting protection rules!)
  if (operationPolicy !== "export-assets-only") {
    for (const { item, prep } of preparedEditableItems) {
      if (item.category === "blocked") continue;
      const requiredShas = [...new Set([...prep.html.matchAll(/\{\{uploaded:([a-f0-9]{64})\}\}/g)].map((match) => match[1]))];
      const unavailableShas = requiredShas.filter((sha) => !uploadOpBySha.has(sha));
      if (unavailableShas.length) {
        item.category = "blocked";
        item.strategy = "asset-blocked";
        item.warnings.push("Frame bloqueado porque um asset associado excede o limite de tamanho ou não passou a validação de licença.");
        continue;
      }
      const deps = requiredShas.map((sha) => uploadOpBySha.get(sha)).filter(Boolean);

      const targetFrameId = item.targetFrameId ?? null;
      const remoteFrame = targetFrameId ? remote.frames?.[targetFrameId] ?? null : null;

      if (operationPolicy === "update-existing-frame") {
        if (!targetFrameId) {
          throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, `Política 'update-existing-frame' exige targetFrameId para item '${item.id}'.`);
        }
        const frameOpId = pushOp({
          kind: "set_frame_html",
          source: { kind: "editable-html", id: item.id, path: item.sourcePath, dataDoopIds: prep.dataDoopIds, components: prep.componentsPreserved },
          target: { canvasId: inspected.documentId, frameId: targetFrameId, name: item.name },
          dependsOn: deps,
          preconditions: {
            allowUpdateExisting,
            disallowReadyForDev: !approvedFrameOverride,
            remoteApprovalStatus: remoteFrame?.approvalStatus ?? null,
            expectedRevision: remoteFrame?.updatedAt ?? remoteFrame?.revision ?? null,
            expectedHtmlSha256: remoteFrame?.html ? sha256Buf(Buffer.from(remoteFrame.html, "utf8")) : null,
            requireNoBase64: true,
          },
          payload: {
            frame_id: targetFrameId,
            html: prep.html,
            agent_name: agentName,
          },
          reversible: false,
          compensable: false,
          expectedOutcome: `Atualizar frame '${targetFrameId}' preservando data-doop-* e validando revisão.`,
        });
        pushOp({
          kind: "get_frame_screenshot",
          source: { kind: "verification", frameId: targetFrameId },
          target: { canvasId: inspected.documentId, frameId: targetFrameId },
          dependsOn: [frameOpId],
          preconditions: { expectedHtmlSha256: `{{op:${frameOpId}:writtenHtmlSha256}}` },
          payload: { frame_id: targetFrameId, scale: 1, agent_name: agentName },
          reversible: true,
          compensable: true,
          expectedOutcome: `Capturar screenshot de verificação do frame '${targetFrameId}'.`,
        });
      } else {
        const frameName = operationPolicy === "duplicate-as-draft" ? `${item.name} (Motion Draft)` : item.name;
        const frameOpId = pushOp({
          kind: "create_frame",
          source: { kind: "editable-html", id: item.id, path: item.sourcePath, dataDoopIds: prep.dataDoopIds, components: prep.componentsPreserved },
          target: { canvasId: inspected.documentId, pageId: targetPageId ?? null, name: frameName },
          dependsOn: deps,
          preconditions: { requireNoBase64: true, neverAutoApprove: true },
          payload: {
            canvas_id: inspected.documentId,
            name: frameName,
            width: item.width,
            height: item.height,
            ...(targetPageId ? { pageId: targetPageId } : {}),
            html: prep.html,
            stream: Buffer.byteLength(prep.html, "utf8") > 4096,
            agent_name: agentName,
          },
          reversible: false,
          compensable: false,
          expectedOutcome: `Criar novo frame editável '${frameName}' (${item.width}x${item.height}).`,
        });
        pushOp({
          kind: "get_frame_screenshot",
          source: { kind: "verification", opRef: frameOpId },
          target: { canvasId: inspected.documentId, frameId: `{{op:${frameOpId}:frameId}}` },
          dependsOn: [frameOpId],
          preconditions: { expectedHtmlSha256: `{{op:${frameOpId}:writtenHtmlSha256}}` },
          payload: { frame_id: `{{op:${frameOpId}:frameId}}`, scale: 1, agent_name: agentName },
          reversible: true,
          compensable: true,
          expectedOutcome: `Capturar screenshot de verificação de '${frameName}'.`,
        });
      }
    }

    // Referential items (MP4, WebM, Three.js, GSAP, cinematic) -> poster card referencing storyboard/asset
    for (const item of compatItems.filter((x) => x.category === "referential")) {
      const posterRel = item.meta?.posterPath ? String(item.meta.posterPath).replace(/^\.\//, "") : null;
      const posterSha = item.meta?.posterSha ?? (posterRel && inspected.localAssetMap.has(posterRel) ? inspected.localAssetMap.get(posterRel) : null);
      if (posterSha && !uploadOpBySha.has(posterSha)) {
        item.category = "blocked";
        item.strategy = "poster-asset-blocked";
        item.warnings.push("Frame referencial bloqueado porque o poster excede o limite de tamanho ou não passou a validação de licença.");
        continue;
      }
      const deps = posterSha && uploadOpBySha.has(posterSha) ? [uploadOpBySha.get(posterSha)] : [];
      const html = buildReferentialPosterFrameHtml({
        title: item.meta.title,
        format: item.format,
        durationSec: item.meta.durationSec,
        fps: item.meta.fps,
        posterRef: posterSha ? `{{uploaded:${posterSha}}}` : null,
        storyboardSummary: inspected.storyboard?.markdown ?? inspected.prototypeToStoryboard?.markdown ?? null,
        repoRef: item.sourcePath,
      });
      const frameOpId = pushOp({
        kind: "create_frame",
        source: { kind: "referential-media", id: item.id, path: item.sourcePath, format: item.format },
        target: { canvasId: inspected.documentId, pageId: targetPageId ?? null, name: `${item.meta.title} (Referência ${String(item.format).toUpperCase()})` },
        dependsOn: deps,
        preconditions: { requireNoBase64: true, neverAutoApprove: true },
        payload: {
          canvas_id: inspected.documentId,
          name: `${item.meta.title} (Referência ${String(item.format).toUpperCase()})`,
          width: 1280,
          height: 800,
          ...(targetPageId ? { pageId: targetPageId } : {}),
          html,
          stream: Buffer.byteLength(html, "utf8") > 4096,
          agent_name: agentName,
        },
        reversible: false,
        compensable: false,
        expectedOutcome: `Criar frame referencial (poster + notas) para '${item.sourcePath}'.`,
      });
      pushOp({
        kind: "get_frame_screenshot",
        source: { kind: "verification", opRef: frameOpId },
        target: { canvasId: inspected.documentId, frameId: `{{op:${frameOpId}:frameId}}` },
        dependsOn: [frameOpId],
        preconditions: { expectedHtmlSha256: `{{op:${frameOpId}:writtenHtmlSha256}}` },
        payload: { frame_id: `{{op:${frameOpId}:frameId}}`, scale: 1, agent_name: agentName },
        reversible: true,
        compensable: true,
        expectedOutcome: `Verificar renderização do frame referencial para '${item.sourcePath}'.`,
      });
    }
  }

  const classifications = {
    editable: compatItems.filter((i) => i.category === "editable").length,
    rasterized: compatItems.filter((i) => i.category === "rasterized").length,
    referential: compatItems.filter((i) => i.category === "referential").length,
    blocked: compatItems.filter((i) => i.category === "blocked").length,
  };

  const normalizedPlan = validateExportPlan({
    schemaVersion: SCHEMA_VERSION,
    targetEditor: inspected.adapterEditor,
    documentId: inspected.documentId,
    policy,
    dryRun,
    authorization: {
      allowUpdateExisting: Boolean(allowUpdateExisting),
      allowTokenMutation: Boolean(allowTokenMutation),
      allowComponentMutation: Boolean(allowComponentMutation),
      allowPublicUpload: Boolean(allowPublicUpload),
      approvedFrameOverride: Boolean(approvedFrameOverride),
    },
    compatibilityReport: {
      schemaVersion: SCHEMA_VERSION,
      classifications,
      items: compatItems.map(({ rawHtml: _r, ...rest }) => rest),
      tokenConflicts,
      privacyBlocked,
      warnings: compatItems.flatMap((item) => item.warnings ?? []).map((message) => String(message)),
      unverifiedCapabilities,
      normalizationReport: inspected.normalizationReport,
    },
    operations,
  });
  const assetBuffers = new Map([...allUploadsBySha.entries()].map(([sha, asset]) => [sha, Buffer.from(asset.buffer)]));
  Object.defineProperty(normalizedPlan, "assetBuffers", { value: assetBuffers, enumerable: false });
  return normalizedPlan;
}

/**
 * STAGE 3 — VALIDATE: enforces privacy/confidentiality rules, approved-frame protection,
 * explicit authorization gates, and schema integrity before any write executes.
 */
export function validateExportPlanAndPreconditions(planInput, { allowBlockedPrivacy = false } = {}) {
  const plan = validateExportPlan(planInput);
  const findings = [];
  if (plan.dryRun) return { ok: true, plan, findings };

  if (!allowBlockedPrivacy && plan.compatibilityReport.privacyBlocked.length > 0) {
    findings.push({
      code: ERROR_CODES.BRIDGE_EXPORT_BLOCKED,
      message: `Exportação bloqueada por privacidade/licença (${plan.compatibilityReport.privacyBlocked.length} item(ns)).`,
      details: plan.compatibilityReport.privacyBlocked,
    });
  }

  if (!plan.dryRun) {
    for (const op of plan.operations) {
      if (op.kind === "set_frame_html" || op.kind === "edit_frame_html" || op.kind === "append_frame_html") {
        if (!plan.authorization.allowUpdateExisting) {
          findings.push({
            code: ERROR_CODES.BRIDGE_EXPORT_PROTECTED,
            message: `Política update-existing-frame exige allowUpdateExisting: true (op ${op.id}).`,
          });
        }
        if (op.preconditions?.remoteApprovalStatus === "ready_for_dev" && !plan.authorization.approvedFrameOverride) {
          findings.push({
            code: ERROR_CODES.BRIDGE_EXPORT_PROTECTED,
            message: `Frame aprovado (ready_for_dev) '${op.target.frameId}' é protegido contra sobrescrita automática.`,
          });
        }
      }
      if (op.kind === "upload_asset" && !plan.authorization.allowPublicUpload) {
        findings.push({
          code: ERROR_CODES.BRIDGE_EXPORT_BLOCKED,
          message: `Upload para URL pública permanente requer allowPublicUpload: true (op ${op.id}).`,
        });
      }
      if (op.kind === "upload_asset" && (op.preconditions?.licenseAllowed !== true || op.source?.bytes > op.preconditions?.maxBytes)) {
        findings.push({
          code: ERROR_CODES.BRIDGE_EXPORT_BLOCKED,
          message: `Asset ${op.source?.path ?? op.id} não passou a validação de licença/tamanho.`,
        });
      }
      if (op.preconditions?.requireNoBase64 && typeof op.payload?.html === "string") {
        if (/data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/i.test(op.payload.html)) {
          findings.push({
            code: ERROR_CODES.BRIDGE_SECURITY_VIOLATION,
            message: `HTML de saída na operação ${op.id} ainda contém URI base64 proibida.`,
          });
        }
      }
      if (op.kind === "set_frame_approval" && op.payload?.status === "ready_for_dev") {
        findings.push({
          code: ERROR_CODES.BRIDGE_EXPORT_PROTECTED,
          message: "Exportador nunca pode marcar frames como ready_for_dev automaticamente.",
        });
      }
    }
  }

  if (findings.length > 0) {
    throw new MotionError(findings[0].code, findings[0].message, { details: findings });
  }
  return { ok: true, plan };
}

function resolvePlaceholders(value, opResultsById, uploadedBySha) {
  if (typeof value === "string") {
    return value
      .replace(/\{\{uploaded:([a-f0-9]{64})\}\}/g, (_, sha) => uploadedBySha.get(sha) ?? `{{uploaded:${sha}}}`)
      .replace(/\{\{op:([^:]+):([^}]+)\}\}/g, (_, opId, field) => opResultsById.get(opId)?.[field] ?? `{{op:${opId}:${field}}}`);
  }
  if (Array.isArray(value)) return value.map((v) => resolvePlaceholders(v, opResultsById, uploadedBySha));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = resolvePlaceholders(v, opResultsById, uploadedBySha);
    }
    return out;
  }
  return value;
}

function isRetryablePreCommitError(err) {
  const code = err?.code ?? "";
  if (code === ERROR_CODES.BRIDGE_RATE_LIMITED || err?.status === 429) return true;
  return err?.preCommit === true && err?.retryable === true;
}

/**
 * STAGE 4 & 5 — EXECUTE & VERIFY:
 * Runs authorized operations with sequential upload rate-limiting, SHA-256 deduplication,
 * backoff retries (never retrying ambiguous ops), pre-write revision conflict check,
 * cancellation support, safe resumption from `previousResult`, and post-write verification.
 */
export async function executeExportPlan(
  planInput,
  {
    adapter,
    previousResult = null,
    maxUploadsPerMinute = DEFAULT_UPLOADS_PER_MIN,
    maxRetries = 2,
    backoffBaseMs = 50,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal = null,
    assetResolver = null,
    allowBlockedPrivacy = false,
    now = () => Date.now(),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    onProgress = null,
  } = {}
) {
  const assetBuffers = planInput?.assetBuffers instanceof Map ? planInput.assetBuffers : new Map();
  const { plan } = validateExportPlanAndPreconditions(planInput, { allowBlockedPrivacy });
  if (previousResult) validateExportResult(previousResult);
  if (previousResult && previousResult.planHash !== plan.planHash) {
    throw new MotionError(ERROR_CODES.BRIDGE_SCHEMA_INVALID, "previousResult pertence a outro ExportPlan; reconcilie pelo planHash antes de retomar.");
  }
  if (plan.dryRun) {
    return validateExportResult({
      schemaVersion: SCHEMA_VERSION,
      planId: plan.planId,
      planHash: plan.planHash,
      targetEditor: plan.targetEditor,
      documentId: plan.documentId,
      policy: plan.policy,
      dryRun: true,
      status: "DRY_RUN",
      operations: plan.operations.map((o) => ({ id: o.id, kind: o.kind, status: "planned", attempts: 0, reversible: o.reversible, remoteId: null, remoteUrl: null, errorCode: null, errorMessage: null, verified: null })),
      uploadedAssets: {},
      createdFrames: [],
      reconciliation: { completedCount: 0, skippedCount: 0, failedCount: 0, ambiguousCount: 0, resumable: true },
      rollbackNote: "Dry-run: nenhuma operação de escrita executada.",
    });
  }

  if (!supportsExportOperations(adapter)) {
    throw new MotionError(ERROR_CODES.BRIDGE_ADAPTER_INVALID, `Adapter '${adapter?.editor ?? "none"}' não implementa execução Motion-to-Design.`);
  }

  const prevOpsById = new Map((previousResult?.operations ?? []).map((o) => [o.id, o]));
  const uploadedBySha = new Map(Object.entries(previousResult?.uploadedAssets ?? {}));
  const opMetaById = new Map();
  const opStates = [];
  const createdFrames = [...(previousResult?.createdFrames ?? [])];
  // Adapters sharing an uploadRateLimitScope share one in-process rolling window.
  const uploadRateLimitState = getUploadRateLimitState(adapter);
  const uploadTimestamps = uploadRateLimitState.timestamps;
  const requestedUploadLimit = Number(maxUploadsPerMinute);
  const uploadLimit = Math.min(15, Number.isFinite(requestedUploadLimit) ? Math.max(1, Math.floor(requestedUploadLimit)) : 15);

  const waitWithSignal = async (ms) => {
    if (!signal) return sleep(ms);
    if (signal.aborted) throw Object.assign(new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, "Exportação cancelada via AbortSignal."), { preCommit: true });
    let abortListener;
    try {
      await Promise.race([
        sleep(ms),
        new Promise((_, reject) => {
          abortListener = () => reject(Object.assign(new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, "Exportação cancelada via AbortSignal."), { preCommit: true }));
          signal.addEventListener("abort", abortListener, { once: true });
        }),
      ]);
    } finally {
      if (abortListener) signal.removeEventListener("abort", abortListener);
    }
  };

  const acquireUploadSlot = async () => {
    const waitForActiveUpload = () => new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        uploadRateLimitState.waiters.delete(onChange);
        signal?.removeEventListener("abort", onAbort);
      };
      const onChange = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const onAbort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(Object.assign(new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, "Exportação cancelada via AbortSignal."), { preCommit: true }));
      };
      uploadRateLimitState.waiters.add(onChange);
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();
    });

    while (true) {
      if (signal?.aborted) throw Object.assign(new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, "Exportação cancelada via AbortSignal."), { preCommit: true });
      const t = now();
      while (uploadTimestamps.length && t - uploadTimestamps[0] >= 60_000) uploadTimestamps.shift();
      if (!uploadRateLimitState.active && uploadTimestamps.length < uploadLimit) {
        uploadRateLimitState.active = true;
        uploadTimestamps.push(now());
        let released = false;
        return () => {
          if (released) return;
          released = true;
          uploadRateLimitState.active = false;
          for (const waiter of [...uploadRateLimitState.waiters]) waiter();
        };
      }
      if (uploadRateLimitState.active) await waitForActiveUpload();
      else await waitWithSignal(Math.max(1, 60_000 - (t - uploadTimestamps[0])));
    }
  };

  let aborted = false;

  for (const op of plan.operations) {
    if (signal?.aborted || aborted) {
      opStates.push({
        id: op.id,
        kind: op.kind,
        status: "skipped",
        attempts: 0,
        reversible: op.reversible,
        remoteId: null,
        remoteUrl: null,
        errorCode: ERROR_CODES.BRIDGE_ASSET_FAILED,
        errorMessage: signal?.aborted ? "Exportação cancelada via AbortSignal." : "Ignorada após falha/ambiguidade anterior.",
        verified: null,
      });
      continue;
    }

    // Resume safety: reuse already succeeded (or previously skipped-with-remote) ops; NEVER auto-retry ambiguous ops!
    const prev = prevOpsById.get(op.id);
    if (prev?.status === "succeeded" || (prev?.status === "skipped" && (prev.remoteId || prev.remoteUrl))) {
      opMetaById.set(op.id, { pageId: prev.remoteId, frameId: prev.remoteId, url: prev.remoteUrl, writtenHtmlSha256: prev.writtenHtmlSha256 });
      if (op.source?.sha256 && prev.remoteUrl) uploadedBySha.set(op.source.sha256, prev.remoteUrl);
      opStates.push({ ...prev, status: "skipped" });
      continue;
    }
    if (prev?.status === "ambiguous") {
      aborted = true;
      opStates.push({
        ...prev,
        errorMessage: "Operação anterior teve resultado desconhecido (ambiguous); reconcilie o estado remoto antes de retomar.",
      });
      continue;
    }

    // Deduplicate uploads across sessions or plans if SHA-256 already uploaded
    if (op.kind === "upload_asset" && op.source?.sha256 && uploadedBySha.has(op.source.sha256)) {
      const url = uploadedBySha.get(op.source.sha256);
      opMetaById.set(op.id, { url });
      opStates.push({
        id: op.id,
        kind: op.kind,
        status: "skipped",
        attempts: 0,
        reversible: op.reversible,
        remoteId: null,
        remoteUrl: url,
        errorCode: null,
        errorMessage: null,
        verified: true,
      });
      continue;
    }

    // Verify dependencies succeeded/skipped
    const failedDep = op.dependsOn.find((depId) => {
      const d = opStates.find((x) => x.id === depId);
      return d && (d.status === "failed" || d.status === "ambiguous");
    });
    if (failedDep) {
      opStates.push({
        id: op.id,
        kind: op.kind,
        status: "skipped",
        attempts: 0,
        reversible: op.reversible,
        remoteId: null,
        remoteUrl: null,
        errorCode: ERROR_CODES.BRIDGE_EXPORT_BLOCKED,
        errorMessage: `Dependência '${failedDep}' não concluída.`,
        verified: null,
      });
      continue;
    }

    // Re-read & verify concurrency precondition right before overwriting an existing frame
    if ((op.kind === "set_frame_html" || op.kind === "edit_frame_html") && typeof adapter.inspectRemoteState === "function") {
      const latest = await adapter.inspectRemoteState({ documentId: plan.documentId, frameIds: [op.target.frameId] });
      const curFrame = latest?.frames?.[op.target.frameId];
      if (!curFrame) {
        opStates.push({
          id: op.id,
          kind: op.kind,
          status: "failed",
          attempts: 0,
          reversible: op.reversible,
          remoteId: op.target.frameId,
          remoteUrl: null,
          errorCode: ERROR_CODES.BRIDGE_EXPORT_CONFLICT,
          errorMessage: `Frame destino '${op.target.frameId}' não encontrado na releitura pré-escrita.`,
          verified: false,
        });
        aborted = true;
        continue;
      }
      if (curFrame.approvalStatus === "ready_for_dev" && !plan.authorization.approvedFrameOverride) {
        opStates.push({
          id: op.id,
          kind: op.kind,
          status: "failed",
          attempts: 0,
          reversible: op.reversible,
          remoteId: op.target.frameId,
          remoteUrl: null,
          errorCode: ERROR_CODES.BRIDGE_EXPORT_PROTECTED,
          errorMessage: `Frame '${op.target.frameId}' foi aprovado (ready_for_dev) concorrentemente; sobrescrita bloqueada.`,
          verified: false,
        });
        aborted = true;
        continue;
      }
      const curRev = curFrame.updatedAt ?? curFrame.revision ?? null;
      const curHtmlSha = curFrame.html ? sha256Buf(Buffer.from(curFrame.html, "utf8")) : null;
      if (
        (op.preconditions.expectedRevision !== null && curRev !== op.preconditions.expectedRevision) ||
        (op.preconditions.expectedHtmlSha256 && curHtmlSha !== op.preconditions.expectedHtmlSha256)
      ) {
        opStates.push({
          id: op.id,
          kind: op.kind,
          status: "failed",
          attempts: 0,
          reversible: op.reversible,
          remoteId: op.target.frameId,
          remoteUrl: null,
          errorCode: ERROR_CODES.BRIDGE_EXPORT_CONFLICT,
          errorMessage: `Conflito de revisão concorrente em '${op.target.frameId}' (nota: Doop MCP não fornece CAS atômico; detectado por releitura).`,
          verified: false,
        });
        aborted = true;
        continue;
      }
    }

    const resolvedPayload = resolvePlaceholders(op.payload, opMetaById, uploadedBySha);
    const resolvedTarget = resolvePlaceholders(op.target, opMetaById, uploadedBySha);
    const unresolved = JSON.stringify({ payload: resolvedPayload, target: resolvedTarget }).match(/\{\{(?:uploaded:[a-f0-9]{64}|op:[^}]+)\}\}/);
    if (unresolved) {
      opStates.push({
        id: op.id,
        kind: op.kind,
        status: "failed",
        attempts: 0,
        reversible: op.reversible,
        remoteId: null,
        remoteUrl: null,
        errorCode: ERROR_CODES.BRIDGE_EXPORT_BLOCKED,
        errorMessage: `Referência não resolvida antes da escrita: ${unresolved[0]}`,
        verified: false,
      });
      aborted = true;
      continue;
    }
    const resolvedPreconditions = resolvePlaceholders(op.preconditions, opMetaById, uploadedBySha);
    const execOp = { ...op, target: resolvedTarget, payload: resolvedPayload, preconditions: resolvedPreconditions };

    let attempts = 0;
    let done = false;
    while (!done) {
      attempts++;
      let timeoutHandle;
      let abortListener;
      let releaseUploadSlot = null;
      try {
        if (op.kind === "upload_asset") releaseUploadSlot = await acquireUploadSlot();
        let assetBuffer = null;
        if (op.kind === "upload_asset") {
          assetBuffer = assetBuffers.get(op.source.sha256) ?? null;
          if (!assetBuffer && typeof assetResolver === "function") assetBuffer = await assetResolver(op.source);
          if (!Buffer.isBuffer(assetBuffer) || sha256Buf(assetBuffer) !== op.source.sha256 || assetBuffer.length !== op.source.bytes) {
            throw Object.assign(new MotionError(ERROR_CODES.BRIDGE_EXPORT_BLOCKED, `Asset ${op.source.path} não foi resolvido com hash/tamanho esperados.`), { preCommit: true });
          }
        }
        const pending = [
          adapter.executeExportOperation(execOp, { signal, assetBuffer }),
          new Promise((_, reject) => {
            timeoutHandle = setTimeout(
              () => reject(Object.assign(new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, `Timeout (${timeoutMs} ms) em ${op.id}`), { ambiguousOutcome: true })),
              timeoutMs
            );
          }),
        ];
        if (signal) pending.push(new Promise((_, reject) => {
          abortListener = () => reject(Object.assign(new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, `Cancelamento durante operação ${op.id}; resultado remoto desconhecido.`), { ambiguousOutcome: true }));
          signal.addEventListener("abort", abortListener, { once: true });
        }));
        const res = await Promise.race(pending);

        const remoteId = res?.frameId ?? res?.pageId ?? res?.id ?? resolvedTarget.frameId ?? null;
        const remoteUrl = res?.url ?? res?.image_url ?? null;
        opMetaById.set(op.id, {
          pageId: res?.pageId ?? remoteId,
          frameId: res?.frameId ?? remoteId,
          url: remoteUrl,
          ...(typeof execOp.payload?.html === "string" ? { writtenHtmlSha256: sha256Buf(Buffer.from(execOp.payload.html, "utf8")) } : {}),
        });
        if (op.kind === "upload_asset" && op.source?.sha256 && remoteUrl) {
          uploadedBySha.set(op.source.sha256, remoteUrl);
        }
        if (op.kind === "create_frame" || op.kind === "set_frame_html") {
          createdFrames.push({
            opId: op.id,
            frameId: remoteId,
            pageId: resolvedPayload.pageId ?? null,
            name: resolvedTarget.name ?? resolvedPayload.name ?? remoteId,
            classification: op.source.kind,
          });
        }
        let verified = true;
        if (op.kind === "get_frame_screenshot" && typeof adapter.verifyExportedState === "function") {
          const check = await adapter.verifyExportedState(execOp, res);
          verified = check?.ok === true;
          if (!verified) throw Object.assign(new MotionError(ERROR_CODES.BRIDGE_EXPORT_BLOCKED, `Verificação remota falhou para '${op.id}': ${check?.reason ?? "resultado não confirmado"}`), { preCommit: true });
        }
        opStates.push({
          id: op.id,
          kind: op.kind,
          status: "succeeded",
          attempts,
          reversible: op.reversible,
          remoteId,
          remoteUrl,
          errorCode: null,
          errorMessage: null,
          verified,
          ...(opMetaById.get(op.id)?.writtenHtmlSha256 ? { writtenHtmlSha256: opMetaById.get(op.id).writtenHtmlSha256 } : {}),
        });
        onProgress?.({ opId: op.id, status: "succeeded" });
        done = true;
      } catch (err) {
        if (err?.ambiguousOutcome === true) {
          // Unknown remote side effect: DO NOT retry automatically!
          opStates.push({
            id: op.id,
            kind: op.kind,
            status: "ambiguous",
            attempts,
            reversible: op.reversible,
            remoteId: null,
            remoteUrl: null,
            errorCode: err.code ?? ERROR_CODES.BRIDGE_ASSET_FAILED,
            errorMessage: `${err.message} (desfecho desconhecido; não reexecutado automaticamente).`,
            verified: false,
          });
          aborted = true;
          done = true;
        } else if (isRetryablePreCommitError(err) && attempts <= maxRetries && !signal?.aborted) {
          try {
            await waitWithSignal(backoffBaseMs * attempts);
          } catch (cancelError) {
            opStates.push({ id: op.id, kind: op.kind, status: "failed", attempts, reversible: op.reversible, remoteId: null, remoteUrl: null, errorCode: cancelError.code ?? ERROR_CODES.BRIDGE_ASSET_FAILED, errorMessage: cancelError.message, verified: false });
            aborted = true;
            done = true;
          }
        } else {
          opStates.push({
            id: op.id,
            kind: op.kind,
            status: "failed",
            attempts,
            reversible: op.reversible,
            remoteId: null,
            remoteUrl: null,
            errorCode: err.code ?? ERROR_CODES.BRIDGE_ASSET_FAILED,
            errorMessage: err.message,
            verified: false,
          });
          aborted = true;
          done = true;
        }
      } finally {
        if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
        if (abortListener) signal?.removeEventListener("abort", abortListener);
        releaseUploadSlot?.();
      }
    }
  }

  const completedCount = opStates.filter((o) => o.status === "succeeded").length;
  const skippedCount = opStates.filter((o) => o.status === "skipped").length;
  const failedCount = opStates.filter((o) => o.status === "failed").length;
  const ambiguousCount = opStates.filter((o) => o.status === "ambiguous").length;

  let status = "COMPLETED";
  if (signal?.aborted) status = "CANCELLED";
  else if (failedCount > 0 || ambiguousCount > 0) status = completedCount > 0 ? "PARTIAL" : "FAILED";

  return validateExportResult({
    schemaVersion: SCHEMA_VERSION,
    planId: plan.planId,
    planHash: plan.planHash,
    targetEditor: plan.targetEditor,
    documentId: plan.documentId,
    policy: plan.policy,
    dryRun: false,
    status,
    operations: opStates,
    uploadedAssets: Object.fromEntries([...uploadedBySha.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    createdFrames,
    reconciliation: {
      completedCount,
      skippedCount,
      failedCount,
      ambiguousCount,
      resumable: true,
    },
    rollbackNote: "Ferramentas MCP externas não garantem atomicidade transacional; recursos já criados/enviados não são excluídos automaticamente sem autorização explícita.",
  });
}

/** Convenience orchestrator executing Stages 1 → 5 cleanly. */
export async function exportToEditor(input, options = {}) {
  const inspected = await inspectExportSource(input, options);
  const plan = planExportToEditor(inspected, options);
  validateExportPlanAndPreconditions(plan, options);
  const result = await executeExportPlan(plan, options);
  return { inspected, plan, result };
}
