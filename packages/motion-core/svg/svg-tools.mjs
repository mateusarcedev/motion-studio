/**
 * MOTION Core — svg/svg-tools.mjs
 * SVG validation, sanitization (untrusted input), optimization and rasterization.
 *
 * Built on SVGO's parser/visitor (consolidated, MIT). Security model for untrusted SVG:
 *   - strict element/attribute allowlist (no <script>, <foreignObject>, <iframe>, SMIL animation, …)
 *   - no event-handler attributes, no javascript:/external URLs (only #fragment refs and raster data: URIs)
 *   - <style> content is rejected if it imports or references external URLs
 * Sanitizing never silently hides what happened: every removal becomes a finding.
 */
import { parse as parseCss, walk as walkCss } from "css-tree";
import { optimize } from "svgo";
import { ERROR_CODES, MotionError } from "../lib/errors.mjs";

const ALLOWED_ELEMENTS = new Set([
  "svg", "g", "defs", "title", "desc", "metadata", "symbol", "use", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "textPath", "image", "linearGradient", "radialGradient", "stop", "pattern", "clipPath", "mask", "marker", "style",
  "filter", "feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR",
  "feGaussianBlur", "feMerge", "feMergeNode", "feMorphology", "feOffset", "feTurbulence", "feDisplacementMap", "feTile", "feImage",
  "feDiffuseLighting", "feSpecularLighting", "feDistantLight", "fePointLight", "feSpotLight", "feConvolveMatrix",
]);
const DANGEROUS_ELEMENTS = new Set(["script", "foreignObject", "iframe", "object", "embed", "audio", "video", "canvas", "animate", "animateMotion", "animateTransform", "set", "discard", "a", "handler", "listener", "link", "meta"]);
const URL_ATTRS = new Set(["href", "xlink:href", "src"]);
const URL_FN = /url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi;

function decodeEntitiesAndStripCtrl(value) {
  return String(value ?? "")
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => {
      const cp = Number.parseInt(hex, 16);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
    })
    .replace(/&#([0-9]+);?/g, (_, dec) => {
      const cp = Number.parseInt(dec, 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
    })
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
}

const isSafeRef = (value) => /^#[\w.:-]+$/.test(decodeEntitiesAndStripCtrl(value));
const isSafeDataImage = (value) => /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=\s]+$/i.test(decodeEntitiesAndStripCtrl(value));
const isSafeUrlTarget = (url) => isSafeRef(url) || isSafeDataImage(url);

function decodeCssEscapes(value) {
  return String(value ?? "").replace(/\\([0-9a-f]{1,6})\s?|\\([^\n\r\f0-9a-f])/gi, (_, hex, ch) => {
    if (hex) {
      const cp = Number.parseInt(hex, 16);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
    }
    return ch ?? "";
  });
}

