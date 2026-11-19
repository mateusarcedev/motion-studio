/**
 * MOTION Core — browser.mjs
 * Single source of truth for locating and validating the Chromium used by every renderer.
 *
 * Rules:
 *  - PASS requires (a) the executable Playwright expects for its installed revision exists
 *    AND (b) a real smoke test (launch → render → evaluate → close) succeeds.
 *  - A leftover `chromium-<other revision>` directory is NOT a pass: it is reported as
 *    BROWSER_VERSION_MISMATCH.
 *  - CHROME_PATH / system Chrome are accepted as "custom" browsers (still smoke-tested) and
 *    reported as WARN because they are not the revision Playwright pinned.
 *  - Nothing is ever installed automatically.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { ERROR_CODES, MotionError } from "./errors.mjs";

const require = createRequire(import.meta.url);

const SYSTEM_BROWSERS = ["/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"];
const SYSTEM_DEPS_PATTERN = /error while loading shared libraries|missing dependencies|install-deps|libnss3|libatk|libgbm|libasound|cannot open shared object/i;

async function exists(p) { try { await stat(p); return true; } catch { return false; } }

export function playwrightBrowsersRoot(env = process.env) {
  if (env.PLAYWRIGHT_BROWSERS_PATH && env.PLAYWRIGHT_BROWSERS_PATH !== "0") return env.PLAYWRIGHT_BROWSERS_PATH;
  if (process.platform === "win32") return path.join(env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "ms-playwright");
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Caches", "ms-playwright");
  return path.join(env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "ms-playwright");
}

/** Reads the Playwright version and the Chromium revision it pins. */
export async function playwrightInfo() {
  let pw;
  try { pw = await import("playwright-core"); } catch (cause) {
    throw new MotionError(ERROR_CODES.BROWSER_MISSING, "A biblioteca Playwright não está instalada.", {
      hint: "Instale as dependências do projeto (npm install).", cause, exitCode: 3,
    });
  }
  const pkgPath = require.resolve("playwright-core/package.json");
  const version = JSON.parse(await readFile(pkgPath, "utf8")).version;
  let revision = null, browserVersion = null;
  try {
    const manifest = JSON.parse(await readFile(path.join(path.dirname(pkgPath), "browsers.json"), "utf8"));
    const entry = manifest.browsers.find((b) => b.name === "chromium");
    revision = entry?.revision ?? null;
    browserVersion = entry?.browserVersion ?? null;
  } catch {}
  const chromium = pw.chromium ?? pw.default?.chromium;
  return { chromium, version, revision, browserVersion, expectedExecutable: chromium.executablePath() };
}

/** Lists Chromium revisions present in the Playwright cache (directory names only). */
async function installedRevisions(root) {
  try {
    return (await readdir(root)).filter((n) => /^chromium-\d+$/.test(n)).map((n) => n.slice("chromium-".length));
  } catch { return []; }
}

/**
 * Locates a browser without launching it.
 * @returns {{kind:"pinned"|"custom", executablePath:string, source:string, playwright:object}}
 * @throws MotionError BROWSER_MISSING | BROWSER_VERSION_MISMATCH
 */
export async function locateBrowser({ env = process.env } = {}) {
  const playwright = await playwrightInfo();
  if (env.CHROME_PATH) {
    if (await exists(env.CHROME_PATH)) return { kind: "custom", executablePath: env.CHROME_PATH, source: "CHROME_PATH", playwright };
    throw new MotionError(ERROR_CODES.BROWSER_MISSING, `CHROME_PATH aponta para um arquivo que não existe: ${env.CHROME_PATH}`, {
      hint: "Corrija ou remova a variável CHROME_PATH.", exitCode: 3,
    });
  }
  if (await exists(playwright.expectedExecutable)) {
    return { kind: "pinned", executablePath: playwright.expectedExecutable, source: "playwright", playwright };
  }
  for (const sys of env.MOTION_DISABLE_SYSTEM_BROWSERS ? [] : SYSTEM_BROWSERS) {
    if (await exists(sys)) return { kind: "custom", executablePath: sys, source: "system", playwright };
  }
  const root = playwrightBrowsersRoot(env);
  const others = await installedRevisions(root);
  const install = "npx playwright install chromium";
  if (others.length) {
    throw new MotionError(ERROR_CODES.BROWSER_VERSION_MISMATCH,
      `O Chromium instalado (revisão ${others.join(", ")}) não é o exigido pelo Playwright ${playwright.version} (revisão ${playwright.revision}).`, {
        hint: `Rode: ${install}`, details: { expectedRevision: playwright.revision, installedRevisions: others, expectedExecutable: playwright.expectedExecutable }, exitCode: 3,
      });
  }
  throw new MotionError(ERROR_CODES.BROWSER_MISSING, "Nenhum Chromium foi encontrado.", {
    hint: `Rode: ${install}`, details: { expectedRevision: playwright.revision, expectedExecutable: playwright.expectedExecutable }, exitCode: 3,
  });
}

