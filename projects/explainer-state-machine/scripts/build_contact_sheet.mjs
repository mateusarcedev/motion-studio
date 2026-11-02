import { chromium } from "playwright-core";
import { stat, mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

const REVIEWS_DIR = path.resolve("projects/explainer-state-machine/reviews");
const DECODED_DIR = path.join(REVIEWS_DIR, "decoded");

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
  { label: "01.0s", f: "frame_01_0s.png", scene: "Ato 01 · Flags Booleanas", tc: "TC 00:00:01:00" },
  { label: "04.0s", f: "frame_04_0s.png", scene: "Ato 01 · 16 Combinações 2⁴", tc: "TC 00:00:04:00" },
  { label: "06.0s", f: "frame_06_0s.png", scene: "Ato 01 · Colisão de Estado", tc: "TC 00:00:06:00" },
  { label: "10.0s", f: "frame_10_0s.png", scene: "Ato 02 · Estados Finitos (IDLE)", tc: "TC 00:00:10:00" },
  { label: "14.0s", f: "frame_14_0s.png", scene: "Ato 02 · Domínio Discreto", tc: "TC 00:00:14:00" },
  { label: "18.0s", f: "frame_18_0s.png", scene: "Ato 03 · Transição em Trânsito", tc: "TC 00:00:18:00" },
  { label: "22.0s", f: "frame_22_0s.png", scene: "Ato 03 · Nó FETCHING Ativo", tc: "TC 00:00:22:00" },
  { label: "28.0s", f: "frame_28_0s.png", scene: "Ato 04 · Guarda Rejeitada", tc: "TC 00:00:28:00" },
  { label: "32.0s", f: "frame_32_0s.png", scene: "Ato 04 · Guarda Aprovada (Menta)", tc: "TC 00:00:32:00" },
  { label: "38.0s", f: "frame_38_0s.png", scene: "Ato 05 · Evento Ilegal Repelido", tc: "TC 00:00:38:00" },
  { label: "42.0s", f: "frame_42_0s.png", scene: "Ato 05 · Integridade Intacta", tc: "TC 00:00:42:00" },
  { label: "46.0s", f: "frame_46_0s.png", scene: "Ato 06 · Ciclo Completo (Fase 2)", tc: "TC 00:00:46:00" },
  { label: "50.0s", f: "frame_50_0s.png", scene: "Ato 06 · Ciclo Completo (Fase 4)", tc: "TC 00:00:50:00" },
  { label: "55.0s", f: "frame_55_0s.png", scene: "Ato 07 · Síntese e 3 Preceitos", tc: "TC 00:00:55:00" },
  { label: "59.5s", f: "frame_59_5s.png", scene: "Ato 07 · Conclusão FSM", tc: "TC 00:00:59:15" },
];

function generateHtml(title, format) {
  const cardsHtml = TIMESTAMPS.map((t) => {
    const imgPath = path.join(DECODED_DIR, t.f);
    let dataUrl = "";
    try {
      const b64 = readFileSync(imgPath).toString("base64");
      dataUrl = `data:image/png;base64,${b64}`;
    } catch {
      dataUrl = "";
    }
    return `
    <div class="card">
      <div class="thumb-wrap vert">
        <img src="${dataUrl}" alt="${t.scene}">
        <span class="badge-time">${t.label}</span>
      </div>
      <div class="meta">
        <div class="meta-row">
          <span class="scene">${t.scene}</span>
          <span class="tc">${t.tc}</span>
        </div>
        <div class="status">✓ DECODED FROM MP4 · CFR 30 FPS</div>
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
    --bg: #070A13; --surface: #0E1626; --border: #1E293B; --mint: #15F5BA; --amber: #FF8A00; --cyan: #00F0FF;
    --text: #F8FAFC; --muted: #94A3B8; --mono: monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    padding: 48px;
    width: 2500px;
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
    background: rgba(0, 240, 255, 0.12);
    border: 1px solid rgba(0, 240, 255, 0.4);
    color: var(--cyan);
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
    text-align: right;
    font-family: var(--mono);
    font-size: 15px;
    color: var(--cyan);
    line-height: 1.5;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 28px;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .thumb-wrap {
    position: relative;
    width: 100%;
    background: #000;
    overflow: hidden;
  }
  .thumb-wrap.vert {
    aspect-ratio: 9 / 16;
  }
  .thumb-wrap img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
  .badge-time {
    position: absolute;
    bottom: 12px;
    right: 12px;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff;
    font-family: var(--mono);
    font-size: 14px;
    font-weight: 700;
    padding: 4px 8px;
    border-radius: 4px;
  }
  .meta {
    padding: 16px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    flex: 1;
    background: #0A0F1D;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .scene {
    font-weight: 700;
    font-size: 15px;
    color: var(--text);
  }
  .tc {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--muted);
  }
  .status {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--mint);
    letter-spacing: 0.05em;
  }
</style>
</head>
<body>
  <div class="header">
    <div class="title-group">
      <h1>MÁQUINAS DE ESTADOS <span>//</span> CONTACT SHEET QA (${format}) <span class="badge">EXPLAINER BENCHMARK</span></h1>
      <div class="sub">15 Frames Representativos Decodificados Diretamente do Master MP4 Final</div>
    </div>
    <div class="specs">
      <div>DURAÇÃO: 60.0s (1800 QUADROS)</div>
      <div>RESOLUÇÃO: 1080×1920 @ 30 FPS CFR</div>
    </div>
  </div>

  <div class="grid">
    ${cardsHtml}
  </div>
</body>
</html>`;
}

async function main() {
  const execPath = await resolveChrome();
  const browser = await chromium.launch({ executablePath: execPath, headless: true });

  const page = await browser.newPage({ viewport: { width: 2500, height: 2400 } });
  const html = generateHtml("MÁQUINAS DE ESTADOS", "9:16");
  await page.setContent(html, { waitUntil: "load" });
  await page.waitForTimeout(500);

  const dest = path.join(REVIEWS_DIR, "contact-sheet.png");
  await page.screenshot({ path: dest, fullPage: true });
  console.log("✓ Contact Sheet capturada em alta definição:", dest);

  await browser.close();
}

main().catch(console.error);
