/**
 * MOTION Core — static-server.mjs
 * Local HTTP server used by the renderers (avoids file:// restrictions).
 *
 * Mounts:
 *   /                       → the composition HTML (with an import map injected)
 *   /<relative path>        → files next to the composition
 *   /@motion/<path>         → this package (design-system/frame.js, design-system/svg-motion.js, assets/…)
 *   /creative-core/<path>   → legacy alias of /@motion/ (older compositions), falling back to the repo's creative-core/
 *
 * Import map (injected only when the page has none), so non-technical authors never fix imports:
 *   "@technomanceer/motion-core/frame"       → /@motion/design-system/frame.js
 *   "@technomanceer/motion-core/svg-motion"  → /@motion/design-system/svg-motion.js
 *   "@technomanceer/motion-core/lottie"      → /@motion/design-system/lottie-motion.js
 */
import { createServer } from "node:http";
import { lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CORE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_CREATIVE_CORE = path.resolve(CORE_DIR, "../../creative-core");

export const IMPORT_MAP = {
  imports: {
    "@technomanceer/motion-core/frame": "/@motion/design-system/frame.js",
    "@technomanceer/motion-core/svg-motion": "/@motion/design-system/svg-motion.js",
    "@technomanceer/motion-core/lottie": "/@motion/design-system/lottie-motion.js",
  },
};

const TYPES = {
  html: "text/html; charset=utf-8", css: "text/css", js: "text/javascript", mjs: "text/javascript",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif",
  svg: "image/svg+xml", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
  json: "application/json", glb: "model/gltf-binary", gltf: "model/gltf+json",
  mp3: "audio/mpeg", wav: "audio/wav", mp4: "video/mp4", webm: "video/webm", wasm: "application/wasm",
};

const within = (root, file) => { const rel = path.relative(root, file); return rel && !rel.startsWith("..") && !path.isAbsolute(rel); };
async function withinRealRoot(roots, file) {
  let st;
  try {
    st = await lstat(file);
  } catch (err) {
    if (err?.code === "ENOENT") return "missing";
    return false;
  }
  if (st.isSymbolicLink()) return false;
  try {
    const realFile = await realpath(file);
    for (const r of roots) {
      const realRoot = await realpath(r).catch(() => null);
      if (realRoot && (realFile === realRoot || within(realRoot, realFile))) return true;
    }
    return false;
  } catch { return false; }
}
async function isFile(p) { try { return (await stat(p)).isFile(); } catch { return false; } }

function injectImportMap(html) {
  if (/<script[^>]+type\s*=\s*["']importmap["']/i.test(html)) return html;
  const tag = `<script type="importmap">${JSON.stringify(IMPORT_MAP)}</script>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${tag}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${tag}</head>`);
  return tag + html;
}

/** @returns {{server: import("node:http").Server, listen: () => Promise<number>, close: () => void}} */
export function createStaticServer(inputPath) {
  const inputAbs = path.resolve(inputPath);
  const rootDir = path.dirname(inputAbs);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/favicon.ico") { res.writeHead(204); res.end(); return; }
      const pathname = decodeURIComponent(url.pathname);
      let file;
      if (pathname === "/" || pathname === `/${path.basename(inputAbs)}`) file = inputAbs;
      else if (pathname.startsWith("/@motion/")) file = path.join(CORE_DIR, pathname.slice("/@motion/".length));
      else if (pathname.startsWith("/creative-core/")) {
        const rel = pathname.slice("/creative-core/".length);
        const inCore = path.join(CORE_DIR, rel);
        file = (await isFile(inCore)) ? inCore : path.join(REPO_CREATIVE_CORE, rel);
      } else file = path.join(rootDir, pathname);
      const allowed = [rootDir, CORE_DIR, REPO_CREATIVE_CORE].some((r) => within(r, file) || file === inputAbs);
      if (!allowed) { res.writeHead(403); res.end("forbidden"); return; }
      const realState = await withinRealRoot([rootDir, CORE_DIR, REPO_CREATIVE_CORE], file);
      if (realState === "missing") { res.writeHead(404); res.end("not found"); return; }
      if (!realState) { res.writeHead(403); res.end("forbidden"); return; }
      let data = await readFile(file);
      const ext = path.extname(file).slice(1).toLowerCase();
      if (file === inputAbs && ext.startsWith("htm")) data = Buffer.from(injectImportMap(data.toString("utf8")));
      res.writeHead(200, { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "no-store" });
      res.end(data);
    } catch { res.writeHead(404); res.end("not found"); }
  });
  return {
    server,
    listen: () => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port))),
    close: () => server.close(),
  };
}
