/**
 * MOTION Core Bridge — assets.mjs
 * Zero-trust streaming Asset Hydrator for MotionDesignIR@1.
 *
 * Security & Determinism guarantees:
 *   - SSRF & DNS rebinding protection at effective socket lookup (A + AAAA validation)
 *   - Explicit manual redirect validation with hop limit and header stripping (no Auth/Cookie leaks)
 *   - TLS verification strictly enabled (never rejectUnauthorized: false)
 *   - Bounded streaming download & decompression-bomb / incomplete-response guards
 *   - Real binary magic-byte + MIME verification & SVGO sanitization for SVGs
 *   - Path traversal & symlink traversal guard on all filesystem reads/writes
 *   - Content-addressed SHA-256 deduplication, atomic writes, license verification (assessLicense)
 *   - Emits AssetProvenanceManifest@1 and assets.manifest.json without AI or paid APIs
 */
import { createHash, randomUUID } from "node:crypto";
import dns from "node:dns";
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { Transform } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { ERROR_CODES, MotionError } from "../lib/errors.mjs";
import { assertSafeSvg } from "../svg/svg-tools.mjs";
import { assessLicense } from "../visual-assets/license-policy.mjs";
import { validateAssetProvenance, validateDesignIR, SCHEMA_VERSION } from "./contracts.mjs";
import {
  assertSafeHostResolution,
  assertSafeProjectPath,
  assertSafeRelativePath,
  assertSafeRemoteUrl,
  isPrivateOrReservedIp,
  scanUntrustedHtml,
} from "./security.mjs";

const DEFAULT_MAX_ASSET_BYTES = 10 * 1024 * 1024; // 10 MiB per asset
const DEFAULT_MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MiB aggregate
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_CONCURRENCY = 4;

const MIME_ALIASES = new Map([
  ["image/jpg", "image/jpeg"],
  ["application/font-woff", "font/woff"],
  ["application/font-woff2", "font/woff2"],
  ["application/x-font-ttf", "font/ttf"],
  ["font/sfnt", "font/ttf"],
  ["application/x-font-truetype", "font/ttf"],
  ["application/x-font-otf", "font/otf"],
  ["application/font-sfnt", "font/otf"],
  ["text/xml", "image/svg+xml"],
  ["application/xml", "image/svg+xml"],
]);

const EXT_BY_MIME = Object.freeze({
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "font/woff": "woff",
  "font/woff2": "woff2",
  "font/ttf": "ttf",
  "font/otf": "otf",
});

