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
import { readFile, stat, mkdir, readdir } from "node:fs/promises";
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

const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: scale,
});

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

const startTime = Date.now();
let renderedCount = 0;

for (let f = startFrame; f <= endFrame; f++) {
  const t = f / fps;
  const progress = totalFrames > 0 ? f / totalFrames : 0;
  
  await page.evaluate((state) => {
    window.__MOTION__ = {
      frame: state.f,
      time: state.t,
      progress: state.progress,
      fps: state.fps,
      totalFrames: state.totalFrames,
      seed: state.seed,
    };
    if (typeof window.__onFrame__ === "function") {
      window.__onFrame__(window.__MOTION__);
    }
  }, { f, t, progress, fps, totalFrames, seed });

  const frameFileName = `${String(f).padStart(4, "0")}.png`;
  const framePath = path.join(outdir, frameFileName);
  await page.screenshot({ path: framePath });
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
  durationSec: totalSec.toFixed(2),
  renderFps: (renderedCount / totalSec).toFixed(1),
};

console.log(JSON.stringify(payload, null, 2));
