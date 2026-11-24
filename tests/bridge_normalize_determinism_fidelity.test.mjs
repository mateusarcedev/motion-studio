import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import {
  ERROR_CODES,
  bridge as B,
  buildContactSheet,
  qaViewports,
  renderStatic,
  verifyDeterminism,
} from "@technomanceer/motion-core";
import { installSkills } from "@technomanceer/motion-studio-skills";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const m2Fixtures = JSON.parse(await readFile(path.join(__dirname, "fixtures", "bridge", "doop-m2-fixtures.json"), "utf8"));
const adversarialHtml = await readFile(path.join(__dirname, "fixtures", "bridge", "doop-untrusted-adversarial.html"), "utf8");

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Deterministic valid solid-gradient RGB PNG generator for fixtures (no external image deps). */
function makePng(width, height, [r0, g0, b0], [r1, g1, b1]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0;
    const t = y / Math.max(1, height - 1);
    const r = Math.round(r0 + (r1 - r0) * t);
    const g = Math.round(g0 + (g1 - g0) * t);
    const b = Math.round(b0 + (b1 - b0) * t);
    for (let x = 0; x < width; x++) {
      const p = rowStart + 1 + x * 3;
      raw[p] = r; raw[p + 1] = g; raw[p + 2] = b;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

test("prototypeToStoryboard: converts real prototypeFlows & data-doop-* without inventing interactions", () => {
  const adapter = B.createDoopAdapter();
  const f1 = adapter.importFrame(m2Fixtures.frames.landingDesktop, { documentId: "cnv_m2_lab" });
  const f2 = adapter.importFrame(m2Fixtures.frames.dashboardDesktop, { documentId: "cnv_m2_lab" });
  const f3 = adapter.importFrame(m2Fixtures.frames.prototypeDetailState, { documentId: "cnv_m2_lab" });

  const sb = B.prototypeToStoryboard([f1, f2, f3], {
    projectSlug: "bora-campo-proto",
    fps: 30,
    defaultHoldSec: 2,
  });

  assert.equal(sb.beats.length, 3);
  assert.deepEqual(sb.beats.map((b) => b.frameId), ["frm_landing_desktop", "frm_dashboard_01", "frm_state_detail"]);
  assert.ok(sb.beats.every((b) => b.origin === "imported-prototype"));
  assert.equal(sb.states.length, 1);
  assert.equal(sb.states[0].state, "expanded");
  assert.equal(sb.navigationGraph.length, 3);
  assert.equal(sb.creativeSuggestions.length, 0);
  assert.match(sb.markdown, /^# STORYBOARD — bora-campo-proto/);
  assert.match(sb.markdown, /Cena 01 — frm_landing_desktop/);
  assert.match(sb.markdown, /push-left.*400 ms/);
  assert.match(sb.markdown, /overlay:frm_state_detail/);
  assert.ok(!sb.markdown.includes("Sugestões Criativas Posteriores"));

  // Creative suggestions remain strictly separated when explicitly passed
  const sbWithIdeas = B.prototypeToStoryboard([f1], {
    projectSlug: "bora-campo-proto",
    creativeSuggestions: [{ description: "Adicionar zoom dramático opcional na cena 1" }],
  });
  assert.equal(sbWithIdeas.creativeSuggestions[0].origin, "creative-suggestion-unverified");
  assert.match(sbWithIdeas.markdown, /Sugestões Criativas Posteriores/);
});

test("normalize: converts across frame, svg-motion, carousel, story, and web-director with honest diagnostics", async () => {
  const adapter = B.createDoopAdapter();
  const tokenBundle = adapter.importTokens(m2Fixtures.tokenBundle, { brandSlug: "bora-campo-m2" });
  const landingIr = adapter.importFrame(m2Fixtures.frames.landingDesktop, { documentId: "cnv_m2_lab" });
  const advIr = adapter.importFrame(
    { id: "frm_adv", canvasId: "cnv_m2_lab", name: "Adversarial", width: 800, height: 600, html: adversarialHtml },
    { documentId: "cnv_m2_lab" }
  );

  // Frame target converts CSS @keyframes to frame.js window.__onFrame__
  const frameOut = await B.normalizeDesignToMotion(landingIr, { target: "frame", tokenBundle });
  assert.ok(frameOut.html.includes("@technomanceer/motion-core/frame"));
  assert.ok(frameOut.html.includes("window.__onFrame__"));
  assert.ok(!frameOut.html.includes("@keyframes"));
  assert.ok(frameOut.report.converted.some((c) => c.kind === "css-keyframes-to-frame-js"));
  assert.ok(frameOut.report.preserved.some((p) => p.kind === "design-tokens"));

  // SVG-motion target wires createSvgMotion
  const svgOut = await B.normalizeDesignToMotion(landingIr, { target: "svg-motion", tokenBundle });
  assert.ok(svgOut.html.includes("@technomanceer/motion-core/svg-motion"));
  assert.ok(svgOut.html.includes("createSvgMotion"));

  // Carousel & Story targets apply presets + safe zones cleanly
  const carouselOut = await B.normalizeDesignToMotion([landingIr], { target: "carousel", preset: "feed-vertical", tokenBundle });
  assert.equal(carouselOut.width, 1080);
  assert.equal(carouselOut.height, 1350);
  assert.ok(carouselOut.html.includes("padding:4% 6% 4% 6%"));

  const storyOut = await B.normalizeDesignToMotion(landingIr, { target: "story", tokenBundle });
  assert.equal(storyOut.width, 1080);
  assert.equal(storyOut.height, 1920);
  assert.ok(storyOut.html.includes("padding:22% 7% 16% 7%"));

  // Adversarial IR strips unsafe items, keeps missing external refs localized/flagged, never reintroduces security threats
  const advOut = await B.normalizeDesignToMotion(advIr, { target: "frame", tokenBundle });
  assert.ok(advOut.report.removedForSecurity.length >= 4);
  assert.ok(!advOut.html.includes("<script>const x = Math.random()"));
  assert.ok(!advOut.html.includes("foreignObject"));
  assert.ok(!advOut.html.includes("<animate"));
  assert.ok(!advOut.html.includes("169.254.169.254"));
  assert.ok(advOut.report.incompatible.some((x) => x.kind === "CLOCK_OR_RANDOM_API_DETECTED"));

  await assert.rejects(
    () => B.normalizeDesignToMotion(advIr, { target: "frame", strictSecurity: true }),
    (e) => e.code === ERROR_CODES.BRIDGE_NORMALIZE_BLOCKED
  );
});

test("end-to-end M2: hydrate from local server -> normalize -> offline determinism -> 8 fixtures visual fidelity + contact sheet", async () => {
  const workDir = path.join(rootDir, "tests", "tmp", "bridge-m2-fidelity");
  await rm(workDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });

  const heroPng = makePng(240, 140, [31, 111, 80], [217, 119, 6]);
  const fontPath = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
  const realFontBytes = existsSync(fontPath) ? await readFile(fontPath) : null;
  const heroSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80"><circle data-layer="orb" cx="60" cy="40" r="28" fill="#1F6F50"/><path data-motion-path="arc" d="M15 65 Q60 15 105 65" fill="none" stroke="#D97706" stroke-width="5"/></svg>';

  const server = http.createServer((req, res) => {
    if (req.url === "/hero.png") {
      res.writeHead(200, { "content-type": "image/png", "content-length": String(heroPng.length) });
      res.end(heroPng);
      return;
    }
    if (req.url === "/badge.svg") {
      res.writeHead(200, { "content-type": "image/svg+xml" });
      res.end(heroSvg);
      return;
    }
    if (req.url === "/font.ttf" && realFontBytes) {
      res.writeHead(200, { "content-type": "font/ttf", "content-length": String(realFontBytes.length) });
      res.end(realFontBytes);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const adapter = B.createDoopAdapter();
    const tokenBundle = adapter.importTokens(m2Fixtures.tokenBundle, { brandSlug: "bora-campo-m2" });

    // Fixture 7: Interface with real image, SVG, and optional local TTF font hosted on test server
    const richHtml = `<!doctype html><html lang="en" data-doop-theme="default"><head><style>
      ${realFontBytes ? `@font-face{font-family:"BridgeSans";src:url("${baseUrl}/font.ttf") format("truetype");font-display:block;}` : ""}
      @keyframes floatY{0%{transform:translateY(0)}100%{transform:translateY(-6px)}}
      .card{padding:32px;background:var(--color-ground);color:var(--color-ink);font-family:${realFontBytes ? '"BridgeSans", sans-serif' : "sans-serif"};min-height:600px;display:flex;gap:24px;align-items:center}
      .hero-badge{animation:floatY 0.8s ease-out}
    </style></head><body>
      <div class="card">
        <div class="hero-badge" data-doop-id="el_badge">
          <h1 style="margin:0 0 12px;font-size:36px">Safra Conectada</h1>
          <img src="${baseUrl}/hero.png" width="240" height="140" style="border-radius:12px;display:block" />
        </div>
        <img src="${baseUrl}/badge.svg" width="120" height="80" />
        <svg viewBox="0 0 120 80" width="120" height="80"><path data-motion-path="trace" d="M10 60 Q60 10 110 60" fill="none" stroke="#1F6F50" stroke-width="5"/></svg>
      </div>
    </body></html>`;

    const richIr = adapter.importFrame(
      { id: "frm_rich_assets", canvasId: "cnv_m2_lab", name: "Rich Assets Frame", width: 960, height: 600, html: richHtml },
      { documentId: "cnv_m2_lab", allowLoopback: true }
    );

    const richProj = path.join(workDir, "rich-proj");
    const hydrated = await B.hydrateAssets(richIr, {
      projectDir: richProj,
      tokenBundle,
      allowLoopback: true,
    });
    assert.equal(hydrated.stats.hydrated, realFontBytes ? 3 : 2);

    const normalizedRich = await B.normalizeDesignToMotion(richIr, {
      target: "frame",
      tokenBundle,
      provenanceManifest: hydrated.provenanceManifest,
      outDir: richProj,
      durationSec: 1.0,
    });

    // Verify ZERO external HTTP URLs remain in normalized HTML
    assert.ok(!normalizedRich.html.includes(baseUrl), "normalized HTML must not retain external URLs");

    // Shut down HTTP server BEFORE offline rendering & determinism verification (proves 100% offline capability!)
    await new Promise((resolve) => server.close(resolve));

    const richHtmlFile = path.join(richProj, "composition.html");
    const detReport = await verifyDeterminism(richHtmlFile, {
      duration: 0.6,
      fps: 5,
      width: 960,
      height: 600,
      sampleTimes: [0, 0.2, 0.4],
      offline: true,
      outputDir: path.join(richProj, "qa-det"),
    });
    assert.equal(detReport.passed, true, JSON.stringify({ samples: detReport.samples, diagnostics: detReport.diagnostics }, null, 2));
    assert.equal(detReport.framePixelDeterminism, true);
    assert.equal(detReport.diagnostics.fontsReady, true);
    assert.equal(detReport.diagnostics.pageErrors.length, 0);

    // Offline blocking test: an un-normalized page attempting to reach external host fails cleanly under offline mode
    const leakDir = path.join(workDir, "leak-check");
    await mkdir(leakDir, { recursive: true });
    const leakHtml = path.join(leakDir, "leak.html");
    await writeFile(leakHtml, '<!doctype html><html><body><img src="https://example.invalid/blocked.png" /></body></html>');
    await assert.rejects(
      () => renderStatic(leakHtml, path.join(leakDir, "leak.png"), { width: 320, height: 240, scale: 1, offline: true }),
      (err) => err.exitCode === 4 || err.code === ERROR_CODES.RENDER_ASSET_FAILED
    );

    // Render all 8 representative fixtures offline & assemble a visual contact sheet
    const shotsDir = path.join(workDir, "shots");
    await mkdir(shotsDir, { recursive: true });
    const fixtureSpecs = [
      { key: "01-landing", irRaw: m2Fixtures.frames.landingDesktop, target: "web-director" },
      { key: "02-dashboard", irRaw: m2Fixtures.frames.dashboardDesktop, target: "frame" },
      { key: "03-mobile", irRaw: m2Fixtures.frames.mobileInterface, target: "frame" },
      { key: "04-components", irRaw: m2Fixtures.frames.componentsShowcase, target: "carousel", preset: "feed-square" },
      { key: "05-prototype-detail", irRaw: m2Fixtures.frames.prototypeDetailState, target: "frame" },
      { key: "06-dark-theme", irRaw: m2Fixtures.frames.darkThemeScreen, target: "frame" },
      { key: "08-adversarial", irRaw: { id: "frm_adv_shot", canvasId: "cnv_m2_lab", name: "Adversarial", width: 800, height: 600, html: adversarialHtml }, target: "frame" },
    ];

    const shotPngs = [];
    const shotLabels = [];

    // Include rich assets fixture (#7) first as numbered PNG 0007 (keep sorted numbered order 0001..0008 for buildContactSheet)
    const richShotPng = path.join(shotsDir, "0007.png");
    await renderStatic(richHtmlFile, richShotPng, { width: 960, height: 600, scale: 1, frame: 2, fps: 5, frames: 3, offline: true });

    let landingShot = null;
    for (const spec of fixtureSpecs) {
      const fDir = path.join(workDir, spec.key);
      const ir = adapter.importFrame(spec.irRaw, { documentId: "cnv_m2_lab" });
      const norm = await B.normalizeDesignToMotion(ir, {
        target: spec.target,
        preset: spec.preset,
        tokenBundle,
        outDir: fDir,
      });
      const entryHtml = spec.target === "web-director" ? path.join(fDir, "index.html") : spec.target === "carousel" ? path.join(fDir, "slides", "01.html") : path.join(fDir, "composition.html");
      const numPrefix = spec.key.slice(0, 2);
      const outPng = path.join(shotsDir, `00${numPrefix}.png`);
      await renderStatic(entryHtml, outPng, {
        width: norm.width,
        height: norm.height,
        scale: 1,
        offline: true,
        ...(spec.target === "frame" ? { frame: 1, fps: 30, frames: 30 } : {}),
      });
      assert.ok((await stat(outPng)).size > 1000);
      if (spec.key === "01-landing") landingShot = outPng;
      shotPngs.push({ num: Number(numPrefix), png: outPng, label: spec.key });
    }
    shotPngs.push({ num: 7, png: richShotPng, label: "07-rich-assets" });
    shotPngs.sort((a, b) => a.num - b.num);
    shotLabels.push(...shotPngs.map((x) => x.label));

    // Visual fidelity comparison: render direct clean baseline HTML of landingDesktop vs normalized web-director output
    const baselineHtml = path.join(workDir, "01-baseline.html");
    const baselinePng = path.join(workDir, "01-baseline.png");
    const landingNormHtml = path.join(workDir, "01-landing", "index.html");
    await writeFile(baselineHtml, `<!doctype html><html><head><style>${normalizedRich.tokensCss}</style></head>${m2Fixtures.frames.landingDesktop.html.replace(/<!doctype[^>]*><html[^>]*>/i, "")}`);
    await renderStatic(baselineHtml, baselinePng, { width: 1280, height: 800, scale: 1, offline: true });

    const fidelity = await B.compareVisualFidelity(baselinePng, landingShot, {
      diffPng: path.join(workDir, "01-landing-diff.png"),
      minSsim: 0.85,
      securityRemovedCount: 0,
    });
    assert.equal(fidelity.visuallyAcceptable, true, `Expected SSIM >= 0.85, got ${fidelity.ssim}`);
    assert.ok(await stat(fidelity.diffPng));

    // Build contact sheet across all 8 fixture screenshots
    const sheetPng = path.join(workDir, "contact-sheet.png");
    await buildContactSheet(shotsDir, sheetPng, { title: "M2 Visual Fidelity Fixtures", cols: 4, labels: shotLabels });
    assert.ok((await stat(sheetPng)).size > 5000);

    // Responsive viewport audit on normalized web-director landing page
    const vpReportDir = path.join(workDir, "qa-viewports");
    await qaViewports(landingNormHtml, vpReportDir, { wait: 200 });
    const vpJson = JSON.parse(await readFile(path.join(vpReportDir, "report.json"), "utf8"));
    assert.equal(vpJson.results.length, 5);
    assert.ok(vpJson.results.every((r) => r.ok), `Viewport QA issues: ${JSON.stringify(vpJson.results)}`);

    // Clean install WITHOUT Doop works independently (backward compatibility)
    const cleanProj = await mkdtemp(path.join(os.tmpdir(), "motion-no-doop-"));
    try {
      await installSkills({ targetDir: cleanProj, profile: "core" });
      assert.equal(existsSync(path.join(cleanProj, ".agents", "skills", "studio-director", "SKILL.md")), true);
      assert.equal(existsSync(path.join(cleanProj, ".agents", "skills", "doop-bridge")), false);
    } finally {
      await rm(cleanProj, { recursive: true, force: true });
    }
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  }
});
