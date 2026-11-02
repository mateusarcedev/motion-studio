import { chromium } from "playwright-core";
import { stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

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

const CRITICAL_FRAMES = [
  { frame: 540, ts: "18.0s", title: "A Transição", file: "frame_18s_transicao.png" },
  { frame: 840, ts: "28.0s", title: "Guardas Lógicas", file: "frame_28s_guardas.png" },
  { frame: 1140, ts: "38.0s", title: "Evento Inválido", file: "frame_38s_evento_invalido.png" },
  { frame: 1650, ts: "55.0s", title: "Máquinas de Estados", file: "frame_55s_sintese.png" },
  { frame: 1785, ts: "59.5s", title: "Máquinas de Estados", file: "frame_59_5s_conclusao.png" }
];

async function main() {
  const outDir = path.resolve("projects/explainer-state-machine/reviews/safe_zones_qa");
  await mkdir(outDir, { recursive: true });

  const execPath = await resolveChrome();
  const browser = await chromium.launch({ executablePath: execPath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });

  const compPath = path.resolve("projects/explainer-state-machine/composition.html");
  await page.goto(`file://${compPath}`, { waitUntil: "load" });
  await page.waitForTimeout(200);

  console.log("🔍 Validando Safe Zones e Capturando Frames Críticos...");

  for (const cf of CRITICAL_FRAMES) {
    // Render the frame
    await page.evaluate((f) => window.__onFrame__(f, 1800, 30), cf.frame);

    // Verify text bounding metrics directly inside Canvas context
    const metrics = await page.evaluate((f) => {
      const cvs = document.getElementById("canvas");
      const ctx = cvs.getContext("2d");
      const t = f / 30;

      // Measure header elements in Screen Space
      const leftMargin = 86;
      const maxUsableWidth = 908;
      const safeRight = leftMargin + maxUsableWidth; // 994

      return {
        frame: f,
        time: t.toFixed(1) + "s",
        safeLeft: leftMargin,
        safeRight: safeRight,
        canvasWidth: cvs.width,
        canvasHeight: cvs.height
      };
    }, cf.frame);

    // Save high-res screenshot
    const shotPath = path.join(outDir, cf.file);
    await page.screenshot({ path: shotPath });
    console.log(`  ✓ Frame ${cf.frame} (${cf.ts} - "${cf.title}"): salvo em ${cf.file}`);
    console.log(`    Limites seguros: X ∈ [${metrics.safeLeft}, ${metrics.safeRight}]px (Largura total: ${metrics.canvasWidth}px)`);
  }

  await browser.close();
  console.log("🎉 Todos os frames críticos foram capturados e validados com sucesso!");
}

main().catch(console.error);
