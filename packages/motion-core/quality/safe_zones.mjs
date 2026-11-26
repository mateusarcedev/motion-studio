import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(path.join(__dirname, "../safe-zones/presets.json"), "utf8"));

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function invalid(message) { throw new TypeError(message); }

export function listSafeZonePresets() {
  return Object.entries(catalog.presets).map(([id, preset]) => ({ id, ...clone(preset), catalogVersion: catalog.version }));
}

export function getSafeZonePreset(id, override = null) {
  const preset = catalog.presets[id];
  if (!preset) return null;
  return validateSafeZonePreset({ id, ...clone(preset), catalogVersion: catalog.version, ...(override || {}) });
}

function validateRegion(region, field) {
  if (!region || typeof region !== "object" || typeof region.id !== "string") invalid(`${field} needs an id`);
  for (const key of ["x", "y", "width", "height"]) {
    const value = region[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) invalid(`${field}.${key} must be a percentage from 0 to 100`);
  }
  if (region.x + region.width > 100 || region.y + region.height > 100) invalid(`${field} must fit within the 0–100 percentage canvas`);
  return clone(region);
}

export function validateSafeZonePreset(preset) {
  if (!preset || typeof preset !== "object" || typeof preset.id !== "string" || !preset.id.trim()) invalid("preset.id is required");
  const ratioMatch = preset.aspectRatio === "variable" ? null : String(preset.aspectRatio || "").match(/^([0-9]+(?:\.[0-9]+)?):([0-9]+(?:\.[0-9]+)?)$/);
  if (preset.aspectRatio !== "variable" && (!ratioMatch || Number(ratioMatch[1]) <= 0 || Number(ratioMatch[2]) <= 0)) invalid("preset.aspectRatio must be a positive L:A ratio or variable");
  if (!preset.referenceResolution || preset.referenceResolution.length !== 2 || preset.referenceResolution.some((v) => !Number.isInteger(v) || v <= 0)) invalid("preset.referenceResolution must contain positive width and height");
  if (!preset.margins || typeof preset.margins !== "object") invalid("preset.margins is required");
  const margins = {};
  for (const side of ["top", "bottom", "left", "right"]) {
    const value = preset.margins[side];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value >= 50) invalid(`preset.margins.${side} must be in [0, 50)`);
    margins[side] = value;
  }
  if (margins.top + margins.bottom >= 100 || margins.left + margins.right >= 100) invalid("preset margins leave no safe canvas");
  if (!Array.isArray(preset.reservedRegions) || !Array.isArray(preset.attentionRegions)) invalid("preset reservedRegions and attentionRegions must be arrays");
  if (typeof preset.platform !== "string" || typeof preset.provenance !== "string" || typeof preset.sourceKind !== "string" || typeof preset.version !== "string") invalid("preset platform, provenance, sourceKind, and version are required");
  return { ...clone(preset), margins, reservedRegions: preset.reservedRegions.map((region, i) => validateRegion(region, `reservedRegions[${i}]`)), attentionRegions: preset.attentionRegions.map((region, i) => validateRegion(region, `attentionRegions[${i}]`)) };
}

function intersection(a, b) {
  const left = Math.max(a.x, b.x), top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width), bottom = Math.min(a.y + a.height, b.y + b.height);
  return right - left > 0 && bottom - top > 0 ? { x: left, y: top, width: right - left, height: bottom - top } : null;
}

function regionPixels(region, width, height) {
  return { x: width * region.x / 100, y: height * region.y / 100, width: width * region.width / 100, height: height * region.height / 100 };
}

