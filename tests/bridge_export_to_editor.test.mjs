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
  renderStatic,
} from "@technomanceer/motion-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const m2Fixtures = JSON.parse(await readFile(path.join(__dirname, "fixtures", "bridge", "doop-m2-fixtures.json"), "utf8"));
const adversarialHtml = await readFile(path.join(__dirname, "fixtures", "bridge", "doop-untrusted-adversarial.html"), "utf8");
const TEST_ASSET_LICENSE = { spdx: "CC0-1.0", scope: "assets" };

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

function makePng(width, height, [r0, g0, b0], [r1, g1, b1], { withTextChunk = false } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
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
  const chunks = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
  ];
  if (withTextChunk) {
    chunks.push(pngChunk("tEXt", Buffer.from("Author\0SecretInternalUser", "latin1")));
  }
  chunks.push(pngChunk("IDAT", zlib.deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

/**
 * In-memory stateful Mock Doop MCP server implementing the exact verified Doop MCP tool surface.
 */
function createMockDoopMcp({
  canvasId = "cnv_m3_lab",
  tokens = null,
  components = null,
  frames = {},
  pages = [{ id: "pg_main", name: "Main" }],
  onToolCall = null,
} = {}) {
  let seq = 0;
  const state = {
    canvasId,
    pages: structuredClone(pages),
    tokens: structuredClone(tokens ?? []),
    components: structuredClone(components ?? []),
    frames: structuredClone(frames),
    uploads: new Map(),
    calls: [],
  };

  async function mcpClient(tool, args = {}) {
    assert.ok(typeof args.agent_name === "string" && args.agent_name.length > 0, `Tool '${tool}' requires agent_name`);
    state.calls.push({ tool, args: structuredClone(args) });
    if (onToolCall) {
      const override = await onToolCall(tool, args, state);
      if (override !== undefined) return override;
    }

    switch (tool) {
      case "get_canvas":
        return {
          id: state.canvasId,
          pages: state.pages,
          ...(tokens !== null ? { tokens: state.tokens } : {}),
          ...(components !== null ? { components: state.components } : {}),
          frames: Object.values(state.frames).map((f) => ({
            id: f.id,
            name: f.name,
            pageId: f.pageId,
            width: f.width,
            height: f.height,
            approvalStatus: f.approvalStatus ?? null,
            updatedAt: f.updatedAt ?? null,
          })),
        };
      case "get_frame":
        return state.frames[args.frame_id] ? structuredClone(state.frames[args.frame_id]) : null;
      case "upload_asset": {
        assert.equal(args.local_file, true, "Doop uploads use the local-file grant flow, not inline base64");
        return { upload_url: `https://upload.doop.test/${state.canvasId}/${++seq}`, curl_command: "curl (mocked)" };
      }
      case "create_frame": {
        const id = `frm_${++seq}`;
        state.frames[id] = {
          id,
          canvasId: args.canvas_id,
          pageId: args.pageId ?? "pg_main",
          name: args.name,
          width: args.width,
          height: args.height,
          html: args.html,
          approvalStatus: "draft",
          updatedAt: `rev-${seq}`,
        };
        return { id, frameId: id, pageId: state.frames[id].pageId, image_url: `https://cdn.doop.test/shot/${id}.png` };
      }
      case "append_frame_html": {
        const f = state.frames[args.frame_id];
        if (!f) throw new Error(`Missing frame ${args.frame_id}`);
        if (args.start) f.html = String(args.html_chunk ?? "");
        else f.html += String(args.html_chunk ?? "");
        f.updatedAt = `rev-${++seq}`;
        return { id: f.id, done: Boolean(args.done) };
      }
      case "set_frame_html": {
        const f = state.frames[args.frame_id];
        if (!f) throw new Error(`Missing frame ${args.frame_id}`);
        f.html = args.html;
        f.updatedAt = `rev-${++seq}`;
        return { id: f.id, image_url: `https://cdn.doop.test/shot/${f.id}.png` };
      }
      case "get_frame_screenshot":
        return { image_url: `https://cdn.doop.test/shot/${args.frame_id}.png` };
      default:
        throw new Error(`Unexpected MCP tool: ${tool}`);
    }
  }

  return { mcpClient, state };
}

function createTestAdapter(mock, { agentName = "MotionTester" } = {}) {
  return B.createDoopAdapter({
    mcpClient: mock.mcpClient,
    agentName,
    assetUploadTransport: async ({ grant, buffer, sha256, mime, fileName }) => {
      assert.ok(grant?.upload_url, "upload_asset must return the documented upload grant");
      const id = `ast_${mock.state.uploads.size + 1}`;
      const ext = path.extname(fileName ?? "") || ".bin";
      const url = `https://cdn.doop.test/${mock.state.canvasId}/${id}${ext}`;
      mock.state.uploads.set(url, { buffer: Buffer.from(buffer), sha256, mime, fileName });
      return { id, url };
    },
  });
}

test("Doop adapter exposes only verified MCP tool names", () => {
  assert.deepEqual(Object.values(B.DOOP_MCP_TOOL_NAMES).sort(), [
    "append_frame_html", "create_frame", "edit_frame_html", "get_canvas", "get_frame",
    "get_frame_screenshot", "get_prototype", "save_decision", "set_frame_html", "upload_asset",
  ]);
  assert.equal(B.DOOP_MCP_TOOL_NAMES.getTokens, undefined);
  assert.equal(B.DOOP_MCP_TOOL_NAMES.createTokens, undefined);
  assert.equal(B.DOOP_MCP_TOOL_NAMES.uploadFont, undefined);
});

test("ExportPlan@1 determinism and mandatory zero-write dry-run", async () => {
  const mock = createMockDoopMcp();
  const adapter = createTestAdapter(mock, { agentName: "MotionTester" });
  const pngBuf = makePng(64, 64, [10, 40, 80], [200, 120, 40]);

  const input = {
    artifacts: [
      { id: "hero-img", path: "assets/hero.png", buffer: pngBuf, license: TEST_ASSET_LICENSE },
      { id: "landing", kind: "html", name: "Landing Hero", width: 1280, height: 800, license: TEST_ASSET_LICENSE, content: '<!doctype html><html><body><div data-doop-id="hdr_1"><img src="./assets/hero.png" /></div></body></html>' },
    ],
  };

  const dry = await B.exportToEditor(input, { adapter, documentId: "cnv_m3_lab", policy: "dry-run" });
  assert.equal(dry.result.status, "DRY_RUN");
  assert.equal(dry.result.dryRun, true);
  assert.ok(dry.plan.operations.length > 0, "dry-run returns the deterministic plan without executing writes");
  assert.deepEqual(dry.plan.compatibilityReport.classifications, { editable: 1, rasterized: 1, referential: 0, blocked: 0 });
  assert.ok(mock.state.calls.every((c) => c.tool === "get_canvas" || c.tool === "get_frame"), "dry-run must issue ZERO write MCP calls");

  // Plan determinism: identical input produces identical planHash & operation IDs
  const inspected1 = await B.inspectExportSource(input, { adapter, documentId: "cnv_m3_lab" });
  const inspected2 = await B.inspectExportSource(input, { adapter, documentId: "cnv_m3_lab" });
  const plan1 = B.planExportToEditor(inspected1, { adapter, policy: "create-new-frame" });
  const plan2 = B.planExportToEditor(inspected2, { adapter, policy: "create-new-frame" });
  assert.equal(plan1.planHash, plan2.planHash);
  assert.deepEqual(plan1.operations.map((o) => o.id), plan2.operations.map((o) => o.id));
  assert.deepEqual(plan1.operations.map((o) => o.inputHash), plan2.operations.map((o) => o.inputHash));
  assert.ok(!JSON.stringify(plan1).includes("buffer"), "asset bytes stay out of the serializable plan");
  assert.ok(plan1.operations.filter((o) => o.kind === "upload_asset").every((o) => !("data" in o.payload) && o.preconditions.maxBytes === 5_000_000));
});

test("Classification, prepareOutgoingFrameHtml sanitization/base64/SVG>20KB/PNG-strip & referential export", async () => {
  const mock = createMockDoopMcp();
  const adapter = createTestAdapter(mock);

  const metaPng = makePng(32, 32, [20, 120, 90], [220, 200, 100], { withTextChunk: true });
  const inlineSmallPng = makePng(16, 16, [255, 0, 0], [0, 0, 255]);
  const bigSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${'<circle cx="10" cy="10" r="4" fill="#1F6F50"/>'.repeat(600)}</svg>`;
  assert.ok(Buffer.byteLength(bigSvg) > 20 * 1024);

  const html = `<!doctype html><html><head>
    <style data-motion-tokens>:root{--color-primary:#ff0000}</style>
    <style>:root{--color-bg:#ffffff}.box{color:var(--color-primary)}</style>
    <script type="module" data-motion-driver>window.__onFrame__=()=>{}</script>
  </head><body>
    <section data-doop-id="sec_1">
      <doop-use id="cmp_btn" component="PrimaryButton" label="Go"></doop-use>
      <img src="data:image/png;base64,${inlineSmallPng.toString("base64")}" />
      ${bigSvg}
    </section>
  </body></html>`;

  const res = await B.exportToEditor({
    artifacts: [
      { id: "hero-png", path: "assets/hero-meta.png", buffer: metaPng, license: TEST_ASSET_LICENSE },
      { id: "screen-main", kind: "html", name: "Main Screen", content: html, width: 1280, height: 800, license: TEST_ASSET_LICENSE },
      { id: "cinematic-reel", kind: "video", path: "renders/promo.mp4", title: "Promo Reel 4K", durationSec: 12, fps: 30, posterBuffer: inlineSmallPng, posterLicense: TEST_ASSET_LICENSE },
    ],
    storyboard: { markdown: "# STORYBOARD\nBeat 1: Hero entrance" },
  }, { adapter, documentId: "cnv_m3_lab", policy: "create-new-frame", allowPublicUpload: true });

  assert.equal(res.result.status, "COMPLETED");
  assert.deepEqual(res.plan.compatibilityReport.classifications, { editable: 1, rasterized: 1, referential: 1, blocked: 0 });
  assert.equal(Object.keys(res.result.uploadedAssets).length, 3, "hero-meta.png + extracted inline PNG + promoted >20KB SVG (poster shares SHA with inlineSmallPng)");

  // Verify stored frame HTML has NO :root palette, NO script, NO base64, preserves data-doop-id & <doop-use>
  const createdMain = Object.values(mock.state.frames).find((f) => f.name === "Main Screen");
  assert.ok(createdMain);
  assert.ok(!createdMain.html.includes("data:image/png;base64"));
  assert.ok(createdMain.html.includes("--color-primary:#ff0000"), "frame-local token CSS must survive the round-trip");
  assert.ok(!createdMain.html.includes("<script"));
  assert.ok(createdMain.html.includes('data-doop-id="sec_1"'));
  assert.ok(createdMain.html.includes("PrimaryButton"));
  assert.ok(createdMain.html.includes("https://cdn.doop.test/cnv_m3_lab/"));
  assert.ok([...mock.state.uploads.values()].every((u) => Buffer.isBuffer(u.buffer) && u.sha256));
  assert.ok(mock.state.calls.filter((c) => c.tool === "upload_asset").every((c) => c.args.local_file === true));

  // Verify PNG metadata tEXt chunk was stripped before upload
  const uploadedHeroEntry = [...mock.state.uploads.values()].find((u) => {
    const raw = u.buffer;
    return raw.length < metaPng.length && !raw.includes(Buffer.from("SecretInternalUser"));
  });
  assert.ok(uploadedHeroEntry, "tEXt metadata must be stripped before PNG upload");

  // Verify referential frame contains poster <img> and storyboard note without <video> tag
  const refFrame = Object.values(mock.state.frames).find((f) => f.name.includes("Referência"));
  assert.ok(refFrame);
  assert.ok(!refFrame.html.includes("<video"));
  assert.ok(refFrame.html.includes("https://cdn.doop.test/cnv_m3_lab/"));
  assert.ok(refFrame.html.includes("Beat 1: Hero entrance"));
});

test("Security & Privacy blocking: confidential files, credentials, disallowed licenses, oversized & SVG XSS", async () => {
  const mock = createMockDoopMcp();
  const adapter = createTestAdapter(mock);
  const pngBuf = makePng(20, 20, [1, 2, 3], [4, 5, 6]);
  const forcedInline = B.prepareOutgoingFrameHtml(`<img src="data:image/png;base64,${pngBuf.toString("base64")}">`, {
    assetLicense: TEST_ASSET_LICENSE,
    allowUnsafeInlineBase64: true,
  });
  assert.ok(!forcedInline.html.includes("data:image/png;base64"), "helper never allows an option to bypass base64 extraction");
  assert.match(forcedInline.html, /\{\{uploaded:[a-f0-9]{64}\}\}/);

  for (const blockedArt of [
    { path: ".env.local", content: "TOKEN=123" },
    { path: "assets/secret-logo.png", buffer: pngBuf },
    { path: "assets/unlicensed.png", buffer: pngBuf },
    { path: "config/motion.config.json", content: "{}" },
    { path: "assets/draft.png", buffer: pngBuf, confidential: true },
    { path: "assets/nc.png", buffer: pngBuf, license: { spdx: "CC-BY-NC-4.0" } },
  ]) {
    await assert.rejects(
      () => B.exportToEditor({ artifacts: [blockedArt] }, { adapter, documentId: "cnv_m3_lab", policy: "export-assets-only" }),
      (e) => e.code === ERROR_CODES.BRIDGE_EXPORT_BLOCKED
    );
  }

  // allowPublicUpload: false blocks upload_asset ops
  await assert.rejects(
    () => B.exportToEditor({ artifacts: [{ path: "assets/ok.png", buffer: pngBuf, license: TEST_ASSET_LICENSE }] }, {
      adapter, documentId: "cnv_m3_lab", policy: "export-assets-only", allowPublicUpload: false,
    }),
    (e) => e.code === ERROR_CODES.BRIDGE_EXPORT_BLOCKED
  );

  // Malicious SVG with <script> is sanitized by SVGO/assertSafeSvg so zero script survives; MIME mismatch is rejected
  const cleanSvgInsp = await B.inspectExportSource(
    { artifacts: [{ path: "assets/evil.svg", license: TEST_ASSET_LICENSE, content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><rect width="10" height="10"/></svg>' }] },
    { documentId: "cnv_m3_lab" }
  );
  assert.ok(!cleanSvgInsp.uploadCandidates[0].buffer.toString("utf8").includes("<script"));

  await assert.rejects(
    () => B.inspectExportSource({ artifacts: [{ path: "assets/fake.png", mime: "image/png", buffer: Buffer.from("NOT_A_PNG"), license: TEST_ASSET_LICENSE }] }, { documentId: "cnv_m3_lab" }),
    (e) => e.code === ERROR_CODES.BRIDGE_MIME_MISMATCH || e.code === ERROR_CODES.BRIDGE_SECURITY_VIOLATION
  );

  // Oversized raster asset (configured limit) is classified as blocked
  const huge = await B.inspectExportSource({ artifacts: [{ id: "big", path: "assets/big.png", buffer: pngBuf, license: TEST_ASSET_LICENSE }] }, {
    documentId: "cnv_m3_lab", maxImageBytes: 10,
  });
  assert.equal(huge.items[0].category, "blocked");
  assert.equal(huge.items[0].strategy, "size-limit-exceeded");
  assert.throws(() => B.prepareOutgoingFrameHtml('<img src="http://127.0.0.1/private.png">', { assetLicense: TEST_ASSET_LICENSE }), (e) => e.code === ERROR_CODES.BRIDGE_UNSAFE_URL);
  assert.throws(() => B.prepareOutgoingFrameHtml('<div style="background:url(./assets/missing.png)"></div>', { assetLicense: TEST_ASSET_LICENSE }), (e) => e.code === ERROR_CODES.BRIDGE_EXPORT_BLOCKED);
  const rewrittenCss = B.prepareOutgoingFrameHtml('<div style="background:url(./assets/a.png)"></div>', {
    assetLicense: TEST_ASSET_LICENSE,
    localAssetMap: new Map([["assets/a.png", "a".repeat(64)]]),
  });
  assert.ok(rewrittenCss.html.includes(`{{uploaded:${"a".repeat(64)}}}`));
});

test("Preservation policies: update-existing-frame protection, ready_for_dev guard, CAS conflict & token conflict warning", async () => {
  const existingFrameHtml = '<div data-doop-id="hero_1">Original Draft</div>';
  const mock = createMockDoopMcp({
    tokens: [
      { name: "--color-primary", type: "color", value: "#1F6F50" },
      { name: "--color-accent", type: "color", value: "#D97706" },
    ],
    frames: {
      frm_approved: { id: "frm_approved", name: "Approved Frame", pageId: "pg_main", width: 1280, height: 800, html: existingFrameHtml, approvalStatus: "ready_for_dev", updatedAt: "rev-approved" },
      frm_draft: { id: "frm_draft", name: "Draft Frame", pageId: "pg_main", width: 1280, height: 800, html: existingFrameHtml, approvalStatus: "needs_review", updatedAt: "rev-draft-1" },
    },
  });
  const adapter = createTestAdapter(mock);
  const tokenBundle = adapter.importTokens({
    tokens: [
      { name: "--color-primary", type: "color", value: "#1F6F50" }, // identical -> reuse-existing
      { name: "--color-accent", type: "color", value: "#FF00FF" }, // divergent -> conflict-blocked
      { name: "--radius-card", type: "radius", value: "16px" }, // new -> create_tokens
    ],
  }, { brandSlug: "m3-brand" });

  // 1) Token reuse + conflict warning referencing 1 approved frame; without allowTokenMutation, set_tokens is NOT planned
  const planInsp = await B.inspectExportSource({
    tokenBundle,
    artifacts: [{ id: "d1", kind: "html", name: "New Draft", content: '<div data-doop-id="x">Copy</div>' }],
  }, { adapter, documentId: "cnv_m3_lab" });
  const plan = B.planExportToEditor(planInsp, { adapter, policy: "duplicate-as-draft" });
  assert.ok(plan.compatibilityReport.tokenConflicts.some((c) => c.cssVar === "--color-primary" && c.action === "reuse-existing"));
  const accentConflict = plan.compatibilityReport.tokenConflicts.find((c) => c.cssVar === "--color-accent");
  assert.equal(accentConflict.action, "conflict-blocked");
  assert.match(accentConflict.impactWarning, /ready_for_dev/);
  assert.ok(!plan.operations.some((o) => ["create_tokens", "set_tokens"].includes(o.kind)), "MCP surface has no global token mutation tool");
  assert.ok(plan.compatibilityReport.tokenConflicts.some((c) => c.cssVar === "--radius-card" && c.action === "unsupported-create"));

  // 2) update-existing-frame requires allowUpdateExisting: true AND refuses ready_for_dev
  await assert.rejects(
    () => B.exportToEditor({ artifacts: [{ kind: "html", targetFrameId: "frm_draft", content: "<div>New</div>" }] }, {
      adapter, documentId: "cnv_m3_lab", policy: "update-existing-frame",
    }),
    (e) => e.code === ERROR_CODES.BRIDGE_EXPORT_PROTECTED
  );

  await assert.rejects(
    () => B.exportToEditor({ artifacts: [{ kind: "html", targetFrameId: "frm_approved", content: "<div>New</div>" }] }, {
      adapter, documentId: "cnv_m3_lab", policy: "update-existing-frame", allowUpdateExisting: true,
    }),
    (e) => e.code === ERROR_CODES.BRIDGE_EXPORT_PROTECTED
  );

  // 3) Pre-write CAS conflict check detects concurrent edit made between plan and execute
  const draftInsp = await B.inspectExportSource({
    artifacts: [{ kind: "html", targetFrameId: "frm_draft", name: "Draft Frame", content: '<div data-doop-id="hero_1">Updated v2</div>' }],
  }, { adapter, documentId: "cnv_m3_lab" });
  const draftPlan = B.planExportToEditor(draftInsp, { adapter, policy: "update-existing-frame", allowUpdateExisting: true });

  // Concurrent edit on remote canvas before executeExportPlan!
  mock.state.frames.frm_draft.updatedAt = "rev-draft-concurrent-2";
  const conflictRes = await B.executeExportPlan(draftPlan, { adapter });
  assert.equal(conflictRes.status, "FAILED");
  assert.equal(conflictRes.operations[0].errorCode, ERROR_CODES.BRIDGE_EXPORT_CONFLICT);
  assert.equal(mock.state.frames.frm_draft.html, existingFrameHtml, "Remote frame must NOT be overwritten on revision conflict");
});

test("Queue resilience: SHA-256 upload dedup, 15/min rate limit, retry backoff, chunked HTML>4KB, timeout ambiguity & safe multi-resume", async () => {
  // Part A: 16 assets (including duplicate pair -> 15 + 1 more = 16 unique) test rate limit + SHA dedup + chunked HTML > 4 KB
  const mock = createMockDoopMcp();
  const adapter = createTestAdapter(mock);
  const uniquePngs = Array.from({ length: 16 }, (_, idx) => ({
    id: `img-${idx}`,
    path: `assets/img-${idx}.png`,
    buffer: makePng(12, 12, [idx * 10, 50, 90], [200, 100, idx * 8]),
  }));
  uniquePngs.push({ id: "img-dup", path: "assets/img-0-copy.png", buffer: Buffer.from(uniquePngs[0].buffer) });
  const longHtml = `<!doctype html><html><body><div data-doop-id="long_root">${"<p>Bloco longo editável no frame Doop.</p>".repeat(160)}</div></body></html>`;
  assert.ok(longHtml.length > 4096);

  let fakeTime = 1_000_000;
  const sleeps = [];
  const fullRes = await B.exportToEditor(
    { artifacts: [...uniquePngs.map((asset) => ({ ...asset, license: TEST_ASSET_LICENSE })), { id: "long-frame", kind: "html", name: "Chunked Frame", content: longHtml }] },
    {
      adapter,
      documentId: "cnv_m3_lab",
      policy: "create-new-frame",
      allowPublicUpload: true,
      maxUploadsPerMinute: 15,
      backoffBaseMs: 5,
      now: () => fakeTime,
      sleep: async (ms) => { sleeps.push(ms); fakeTime += ms; },
    }
  );
  assert.equal(fullRes.status ?? fullRes.result.status, "COMPLETED");
  assert.equal(Object.keys(fullRes.result.uploadedAssets).length, 16, "Duplicate PNG must deduplicate to 16 unique SHA uploads");
  const uploadCalls = mock.state.calls.filter((c) => c.tool === "upload_asset");
  assert.equal(uploadCalls.length, 16);
  assert.ok(sleeps.some((ms) => ms >= 1000), `Expected rate-limit window sleep after 15 uploads, got ${JSON.stringify(sleeps)}`);
  const appendCalls = mock.state.calls.filter((c) => c.tool === "append_frame_html");
  assert.ok(appendCalls.length >= 2 && appendCalls[0].args.start === true && appendCalls.at(-1).args.done === true, "HTML >4KB must stream via append_frame_html");

  // Separate plans using the same MCP transport share one rolling rate-limit window.
  let inFlightUploads = 0;
  let peakConcurrentUploads = 0;
  const concurrentMock = createMockDoopMcp({
    onToolCall: async (tool) => {
      if (tool !== "upload_asset") return undefined;
      inFlightUploads++;
      peakConcurrentUploads = Math.max(peakConcurrentUploads, inFlightUploads);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlightUploads--;
      return undefined;
    },
  });
  const concurrentAdapter = createTestAdapter(concurrentMock);
  const makeAssets = (prefix, offset) => Array.from({ length: 8 }, (_, idx) => ({
    path: `assets/${prefix}-${idx}.png`,
    buffer: makePng(10, 10, [offset + idx, 20, 30], [80, offset + idx, 120]),
    license: TEST_ASSET_LICENSE,
  }));
  const inspectPlan = async (assets) => {
    const inspected = await B.inspectExportSource({ artifacts: assets }, { adapter: concurrentAdapter, documentId: "cnv_m3_lab" });
    return B.planExportToEditor(inspected, { adapter: concurrentAdapter, policy: "export-assets-only", allowPublicUpload: true });
  };
  const [concurrentPlanA, concurrentPlanB] = await Promise.all([
    inspectPlan(makeAssets("concurrent-a", 0)),
    inspectPlan(makeAssets("concurrent-b", 100)),
  ]);
  let concurrentTime = 2_000_000;
  const concurrentSleeps = [];
  const runConcurrentPlan = (plan) => B.executeExportPlan(plan, {
    adapter: concurrentAdapter,
    maxUploadsPerMinute: 15,
    now: () => concurrentTime,
    sleep: async (ms) => { concurrentSleeps.push(ms); concurrentTime += ms; },
  });
  const concurrentResults = await Promise.all([runConcurrentPlan(concurrentPlanA), runConcurrentPlan(concurrentPlanB)]);
  assert.ok(concurrentResults.every((r) => r.status === "COMPLETED"));
  assert.equal(concurrentMock.state.calls.filter((c) => c.tool === "upload_asset").length, 16);
  assert.ok(concurrentSleeps.some((ms) => ms >= 1000), "shared MCP transport must throttle concurrent export plans");
  assert.equal(peakConcurrentUploads, 1, "shared MCP transport must serialize concurrent asset transfers");

  // Part B: 429 retry + transient failure + safe multi-pass resume + ambiguous timeout
  let failOnce429 = true;
  let failCreateFrame = true;
  const flakyMock = createMockDoopMcp({
    onToolCall: async (tool) => {
      if (tool === "upload_asset" && failOnce429) {
        failOnce429 = false;
        throw Object.assign(new Error("429 Rate Limit"), { status: 429, code: ERROR_CODES.BRIDGE_RATE_LIMITED });
      }
      if (tool === "create_frame" && failCreateFrame) {
        failCreateFrame = false;
        throw Object.assign(new Error("Pre-commit transient network drop"), { preCommit: true, retryable: false });
      }
      return undefined;
    },
  });
  const flakyAdapter = createTestAdapter(flakyMock);
  const smallPng = makePng(10, 10, [11, 22, 33], [44, 55, 66]);
  const inspFlaky = await B.inspectExportSource(
    { artifacts: [{ path: "assets/a.png", buffer: smallPng, license: TEST_ASSET_LICENSE }, { kind: "html", name: "Resume Frame", license: TEST_ASSET_LICENSE, content: '<div data-doop-id="r1"><img src="./assets/a.png" /></div>' }] },
    { adapter: flakyAdapter, documentId: "cnv_m3_lab" }
  );
  const planFlaky = B.planExportToEditor(inspFlaky, { adapter: flakyAdapter, policy: "create-new-frame", allowPublicUpload: true });
  const partialRes = await B.executeExportPlan(planFlaky, { adapter: flakyAdapter, backoffBaseMs: 1 });
  assert.equal(partialRes.status, "PARTIAL");
  const uploadOp = partialRes.operations.find((o) => o.kind === "upload_asset");
  assert.equal(uploadOp.status, "succeeded");
  assert.equal(uploadOp.attempts, 2, "429 must retry and succeed on attempt 2");

  // Resume from partialRes -> skips the completed upload and retries the known pre-commit frame failure.
  const callsBeforeResume = flakyMock.state.calls.length;
  const resumedRes = await B.executeExportPlan(planFlaky, { adapter: flakyAdapter, previousResult: partialRes, backoffBaseMs: 1 });
  assert.equal(resumedRes.status, "COMPLETED");
  const newCalls = flakyMock.state.calls.slice(callsBeforeResume).map((c) => c.tool);
  assert.ok(!newCalls.includes("upload_asset"), "Resume must NOT re-execute succeeded uploads");
  assert.ok(newCalls.includes("create_frame") && newCalls.includes("get_frame_screenshot"));

  // Timeout -> ambiguous status, never auto-retried, and subsequent resume refuses to re-run ambiguous op
  const timeoutMock = createMockDoopMcp({
    onToolCall: async (tool) => {
      if (tool === "create_frame") {
        await new Promise((r) => setTimeout(r, 120));
      }
      return undefined;
    },
  });
  const timeoutAdapter = createTestAdapter(timeoutMock);
  const inspTo = await B.inspectExportSource({ artifacts: [{ kind: "html", name: "Slow Frame", content: "<div>Slow</div>" }] }, { adapter: timeoutAdapter, documentId: "cnv_m3_lab" });
  const planTo = B.planExportToEditor(inspTo, { adapter: timeoutAdapter, policy: "create-new-frame" });
  const ambigRes = await B.executeExportPlan(planTo, { adapter: timeoutAdapter, timeoutMs: 25, backoffBaseMs: 1 });
  assert.equal(ambigRes.reconciliation.ambiguousCount, 1);
  assert.equal(ambigRes.operations.find((o) => o.kind === "create_frame").status, "ambiguous");

  const recheckRes = await B.executeExportPlan(planTo, { adapter: timeoutAdapter, previousResult: ambigRes, timeoutMs: 25, backoffBaseMs: 1 });
  assert.equal(recheckRes.reconciliation.ambiguousCount, 1);
  assert.equal(timeoutMock.state.calls.filter((c) => c.tool === "create_frame").length, 1, "Ambiguous op must NEVER auto-retry without reconciliation");

  // AbortSignal cancellation stops execution cleanly
  const ac = new AbortController();
  ac.abort();
  const cancelRes = await B.executeExportPlan(planTo, { adapter: flakyAdapter, signal: ac.signal });
  assert.equal(cancelRes.status, "CANCELLED");

  const activeCancelMock = createMockDoopMcp({
    onToolCall: async (tool) => {
      if (tool === "create_frame") return new Promise(() => {});
      return undefined;
    },
  });
  const activeCancelAdapter = createTestAdapter(activeCancelMock);
  const activeCancelInsp = await B.inspectExportSource({ artifacts: [{ kind: "html", name: "Active Cancel", content: "<div>Cancel</div>" }] }, { adapter: activeCancelAdapter, documentId: "cnv_m3_lab" });
  const activeCancelPlan = B.planExportToEditor(activeCancelInsp, { adapter: activeCancelAdapter });
  const activeController = new AbortController();
  setTimeout(() => activeController.abort(), 10);
  const activeCancelResult = await B.executeExportPlan(activeCancelPlan, { adapter: activeCancelAdapter, signal: activeController.signal, timeoutMs: 1000 });
  assert.equal(activeCancelResult.status, "CANCELLED");
  assert.equal(activeCancelResult.reconciliation.ambiguousCount, 1, "in-flight mutation cancellation must be reconciled before retry");
  assert.equal(activeCancelMock.state.calls.filter((call) => call.tool === "create_frame").length, 1);
});

test("M1 adapter backward compatibility (without export capabilities)", async () => {
  const m1OnlyAdapter = {
    editor: "legacy-editor",
    capabilities: { tokens: true, frames: true, prototypeFlows: false },
    importTokens() { return {}; },
    exportTokens() { return {}; },
    importFrame() { return {}; },
    validateTargetReadiness() { return { ok: true }; },
  };
  B.assertEditorAdapter(m1OnlyAdapter);
  assert.equal(B.supportsExportOperations(m1OnlyAdapter), false);
  const insp = await B.inspectExportSource({ artifacts: [{ kind: "html", content: "<div>Hi</div>" }] }, { adapter: m1OnlyAdapter, documentId: "doc_1" });
  const plan = B.planExportToEditor(insp, { adapter: m1OnlyAdapter, policy: "create-new-frame" });
  await assert.rejects(
    () => B.executeExportPlan(plan, { adapter: m1OnlyAdapter }),
    (e) => e.code === ERROR_CODES.BRIDGE_ADAPTER_INVALID
  );
});

test("End-to-end M3 round-trip (Doop -> Motion -> Doop -> Motion) across 6 M2 fixtures + quantitative SSIM visual fidelity + contact sheet", async () => {
  const workDir = path.join(rootDir, "tests", "tmp", "bridge-m3-fidelity");
  await rm(workDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });
  const shotsDir = path.join(workDir, "roundtrip-shots");
  await mkdir(shotsDir, { recursive: true });

  const initialDoopTokens = m2Fixtures.tokenBundle.tokens.map((t) => ({ ...t }));
  const mock = createMockDoopMcp({ canvasId: "cnv_m3_roundtrip", tokens: initialDoopTokens });
  const adapter = createTestAdapter(mock, { agentName: "RoundTripVerifier" });
  const tokenBundle = adapter.importTokens(m2Fixtures.tokenBundle, { brandSlug: "bora-campo-m3" });
  const tokensCss = B.buildTokensCss(tokenBundle);

  const fixturesList = [
    ["01-landing", m2Fixtures.frames.landingDesktop],
    ["02-dashboard", m2Fixtures.frames.dashboardDesktop],
    ["03-mobile", m2Fixtures.frames.mobileInterface],
    ["04-components", m2Fixtures.frames.componentsShowcase],
    ["05-prototype", m2Fixtures.frames.prototypeDetailState],
    ["06-dark-theme", m2Fixtures.frames.darkThemeScreen],
  ];

  // Hydrated rich asset test (PNG + SVG served locally -> normalized -> exported back with upload_asset -> re-imported)
  const heroPng = makePng(220, 120, [31, 111, 80], [217, 119, 6]);
  const server = http.createServer((req, res) => {
    if (req.url === "/hero.png") {
      res.writeHead(200, { "content-type": "image/png" });
      res.end(heroPng);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();

  const createdMeta = [];
  try {
    // Prepare normalized editable artifacts from all 6 M2 fixtures + 1 hydrated asset frame
    const artifactsToExport = [];
    for (const [label, rawFrame] of fixturesList) {
      const ir = adapter.importFrame(rawFrame, { documentId: "cnv_m3_roundtrip" });
      const normDir = path.join(workDir, "src-norm", label);
      await B.normalizeDesignToMotion(ir, { target: "frame", tokenBundle, outDir: normDir, durationSec: 1.0 });
      const normHtml = await readFile(path.join(normDir, "composition.html"), "utf8");
      artifactsToExport.push({
        id: label,
        kind: "html",
        name: rawFrame.name,
        width: rawFrame.width,
        height: rawFrame.height,
        content: normHtml,
      });
    }

    const richRawHtml = `<!doctype html><html><body><div data-doop-id="rich_box" style="padding:24px;background:#0f172a;color:#f8fafc;min-height:100vh"><h2>Safra Visual</h2><img src="http://127.0.0.1:${port}/hero.png" width="220" height="120" style="display:block;border-radius:10px" /></div></body></html>`;
    const richIr = adapter.importFrame({ id: "frm_rich_rt", canvasId: "cnv_m3_roundtrip", name: "Rich Hydrated", width: 800, height: 500, html: richRawHtml }, { documentId: "cnv_m3_roundtrip", allowLoopback: true });
    const richDir = path.join(workDir, "src-norm", "07-rich");
    const hydrated = await B.hydrateAssets(richIr, { projectDir: richDir, tokenBundle, allowLoopback: true });
    const richNorm = await B.normalizeDesignToMotion(richIr, { target: "frame", tokenBundle, provenanceManifest: hydrated.provenanceManifest, outDir: richDir });
    await new Promise((r) => server.close(r));

    const richAssetFile = hydrated.provenanceManifest.assets[0];
    artifactsToExport.push({ id: "07-rich-img", path: richAssetFile.localPath, buffer: await readFile(path.join(richDir, richAssetFile.localPath)), license: richAssetFile.license });
    artifactsToExport.push({ id: "07-rich", kind: "html", name: "Rich Hydrated", width: 800, height: 500, license: TEST_ASSET_LICENSE, content: richNorm.html });

    // Execute safe export back to mock Doop canvas!
    const exportOutcome = await B.exportToEditor(
      { tokenBundle, artifacts: artifactsToExport },
      { adapter, documentId: "cnv_m3_roundtrip", policy: "create-new-frame", allowPublicUpload: true }
    );
    assert.equal(exportOutcome.result.status, "COMPLETED");
    assert.equal(exportOutcome.result.createdFrames.length, 7);

    // Map back uploaded asset URLs into a quick local test HTTP server ONLY for baseline comparison of re-imported rich frame?
    // Even better: check round-tripped frames visually against original Doop baseline renders!
    const roundTripLabels = [];
    for (let i = 0; i < fixturesList.length; i++) {
      const [label, origRaw] = fixturesList[i];
      const createdInfo = exportOutcome.result.createdFrames[i];
      const remoteFrame = mock.state.frames[createdInfo.frameId];

      // Check zero data-doop-id loss & zero base64 or :root palette leakage inside exported Doop frame
      const origIds = [...origRaw.html.matchAll(/data-doop-id=["']([^"']+)["']/g)].map((m) => m[1]);
      for (const did of origIds) {
        assert.ok(remoteFrame.html.includes(did), `Frame '${label}' lost data-doop-id='${did}' on export!`);
      }
      assert.ok(!remoteFrame.html.includes("data:image/"), `Frame '${label}' must not contain base64 image`);

      // Re-import exported frame from Doop into MotionDesignIR@1
      const reimportedIr = adapter.importFrame(remoteFrame, { documentId: "cnv_m3_roundtrip" });
      assert.equal(reimportedIr.securityFindings.length, 0, `Re-imported '${label}' must be clean`);

      // Render original Doop frame baseline (with canvas viewport reset) vs re-imported settled round-trip frame offline in Chromium
      const baselineHtml = path.join(workDir, `${label}-baseline.html`);
      const baselinePng = path.join(workDir, `${label}-baseline.png`);
      await writeFile(baselineHtml, `<!doctype html><html data-doop-theme="${origRaw.theme ?? "default"}"><head><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0}\n${tokensCss}</style></head>${origRaw.html.replace(/<!doctype[^>]*><html[^>]*>/i, "")}`);
      await renderStatic(baselineHtml, baselinePng, { width: origRaw.width, height: origRaw.height, scale: 1, offline: true });

      const rtDir = path.join(workDir, `rt-${label}`);
      const rtNorm = await B.normalizeDesignToMotion(reimportedIr, { target: "frame", tokenBundle, outDir: rtDir, durationSec: 1.0 });
      const rtPng = path.join(shotsDir, `${String(i + 1).padStart(4, "0")}.png`);
      await renderStatic(path.join(rtDir, "composition.html"), rtPng, { width: rtNorm.width, height: rtNorm.height, scale: 1, frame: 30, fps: 30, frames: 31, offline: true });

      const diffPng = path.join(workDir, `${label}-diff.png`);
      const fidelity = await B.compareVisualFidelity(baselinePng, rtPng, { diffPng, minSsim: 0.85, securityRemovedCount: 0 });
      assert.equal(fidelity.visuallyAcceptable, true, `${label} round-trip SSIM ${fidelity.ssim} < 0.85`);
      roundTripLabels.push(`${label} (SSIM=${fidelity.ssim.toFixed(3)})`);
      createdMeta.push({ label, ssim: fidelity.ssim });
    }
    await writeFile(path.join(workDir, "roundtrip-fidelity.json"), `${JSON.stringify({ schemaVersion: "1.0.0", target: "offline-chromium", fixtures: createdMeta }, null, 2)}\n`);
    console.log(`M3 offline visual fidelity: ${roundTripLabels.join(", ")}`);

    // Security distinction check: adversarial fixture cleaned before Doop export stays permanently sanitized on re-import
    const advIr = adapter.importFrame({ id: "frm_adv_src", canvasId: "cnv_m3_roundtrip", name: "Adv Cleaned", width: 800, height: 600, html: adversarialHtml }, { documentId: "cnv_m3_roundtrip" });
    const advOut = await B.normalizeDesignToMotion(advIr, { target: "frame", tokenBundle });
    const advExport = await B.exportToEditor(
      { artifacts: [{ id: "adv", kind: "html", name: "Adv Cleaned", width: 800, height: 600, license: TEST_ASSET_LICENSE, content: advOut.html }] },
      { adapter, documentId: "cnv_m3_roundtrip", policy: "create-new-frame", allowPublicUpload: true }
    );
    const advRemote = mock.state.frames[advExport.result.createdFrames[0].frameId];
    const advReimported = adapter.importFrame(advRemote, { documentId: "cnv_m3_roundtrip" });
    assert.ok(!advRemote.html.includes("<script") && !advRemote.html.includes("foreignObject") && !advRemote.html.includes("169.254.169.254") && !advRemote.html.includes("data:image/"));
    assert.ok(advReimported.securityFindings.every((f) => f.severity !== "blocked"), `Unexpected blocked findings on re-import: ${JSON.stringify(advReimported.securityFindings)}`);

    // Contact sheet visually documenting all 6 round-tripped UI fixtures
    const sheetPng = path.join(workDir, "roundtrip-contact-sheet.png");
    await buildContactSheet(shotsDir, sheetPng, { title: "M3 Round-Trip Fidelity (Doop -> Motion -> Doop -> Motion)", cols: 3, labels: roundTripLabels });
    assert.ok((await stat(sheetPng)).size > 5000);
    console.log(`M3 contact sheet: ${sheetPng}`);
  } finally {
    if (server.listening) await new Promise((r) => server.close(r));
  }
});