function sha256Bytes(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function normalizeMime(contentType) {
  const base = String(contentType ?? "").split(";")[0].trim().toLowerCase();
  return MIME_ALIASES.get(base) ?? base;
}

function sniffBinaryFormat(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return null;
  if (buf.length >= 24 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    if (buf.subarray(12, 16).toString("ascii") !== "IHDR") return null;
    return { mime: "image/png", ext: "png", kind: "image" };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    if (buf[buf.length - 2] !== 0xff || buf[buf.length - 1] !== 0xd9) return null;
    return { mime: "image/jpeg", ext: "jpg", kind: "image" };
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return { mime: "image/webp", ext: "webp", kind: "image" };
  }
  const head6 = buf.subarray(0, 6).toString("ascii");
  if (head6 === "GIF87a" || head6 === "GIF89a") {
    return { mime: "image/gif", ext: "gif", kind: "image" };
  }
  if (buf.length >= 12 && buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (["avif", "avis", "mif1", "heic"].includes(brand)) {
      return { mime: "image/avif", ext: "avif", kind: "image" };
    }
  }
  const head4 = buf.subarray(0, 4).toString("ascii");
  if (head4 === "wOFF") return { mime: "font/woff", ext: "woff", kind: "font" };
  if (head4 === "wOF2") return { mime: "font/woff2", ext: "woff2", kind: "font" };
  if (head4 === "OTTO") return { mime: "font/otf", ext: "otf", kind: "font" };
  if (buf.subarray(0, 4).equals(Buffer.from([0x00, 0x01, 0x00, 0x00])) || head4 === "true") {
    return { mime: "font/ttf", ext: "ttf", kind: "font" };
  }
  // SVG text check (must not contain NUL bytes or HTML root)
  if (!buf.includes(0)) {
    const text = buf.toString("utf8").trimStart();
    if (/^(?:<\?xml\b[^>]*>\s*)?(?:<!DOCTYPE\b[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) {
      return { mime: "image/svg+xml", ext: "svg", kind: "svg", text };
    }
  }
  return null;
}

/** Validates real binary signature, declared Content-Type, expected kind, and sanitizes SVG payloads. */
export function inspectAndSanitizeAssetBinary(bytes, { contentType = "", expectedKind = "unknown", url = "" } = {}) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buf.length === 0) {
    throw new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, `Payload vazio para asset ${url}`);
  }
  const sniffed = sniffBinaryFormat(buf);
  if (!sniffed) {
    throw new MotionError(
      ERROR_CODES.BRIDGE_MIME_MISMATCH,
      `Assinatura binária não reconhecida ou truncada para ${url}`,
      { details: { contentType, byteLength: buf.length } }
    );
  }
  const declared = normalizeMime(contentType);
  if (declared) {
    const isGenericOctet = declared === "application/octet-stream" || declared === "binary/octet-stream";
    if (!isGenericOctet && declared !== sniffed.mime) {
      throw new MotionError(
        ERROR_CODES.BRIDGE_MIME_MISMATCH,
        `MIME divergente em ${url}: servidor declarou '${declared}', assinatura real é '${sniffed.mime}'.`,
        { details: { declared, detected: sniffed.mime } }
      );
    }
  }
  if (expectedKind === "font" && sniffed.kind !== "font") {
    throw new MotionError(ERROR_CODES.BRIDGE_MIME_MISMATCH, `Asset esperado como fonte, mas payload é ${sniffed.mime} (${url}).`);
  }
  if (expectedKind === "svg" && sniffed.kind !== "svg") {
    throw new MotionError(ERROR_CODES.BRIDGE_MIME_MISMATCH, `Asset esperado como SVG, mas payload é ${sniffed.mime} (${url}).`);
  }
  if (expectedKind === "image" && sniffed.kind !== "image" && sniffed.kind !== "svg") {
    throw new MotionError(ERROR_CODES.BRIDGE_MIME_MISMATCH, `Asset esperado como imagem, mas payload é ${sniffed.mime} (${url}).`);
  }

  let finalBuffer = buf;
  let sanitized = true;
  if (sniffed.kind === "svg") {
    const cleanSvg = assertSafeSvg(sniffed.text, { strict: false });
    finalBuffer = Buffer.from(cleanSvg, "utf8");
    sanitized = true;
  }

  return {
    mime: sniffed.mime,
    ext: EXT_BY_MIME[sniffed.mime] ?? sniffed.ext,
    kind: sniffed.kind,
    buffer: finalBuffer,
    sanitized,
    sha256: sha256Bytes(finalBuffer),
  };
}

function createByteLimiter(maxBytes, label) {
  let seen = 0;
  return new Transform({
    transform(chunk, _enc, cb) {
      seen += chunk.length;
      if (seen > maxBytes) {
        cb(new MotionError(ERROR_CODES.BRIDGE_SIZE_LIMIT, `Limite de tamanho excedido (${label}: > ${maxBytes} bytes).`));
        return;
      }
      cb(null, chunk);
    },
  });
}

function buildPinnedLookup({ dnsLookup, allowLoopback }) {
  return (hostname, opts, cb) => {
    const options = typeof opts === "function" ? {} : (opts ?? {});
    const callback = typeof opts === "function" ? opts : cb;
    const resolver = dnsLookup
      ? Promise.resolve(dnsLookup(hostname, options))
      : dns.promises.lookup(hostname, { all: true, verbatim: true });

    resolver.then((res) => {
      const list = Array.isArray(res) ? res : [res];
      const valid = assertSafeHostResolution(hostname, list, { allowLoopback });
      if (options.all) callback(null, valid);
      else callback(null, valid[0].address, valid[0].family);
    }).catch((err) => {
      callback(err);
    });
  };
}

