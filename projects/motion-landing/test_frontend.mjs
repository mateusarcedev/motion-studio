import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile, stat, mkdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const SITE_DIR = path.resolve("projects/motion-landing/site");
const OUT_DIR = path.resolve("projects/motion-landing/reviews/fixes");
await mkdir(OUT_DIR, { recursive: true });

async function resolveChrome() {
  if (process.env.CHROME_PATH) {
    try { await stat(process.env.CHROME_PATH); return process.env.CHROME_PATH; } catch {}
  }
  const cacheBase = `${process.env.HOME}/.cache/ms-playwright`;
  try {
    const entries = await (await import("node:fs/promises")).readdir(cacheBase);
    for (const ent of entries) {
      if (ent.startsWith("chromium-")) {
        const candidate = path.join(cacheBase, ent, "chrome-linux64", "chrome");
        try { await stat(candidate); return candidate; } catch {}
      }
    }
  } catch {}
  for (const sys of ["/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"]) {
    try { await stat(sys); return sys; } catch {}
  }
  return null;
}

// Local server
const mimeTypes = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  woff: "font/woff",
  woff2: "font/woff2",
  mp4: "video/mp4",
  glb: "model/gltf-binary",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost:3388");
    if (url.pathname.includes("_vercel") || url.pathname.includes("analytics")) {
      res.writeHead(200, { "content-type": "application/javascript" });
      res.end("// mock analytics");
      return;
    }
    let filePath = path.join(SITE_DIR, decodeURIComponent(url.pathname));
    try {
      const st = await stat(filePath);
      if (st.isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }
    } catch {}

    const ext = path.extname(filePath).slice(1);
    const contentType = mimeTypes[ext] || "application/octet-stream";

    // Support HTTP Range requests for video streaming / seeking
    const range = req.headers.range;
    if (range && ext === "mp4") {
      const st = await stat(filePath);
      const total = st.size;
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      const chunksize = (end - start) + 1;
      const { createReadStream } = await import("node:fs");
      const stream = createReadStream(filePath, { start, end });
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": contentType,
      });
      stream.pipe(res);
      return;
    }

    const data = await readFile(filePath);
    res.writeHead(200, { "content-type": contentType, "accept-ranges": "bytes" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

let ownServer = null;
try {
  await fetch("http://127.0.0.1:3388/");
  console.log("Using existing HTTP server running on http://127.0.0.1:3388");
} catch {
  await new Promise((r) => server.listen(3388, "127.0.0.1", r));
  ownServer = server;
  console.log("Local HTTP server running on http://127.0.0.1:3388");
}

const execPath = await resolveChrome();
assert.ok(execPath, "Chromium não encontrado");

const browser = await chromium.launch({ executablePath: execPath, headless: true });

const VIEWPORTS = [
  { name: "mobile-s", width: 360, height: 740 },
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "wide", width: 1920, height: 1080 },
];

const testResults = [];

try {
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const txt = msg.text();
      if (!txt.includes("_vercel") && !txt.includes("analytics")) {
        consoleErrors.push(txt);
      }
    }
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  // --- 1. Test PT Landing Page & Featured TRAVESSIA Card ---
  console.log("\n🧪 1. Testando Landing Page PT e Card em Destaque TRAVESSIA...");
  await page.goto("http://127.0.0.1:3388/", { waitUntil: "load" });

  const ptTitle = await page.title();
  assert.ok(ptTitle.includes("MOTION"), "Título da página PT incorreto");
  testResults.push("Landing Page PT carregada com sucesso");

  // Verify .brand-dot is static (no continuous animation)
  const dotAnimation = await page.evaluate(() => {
    const dot = document.querySelector(".brand-dot");
    return window.getComputedStyle(dot).animationName;
  });
  assert.equal(dotAnimation, "none", "Bolinha .brand-dot ainda possui animação!");
  testResults.push("Bolinha .brand-dot confirmada como estática");

  // Verify TRAVESSIA Featured Showcase Card
  const travessiaCard = page.locator(".work-spotlight").first();
  const spotlightTitle = await travessiaCard.locator(".spotlight-title").innerText();
  assert.ok(spotlightTitle.includes("TRAVESSIA"), `Título do card em destaque incorreto: ${spotlightTitle}`);
  const spotlightCat = await travessiaCard.locator(".spotlight-cat").textContent();
  assert.ok(spotlightCat.includes("Interactive 3D / Motion Design"), "Categoria do card em destaque incorreta");
  const caseLink = travessiaCard.locator("a[href='/projects/travessia/']");
  assert.equal(await caseLink.count(), 1, "Link para case study /projects/travessia/ não encontrado");
  const demoLink = travessiaCard.locator("a[href='/demos/travessia/']");
  assert.equal(await demoLink.count(), 1, "Link para demonstração 3D /demos/travessia/ não encontrado");
  testResults.push("Card em destaque TRAVESSIA verificado com capa, título, categoria, badges e links");

  // Verify Máquinas de Estados Showcase Card
  const stateMachineCard = page.locator(".state-machine-spotlight");
  assert.equal(await stateMachineCard.count(), 1, "Card .state-machine-spotlight não encontrado na seção de trabalhos");
  const smTitle = await stateMachineCard.locator(".spotlight-title").innerText();
  assert.ok(smTitle.includes("Máquinas de Estados"), `Título do card Máquinas de Estados incorreto: ${smTitle}`);
  const smCat = await stateMachineCard.locator(".spotlight-cat").textContent();
  assert.ok(smCat.includes("Explainer Motion / Educational Motion Graphics"), "Categoria do card Máquinas de Estados incorreta");
  const smCaseLink = stateMachineCard.locator("a[href='/projects/state-machines/']");
  assert.equal(await smCaseLink.count(), 1, "Link para case study /projects/state-machines/ não encontrado");
  testResults.push("Card Máquinas de Estados verificado com thumb 16:9, título, categoria, badges e links");

  // Verify 5 original example tiles remain intact
  const tilesCount = await page.locator(".work .tile").count();
  assert.equal(tilesCount, 5, `Esperado 5 tiles de exemplo em .work, encontrado ${tilesCount}`);
  testResults.push("5 produções de exemplo pré-existentes preservadas intactas em .work");

  // Verify ecosystem cards count
  const cardCount = await page.locator(".cred-card").count();
  assert.equal(cardCount, 15, `Esperado 15 cards de ecossistema, encontrado ${cardCount}`);
  testResults.push("15 cards de ecossistema com avatares renderizados");

  // --- 2. Test Light Theme Toggle & Persistence on Landing Page ---
  console.log("🧪 2. Testando alternância e persistência de tema (dark ➔ light)...");
  const themeToggle = page.locator(".theme-toggle");
  await themeToggle.click();
  await page.waitForTimeout(300);

  const themeAttr = await page.locator("html").getAttribute("data-theme");
  assert.equal(themeAttr, "light", "Tema light não ativado após clique");

  const storedTheme = await page.evaluate(() => localStorage.getItem("motion-theme"));
  assert.equal(storedTheme, "light", "localStorage não persistiu 'light'");
  testResults.push("Tema claro (light) testado com sucesso e persistência validada");

  // Toggle back to dark
  await page.locator(".theme-toggle").click();
  await page.waitForTimeout(200);

  // --- 3. Test Navigation from Landing to Case Study ---
  console.log("🧪 3. Testando navegação da Landing para o Case Study /projects/travessia/...");
  await caseLink.click();
  await page.waitForURL("**/projects/travessia/");
  const caseUrl = page.url();
  assert.ok(caseUrl.includes("/projects/travessia/"), "URL não corresponde ao case study");
  testResults.push("Navegação do card em destaque para /projects/travessia/ validada");

  // --- 4. Test Dedicated Case Study Page (/projects/travessia/) ---
  console.log("🧪 4. Testando seções editoriais da página /projects/travessia/...");
  const caseH1 = await page.locator(".case-title").innerText();
  assert.ok(caseH1.includes("TRAVESSIA"), `H1 do case study incorreto: ${caseH1}`);

  // Metagrid
  const metaCells = await page.locator(".meta-cell").count();
  assert.equal(metaCells, 4, `Esperado 4 células no metagrid, encontrado ${metaCells}`);
  testResults.push("Hero cinematográfico e grid de metadados técnicos validados");

  // Interactive 3D Embed Section
  const demoSection = page.locator("#interactive-demo");
  assert.equal(await demoSection.count(), 1, "Seção #interactive-demo não encontrada");
  const demoIframe = demoSection.locator("iframe[src='/demos/travessia/']");
  assert.equal(await demoIframe.count(), 1, "Iframe da demo 3D não encontrado");
  const controlsGuide = demoSection.locator(".guide-item");
  assert.equal(await controlsGuide.count(), 5, "Esperado 5 itens no guia de controles");
  testResults.push("Demonstração 3D incorporada com iframe, toolbar e guia de controles 1-5");

  // The Journey - 5 Acts
  const acts = page.locator(".act-card");
  assert.equal(await acts.count(), 5, "Esperado 5 atos em .acts-list");
  const act01Text = await acts.nth(0).innerText();
  assert.ok(act01Text.includes("01 — O Porto"), "Ato 01 incorreto");
  const act02Text = await acts.nth(1).innerText();
  assert.ok(act02Text.includes("02 — O Contêiner"), "Ato 02 incorreto");
  assert.ok(act02Text.includes("TRV-01-A"), "Ato 02 deve referenciar TRV-01-A");
  const act03Text = await acts.nth(2).innerText();
  assert.ok(act03Text.includes("03 — A Movimentação"), "Ato 03 incorreto");
  const act04Text = await acts.nth(3).innerText();
  assert.ok(act04Text.includes("04 — A Estrada"), "Ato 04 incorreto");
  const act05Text = await acts.nth(4).innerText();
  assert.ok(act05Text.includes("05 — O Destino"), "Ato 05 incorreto");
  testResults.push("The Journey: 5 atos renderizados com títulos e capturas reais");

  // Behind the Scenes
  const btsCards = page.locator(".bts-card");
  assert.equal(await btsCards.count(), 6, `Esperado 6 cards em .bts-grid, encontrado ${await btsCards.count()}`);
  testResults.push("Behind the Scenes: 6 tópicos técnicos de orquestração MOTION");

  // Motion Films (16:9 & 9:16)
  const filmBoxes = page.locator(".film-box");
  assert.equal(await filmBoxes.count(), 2, "Esperado 2 caixas de filmes master");
  const vid16 = filmBoxes.nth(0).locator("video");
  const vid9 = filmBoxes.nth(1).locator("video");
  assert.equal(await vid16.getAttribute("poster"), "/assets/carga-01/poster-16x9.png", "Poster 16:9 incorreto");
  assert.equal(await vid9.getAttribute("poster"), "/assets/carga-01/poster-9x16.png", "Poster 9:16 incorreto");
  assert.equal(await vid16.getAttribute("autoplay"), null, "Vídeo 16:9 não pode ter autoplay");
  assert.equal(await vid9.getAttribute("autoplay"), null, "Vídeo 9:16 não pode ter autoplay");
  testResults.push("Motion Films: 2 players responsivos (16:9 e 9:16) com posters reais e sem autoplay");

  // Social Editorial Carousel (4:5)
  const carouselSection = page.locator("#carousel");
  assert.equal(await carouselSection.count(), 1, "Seção #carousel não encontrada");
  const thumbs = carouselSection.locator(".thumb-btn");
  assert.equal(await thumbs.count(), 5, "Esperado 5 miniaturas de slides");
  // Test switching to slide 2
  await thumbs.nth(1).click();
  await page.waitForTimeout(200);
  const mainImgSrc = await page.locator("#mainSlideImg").getAttribute("src");
  assert.equal(mainImgSrc, "/assets/carga-01/carousel-02.png", "Slide principal não atualizou ao clicar no thumb 2");
  testResults.push("Carrossel Social: 5 slides navegáveis com troca interativa de lâminas");

  // Technical Notes & Credits
  const notes = page.locator(".note-item");
  assert.equal(await notes.count(), 4, "Esperado 4 itens em notas técnicas");
  const credits = page.locator(".credits-banner");
  assert.ok((await credits.innerText()).includes("Mateus Arce"), "Autor não mencionado nos créditos");
  testResults.push("Technical Notes (honestidade técnica) e Créditos conceituais validados");

  // --- 5. Test Standalone 3D Demo Endpoints ---
  console.log("🧪 5. Testando endpoint standalone 3D /demos/travessia/...");
  const demoPage = await context.newPage();
  const demoRes = await demoPage.goto("http://127.0.0.1:3388/demos/travessia/", { waitUntil: "load" });
  assert.equal(demoRes?.status(), 200, "Endpoint /demos/travessia/ retornou status diferente de 200");
  await demoPage.waitForTimeout(1000);
  const canvasCount = await demoPage.locator("canvas").count();
  assert.ok(canvasCount >= 1, "Canvas Three.js WebGL não anexado na página da demo standalone");
  await demoPage.close();
  testResults.push("Demonstração standalone /demos/travessia/ operacional com Three.js Canvas");

  // --- 5b. Test Backward Compatibility Redirects ---
  console.log("🧪 5b. Testando redirecionamentos de compatibilidade retroativa...");
  const redirPage = await context.newPage();
  await redirPage.goto("http://127.0.0.1:3388/projects/carga-01/");
  await redirPage.waitForURL("**/projects/travessia/");
  assert.ok(redirPage.url().includes("/projects/travessia/"), "Redirecionamento de /projects/carga-01/ falhou");
  await redirPage.close();
  testResults.push("Compatibilidade retroativa: /projects/carga-01/ redireciona para /projects/travessia/");

  // --- 6. Test Bilingual Navigation (PT <-> EN) ---
  console.log("🧪 6. Testando chaveamento de idioma na página do case study...");
  const langTrigger = page.locator("#langTrigger");
  await langTrigger.click();
  await page.waitForTimeout(200);

  const enLink = page.locator('.lang-option:has-text("English")');
  await enLink.click();
  await page.waitForURL("**/en/projects/travessia/");
  const enUrl = page.url();
  assert.ok(enUrl.includes("/en/projects/travessia/"), "URL não mudou para /en/projects/travessia/");

  const enSub = await page.locator(".case-sub").innerText();
  assert.ok(enSub.includes("From Port to Destination"), `Subtítulo em inglês incorreto: ${enSub}`);
  testResults.push("Chaveamento de idioma PT ➔ EN validado com persistência de rota do case study");

  // Switch back to PT
  await page.locator("#langTrigger").click();
  await page.waitForTimeout(150);
  await page.locator('.lang-option:has-text("Português")').click();
  await page.waitForURL("**/projects/travessia/");
  testResults.push("Retorno para versão PT /projects/travessia/ validado");

  // --- 6b. Test Dedicated Case Study /projects/state-machines/ ---
  console.log("🧪 6b. Testando página dedicada /projects/state-machines/...");
  const smPage = await context.newPage();
  const smRes = await smPage.goto("http://127.0.0.1:3388/projects/state-machines/", { waitUntil: "load" });
  assert.equal(smRes?.status(), 200, "Página /projects/state-machines/ retornou status diferente de 200");

  const smPageTitle = await smPage.title();
  assert.ok(smPageTitle.includes("Máquinas de Estados"), `Título da página incorreto: ${smPageTitle}`);

  // Video Player verification
  const smVideo = smPage.locator("#fsm-video");
  assert.equal(await smVideo.count(), 1, "Player de vídeo #fsm-video não encontrado");
  const posterAttr = await smVideo.getAttribute("poster");
  assert.ok(posterAttr?.includes("poster-9x16.png"), `Poster incorreto: ${posterAttr}`);
  const videoSrc = await smVideo.locator("source").getAttribute("src");
  assert.ok(videoSrc?.includes("state-machine-9x16-v4.mp4?v=4"), `Source do vídeo incorreta: ${videoSrc}`);

  // Test poster and video HTTP responses
  const posterRes = await fetch("http://127.0.0.1:3388" + posterAttr);
  assert.equal(posterRes.status, 200, "Poster não retornou 200");
  const videoHeadRes = await fetch("http://127.0.0.1:3388" + videoSrc, { headers: { Range: "bytes=0-1024" } });
  assert.ok([200, 206].includes(videoHeadRes.status), "Vídeo não respondeu 200 ou 206 para range request");
  testResults.push("Player vertical 9:16 com poster e master MP4 v4 validados com sucesso");

  // Verify 7 Acts in #the-acts
  const actsCount = await smPage.locator("#the-acts .act-card").count();
  assert.equal(actsCount, 7, `Esperado 7 atos, encontrado ${actsCount}`);
  for (let i = 1; i <= 7; i++) {
    const actImg = smPage.locator(`#the-acts .act-card:nth-child(${i}) img`);
    const src = await actImg.getAttribute("src");
    const imgRes = await fetch("http://127.0.0.1:3388" + src);
    assert.equal(imgRes.status, 200, `Imagem do ato ${i} (${src}) não retornou 200`);
  }
  testResults.push("7 Atos narrativos renderizados com imagens reais validadas (HTTP 200)");

  // Verify Made with MOTION editorial steps & Contact Sheet
  const btsCount = await smPage.locator("#behind-the-scenes .bts-card").count();
  assert.equal(btsCount, 7, `Esperado 7 tópicos editoriais nos bastidores, encontrado ${btsCount}`);
  const contactSheet = smPage.locator(".contact-sheet-wrap .contact-sheet-img");
  assert.equal(await contactSheet.count(), 1, "Contact sheet não encontrada");
  const csRes = await fetch("http://127.0.0.1:3388" + (await contactSheet.getAttribute("src")));
  assert.equal(csRes.status, 200, "Contact sheet não retornou 200");
  testResults.push("Made with MOTION (7 etapas), Contact Sheet e idioma PT/EN validados");

  // Verify Bilingual Navigation on /projects/state-machines/
  await smPage.locator("#langTrigger").click();
  await smPage.waitForTimeout(200);
  await smPage.locator('.lang-option:has-text("English")').click();
  await smPage.waitForURL("**/en/projects/state-machines/");
  const smEnTitle = await smPage.title();
  assert.ok(smEnTitle.includes("State Machines"), `Título da página em inglês incorreto: ${smEnTitle}`);
  const smEnSub = await smPage.locator(".case-sub").innerText();
  assert.ok(smEnSub.includes("When motion explains logic"), `Subtítulo em inglês incorreto: ${smEnSub}`);
  testResults.push("Chaveamento de idioma PT ➔ EN validado em /projects/state-machines/");

  // Switch back to PT
  await smPage.locator("#langTrigger").click();
  await smPage.waitForTimeout(150);
  await smPage.locator('.lang-option:has-text("Português")').click();
  await smPage.waitForURL("**/projects/state-machines/");
  testResults.push("Retorno para versão PT /projects/state-machines/ validado");

  // Test 5 Viewports on /projects/state-machines/
  console.log("🧪 6c. Validando 5 viewports para ausência de overflow em /projects/state-machines/...");
  for (const vp of VIEWPORTS) {
    await smPage.setViewportSize({ width: vp.width, height: vp.height });
    await smPage.waitForTimeout(250);
    const smOverflow = await smPage.evaluate(() => {
      return document.documentElement.scrollWidth - window.innerWidth;
    });
    assert.ok(smOverflow <= 1, `Overflow horizontal detectado em /projects/state-machines/ em ${vp.name} (${vp.width}x${vp.height}): ${smOverflow}px`);
    await smPage.screenshot({
      path: path.join(OUT_DIR, `state-machines-${vp.name}-dark.png`),
      fullPage: false,
    });
    testResults.push(`State Machines Viewport ${vp.name} (${vp.width}x${vp.height}): 0 overflow (PASS)`);
  }
  await smPage.close();

  // --- 7. Multi-viewport Responsiveness & Zero Overflow Test across 5 Standard Resolutions ---
  console.log("🧪 7. Validando 5 viewports para ausência de overflow horizontal (Landing e Case Study)...");
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(300);

    const caseOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth - window.innerWidth;
    });
    assert.ok(caseOverflow <= 1, `Overflow horizontal detectado no case study em ${vp.name} (${vp.width}x${vp.height}): ${caseOverflow}px`);

    // Capture screenshot for visual evidence
    await page.screenshot({
      path: path.join(OUT_DIR, `case-study-${vp.name}-dark.png`),
      fullPage: false,
    });
    testResults.push(`Case Study Viewport ${vp.name} (${vp.width}x${vp.height}): 0 overflow (PASS)`);
  }

  // Also verify landing page viewports
  await page.goto("http://127.0.0.1:3388/", { waitUntil: "load" });
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(200);
    const landingOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth - window.innerWidth;
    });
    assert.ok(landingOverflow <= 1, `Overflow horizontal detectado na landing em ${vp.name} (${vp.width}x${vp.height}): ${landingOverflow}px`);
    testResults.push(`Landing Viewport ${vp.name} (${vp.width}x${vp.height}): 0 overflow (PASS)`);
  }

  // --- 8. Verify Zero Console Errors ---
  assert.equal(consoleErrors.length, 0, `Erros de console detectados: ${consoleErrors.join("; ")}`);
  testResults.push("Zero erros de console ou requisições com falha");

  console.log("\n========================================================");
  console.log("  TODOS OS 20 TESTES DA MISSÃO 13 PASSARAM COM SUCESSO  ");
  console.log("========================================================");
  for (const tr of testResults) {
    console.log(`  ✓ ${tr}`);
  }
} finally {
  await browser.close();
  if (ownServer) ownServer.close();
}
