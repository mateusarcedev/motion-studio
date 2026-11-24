import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile, mkdir } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import zlib from "node:zlib";
import { ERROR_CODES, bridge as B } from "@technomanceer/motion-core";

// Minimal valid 1x1 PNG (68 bytes)
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64"
);
const TINY_PNG_2 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
// Minimal valid JPEG SOI + APP0 + SOF0(1x1) + EOI
const TINY_JPG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);
// Minimal WOFF2 header
const TINY_WOFF2 = Buffer.concat([Buffer.from("wOF2"), Buffer.alloc(16, 0)]);

const sha256 = (b) => createHash("sha256").update(b).digest("hex");

function buildIr(baseUrl, html) {
  const adapter = B.createDoopAdapter();
  return adapter.importFrame(
    { id: "frm_hydrator", canvasId: "cnv_test", width: 800, height: 600, html },
    { documentId: "cnv_test", allowLoopback: true }
  );
}

async function withTestServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    return await fn(baseUrl, port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("hydrator: blocks localhost and private/alternative IPs in default production policy", async () => {
  for (const bad of [
    "http://127.0.0.1/a.png",
    "https://localhost/a.png",
    "https://127.0.0.1/a.png",
    "https://2130706433/a.png",
    "https://0177.0.0.1/a.png",
    "https://0x7f000001/a.png",
    "https://127.1/a.png",
    "https://[::ffff:7f00:1]/a.png",
    "https://[64:ff9b::127.0.0.1]/a.png",
    "https://[2002:7f00:0001::1]/a.png",
    "https://[fe80::1]/a.png",
    "https://[fc00::1]/a.png",
    "https://100.64.0.1/a.png",
    "https://198.18.0.1/a.png",
  ]) {
    await assert.rejects(
      () => B.secureFetchAsset(bad),
      (e) => e.code === ERROR_CODES.BRIDGE_UNSAFE_URL,
      `expected SSRF block for ${bad}`
    );
  }
});

test("hydrator: defends against simulated DNS rebinding at effective lookup", async () => {
  const ir = buildIr(
    "https://rebind.example",
    `<img src="https://rebind.example/hero.png" />`
  );
  const projectDir = await mkdtemp(path.join(os.tmpdir(), "motion-rebind-"));
  try {
    await assert.rejects(
      () => B.hydrateAssets(ir, {
        projectDir,
        dnsLookup: async () => [{ address: "169.254.169.254", family: 4 }],
      }),
      (e) => e.code === ERROR_CODES.BRIDGE_UNSAFE_URL && /DNS rebinding|privado/i.test(e.message)
    );

    await assert.rejects(
      () => B.hydrateAssets(ir, {
        projectDir,
        dnsLookup: async () => [
          { address: "93.184.216.34", family: 4 },
          { address: "::ffff:127.0.0.1", family: 6 },
        ],
      }),
      (e) => e.code === ERROR_CODES.BRIDGE_UNSAFE_URL
    );
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("hydrator: blocks unsafe redirects, redirect loops, and strips Authorization/Cookie headers", async () => {
  await withTestServer((req, res) => {
    if (req.url === "/redir-meta") {
      res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data/" });
      res.end();
      return;
    }
    if (req.url === "/loop-a") {
      res.writeHead(302, { Location: "/loop-b" });
      res.end();
      return;
    }
    if (req.url === "/loop-b") {
      res.writeHead(302, { Location: "/loop-a" });
      res.end();
      return;
    }
    if (req.url === "/redir-hop") {
      res.writeHead(302, { Location: "/final.png" });
      res.end();
      return;
    }
    if (req.url === "/final.png") {
      assert.equal(req.headers.authorization, undefined);
      assert.equal(req.headers.cookie, undefined);
      res.writeHead(200, { "content-type": "image/png" });
      res.end(TINY_PNG);
      return;
    }
    res.writeHead(404);
    res.end();
  }, async (baseUrl) => {
    await assert.rejects(
      () => B.secureFetchAsset(`${baseUrl}/redir-meta`, { allowLoopback: true }),
      (e) => e.code === ERROR_CODES.BRIDGE_UNSAFE_URL
    );
    await assert.rejects(
      () => B.secureFetchAsset(`${baseUrl}/loop-a`, { allowLoopback: true, maxRedirects: 5 }),
      (e) => e.code === ERROR_CODES.BRIDGE_UNSAFE_URL
    );
    const ok = await B.secureFetchAsset(`${baseUrl}/redir-hop`, {
      allowLoopback: true,
      headers: { authorization: "Bearer secret", cookie: "sid=xyz" },
    });
    assert.equal(ok.buffer.equals(TINY_PNG), true);
  });
});

test("hydrator: hydrates PNG, SVG (sanitized), and font, deduplicates SHA-256, uses cache, and emits provenance manifests", async () => {
  let fetchCount = 0;
  await withTestServer((req, res) => {
    fetchCount++;
    if (req.url === "/a.png" || req.url === "/dup.png") {
      res.writeHead(200, { "content-type": "image/png", "content-length": String(TINY_PNG.length) });
      res.end(TINY_PNG);
      return;
    }
    if (req.url === "/icon.svg") {
      res.writeHead(200, { "content-type": "image/svg+xml" });
      res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><script>alert(1)</script><circle cx="12" cy="12" r="8" fill="#1F6F50"/></svg>');
      return;
    }
    if (req.url === "/font.woff2") {
      res.writeHead(200, { "content-type": "font/woff2" });
      res.end(TINY_WOFF2);
      return;
    }
    res.writeHead(404);
    res.end();
  }, async (baseUrl) => {
    const html = `<!doctype html><html><head><style>@font-face{font-family:"BridgeFont";src:url("${baseUrl}/font.woff2")}</style></head><body>
      <img src="${baseUrl}/a.png" /><img src="${baseUrl}/dup.png" /><img src="${baseUrl}/icon.svg" />
    </body></html>`;
    const ir = buildIr(baseUrl, html);
    const projectDir = await mkdtemp(path.join(os.tmpdir(), "motion-hyd-ok-"));
    const cacheDir = await mkdtemp(path.join(os.tmpdir(), "motion-hyd-cache-"));
    try {
      const res1 = await B.hydrateAssets(ir, {
        projectDir,
        cacheDir,
        allowLoopback: true,
        concurrency: 2,
        assetMetadata: {
          [`${baseUrl}/a.png`]: { origin: "doop:search_logos:custom", license: { spdx: "MIT", trademark: true } },
        },
      });
      assert.equal(res1.stats.hydrated, 4);
      // /a.png and /dup.png share the exact same SHA-256 -> only 3 unique files stored on disk!
      assert.equal(res1.stats.uniqueFiles, 3);
      assert.equal(res1.urlToLocalPath[`${baseUrl}/a.png`], res1.urlToLocalPath[`${baseUrl}/dup.png`]);

      const svgLocal = res1.urlToLocalPath[`${baseUrl}/icon.svg`];
      const svgDisk = await readFile(path.join(projectDir, svgLocal), "utf8");
      assert.ok(!svgDisk.includes("<script"), "hydrated SVG must be SVGO-sanitized");

      const prov = JSON.parse(await readFile(res1.provenancePath, "utf8"));
      assert.equal(prov.schemaVersion, "1.0.0");
      assert.equal(prov.assets.find((a) => a.sourceUrl === `${baseUrl}/a.png`).trademark, true);
      const manifest = JSON.parse(await readFile(res1.manifestPath, "utf8"));
      assert.equal(manifest.counts.uniqueFiles, 3);

      // Second hydration with expectedSha256 hits cache cleanly without hitting HTTP again for cached items
      const pngSha = sha256(TINY_PNG);
      const beforeCount = fetchCount;
      const projectDir2 = await mkdtemp(path.join(os.tmpdir(), "motion-hyd-cache-proj-"));
      try {
        const res2 = await B.hydrateAssets(ir, {
          projectDir: projectDir2,
          cacheDir,
          allowLoopback: true,
          assetMetadata: {
            [`${baseUrl}/a.png`]: { expectedSha256: pngSha },
            [`${baseUrl}/dup.png`]: { expectedSha256: pngSha },
          },
        });
        assert.equal(res2.cacheHits.length, 2);
        assert.equal(fetchCount - beforeCount, 2); // only svg and font fetched over network
      } finally {
        await rm(projectDir2, { recursive: true, force: true });
      }
    } finally {
      await rm(projectDir, { recursive: true, force: true });
      await rm(cacheDir, { recursive: true, force: true });
    }
  });
});

test("hydrator: rejects MIME mismatch, SHA-256 tamper, oversized streams, decompression bombs, incomplete responses, timeouts, and cancellations", async () => {
  await withTestServer((req, res) => {
    if (req.url === "/html-as-png.png") {
      res.writeHead(200, { "content-type": "image/png" });
      res.end("<html><body>not a png</body></html>");
      return;
    }
    if (req.url === "/mime-lie.png") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(TINY_PNG);
      return;
    }
    if (req.url === "/big.png") {
      res.writeHead(200, { "content-type": "image/png" });
      res.end(Buffer.concat([TINY_PNG, Buffer.alloc(1024 * 64, 1)]));
      return;
    }
    if (req.url === "/gzip-bomb.png") {
      const bomb = zlib.gzipSync(Buffer.alloc(200_000, 0x41));
      res.writeHead(200, { "content-type": "image/png", "content-encoding": "gzip" });
      res.end(bomb);
      return;
    }
    if (req.url === "/truncated.png") {
      res.writeHead(200, { "content-type": "image/png", "content-length": "500" });
      res.write(TINY_PNG);
      res.socket.destroy();
      return;
    }
    if (req.url === "/slow.png") {
      setTimeout(() => {
        if (!res.writableEnded) {
          res.writeHead(200, { "content-type": "image/png" });
          res.end(TINY_PNG);
        }
      }, 400);
      return;
    }
    if (req.url === "/valid2.png") {
      res.writeHead(200, { "content-type": "image/png" });
      res.end(TINY_PNG_2);
      return;
    }
    res.writeHead(404);
    res.end();
  }, async (baseUrl) => {
    const projectDir = await mkdtemp(path.join(os.tmpdir(), "motion-hyd-err-"));
    try {
      await assert.rejects(
        () => B.hydrateAssets(buildIr(baseUrl, `<img src="${baseUrl}/html-as-png.png"/>`), { projectDir, allowLoopback: true }),
        (e) => e.code === ERROR_CODES.BRIDGE_MIME_MISMATCH
      );
      await assert.rejects(
        () => B.hydrateAssets(buildIr(baseUrl, `<img src="${baseUrl}/mime-lie.png"/>`), { projectDir, allowLoopback: true }),
        (e) => e.code === ERROR_CODES.BRIDGE_MIME_MISMATCH
      );
      await assert.rejects(
        () => B.hydrateAssets(buildIr(baseUrl, `<img src="${baseUrl}/big.png"/>`), { projectDir, allowLoopback: true, maxAssetBytes: 2048 }),
        (e) => e.code === ERROR_CODES.BRIDGE_SIZE_LIMIT
      );
      await assert.rejects(
        () => B.hydrateAssets(buildIr(baseUrl, `<img src="${baseUrl}/gzip-bomb.png"/>`), { projectDir, allowLoopback: true, maxAssetBytes: 4096 }),
        (e) => e.code === ERROR_CODES.BRIDGE_SIZE_LIMIT
      );
      await assert.rejects(
        () => B.hydrateAssets(buildIr(baseUrl, `<img src="${baseUrl}/truncated.png"/>`), { projectDir, allowLoopback: true }),
        (e) => e.code === ERROR_CODES.BRIDGE_ASSET_FAILED
      );
      await assert.rejects(
        () => B.hydrateAssets(buildIr(baseUrl, `<img src="${baseUrl}/slow.png"/>`), { projectDir, allowLoopback: true, timeoutMs: 80 }),
        (e) => e.code === ERROR_CODES.BRIDGE_ASSET_FAILED
      );
      const ac = new AbortController();
      ac.abort();
      await assert.rejects(
        () => B.hydrateAssets(buildIr(baseUrl, `<img src="${baseUrl}/valid2.png"/>`), { projectDir, allowLoopback: true, signal: ac.signal }),
        (e) => e.code === ERROR_CODES.BRIDGE_ASSET_FAILED
      );
      // SHA-256 tamper mismatch
      await assert.rejects(
        () => B.hydrateAssets(buildIr(baseUrl, `<img src="${baseUrl}/valid2.png"/>`), {
          projectDir,
          allowLoopback: true,
          assetMetadata: { [`${baseUrl}/valid2.png`]: { expectedSha256: "0".repeat(64) } },
        }),
        (e) => e.code === ERROR_CODES.BRIDGE_SECURITY_VIOLATION
      );
      // Aggregate size limit across two assets
      await assert.rejects(
        () => B.hydrateAssets(
          buildIr(baseUrl, `<img src="${baseUrl}/valid2.png"/><img src="${baseUrl}/big.png"/>`),
          { projectDir, allowLoopback: true, maxAssetBytes: 100_000, maxTotalBytes: 1024 }
        ),
        (e) => e.code === ERROR_CODES.BRIDGE_SIZE_LIMIT
      );
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  });
});

test("hydrator: rejects path traversal and symlink traversal in destination paths", async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), "motion-hyd-sym-"));
  const outsideFile = path.join(os.tmpdir(), `motion-outside-${Date.now()}.txt`);
  await writeFile(outsideFile, "secret");
  try {
    await mkdir(path.join(projectDir, "assets"), { recursive: true });
    await symlink(outsideFile, path.join(projectDir, "assets", "escape-link.png"));

    const html = `<img src="https://cdn.example/p.png" />`;
    const ir = B.createDoopAdapter().importFrame(
      { id: "frm_sym", canvasId: "cnv_s", html },
      { documentId: "cnv_s" }
    );
    const transport = async () => ({ contentType: "image/png", buffer: TINY_PNG });

    await assert.rejects(
      () => B.hydrateAssets(ir, {
        projectDir,
        transport,
        assetMetadata: { "https://cdn.example/p.png": { localPath: "../escape.png" } },
      }),
      (e) => e.code === ERROR_CODES.BRIDGE_PATH_TRAVERSAL
    );
    await assert.rejects(
      () => B.hydrateAssets(ir, {
        projectDir,
        transport,
        assetMetadata: { "https://cdn.example/p.png": { localPath: "assets/escape-link.png" } },
      }),
      (e) => e.code === ERROR_CODES.BRIDGE_PATH_TRAVERSAL
    );
  } finally {
    await rm(projectDir, { recursive: true, force: true });
    await rm(outsideFile, { force: true });
  }
});
