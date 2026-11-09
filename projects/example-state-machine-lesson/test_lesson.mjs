import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lessonFile = path.join(__dirname, "lesson.html");
const reviewsDir = path.join(__dirname, "reviews");
await mkdir(reviewsDir, { recursive: true });

async function resolveChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  try {
    const pw = await import("playwright-core");
    const ep = pw.chromium.executablePath();
    if (ep) return ep;
  } catch {}
  return undefined;
}

const executablePath = await resolveChrome();
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--allow-file-access-from-files"]
});

try {
  console.log("🎬 Iniciando testes automatizados da Aula Interativa...");
  
  // 1. DESKTOP RUN & VALIDATION
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });

  const fileUrl = pathToFileURL(lessonFile).href;
  await page.goto(fileUrl, { waitUntil: "load" });
  await page.waitForFunction(() => window.lesson && window.lesson.ready === true);

  console.log("  ✔ Página carregada e player inicializado com sucesso");

  // Verify Slide 0 (Intro)
  let title = await page.$eval('[data-player="title"]', el => el.textContent.trim());
  assert.ok(title.includes("Sopa Booleana"), `Slide 0 title mismatch: ${title}`);
  await page.screenshot({ path: path.join(reviewsDir, "slide-0-intro.png") });

  // Test seek to step 1 and step 2
  await page.evaluate(() => window.lesson.seek({ slide: 0, step: 1 }));
  let caption1 = await page.$eval('[data-player="caption"]', el => el.textContent.trim());
  assert.ok(caption1.includes("loading") && caption1.includes("success"), "Step 1 caption expected contradictory loading/success");

  // Advance to Slide 1 (Grafo de Estados)
  await page.evaluate(() => window.lesson.seek({ slide: 1, step: 0 }));
  title = await page.$eval('[data-player="title"]', el => el.textContent.trim());
  assert.ok(title.includes("Grafo de Estados"), `Slide 1 title mismatch: ${title}`);
  await page.screenshot({ path: path.join(reviewsDir, "slide-1-grafo.png") });

  // Advance to Slide 2 (Mecanismo Funcional)
  await page.evaluate(() => window.lesson.seek({ slide: 2, step: 0, inputs: { status: "IDLE" } }));
  let curState = await page.$eval('[data-qa-text="current-state"]', el => el.textContent.trim());
  assert.strictEqual(curState, "IDLE", "Initial state must be IDLE");
  
  // Test dynamic input change in mechanism
  await page.evaluate(() => window.lesson.seek({ slide: 2, step: 0, inputs: { status: "LOADING" } }));
  curState = await page.$eval('[data-qa-text="current-state"]', el => el.textContent.trim());
  assert.strictEqual(curState, "LOADING", "State must update dynamically to LOADING");
  await page.screenshot({ path: path.join(reviewsDir, "slide-2-mecanismo.png") });

  // Advance to Slide 3 (Quiz / Prática)
  await page.evaluate(() => window.lesson.seek({ slide: 3, step: 0 }));
  let continueBtn = await page.$('[data-player="continue"]');
  let isDisabled = await continueBtn.isDisabled();
  assert.strictEqual(isDisabled, true, "Continuar button MUST be disabled before selecting an answer");

  // Select wrong answer 'direto-sucesso'
  await page.click('[data-choice="a"][data-value="direto-sucesso"]');
  isDisabled = await continueBtn.isDisabled();
  assert.strictEqual(isDisabled, false, "Selecting an answer unlocks Continuar button");

  // Check step 1 with wrong answer
  await page.click('[data-player="continue"]');
  await page.waitForFunction(() => !window.lesson.playing);
  let feedbackText = await page.$eval('[data-qa-text="feedback"]', el => el.textContent.trim());
  assert.ok(feedbackText.startsWith("Incorreto:"), `Expected incorrect feedback, got: ${feedbackText}`);
  let isWrongClass = await page.$eval('[data-qa-text="feedback"]', el => el.classList.contains("wrong"));
  assert.strictEqual(isWrongClass, true, "Feedback must have .wrong class");
  await page.screenshot({ path: path.join(reviewsDir, "slide-3-quiz-wrong.png") });

  // Now change choice to correct answer 'correto-retry'
  await page.click('[data-choice="a"][data-value="correto-retry"]');
  feedbackText = await page.$eval('[data-qa-text="feedback"]', el => el.textContent.trim());
  assert.ok(feedbackText.startsWith("Correto!"), `Expected correct feedback, got: ${feedbackText}`);
  await page.screenshot({ path: path.join(reviewsDir, "slide-3-quiz-correct.png") });

  // Advance to Slide 4 (Resumo e Cards)
  await page.evaluate(() => window.lesson.seek({ slide: 4, step: 0 }));
  title = await page.$eval('[data-player="title"]', el => el.textContent.trim());
  assert.ok(title.includes("Três Princípios"), `Slide 4 title mismatch: ${title}`);
  let cardsCount = await page.$$eval('.sc-card', els => els.length);
  assert.strictEqual(cardsCount, 3, "Expected 3 summary cards");
  await page.screenshot({ path: path.join(reviewsDir, "slide-4-resumo.png") });

  console.log("  ✔ Todos os 5 slides, transições, formulários e feedback causal validados no Desktop!");

  // 2. MOBILE RESPONSIVENESS CHECK (390x844)
  console.log("📱 Validando responsividade em Mobile (390×844)...");
  await page.setViewportSize({ width: 390, height: 844 });
  for (let s = 0; s < 5; s++) {
    await page.evaluate((slideIdx) => window.lesson.seek({ slide: slideIdx, step: 0 }), s);
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.strictEqual(hasOverflow, false, `Horizontal overflow detected on slide ${s} in mobile viewport`);
  }
  await page.screenshot({ path: path.join(reviewsDir, "mobile-slide-1-grafo.png") });
  console.log("  ✔ Responsividade mobile aprovada: 0 overflow horizontal em todos os slides.");

  // 3. BUILD CONTACT SHEET REPORT
  console.log("🖼️ Gerando folha de contato (contact sheet) das telas...");
  const contactSheetHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Contact Sheet — Máquinas de Estados em Programação</title>
  <style>
    body { font-family:system-ui,sans-serif; background:#0e0e0e; color:#fff; padding:24px; }
    h1 { font-size:24px; color:#10B981; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px; }
    .card { background:#1a1a1a; border:1px solid #232323; border-radius:12px; padding:12px; }
    img { width:100%; border-radius:8px; border:1px solid #333; }
    figcaption { font-size:13px; color:#94A3B8; margin-top:8px; font-weight:600; }
  </style>
</head>
<body>
  <h1>Folha de Contato — Máquinas de Estados (Aula Interativa)</h1>
  <p>Inspeção visual dos 5 slides produzidos pelo pipeline da especialidade <code>aula-interativa</code>.</p>
  <div class="grid">
    <div class="card"><img src="slide-0-intro.png"><figcaption>Slide 01 — O Problema da Sopa Booleana</figcaption></div>
    <div class="card"><img src="slide-1-grafo.png"><figcaption>Slide 02 — O Grafo de Estados e Transições</figcaption></div>
    <div class="card"><img src="slide-2-mecanismo.png"><figcaption>Slide 03 — Painel de Execução Runtime</figcaption></div>
    <div class="card"><img src="slide-3-quiz-correct.png"><figcaption>Slide 04 — Exercício com Feedback Causal</figcaption></div>
    <div class="card"><img src="slide-4-resumo.png"><figcaption>Slide 05 — Síntese e Princípios de Produção</figcaption></div>
    <div class="card"><img src="mobile-slide-1-grafo.png"><figcaption>Mobile — Recomposição em 390px</figcaption></div>
  </div>
</body>
</html>`;
  await writeFile(path.join(reviewsDir, "contact-sheet.html"), contactSheetHtml, "utf-8");

  // Capture rendered contact sheet PNG
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(pathToFileURL(path.join(reviewsDir, "contact-sheet.html")).href, { waitUntil: "load" });
  await page.screenshot({ path: path.join(reviewsDir, "contact-sheet.png"), fullPage: true });

  console.log("✅ Validação da Aula Interativa concluída com 100% de sucesso!");
  await browser.close();
} catch (err) {
  console.error("❌ Erro no teste da aula interativa:", err);
  await browser.close();
  process.exit(1);
}