function stripSensitiveHeaders(headers = {}, isRedirect = false) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    const lower = k.toLowerCase();
    if (lower === "authorization" || lower === "cookie" || lower === "proxy-authorization") {
      if (isRedirect) continue;
      continue; // Asset Hydrator never transmits caller Authorization/cookies to asset hosts
    }
    out[k] = v;
  }
  return out;
}

function performHttpRequestOnce(urlStr, { allowLoopback, maxBytes, timeoutMs, signal, dnsLookup, headers }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, `Download cancelado antes de iniciar: ${urlStr}`));
      return;
    }
    const parsed = new URL(urlStr);
    const client = parsed.protocol === "https:" ? https : http;
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const succeed = (val) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(val);
    };

    const controller = new AbortController();
    const onExternalAbort = () => {
      controller.abort(signal?.reason);
      req.destroy(new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, `Download cancelado: ${urlStr}`));
    };
    signal?.addEventListener("abort", onExternalAbort, { once: true });

    const timer = setTimeout(() => {
      req.destroy(new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, `Timeout (${timeoutMs} ms) ao baixar ${urlStr}`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onExternalAbort);
    };

    const req = client.request(
      parsed,
      {
        method: "GET",
        lookup: buildPinnedLookup({ dnsLookup, allowLoopback }),
        headers: {
          "accept-encoding": "gzip, deflate, br, identity",
          ...stripSensitiveHeaders(headers, false),
        },
        ...(parsed.protocol === "https:" ? { rejectUnauthorized: true, servername: parsed.hostname } : {}),
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if ([301, 302, 303, 307, 308].includes(status)) {
          res.resume();
          succeed({ redirect: res.headers.location ?? "", status });
          return;
        }
        if (status !== 200) {
          res.resume();
          fail(new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, `HTTP ${status} ao baixar asset ${urlStr}`));
          return;
        }

        const declaredLength = res.headers["content-length"] !== undefined ? Number(res.headers["content-length"]) : null;
        if (declaredLength !== null && (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > maxBytes)) {
          res.destroy();
          fail(new MotionError(ERROR_CODES.BRIDGE_SIZE_LIMIT, `Content-Length (${declaredLength}) excede o limite de ${maxBytes} bytes em ${urlStr}.`));
          return;
        }

        const encoding = String(res.headers["content-encoding"] ?? "identity").trim().toLowerCase();
        if (!["", "identity", "gzip", "x-gzip", "deflate", "br"].includes(encoding)) {
          res.destroy();
          fail(new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, `Content-Encoding não suportado (${encoding}) em ${urlStr}`));
          return;
        }

        let wireBytes = 0;
        const wireLimiter = new Transform({
          transform(chunk, _enc, cb) {
            wireBytes += chunk.length;
            if (wireBytes > maxBytes) {
              cb(new MotionError(ERROR_CODES.BRIDGE_SIZE_LIMIT, `Stream excedeu o limite de ${maxBytes} bytes em ${urlStr}.`));
              return;
            }
            cb(null, chunk);
          },
        });

        let decoder = null;
        if (encoding === "gzip" || encoding === "x-gzip") decoder = createGunzip();
        else if (encoding === "deflate") decoder = createInflate();
        else if (encoding === "br") decoder = createBrotliDecompress();

        const decompressedLimiter = createByteLimiter(maxBytes, `descompressão de ${urlStr}`);
        const chunks = [];
        let endedCleanly = false;

        const destroyAll = (err) => {
          fail(err);
          res.destroy();
          wireLimiter.destroy();
          decoder?.destroy();
          decompressedLimiter.destroy();
        };

        res.on("error", (err) => destroyAll(err));
        res.on("aborted", () => destroyAll(new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, `Resposta HTTP truncada/abortada em ${urlStr}`)));
        wireLimiter.on("error", (err) => destroyAll(err));
        decoder?.on("error", (err) => destroyAll(new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, `Falha ao descomprimir resposta de ${urlStr}`, { cause: err })));
        decompressedLimiter.on("error", (err) => destroyAll(err));

        decompressedLimiter.on("data", (c) => chunks.push(c));
        decompressedLimiter.on("end", () => {
          endedCleanly = true;
          if (!res.complete) {
            fail(new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, `Resposta HTTP incompleta em ${urlStr}`));
            return;
          }
          if (declaredLength !== null && wireBytes !== declaredLength) {
            fail(new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, `Resposta HTTP truncada em ${urlStr}: esperado ${declaredLength} bytes, recebido ${wireBytes}.`));
            return;
          }
          succeed({
            status,
            contentType: String(res.headers["content-type"] ?? ""),
            buffer: Buffer.concat(chunks),
            wireBytes,
          });
        });

        res.on("close", () => {
          if (!res.complete && !endedCleanly && !settled) {
            destroyAll(new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, `Conexão encerrada antes do fim da resposta em ${urlStr}`));
          }
        });

        if (decoder) res.pipe(wireLimiter).pipe(decoder).pipe(decompressedLimiter);
        else res.pipe(wireLimiter).pipe(decompressedLimiter);
      }
    );

    req.on("socket", (sock) => {
      sock.on("connect", () => {
        if (sock.remoteAddress && isPrivateOrReservedIp(sock.remoteAddress, { allowLoopback })) {
          req.destroy(new MotionError(ERROR_CODES.BRIDGE_UNSAFE_URL, `Conexão efetiva para IP privado bloqueada: ${sock.remoteAddress}`));
        }
      });
    });

    req.on("error", (err) => {
      fail(err instanceof MotionError ? err : new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, `Falha de rede ao baixar ${urlStr}: ${err.message}`, { cause: err }));
    });

    req.end();
  });
}

