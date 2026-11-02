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

const KEYFRAMES = [
  { frame: 30, ts: "01.0s", name: "01_abertura_flags", desc: "Ato 01 · Flags Booleanas" },
  { frame: 120, ts: "04.0s", name: "02_matriz_combinatoria", desc: "Ato 01 · 16 Combinações 2⁴" },
  { frame: 180, ts: "06.0s", name: "03_conflito_impossivel", desc: "Ato 01 · Colisão de Estado" },
  { frame: 300, ts: "10.0s", name: "04_grafo_discreto", desc: "Ato 02 · Estados Finitos (IDLE)" },
  { frame: 540, ts: "18.0s", name: "05_evento_fetch_particula", desc: "Ato 03 · Transição em Trânsito" },
  { frame: 660, ts: "22.0s", name: "06_fetching_absorvido", desc: "Ato 03 · Nó FETCHING Ativo" },
  { frame: 840, ts: "28.0s", name: "07_guarda_bloqueada", desc: "Ato 04 · Guarda Rejeitada" },
  { frame: 960, ts: "32.0s", name: "08_guarda_aprovada", desc: "Ato 04 · Guarda Aprovada (Menta)" },
  { frame: 1140, ts: "38.0s", name: "09_evento_ilegal_repelido", desc: "Ato 05 · Rejeição de Transição" },
  { frame: 1380, ts: "46.0s", name: "10_ciclo_4_nos_execucao", desc: "Ato 06 · Ciclo Completo (4 Nós)" },
  { frame: 1650, ts: "55.0s", name: "11_sintese_convergencia", desc: "Ato 07 · Síntese e 3 Preceitos" },
  { frame: 1797, ts: "59.9s", name: "12_conclusao_estavel", desc: "Ato 07 · Conclusão FSM" }
];

async function main() {
  const outDir = path.resolve("projects/explainer-state-machine/reviews/keyframes");
  await mkdir(outDir, { recursive: true });

  const execPath = await resolveChrome();
  const browser = await chromium.launch({ executablePath: execPath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });

  const compPath = path.resolve("projects/explainer-state-machine/composition.html");
  await page.goto(`file://${compPath}`, { waitUntil: "load" });
  await page.waitForTimeout(200);

  console.log(`📸 Renderizando ${KEYFRAMES.length} keyframes representativos...`);

  for (const kf of KEYFRAMES) {
    await page.evaluate((f) => window.__onFrame__(f, 1800, 30), kf.frame);
    await page.waitForTimeout(50);
    const dest = path.join(outDir, `${kf.name}.png`);
    await page.screenshot({ path: dest });
    console.log(`  ✓ Keyframe ${kf.name} @ ${kf.ts} (Frame ${kf.frame}): salvo.`);
  }

  await browser.close();
  console.log("✓ Todos os keyframes foram renderizados com sucesso!");
}

main().catch(console.error);