/** Real launch → page → evaluate → close. Classifies failures. */
export async function smokeTestBrowser(located, { timeoutMs = 30000, launchArgs = [] } = {}) {
  const { chromium } = located.playwright;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: located.executablePath, headless: true, timeout: timeoutMs, args: launchArgs });
    const page = await browser.newPage();
    await page.setContent("<!doctype html><title>motion-smoke</title><div id=x>ok</div>");
    const out = await page.evaluate(() => document.getElementById("x")?.textContent);
    if (out !== "ok") throw new Error("avaliação de JavaScript retornou valor inesperado");
    const version = browser.version();
    await browser.close();
    return { ok: true, browserVersion: version };
  } catch (cause) {
    try { await browser?.close(); } catch {}
    const text = String(cause?.message ?? cause);
    if (SYSTEM_DEPS_PATTERN.test(text)) {
      throw new MotionError(ERROR_CODES.BROWSER_SYSTEM_DEPS, "O Chromium existe, mas faltam bibliotecas do sistema para executá-lo.", {
        hint: "Rode: npx playwright install-deps chromium (pode exigir sudo)", details: { output: text.slice(0, 600) }, cause, exitCode: 3,
      });
    }
    throw new MotionError(ERROR_CODES.BROWSER_LAUNCH_FAILED, "O Chromium foi encontrado, mas não conseguiu iniciar.", {
      hint: "Reinstale com: npx playwright install chromium — ou aponte CHROME_PATH para outro navegador.",
      details: { executablePath: located.executablePath, output: text.slice(0, 600) }, cause, exitCode: 3,
    });
  }
}

/** Used by renderers: resolves the browser path or throws a structured MotionError (no smoke test; launch errors are classified at launch). */
export async function resolveBrowserExecutable(opts) {
  return (await locateBrowser(opts)).executablePath;
}

/** Wraps chromium.launch so launch failures become structured errors. */
export async function launchBrowser(options = {}, { env = process.env } = {}) {
  const located = await locateBrowser({ env });
  try {
    const browser = await located.playwright.chromium.launch({ executablePath: located.executablePath, headless: true, ...options });
    return { browser, located };
  } catch (cause) {
    const text = String(cause?.message ?? cause);
    if (SYSTEM_DEPS_PATTERN.test(text)) {
      throw new MotionError(ERROR_CODES.BROWSER_SYSTEM_DEPS, "O Chromium existe, mas faltam bibliotecas do sistema para executá-lo.", {
        hint: "Rode: npx playwright install-deps chromium (pode exigir sudo)", details: { output: text.slice(0, 600) }, cause, exitCode: 3,
      });
    }
    throw new MotionError(ERROR_CODES.BROWSER_LAUNCH_FAILED, "O Chromium foi encontrado, mas não conseguiu iniciar.", {
      hint: "Rode `motion doctor` para diagnosticar.", details: { executablePath: located.executablePath, output: text.slice(0, 600) }, cause, exitCode: 3,
    });
  }
}

/** Doctor-facing diagnosis: never throws; returns a status object. */
export async function diagnoseBrowser(opts = {}) {
  let located;
  try { located = await locateBrowser(opts); } catch (err) {
    if (err instanceof MotionError) return { status: "FAIL", code: err.code, message: err.message, hint: err.hint, details: err.details };
    return { status: "FAIL", code: ERROR_CODES.BROWSER_MISSING, message: String(err?.message ?? err), hint: null };
  }
  try {
    const smoke = await smokeTestBrowser(located, { timeoutMs: opts.timeoutMs ?? 30000 });
    const pw = located.playwright;
    if (located.kind === "pinned") {
      return { status: "PASS", code: null, browserVersion: smoke.browserVersion, executablePath: located.executablePath, playwrightVersion: pw.version, revision: pw.revision,
        message: `Chromium ${smoke.browserVersion} (revisão ${pw.revision}) inicia e renderiza corretamente.` };
    }
    return { status: "WARN", code: ERROR_CODES.BROWSER_UNSUPPORTED, browserVersion: smoke.browserVersion, executablePath: located.executablePath, playwrightVersion: pw.version, revision: pw.revision,
      message: `Navegador personalizado (${located.source}) ${smoke.browserVersion} funciona, mas não é a revisão ${pw.revision} fixada pelo Playwright ${pw.version}.`,
      hint: "Para a revisão homologada: npx playwright install chromium (e remova CHROME_PATH)." };
  } catch (err) {
    return { status: "FAIL", code: err.code, message: err.message, hint: err.hint, details: err.details, executablePath: located.executablePath };
  }
}
