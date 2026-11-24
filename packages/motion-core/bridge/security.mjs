/**
 * MOTION Core Bridge — security.mjs
 * Zero-trust validation and deterministic sanitization for untrusted editor inputs.
 * Guards against: path traversal, SSRF, arbitrary JS/command injection, unsafe CSS, and prompt injection.
 */
import { createHash } from "node:crypto";
import net from "node:net";
import { ERROR_CODES, MotionError } from "../lib/errors.mjs";

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+|any\s+)?previous\s+instructions/i,
  /disregard\s+(?:all\s+|the\s+)?(?:system|above|prior)\s+(?:prompt|instructions)/i,
  /<\s*\/?\s*(?:system|developer|assistant|tool_call)\s*>/i,
  /\byou\s+are\s+now\s+(?:in\s+)?(?:developer|unrestricted|jailbreak)\s+mode/i,
  /\b(?:execute|run)\s+(?:shell|bash|powershell|cmd)\s+command\b/i,
  /\b(?:exfiltrate|leak|print|dump)\s+(?:env|secrets?|tokens?|credentials?|oauth|api[_\s]?key)\b/i,
];

function isPrivateIpv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true; // unspecified, 10/8, loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 169 && b === 254) return true; // link-local / cloud metadata 169.254/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a >= 224) return true; // multicast/reserved
  return false;
}

function isPrivateIpv6(ip) {
  const lower = ip.toLowerCase().split("%")[0];
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("::ffff:")) {
    const mapped = lower.slice(7);
    if (net.isIPv4(mapped)) return isPrivateIpv4(mapped);
  }
  const firstHextet = parseInt(lower.split(":")[0] || "0", 16);
  if ((firstHextet & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((firstHextet & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if (firstHextet >= 0xff00) return true; // multicast
  return false;
}

function isBlockedHost(hostname, allowLoopback) {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return "empty hostname";
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return allowLoopback && (host === "localhost" || host.endsWith(".localhost")) ? null : `blocked internal hostname: ${host}`;
  }
  const ipVer = net.isIP(host);
  if (ipVer === 4) {
    if (allowLoopback && host.startsWith("127.")) return null;
    if (isPrivateIpv4(host)) return `blocked private/reserved IPv4: ${host}`;
  } else if (ipVer === 6) {
    if (allowLoopback && host === "::1") return null;
    if (isPrivateIpv6(host)) return `blocked private/reserved IPv6: ${host}`;
  }
  return null;
}

/** Validates a relative posix asset/reference path against traversal and escape vectors. */
export function assertSafeRelativePath(relPath) {
  if (typeof relPath !== "string" || !relPath.trim()) {
    throw new MotionError(ERROR_CODES.BRIDGE_PATH_TRAVERSAL, "Caminho relativo vazio ou inválido.");
  }
  const decoded = (() => { try { return decodeURIComponent(relPath); } catch { return relPath; } })();
  if (
    relPath.includes("\\") || decoded.includes("\\") ||
    relPath.includes("\0") || decoded.includes("\0") ||
    relPath.startsWith("/") || decoded.startsWith("/") ||
    /^[a-zA-Z]:/.test(relPath) || /^[a-zA-Z]:/.test(decoded)
  ) {
    throw new MotionError(ERROR_CODES.BRIDGE_PATH_TRAVERSAL, `Caminho absoluto ou inseguro bloqueado: ${relPath}`);
  }
  const parts = decoded.split("/");
  if (parts.some((p) => !p || p === "." || p === "..")) {
    throw new MotionError(ERROR_CODES.BRIDGE_PATH_TRAVERSAL, `Path traversal bloqueado: ${relPath}`);
  }
  return relPath;
}

/** Validates a remote asset URL against SSRF, credential leakage, and unsafe schemes. */
export function assertSafeRemoteUrl(rawUrl, { allowLoopback = false } = {}) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new MotionError(ERROR_CODES.BRIDGE_UNSAFE_URL, "URL vazia ou inválida.");
  }
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new MotionError(ERROR_CODES.BRIDGE_UNSAFE_URL, `URL malformada bloqueada: ${rawUrl}`);
  }
  if (parsed.username || parsed.password) {
    throw new MotionError(ERROR_CODES.BRIDGE_UNSAFE_URL, "URL com credenciais embutidas bloqueada.");
  }
  const protocolOk = parsed.protocol === "https:" || (allowLoopback && parsed.protocol === "http:");
  if (!protocolOk) {
    throw new MotionError(ERROR_CODES.BRIDGE_UNSAFE_URL, `Esquema de URL não permitido (${parsed.protocol}): ${rawUrl}`);
  }
  const hostProblem = isBlockedHost(parsed.hostname, allowLoopback);
  if (hostProblem) {
    throw new MotionError(ERROR_CODES.BRIDGE_UNSAFE_URL, `Possível SSRF bloqueado (${hostProblem}).`);
  }
  return parsed.toString();
}

