/**
 * MOTION Core Bridge — security.mjs
 * Zero-trust validation and structured deterministic sanitization for untrusted editor inputs.
 * Guards against: path/symlink traversal, SSRF, DNS rebinding, arbitrary JS/command injection,
 * obfuscated HTML/CSS/SVG URLs, and prompt injection.
 */
import { createHash } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { generate as generateCss, parse as parseCss, walk as walkCss } from "css-tree";
import { ERROR_CODES, MotionError } from "../lib/errors.mjs";
import { validateSvg } from "../svg/svg-tools.mjs";

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+|any\s+)?previous\s+instructions/i,
  /disregard\s+(?:all\s+|the\s+)?(?:system|above|prior)\s+(?:prompt|instructions)/i,
  /<\s*\/?\s*(?:system|developer|assistant|tool_call)\s*>/i,
  /\byou\s+are\s+now\s+(?:in\s+)?(?:developer|unrestricted|jailbreak)\s+mode/i,
  /\b(?:execute|run)\s+(?:shell|bash|powershell|cmd)\s+command\b/i,
  /\b(?:exfiltrate|leak|print|dump)\s+(?:env|secrets?|tokens?|credentials?|oauth|api[_\s]?key)\b/i,
];

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  colon: ":",
  tab: "\t",
  newline: "\n",
  sol: "/",
  nbsp: " ",
};

/** Decodes HTML numeric (decimal/hex) and common named entities to defeat scheme/attribute obfuscation. */
export function decodeHtmlEntities(input) {
  return String(input ?? "").replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z0-9]+);?/gi, (full, body) => {
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X";
      const cp = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? full;
  });
}

function decodeCssEscapes(value) {
  return String(value ?? "").replace(/\\([0-9a-f]{1,6})\s?|\\([^\n\r\f0-9a-f])/gi, (_, hex, ch) => {
    if (hex) {
      const cp = Number.parseInt(hex, 16);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
    }
    return ch ?? "";
  });
}

function normalizeControlAndSpace(value) {
  return decodeHtmlEntities(decodeCssEscapes(value)).replace(/[\u0000-\u001f\u007f]/g, "").trim();
}

function isPrivateIpv4(ip) {
  const parts = String(ip).split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127) return true; // unspecified, 10/8, loopback 127/8
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 169 && b === 254) return true; // link-local / cloud metadata 169.254/16
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918 172.16/12
  if (a === 192 && b === 0 && c === 0) return true; // IETF protocol assignments 192.0.0/24
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1 192.0.2/24
  if (a === 192 && b === 168) return true; // RFC1918 192.168/16
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark 198.18/15
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2 198.51.100/24
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3 203.0.113/24
  if (a >= 224) return true; // multicast, reserved, broadcast 224/4..255.255.255.255
  return false;
}

function parseIpv6Hextets(ip) {
  const noZone = String(ip).toLowerCase().split("%")[0];
  const halves = noZone.split("::");
  if (halves.length > 2) return null;
  const parseSide = (side) => {
    if (!side) return [];
    const parts = side.split(":");
    const out = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1 && part.includes(".") && net.isIPv4(part)) {
        const octets = part.split(".").map(Number);
        out.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
      } else {
        if (!/^[0-9a-f]{1,4}$/i.test(part)) return null;
        const val = parseInt(part, 16);
        if (Number.isNaN(val) || val < 0 || val > 0xffff) return null;
        out.push(val);
      }
    }
    return out;
  };
  const left = parseSide(halves[0]);
  if (!left) return null;
  if (halves.length === 1) return left.length === 8 ? left : null;
  const right = parseSide(halves[1]);
  if (!right) return null;
  const missing = 8 - (left.length + right.length);
  if (missing < 1) return null;
  return [...left, ...Array(missing).fill(0), ...right];
}

