#!/usr/bin/env node
/**
 * MOTION — render_static.mjs
 * Renderizador estático do estúdio: HTML/CSS → PNG via Chromium (Playwright).
 * Agnóstico de agente: qualquer agente (ou humano) roda `node creative-core/renderers/render_static.mjs ...`
 *
 * Uso:
 *   node creative-core/renderers/render_static.mjs <input.html> <output.png> \
 *     --width=1080 --height=1350 --scale=2 [--wait=800] [--full-page]
 *
 * Contrato de saída: salva o PNG e imprime JSON de QA no stdout:
 *   { png, width, height, deviceScaleFactor, overflow: [...], fontIssues: [...], status }
 *
 * Regras do contrato (CLAUDE.md):
 *   - Espera document.fonts.ready e todas as imagens carregarem antes de capturar.
 *   - deviceScaleFactor nativo — nunca amplia screenshot de baixa resolução.
 *   - Detecta overflow (scrollWidth/Height > viewport, elementos fora do box) e reporta.
 *   - Fontes remotas faltando são reportadas como fontIssues.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true];
}));
const input = args._1 ?? process.argv[2];
const output = args._2 ?? process.argv[3];
const width = Number(args.width) || 1080;
const height = Number(args.height) || 1350;
const scale = Number(args.scale) || 2;
const frame = args.frame !== undefined ? Number(args.frame) : undefined;
const time = args.time !== undefined ? Number(args.time) : undefined;
const seed = args.seed !== undefined ? Number(args.seed) : undefined;
const extraWait = frame !== undefined ? 0 : Number(args.wait ?? 300);
const overrides = Object.fromEntries(Object.entries(args)
  .filter(([k, v]) => k.startsWith("var") && k !== "vars" && v !== undefined && typeof v === "string")
  .map(([k, v]) => [k.slice(4), v]));

if (!input || !output) {
  console.error("uso: render_static.mjs <input.html> <output.png> --width=W --height=H --scale=N");
  process.exit(2);
}

// ---- resolve chromium (cache do playwright, env, ou padrões do sistema) ----
async function resolveChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
  ].filter(Boolean);
  for (const c of candidates) { try { await stat(c); return c; } catch {} }
  return null;
}

// ---- servidor local (evita restrições de file:// com assets relativos) ----
const rootDir = path.dirname(path.resolve(input));
async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    let p = path.join(rootDir, decodeURIComponent(url.pathname === "/" ? path.basename(input) : url.pathname));
    if (url.pathname === "/") p = path.resolve(input);
    const data = await readFile(p);
    const ext = path.extname(p).slice(1);
    const types = { html:"text/html", css:"text/css", js:"text/javascript", png:"image/png", jpg:"image/jpeg",
      jpeg:"image/jpeg", webp:"image/webp", svg:"image/svg+xml", woff:"font/woff", woff2:"font/woff2", ttf:"font/ttf", otf:"font/otf", json:"application/json" };
    res.writeHead(200, { "content-type": types[ext] ?? "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404); res.end("not found"); }
}
const server = createServer(handler);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

let { chromium } = await import("playwright-core");
const executablePath = await resolveChrome();
if (!executablePath) { console.error("Chromium não encontrado (defina CHROME_PATH)."); process.exit(3); }

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: scale,
});
const fontWaits = [];
page.on("requestfailed", (r) => {
  const u = r.url();
  if (/\.(woff2?|ttf|otf)/.test(u)) fontWaits.push(u);
});

const url = `http://127.0.0.1:${port}/${path.basename(input)}`;

// Injeção determinística: injeta estado alvo (frame/time/seed).
// Para composições frame-driven, o renderer controla quando __onFrame__ é chamado.
// A composição NÃO deve auto-chamar __onFrame__ no load (usa window.__MOTION_DRIVEN__).
const isFrameDriven = frame !== undefined || time !== undefined;
await page.addInitScript((state) => {
  window.__MOTION__ = state;
  window.__MOTION__.fps = state.fps ?? 30;
  window.__MOTION__.progress = (state.frame != null && state.totalFrames)
    ? state.frame / state.totalFrames : null;
  window.__MOTION_DRIVEN__ = true;
}, {
  frame: frame ?? 0,
  time: time ?? null,
  seed: seed ?? null,
  fps: args.fps ? Number(args.fps) : 30,
  totalFrames: args.frames ? Number(args.frames) : undefined,
  vars: overrides,
});

await page.goto(url, { waitUntil: "load" });
await page.evaluate(() => Promise.all([
  document.fonts.ready,
  Promise.all(Array.from(document.images).map((img) =>
    img.complete && img.naturalWidth > 0 ? Promise.resolve() :
    new Promise((res) => { img.onload = img.onerror = res; }))),
]));
await page.waitForTimeout(extraWait);

// Executar __onFrame__ UMA VEZ com o estado correto
const motionState = await page.evaluate(() => {
  if (typeof window.__onFrame__ === "function") {
    window.__onFrame__(window.__MOTION__);
    return true;
  }
  return false;
});

// ---- QA: overflow (elementos com data-bleed são sangria decorativa intencional) ----
const overflow = await page.evaluate(() => {
  const issues = [];
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  const isBleed = (el) => el && el.closest("[data-bleed]");
  const outside = [];
  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > vw + 2 || r.bottom > vh + 2 || r.left < -2 || r.top < -2) {
      if (isBleed(el)) continue;
      const tag = el.tagName.toLowerCase();
      const cls = typeof el.className === "string" ? el.className.split(" ")[0] : "";
      outside.push({ type: "element-outside-frame", detail: { tag, cls, right: Math.round(r.right), bottom: Math.round(r.bottom), left: Math.round(r.left), top: Math.round(r.top) } });
    }
  }
  issues.push(...outside);
  // scroll global só importa se houver conteúdo essencial fora do frame (não apenas sangria)
  if (outside.length > 0 || document.documentElement.scrollWidth > vw + 1) {
    if (outside.length > 0 && document.documentElement.scrollWidth > vw + 1)
      issues.push({ type: "horizontal-scroll", detail: { scrollWidth: document.documentElement.scrollWidth, viewport: vw } });
    if (outside.length > 0 && document.documentElement.scrollHeight > vh + 1)
      issues.push({ type: "vertical-scroll", detail: { scrollHeight: document.documentElement.scrollHeight, viewport: vh } });
  }
  return issues.slice(0, 12);
});

const absOutput = path.resolve(output);
await page.screenshot({ path: absOutput, fullPage: Boolean(args["full-page"]) });
await browser.close();
server.close();

const payload = {
  png: absOutput, width, height, deviceScaleFactor: scale,
  motion: { frame: frame ?? null, time: time ?? null, seed: seed ?? null, fps: args.fps ? Number(args.fps) : 30, replayed: motionState },
  overflow,
  fontIssues: fontWaits,
  status: overflow.length === 0 && fontWaits.length === 0 ? "OK" : "WARN",
};
console.log(JSON.stringify(payload, null, 2));
