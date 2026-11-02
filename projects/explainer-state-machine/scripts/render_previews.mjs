import { chromium } from "playwright-core";
import { stat, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execAsync = promisify(execFile);

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

const PREVIEWS_V4 = [
  { name: "preview_guardas_logicas_25_34", start: 750, end: 870, desc: "Ato 4 · Guardas Lógicas e Portal" },
  { name: "preview_estados_finitos_8_16", start: 240, end: 360, desc: "Ato 2 · Estados Finitos e Contraste Inativo" },
  { name: "preview_transicao_invalida_34_43", start: 1080, end: 1200, desc: "Ato 5 · Transição Inválida e Deflexão" },
  { name: "preview_encerramento_52_60", start: 1560, end: 1680, desc: "Ato 7 · Encerramento e Síntese FSM" },
];

async function main() {
  const previewsDir = path.resolve("projects/explainer-state-machine/reviews/previews_v4");
  await mkdir(previewsDir, { recursive: true });

  const execPath = await resolveChrome();
  const browser = await chromium.launch({ executablePath: execPath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });

  const compPath = path.resolve("projects/explainer-state-machine/composition.html");
  await page.goto(`file://${compPath}`, { waitUntil: "load" });
  await page.waitForTimeout(200);

  for (const prev of PREVIEWS_V4) {
    const tempDir = path.join(previewsDir, `temp_${prev.name}`);
    await mkdir(tempDir, { recursive: true });
    console.log(`🎬 Renderizando preview ${prev.name} (${prev.start} -> ${prev.end}): ${prev.desc}...`);

    for (let f = prev.start; f <= prev.end; f++) {
      await page.evaluate((frame) => window.__onFrame__(frame, 1800, 30), f);
      const frameNum = String(f - prev.start).padStart(5, "0");
      await page.screenshot({ path: path.join(tempDir, `frame_${frameNum}.png`) });
    }

    const outMp4 = path.join(previewsDir, `${prev.name}.mp4`);
    await execAsync("ffmpeg", [
      "-y",
      "-framerate", "30",
      "-i", path.join(tempDir, "frame_%05d.png"),
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-crf", "18",
      outMp4
    ]);
    console.log(`  ✓ Gerado: ${outMp4}`);
    await execAsync("rm", ["-rf", tempDir]);
  }

  await browser.close();
  console.log("✓ Todas as prévias de movimento v4 foram geradas com sucesso!");
}

main().catch(console.error);