export function analyzeSafeZones({ width, height, preset: inputPreset, elements = [], time = null, frame = null }) {
  const preset = validateSafeZonePreset(inputPreset);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) invalid("width and height must be positive numbers");
  if (!Array.isArray(elements)) invalid("elements must be an array of declared geometry bounds");
  const safeArea = {
    x: width * preset.margins.left / 100,
    y: height * preset.margins.top / 100,
    width: width * (100 - preset.margins.left - preset.margins.right) / 100,
    height: height * (100 - preset.margins.top - preset.margins.bottom) / 100,
  };
  const warnings = [];
  if (preset.aspectRatio !== "variable") {
    const [ratioWidth, ratioHeight] = preset.aspectRatio.split(":").map(Number);
    if (Math.abs(width / height - ratioWidth / ratioHeight) > 0.002) {
      warnings.push({ code: "ASPECT_RATIO_MISMATCH", severity: "error", message: `Canvas ratio ${width}:${height} does not match preset ${preset.aspectRatio}.` });
    }
  }
  const visibleElements = elements.filter((element) => element?.visible !== false);
  if (!elements.length) warnings.push({ code: "NO_DECLARED_IMPORTANT_BOUNDS", severity: "manual", message: "No important element exposed geometry; visually inspect this frame." });
  for (const item of visibleElements) {
    const box = { x: Number(item.x), y: Number(item.y), width: Number(item.width), height: Number(item.height) };
    if (Object.values(box).some((value) => !Number.isFinite(value)) || box.width <= 0 || box.height <= 0) {
      warnings.push({ code: "INVALID_ELEMENT_BOUNDS", severity: "error", elementId: item.id ?? "unknown", message: "Important element has invalid geometry." });
      continue;
    }
    const overflow = box.x < safeArea.x - 0.5 || box.y < safeArea.y - 0.5 || box.x + box.width > safeArea.x + safeArea.width + 0.5 || box.y + box.height > safeArea.y + safeArea.height + 0.5;
    if (overflow) warnings.push({ code: "SAFE_ZONE_BREACH", severity: "error", elementId: item.id, time, frame, box, message: `${item.id} extends outside the configured safe area.` });
    for (const region of preset.reservedRegions) {
      const overlap = intersection(box, regionPixels(region, width, height));
      if (overlap) warnings.push({ code: "RESERVED_AREA_COLLISION", severity: "error", elementId: item.id, regionId: region.id, time, frame, overlap, message: `${item.id} intersects the reserved region '${region.label || region.id}'.` });
    }
    for (const region of preset.attentionRegions) {
      const overlap = intersection(box, regionPixels(region, width, height));
      if (overlap) warnings.push({ code: "ATTENTION_REGION_OVERLAP", severity: "warning", elementId: item.id, regionId: region.id, time, frame, overlap, message: `${item.id} overlaps the attention region '${region.label || region.id}'.` });
    }
  }
  for (let i = 0; i < visibleElements.length; i++) {
    const a = visibleElements[i];
    for (let j = i + 1; j < visibleElements.length; j++) {
      const b = visibleElements[j];
      const overlap = intersection(a, b);
      if (overlap && overlap.width * overlap.height > 4) warnings.push({ code: "IMPORTANT_ELEMENTS_OVERLAP", severity: "error", elementIds: [a.id, b.id], time, frame, overlap, message: `${a.id} overlaps ${b.id}.` });
    }
  }
  const manualVisualInspectionRequired = !elements.length || visibleElements.some((element) => element.alt || element.mediaUnverified || ["image", "video"].includes(element.kind));
  if (manualVisualInspectionRequired && visibleElements.length) warnings.push({ code: "MEDIA_REQUIRES_VISUAL_INSPECTION", severity: "manual", time, frame, message: "Image/video content has no trustworthy internal semantic bounds; inspect its visible content manually." });
  const blocked = warnings.some((warning) => warning.severity === "error" || warning.severity === "manual");
  return {
    platform: preset.platform, presetId: preset.id, presetVersion: preset.version,
    sourceKind: preset.sourceKind, provenance: preset.provenance,
    width, height, safeArea, warnings,
    manualVisualInspectionRequired,
    passed: !blocked,
    approval: blocked ? "blocked" : warnings.length ? "review" : "approved",
  };
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function createSafeZoneOverlaySvg({ width, height, preset: inputPreset, elements = [], time = null }) {
  const preset = validateSafeZonePreset(inputPreset);
  const safe = {
    x: width * preset.margins.left / 100, y: height * preset.margins.top / 100,
    width: width * (100 - preset.margins.left - preset.margins.right) / 100,
    height: height * (100 - preset.margins.top - preset.margins.bottom) / 100,
  };
  const regions = [...preset.reservedRegions.map((region) => ({ ...region, color: "#EF4444" })), ...preset.attentionRegions.map((region) => ({ ...region, color: "#F59E0B" }))].map((region) => {
    const rect = regionPixels(region, width, height);
    return `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="${region.color}" fill-opacity=".2" stroke="${region.color}" stroke-width="3"/><text x="${rect.x + 8}" y="${rect.y + 24}" fill="${region.color}" font-size="20" font-family="sans-serif">${escapeXml(region.label || region.id)}</text>`;
  }).join("");
  const boxes = elements.filter((element) => element.visible !== false).map((element) => `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" fill="none" stroke="#FACC15" stroke-width="4"/><text x="${element.x + 4}" y="${Math.max(24, element.y - 8)}" fill="#FACC15" font-size="22" font-family="sans-serif">${escapeXml(element.id || "important")}</text>`).join("");
  const outside = `<path d="M0 0H${width}V${height}H0Z M${safe.x} ${safe.y}V${safe.y + safe.height}H${safe.x + safe.width}V${safe.y}Z" fill="#EF4444" fill-opacity=".16" fill-rule="evenodd"/>`;
  const headline = `<text x="20" y="36" fill="#FFFFFF" stroke="#111827" stroke-width="4" paint-order="stroke" font-size="24" font-family="sans-serif">QA overlay · ${escapeXml(preset.platform)} · ${time === null ? "frame" : `${Number(time).toFixed(2)}s`}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${outside}<rect x="${safe.x}" y="${safe.y}" width="${safe.width}" height="${safe.height}" fill="#22C55E" fill-opacity=".06" stroke="#22C55E" stroke-width="4" stroke-dasharray="14 10"/>${regions}${boxes}${headline}</svg>`;
}

