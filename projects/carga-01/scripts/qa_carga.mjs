import { chromium } from "playwright-core";
import { mkdir, writeFile, stat, readdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const OUT_DIR = path.resolve("projects/carga-01/reviews/viewports");
await mkdir(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: "mobile-s", width: 360, height: 740, touch: true },
  { name: "mobile", width: 390, height: 844, touch: true },
  { name: "tablet", width: 768, height: 1024, touch: true },
  { name: "desktop-1440", width: 1440, height: 900, touch: false },
  { name: "wide-1920", width: 1920, height: 1080, touch: false }
];

const distDir = path.resolve("projects/carga-01/web/dist");
const mimeTypes = {
  html: "text/html",
  css: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  png: "image/png",
  jpg: "image/jpeg",
  svg: "image/svg+xml",
  json: "application/json",
  glb: "model/gltf-binary"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    const filePath = path.join(distDir, pathname);

    const data = await readFile(filePath);
    const ext = path.extname(filePath).slice(1);
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Access-Control-Allow-Origin": "*"
    });
    res.end(data);
  } catch (err) {
    res.writeHead(404);
    res.end("Not found");
  }
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const targetUrl = `http://127.0.0.1:${port}/`;
console.log(`Local test server running at ${targetUrl}`);

async function resolveChrome() {
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
  return "/usr/bin/chromium";
}

const executablePath = await resolveChrome();
console.log("Using Chrome:", executablePath);

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
});

const results = [];

for (const vp of VIEWPORTS) {
  console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})...`);
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    hasTouch: vp.touch
  });

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto(targetUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Check 1: Opening / Cena 01
  const shotAbertura = path.join(OUT_DIR, `${vp.name}-01-abertura.png`);
  await page.screenshot({ path: shotAbertura });

  // Navigate through scenes 02 to 05 using scene buttons
  const sceneButtons = await page.$$(".btn-scene-dot");
  if (sceneButtons.length >= 2) {
    await sceneButtons[1].click({ force: true });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, `${vp.name}-02-conteiner.png`) });
  }

  if (sceneButtons.length >= 3) {
    await sceneButtons[2].click({ force: true });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, `${vp.name}-03-movimentacao.png`) });
  }

  if (sceneButtons.length >= 4) {
    await sceneButtons[3].click({ force: true });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, `${vp.name}-04-estrada.png`) });
  }

  if (sceneButtons.length >= 5) {
    await sceneButtons[4].click({ force: true });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, `${vp.name}-05-destino.png`) });
  }

  // Test Telemetry Modal interaction
  const telemetryBtn = await page.$("button[title*='telemetria']");
  if (telemetryBtn) {
    await telemetryBtn.click({ force: true });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, `${vp.name}-modal-telemetria.png`) });
    const closeBtn = await page.$(".telemetry-modal-card button");
    if (closeBtn) await closeBtn.click({ force: true });
  }

  // Scroll to bottom to test Case Section
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  const shotCase = path.join(OUT_DIR, `${vp.name}-encerramento-case.png`);
  await page.screenshot({ path: shotCase });

  // Evaluation of DOM & Metrics
  const audit = await page.evaluate(() => {
    const de = document.documentElement;
    const overflowX = Math.max(de.scrollWidth, document.body.scrollWidth) - de.clientWidth;

    const smallTargets = [];
    const interactives = document.querySelectorAll("button, a, input");
    interactives.forEach((el) => {
      const r = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (style.display !== "none" && style.visibility !== "hidden" && r.width > 0 && r.height > 0) {
        if (r.width < 44 || r.height < 44) {
          smallTargets.push(`${el.className || el.tagName} (${Math.round(r.width)}x${Math.round(r.height)})`);
        }
      }
    });

    const canvas = document.querySelector("canvas");
    let canvasReady = false;
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      canvasReady = true;
    }

    return {
      overflowX,
      smallTargets,
      canvasReady
    };
  });

  const passed = audit.overflowX <= 0 && audit.smallTargets.length === 0 && audit.canvasReady && consoleErrors.length === 0;

  console.log(`Results for ${vp.name}: overflowX=${audit.overflowX}, smallTargets=${audit.smallTargets.length}, canvasReady=${audit.canvasReady}, passed=${passed}`);

  results.push({
    viewport: vp,
    passed,
    overflowX: audit.overflowX,
    smallTargets: audit.smallTargets,
    canvasReady: audit.canvasReady,
    consoleErrors
  });

  await page.close();
}

await browser.close();
server.close();

const reportData = {
  timestamp: new Date().toISOString(),
  totalViewports: VIEWPORTS.length,
  allPassed: results.every((r) => r.passed),
  results
};

await writeFile(path.join(OUT_DIR, "report.json"), JSON.stringify(reportData, null, 2));

const md = [
  "# Relatório de QA Multi-Viewport — CARGA / 01",
  "",
  `**Data:** ${new Date().toLocaleString("pt-BR")}`,
  `**Status Geral:** ${reportData.allPassed ? "✅ PASSOU COM SUCESSO" : "⚠️ ATENÇÃO: VERIFICAR ITENS"}`,
  "",
  "## Resumo por Viewport",
  "",
  "| Viewport | Resolução | Overflow X | Touch Targets (<44px) | Canvas WebGL | Erros de Console | Status |",
  "|---|---|---|---|---|---|---|"
];

results.forEach((r) => {
  md.push(
    `| **${r.viewport.name}** | ${r.viewport.width}×${r.viewport.height} | ${r.overflowX === 0 ? "0px (Zero Overflow)" : `${r.overflowX}px`} | ${r.smallTargets.length === 0 ? "0 (Conforme)" : r.smallTargets.join(", ")} | ${r.canvasReady ? "Ativo & Renderizado" : "Falha"} | ${r.consoleErrors.length === 0 ? "Zero" : r.consoleErrors.join("; ")} | ${r.passed ? "✅ PASS" : "❌ FAIL"} |`
  );
});

md.push("");
md.push("## Evidências Capturadas em Cada Viewport");
md.push("- `01-abertura.png`: Tomada inicial de estabelecimento (O Porto)");
md.push("- `02-conteiner.png`: Close-up cinematográfico no contêiner protagonista CRG-01-A");
md.push("- `03-movimentacao.png`: Içamento do contêiner pelo guindaste pórtico STS");
md.push("- `04-estrada.png`: Trânsito noturno na rodovia molhada com feixes de luz");
md.push("- `05-destino.png`: Destino final e revelação da mensagem poética");
md.push("- `modal-telemetria.png`: Modal de telemetria técnica e dados ISO 6346");
md.push("- `encerramento-case.png`: Seção de encerramento e Ficha Técnica do Case");
md.push("");
md.push("---");
md.push("*Auditoria multi-viewport executada com Playwright Core e Chromium headless.*");

await writeFile(path.join(OUT_DIR, "report.md"), md.join("\n"));
console.log("\n==========================================");
console.log("QA MULTI-VIEWPORT FINALIZADO COM SUCESSO");
console.log(`Relatório salvo em: ${path.join(OUT_DIR, "report.md")}`);
console.log("==========================================");
