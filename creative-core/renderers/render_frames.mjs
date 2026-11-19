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
const sampleFrames = args["sample-frames"] === undefined ? null : String(args["sample-frames"]).split(",").map(Number);
if (!Number.isInteger(totalFrames) || totalFrames < 1 || !Number.isFinite(fps) || fps <= 0 || !Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
  console.error("frames, fps, width e height devem ser valores positivos válidos.");
  process.exit(2);
}

if (!input || !outdir) {
  console.error("uso: render_frames.mjs <input.html> <outdir> --frames=N [--fps=30] [--width=W] [--height=H]");
  process.exit(2);
}

await mkdir(outdir, { recursive: true });

// ---- resolve chromium ----
async function resolveChrome() {
  if (process.env.CHROME_PATH) {
    try { await stat(process.env.CHROME_PATH); return process.env.CHROME_PATH; } catch {}
  }
  try {
    const pw = await import("playwright-core");
    const execPath = pw.chromium.executablePath();
    if (execPath) {
      try { await stat(execPath); return execPath; } catch {}
    }
  } catch {}
  const cacheBase = `${process.env.HOME}/.cache/ms-playwright`;
  try {
    const entries = await readdir(cacheBase);
    for (const ent of entries) {
      if (ent.startsWith("chromium-")) {
        const candidate = path.join(cacheBase, ent, "chrome-linux64", "chrome");
        try { await stat(candidate); return candidate; } catch {}
      }
    }
  } catch {}
  for (const sys of ["/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"]) {
    try { await stat(sys); return sys; } catch {}
  }
  return null;
}

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
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const { chromium } = await import("playwright-core");
const executablePath = await resolveChrome();
if (!executablePath) {
  console.error("Chromium não encontrado (defina CHROME_PATH ou instale via npx playwright install chromium).");
  process.exit(3);
}

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
});
const browserVersion = browser.version();

const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: scale,
});
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") pageErrors.push(message.text()); });

await page.addInitScript((init) => {
  window.__MOTION_DRIVEN__ = true;
  window.__MOTION__ = init;
}, {
  fps,
  totalFrames,
  seed,
  frame: 0,
  time: 0,
  progress: 0,
});

const url = `http://127.0.0.1:${port}/`;
await page.goto(url, { waitUntil: "load" });

await page.evaluate(() => Promise.all([
  document.fonts.ready,
  Promise.all(Array.from(document.images).map((img) =>
    img.complete && img.naturalWidth > 0 ? Promise.resolve() :
    new Promise((res) => { img.onload = img.onerror = res; })))
]));
const fontMetadata = await page.evaluate(() => ({
  status: document.fonts.status,
  faces: Array.from(document.fonts).map((face) => ({ family: face.family, style: face.style, weight: face.weight, status: face.status })),
}));

const startTime = Date.now();
let renderedCount = 0;
const frameIndexes = sampleFrames ?? Array.from({ length: Math.max(0, endFrame - startFrame + 1) }, (_, i) => startFrame + i);
if (!frameIndexes.length || frameIndexes.some((f) => !Number.isInteger(f) || f < 0 || f >= totalFrames) || new Set(frameIndexes).size !== frameIndexes.length) {
  await browser.close(); server.close();
  console.error(`Amostras devem ser quadros únicos entre 0 e ${totalFrames - 1}.`);
  process.exit(2);
}

for (const f of frameIndexes) {
  const t = f / fps;
  const progress = totalFrames > 0 ? f / totalFrames : 0;
  
  await page.evaluate(async (state) => {
    window.__MOTION__ = {
      frame: state.f,
      time: state.t,
      progress: state.progress,
      fps: state.fps,
      totalFrames: state.totalFrames,
      seed: state.seed,
    };
    if (typeof window.__onFrame__ === "function") await window.__onFrame__(window.__MOTION__);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, { f, t, progress, fps, totalFrames, seed });

  const frameFileName = `${String(f).padStart(4, "0")}.png`;
  const framePath = path.join(outdir, frameFileName);
  await page.screenshot({ path: framePath, omitBackground: Boolean(args.transparent) });
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
  renderedCount++;

  if (renderedCount % 60 === 0 || f === endFrame) {
    const elapsed = (Date.now() - startTime) / 1000;
    const fpsRate = (renderedCount / elapsed).toFixed(1);
    process.stderr.write(`[render_frames] Frame ${f}/${endFrame} (${fpsRate} fps)\r`);
  }
}
process.stderr.write("\n");

await browser.close();
server.close();

const totalSec = (Date.now() - startTime) / 1000;
const payload = {
  status: "OK",
  input: inputAbs,
  outdir: path.resolve(outdir),
  framesRendered: renderedCount,
  totalFrames,
  fps,
  width,
  height,
  scale,
  seed,
  browserVersion,
  fonts: fontMetadata,
  pageErrors,
  transparent: Boolean(args.transparent),
  sampleFrames: frameIndexes,
  inspectBounds: Boolean(args["inspect-bounds"]),
  durationSec: totalSec.toFixed(2),
  renderFps: (renderedCount / totalSec).toFixed(1),
};

console.log(JSON.stringify(payload, null, 2));