function hasUnsafeCss(css, context = "stylesheet") {
  let unsafe = false;
  const normalizedRaw = decodeCssEscapes(css);
  try {
    const ast = parseCss(css, {
      context,
      onParseError: () => { unsafe = true; },
    });
    walkCss(ast, (node) => {
      if (node.type === "Atrule" && decodeCssEscapes(node.name).toLowerCase() === "import") unsafe = true;
      if (node.type === "Declaration" && /^(?:behavior|-moz-binding)$/i.test(decodeCssEscapes(node.property))) unsafe = true;
      if (node.type === "Function" && /^(?:expression|-moz-binding|url)$/i.test(decodeCssEscapes(node.name))) {
        if (decodeCssEscapes(node.name).toLowerCase() !== "url") unsafe = true;
      }
      if (node.type === "Raw") {
        const rawDec = decodeCssEscapes(node.value);
        if (/url\s*\(|expression\s*\(|https?:|javascript:|vbscript:|file:|@import/i.test(rawDec)) unsafe = true;
      }
      if (node.type === "Url" && !isSafeUrlTarget(decodeCssEscapes(node.value))) unsafe = true;
      if (node.type === "String") {
        const s = decodeCssEscapes(node.value);
        if (/^(?:https?:|javascript:|vbscript:|file:|data\s*:\s*text\/html)/i.test(s.trim())) unsafe = true;
      }
    });
  } catch {
    return true;
  }
  if (unsafe) return true;
  if (/@import|expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding\s*:/i.test(normalizedRaw)) return true;
  for (const m of normalizedRaw.matchAll(URL_FN)) if (!isSafeUrlTarget(m[2])) return true;
  return false;
}

function walk(node, fn, parent = null) {
  fn(node, parent);
  if (node.children) for (const child of [...node.children]) walk(child, fn, node);
}

function removeNode(parent, node) {
  parent.children = parent.children.filter((c) => c !== node);
}

/** svgo plugin factory: allowlist sanitizer that records findings. */
function sanitizerPlugin(findings) {
  return {
    name: "motionSanitize",
    fn: (root) => ({
      root: {
        exit: () => {
          walk(root, (node, parent) => {
            if (node.type === "element") {
              const name = node.name;
              if (DANGEROUS_ELEMENTS.has(name) || !ALLOWED_ELEMENTS.has(name)) {
                findings.push({ severity: "unsafe", code: ERROR_CODES.SVG_UNSAFE, message: `Elemento não permitido removido: <${name}>`, element: name });
                if (parent) removeNode(parent, node);
                return;
              }
              if (name === "style") {
                const css = (node.children ?? []).map((c) => c.value ?? "").join("");
                if (hasUnsafeCss(css, "stylesheet")) {
                  findings.push({ severity: "unsafe", code: ERROR_CODES.SVG_UNSAFE, message: "<style> com @import/URL externa removido", element: "style" });
                  if (parent) removeNode(parent, node);
                  return;
                }
              }
              for (const [attr, value] of Object.entries(node.attributes)) {
                const lower = decodeEntitiesAndStripCtrl(attr).toLowerCase();
                const decodedVal = decodeEntitiesAndStripCtrl(value);
                let bad = null;
                if (lower.startsWith("on")) bad = "manipulador de evento";
                else if (URL_ATTRS.has(lower) && !isSafeRef(decodedVal) && !(name === "image" && isSafeDataImage(decodedVal))) bad = "URL externa ou insegura";
                else if (/javascript:|vbscript:|data\s*:\s*text\/html|data\s*:\s*image\/svg\+xml/i.test(decodedVal)) bad = "URL de script";
                else if (lower === "style" && hasUnsafeCss(decodedVal, "declarationList")) bad = "estilo inseguro";
                else if (lower !== "style" && /url\s*\(/i.test(decodedVal) && hasUnsafeCss(`x:${decodedVal};`, "declarationList")) bad = "url() externa";
                if (bad) {
                  findings.push({ severity: "unsafe", code: ERROR_CODES.SVG_UNSAFE, message: `Atributo ${attr} removido (${bad})`, element: name, attribute: attr });
                  delete node.attributes[attr];
                }
              }
            }
          });
        },
      },
    }),
  };
}

const idRefs = (svg) => {
  const ids = [...svg.matchAll(/\sid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]);
  const refs = new Set([
    ...[...svg.matchAll(/url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/g)].map((m) => m[1]),
    ...[...svg.matchAll(/\s(?:xlink:)?href\s*=\s*["']#([^"']+)["']/g)].map((m) => m[1]),
  ]);
  return { ids, refs };
};

/**
 * Validates (and optionally sanitizes) an SVG string.
 * @param {string} svg
 * @param {{trusted?: boolean, strict?: boolean}} [options] trusted=false (default) enforces the allowlist.
 * @returns {{ status: "PASS"|"WARN"|"FAIL", ok: boolean, svg: string|null, viewBox: number[]|null, findings: object[] }}
 */
export function validateSvg(svg, { trusted = false, strict = false } = {}) {
  const findings = [];
  const fail = (code, message, extra = {}) => ({ status: "FAIL", ok: false, svg: null, viewBox: null, findings: [...findings, { severity: "error", code, message, ...extra }] });
  if (typeof svg !== "string" || !svg.trim()) return fail(ERROR_CODES.SVG_INVALID, "O SVG está vazio.");
  if (svg.length > 5_000_000) return fail(ERROR_CODES.SVG_INVALID, "O SVG é grande demais (> 5 MB).");

  let out;
  try {
    out = optimize(svg, {
      plugins: trusted ? [] : [sanitizerPlugin(findings)],
      js2svg: { pretty: false },
    }).data;
  } catch (cause) {
    return fail(ERROR_CODES.SVG_INVALID, `SVG malformado: ${String(cause.message).split("\n")[0]}`, { hint: "Verifique tags não fechadas e atributos sem aspas." });
  }
  if (!/^\s*(?:<\?xml[^>]*>\s*)?(?:<!DOCTYPE[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(out)) {
    return fail(ERROR_CODES.SVG_INVALID, "O documento não tem <svg> como elemento raiz.");
  }

  const root = out.match(/<svg\b([^>]*)>/i)?.[1] ?? "";
  if (!/\sxmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/.test(` ${root}`)) {
    findings.push({ severity: "warning", code: ERROR_CODES.SVG_INVALID, message: "Falta xmlns do SVG; será adicionado." });
    out = out.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  let viewBox = null;
  const vb = root.match(/\sviewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  if (vb) {
    const nums = vb.trim().split(/[\s,]+/).map(Number);
    if (nums.length === 4 && nums.every(Number.isFinite) && nums[2] > 0 && nums[3] > 0) viewBox = nums;
    else findings.push({ severity: "error", code: ERROR_CODES.SVG_INVALID, message: `viewBox inválido: "${vb}"` });
  } else {
    const w = Number.parseFloat(root.match(/\swidth\s*=\s*["']([\d.]+)(?:px)?["']/i)?.[1]);
    const h = Number.parseFloat(root.match(/\sheight\s*=\s*["']([\d.]+)(?:px)?["']/i)?.[1]);
    if (w > 0 && h > 0) {
      viewBox = [0, 0, w, h];
      out = out.replace(/<svg\b/i, `<svg viewBox="0 0 ${w} ${h}"`);
      findings.push({ severity: "warning", code: ERROR_CODES.SVG_INVALID, message: `Sem viewBox; derivado de width/height (0 0 ${w} ${h}).` });
    } else findings.push({ severity: "error", code: ERROR_CODES.SVG_INVALID, message: "O SVG não tem viewBox nem width/height; não é possível preservar proporções." });
  }

  const { ids, refs } = idRefs(out);
  const dup = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (dup.length) findings.push({ severity: "warning", code: ERROR_CODES.SVG_INVALID, message: `IDs duplicados: ${dup.join(", ")}` });
  const dangling = [...refs].filter((r) => !ids.includes(r));
  if (dangling.length) findings.push({ severity: "warning", code: ERROR_CODES.SVG_INVALID, message: `Referências internas sem destino: ${dangling.map((d) => `#${d}`).join(", ")}` });

  const hasError = findings.some((f) => f.severity === "error");
  const unsafe = findings.some((f) => f.severity === "unsafe");
  let status = hasError ? "FAIL" : (unsafe || findings.length) ? "WARN" : "PASS";
  if (strict && unsafe) status = "FAIL";
  return { status, ok: status !== "FAIL", svg: hasError || (strict && unsafe) ? null : out, viewBox, findings };
}

/** Throws a MotionError when validation fails; returns the sanitized SVG otherwise. */
export function assertSafeSvg(svg, options) {
  const r = validateSvg(svg, options);
  if (!r.ok) {
    const unsafe = r.findings.find((f) => f.severity === "unsafe");
    const first = r.findings.find((f) => f.severity === "error") ?? unsafe;
    throw new MotionError(first?.code ?? ERROR_CODES.SVG_INVALID, first?.message ?? "SVG inválido.", { details: r.findings });
  }
  return r.svg;
}

/**
 * Optimizes an SVG without changing its viewBox/proportions.
 * @param {{prefix?: string, multipass?: boolean, trusted?: boolean}} [options] prefix namespaces ids/refs (avoids collisions when inlining several SVGs).
 */
export function optimizeSvg(svg, { prefix, multipass = true, trusted = false } = {}) {
  const checked = validateSvg(svg, { trusted });
  if (!checked.ok) throw new MotionError(checked.findings[0]?.code ?? ERROR_CODES.SVG_INVALID, checked.findings[0]?.message ?? "SVG inválido.", { details: checked.findings });
  const plugins = [
    // keep id NAMES stable (prefixing needs them) but drop unused/duplicate ids that design tools emit
    { name: "preset-default", params: { overrides: { cleanupIds: { minify: false, remove: true } } } },
    ...(prefix ? [{ name: "prefixIds", params: { prefix, delim: "__" } }] : []),
  ];
  const before = checked.svg.length;
  const data = optimize(checked.svg, { multipass, plugins }).data;
  const after = validateSvg(data, { trusted: true });
  if (after.viewBox && checked.viewBox && after.viewBox.join() !== checked.viewBox.join()) {
    throw new MotionError(ERROR_CODES.SVG_INVALID, "A otimização alterou o viewBox; operação abortada.", { details: { before: checked.viewBox, after: after.viewBox } });
  }
  return { svg: data, bytesBefore: before, bytesAfter: data.length, viewBox: after.viewBox ?? checked.viewBox, findings: checked.findings };
}

/** Rasterizes an SVG to PNG with Chromium, via <img> (scripts and external loads are disabled in that context). */
export async function rasterizeSvg(svg, outputPng, { width, height, scale = 1, background = null } = {}) {
  const { launchBrowser } = await import("../lib/browser.mjs");
  const { mkdir } = await import("node:fs/promises");
  const path = await import("node:path");
  const checked = validateSvg(svg);
  if (!checked.ok) throw new MotionError(checked.findings[0]?.code ?? ERROR_CODES.SVG_INVALID, checked.findings[0]?.message ?? "SVG inválido.", { details: checked.findings });
  const [, , vbw, vbh] = checked.viewBox;
  const w = Math.round(width ?? (height ? (height * vbw) / vbh : vbw));
  const h = Math.round(height ?? (width ? (width * vbh) / vbw : vbh));
  const { browser } = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(checked.svg).toString("base64")}`;
    await page.setContent(`<!doctype html><body style="margin:0;background:${background ?? "transparent"}"><img id="i" src="${dataUrl}" width="${w}" height="${h}" style="display:block"></body>`);
    const ok = await page.evaluate(() => document.getElementById("i").decode().then(() => true, () => false));
    if (!ok) throw new MotionError(ERROR_CODES.SVG_INVALID, "O navegador não conseguiu decodificar o SVG.");
    await mkdir(path.dirname(path.resolve(outputPng)), { recursive: true });
    await page.screenshot({ path: outputPng, omitBackground: background === null });
    return { png: path.resolve(outputPng), width: w * scale, height: h * scale, viewBox: checked.viewBox };
  } finally { await browser.close(); }
}