function parseRenderResult(result) {
  const start = result.stdout.indexOf("{");
  return start < 0 ? {} : JSON.parse(result.stdout.slice(start));
}

export async function qaSafeZones(inputHtml, options = {}) {
  const source = path.resolve(inputHtml);
  const platform = options.platform || "instagram-reels";
  const preset = options.customPreset ? validateSafeZonePreset(options.customPreset) : getSafeZonePreset(platform);
  if (!preset) invalid(`unknown safe-zone preset '${platform}'`);
  if (preset.aspectRatio === "variable" && !options.customPreset) invalid("custom safe-zone checks require a customPreset with margins and dimensions");
  const [referenceWidth, referenceHeight] = preset.referenceResolution || [];
  const width = Number(options.width || referenceWidth), height = Number(options.height || referenceHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height)) invalid("custom safe-zone checks require width and height");
  const duration = Number(options.duration || 8), fps = Number(options.fps || 30);
  if (duration <= 0 || duration > 300 || !Number.isInteger(fps) || fps < 1 || fps > 120) invalid("duration must be (0,300] and fps an integer from 1 to 120");
  const totalFrames = Math.max(1, Math.round(duration * fps));
  let times = options.sampleTimes;
  if (!times) {
    times = [];
    for (let time = 0; time < duration; time += 0.5) times.push(Number(time.toFixed(4)));
    times.push(Math.max(0, duration - 1 / fps));
  }
  if (!Array.isArray(times) || !times.length) invalid("sampleTimes must be a non-empty array");
  const samples = times.map((time) => {
    const value = Number(time);
    if (!Number.isFinite(value) || value < 0 || value >= duration) invalid(`sampleTime must be within [0, ${duration})`);
    return { time: value, frame: Math.min(totalFrames - 1, Math.round(value * fps)) };
  });
  const frames = [...new Set(samples.map(({ frame }) => frame))];
  const outputDir = path.resolve(options.outputDir || path.join(path.dirname(source), "qa-safe-zones"));
  await mkdir(outputDir, { recursive: true });
  const runRoot = await mkdtemp(path.join(outputDir, "safe-zones-"));
  const framesDir = path.join(runRoot, "frames");
  const core = await import("../index.js");
  const renderer = parseRenderResult(await core.renderFrames(source, framesDir, {
    frames: totalFrames, fps, width, height, scale: Number(options.scale || 1), seed: options.seed ?? 1,
    sampleFrames: frames, inspectBounds: true, signal: options.signal, offline: true,
  }));
  const reports = [];
  for (const sample of samples) {
    const filename = `${String(sample.frame).padStart(4, "0")}`;
    const framePath = path.join(framesDir, `${filename}.png`);
    const boundsPath = path.join(framesDir, `${filename}.bounds.json`);
    const bounds = JSON.parse(await readFile(boundsPath, "utf8"));
    const analysis = analyzeSafeZones({ width, height, preset, elements: bounds.elements, time: sample.time, frame: sample.frame });
    const overlaySvg = createSafeZoneOverlaySvg({ width, height, preset, elements: bounds.elements, time: sample.time });
    const overlayPath = path.join(runRoot, `${filename}-safe-zone-overlay.svg`);
    const previewPath = path.join(runRoot, `${filename}-safe-zone-preview.png`);
    await writeFile(overlayPath, overlaySvg);
    const frameBase64 = (await readFile(framePath)).toString("base64");
    const previewHtml = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background-color:#49515d;background-image:linear-gradient(45deg,#707985 25%,transparent 25%),linear-gradient(-45deg,#707985 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#707985 75%),linear-gradient(-45deg,transparent 75%,#707985 75%);background-size:32px 32px;background-position:0 0,0 16px,16px -16px,-16px 0}main{position:relative;width:${width}px;height:${height}px}img,svg{position:absolute;inset:0;width:${width}px;height:${height}px}svg{pointer-events:none}</style></head><body><main><img src="data:image/png;base64,${frameBase64}"/>${overlaySvg}</main></body></html>`;
    const htmlPath = path.join(runRoot, `${filename}-safe-zone-preview.html`);
    await writeFile(htmlPath, previewHtml);
    await core.renderStatic(htmlPath, previewPath, { width, height, scale: 1, signal: options.signal, offline: true });
    reports.push({ ...analysis, time: sample.time, frame: sample.frame, framePath, boundsPath, overlayPath, previewPath, elementCount: bounds.elements.length });
  }
  const passed = reports.every((report) => report.passed);
  const reportPath = path.join(runRoot, "safe-zone-report.json");
  const report = {
    schema: "motion-safe-zone-report@1", passed,
    approval: passed ? "approved-for-declared-bounds" : "blocked",
    platform: preset.platform, presetId: preset.id, presetVersion: preset.version,
    aspectRatio: preset.aspectRatio, dimensions: { width, height },
    sourceKind: preset.sourceKind, provenance: preset.provenance,
    temporalSampling: { duration, fps, frames: reports.map(({ frame, time }) => ({ frame, time })) },
    samples: reports,
    manualVisualInspectionRequired: reports.some((reportItem) => reportItem.manualVisualInspectionRequired),
    environment: { node: process.version, chromium: renderer.browserVersion || "unavailable", fonts: renderer.fonts || null, pageErrors: renderer.pageErrors || [] },
    note: "The overlay and preview PNGs are QA evidence only; they are not included in the rendered composition.",
    reportPath,
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  return report;
}

