#!/usr/bin/env node
/**
 * MOTION — render_frames.mjs
 * Renderizador de frames em lote (batch, 1 browser instance, N frames).
 * Garante determinismo total: frame N reproduz bit a bit com CFR 30fps.
 *
 * Uso:
 *   node creative-core/renderers/render_frames.mjs <input.html> <outdir> \
 *     --frames=450 [--fps=30] [--width=1080] [--height=1920] [--scale=1] [--seed=1]
 */
import { createServer } from "node:http";
import { readFile, stat, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "../lib/browser.mjs";
import { ERROR_CODES, MotionError, reportError } from "../lib/errors.mjs";
import { parseFrameSelection, frameFileName } from "../lib/frames.mjs";
import { createHealthMonitor, parseOptionalAssets } from "../lib/render-health.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));

const input = args._1 ?? process.argv[2];
const outdir = args._2 ?? process.argv[3];
const totalFrames = Number(args.frames ?? args.totalFrames ?? 450);
const fps = Number(args.fps ?? 30);
const width = Number(args.width ?? 1080);
const height = Number(args.height ?? 1920);
const scale = Number(args.scale ?? 1);
const seed = Number(args.seed ?? 1);
const startFrame = Number(args.start ?? 0);
const endFrame = args.end !== undefined ? Number(args.end) : totalFrames - 1;
const sampleSpec = args["sample-frames"] ?? args.sampleFrames;
if (!Number.isInteger(totalFrames) || totalFrames < 1 || !Number.isFinite(fps) || fps <= 0 || !Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
  console.error("frames, fps, width e height devem ser valores positivos válidos.");
  process.exit(2);
}

if (!input || !outdir) {
  console.error("uso: render_frames.mjs <input.html> <outdir> --frames=N [--fps=30] [--width=W] [--height=H]");
  process.exit(2);
}

await mkdir(outdir, { recursive: true });

// ---- local server ----
const inputAbs = path.resolve(input);
const rootDir = path.dirname(inputAbs);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }
    let p;
    if (url.pathname === "/") {
      p = inputAbs;
    } else if (url.pathname.startsWith("/creative-core/")) {
      p = path.join(repoRoot, decodeURIComponent(url.pathname));
    } else {
      p = path.join(rootDir, decodeURIComponent(url.pathname));
      try {
        await stat(p);
      } catch {
        // fallback to repoRoot
        p = path.join(repoRoot, decodeURIComponent(url.pathname));
      }
    }

    const data = await readFile(p);
    const ext = path.extname(p).slice(1);
    const types = {
      html: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript",
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
      svg: "image/svg+xml", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf",
      otf: "font/otf", json: "application/json", glb: "model/gltf-binary", gltf: "model/gltf+json"
    };
    res.writeHead(200, { "content-type": types[ext] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}

const server = createServer(handler);

function failPayload(error) {
  const exitCode = reportError(error);
  console.log(JSON.stringify({ status: "FAIL", error: error instanceof MotionError ? error.toJSON() : { code: "MOTION_UNEXPECTED", message: error?.message ?? String(error) } }, null, 2));
  return exitCode;
}

async function main() {
  // ---- frame selection (validated before opening any browser) ----
  let frameIndexes;
  if (sampleSpec !== undefined) {
    frameIndexes = parseFrameSelection(sampleSpec, totalFrames);
  } else {
    if (!Number.isInteger(startFrame) || !Number.isInteger(endFrame) || startFrame < 0 || endFrame >= totalFrames || startFrame > endFrame) {
      throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, `Intervalo de quadros inválido (--start=${startFrame}, --end=${endFrame}, --frames=${totalFrames}).`, {
        hint: `Use 0 <= start <= end <= ${totalFrames - 1}.`, exitCode: 2,
      });
    }
    frameIndexes = Array.from({ length: endFrame - startFrame + 1 }, (_, i) => startFrame + i);
  }

  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const { browser } = await launchBrowser({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  try {
    const browserVersion = browser.version();
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
    const monitor = createHealthMonitor(page, { optionalAssets: parseOptionalAssets(args["optional-assets"]) });

    await page.addInitScript((init) => {
      window.__MOTION_DRIVEN__ = true;
      window.__MOTION__ = init;
    }, { fps, totalFrames, seed, frame: 0, time: 0, progress: 0 });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
    await page.evaluate(() => Promise.all([
      document.fonts.ready,
      Promise.all(Array.from(document.images).map((img) =>
        img.complete ? Promise.resolve() :
        new Promise((res) => { img.onload = img.onerror = res; }))),
    ]));
    try {
      await page.evaluate(async () => { if (window.__MOTION_READY__) await window.__MOTION_READY__; });
    } catch (error) {
      monitor.addFinding({ severity: "error", code: ERROR_CODES.RENDER_PAGE_ERROR, message: `window.__MOTION_READY__ falhou: ${error.message}` });
    }
    const fontMetadata = await page.evaluate(() => ({
      status: document.fonts.status,
      faces: Array.from(document.fonts).map((face) => ({ family: face.family, style: face.style, weight: face.weight, status: face.status })),
    }));
    for (const face of fontMetadata.faces) {
      if (face.status === "error") monitor.addFinding({ severity: "warning", code: ERROR_CODES.RENDER_ASSET_FAILED, resourceType: "font", message: `Fonte "${face.family}" não carregou.` });
    }
    const requireController = !args["allow-no-controller"];
    await monitor.inspect({ requireController });

    const startTime = Date.now();
    const produced = [];
    if (monitor.errorCount() === 0) {
      for (const f of frameIndexes) {
        const t = f / fps;
        const progress = totalFrames > 0 ? f / totalFrames : 0;
        monitor.setFrame(f);
        try {
          await page.evaluate(async (state) => {
            window.__MOTION__ = { frame: state.f, time: state.t, progress: state.progress, fps: state.fps, totalFrames: state.totalFrames, seed: state.seed };
            if (typeof window.__onFrame__ === "function") await window.__onFrame__(window.__MOTION__);
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          }, { f, t, progress, fps, totalFrames, seed });
        } catch (error) {
          monitor.addFinding({ severity: "error", code: ERROR_CODES.RENDER_PAGE_ERROR, message: `__onFrame__ falhou no quadro ${f}: ${error.message}`, hint: "Corrija o erro de JavaScript do controlador de animação." });
        }
        if (monitor.errorCount() > 0) break; // fail fast: do not spend time rendering a broken composition

        const framePath = path.join(outdir, frameFileName(f));
        await page.screenshot({ path: framePath, omitBackground: Boolean(args.transparent) });
        produced.push(f);
        if (args["inspect-bounds"]) {
          const bounds = await page.evaluate((state) => {
            const elements = Array.from(document.querySelectorAll("[data-motion-important]")).map((element) => {
              const rect = element.getBoundingClientRect();
              let opacity = 1;
              for (let parent = element; parent && parent !== document.documentElement; parent = parent.parentElement) {
                const value = Number.parseFloat(getComputedStyle(parent).opacity);
                if (Number.isFinite(value)) opacity *= value;
              }
              return {
                id: element.getAttribute("data-motion-important"),
                x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                visible: opacity > 0.02 && rect.width > 0 && rect.height > 0,
                opacity,
                alt: element.getAttribute("data-motion-alt") ?? null,
              };
            });
            return { frame: state.f, time: state.t, viewport: { width: innerWidth, height: innerHeight }, fonts: { status: document.fonts.status }, elements };
          }, { f, t, fps });
          await writeFile(path.join(outdir, `${String(f).padStart(4, "0")}.bounds.json`), JSON.stringify(bounds, null, 2));
        }
        if (produced.length % 60 === 0 || f === frameIndexes[frameIndexes.length - 1]) {
          const elapsed = (Date.now() - startTime) / 1000;
          process.stderr.write(`[render_frames] Frame ${f} (${(produced.length / elapsed).toFixed(1)} fps)\r`);
        }
      }
      process.stderr.write("\n");
      // final inspection catches late failures (assets requested during the animation, late errors)
      monitor.setFrame(null);
      await monitor.inspect({ requireController: false });
    }

    // requested vs produced must match exactly
    const missing = [];
    for (const f of produced) { try { await stat(path.join(outdir, frameFileName(f))); } catch { missing.push(f); } }
    const summary = monitor.summary();
    if (summary.status !== "FAIL" && (produced.length !== frameIndexes.length || missing.length)) {
      summary.errors.push({ severity: "error", code: ERROR_CODES.RENDER_PAGE_ERROR, message: `Quadros solicitados (${frameIndexes.length}) e produzidos (${produced.length - missing.length}) divergem.` });
      summary.status = "FAIL";
    }

    const totalSec = (Date.now() - startTime) / 1000;
    const payload = {
      status: summary.status,
      input: inputAbs,
      outdir: path.resolve(outdir),
      framesRendered: produced.length,
      framesRequested: frameIndexes.length,
      totalFrames,
      fps, width, height, scale, seed,
      browserVersion,
      fonts: fontMetadata,
      pageErrors: monitor.pageErrors,
      health: { errors: summary.errors, warnings: summary.warnings, errorCodes: summary.errorCodes },
      transparent: Boolean(args.transparent),
      sampleFrames: sampleSpec !== undefined ? frameIndexes : null,
      producedFrames: produced,
      inspectBounds: Boolean(args["inspect-bounds"]),
      durationSec: totalSec.toFixed(2),
      renderFps: (produced.length / Math.max(totalSec, 0.001)).toFixed(1),
    };
    console.log(JSON.stringify(payload, null, 2));
    if (summary.status === "FAIL") {
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
