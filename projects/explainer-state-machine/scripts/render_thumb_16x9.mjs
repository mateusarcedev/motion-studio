import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs/promises";

const chromePath = `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`;

async function main() {
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1920px; height: 1080px; background: #070A0F;
    overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #F8FAFC; position: relative;
  }
  canvas { display: block; width: 1920px; height: 1080px; }
</style>
</head>
<body>
<canvas id="cv" width="1920" height="1080"></canvas>
<script>
const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Background gradient matching composition.html
const grad = ctx.createRadialGradient(960, 540, 80, 960, 540, 1100);
grad.addColorStop(0, "#0E182A");
grad.addColorStop(0.55, "#070B13");
grad.addColorStop(1, "#04060A");
ctx.fillStyle = grad;
ctx.fillRect(0, 0, 1920, 1080);

// Grid pattern
ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
ctx.lineWidth = 1;
for (let x = 60; x < 1920; x += 60) {
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1080); ctx.stroke();
}
for (let y = 60; y < 1080; y += 60) {
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1920, y); ctx.stroke();
}

// 4 State Nodes in wide 16:9 composition: IDLE, FETCHING, RESOLVED, ERROR
const nodes = {
  IDLE: { x: 380, y: 620, label: "IDLE", color: "#FF8A00", tag: "INICIAL", sub: "Aguardando evento" },
  FETCHING: { x: 960, y: 440, label: "FETCHING", color: "#00F0FF", tag: "ASSÍNCRONO", sub: "Transição em voo" },
  RESOLVED: { x: 1540, y: 620, label: "RESOLVED", color: "#15F5BA", tag: "SUCESSO", sub: "Terminal válido" },
  ERROR: { x: 960, y: 800, label: "ERROR", color: "#FF4757", tag: "RECUPERAÇÃO", sub: "Timeout / Falha" }
};

// Draw Connection Arcs
function drawEdge(from, to, label, color, curveY = 0) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2 + curveY;
  ctx.quadraticCurveTo(midX, midY, to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Edge Label Pill
  if (label) {
    ctx.font = "700 13px monospace";
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = "#090F1C";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    roundRect(ctx, midX - tw/2 - 14, midY - 14, tw + 28, 28, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, midX, midY);
  }
  ctx.restore();
}

drawEdge(nodes.IDLE, nodes.FETCHING, "EVENT: FETCH  [canFetch() == true]", "#00F0FF", -30);
drawEdge(nodes.FETCHING, nodes.RESOLVED, "EVENT: SUCCESS", "#15F5BA", -30);
drawEdge(nodes.FETCHING, nodes.ERROR, "EVENT: TIMEOUT", "#FF4757", 0);
drawEdge(nodes.ERROR, nodes.FETCHING, "EVENT: RETRY", "#FF8A00", 0);

// Draw Nodes
for (const [key, n] of Object.entries(nodes)) {
  ctx.save();
  // Outer glow
  const glow = ctx.createRadialGradient(n.x, n.y, 45, n.x, n.y, 115);
  glow.addColorStop(0, n.color + "38");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(n.x, n.y, 115, 0, Math.PI * 2);
  ctx.fill();

  // Outer ring
  ctx.strokeStyle = n.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(n.x, n.y, 68, 0, Math.PI * 2);
  ctx.stroke();

  // Inner card circle
  ctx.fillStyle = "#0B1220";
  ctx.beginPath();
  ctx.arc(n.x, n.y, 64, 0, Math.PI * 2);
  ctx.fill();

  // Node Title
  ctx.font = "900 20px monospace";
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(n.label, n.x, n.y - 8);

  // Node Subtag
  ctx.font = "700 11px monospace";
  ctx.fillStyle = n.color;
  ctx.fillText(n.tag, n.x, n.y + 16);

  ctx.restore();
}

// Editorial Title Overlay (Top Left)
// Kicker
ctx.font = "800 16px monospace";
ctx.fillStyle = "#15F5BA";
ctx.textAlign = "left";
ctx.letterSpacing = "0.08em";
ctx.fillText("EXPLAINER MOTION // 01 · 60s VERTICAL 9:16", 120, 130);

// Main Big Title
ctx.font = "900 72px sans-serif";
ctx.fillStyle = "#FFFFFF";
ctx.letterSpacing = "-0.03em";
ctx.fillText("MÁQUINAS DE ESTADOS", 120, 215);

// Subtitle
ctx.font = "500 24px sans-serif";
ctx.fillStyle = "#94A3B8";
ctx.letterSpacing = "normal";
ctx.fillText("Quando o movimento explica a lógica.", 120, 268);

// Top Right Badges
const badges = ["CFR 30 FPS", "HTML5 CANVAS", "PLAYWRIGHT", "FFMPEG"];
let bx = 1800;
for (const b of badges.reverse()) {
  ctx.font = "700 12px monospace";
  const w = ctx.measureText(b).width;
  bx -= (w + 22);
  ctx.fillStyle = "rgba(14, 22, 38, 0.9)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 1;
  roundRect(ctx, bx, 112, w + 16, 30, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#CBD5E1";
  ctx.textAlign = "center";
  ctx.fillText(b, bx + (w + 16)/2, 131);
  bx -= 10;
}

// Bottom Telemetry Bar
ctx.fillStyle = "rgba(11, 18, 32, 0.9)";
ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
ctx.lineWidth = 1;
roundRect(ctx, 120, 960, 1680, 54, 8);
ctx.fill();
ctx.stroke();

ctx.font = "700 13px monospace";
ctx.fillStyle = "#15F5BA";
ctx.textAlign = "left";
ctx.fillText("● PIPELINE DETERMINÍSTICO", 150, 992);

ctx.fillStyle = "#64748B";
ctx.fillText("FRAME N É SEMPRE IGUAL · 1.800 QUADROS · BIT-FOR-BIT REPRODUCIBLE · MOTION STUDIO", 390, 992);

ctx.fillStyle = "#FF8A00";
ctx.textAlign = "right";
ctx.fillText("RELEASE CANDIDATE v4", 1770, 992);
</script>
</body>
</html>`;

  await page.setContent(html);
  await page.waitForTimeout(400);

  const actDir = path.resolve("projects/motion-landing/site/assets/state-machines");
  await fs.mkdir(actDir, { recursive: true });

  const landingThumb = path.join(actDir, "thumb-16x9.png");
  const projectThumb = path.resolve("projects/explainer-state-machine/out/thumb-16x9.png");

  await page.screenshot({ path: landingThumb });
  await fs.copyFile(landingThumb, projectThumb);

  console.log(`✓ Thumbnail 16:9 gerada com sucesso:`);
  console.log(`  - ${landingThumb}`);
  console.log(`  - ${projectThumb}`);

  await browser.close();
}

main().catch(console.error);
