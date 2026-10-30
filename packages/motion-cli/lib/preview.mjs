import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export async function runPreview(targetPath = ".", options = {}) {
  const absTarget = path.resolve(targetPath);
  let isDir = false;
  try {
    const s = await stat(absTarget);
    isDir = s.isDirectory();
  } catch {
    console.error(`Caminho não encontrado: ${absTarget}`);
    process.exit(1);
  }

  const rootDir = isDir ? absTarget : path.dirname(absTarget);
  const entryFile = isDir ? "index.html" : path.basename(absTarget);

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      let p = path.join(rootDir, decodeURIComponent(url.pathname === "/" ? entryFile : url.pathname));
      const data = await readFile(p);
      const ext = path.extname(p).slice(1);
      const types = {
        html: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript",
        png: "image/png", jpg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml",
        json: "application/json", mp4: "video/mp4"
      };
      res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  const port = Number(options.port || 3300);
  server.listen(port, "127.0.0.1", () => {
    console.log(`🌐 Servidor de preview do MOTION rodando em: http://127.0.0.1:${port}`);
    console.log(`Servindo: ${absTarget}`);
    console.log("Pressione Ctrl+C para encerrar.");
  });

  return server;
}
