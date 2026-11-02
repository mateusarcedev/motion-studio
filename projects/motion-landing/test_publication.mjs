import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { mkdir, access, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, request } from "playwright-core";

const landingDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.join(landingDir, "site");
const screenshotDir = path.join(landingDir, "reviews/publication");
let baseUrl;
const viewports = [
  ["mobile-s", 360, 740],
  ["mobile", 390, 844],
  ["tablet", 768, 1024],
  ["desktop", 1440, 900],
  ["wide", 1920, 1080],
];

await mkdir(screenshotDir, { recursive: true });
for (const required of [
  "index.html",
  "en/index.html",
  "projects/state-machines/index.html",
  "en/projects/state-machines/index.html",
]) {
  await access(path.join(siteDir, required));
}

const mime = {
  html: "text/html; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  woff: "font/woff",
  woff2: "font/woff2",
  mp4: "video/mp4",
  xml: "application/xml",
  txt: "text/plain; charset=utf-8",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (pathname.includes("_vercel") || pathname.includes("analytics")) {
      res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" }).end("// local analytics stub");
      return;
    }
    let file = path.resolve(siteDir, `.${pathname}`);
    if (file !== siteDir && !file.startsWith(`${siteDir}${path.sep}`)) {
      res.writeHead(403).end();
      return;
    }
    try {
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    } catch {}
    const info = await stat(file);
    const ext = path.extname(file).slice(1).toLowerCase();
    const headers = {
      "Accept-Ranges": "bytes",
      "Content-Type": mime[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
    };
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (ext === "mp4" && range) {
      const start = Number(range[1]);
      const end = range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
      if (start > end || start >= info.size) {
        res.writeHead(416, { "Content-Range": `bytes */${info.size}` }).end();
        return;
      }
      res.writeHead(206, {
        ...headers,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${info.size}`,
      });
      createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { ...headers, "Content-Length": info.size });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
});
let browser;
const results = { viewports: [], media: {}, navigation: {}, screenshots: [], errors: [] };
const consoleErrors = [];
const pageErrors = [];
const failedLocalRequests = [];
const httpErrors = [];

try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ colorScheme: "dark", reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText || "unknown";
    if (request.url().startsWith(baseUrl) && reason !== "net::ERR_ABORTED") {
      failedLocalRequests.push({ url: request.url(), reason });
    }
  });
  page.on("response", (response) => {
    if (response.url().startsWith(baseUrl) && response.status() >= 400) {
      httpErrors.push({ url: response.url(), status: response.status() });
    }
  });

  for (const [name, width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);

    const landingState = await page.evaluate(() => ({
      title: document.title,
      lang: document.documentElement.lang,
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      stateCardCount: document.querySelectorAll(".state-machine-spotlight").length,
      travessiaCount: [...document.querySelectorAll(".spotlight-title")]
        .filter((node) => node.textContent.includes("TRAVESSIA")).length,
      heroVideoPreload: document.querySelector("#heroVideo")?.preload,
      heroVideoIsMaster: document.querySelector("#heroVideo")?.currentSrc.includes("state-machine"),
    }));
    assert.equal(landingState.lang, "pt-BR");
    assert.equal(landingState.stateCardCount, 1, "State Machines card must appear once");
    assert.equal(landingState.travessiaCount, 1, "TRAVESSIA card must remain present");
    assert.ok(landingState.scrollWidth <= landingState.width, `Home overflow at ${name}`);
    assert.equal(landingState.heroVideoIsMaster, false, "60s master must not be loaded in the home hero");
    await page.locator("img").evaluateAll((images) => Promise.all(
      images.filter((image) => image.currentSrc.startsWith("/")).map((image) => {
        image.loading = "eager";
        return image.decode().catch(() => null);
      }),
    ));
    await page.screenshot({ path: path.join(screenshotDir, `home-${name}.png`) });

    const card = page.locator(".state-machine-spotlight");
    await card.scrollIntoViewIfNeeded();
    assert.equal(await card.locator("img").getAttribute("src"), "/assets/state-machines/thumb-16x9.png");
    assert.equal(await card.locator("a.btn").getAttribute("href"), "/projects/state-machines/");
    if (name === "desktop") {
      await card.screenshot({ path: path.join(screenshotDir, "home-state-machines-card.png") });
      results.screenshots.push("home-state-machines-card.png");
    }

    await page.goto(`${baseUrl}/projects/state-machines/`, { waitUntil: "domcontentloaded" });
    const video = page.locator("#fsm-video");
    await page.waitForFunction(() => document.querySelector("#fsm-video")?.readyState >= 1, null, { timeout: 20000 });
    const media = await video.evaluate((element) => ({
      duration: element.duration,
      width: element.videoWidth,
      height: element.videoHeight,
      paused: element.paused,
      preload: element.preload,
      controls: element.controls,
      poster: element.getAttribute("poster"),
      source: element.querySelector("source")?.getAttribute("src"),
      autoplay: element.autoplay,
      loop: element.loop,
      language: element.lang,
      wrapperRatio: (() => {
        const box = element.parentElement.getBoundingClientRect();
        return Number((box.width / box.height).toFixed(3));
      })(),
    }));
    assert.equal(media.duration, 60);
    assert.equal(media.width, 1080);
    assert.equal(media.height, 1920);
    assert.equal(media.paused, true, "Video must not autoplay");
    assert.equal(media.preload, "metadata");
    assert.equal(media.controls, true);
    assert.equal(media.poster, "/assets/state-machines/poster-9x16.png");
    assert.equal(media.source, "/videos/state-machines/state-machine-9x16-v4.mp4?v=4");
    assert.equal(media.autoplay, false);
    assert.equal(media.loop, false);
    assert.equal(media.language, "pt-BR");
    assert.ok(Math.abs(media.wrapperRatio - 9 / 16) < 0.02, `Player ratio drifted at ${name}`);

    await page.locator("img").evaluateAll((images) => Promise.all(
      images.map((image) => {
        image.loading = "eager";
        return image.decode().catch(() => null);
      }),
    ));
    const caseState = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      title: document.title,
      h1: document.querySelector("h1")?.innerText,
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth,
      acts: document.querySelectorAll(".act-card").length,
      missingImages: [...document.images]
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.currentSrc),
    }));
    assert.equal(caseState.lang, "pt-BR");
    assert.match(caseState.title, /Máquinas de Estados — Explainer Motion/);
    assert.match(caseState.h1, /Máquinas de Estados/);
    assert.equal(caseState.acts, 7);
    assert.deepEqual(caseState.missingImages, []);
    assert.ok(caseState.scrollWidth <= caseState.width, `Case overflow at ${name}`);

    if (name === "desktop") {
      await page.locator(".case-hero").screenshot({ path: path.join(screenshotDir, "case-hero.png") });
      await page.locator("#player").screenshot({ path: path.join(screenshotDir, "case-player.png") });
      await page.locator("#the-acts").screenshot({ path: path.join(screenshotDir, "case-seven-acts.png") });
      await page.locator("#behind-the-scenes").screenshot({ path: path.join(screenshotDir, "case-made-with-motion.png") });
      await page.locator("#frames").screenshot({ path: path.join(screenshotDir, "case-film-frames.png") });
      await page.screenshot({ path: path.join(screenshotDir, "case-pt-full.png"), fullPage: true });
      results.screenshots.push(
        "case-hero.png",
        "case-player.png",
        "case-seven-acts.png",
        "case-made-with-motion.png",
        "case-film-frames.png",
        "case-pt-full.png",
      );
    }
    if (name === "mobile") {
      await page.screenshot({ path: path.join(screenshotDir, "case-mobile-full.png"), fullPage: true });
      results.screenshots.push("case-mobile-full.png");
    }
    results.viewports.push({ name, width, height, home: "PASS", pt: "PASS", acts: caseState.acts, media });
    results.media[name] = media;
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/en/projects/state-machines/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#fsm-video")?.readyState >= 1, null, { timeout: 20000 });
  const english = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    h1: document.querySelector("h1")?.innerText,
    canonical: document.querySelector('link[rel="canonical"]')?.href,
    ogImage: document.querySelector('meta[property="og:image"]')?.content,
    videoLanguage: document.querySelector("#fsm-video")?.lang,
    switchLinks: [...document.querySelectorAll(".lang-option")].map((link) => link.href),
  }));
  assert.equal(english.lang, "en");
  assert.match(english.title, /State Machines — Explainer Motion/);
  assert.match(english.h1, /State Machines/);
  assert.equal(english.canonical, "https://motion.mateusarce.dev/en/projects/state-machines/");
  assert.match(english.ogImage, /thumb-16x9\.png$/);
  assert.equal(english.videoLanguage, "pt-BR", "English route must declare the Portuguese video language");
  assert.ok(english.switchLinks.some((url) => url.endsWith("/projects/state-machines/")));
  assert.ok(english.switchLinks.some((url) => url.endsWith("/en/projects/state-machines/")));
  await page.screenshot({ path: path.join(screenshotDir, "case-en-desktop.png") });
  results.screenshots.push("case-en-desktop.png");

  await page.locator("#themeToggle").click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await page.locator("#themeToggle").click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.locator("#langTrigger").click();
  assert.equal(await page.locator("#langTrigger").getAttribute("aria-expanded"), "true");

  const video = page.locator("#fsm-video");
  await video.evaluate((element) => element.play());
  await page.waitForFunction(() => document.querySelector("#fsm-video").paused === false);
  await video.evaluate((element) => element.pause());
  await page.waitForFunction(() => document.querySelector("#fsm-video").paused === true);
  await video.evaluate((element) => { element.currentTime = 12; });
  await page.waitForFunction(() => Math.abs(document.querySelector("#fsm-video").currentTime - 12) < 0.5);
  const keyboard = await video.evaluate((element) => {
    element.focus();
    return { focused: document.activeElement === element, fullscreen: typeof element.requestFullscreen === "function" };
  });
  assert.equal(keyboard.focused, true, "Video must be reachable by keyboard");
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.querySelector("#fsm-video").paused === false);
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.querySelector("#fsm-video").paused === true);
  await video.scrollIntoViewIfNeeded();
  await video.click({ position: { x: 24, y: 24 } });
  await video.evaluate((element) => element.requestFullscreen());
  await page.waitForFunction(() => document.fullscreenElement !== null, null, { timeout: 5000 });
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => document.fullscreenElement === null, null, { timeout: 5000 });
  assert.equal(keyboard.fullscreen, true, "Fullscreen API must be available to the native video controls");

  await page.locator("#langTrigger").click();
  await page.locator('.lang-option[data-lang="pt-BR"]').click();
  await page.waitForURL("**/projects/state-machines/");
  results.navigation = { englishRoute: "PASS", languageSwitcher: "PASS", themeToggle: "PASS", keyboardPlayback: "PASS", seek: "PASS" };

  const mediaRequest = await request.newContext();
  const rangeResponse = await mediaRequest.get(`${baseUrl}/videos/state-machines/state-machine-9x16-v4.mp4?v=4`, {
    headers: { Range: "bytes=0-1023" },
  });
  assert.equal(rangeResponse.status(), 206, "MP4 host must honor HTTP Range requests");
  assert.match(rangeResponse.headers()["content-range"], /^bytes 0-1023\//);
  assert.equal((await rangeResponse.body()).byteLength, 1024);
  await mediaRequest.dispose();
  results.media.range = { status: 206, contentRange: rangeResponse.headers()["content-range"], bytes: 1024 };

  const failurePage = await context.newPage();
  await failurePage.goto(`${baseUrl}/en/projects/state-machines/`, { waitUntil: "domcontentloaded" });
  await failurePage.locator("#fsm-video").evaluate((element) => element.dispatchEvent(new Event("error")));
  await failurePage.waitForSelector("#video-error:not([hidden])", { timeout: 10000 });
  assert.equal(await failurePage.locator("#video-error").isVisible(), true);
  assert.match(await failurePage.locator("#video-error").innerText(), /video could not load/i);
  results.media.errorState = "PASS (media error event; English message announced)";
  await failurePage.close();

  results.errors = { console: consoleErrors, page: pageErrors, localRequests: failedLocalRequests, http: httpErrors };
  assert.deepEqual(pageErrors, [], "No uncaught browser exceptions");
  assert.deepEqual(failedLocalRequests, [], "No local production assets may fail to load");
  assert.deepEqual(httpErrors, [], "No local production URL may return an HTTP error");

  await context.close();
  await writeFile(path.join(screenshotDir, "qa-results.json"), `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