/** Validates a CSS custom property value (Doop/Motion token boundary). */
export function sanitizeCssValue(value, { allowExternalUrls = false } = {}) {
  if (typeof value !== "string") {
    throw new MotionError(ERROR_CODES.BRIDGE_SCHEMA_INVALID, `Valor de token deve ser string, recebido ${typeof value}.`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 512) {
    throw new MotionError(ERROR_CODES.BRIDGE_SCHEMA_INVALID, "Valor de token vazio ou excede 512 caracteres.");
  }
  if (/[;{}<>\r\n]/.test(trimmed)) {
    throw new MotionError(ERROR_CODES.BRIDGE_SECURITY_VIOLATION, `Caracteres CSS perigosos bloqueados em token: ${trimmed}`);
  }
  if (/expression\s*\(|javascript:|vbscript:|@import|behavior\s*:/i.test(trimmed)) {
    throw new MotionError(ERROR_CODES.BRIDGE_SECURITY_VIOLATION, `Construção CSS insegura bloqueada: ${trimmed}`);
  }
  if (!allowExternalUrls && /url\s*\(/i.test(trimmed)) {
    throw new MotionError(ERROR_CODES.BRIDGE_SECURITY_VIOLATION, `url() externo não permitido dentro de token CSS: ${trimmed}`);
  }
  return trimmed;
}

/** Checks text for suspected prompt injection directives. */
export function detectPromptInjection(text) {
  if (typeof text !== "string" || !text) return [];
  const hits = [];
  for (const rx of PROMPT_INJECTION_PATTERNS) {
    const m = text.match(rx);
    if (m) hits.push(m[0]);
  }
  return hits;
}

/** Wraps imported copy as explicit untrusted data so downstream prompts never execute it as instructions. */
export function wrapUntrustedText(text, label = "imported-frame-copy") {
  const clean = String(text ?? "").replaceAll("```", "` ` `");
  return `[UNTRUSTED_EDITOR_DATA:${label}]\n${clean}\n[/UNTRUSTED_EDITOR_DATA:${label}]`;
}

/**
 * Deterministically scans and sanitizes untrusted HTML from an external editor frame.
 * Strips executable vectors (<script>, <iframe>, <object>, <embed>, <foreignObject>, on*, javascript:)
 * and emits structured securityFindings + compatibilityDiagnostics.
 */
export function scanUntrustedHtml(rawHtml) {
  if (typeof rawHtml !== "string") {
    throw new MotionError(ERROR_CODES.BRIDGE_SCHEMA_INVALID, "HTML do frame deve ser string.");
  }
  let html = rawHtml;
  const securityFindings = [];
  const compatibilityDiagnostics = [];

  const stripBlock = (rx, code, message) => {
    let count = 0;
    html = html.replace(rx, () => { count++; return ""; });
    if (count > 0) {
      securityFindings.push({ severity: "blocked", code, message: `${message} (${count}x)`, detail: null });
    }
  };

  // Detect clock/random/network calls inside scripts before stripping them
  const scriptBodies = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join("\n");
  if (/Math\.random\s*\(|Date\.now\s*\(|new\s+Date\b|performance\.now\s*\(|requestAnimationFrame\s*\(/.test(scriptBodies)) {
    compatibilityDiagnostics.push({
      severity: "warn",
      code: "CLOCK_OR_RANDOM_API_DETECTED",
      message: "Script importado usa relógio/aleatoriedade/rAF incompatível com render de vídeo determinístico.",
      action: "Reescrever movimento sobre window.__onFrame__ e frame.js na Missão M2.",
    });
  }
  if (/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/.test(scriptBodies)) {
    compatibilityDiagnostics.push({
      severity: "warn",
      code: "RUNTIME_NETWORK_CALL_DETECTED",
      message: "Script importado realiza chamadas de rede em runtime.",
      action: "Hidratar dados/assets localmente antes do render.",
    });
  }

  // Strip dangerous executable blocks
  stripBlock(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "SCRIPT_STRIPPED", "Bloco <script> removido de HTML importado");
  stripBlock(/<script\b[^>]*>[\s\S]*$/gi, "SCRIPT_STRIPPED", "Bloco <script> não fechado removido");
  stripBlock(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "IFRAME_STRIPPED", "Elemento <iframe> removido");
  stripBlock(/<(?:object|embed)\b[^>]*>[\s\S]*?<\/(?:object|embed)>/gi, "EMBED_STRIPPED", "Elemento <object>/<embed> removido");
  stripBlock(/<(?:object|embed|iframe)\b[^>]*\/?>/gi, "EMBED_STRIPPED", "Tag <object>/<embed>/<iframe> removida");
  stripBlock(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gi, "FOREIGN_OBJECT_STRIPPED", "Elemento SVG <foreignObject> removido");

  // Strip inline event handlers on*="..." / on*='...' / on*=unquoted
  let handlerCount = 0;
  html = html.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, () => {
    handlerCount++;
    return "";
  });
  if (handlerCount > 0) {
    securityFindings.push({ severity: "blocked", code: "EVENT_HANDLER_STRIPPED", message: `Manipuladores inline on* removidos (${handlerCount}x)`, detail: null });
  }

  // Neutralize javascript:/vbscript:/data:text/html schemes in attributes
  let unsafeSchemeCount = 0;
  html = html.replace(/(\b(?:href|src|action|xlink:href)\s*=\s*["'])\s*(?:javascript|vbscript|data\s*:\s*text\/html):[^"']*(["'])/gi, (_, pre, post) => {
    unsafeSchemeCount++;
    return `${pre}#blocked${post}`;
  });
  if (unsafeSchemeCount > 0) {
    securityFindings.push({ severity: "blocked", code: "UNSAFE_URL_SCHEME_STRIPPED", message: `URLs javascript:/vbscript:/data:html neutralizadas (${unsafeSchemeCount}x)`, detail: null });
  }

  // Detect SMIL animations
  if (/<(?:animate|animateMotion|animateTransform|set)\b/i.test(html)) {
    compatibilityDiagnostics.push({
      severity: "warn",
      code: "SMIL_ANIMATION_DETECTED",
      message: "Animação SVG SMIL detectada; SMIL não é determinístico nem permitido em SVGs sanitizados do Motion.",
      action: "Converter para svg-motion.js (data-motion-path / data-layer) na Missão M2.",
    });
  }

  // Detect CSS @keyframes and CSS @import
  if (/@keyframes\b/i.test(html)) {
    compatibilityDiagnostics.push({
      severity: "warn",
      code: "CSS_KEYFRAMES_DETECTED",
      message: "Regra @keyframes detectada; CSS animations dependem do relógio e falham em verifyDeterminism.",
      action: "Converter estados temporais para frame.js / svg-motion.js na Missão M2.",
    });
  }
  if (/@import\b/i.test(html)) {
    securityFindings.push({ severity: "warn", code: "CSS_IMPORT_DETECTED", message: "Diretiva @import detectada em CSS importado.", detail: null });
  }

  // Detect base64 data URIs
  const base64Matches = html.match(/data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[a-z0-9+/=]{32,}/gi) ?? [];
  if (base64Matches.length > 0) {
    compatibilityDiagnostics.push({
      severity: "warn",
      code: "BASE64_DATA_URI_FLAGGED",
      message: `${base64Matches.length} URI(s) base64 detectada(s); Doop recusa base64 e Motion requer assets em disco.`,
      action: "Extrair para arquivo local em assets/ ou enviar via upload_asset.",
    });
  }

  // Scan HTML comments & text attributes for prompt injection
  const comments = [...html.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1]);
  const injectionHits = [];
  for (const c of comments) injectionHits.push(...detectPromptInjection(c));
  const attrTexts = [...html.matchAll(/\b(?:aria-label|alt|title)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map((m) => m[1] ?? m[2] ?? "");
  for (const t of attrTexts) injectionHits.push(...detectPromptInjection(t));
  if (injectionHits.length > 0) {
    securityFindings.push({
      severity: "blocked",
      code: "PROMPT_INJECTION_DETECTED",
      message: "Possível prompt injection detectado em comentários ou atributos importados.",
      detail: [...new Set(injectionHits)].slice(0, 5).join(" | "),
    });
    // Strip HTML comments containing suspected injection directives
    html = html.replace(/<!--([\s\S]*?)-->/g, (full, inner) => (detectPromptInjection(inner).length ? "" : full));
  }

  return { sanitizedHtml: html, securityFindings, compatibilityDiagnostics };
}

/** Deterministic recursive canonical JSON serialization (sorted object keys). */
export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}

export function sha256Json(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