/**
 * Fetches a remote asset securely with manual redirect validation, DNS-rebinding defense,
 * streaming size limits, decompression bomb guards, and incomplete-response verification.
 */
export async function secureFetchAsset(
  rawUrl,
  {
    allowLoopback = false,
    maxAssetBytes = DEFAULT_MAX_ASSET_BYTES,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal = null,
    dnsLookup = null,
    transport = null,
    headers = {},
  } = {}
) {
  let currentUrl = assertSafeRemoteUrl(rawUrl, { allowLoopback });
  const visited = new Set([currentUrl]);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (signal?.aborted) {
      throw new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, `Hidratação cancelada para ${currentUrl}`);
    }
    const res = transport
      ? await transport(currentUrl, { allowLoopback, maxBytes: maxAssetBytes, timeoutMs, signal, headers: stripSensitiveHeaders(headers, hop > 0) })
      : await performHttpRequestOnce(currentUrl, { allowLoopback, maxBytes: maxAssetBytes, timeoutMs, signal, dnsLookup, headers });

    if (res && res.redirect !== undefined) {
      if (hop >= maxRedirects) {
        throw new MotionError(ERROR_CODES.BRIDGE_UNSAFE_URL, `Limite de redirecionamentos (${maxRedirects}) excedido em ${rawUrl}`);
      }
      if (!res.redirect) {
        throw new MotionError(ERROR_CODES.BRIDGE_UNSAFE_URL, `Redirecionamento sem cabeçalho Location em ${currentUrl}`);
      }
      let nextRaw;
      try {
        nextRaw = new URL(res.redirect, currentUrl).toString();
      } catch {
        throw new MotionError(ERROR_CODES.BRIDGE_UNSAFE_URL, `Location de redirecionamento inválida: ${res.redirect}`);
      }
      const nextSafe = assertSafeRemoteUrl(nextRaw, { allowLoopback });
      if (visited.has(nextSafe)) {
        throw new MotionError(ERROR_CODES.BRIDGE_UNSAFE_URL, `Loop de redirecionamento detectado: ${nextSafe}`);
      }
      visited.add(nextSafe);
      currentUrl = nextSafe;
      continue;
    }

    const buf = Buffer.isBuffer(res?.buffer) ? res.buffer : Buffer.from(res?.buffer ?? []);
    if (buf.length > maxAssetBytes) {
      throw new MotionError(ERROR_CODES.BRIDGE_SIZE_LIMIT, `Asset excede limite de ${maxAssetBytes} bytes (${currentUrl}).`);
    }
    return {
      finalUrl: currentUrl,
      contentType: String(res?.contentType ?? ""),
      buffer: buf,
    };
  }
  throw new MotionError(ERROR_CODES.BRIDGE_UNSAFE_URL, `Excesso de redirecionamentos em ${rawUrl}`);
}