function hextetsToIpv4(hi, lo) {
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

function isPrivateIpv6(ip) {
  const h = parseIpv6Hextets(ip);
  if (!h) return true;
  const allZeroPrefix = h.slice(0, 5).every((x) => x === 0);
  // :: (unspecified) or ::1 (loopback)
  if (allZeroPrefix && h[5] === 0 && h[6] === 0 && (h[7] === 0 || h[7] === 1)) return true;
  // IPv4-mapped (::ffff:w.x.y.z) or IPv4-compatible (::w.x.y.z)
  if (allZeroPrefix && (h[5] === 0xffff || h[5] === 0)) {
    return isPrivateIpv4(hextetsToIpv4(h[6], h[7]));
  }
  // NAT64 well-known 64:ff9b::/96 and local-use 64:ff9b:1::/48
  if (h[0] === 0x0064 && h[1] === 0xff9b && h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0) {
    return isPrivateIpv4(hextetsToIpv4(h[6], h[7]));
  }
  if (h[0] === 0x0064 && h[1] === 0xff9b && h[2] === 0x0001) return true;
  // 6to4 2002::/16 — check embedded IPv4 in h[1], h[2]
  if (h[0] === 0x2002) {
    return isPrivateIpv4(hextetsToIpv4(h[1], h[2]));
  }
  // Teredo 2001:0000::/32 & ORCHIDv2/documentation 2001:db8::/32
  if (h[0] === 0x2001 && (h[1] === 0x0000 || h[1] === 0x0db8)) return true;
  if (h[0] === 0x0100 && h[1] === 0 && h[2] === 0 && h[3] === 0) return true; // 100::/64 discard
  if ((h[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((h[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((h[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 deprecated site-local
  if (h[0] >= 0xff00) return true; // ff00::/8 multicast
  return false;
}

/** Checks whether a resolved IPv4 or IPv6 address belongs to a private, loopback, or reserved range. */
export function isPrivateOrReservedIp(ip, { allowLoopback = false } = {}) {
  const clean = String(ip ?? "").trim().replace(/^\[|\]$/g, "").split("%")[0];
  const ver = net.isIP(clean);
  if (ver === 4) {
    if (allowLoopback && /^127\./.test(clean) && !isPrivateIpv4(clean.replace(/^127\./, "8."))) {
      return false;
    }
    return isPrivateIpv4(clean);
  }
  if (ver === 6) {
    if (allowLoopback) {
      const h = parseIpv6Hextets(clean);
      if (h && h.slice(0, 7).every((x) => x === 0) && h[7] === 1) return false;
      if (h && h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff && (h[6] >> 8) === 127) return false;
    }
    return isPrivateIpv6(clean);
  }
  return true;
}

/** Rejects non-canonical integer, hex, octal, or shorthand IPv4 strings before/after URL parsing. */
function isSuspiciousAlternativeIpv4Host(rawHost) {
  const clean = String(rawHost ?? "").trim().replace(/\.$/, "");
  if (!clean || net.isIP(clean)) return false;
  if (/^\d+$/.test(clean) || /^0x[0-9a-f]+$/i.test(clean)) return true;
  if (/^0[0-7]+\./.test(clean) || /\.0[0-7]+/.test(clean) || /^0x[0-9a-f]+\./i.test(clean)) return true;
  if (/^\d+(?:\.\d+){1,2}$/.test(clean)) return true;
  return false;
}

function extractRawHostname(rawUrl) {
  const m = String(rawUrl).trim().match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/?#]+)/);
  if (!m) return "";
  const authority = m[1].includes("@") ? m[1].split("@").pop() : m[1];
  if (authority.startsWith("[")) {
    const end = authority.indexOf("]");
    return end >= 0 ? authority.slice(0, end + 1) : authority;
  }
  return authority.split(":")[0];
}

function isBlockedHost(hostname, allowLoopback) {
  const raw = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  const host = raw.replace(/\.+$/, "");
  if (!host) return "empty hostname";
  if (host.includes("%")) return `zone identifier in hostname: ${host}`;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".arpa")) {
    return allowLoopback && (host === "localhost" || host.endsWith(".localhost")) ? null : `blocked internal hostname: ${host}`;
  }
  if (isSuspiciousAlternativeIpv4Host(host)) {
    return `blocked alternative IPv4 host notation: ${host}`;
  }
  const ipVer = net.isIP(host);
  if (ipVer === 4 || ipVer === 6) {
    if (isPrivateOrReservedIp(host, { allowLoopback })) {
      return `blocked private/reserved IPv${ipVer}: ${host}`;
    }
  }
  return null;
}

/** Validates resolved DNS records (all A and AAAA addresses) against private/reserved networks. */
export function assertSafeHostResolution(hostname, addresses, { allowLoopback = false } = {}) {
  const hostProblem = isBlockedHost(hostname, allowLoopback);
  if (hostProblem) {
    throw new MotionError(ERROR_CODES.BRIDGE_UNSAFE_URL, `Possível SSRF bloqueado (${hostProblem}).`);
  }
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new MotionError(ERROR_CODES.BRIDGE_UNSAFE_URL, `Resolução DNS sem endereços públicos válidos para ${hostname}.`);
  }
  const valid = [];
  for (const entry of addresses) {
    const address = typeof entry === "string" ? entry : entry?.address;
    const family = typeof entry === "object" && entry?.family ? entry.family : net.isIP(address);
    if (!address || (family !== 4 && family !== 6)) continue;
    if (isPrivateOrReservedIp(address, { allowLoopback })) {
      throw new MotionError(
        ERROR_CODES.BRIDGE_UNSAFE_URL,
        `DNS rebinding ou IP privado bloqueado na resolução de ${hostname}: ${address}`,
        { details: { hostname, address, family } }
      );
    }
    valid.push({ address, family });
  }
  if (valid.length === 0) {
    throw new MotionError(ERROR_CODES.BRIDGE_UNSAFE_URL, `Nenhum endereço IP público válido resolvido para ${hostname}.`);
  }
  return valid;
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

/**
 * Resolves a project-relative path and guarantees neither intermediate segments nor final file
 * escape rootDir via symlinks or traversal (node parity with exporters/delivery.py safe_source_path).
 */
export async function assertSafeProjectPath(rootDir, relPath) {
  const cleanRel = assertSafeRelativePath(relPath);
  const rootAbs = path.resolve(rootDir);
  const rootReal = await realpath(rootAbs).catch(() => rootAbs);
  let cur = rootAbs;
  for (const part of cleanRel.split("/")) {
    cur = path.join(cur, part);
    try {
      const st = await lstat(cur);
      if (st.isSymbolicLink()) {
        throw new MotionError(ERROR_CODES.BRIDGE_PATH_TRAVERSAL, `Symlink traversal bloqueado: ${cleanRel}`);
      }
    } catch (err) {
      if (err instanceof MotionError) throw err;
      if (err?.code !== "ENOENT") {
        throw new MotionError(ERROR_CODES.BRIDGE_PATH_TRAVERSAL, `Caminho inacessível ou inseguro: ${cleanRel}`, { cause: err });
      }
    }
  }
  const relCheck = path.relative(rootAbs, cur);
  if (!relCheck || relCheck.startsWith("..") || path.isAbsolute(relCheck)) {
    throw new MotionError(ERROR_CODES.BRIDGE_PATH_TRAVERSAL, `Escape do diretório do projeto bloqueado: ${cleanRel}`);
  }
  try {
    const targetReal = await realpath(cur);
    const realRel = path.relative(rootReal, targetReal);
    if (!realRel || realRel.startsWith("..") || path.isAbsolute(realRel)) {
      throw new MotionError(ERROR_CODES.BRIDGE_PATH_TRAVERSAL, `Destino real fora do diretório do projeto: ${cleanRel}`);
    }
  } catch (err) {
    if (err instanceof MotionError) throw err;
  }
  return cur;
}

/** Validates a remote asset URL against SSRF, credential leakage, alternative IPs, and unsafe schemes. */
export function assertSafeRemoteUrl(rawUrl, { allowLoopback = false } = {}) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new MotionError(ERROR_CODES.BRIDGE_UNSAFE_URL, "URL vazia ou inválida.");
  }
  const trimmed = normalizeControlAndSpace(rawUrl);
  if (/[\r\n\t\0]/.test(rawUrl)) {
    throw new MotionError(ERROR_CODES.BRIDGE_UNSAFE_URL, `URL contém caracteres de controle bloqueados: ${rawUrl}`);
  }
  const rawHost = extractRawHostname(trimmed);
  if (rawHost.includes("%") || isSuspiciousAlternativeIpv4Host(rawHost)) {
    throw new MotionError(ERROR_CODES.BRIDGE_UNSAFE_URL, `Formato alternativo/ofuscado de host bloqueado: ${rawHost}`);
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
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

function classifyCssOrHtmlUrl(rawCandidate, { allowLoopback = false } = {}) {
  const decoded = normalizeControlAndSpace(rawCandidate);
  if (!decoded) return { kind: "empty", safe: false, reason: "URL vazia" };
  if (decoded.startsWith("#")) return { kind: "fragment", safe: true, url: decoded };
  if (/^\{\{uploaded:[a-f0-9]{64}\}\}$/.test(decoded)) return { kind: "hydrated-asset", safe: true, url: decoded };
  if (/^(?:javascript|vbscript):/i.test(decoded)) {
    return { kind: "unsafe-scheme", safe: false, reason: `Esquema script bloqueado: ${decoded.slice(0, 32)}` };
  }
  if (/^data:/i.test(decoded)) {
    if (/^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=\s]+$/i.test(decoded)) {
      return { kind: "data-image", safe: true, url: decoded };
    }
    return { kind: "unsafe-data", safe: false, reason: `Data URI não permitida: ${decoded.slice(0, 48)}` };
  }
  if (/^(?:file|ftp|gopher|ws|wss):/i.test(decoded)) {
    return { kind: "unsafe-scheme", safe: false, reason: `Esquema não permitido: ${decoded.slice(0, 32)}` };
  }
  if (decoded.startsWith("//")) {
    return classifyCssOrHtmlUrl(`https:${decoded}`, { allowLoopback });
  }
  if (/^https?:/i.test(decoded)) {
    try {
      const safeUrl = assertSafeRemoteUrl(decoded, { allowLoopback });
      return { kind: "remote", safe: true, url: safeUrl };
    } catch (err) {
      return { kind: "blocked-remote", safe: false, reason: err.message, url: decoded };
    }
  }
  // Relative or root-relative paths are unsafe local references inside untrusted editor input unless rewritten
  if (decoded.startsWith("/") || decoded.includes("..") || decoded.includes("\\") || /^[a-zA-Z]:/.test(decoded)) {
    return { kind: "local-escape", safe: false, reason: `Referência local não permitida: ${decoded}` };
  }
  return { kind: "relative-local", safe: false, reason: `Referência relativa local sem hidratação explícita: ${decoded}` };
}

/** Validates a CSS custom property value (Doop/Motion token boundary) using structured css-tree AST parsing. */
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
  let parseFailed = false;
  let ast;
  try {
    ast = parseCss(trimmed, { context: "value", onParseError: () => { parseFailed = true; } });
  } catch {
    parseFailed = true;
  }
  if (parseFailed || !ast) {
    throw new MotionError(ERROR_CODES.BRIDGE_SECURITY_VIOLATION, `Valor CSS malformado bloqueado em token: ${trimmed}`);
  }
  let violation = null;
  walkCss(ast, (node) => {
    if (violation) return;
    if (node.type === "Function" && /^(?:expression|-moz-binding|progid)$/i.test(decodeCssEscapes(node.name))) {
      violation = `Função CSS insegura bloqueada (${node.name})`;
    }
    if (node.type === "Raw" && /url\s*\(|expression\s*\(|@import|javascript:|vbscript:/i.test(decodeCssEscapes(node.value))) {
      violation = `Valor CSS ofuscado bloqueado em token: ${trimmed}`;
    }
    if (node.type === "Url") {
      if (!allowExternalUrls) violation = `url() externo não permitido dentro de token CSS: ${trimmed}`;
      else if (/^(?:javascript|vbscript|data\s*:\s*text\/html|file):/i.test(normalizeControlAndSpace(node.value))) {
        violation = `url() inseguro dentro de token CSS`;
      }
    }
  });
  if (violation) {
    throw new MotionError(ERROR_CODES.BRIDGE_SECURITY_VIOLATION, violation);
  }
  const decodedRaw = decodeCssEscapes(trimmed);
  if (/expression\s*\(|javascript:|vbscript:|@import|behavior\s*:/i.test(decodedRaw)) {
    throw new MotionError(ERROR_CODES.BRIDGE_SECURITY_VIOLATION, `Construção CSS insegura bloqueada: ${trimmed}`);
  }
  if (!allowExternalUrls && /url\s*\(/i.test(decodedRaw)) {
    throw new MotionError(ERROR_CODES.BRIDGE_SECURITY_VIOLATION, `url() externo não permitido dentro de token CSS: ${trimmed}`);
  }
  return trimmed;
}

/**
 * Structured css-tree AST analyzer and sanitizer for untrusted CSS stylesheets or inline style lists.
 * Strips @import, expression(), behavior/-moz-binding, unsafe url(), and optionally animations/transitions.
 */
export function inspectAndSanitizeCss(
  cssText,
  { context = "stylesheet", allowLoopback = false, stripAnimations = false, rewriteUrl = null, sourceLabel = "style" } = {}
) {
  const securityFindings = [];
  const compatibilityDiagnostics = [];
  const extractedUrls = [];
  const keyframes = [];
  const fontFaces = [];
  const animations = [];
  const transitions = [];

  let ast;
  let parseErrors = 0;
  try {
    ast = parseCss(String(cssText ?? ""), {
      context,
      parseAtrulePrelude: true,
      parseRulePrelude: true,
      parseValue: true,
      onParseError: () => { parseErrors++; },
    });
  } catch (err) {
    securityFindings.push({
      severity: "blocked",
      code: "CSS_PARSE_FAILED",
      message: `Bloco CSS (${sourceLabel}) malformado bloqueado por segurança.`,
      detail: err.message,
    });
    return {
      css: "",
      securityFindings,
      compatibilityDiagnostics,
      extractedUrls,
      keyframes,
      fontFaces,
      animations,
      transitions,
    };
  }

  if (parseErrors > 0) {
    compatibilityDiagnostics.push({
      severity: "warn",
      code: "CSS_PARSE_RECOVERED",
      message: `CSS (${sourceLabel}) apresentou ${parseErrors} erro(s) sintático(s) durante parsing estruturado.`,
      action: "Regras inválidas descartadas pela AST.",
    });
  }

  const processDeclarationBlock = (blockNode, inFontFace = false) => {
    if (!blockNode?.children) return;
    const decls = blockNode.children;
    decls.forEach((decl, item) => {
      if (decl.type !== "Declaration") return;
      const prop = decodeCssEscapes(decl.property).toLowerCase();
      if (prop === "behavior" || prop === "-moz-binding") {
        securityFindings.push({
          severity: "blocked",
          code: "UNSAFE_CSS_PROPERTY_STRIPPED",
          message: `Propriedade CSS insegura '${prop}' removida.`,
          detail: sourceLabel,
        });
        decls.remove(item);
        return;
      }

      let removedUnsafeExpr = false;
      walkCss(decl.value, (node) => {
        if (removedUnsafeExpr) return;
        if (node.type === "Raw") {
          const decodedRawVal = decodeCssEscapes(node.value);
          const urlMatch = decodedRawVal.match(/url\s*\(\s*(?:["']([^"']*)["']|([^)\s]+))\s*\)/i);
          if (/expression\s*\(|-moz-binding|javascript:|vbscript:/i.test(decodedRawVal)) {
            securityFindings.push({
              severity: "blocked",
              code: "CSS_EXPRESSION_STRIPPED",
              message: "Declaração CSS ofuscada/insegura removida.",
              detail: sourceLabel,
            });
            decls.remove(item);
            removedUnsafeExpr = true;
            return;
          }
          if (urlMatch) {
            const target = urlMatch[1] ?? urlMatch[2] ?? "";
            const check = classifyCssOrHtmlUrl(target, { allowLoopback });
            if (!check.safe) {
              securityFindings.push({
                severity: "blocked",
                code: "UNSAFE_CSS_URL_STRIPPED",
                message: `url() insegura removida de CSS (${prop})`,
                detail: `${target} (${check.reason})`,
              });
              decls.remove(item);
              removedUnsafeExpr = true;
              return;
            }
            if (check.kind === "remote") {
              extractedUrls.push({ url: check.url, ctx: inFontFace || prop === "src" ? "font" : "css", safe: true, blockedReason: null });
              const rewritten = typeof rewriteUrl === "function" ? rewriteUrl(check.url, inFontFace ? "font" : "css") : null;
              node.value = `url("${rewritten || check.url}")`;
            }
            return;
          }
        }
        if (node.type === "Function" && /^(?:expression|-moz-binding)$/i.test(decodeCssEscapes(node.name))) {
          securityFindings.push({
            severity: "blocked",
            code: "CSS_EXPRESSION_STRIPPED",
            message: `Função CSS executável '${decodeCssEscapes(node.name)}()' removida.`,
            detail: sourceLabel,
          });
          decls.remove(item);
          removedUnsafeExpr = true;
          return;
        }
        if (node.type === "String") {
          const decodedStr = decodeCssEscapes(node.value).trim();
          if (/^(?:https?:|\/\/|file:|javascript:|vbscript:|data:text\/html)/i.test(decodedStr)) {
            const check = classifyCssOrHtmlUrl(decodedStr, { allowLoopback });
            if (!check.safe) {
              securityFindings.push({
                severity: "blocked",
                code: "UNSAFE_CSS_URL_STRIPPED",
                message: `URL em função CSS removida (${prop})`,
                detail: `${decodedStr} (${check.reason})`,
              });
              decls.remove(item);
              removedUnsafeExpr = true;
              return;
            }
            if (check.kind === "remote") {
              extractedUrls.push({ url: check.url, ctx: inFontFace || prop === "src" ? "font" : "css", safe: true, blockedReason: null });
              const rewritten = typeof rewriteUrl === "function" ? rewriteUrl(check.url, inFontFace ? "font" : "css") : null;
              if (rewritten) node.value = rewritten;
            }
          }
        }
        if (node.type === "Url") {
          const check = classifyCssOrHtmlUrl(node.value, { allowLoopback });
          if (!check.safe) {
            securityFindings.push({
              severity: "blocked",
              code: "UNSAFE_CSS_URL_STRIPPED",
              message: `url() insegura removida de CSS (${prop})`,
              detail: `${node.value} (${check.reason})`,
            });
            node.value = "about:invalid";
            decls.remove(item);
            removedUnsafeExpr = true;
            return;
          }
          if (check.kind === "remote") {
            extractedUrls.push({
              url: check.url,
              ctx: inFontFace || prop === "src" ? "font" : "css",
              safe: true,
              blockedReason: null,
            });
            if (typeof rewriteUrl === "function") {
              const replacement = rewriteUrl(check.url, inFontFace ? "font" : "css");
              if (replacement) node.value = replacement;
            }
          } else if (check.kind === "data-image") {
            compatibilityDiagnostics.push({
              severity: "warn",
              code: "BASE64_DATA_URI_FLAGGED",
              message: "URI data:image detectada em CSS; para portabilidade recomenda-se extração local.",
              action: "Converter para arquivo em assets/.",
            });
          }
        }
      });
      if (removedUnsafeExpr) return;

      if (prop === "animation" || prop === "animation-name") {
        animations.push({ property: prop, value: generateCss(decl.value) });
        if (stripAnimations) decls.remove(item);
      } else if (prop === "transition" || prop === "transition-property") {
        transitions.push({ property: prop, value: generateCss(decl.value) });
        if (stripAnimations) decls.remove(item);
      }
    });
  };

  if (context === "declarationList") {
    processDeclarationBlock(ast, false);
  } else if (ast.children) {
    ast.children.forEach((node, item) => {
      if (node.type === "Atrule") {
        const name = decodeCssEscapes(node.name).toLowerCase();
        if (name === "import") {
          securityFindings.push({
            severity: "blocked",
            code: "CSS_IMPORT_STRIPPED",
            message: "Diretiva CSS @import removida por segurança e determinismo offline.",
            detail: generateCss(node),
          });
          ast.children.remove(item);
          return;
        }
        if (name === "keyframes" || name === "-webkit-keyframes") {
          const kfName = node.prelude ? generateCss(node.prelude).trim() : "anonymous";
          const stops = [];
          if (node.block?.children) {
            node.block.children.forEach((kfRule) => {
              if (kfRule.type === "Rule") {
                stops.push({
                  selector: kfRule.prelude ? generateCss(kfRule.prelude).trim() : "0%",
                  declarations: kfRule.block ? generateCss(kfRule.block) : "{}",
                });
              }
            });
          }
          keyframes.push({ name: kfName, stops });
          compatibilityDiagnostics.push({
            severity: "warn",
            code: "CSS_KEYFRAMES_DETECTED",
            message: `Regra @keyframes '${kfName}' detectada; CSS animations dependem do relógio e falham em verifyDeterminism.`,
            action: "Converter estados temporais para frame.js / svg-motion.js.",
          });
          if (stripAnimations) ast.children.remove(item);
          return;
        }
        if (name === "font-face") {
          processDeclarationBlock(node.block, true);
          let family = null;
          const srcs = [];
          if (node.block?.children) {
            node.block.children.forEach((d) => {
              if (d.type !== "Declaration") return;
              if (d.property.toLowerCase() === "font-family") family = generateCss(d.value).replace(/^["']|["']$/g, "").trim();
              if (d.property.toLowerCase() === "src") {
                walkCss(d.value, (n) => {
                  if (n.type === "Url") srcs.push(n.value);
                });
              }
            });
          }
          fontFaces.push({ family, srcs });
          return;
        }
        if (node.block?.children) {
          node.block.children.forEach((child) => {
            if (child.type === "Rule") processDeclarationBlock(child.block, false);
          });
        }
      } else if (node.type === "Rule") {
        processDeclarationBlock(node.block, false);
      }
    });
  }

  return {
    css: generateCss(ast),
    securityFindings,
    compatibilityDiagnostics,
    extractedUrls,
    keyframes,
    fontFaces,
    animations,
    transitions,
  };
}

/** Parses HTML `srcset` / `imagesrcset` candidate strings into [{ url, descriptor }]. */
export function parseSrcset(value) {
  const candidates = [];
  const raw = String(value ?? "").trim();
  if (!raw) return candidates;
  // Split on commas followed by whitespace and another candidate URL (handles URLs without breaking data URIs cleanly)
  for (const part of raw.split(/,(?=\s*(?:https?:|\/\/|\/|\.\.?\/|data:|#|[a-z0-9_.-]+))/i)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const spaceIdx = trimmed.search(/\s/);
    if (spaceIdx === -1) candidates.push({ url: trimmed, descriptor: "" });
    else candidates.push({ url: trimmed.slice(0, spaceIdx), descriptor: trimmed.slice(spaceIdx + 1).trim() });
  }
  return candidates;
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

function parseTagAttributes(attrSource) {
  const attrs = [];
  let i = 0;
  const len = attrSource.length;
  while (i < len) {
    while (i < len && /[\s/]/.test(attrSource[i])) i++;
    if (i >= len) break;
    const nameStart = i;
    while (i < len && !/[\s=/>]/.test(attrSource[i])) i++;
    const name = attrSource.slice(nameStart, i);
    if (!name) { i++; continue; }
    while (i < len && /\s/.test(attrSource[i])) i++;
    let value = null;
    let quote = "";
    if (i < len && attrSource[i] === "=") {
      i++;
      while (i < len && /\s/.test(attrSource[i])) i++;
      if (i < len && (attrSource[i] === '"' || attrSource[i] === "'")) {
        quote = attrSource[i++];
        const valStart = i;
        while (i < len && attrSource[i] !== quote) i++;
        value = attrSource.slice(valStart, i);
        if (i < len && attrSource[i] === quote) i++;
      } else {
        const valStart = i;
        while (i < len && !/[\s>]/.test(attrSource[i])) i++;
        value = attrSource.slice(valStart, i);
      }
    }
    attrs.push({ name, value, quote });
  }
  return attrs;
}

function escapeAttrValue(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function serializeTag(tagName, attrs, selfClosing = false) {
  const parts = [`<${tagName}`];
  for (const a of attrs) {
    if (a.value === null || a.value === undefined) parts.push(` ${a.name}`);
    else parts.push(` ${a.name}="${escapeAttrValue(a.value)}"`);
  }
  parts.push(selfClosing ? " />" : ">");
  return parts.join("");
}

/** Deterministic state-machine HTML tokenizer preserving comments, doctypes, rawtext (<script>/<style>), and tags. */
export function tokenizeHtml(rawHtml) {
  const html = String(rawHtml ?? "");
  const tokens = [];
  let i = 0;
  const len = html.length;
  const RAWTEXT = new Set(["script", "style", "textarea", "title"]);

  while (i < len) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      tokens.push({ type: "text", text: html.slice(i) });
      break;
    }
    if (lt > i) {
      tokens.push({ type: "text", text: html.slice(i, lt) });
      i = lt;
    }
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      const closeIdx = end === -1 ? len : end + 3;
      const raw = html.slice(i, closeIdx);
      const body = end === -1 ? html.slice(i + 4) : html.slice(i + 4, end);
      tokens.push({ type: "comment", raw, body });
      i = closeIdx;
      continue;
    }
    if (/^<!doctype\b/i.test(html.slice(i, i + 12))) {
      const end = html.indexOf(">", i + 2);
      const closeIdx = end === -1 ? len : end + 1;
      tokens.push({ type: "doctype", raw: html.slice(i, closeIdx) });
      i = closeIdx;
      continue;
    }
    if (html.startsWith("</", i)) {
      const m = html.slice(i).match(/^<\/([a-zA-Z][a-zA-Z0-9:-]*)\s*>/);
      if (m) {
        tokens.push({ type: "endTag", tagName: m[1].toLowerCase(), rawName: m[1], raw: m[0] });
        i += m[0].length;
        continue;
      }
      tokens.push({ type: "text", text: "<" });
      i++;
      continue;
    }
    const startMatch = html.slice(i).match(/^<([a-zA-Z][a-zA-Z0-9:-]*)(?=[\s/>]|$)/);
    if (!startMatch) {
      tokens.push({ type: "text", text: "<" });
      i++;
      continue;
    }
    const rawTag = startMatch[1];
    const tagName = rawTag.toLowerCase();
    let j = i + startMatch[0].length;
    let inQuote = "";
    while (j < len) {
      const ch = html[j];
      if (inQuote) {
        if (ch === inQuote) inQuote = "";
      } else {
        if (ch === '"' || ch === "'") inQuote = ch;
        else if (ch === ">") break;
      }
      j++;
    }
    const closed = j < len && html[j] === ">";
    const attrSlice = html.slice(i + startMatch[0].length, j);
    const selfClosing = /\/\s*$/.test(attrSlice);
    const attrs = parseTagAttributes(attrSlice.replace(/\/\s*$/, ""));
    const raw = html.slice(i, closed ? j + 1 : len);
    tokens.push({ type: "startTag", tagName, rawName: rawTag, attrs, selfClosing, raw });
    i = closed ? j + 1 : len;

    if (!selfClosing && RAWTEXT.has(tagName) && i < len) {
      const closeRx = new RegExp(`</${rawTag}\\s*>`, "i");
      const rest = html.slice(i);
      const cm = closeRx.exec(rest);
      if (cm) {
        tokens.push({ type: "text", text: rest.slice(0, cm.index), rawtextFor: tagName });
        tokens.push({ type: "endTag", tagName, rawName: rawTag, raw: cm[0] });
        i += cm.index + cm[0].length;
      } else {
        tokens.push({ type: "text", text: rest, rawtextFor: tagName });
        i = len;
      }
    }
  }
  return tokens;
}

export function serializeHtmlTokens(tokens) {
  return tokens
    .map((tok) => {
      if (tok.type === "text") return tok.text;
      if (tok.type === "comment") return tok.raw;
      if (tok.type === "doctype") return tok.raw;
      if (tok.type === "endTag") return `</${tok.rawName ?? tok.tagName}>`;
      if (tok.type === "startTag") return serializeTag(tok.rawName ?? tok.tagName, tok.attrs, tok.selfClosing);
      return "";
    })
    .join("");
}

const STRIP_WHOLE_SUBTREE_TAGS = new Set(["script", "iframe", "object", "embed", "applet", "portal", "frame", "frameset", "foreignobject", "handler", "listener"]);
const STRIP_SINGLE_TAGS = new Set(["base"]);
const URL_ATTR_NAMES = new Set(["href", "xlink:href", "src", "poster", "data", "action", "formaction", "background", "cite"]);
const BLOCKED_IMAGE_PLACEHOLDER_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90"><rect width="160" height="90" fill="#1f2937"/><rect x="1" y="1" width="158" height="88" fill="none" stroke="#ef4444" stroke-dasharray="4 3"/><text x="80" y="49" text-anchor="middle" fill="#fca5a5" font-family="sans-serif" font-size="11">Blocked URL</text></svg>'
  );

/**
 * Deterministically parses and sanitizes untrusted HTML, CSS, and SVG from an external editor frame.
 * Eliminates executable vectors, strips CSS @import / unsafe url() (via css-tree), runs SVG sanitization
 * (via svgo/assertSafeSvg), neutralizes obfuscated/local URLs and srcset, and records structured findings.
 */
export function scanUntrustedHtml(rawHtml, { allowLoopback = false, stripAnimations = false, rewriteUrl = null } = {}) {
  if (typeof rawHtml !== "string") {
    throw new MotionError(ERROR_CODES.BRIDGE_SCHEMA_INVALID, "HTML do frame deve ser string.");
  }
  const securityFindings = [];
  const compatibilityDiagnostics = [];
  const extractedAssets = [];
  const keyframes = [];
  const fontFaces = [];
  const animations = [];
  const transitions = [];

  const tokens = tokenizeHtml(rawHtml);
  const out = [];
  const injectionHits = [];
  const seenUrls = new Set();

  const pushAsset = (url, ctx, safe, blockedReason = null) => {
    const key = `${ctx}|${url}`;
    if (seenUrls.has(key)) return;
    seenUrls.add(key);
    extractedAssets.push({ url, ctx, safe, blockedReason });
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    if (tok.type === "comment") {
      const hits = detectPromptInjection(tok.body);
      if (hits.length > 0) {
        injectionHits.push(...hits);
        continue; // strip malicious instruction comment
      }
      out.push(tok);
      continue;
    }

    if (tok.type === "doctype") {
      out.push(tok);
      continue;
    }

    if (tok.type === "text") {
      const hits = detectPromptInjection(tok.text);
      if (hits.length > 0) injectionHits.push(...hits);
      out.push(tok);
      continue;
    }

    if (tok.type === "endTag") {
      if (STRIP_WHOLE_SUBTREE_TAGS.has(tok.tagName) || STRIP_SINGLE_TAGS.has(tok.tagName)) continue;
      out.push(tok);
      continue;
    }

    if (tok.type === "startTag") {
      const tag = tok.tagName;

      // 1) Completely strip dangerous subtree tags
      if (STRIP_WHOLE_SUBTREE_TAGS.has(tag)) {
        if (tag === "script" && tokens[i + 1]?.rawtextFor === "script") {
          const scriptBody = tokens[i + 1].text;
          if (/Math\.random\s*\(|Date\.now\s*\(|new\s+Date\b|performance\.now\s*\(|requestAnimationFrame\s*\(/.test(scriptBody)) {
            compatibilityDiagnostics.push({
              severity: "warn",
              code: "CLOCK_OR_RANDOM_API_DETECTED",
              message: "Script importado usa relógio/aleatoriedade/rAF incompatível com render de vídeo determinístico.",
              action: "Reescrever movimento sobre window.__onFrame__ e frame.js.",
            });
          }
          if (/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/.test(scriptBody)) {
            compatibilityDiagnostics.push({
              severity: "warn",
              code: "RUNTIME_NETWORK_CALL_DETECTED",
              message: "Script importado realiza chamadas de rede em runtime.",
              action: "Hidratar dados/assets localmente antes do render.",
            });
          }
        }
        const code = tag === "script" ? "SCRIPT_STRIPPED" : tag === "iframe" ? "IFRAME_STRIPPED" : tag === "foreignobject" ? "FOREIGN_OBJECT_STRIPPED" : "EMBED_STRIPPED";
        securityFindings.push({ severity: "blocked", code, message: `Elemento <${tok.rawName}> removido de HTML importado`, detail: null });

        if (!tok.selfClosing) {
          let depth = 1;
          while (i + 1 < tokens.length && depth > 0) {
            i++;
            if (tokens[i].type === "startTag" && tokens[i].tagName === tag && !tokens[i].selfClosing) depth++;
            else if (tokens[i].type === "endTag" && tokens[i].tagName === tag) depth--;
          }
        }
        continue;
      }

      // 2) Strip <base> and unsafe <meta>
      if (STRIP_SINGLE_TAGS.has(tag)) {
        securityFindings.push({ severity: "blocked", code: "BASE_TAG_STRIPPED", message: "Tag <base> removida para prevenir sequestro de URLs relativas.", detail: null });
        continue;
      }
      if (tag === "meta") {
        const httpEquiv = tok.attrs.find((a) => normalizeControlAndSpace(a.name).toLowerCase() === "http-equiv");
        if (httpEquiv && /^(?:refresh|set-cookie|content-security-policy)$/i.test(normalizeControlAndSpace(httpEquiv.value))) {
          securityFindings.push({ severity: "blocked", code: "UNSAFE_META_STRIPPED", message: `Tag <meta http-equiv="${httpEquiv.value}"> removida.`, detail: null });
          continue;
        }
      }

      // 3) Inspect <link> external stylesheets/preloads/resources
      if (tag === "link") {
        const hrefAttr = tok.attrs.find((a) => normalizeControlAndSpace(a.name).toLowerCase() === "href");
        const relAttr = tok.attrs.find((a) => normalizeControlAndSpace(a.name).toLowerCase() === "rel");
        const relVal = normalizeControlAndSpace(relAttr?.value ?? "").toLowerCase();
        if (hrefAttr?.value) {
          const check = classifyCssOrHtmlUrl(hrefAttr.value, { allowLoopback });
          if (!check.safe) {
            securityFindings.push({ severity: "blocked", code: "UNSAFE_LINK_STRIPPED", message: `<link rel="${relVal}"> com href inseguro/local removido`, detail: check.reason });
            continue;
          }
          if (check.kind === "remote") {
            pushAsset(check.url, relVal.includes("font") ? "font" : "stylesheet", true, null);
            compatibilityDiagnostics.push({
              severity: "warn",
              code: "EXTERNAL_STYLESHEET_OR_FONT_LINK",
              message: `Tag <link rel="${relVal}"> referencia recurso externo (${check.url}).`,
              action: "Hidratar fontes/estilos localmente na normalização offline.",
            });
            if (typeof rewriteUrl === "function") {
              const local = rewriteUrl(check.url, relVal.includes("font") ? "font" : "stylesheet");
              if (local) hrefAttr.value = local;
              else continue;
            }
          }
        }
      }

      // 4) Inline SVG island -> collect <image> assets and run SVGO sanitizer
      if (tag === "svg" && !tok.selfClosing) {
        const svgTokens = [tok];
        let depth = 1;
        while (i + 1 < tokens.length && depth > 0) {
          i++;
          svgTokens.push(tokens[i]);
          if (tokens[i].type === "startTag" && tokens[i].tagName === "svg" && !tokens[i].selfClosing) depth++;
          else if (tokens[i].type === "endTag" && tokens[i].tagName === "svg") depth--;
        }
        // Scan inline SVG attributes before SVGO strips external <image href> so hydrator can fetch safe URLs
        for (const st of svgTokens) {
          if (st.type !== "startTag") continue;
          if (st.tagName === "image") {
            const hrefAttr = st.attrs.find((a) => {
              const ln = normalizeControlAndSpace(a.name).toLowerCase();
              return ln === "href" || ln === "xlink:href";
            });
            if (hrefAttr?.value) {
              const check = classifyCssOrHtmlUrl(hrefAttr.value, { allowLoopback });
              if (check.kind === "remote") {
                pushAsset(check.url, "svg-image", true, null);
                if (typeof rewriteUrl === "function") {
                  const local = rewriteUrl(check.url, "image");
                  if (local) hrefAttr.value = local;
                }
              }
            }
          }
          if (["animate", "animatemotion", "animatetransform", "set"].includes(st.tagName)) {
            compatibilityDiagnostics.push({
              severity: "warn",
              code: "SMIL_ANIMATION_DETECTED",
              message: "Animação SVG SMIL detectada; SMIL não é determinístico nem permitido em SVGs sanitizados do Motion.",
              action: "Converter para svg-motion.js (data-motion-path / data-layer).",
            });
          }
        }
        const rawSvg = serializeHtmlTokens(svgTokens);
        const svgResult = validateSvg(rawSvg, { strict: false });
        for (const f of svgResult.findings) {
          if (f.severity === "unsafe") {
            const svgCode = f.element === "foreignObject"
              ? "FOREIGN_OBJECT_STRIPPED"
              : f.element === "script"
                ? "SCRIPT_STRIPPED"
                : "SVG_UNSAFE_STRIPPED";
            securityFindings.push({ severity: "blocked", code: svgCode, message: f.message, detail: f.element ?? f.attribute ?? null });
          }
        }
        if (svgResult.ok && svgResult.svg) {
          out.push({ type: "text", text: svgResult.svg });
        } else {
          securityFindings.push({ severity: "blocked", code: "INVALID_SVG_STRIPPED", message: "Bloco <svg> inválido removido por segurança.", detail: svgResult.findings[0]?.message ?? null });
        }
        continue;
      }

      // 5) Inline <style> rawtext -> css-tree AST parse & sanitize
      if (tag === "style" && !tok.selfClosing && tokens[i + 1]?.rawtextFor === "style") {
        const cleanAttrs = [];
        for (const attr of tok.attrs) {
          if (normalizeControlAndSpace(attr.name).toLowerCase().startsWith("on")) {
            securityFindings.push({ severity: "blocked", code: "EVENT_HANDLER_STRIPPED", message: `Atributo ${attr.name} removido de <style>`, detail: null });
          } else cleanAttrs.push(attr);
        }
        const cssRes = inspectAndSanitizeCss(tokens[i + 1].text, {
          context: "stylesheet",
          allowLoopback,
          stripAnimations,
          rewriteUrl,
          sourceLabel: "<style>",
        });
        securityFindings.push(...cssRes.securityFindings);
        compatibilityDiagnostics.push(...cssRes.compatibilityDiagnostics);
        keyframes.push(...cssRes.keyframes);
        fontFaces.push(...cssRes.fontFaces);
        animations.push(...cssRes.animations);
        transitions.push(...cssRes.transitions);
        for (const u of cssRes.extractedUrls) pushAsset(u.url, u.ctx, u.safe, u.blockedReason);
        out.push({ ...tok, attrs: cleanAttrs });
        out.push({ type: "text", text: cssRes.css, rawtextFor: "style" });
        if (tokens[i + 2]?.type === "endTag" && tokens[i + 2].tagName === "style") {
          out.push(tokens[i + 2]);
          i += 2;
        } else {
          i += 1;
        }
        continue;
      }

      // 6) Regular element: sanitize attributes (events, URLs, srcset, style, prompt injection)
      const cleanAttrs = [];
      for (const attr of tok.attrs) {
        const cleanName = normalizeControlAndSpace(attr.name).toLowerCase();
        if (!cleanName) continue;

        if (cleanName.startsWith("on")) {
          securityFindings.push({ severity: "blocked", code: "EVENT_HANDLER_STRIPPED", message: `Manipulador inline ${cleanName} removido de <${tag}>`, detail: null });
          continue;
        }

        if (cleanName === "srcdoc") {
          securityFindings.push({ severity: "blocked", code: "SRCDOC_STRIPPED", message: `Atributo srcdoc removido de <${tag}>`, detail: null });
          continue;
        }

        if (cleanName === "style" && attr.value !== null) {
          const cssRes = inspectAndSanitizeCss(decodeHtmlEntities(attr.value), {
            context: "declarationList",
            allowLoopback,
            stripAnimations,
            rewriteUrl,
            sourceLabel: `<${tag} style>`,
          });
          securityFindings.push(...cssRes.securityFindings);
          compatibilityDiagnostics.push(...cssRes.compatibilityDiagnostics);
          animations.push(...cssRes.animations);
          transitions.push(...cssRes.transitions);
          for (const u of cssRes.extractedUrls) pushAsset(u.url, u.ctx, u.safe, u.blockedReason);
          cleanAttrs.push({ ...attr, name: "style", value: cssRes.css });
          continue;
        }

        if ((cleanName === "srcset" || cleanName === "imagesrcset") && attr.value !== null) {
          const parsedCandidates = parseSrcset(decodeHtmlEntities(attr.value));
          const kept = [];
          for (const cand of parsedCandidates) {
            const check = classifyCssOrHtmlUrl(cand.url, { allowLoopback });
            if (!check.safe) {
              pushAsset(cand.url, "srcset", false, check.reason);
              securityFindings.push({ severity: "blocked", code: "UNSAFE_SRCSET_STRIPPED", message: `Entrada insegura em srcset bloqueada: ${cand.url}`, detail: check.reason });
            } else if (check.kind === "remote") {
              pushAsset(check.url, "image", true, null);
              const rewritten = typeof rewriteUrl === "function" ? rewriteUrl(check.url, "image") : null;
              kept.push(`${rewritten || check.url}${cand.descriptor ? ` ${cand.descriptor}` : ""}`);
            } else {
              kept.push(`${check.url}${cand.descriptor ? ` ${cand.descriptor}` : ""}`);
            }
          }
          if (kept.length > 0) cleanAttrs.push({ ...attr, name: cleanName, value: kept.join(", ") });
          continue;
        }

        if (URL_ATTR_NAMES.has(cleanName) && attr.value !== null) {
          const decodedUrl = decodeHtmlEntities(attr.value).trim();
          const check = classifyCssOrHtmlUrl(decodedUrl, { allowLoopback });
          if (check.kind === "data-image") {
            compatibilityDiagnostics.push({
              severity: "warn",
              code: "BASE64_DATA_URI_FLAGGED",
              message: "URI base64 detectada; Doop recusa base64 e Motion requer assets em disco.",
              action: "Extrair para arquivo local em assets/ ou enviar via upload_asset.",
            });
            cleanAttrs.push({ ...attr, value: check.url });
            continue;
          }
          if (!check.safe) {
            if (check.kind === "local-escape" || check.kind === "relative-local") {
              securityFindings.push({ severity: "blocked", code: "LOCAL_RESOURCE_REF_BLOCKED", message: `Referência a recurso local bloqueada em <${tag} ${cleanName}>: ${decodedUrl}`, detail: check.reason });
            } else if (check.kind === "blocked-remote") {
              securityFindings.push({ severity: "blocked", code: ERROR_CODES.BRIDGE_UNSAFE_URL, message: `URL SSRF/insegura neutralizada em <${tag} ${cleanName}>: ${decodedUrl}`, detail: check.reason });
            } else {
              securityFindings.push({ severity: "blocked", code: "UNSAFE_URL_SCHEME_STRIPPED", message: `URL insegura neutralizada em <${tag} ${cleanName}>`, detail: check.reason });
            }
            if (check.kind === "blocked-remote") pushAsset(decodedUrl, tag === "img" ? "image" : "unknown", false, check.reason);
            const safeFallback = (tag === "img" || tag === "source") && cleanName === "src"
              ? BLOCKED_IMAGE_PLACEHOLDER_URI
              : "#blocked";
            cleanAttrs.push({ ...attr, value: safeFallback });
            continue;
          }
          if (check.kind === "remote") {
            const ctx = tag === "img" ? "image" : tag === "a" ? "link" : "resource";
            if (tag !== "a") pushAsset(check.url, ctx, true, null);
            const rewritten = tag !== "a" && typeof rewriteUrl === "function" ? rewriteUrl(check.url, ctx) : null;
            cleanAttrs.push({ ...attr, value: rewritten || check.url });
            continue;
          }
          cleanAttrs.push({ ...attr, value: check.url });
          continue;
        }

        if (["alt", "title", "aria-label", "placeholder"].includes(cleanName) && attr.value !== null) {
          const decodedText = decodeHtmlEntities(attr.value);
          const hits = detectPromptInjection(decodedText);
          if (hits.length > 0) injectionHits.push(...hits);
        }

        cleanAttrs.push(attr);
      }

      out.push({ ...tok, attrs: cleanAttrs });
    }
  }

  if (injectionHits.length > 0) {
    securityFindings.push({
      severity: "blocked",
      code: "PROMPT_INJECTION_DETECTED",
      message: "Possível prompt injection detectado em comentários, texto ou atributos importados.",
      detail: [...new Set(injectionHits)].slice(0, 5).join(" | "),
    });
  }

  return {
    sanitizedHtml: serializeHtmlTokens(out),
    securityFindings,
    compatibilityDiagnostics,
    extractedAssets,
    keyframes,
    fontFaces,
    animations,
    transitions,
  };
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
