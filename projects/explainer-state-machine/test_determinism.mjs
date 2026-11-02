import { chromium } from "playwright-core";
import { stat, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import crypto from "crypto";
import assert from "node:assert/strict";

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
  console.log("🧪 1. Iniciando teste de determinismo e integridade de renderização...");
  const execPath = await resolveChrome();
  const browser = await chromium.launch({ executablePath: execPath, headless: true });

  const compPath = path.resolve("projects/explainer-state-machine/composition.html");
  const fileUrl = `file://${compPath}`;

  // 1. Check for console errors
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const consoleErrors = [];
  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto(fileUrl, { waitUntil: "load" });
  await page.waitForTimeout(300);

  assert.equal(consoleErrors.length, 0, `Erros de console detectados: ${consoleErrors.join("; ")}`);
  console.log("  ✓ Página carregada com ZERO erros de console.");

  // 2. Test isolated frame vs sequential batch frame (Frame 450 = 15.0s, Scene 2)
  console.log("🧪 2. Testando determinismo do Frame 450 (15.0s) isolado vs sequencial...");

  // Capture frame 450 directly
  await page.evaluate(() => window.__onFrame__(450, 1800, 30));
  await page.waitForTimeout(100);
  const bufIsolated = await page.screenshot({ type: "png" });
  const hashIsolated = crypto.createHash("sha256").update(bufIsolated).digest("hex");

  // Run sequential frames (simulate batch 445 -> 446 -> ... -> 450)
  for (let f = 440; f <= 450; f++) {
    await page.evaluate((curr) => window.__onFrame__(curr, 1800, 30), f);
  }
  await page.waitForTimeout(100);
  const bufBatch = await page.screenshot({ type: "png" });
  const hashBatch = crypto.createHash("sha256").update(bufBatch).digest("hex");

  assert.equal(hashIsolated, hashBatch, `Divergência detectada no Frame 450! Isolado: ${hashIsolated} vs Sequencial: ${hashBatch}`);
  console.log(`  ✓ Frame 450 estritamente determinístico! Hash SHA-256: ${hashIsolated}`);

  // 3. Test Scene keyframes check
  console.log("🧪 3. Verificando renderização dos 7 atos narrativos...");
  const testFrames = [
    { frame: 60, scene: "Cena 01 (Boolean Soup)" },
    { frame: 300, scene: "Cena 02 (Estados Finitos)" },
    { frame: 600, scene: "Cena 03 (A Transição)" },
    { frame: 900, scene: "Cena 04 (Guardas Lógicas)" },
    { frame: 1140, scene: "Cena 05 (Evento Inválido)" },
    { frame: 1400, scene: "Cena 06 (Ciclo Completo)" },
    { frame: 1700, scene: "Cena 07 (Síntese FSM)" },
  ];

  for (const tf of testFrames) {
    await page.evaluate((curr) => window.__onFrame__(curr, 1800, 30), tf.frame);
    const buf = await page.screenshot({ type: "png" });
    assert(buf.length > 50000, `Buffer vazio ou corrompido para ${tf.scene}`);
    console.log(`  ✓ ${tf.scene} @ frame ${tf.frame}: buffer válido (${Math.round(buf.length / 1024)} KB)`);
  }

  await browser.close();
  console.log("\n🎉 TODOS OS TESTES DE DETERMINISMO PASSARAM COM SUCESSO!");
}

main().catch(err => {
  console.error("❌ Falha no teste de determinismo:", err);
  process.exit(1);
});