async function atomicWriteBytes(filePath, data) {
  const resolved = path.resolve(filePath);
  try {
    const st = await lstat(resolved);
    if (st.isSymbolicLink()) {
      throw new MotionError(ERROR_CODES.BRIDGE_PATH_TRAVERSAL, `Destino não pode ser symlink: ${resolved}`);
    }
  } catch (err) {
    if (err instanceof MotionError) throw err;
  }
  await mkdir(path.dirname(resolved), { recursive: true });
  const tmp = `${resolved}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(tmp, data);
  try {
    await rename(tmp, resolved);
  } catch (err) {
    await rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runWorker = async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx], idx);
    }
  };
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

/** Discovers external asset candidates referenced by a MotionDesignIR@1 (+ optional DesignTokenBundle@1). */
export function discoverAssetsFromIR(ir, { tokenBundle = null, allowLoopback = false } = {}) {
  const validIR = validateDesignIR(ir);
  const candidates = [];
  const blocked = [];
  const seen = new Set();

  const addCandidate = (url, kind, origin, extra = {}) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    candidates.push({ url, kind, origin, ...extra });
  };

  for (const a of validIR.referencedAssets) {
    if (a.safe === false) {
      blocked.push({ url: a.url, kind: a.kind, reason: a.blockedReason ?? "Blocked in IR" });
      continue;
    }
    addCandidate(a.url, a.kind === "background" ? "image" : a.kind, `${validIR.source.editor}:frame:${validIR.source.frameId}`);
  }

  const scan = scanUntrustedHtml(validIR.sanitizedHtml, { allowLoopback });
  for (const a of scan.extractedAssets) {
    if (!a.safe) {
      if (!blocked.some((b) => b.url === a.url)) blocked.push({ url: a.url, kind: a.ctx, reason: a.blockedReason ?? "Blocked in HTML" });
      continue;
    }
    const kind = a.ctx === "font" ? "font" : a.ctx === "svg-image" || a.ctx === "image" || a.ctx === "css" ? "image" : "unknown";
    addCandidate(a.url, kind, `${validIR.source.editor}:html:${validIR.source.frameId}`);
  }

  if (tokenBundle) {
    for (const f of [...(tokenBundle.fonts?.custom ?? []), ...(tokenBundle.fonts?.webFonts ?? [])]) {
      if (/^https?:\/\//i.test(String(f))) {
        try {
          const safe = assertSafeRemoteUrl(String(f), { allowLoopback });
          addCandidate(safe, "font", `${tokenBundle.sourceEditor ?? validIR.source.editor}:tokens:fonts`);
        } catch (err) {
          blocked.push({ url: String(f), kind: "font", reason: err.message });
        }
      }
    }
  }

  return { candidates, blocked };
}

function buildAssetId(url, kind, index) {
  const shortHash = sha256Bytes(Buffer.from(url, "utf8")).slice(0, 8);
  const baseName = (() => {
    try {
      const p = new URL(url).pathname.split("/").pop() || "asset";
      return p.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || kind;
    } catch {
      return kind;
    }
  })();
  return `a${String(index + 1).padStart(2, "0")}-${baseName}-${shortHash}`;
}

/**
 * Hydrates all safe assets referenced by MotionDesignIR@1 into `<projectDir>/assets/imported/`.
 * Deduplicates by SHA-256, checks licenses with `assessLicense`, verifies binary MIME signatures,
 * uses optional content-addressed `cacheDir`, and writes `AssetProvenanceManifest@1` + `assets.manifest.json`.
 */
export async function hydrateAssets(
  ir,
  {
    projectDir,
    tokenBundle = null,
    cacheDir = null,
    assetMetadata = {},
    defaultLicense = { spdx: "CC0-1.0" },
    commercial = true,
    allowLoopback = false,
    maxAssetBytes = DEFAULT_MAX_ASSET_BYTES,
    maxTotalBytes = DEFAULT_MAX_TOTAL_BYTES,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    concurrency = DEFAULT_CONCURRENCY,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal = null,
    dnsLookup = null,
    transport = null,
  } = {}
) {
  if (!projectDir) {
    throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, "hydrateAssets exige projectDir.");
  }
  const rootAbs = path.resolve(projectDir);
  await mkdir(rootAbs, { recursive: true });

  const { candidates, blocked } = discoverAssetsFromIR(ir, { tokenBundle, allowLoopback });

  // Validate assetMetadata path traversal / licenses upfront before network work
  let aggregateBytes = 0;
  const shaToLocalPath = new Map();
  const shaInFlight = new Map();
  const urlToLocalPath = {};
  const manifestRecords = [];
  const fileEntries = [];
  const cacheHits = [];

  const sortedCandidates = [...candidates].sort((a, b) => a.url.localeCompare(b.url));

  await mapLimit(sortedCandidates, concurrency, async (cand, idx) => {
    if (signal?.aborted) {
      throw new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, "Hidratação de assets cancelada.");
    }
    const meta = assetMetadata[cand.url] ?? {};
    const license = meta.license ?? defaultLicense;
    const licenseVerdict = assessLicense(license, { commercial });
    if (!licenseVerdict.allowed) {
      throw new MotionError(
        ERROR_CODES.BRIDGE_SECURITY_VIOLATION,
        `Licença bloqueada para asset '${cand.url}': ${licenseVerdict.reason}`,
        { details: licenseVerdict }
      );
    }

    const origin = meta.origin ?? cand.origin ?? `${ir.source.editor}:import`;
    const isTrademark = Boolean(meta.trademark || licenseVerdict.trademark || /search_logos/i.test(origin));
    const expectedSha = meta.expectedSha256 ?? null;

    // Optional content-addressed cache hit when expectedSha is known
    let verified = null;
    if (cacheDir && expectedSha && /^[a-f0-9]{64}$/.test(expectedSha)) {
      const cacheMetaPath = path.join(path.resolve(cacheDir), `${expectedSha}.json`);
      const cacheBinPath = path.join(path.resolve(cacheDir), `${expectedSha}.bin`);
      if (existsSync(cacheMetaPath) && existsSync(cacheBinPath)) {
        try {
          const stMeta = await lstat(cacheMetaPath);
          const stBin = await lstat(cacheBinPath);
          if (!stMeta.isSymbolicLink() && !stBin.isSymbolicLink()) {
            const cachedMeta = JSON.parse(await readFile(cacheMetaPath, "utf8"));
            const cachedBytes = await readFile(cacheBinPath);
            if (sha256Bytes(cachedBytes) === expectedSha) {
              verified = inspectAndSanitizeAssetBinary(cachedBytes, {
                contentType: cachedMeta.mime ?? "",
                expectedKind: cand.kind,
                url: cand.url,
              });
              cacheHits.push(cand.url);
            }
          }
        } catch {
          verified = null;
        }
      }
    }

    if (!verified) {
      const fetched = await secureFetchAsset(cand.url, {
        allowLoopback,
        maxAssetBytes,
        maxRedirects,
        timeoutMs,
        signal,
        dnsLookup,
        transport,
      });
      verified = inspectAndSanitizeAssetBinary(fetched.buffer, {
        contentType: fetched.contentType,
        expectedKind: cand.kind,
        url: cand.url,
      });
    }

    if (expectedSha && verified.sha256 !== expectedSha) {
      throw new MotionError(
        ERROR_CODES.BRIDGE_SECURITY_VIOLATION,
        `Integridade SHA-256 divergente para ${cand.url}: esperado ${expectedSha}, obtido ${verified.sha256}.`
      );
    }

    // Enforce aggregate size budget deterministically (count each unique blob + check pre-dedup limit)
    if (aggregateBytes + verified.buffer.length > maxTotalBytes) {
      throw new MotionError(
        ERROR_CODES.BRIDGE_SIZE_LIMIT,
        `Limite agregado de hidratação excedido (> ${maxTotalBytes} bytes).`
      );
    }
    aggregateBytes += verified.buffer.length;

    // Content-addressed deduplication within project assets/imported/
    let relLocalPath = shaToLocalPath.get(verified.sha256);
    if (!relLocalPath) {
      if (meta.localPath) {
        relLocalPath = assertSafeRelativePath(meta.localPath);
      } else {
        relLocalPath = `assets/imported/${verified.sha256.slice(0, 16)}.${verified.ext}`;
      }
      shaToLocalPath.set(verified.sha256, relLocalPath);

      const writeTask = (async () => {
        const destAbs = await assertSafeProjectPath(rootAbs, relLocalPath);
        await atomicWriteBytes(destAbs, verified.buffer);
        if (cacheDir) {
          const cacheRoot = path.resolve(cacheDir);
          await mkdir(cacheRoot, { recursive: true });
          const cBin = await assertSafeProjectPath(cacheRoot, `${verified.sha256}.bin`);
          const cMeta = await assertSafeProjectPath(cacheRoot, `${verified.sha256}.json`);
          await atomicWriteBytes(cBin, verified.buffer);
          await atomicWriteBytes(cMeta, Buffer.from(JSON.stringify({ sha256: verified.sha256, mime: verified.mime, kind: verified.kind }), "utf8"));
        }
      })();
      shaInFlight.set(verified.sha256, writeTask);
      await writeTask;
    } else if (shaInFlight.has(verified.sha256)) {
      await shaInFlight.get(verified.sha256);
    }

    urlToLocalPath[cand.url] = relLocalPath;
    const assetId = buildAssetId(cand.url, verified.kind, idx);
    manifestRecords.push({
      id: assetId,
      sourceUrl: cand.url,
      localPath: relLocalPath,
      sha256: verified.sha256,
      kind: verified.kind,
      origin,
      license,
      sanitized: verified.sanitized,
      trademark: isTrademark,
    });
    fileEntries.push({
      path: relLocalPath,
      mediaType: verified.mime,
      bytes: verified.buffer.length,
      sha256: verified.sha256,
      sourceUrl: cand.url,
      origin,
    });
  });

  manifestRecords.sort((a, b) => a.id.localeCompare(b.id));
  const provenanceManifest = validateAssetProvenance(
    {
      schemaVersion: SCHEMA_VERSION,
      assets: manifestRecords,
    },
    { commercial, allowLoopback }
  );

  // Deduplicate fileEntries on disk path for assets.manifest.json
  const uniqueFilesByPath = new Map();
  for (const f of fileEntries) {
    if (!uniqueFilesByPath.has(f.path)) uniqueFilesByPath.set(f.path, f);
  }
  const assetsManifest = {
    schemaVersion: 1,
    generatedBy: "@technomanceer/motion-core bridge/assets",
    provenanceSchemaVersion: SCHEMA_VERSION,
    assetsRef: "assets.provenance.v1.json",
    counts: {
      discovered: candidates.length,
      hydrated: provenanceManifest.assets.length,
      uniqueFiles: uniqueFilesByPath.size,
      blocked: blocked.length,
      cacheHits: cacheHits.length,
      totalBytes: aggregateBytes,
    },
    files: [...uniqueFilesByPath.values()].sort((a, b) => a.path.localeCompare(b.path)),
    assets: provenanceManifest.assets,
  };

  const provenanceAbs = await assertSafeProjectPath(rootAbs, "assets.provenance.v1.json");
  const manifestAbs = await assertSafeProjectPath(rootAbs, "assets.manifest.json");
  await atomicWriteBytes(provenanceAbs, Buffer.from(JSON.stringify(provenanceManifest, null, 2) + "\n", "utf8"));
  await atomicWriteBytes(manifestAbs, Buffer.from(JSON.stringify(assetsManifest, null, 2) + "\n", "utf8"));

  return {
    provenanceManifest,
    assetsManifest,
    provenancePath: provenanceAbs,
    manifestPath: manifestAbs,
    urlToLocalPath,
    blockedUrls: blocked,
    cacheHits,
    stats: assetsManifest.counts,
  };
}
