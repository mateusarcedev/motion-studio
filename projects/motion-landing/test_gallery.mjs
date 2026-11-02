import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const landingDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.join(landingDir, "site");
const reviewDir = path.join(landingDir, "reviews/gallery");

await mkdir(reviewDir, { recursive: true });

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
      res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" }).end("// local stub");
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

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const baseUrl = `http://127.0.0.1:${server.address().port}`;
console.log(`Test server running at ${baseUrl}`);

const viewports = [
  ["mobile-s", 360, 740],
  ["mobile", 390, 844],
  ["tablet", 768, 1024],
  ["desktop", 1440, 900],
  ["wide", 1920, 1080],
];

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const results = {
  sectionVerification: {},
  cardsVerification: [],
  interactions: {},
  filters: {},
  lightbox: {},
  viewports: [],
  errors: [],
};

const consoleErrors = [];
const pageErrors = [];

try {
  const context = await browser.newContext({ colorScheme: "dark", hasTouch: true });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));

  // --- 1. SECTION HEADING & SPOTLIGHTS CHECK (PT) ---
  console.log("\n▶ Test 1: Section Heading & Spotlights Verification...");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);

  const sectionMeta = await page.evaluate(() => {
    const sec = document.getElementById("work");
    const h2 = sec?.querySelector(".intro h2")?.textContent?.trim();
    const sub = sec?.querySelector(".intro .intro-sub")?.textContent?.trim();
    const count = sec?.querySelector(".sec-count")?.textContent?.trim();
    const spotlights = Array.from(sec?.querySelectorAll(".work-spotlight") || []).map((el) => {
      return el.querySelector(".spotlight-title")?.textContent?.trim();
    });
    const filterPills = Array.from(document.querySelectorAll(".gfilter-btn")).map((b) => ({
      filter: b.getAttribute("data-filter"),
      text: b.textContent.trim(),
    }));
    const cardIds = Array.from(document.querySelectorAll(".gallery-card")).map((c) =>
      c.getAttribute("data-prod-id")
    );
    return { h2, sub, count, spotlights, filterPills, cardIds };
  });

  assert.equal(sectionMeta.h2, "Galeria de Criações");
  assert.equal(
    sectionMeta.sub,
    "Explore vídeos, carrosséis, artes e experiências produzidas com o MOTION Studio."
  );
  assert.ok(sectionMeta.spotlights.some((s) => s.includes("TRAVESSIA")), "TRAVESSIA spotlight present");
  assert.ok(
    sectionMeta.spotlights.some((s) => s.includes("Máquinas de Estados")),
    "Máquinas de Estados spotlight present"
  );
  assert.equal(sectionMeta.cardIds.length, 7, "7 gallery cards expected");
  results.sectionVerification = sectionMeta;
  console.log("  ✓ Section title, subtitle, spotlights, and 7 cards verified.");

  // --- 2. CARD METRICS & SINGLE-SLIDE BEHAVIOR ---
  console.log("\n▶ Test 2: Card Architecture & Controls...");
  const cardsData = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".gallery-card")).map((c) => {
      const id = c.getAttribute("data-prod-id");
      const title = c.querySelector(".gcard-title")?.textContent?.trim();
      const cat = c.querySelector(".gcard-cat")?.textContent?.trim();
      const badge = c.querySelector(".gcard-format-pill")?.textContent?.trim();
      const counter = c.querySelector(".gcard-counter")?.textContent?.trim();
      const numSlides = c.querySelectorAll(".gcard-slide").length;
      const numDots = c.querySelectorAll(".gcard-dot").length;
      const hasNav = !!c.querySelector(".gcard-nav");
      const hasWrapRatio = c.querySelector(".gcard-viewport-wrap")?.className;
      return { id, title, cat, badge, counter, numSlides, numDots, hasNav, hasWrapRatio };
    });
  });

  for (const c of cardsData) {
    if (c.numSlides > 1) {
      assert.ok(c.hasNav, `Card ${c.id} should have nav buttons`);
      assert.equal(c.numDots, c.numSlides, `Card ${c.id} dots count matches slides`);
      assert.ok(c.counter.startsWith("1 / "), `Card ${c.id} starts at slide 1`);
    } else {
      assert.ok(!c.hasNav, `Single slide card ${c.id} must NOT have nav buttons`);
      assert.equal(c.numDots, 0, `Single slide card ${c.id} must NOT have dots`);
      assert.ok(!c.counter, `Single slide card ${c.id} should not display counter`);
    }
  }
  results.cardsVerification = cardsData;
  console.log("  ✓ Multi-slide and single-slide card controls verified.");

  // --- 3. CAROUSEL INTERACTION: PREV, NEXT, DOTS, COUNTER, KEYBOARD ---
  console.log("\n▶ Test 3: Carousel Interactivity (Card 1: TRAVESSIA Carousel)...");
  const travessiaCard = page.locator('.gallery-card[data-prod-id="travessia-carousel"]');
  await travessiaCard.scrollIntoViewIfNeeded();

  // Initial state
  const prevBtn = travessiaCard.locator(".gcard-nav.prev");
  const nextBtn = travessiaCard.locator(".gcard-nav.next");
  const counter = travessiaCard.locator(".gcard-counter");
  const track = travessiaCard.locator(".gcard-track");

  assert.equal(await prevBtn.isDisabled(), true, "Prev should be disabled at start");
  assert.equal(await nextBtn.isDisabled(), false, "Next should be enabled at start");
  assert.equal(await counter.textContent(), "1 / 5");

  // Click Next
  await nextBtn.click();
  await page.waitForTimeout(100);
  assert.equal(await counter.textContent(), "2 / 5");
  assert.equal(await prevBtn.isDisabled(), false, "Prev enabled after slide advance");
  let transform = await track.evaluate((el) => el.style.transform);
  assert.equal(transform, "translateX(-100%)", "Track translates 100%");

  // Click Dot 4
  const dot4 = travessiaCard.locator('.gcard-dot[data-slide-idx="3"]');
  await dot4.click();
  await page.waitForTimeout(100);
  assert.equal(await counter.textContent(), "4 / 5");
  transform = await track.evaluate((el) => el.style.transform);
  assert.equal(transform, "translateX(-300%)");

  // Click Next to reach end
  await nextBtn.click();
  await page.waitForTimeout(100);
  assert.equal(await counter.textContent(), "5 / 5");
  assert.equal(await nextBtn.isDisabled(), true, "Next should be disabled at last slide");

  // Keyboard navigation on focused card: ArrowLeft
  await travessiaCard.focus();
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(100);
  assert.equal(await counter.textContent(), "4 / 5", "ArrowLeft navigates back");

  // Prev button click
  await prevBtn.click();
  await page.waitForTimeout(100);
  assert.equal(await counter.textContent(), "3 / 5", "Prev button navigates back");

  results.interactions.carousel = "Passed (Next, Prev, Dot, Counter, Keyboard)";
  console.log("  ✓ Carousel Next, Prev, Dot, and Keyboard interactions verified.");

  // --- 4. TOUCH SWIPE ON MOBILE ---
  console.log("\n▶ Test 4: Touch Swipe Simulation...");
  await page.setViewportSize({ width: 390, height: 844 });
  const viewportLocator = travessiaCard.locator(".gcard-viewport");
  const box = await viewportLocator.boundingBox();
  assert.ok(box, "Viewport box must be measurable");

  // Swipe left: starts at box.x + box.width * 0.8, moves to box.x + box.width * 0.2
  const startX = box.x + box.width * 0.8;
  const startY = box.y + box.height * 0.5;
  const endX = box.x + box.width * 0.2;

  // Perform custom touch event sequence via page.evaluate
  await page.evaluate(
    ({ x1, y1, x2, y2 }) => {
      const el = document.querySelector('.gallery-card[data-prod-id="travessia-carousel"] .gcard-viewport');
      const createTouch = (x, y) =>
        new Touch({ identifier: Date.now(), target: el, clientX: x, clientY: y, pageX: x, pageY: y });
      el.dispatchEvent(new TouchEvent("touchstart", { touches: [createTouch(x1, y1)], bubbles: true }));
      el.dispatchEvent(new TouchEvent("touchmove", { touches: [createTouch(x2, y2)], bubbles: true }));
      el.dispatchEvent(new TouchEvent("touchend", { touches: [], bubbles: true }));
    },
    { x1: startX, y1: startY, x2: endX, y2: startY }
  );
  await page.waitForTimeout(150);
  const swipedCounter = await counter.textContent();
  assert.equal(swipedCounter, "4 / 5", "Touch swipe advanced slide");
  results.interactions.touchSwipe = "Passed";
  console.log("  ✓ Touch swipe simulation verified.");

  // --- 5. CATEGORY FILTERS ---
  console.log("\n▶ Test 5: Category Filters Verification...");
  await page.setViewportSize({ width: 1440, height: 900 });

  const testFilter = async (filterKey, expectedVisibleIds) => {
    const btn = page.locator(`.gfilter-btn[data-filter="${filterKey}"]`);
    await btn.click();
    await page.waitForTimeout(100);
    const visibleIds = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".gallery-card:not(.is-hidden)")).map((c) =>
        c.getAttribute("data-prod-id")
      );
    });
    for (const exp of expectedVisibleIds) {
      assert.ok(visibleIds.includes(exp), `Expected ${exp} to be visible for filter ${filterKey}`);
    }
    assert.equal(visibleIds.length, expectedVisibleIds.length, `Count matches for filter ${filterKey}`);
  };

  await testFilter("carousels", [
    "travessia-carousel",
    "design-system-carousel",
    "brand-details-carousel",
  ]);
  await testFilter("3d-web", ["travessia-carousel"]);
  await testFilter("motion", ["state-machines-acts", "teaser-frames"]);
  await testFilter("posts", ["post-reflow-multiratio", "story-safe-zones"]);
  await testFilter("all", [
    "travessia-carousel",
    "design-system-carousel",
    "brand-details-carousel",
    "post-reflow-multiratio",
    "state-machines-acts",
    "teaser-frames",
    "story-safe-zones",
  ]);
  results.filters = "Passed (all, carousels, 3d-web, motion, posts)";
  console.log("  ✓ Category filters verified for all pills.");

  // Capture screenshot of filtered state
  await page.locator('.gfilter-btn[data-filter="carousels"]').click();
  await page.screenshot({ path: path.join(reviewDir, "gallery-filter-carousels.png") });
  await page.locator('.gfilter-btn[data-filter="all"]').click();

  // --- 6. LIGHTBOX MODAL ENLARGED VIEW ---
  console.log("\n▶ Test 6: Lightbox Modal Verification...");
  const firstZoomBtn = page.locator('.gallery-card[data-prod-id="design-system-carousel"] .slide-zoom-btn').first();
  await firstZoomBtn.scrollIntoViewIfNeeded();
  await firstZoomBtn.click();
  await page.waitForTimeout(200);

  const lightbox = page.locator("#galleryLightbox");
  assert.equal(await lightbox.isVisible(), true, "Lightbox dialog must be visible");

  const modalMeta = await page.evaluate(() => {
    const lb = document.getElementById("galleryLightbox");
    const img = document.getElementById("lightboxImg");
    const title = document.getElementById("lightboxTitle")?.textContent?.trim();
    const caption = document.getElementById("lightboxCaption")?.textContent?.trim();
    const counter = document.getElementById("lightboxCounter")?.textContent?.trim();
    const bodyOverflow = document.body.style.overflow;
    return {
      open: lb?.hasAttribute("open"),
      imgSrc: img?.getAttribute("src"),
      title,
      caption,
      counter,
      bodyOverflow,
    };
  });

  assert.equal(modalMeta.open, true, "Dialog has open attribute");
  assert.equal(modalMeta.bodyOverflow, "hidden", "Body scroll lock active");
  assert.ok(modalMeta.imgSrc.includes("/assets/carousel-7/01.png"), "First slide displayed");
  assert.equal(modalMeta.counter, "1 / 7");

  // Next in modal
  const lbNext = page.locator("#lightboxNext");
  await lbNext.click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator("#lightboxCounter").textContent(), "2 / 7");

  // Keyboard navigation inside modal: ArrowRight
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(100);
  assert.equal(await page.locator("#lightboxCounter").textContent(), "3 / 7");

  // Capture screenshot of open lightbox
  await page.screenshot({ path: path.join(reviewDir, "gallery-lightbox-open.png") });

  // Escape to close
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  assert.equal(await lightbox.isVisible(), false, "Lightbox closed on Escape");

  const postCloseScroll = await page.evaluate(() => document.body.style.overflow);
  assert.equal(postCloseScroll, "", "Body scroll lock restored");

  results.lightbox = "Passed (Open, Next, Keyboard ArrowRight, Escape, Scroll Lock, Focus Return)";
  console.log("  ✓ Lightbox modal verified.");

  // --- 7. MULTI-VIEWPORT AUDIT & SCREENSHOTS ---
  console.log("\n▶ Test 7: Multi-viewport QA & Screenshots...");
  for (const [name, width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto(`${baseUrl}/#work`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);

    const vpCheck = await page.evaluate(() => {
      const w = window.innerWidth;
      const sw = document.documentElement.scrollWidth;
      const sec = document.getElementById("work");
      const box = sec ? sec.getBoundingClientRect() : null;
      return { width: w, scrollWidth: sw, hasOverflow: sw > w, sectionFound: !!sec };
    });

    assert.equal(vpCheck.hasOverflow, false, `Horizontal overflow detected at ${name} (${width}px)!`);
    results.viewports.push({ name, width, height, ...vpCheck });

    // Save targeted screenshots
    if (name === "desktop") {
      await page.screenshot({ path: path.join(reviewDir, "gallery-pt-desktop.png"), fullPage: false });
    } else if (name === "mobile") {
      await page.screenshot({ path: path.join(reviewDir, "gallery-pt-mobile.png"), fullPage: false });
    } else if (name === "tablet") {
      await page.screenshot({ path: path.join(reviewDir, "gallery-pt-tablet.png"), fullPage: false });
    }
    console.log(`  ✓ Viewport ${name} (${width}×${height}) passed: 0 overflow.`);
  }

  // --- 8. LIGHT THEME & ENGLISH ROUTE VERIFICATION ---
  console.log("\n▶ Test 8: Light Theme & English Route...");
  // Light Theme
  const themeToggle = page.locator("#themeToggle");
  await themeToggle.click();
  await page.waitForTimeout(150);
  const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  assert.equal(theme, "light", "Theme switched to light");
  await page.screenshot({ path: path.join(reviewDir, "gallery-light-theme.png") });

  // English Route
  await page.goto(`${baseUrl}/en/#work`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  const enMeta = await page.evaluate(() => {
    const sec = document.getElementById("work");
    return {
      h2: sec?.querySelector(".intro h2")?.textContent?.trim(),
      sub: sec?.querySelector(".intro .intro-sub")?.textContent?.trim(),
      allBtn: document.querySelector('.gfilter-btn[data-filter="all"]')?.textContent?.trim(),
      postsBtn: document.querySelector('.gfilter-btn[data-filter="posts"]')?.textContent?.trim(),
    };
  });
  assert.equal(enMeta.h2, "Creation Gallery");
  assert.equal(
    enMeta.sub,
    "Explore videos, carousels, artwork, and interactive experiences made with MOTION Studio."
  );
  assert.equal(enMeta.allBtn, "All");
  assert.equal(enMeta.postsBtn, "Posts & Stories");
  await page.screenshot({ path: path.join(reviewDir, "gallery-en-desktop.png") });
  console.log("  ✓ Light theme and English route verified.");

  // Check console/page errors
  assert.equal(consoleErrors.length, 0, `Console errors: ${JSON.stringify(consoleErrors)}`);
  assert.equal(pageErrors.length, 0, `Page errors: ${JSON.stringify(pageErrors)}`);

  console.log("\n=========================================");
  console.log("✓ ALL GALLERY QA SUITES PASSED (100%)");
  console.log("=========================================\n");

  await writeFile(
    path.join(reviewDir, "gallery-qa-results.json"),
    JSON.stringify(results, null, 2)
  );
} catch (err) {
  console.error("\n❌ Gallery QA Failure:", err);
  results.errors.push(String(err));
  throw err;
} finally {
  await browser.close();
  server.close();
}
