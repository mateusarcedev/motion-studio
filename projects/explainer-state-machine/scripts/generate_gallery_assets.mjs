import { chromium } from "playwright-core";
import { stat, mkdir, copyFile } from "node:fs/promises";
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

async function main() {
  const outDir = path.resolve("projects/explainer-state-machine/out");
  await mkdir(outDir, { recursive: true });

  const execPath = await resolveChrome();
  const browser = await chromium.launch({ executablePath: execPath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });

  const compPath = path.resolve("projects/explainer-state-machine/composition.html");
  await page.goto(`file://${compPath}`, { waitUntil: "load" });
  await page.waitForTimeout(200);

  // 1. Generate Vertical Poster (Frame 300 - 10.0s, O Grafo Discreto)
  console.log("🎨 Gerando poster-9x16.png (Vertical 1080x1920)...");
  await page.evaluate(() => window.__onFrame__(300, 1800, 30));
  await page.waitForTimeout(100);
  const posterPath = path.join(outDir, "poster-9x16.png");
  await page.screenshot({ path: posterPath });
  console.log(`  ✓ Poster vertical salvo: ${posterPath}`);

  // 2. Generate Horizontal Gallery Thumbnail (1920x1080, thumb-16x9.png)
  // Crop & scale around the graph center (X: 540, Y: 1040)
  console.log("🎨 Gerando thumb-16x9.png (Horizontal 1920x1080)...");
  const thumbPath = path.join(outDir, "thumb-16x9.png");
  await execAsync("ffmpeg", [
    "-y",
    "-i", posterPath,
    "-vf", "crop=1080:608:0:700,scale=1920:1080:flags=lanczos",
    thumbPath
  ]);
  console.log(`  ✓ Thumbnail horizontal 16:9 salvo: ${thumbPath}`);

  await browser.close();
}

main().catch(console.error);
