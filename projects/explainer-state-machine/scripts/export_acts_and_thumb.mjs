import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs/promises";

const chromePath = `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`;

async function main() {
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  
  // 1. Export Act Stills from composition.html (9:16 vertical)
  const page916 = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const compUrl = "file://" + path.resolve("projects/explainer-state-machine/composition.html");
  await page916.goto(compUrl);

  const actDir = path.resolve("projects/motion-landing/site/assets/state-machines");
  await fs.mkdir(actDir, { recursive: true });

  const acts = [
    { num: "01", frame: 120, name: "act-01-sopa-booleanos.png" },
    { num: "02", frame: 350, name: "act-02-estados-finitos.png" },
    { num: "03", frame: 600, name: "act-03-a-transicao.png" },
    { num: "04", frame: 850, name: "act-04-guardas-logicas.png" },
    { num: "05", frame: 1150, name: "act-05-evento-invalido.png" },
    { num: "06", frame: 1450, name: "act-06-ciclo-completo.png" },
    { num: "07", frame: 1700, name: "act-07-sintese-fsm.png" },
  ];

  for (const act of acts) {
    await page916.evaluate((f) => window.renderFrame(f), act.frame);
    const dest = path.join(actDir, act.name);
    await page916.screenshot({ path: dest });
    console.log(`✓ Act ${act.num} salvo: ${act.name}`);
  }

  // Also save the vertical poster (Frame 350 or Frame 600) to actDir / poster-9x16.png
  await page916.evaluate(() => window.renderFrame(350));
  await page916.screenshot({ path: path.join(actDir, "poster-9x16.png") });
  console.log(`✓ Poster vertical 9:16 salvo em ${actDir}/poster-9x16.png`);

  await page916.close();

  // 2. Render Dedicated 16:9 Showcase Thumbnail (1920x1080)
  // Featuring "MÁQUINAS DE ESTADOS" with real diagram composition
  const page169 = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  const thumbHtmlPath = path.resolve("/tmp/thumb_composition.html");
  const thumbHtml = `<!doctype html>
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

// Background gradient
const grad = ctx.createRadialGradient(960, 540, 100, 960, 540, 1100);
grad.addColorStop(0, "#0E182A");
grad.addColorStop(0.6, "#070B13");
grad.addColorStop(1, "#04060A");
ctx.fillStyle = grad;
ctx.fillRect(0, 0, 1920, 1080);

// Grid pattern
ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
ctx.lineWidth = 1;
for (let x = 60; x < 1920; x += 60) {
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1080); ctx.stroke();
}
for (let y = 60; y < 1080; y += 60) {
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1920, y); ctx.stroke();
}

// Draw Graph Nodes in 16:9 layout
// Nodes: IDLE (left), FETCHING (center-top), RESOLVED (right), ERROR (center-bottom)
const nodes = {
  IDLE: { x: 420, y: 640, label: "IDLE", color: "#FF8A00", tag: "INICIAL" },
  FETCHING: { x: 960, y: 440, label: "FETCHING", color: "#00F0FF", tag: "ASSÍNCRONO" },
  RESOLVED: { x: 1500, y: 640, label: "RESOLVED", color: "#15F5BA", tag: "TERMINAL SUCESSO" },
  ERROR: { x: 960, y: 840, label: "ERROR", color: "#FF4757", tag: "TERMINAL ERRO" }
};

// Causal connection arcs
function drawEdge(from, to, label, guard, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2 + (from.y === to.y ? -40 : 0);
  ctx.quadraticCurveTo(midX, midY, to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Edge label pill
  if (label) {
    ctx.font = "700 13px monospace";
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = "#0A101D";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    roundRect(ctx, midX - tw/2 - 12, midY - 14, tw + 24, 28, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, midX, midY);
  }
  ctx.restore();
}

drawEdge(nodes.IDLE, nodes.FETCHING, "EVENT: FETCH [canFetch()]", null, "#00F0FF");
drawEdge(nodes.FETCHING, nodes.RESOLVED, "EVENT: SUCCESS", null, "#15F5BA");
drawEdge(nodes.FETCHING, nodes.ERROR, "EVENT: TIMEOUT", null, "#FF4757");
drawEdge(nodes.ERROR, nodes.FETCHING, "EVENT: RETRY", null, "#FF8A00");

// Draw Nodes
for (const [key, n] of Object.entries(nodes)) {
  ctx.save();
  // Glow
  const glow = ctx.createRadialGradient(n.x, n.y, 40, n.x, n.y, 110);
  glow.addColorStop(0, n.color + "33");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(n.x, n.y, 110, 0, Math.PI * 2);
  ctx.fill();

  // Outer ring
  ctx.strokeStyle = n.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(n.x, n.y, 64, 0, Math.PI * 2);
  ctx.stroke();

  // Inner card
  ctx.fillStyle = "#0B1220";
  ctx.beginPath();
  ctx.arc(n.x, n.y, 60, 0, Math.PI * 2);
  ctx.fill();

  // Label
  ctx.font = "900 18px monospace";
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(n.label, n.x, n.y - 6);

  // Tag
  ctx.font = "700 10px monospace";
  ctx.fillStyle = n.color;
  ctx.fillText(n.tag, n.x, n.y + 16);

  ctx.restore();
}

// Editorial Title Overlay (Top Left & Center)
// Kicker
ctx.font = "800 16px monospace";
ctx.fillStyle = "#15F5BA";
ctx.textAlign = "left";
ctx.letterSpacing = "0.1em";
ctx.fillText("EXPLAINER MOTION // 01 · 60s 1080×1920 30FPS CFR", 120, 130);

// Main Big Title
ctx.font = "900 68px sans-serif";
ctx.fillStyle = "#FFFFFF";
ctx.fillText("MÁQUINAS DE ESTADOS", 120, 210);

// Subtitle
ctx.font = "500 24px sans-serif";
ctx.fillStyle = "#94A3B8";
ctx.fillText("Quando o movimento explica a lógica.", 120, 260);

// Top Right Tech Badges
const badgeX = 1420;
const badges = ["DETERMINISTIC CFR", "CANVAS 2D", "PLAYWRIGHT", "FFMPEG"];
let bx = 1800;
for (const b of badges.reverse()) {
  ctx.font = "700 12px monospace";
  const w = ctx.measureText(b).width;
  bx -= (w + 24);
  ctx.fillStyle = "rgba(14, 22, 38, 0.85)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  roundRect(ctx, bx, 110, w + 18, 30, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#CBD5E1";
  ctx.textAlign = "center";
  ctx.fillText(b, bx + (w + 18)/2, 130);
  bx -= 10;
}

// Bottom Telemetry Bar
ctx.fillStyle = "rgba(11, 18, 32, 0.85)";
ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
ctx.lineWidth = 1;
roundRect(ctx, 120, 970, 1680, 50, 8);
ctx.fill();
ctx.stroke();

ctx.font = "600 13px monospace";
ctx.fillStyle = "#15F5BA";
ctx.textAlign = "left";
ctx.fillText("● PIPELINE DETERMINÍSTICO", 150, 1000);

ctx.fillStyle = "#64748B";
ctx.fillText("FRAME N É SEMPRE IGUAL · 1.800 QUADROS · BIT-FOR-BIT REPRODUCIBLE · MOTION STUDIO", 400, 1000);

ctx.fillStyle = "#FF8A00";
ctx.textAlign = "right";
ctx.fillText("RELEASE CANDIDATE v4", 1770, 1000);
</script>
</body>
</html>`;

  await fs.writeFile(thumbHtmlPath, thumbHtml, "utf-8");
  await page169.goto("file://" + thumbHtmlPath);
  await page169.waitForTimeout(300);

  const thumbOutLanding = path.join(actDir, "thumb-16x9.png");
  const thumbOutProject = path.resolve("projects/explainer-state-machine/out/thumb-16x9.png");
  
  await page169.screenshot({ path: thumbOutLanding });
  await fs.copyFile(thumbOutLanding, thumbOutProject);
  console.log(`✓ Thumbnail horizontal 16:9 salvo em:`);
  console.log(`  - ${thumbOutLanding}`);
  console.log(`  - ${thumbOutProject}`);

  await browser.close();
  console.log("🎉 Todos os assets gráficos foram gerados com sucesso!");
}

main().catch(console.error);
