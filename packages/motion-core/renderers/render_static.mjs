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
import { launchBrowser } from "../lib/browser.mjs";
import { ERROR_CODES, MotionError, reportError } from "../lib/errors.mjs";
import { createHealthMonitor, parseOptionalAssets } from "../lib/render-health.mjs";
import { createStaticServer } from "../lib/static-server.mjs";
import { collectDomChecks } from "../lib/dom-checks.mjs";

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

// ---- servidor local (compartilhado: import map + montagem /@motion) ----
const { server, listen } = createStaticServer(input);

function failPayload(error) {
  const exitCode = reportError(error);
  console.log(JSON.stringify({ status: "FAIL", error: error instanceof MotionError ? error.toJSON() : { code: "MOTION_UNEXPECTED", message: error?.message ?? String(error) } }, null, 2));
  return exitCode;
}

async function main() {
  const port = await listen();
  const { browser } = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
    const monitor = createHealthMonitor(page, { optionalAssets: parseOptionalAssets(args["optional-assets"]) });
    const url = `http://127.0.0.1:${port}/${path.basename(input)}`;

    // Injeção determinística: injeta estado alvo (frame/time/seed).
    // A composição NÃO deve auto-chamar __onFrame__ no load (usa window.__MOTION_DRIVEN__).
    await page.addInitScript((state) => {
      window.__MOTION__ = state;
      window.__MOTION__.fps = state.fps ?? 30;
      window.__MOTION__.progress = (state.frame != null && state.totalFrames) ? state.frame / state.totalFrames : null;
      window.__MOTION_DRIVEN__ = true;
    }, {
      frame: frame ?? 0, time: time ?? null, seed: seed ?? null,
      fps: args.fps ? Number(args.fps) : 30,
      totalFrames: args.frames ? Number(args.frames) : undefined,
      vars: overrides,
    });

    await page.goto(url, { waitUntil: "load" });
    await page.evaluate(() => Promise.all([
      document.fonts.ready,
      Promise.all(Array.from(document.images).map((img) =>
        img.complete ? Promise.resolve() :
        new Promise((res) => { img.onload = img.onerror = res; }))),
    ]));
    await page.waitForTimeout(extraWait);

    // Executar __onFrame__ UMA VEZ com o estado correto
    let motionState = false;
    try {
      motionState = await page.evaluate(async () => {
        if (window.__MOTION_READY__) await window.__MOTION_READY__;
        await document.fonts.ready;
        if (typeof window.__onFrame__ === "function") {
          await window.__onFrame__(window.__MOTION__);
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          return true;
        }
        return false;
      });
    } catch (error) {
      monitor.addFinding({ severity: "error", code: ERROR_CODES.RENDER_PAGE_ERROR, message: `O controlador de animação falhou: ${error.message}`, hint: "Corrija o erro de JavaScript do controlador (window.__onFrame__)." });
    }
    const frameDriven = frame !== undefined || time !== undefined;
    await monitor.inspect({ requireController: frameDriven || Boolean(args["require-controller"]) });

    const fontState = await page.evaluate(() => ({ status: document.fonts.status, faces: Array.from(document.fonts).map((face) => ({ family: face.family, style: face.style, weight: face.weight, status: face.status })) }));

    // ---- QA: overflow (elementos com data-bleed são sangria decorativa intencional) ----
    const overflow = await page.evaluate(() => {
      const issues = [];
      const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
      const isBleed = (el) => el && el.closest("[data-bleed]");
      const outside = [];
      for (const el of document.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
    if (el.tagName === "BR" || el.tagName === "WBR") continue; // line-break elements have no visual extent of their own
        if (r.right > vw + 2 || r.bottom > vh + 2 || r.left < -2 || r.top < -2) {
          if (isBleed(el)) continue;
          const tag = el.tagName.toLowerCase();
          const cls = typeof el.className === "string" ? el.className.split(" ")[0] : "";
          outside.push({ type: "element-outside-frame", detail: { tag, cls, right: Math.round(r.right), bottom: Math.round(r.bottom), left: Math.round(r.left), top: Math.round(r.top) } });
        }
      }
      issues.push(...outside);
      if (outside.length > 0 || document.documentElement.scrollWidth > vw + 1) {
        if (outside.length > 0 && document.documentElement.scrollWidth > vw + 1)
          issues.push({ type: "horizontal-scroll", detail: { scrollWidth: document.documentElement.scrollWidth, viewport: vw } });
        if (outside.length > 0 && document.documentElement.scrollHeight > vh + 1)
          issues.push({ type: "vertical-scroll", detail: { scrollHeight: document.documentElement.scrollHeight, viewport: vh } });
      }
      return issues.slice(0, 12);
    });

    const qaContext = args["qa-context"] || "graphic";
    const safeZone = qaContext === "story-vertical"
      ? { top: height * 0.12, right: width * 0.05, bottom: height * 0.18, left: width * 0.05 }
      : qaContext === "video-vertical"
        ? { top: height * 0.15, right: width * 0.05, bottom: height * 0.2, left: width * 0.05 }
        : null;
    const visual = args["qa-visual"] ? await collectDomChecks(page, { context: qaContext, safeZone }) : null;
    const summary = monitor.summary();
    const fontIssues = summary.warnings.filter((w) => w.resourceType === "font" || /\.(woff2?|ttf|otf)/.test(w.url ?? "")).map((w) => w.url ?? w.message);
    const absOutput = path.resolve(output);
    await page.screenshot({ path: absOutput, fullPage: Boolean(args["full-page"]) });

    const fontsOk = fontState.status === "loaded" && fontState.faces.every((face) => face.status === "loaded");
    const status = summary.status === "FAIL" ? "FAIL"
      : (summary.status === "WARN" || overflow.length || fontIssues.length || !fontsOk
        || (visual && (visual.clipped.length || visual.lowContrast.length || visual.tiny.length || visual.secondaryTiny.length || visual.overlap.length || visual.outsideSafeZone.length || visual.textOverload))) ? "WARN" : "OK";
    const payload = {
      png: absOutput, width, height, deviceScaleFactor: scale,
      motion: { frame: frame ?? null, time: time ?? null, seed: seed ?? null, fps: args.fps ? Number(args.fps) : 30, replayed: motionState },
      overflow,
      fontIssues,
      fonts: fontState,
      pageErrors: monitor.pageErrors,
      visual,
      health: { errors: summary.errors, warnings: summary.warnings, errorCodes: summary.errorCodes },
      status,
    };
    console.log(JSON.stringify(payload, null, 2));
    if (status === "FAIL") {
      for (const e of summary.errors) console.error(`❌ [${e.code}] ${e.message}${e.hint ? `\n   → ${e.hint}` : ""}`);
      return 4;
    }
    return 0;
  } finally {
    await browser.close().catch(() => {});
  }
}

let exitCode = 0;
try { exitCode = await main(); } catch (error) { exitCode = failPayload(error); } finally { server.close(); }
process.exit(exitCode);
