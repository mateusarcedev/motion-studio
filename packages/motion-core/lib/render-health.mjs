/**
 * MOTION Core — render-health.mjs
 * Observes a Playwright page during a render and decides whether the result can be trusted.
 *
 * A PNG/MP4 existing does not mean the render is right. This monitor turns JavaScript
 * errors, failed module imports, broken/failed assets and a missing animation controller
 * into structured findings with severity:
 *   - "error"   → blocks approval (status FAIL)
 *   - "warning" → reported, does not block (status WARN)
 */
import { ERROR_CODES } from "./errors.mjs";

const MODULE_IMPORT_PATTERN = /Failed to resolve module specifier|Failed to fetch dynamically imported module|error loading dynamically imported module|Cannot use import statement outside a module|Importing a module script failed|does not provide an export named|Unexpected token 'export'/i;
const IGNORED_URL = /\/favicon\.ico(?:$|\?)/i;
const FONT_URL = /\.(?:woff2?|ttf|otf)(?:$|\?)/i;
const BLOCKING_TYPES = new Set(["script", "stylesheet", "image", "media", "fetch", "xhr", "document"]);

function compilePatterns(list = []) {
  return list.filter(Boolean).map((p) => (p instanceof RegExp ? p : new RegExp(String(p).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*"))));
}

/**
 * @param {import("playwright-core").Page} page
 * @param {{ optionalAssets?: (string|RegExp)[], origin?: string }} [options]
 */
export function createHealthMonitor(page, { optionalAssets = [], origin = null } = {}) {
  const optional = compilePatterns(optionalAssets);
  const findings = [];
  const pageErrors = [];
  const consoleErrors = [];
  const seen = new Set();
  let frame = null;

  const isOptional = (url) => optional.some((re) => re.test(url));
  const add = (finding) => {
    const key = `${finding.code}|${finding.url ?? ""}|${finding.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ frame, ...finding });
  };

  page.on("pageerror", (error) => {
    const message = error?.message ?? String(error);
    pageErrors.push(message);
    add({
      severity: "error",
      code: MODULE_IMPORT_PATTERN.test(message) ? ERROR_CODES.RENDER_MODULE_IMPORT : ERROR_CODES.RENDER_PAGE_ERROR,
      message: MODULE_IMPORT_PATTERN.test(message)
        ? `Um módulo JavaScript não pôde ser carregado: ${message}`
        : `Erro de JavaScript na composição: ${message}`,
      hint: MODULE_IMPORT_PATTERN.test(message)
        ? "Use caminhos relativos/absolutos válidos (ex.: ./frame.js) em vez de nomes soltos, ou um import map."
        : "Corrija o erro no script da composição e renderize novamente.",
    });
  });

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    consoleErrors.push(text);
    // "Failed to load resource" is reported precisely through response/requestfailed.
    if (/^Failed to load resource/i.test(text)) return;
    pageErrors.push(text);
    add({
      severity: MODULE_IMPORT_PATTERN.test(text) ? "error" : "warning",
      code: MODULE_IMPORT_PATTERN.test(text) ? ERROR_CODES.RENDER_MODULE_IMPORT : ERROR_CODES.RENDER_PAGE_ERROR,
      message: `console.error: ${text}`,
    });
  });

  const assetFinding = (url, resourceType, reason) => {
    if (!url || IGNORED_URL.test(url) || /^(?:data|blob):/i.test(url)) return;
    const isFont = FONT_URL.test(url) || resourceType === "font";
    const blocking = BLOCKING_TYPES.has(resourceType) && !isFont && !isOptional(url);
    add({
      severity: blocking ? "error" : "warning",
      code: ERROR_CODES.RENDER_ASSET_FAILED,
      resourceType,
      url,
      optional: isOptional(url),
      message: `${isFont ? "Fonte" : "Recurso"} não carregou (${reason}): ${url}`,
      hint: isFont ? "A tipografia caiu para uma fonte padrão; embuta ou hospede a fonte localmente." : "Verifique o caminho/URL do arquivo ou marque como opcional (data-optional).",
    });
  };

  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText ?? "falha de rede";
    if (/ERR_ABORTED/.test(reason)) return;
    assetFinding(request.url(), request.resourceType(), reason);
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400) assetFinding(response.url(), response.request().resourceType(), `HTTP ${status}`);
  });

  return {
    setFrame(value) { frame = value; },
    /** Number of blocking findings so far (for fail-fast loops). */
    errorCount() { return findings.filter((f) => f.severity === "error").length; },
    pageErrors,
    consoleErrors,
    addFinding: add,

    /** Checks <img> elements, SVG <image>, and the animation controller. */
    async inspect({ requireController = false } = {}) {
      const images = await page.evaluate(async () => {
        const out = [];
        for (const img of Array.from(document.images)) {
          if (!img.currentSrc && !img.src) continue;
          const optionalAttr = Boolean(img.closest("[data-optional], [data-motion-optional]"));
          let ok = img.complete && img.naturalWidth > 0;
          if (!ok && img.complete) {
            // SVG without intrinsic size can report 0; decode() tells the truth.
            try { await img.decode(); ok = true; } catch { ok = false; }
          }
          if (!ok) out.push({ src: img.currentSrc || img.src, alt: img.alt || null, optional: optionalAttr });
        }
        return out;
      });
      // Resources used only by elements marked data-optional are non-blocking.
      const optionalUrls = new Set(await page.evaluate(() => {
        const urls = [];
        for (const el of document.querySelectorAll("[data-optional], [data-motion-optional]")) {
          for (const node of [el, ...el.querySelectorAll("[src], image")]) {
            const u = node.currentSrc || node.src || node.href?.baseVal;
            if (u) urls.push(new URL(u, location.href).href);
          }
        }
        return urls;
      }));
      for (const f of findings) {
        if (f.severity === "error" && f.code === ERROR_CODES.RENDER_ASSET_FAILED && f.url && optionalUrls.has(f.url)) {
          f.severity = "warning";
          f.optional = true;
        }
      }
      for (const img of images) {
        const opt = img.optional || isOptional(img.src);
        add({
          severity: opt ? "warning" : "error",
          code: ERROR_CODES.RENDER_ASSET_FAILED,
          resourceType: "image",
          url: img.src,
          optional: opt,
          message: `Imagem quebrada ou inválida: ${img.src}`,
          hint: "Corrija o arquivo/URL da imagem. Se for decorativa, marque o elemento com data-optional.",
        });
      }
      const hasController = await page.evaluate(() => typeof window.__onFrame__ === "function");
      if (requireController && !hasController) {
        add({
          severity: "error",
          code: ERROR_CODES.RENDER_CONTROLLER_MISSING,
          message: "A composição não registrou o controlador de animação (window.__onFrame__). O resultado seria um quadro parado.",
          hint: "Use createMotionDriver() de @technomanceer/motion-core/frame ou defina window.__onFrame__ = (state) => { ... }.",
        });
      }
      return { brokenImages: images, hasController };
    },

    /** Final verdict. */
    summary() {
      const errors = findings.filter((f) => f.severity === "error");
      const warnings = findings.filter((f) => f.severity === "warning");
      return {
        status: errors.length ? "FAIL" : warnings.length ? "WARN" : "OK",
        errors,
        warnings,
        errorCodes: [...new Set(errors.map((e) => e.code))],
      };
    },
  };
}

/** Parses `--optional-assets=a,b` (glob-ish with *) into an array. */
export function parseOptionalAssets(value) {
  if (!value || value === true) return [];
  return String(value).split(",").map((s) => s.trim()).filter(Boolean);
}
