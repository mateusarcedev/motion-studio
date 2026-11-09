import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

const PORT = 3388;
const SITE_DIR = path.resolve("projects/motion-landing/site");

const mimeTypes = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  mp4: "video/mp4",
  glb: "model/gltf-binary",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let reqPath = decodeURIComponent(url.pathname);

    // Mock analytics/tracking
    if (reqPath.includes("_vercel") || reqPath.includes("analytics")) {
      res.writeHead(200, { "content-type": "application/javascript" });
      res.end("// mock analytics");
      return;
    }

    let filePath = path.join(SITE_DIR, reqPath);
    let st;

    try {
      st = await stat(filePath);
      if (st.isDirectory()) {
        filePath = path.join(filePath, "index.html");
        st = await stat(filePath);
      }
    } catch {
      // Try adding .html if file not found
      try {
        filePath = filePath + ".html";
        st = await stat(filePath);
      } catch {
        res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
        res.end("<h1>404 Not Found</h1><p>The requested page was not found.</p>");
        return;
      }
    }

    const ext = path.extname(filePath).slice(1).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    const totalSize = st.size;

    // Handle HTTP Range Requests for smooth MP4 video playback and seeking
    const range = req.headers.range;
    if (range && ext === "mp4") {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
      });

      const stream = createReadStream(filePath, { start, end });
      stream.pipe(res);
      return;
    }

    // Normal full file delivery
    res.writeHead(200, {
      "Content-Length": totalSize,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache",
    });

    const stream = createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(`Internal Server Error: ${err.message}`);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n======================================================`);
  console.log(`🚀 MOTION Studio Server Online!`);
  console.log(`======================================================`);
  console.log(`• Landing Page (PT):          http://localhost:${PORT}/`);
  console.log(`• Landing Page (EN):          http://localhost:${PORT}/en/`);
  console.log(`• Case Study Dedicado (PT):   http://localhost:${PORT}/projects/carga-01/`);
  console.log(`• Case Study Dedicado (EN):   http://localhost:${PORT}/en/projects/carga-01/`);
  console.log(`• Demonstração 3D Standalone: http://localhost:${PORT}/demos/carga-01/`);
  console.log(`======================================================\n`);
});
