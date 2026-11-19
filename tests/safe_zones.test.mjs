import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeSafeZones,
  getSafeZonePreset,
  listSafeZonePresets,
  validateSafeZonePreset,
} from "../packages/motion-core/quality/safe_zones.mjs";

test("versioned platform presets expose their aspect, reference resolution, and heuristic provenance", () => {
  const presets = listSafeZonePresets();
  for (const id of ["instagram-reels", "instagram-stories", "tiktok", "youtube-shorts", "youtube-horizontal", "feed-4-5", "square-1-1", "custom"]) {
    assert.ok(presets.some((preset) => preset.id === id), `missing ${id}`);
  }
  const reels = getSafeZonePreset("instagram-reels");
  assert.equal(reels.aspectRatio, "9:16");
  assert.deepEqual(reels.referenceResolution, [1080, 1920]);
  assert.match(reels.provenance, /MOTION.*heuristic/i);
  assert.notEqual(reels.sourceKind, "platform-official");
});

test("important element bounds are checked against the safe area and reserved UI regions", () => {
  const preset = getSafeZonePreset("instagram-reels");
  const safe = analyzeSafeZones({ width: 1080, height: 1920, preset, elements: [
    { id: "title", x: 120, y: 400, width: 600, height: 120, visible: true },
  ] });
  assert.equal(safe.passed, true);
  const unsafe = analyzeSafeZones({ width: 1080, height: 1920, preset, elements: [
    { id: "cta", x: 930, y: 800, width: 120, height: 180, visible: true },
  ] });
  assert.ok(unsafe.warnings.some((warning) => warning.code === "RESERVED_AREA_COLLISION"));
  const top = analyzeSafeZones({ width: 1080, height: 1920, preset, elements: [
    { id: "title", x: 120, y: 20, width: 600, height: 80, visible: true },
  ] });
  assert.ok(top.warnings.some((warning) => warning.code === "SAFE_ZONE_BREACH"));
});

test("overlapping important boxes are reported and absent bounds require visual inspection", () => {
  const preset = getSafeZonePreset("youtube-horizontal");
  const collisions = analyzeSafeZones({ width: 1920, height: 1080, preset, elements: [
    { id: "title", x: 400, y: 300, width: 600, height: 120, visible: true },
    { id: "cta", x: 500, y: 340, width: 300, height: 100, visible: true },
  ] });
  assert.ok(collisions.warnings.some((warning) => warning.code === "IMPORTANT_ELEMENTS_OVERLAP"));
  const unknown = analyzeSafeZones({ width: 1920, height: 1080, preset, elements: [] });
  assert.equal(unknown.manualVisualInspectionRequired, true);
  assert.equal(unknown.approval, "blocked");
  const hidden = analyzeSafeZones({ width: 1920, height: 1080, preset, elements: [
    { id: "callout", x: 400, y: 300, width: 600, height: 120, visible: false },
  ] });
  assert.equal(hidden.manualVisualInspectionRequired, false);
  assert.equal(hidden.passed, true);
});

test("custom presets require valid ratios, resolution, source, and bounded margin values", () => {
  const valid = {
    id: "client-format", platform: "custom", aspectRatio: "3:2", referenceResolution: [1500, 1000],
    margins: { top: 5, bottom: 7, left: 6, right: 6 }, reservedRegions: [], attentionRegions: [],
    version: "1", sourceKind: "user-defined", provenance: "Supplied by the operator.",
  };
  assert.equal(validateSafeZonePreset(valid).id, "client-format");
  assert.throws(() => validateSafeZonePreset({ ...valid, margins: { ...valid.margins, top: 120 } }), /top/i);
  const mismatch = analyzeSafeZones({ width: 1080, height: 1080, preset: getSafeZonePreset("instagram-reels"), elements: [] });
  assert.ok(mismatch.warnings.some((warning) => warning.code === "ASPECT_RATIO_MISMATCH"));
});
