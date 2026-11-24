import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  paletteFromTokens,
  bridge as B,
} from "@technomanceer/motion-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = path.join(root, "tests", "fixtures", "bridge");

test("DoopAdapter imports 11-type tokens, maps to Motion brand tokens, and exports in dependency order", async () => {
  const raw = JSON.parse(await readFile(path.join(fixturesDir, "doop-tokens-sample.json"), "utf8"));
  const adapter = B.createDoopAdapter();

  const bundle = adapter.importTokens(raw, {
    brandSlug: "bora-campo",
    webFonts: ["Instrument Serif", "Geist"],
  });
  assert.equal(bundle.schemaVersion, "1.0.0");
  assert.equal(bundle.sourceEditor, "doop");
  assert.deepEqual(bundle.themes, ["dark"]);
  assert.equal(bundle.tokens.length, 17);

  // Compatible with Motion creative-core/brands/*/tokens.json and paletteFromTokens()
  const brandTokens = B.toMotionBrandTokens(bundle);
  assert.equal(brandTokens.color.background, "#F7F4EE");
  assert.equal(brandTokens.color.text, "#0E1116");
  assert.equal(brandTokens.color.primary, "#1F6F50");
  assert.equal(brandTokens.typography.headline.family, "\"Instrument Serif\", Georgia, serif");
  assert.equal(brandTokens.themes.dark["--color-ground"], "#0E1116");

  const palette = paletteFromTokens(brandTokens, { mode: "light" });
  assert.equal(palette.bg, "#F7F4EE");
  assert.equal(palette.fg, "#0E1116");
  assert.equal(palette.readable, true);

  // Roundtrip export places alias targets before aliases
  const exported = adapter.exportTokens(bundle, { mode: "create" });
  const indexOf = (name) => exported.tokens.findIndex((t) => t.name === name);
  assert.ok(indexOf("--color-linen-50") < indexOf("--color-ground"));
  assert.ok(indexOf("--color-slate-950") < indexOf("--color-ink"));
  assert.ok(indexOf("--color-pine-600") < indexOf("--color-primary"));

  // CSS string import parity
  const cssBlock = `
    :root { --color-ground: #F7F4EE; --color-ink: #0E1116; --font-display: "Instrument Serif", serif; }
    :root[data-doop-theme="dark"] { --color-ground: #0E1116; --color-ink: #F7F4EE; }
  `;
  const cssBundle = adapter.importTokens(cssBlock, { brandSlug: "css-test" });
  assert.deepEqual(cssBundle.themes, ["dark"]);
  assert.equal(cssBundle.tokens.find((t) => t.cssVar === "--color-ground").themes.dark, "#0E1116");
});

test("DoopAdapter imports frame to deterministic MotionDesignIR@1 with components, flows, and diagnostics", async () => {
  const frame = JSON.parse(await readFile(path.join(fixturesDir, "doop-frame-sample.json"), "utf8"));
  const adapter = B.createDoopAdapter();

  const ir1 = adapter.importFrame(frame, { documentId: frame.canvasId });
  const ir2 = adapter.importFrame({ ...frame, html: frame.html }, { documentId: frame.canvasId });

  assert.equal(ir1.irHash, ir2.irHash);
  assert.equal(ir1.source.editor, "doop");
  assert.equal(ir1.source.approvalStatus, "ready_for_dev");
  assert.equal(ir1.viewport.width, 1280);
  assert.equal(ir1.viewport.height, 800);

  assert.equal(ir1.componentsUsed.length, 1);
  assert.equal(ir1.componentsUsed[0].component, "Badge");
  assert.deepEqual(ir1.componentsUsed[0].props, { label: "New Release", tone: "accent" });

  assert.equal(ir1.prototypeFlows.length, 1);
  assert.deepEqual(ir1.prototypeFlows[0], {
    fromFrameId: "frm_hero_01",
    triggerElementId: "el_cta",
    on: "click",
    action: "navigate:frm_demo_02",
    targetFrameId: "frm_demo_02",
    transition: "push-left",
    durationMs: 350,
  });

  assert.equal(ir1.referencedAssets.length, 1);
  assert.equal(ir1.referencedAssets[0].safe, true);

  const videoReadiness = adapter.validateTargetReadiness(ir1, { target: "video" });
  assert.equal(videoReadiness.ok, false);
  assert.ok(videoReadiness.blockingDiagnostics.some((d) => d.code === "CSS_KEYFRAMES_DETECTED"));
  assert.ok(videoReadiness.blockingDiagnostics.some((d) => d.code === "EXTERNAL_NETWORK_ASSET"));

  const staticReadiness = adapter.validateTargetReadiness(ir1, { target: "static" });
  assert.equal(staticReadiness.ok, true);
});

test("DoopAdapter neutralizes untrusted adversarial HTML (XSS, SSRF, SMIL, base64, prompt injection)", async () => {
  const html = await readFile(path.join(fixturesDir, "doop-untrusted-adversarial.html"), "utf8");
  const adapter = B.createDoopAdapter();

  const ir = adapter.importFrame(
    { id: "frm_evil", name: "Untrusted", width: 800, height: 600, html },
    { documentId: "cnv_test" }
  );

  assert.ok(!/<script\b/i.test(ir.sanitizedHtml));
  assert.ok(!/<iframe\b/i.test(ir.sanitizedHtml));
  assert.ok(!/<foreignObject\b/i.test(ir.sanitizedHtml));
  assert.ok(!/\sonerror\s*=/i.test(ir.sanitizedHtml));
  assert.ok(!/\sonclick\s*=/i.test(ir.sanitizedHtml));
  assert.ok(!/javascript:/i.test(ir.sanitizedHtml));
  assert.ok(!/ignore previous instructions/i.test(ir.sanitizedHtml));

  const secCodes = new Set(ir.securityFindings.map((f) => f.code));
  assert.ok(secCodes.has("SCRIPT_STRIPPED"));
  assert.ok(secCodes.has("IFRAME_STRIPPED"));
  assert.ok(secCodes.has("FOREIGN_OBJECT_STRIPPED"));
  assert.ok(secCodes.has("EVENT_HANDLER_STRIPPED"));
  assert.ok(secCodes.has("UNSAFE_URL_SCHEME_STRIPPED"));
  assert.ok(secCodes.has("PROMPT_INJECTION_DETECTED"));
  assert.ok(secCodes.has(B.assertSafeRemoteUrl ? "MOTION_BRIDGE_UNSAFE_URL" : ""));

  const compatCodes = new Set(ir.compatibilityDiagnostics.map((d) => d.code));
  assert.ok(compatCodes.has("CLOCK_OR_RANDOM_API_DETECTED"));
  assert.ok(compatCodes.has("RUNTIME_NETWORK_CALL_DETECTED"));
  assert.ok(compatCodes.has("SMIL_ANIMATION_DETECTED"));
  assert.ok(compatCodes.has("BASE64_DATA_URI_FLAGGED"));

  const blockedAsset = ir.referencedAssets.find((a) => a.url.includes("169.254.169.254"));
  assert.ok(blockedAsset && blockedAsset.safe === false);

  const readiness = adapter.validateTargetReadiness(ir, { target: "static" });
  assert.equal(readiness.ok, false);
  assert.equal(readiness.hasSecurityQuarantine, true);
});
