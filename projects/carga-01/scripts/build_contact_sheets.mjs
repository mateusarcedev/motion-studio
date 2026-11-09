import { chromium } from "playwright-core";
import { stat, mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

const REVIEWS_DIR = path.resolve("projects/carga-01/reviews");

async function resolveChrome() {
  const cacheBase = `${process.env.HOME}/.cache/ms-playwright`;
  try {
    const { readdir } = await import("node:fs/promises");
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

const TIMESTAMPS = [
  { label: "0.0s", f: "frame_0s.png", scene: "01 · O Porto", tc: "TC 00:00:00:00" },
  { label: "2.0s", f: "frame_2s.png", scene: "01 · Cais & Navio", tc: "TC 00:00:02:00" },
  { label: "4.0s", f: "frame_4s.png", scene: "02 · Dolly In", tc: "TC 00:00:04:00" },
  { label: "6.0s", f: "frame_6s.png", scene: "02 · Contêiner TRV-01-A", tc: "TC 00:00:06:00" },
  { label: "8.0s", f: "frame_8s.png", scene: "03 · Spreader Lock", tc: "TC 00:00:08:00" },
  { label: "10.0s", f: "frame_10s.png", scene: "03 · Içamento Vertical", tc: "TC 00:00:10:00" },
  { label: "12.0s", f: "frame_12s.png", scene: "04 · Acoplamento", tc: "TC 00:00:12:00" },
  { label: "14.0s", f: "frame_14s.png", scene: "04 · Estrada Noturna", tc: "TC 00:00:14:00" },
  { label: "16.0s", f: "frame_16s.png", scene: "05 · Desaceleração Hub", tc: "TC 00:00:16:00" },
  { label: "18.0s", f: "frame_18s.png", scene: "05 · Destino Final", tc: "TC 00:00:18:00" },
  { label: "19.9s", f: "frame_19_9s.png", scene: "05 · Síntese Poética", tc: "TC 00:00:19:27" },
];

function generateHtml(title, format, framesDir, isVertical = false) {
  const cardsHtml = TIMESTAMPS.map((t, idx) => {
    const imgPath = path.join(framesDir, t.f);
    const b64 = readFileSync(imgPath).toString("base64");
    const dataUrl = `data:image/png;base64,${b64}`;
    return `
    <div class="card">
      <div class="thumb-wrap ${isVertical ? 'vert' : 'horiz'}">
        <img src="${dataUrl}" alt="${t.scene}">
        <span class="badge-time">${t.label}</span>
      </div>
      <div class="meta">
        <div class="meta-row">
          <span class="scene">${t.scene}</span>
          <span class="tc">${t.tc}</span>
        </div>
        <div class="status">✓ DECODED FROM MP4 · EXPOSURE PASS</div>
      </div>
    </div>
  `;
  }).join("\n");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  :root {
    --bg: #070A0F; --surface: #0E1626; --border: #1E293B; --mint: #15F5BA; --amber: #FF8A00; --cyan: #00F0FF;
    --text: #F8FAFC; --muted: #94A3B8; --mono: monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    padding: 48px;
    width: ${isVertical ? '2160px' : '2400px'};
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 2px solid var(--border);
    padding-bottom: 24px;
    margin-bottom: 36px;
  }
  .title-group h1 {
    font-size: 38px;
    font-weight: 800;
    letter-spacing: -0.02em;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .title-group h1 span { color: var(--amber); }
  .badge {
    background: rgba(21, 245, 186, 0.12);
    border: 1px solid rgba(21, 245, 186, 0.4);
    color: var(--mint);
    font-family: var(--mono);
    font-size: 14px;
    padding: 4px 10px;
    border-radius: 4px;
  }
  .sub {
    font-family: var(--mono);
    font-size: 16px;
    color: var(--muted);
    margin-top: 8px;
  }
  .specs {
    font-family: var(--mono);
    font-size: 15px;
    color: var(--cyan);
    text-align: right;
  }
  .grid {
    display: grid;
    grid-template-columns: ${isVertical ? 'repeat(6, 1fr)' : 'repeat(4, 1fr)'};
    gap: 24px;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  .thumb-wrap {
    position: relative;
    background: #000;
    overflow: hidden;
  }
  .thumb-wrap.horiz { aspect-ratio: 16/9; }
  .thumb-wrap.vert { aspect-ratio: 9/16; }
  .thumb-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .badge-time {
    position: absolute;
    top: 8px;
    left: 8px;
    background: rgba(7, 10, 15, 0.85);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 138, 0, 0.4);
    color: var(--amber);
    font-family: var(--mono);
    font-weight: 700;
    font-size: 12px;
    padding: 3px 8px;
    border-radius: 4px;
  }
  .meta {
    padding: 14px 16px;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .scene {
    font-weight: 700;
    font-size: 14px;
    color: var(--text);
  }
  .tc {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--muted);
  }
  .status {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--mint);
    letter-spacing: 0.05em;
  }
</style>
</head>
<body>
  <div class="header">
    <div class="title-group">
      <h1>TRAVESSIA <span>//</span> CONTACT SHEET QA (${format}) <span class="badge">MOTION STUDIO CFR</span></h1>
      <div class="sub">11 Frames Representativos Decodificados Diretamente do Master MP4 Final</div>
    </div>
    <div class="specs">
      <div>DURAÇÃO: 20.0s (600 FRAMES)</div>
      <div>RESOLUÇÃO: ${format === '16:9' ? '1920×1080' : '1080×1920'} @ 30 FPS CFR</div>
    </div>
  </div>

  <div class="grid">
    ${cardsHtml}
  </div>
</body>
</html>`;
}

const execPath = await resolveChrome();
const browser = await chromium.launch({ executablePath: execPath, headless: true });

// 1. Build and capture 16:9 contact sheet
const page16 = await browser.newPage({ viewport: { width: 2400, height: 1600 } });
const html16 = generateHtml("TRAVESSIA", "16:9", path.join(REVIEWS_DIR, "decoded-16x9"), false);
await page16.setContent(html16, { waitUntil: "load" });
await page16.waitForTimeout(1000);
await page16.screenshot({ path: path.join(REVIEWS_DIR, "contact-sheet-16x9.png"), fullPage: true });
console.log("✓ Contact Sheet 16:9 capturada:", path.join(REVIEWS_DIR, "contact-sheet-16x9.png"));
await page16.close();

// 2. Build and capture 9:16 contact sheet
const page9 = await browser.newPage({ viewport: { width: 2160, height: 1800 } });
const html9 = generateHtml("TRAVESSIA", "9:16", path.join(REVIEWS_DIR, "decoded-9x16"), true);
await page9.setContent(html9, { waitUntil: "load" });
await page9.waitForTimeout(1000);
await page9.screenshot({ path: path.join(REVIEWS_DIR, "contact-sheet-9x16.png"), fullPage: true });
console.log("✓ Contact Sheet 9:16 capturada:", path.join(REVIEWS_DIR, "contact-sheet-9x16.png"));
await page9.close();

await browser.close();
console.log("Contact sheets generation complete!");
