/**
 * MOTION Core — index.js
 * Programmatic API for MOTION Studio engines.
 */
import { spawn } from "node:child_process";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PATHS = {
  renderStatic: path.join(__dirname, "renderers", "render_static.mjs"),
  renderFrames: path.join(__dirname, "renderers", "render_frames.mjs"),
  assembleVideo: path.join(__dirname, "renderers", "assemble_video.py"),
  qaViewports: path.join(__dirname, "renderers", "qa_viewports.mjs"),
  validateStatic: path.join(__dirname, "quality", "validate_static.py"),
  buildContactSheet: path.join(__dirname, "quality", "build_contact_sheet.py"),
  manifest: path.join(__dirname, "exporters", "manifest.py"),
  zipExport: path.join(__dirname, "exporters", "zip_export.py"),
  delivery: path.join(__dirname, "exporters", "delivery.py"),
  buildGallery: path.join(__dirname, "gallery", "build_gallery.py"),
  frameDriver: path.join(__dirname, "design-system", "frame.js"),
  presets: path.join(__dirname, "presets.json"),
  components: path.join(__dirname, "components", "index.js"),
  renderComposition: path.join(__dirname, "components", "render.js"),
  transitionRenderer: path.join(__dirname, "transitions", "ffmpeg.py"),
  verifyDeterminism: path.join(__dirname, "quality", "determinism.mjs"),
  safeZoneQA: path.join(__dirname, "quality", "safe_zones.mjs"),
  svgMotion: path.join(__dirname, "design-system", "svg-motion.js"),
  iconPack: path.join(__dirname, "assets", "icons", "lucide.pack.json"),
};

export { createMotionDriver } from "./design-system/frame.js";
export { MotionError, ERROR_CODES } from "./lib/errors.mjs";
export { parseFrameSelection } from "./lib/frames.mjs";
export { diagnoseBrowser, locateBrowser, smokeTestBrowser } from "./lib/browser.mjs";
export { validateSvg, assertSafeSvg, optimizeSvg, rasterizeSvg, buildComponent as buildSvgComponent, listComponents as listSvgComponents, applyTokens, paletteFromTokens } from "./svg/index.mjs";
export { loadIconPacks, renderIcon, iconProvenance } from "./icons/index.mjs";
export { searchIcons, createAssetSession, createDefaultRegistry, createProviderRegistry, defineProvider, importSvgPack, assessLicense, buildCredits, createAssetCache, validateLottie, classifyNeed } from "./visual-assets/index.mjs";
export { QA_STATUS, combineStatuses, createQaReport } from "./quality/qa-status.mjs";
export { qaMedia } from "./quality/media_qa.mjs";
export { qaFrames } from "./quality/frame_qa.mjs";
export { qaProject } from "./quality/qa_project.mjs";
export * as svgMotion from "./design-system/svg-motion.js";
export { listMotionComponents, getMotionComponent, validateComponentConfig, generateComponentHtml, componentSize } from "./components/index.js";
export { previewMotionComponent, renderMotionComponent, renderComposition } from "./components/render.js";
export { listTransitions, renderTransition } from "./transitions/index.js";
export { CRITIC_JSON_SCHEMA, validateCritic, recordCritic, verifyCritic, criticMarkdown } from "./quality/critic.mjs";
export { verifyDeterminism } from "./quality/determinism.mjs";
export * as reel from "./reel/index.mjs";
export {
  analyzeSafeZones,
  createSafeZoneOverlaySvg,
  getSafeZonePreset,
  listSafeZonePresets,
  qaSafeZones,
  validateSafeZonePreset,
} from "./quality/safe_zones.mjs";
export {
  classifyCreativeIntent,
  calculateAdaptiveDuration,
  SUBJECT_DOMAINS,
  INTENT_TYPES,
  AUDIENCE_PROFILES,
  CHANNELS,
  VISUAL_LANGUAGES,
} from "./intent/router.js";

function runProcess(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["inherit", "pipe", "pipe"], ...options });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve({ code, stdout, stderr });
      else {
        const error = new Error(`Command ${cmd} ${args.join(" ")} failed with code ${code}\nStderr: ${stderr}\nStdout: ${stdout}`);
        error.exitCode = code;
        error.stdout = stdout;
        error.stderr = stderr;
        // Renderers print a JSON report (status FAIL + structured errors) on stdout.
        try {
          const start = stdout.indexOf("{");
          if (start >= 0) {
            error.report = JSON.parse(stdout.slice(start));
            error.code = error.report.error?.code ?? error.report.health?.errorCodes?.[0] ?? undefined;
          }
        } catch {}
        reject(error);
      }
    });
  });
}

export async function renderStatic(inputHtml, outputPng, options = {}) {
  const args = [PATHS.renderStatic, inputHtml, outputPng];
  if (options.width) args.push(`--width=${options.width}`);
  if (options.height) args.push(`--height=${options.height}`);
  if (options.scale) args.push(`--scale=${options.scale}`);
  if (options.wait) args.push(`--wait=${options.wait}`);
  if (options.frame !== undefined) args.push(`--frame=${options.frame}`);
  if (options.seed !== undefined) args.push(`--seed=${options.seed}`);
  if (options.fps) args.push(`--fps=${options.fps}`);
  if (options.frames) args.push(`--frames=${options.frames}`);
  if (options.time !== undefined) args.push(`--time=${options.time}`);
  if (options.optionalAssets?.length) args.push(`--optional-assets=${[].concat(options.optionalAssets).join(",")}`);
  if (options.requireController) args.push("--require-controller");
  if (options.qaVisual) args.push("--qa-visual");
  if (options.qaContext) args.push(`--qa-context=${options.qaContext}`);
  if (options.transparent) args.push("--transparent");
  return runProcess("node", args);
}

export async function renderFrames(inputHtml, outdir, options = {}) {
  const args = [PATHS.renderFrames, inputHtml, outdir];
  if (options.frames) args.push(`--frames=${options.frames}`);
  if (options.fps) args.push(`--fps=${options.fps}`);
  if (options.width) args.push(`--width=${options.width}`);
  if (options.height) args.push(`--height=${options.height}`);
  if (options.scale) args.push(`--scale=${options.scale}`);
  if (options.seed !== undefined) args.push(`--seed=${options.seed}`);
  if (options.start !== undefined) args.push(`--start=${options.start}`);
  if (options.end !== undefined) args.push(`--end=${options.end}`);
  if (options.transparent) args.push("--transparent");
  if (options.sampleFrames !== undefined && options.sampleFrames !== null) {
    const spec = Array.isArray(options.sampleFrames) ? options.sampleFrames.join(",") : String(options.sampleFrames);
    args.push(`--sample-frames=${spec}`);
  }
  if (options.optionalAssets?.length) args.push(`--optional-assets=${[].concat(options.optionalAssets).join(",")}`);
  if (options.allowNoController) args.push("--allow-no-controller");
  if (options.inspectBounds) args.push("--inspect-bounds");
  return runProcess("node", args);
}

export async function assembleVideo(framesDir, outputMp4, options = {}) {
  const args = [PATHS.assembleVideo, framesDir, outputMp4];
  if (options.fps) args.push("--fps", String(options.fps));
  if (options.audio) args.push("--audio", options.audio);
  if (options.crf) args.push("--crf", String(options.crf));
  if (options.format) args.push("--format", options.format);
  return runProcess("python3", args);
}

export async function validateStatic(pngPath, expectedWxH, scale = 2) {
  const args = [PATHS.validateStatic, pngPath, "--expected", expectedWxH, "--scale", String(scale)];
  return runProcess("python3", args);
}

export async function buildContactSheet(framesDir, outputPng, options = {}) {
  const files = (await readdir(framesDir)).filter((file) => /^\d+\.png$/i.test(file)).sort();
  if (!files.length) throw new Error(`No numbered PNG frames found in ${framesDir}`);
  const output = path.resolve(outputPng);
  await mkdir(path.dirname(output), { recursive: true });
  const args = [PATHS.buildContactSheet, ...files.map((file) => path.join(framesDir, file)), "--out", output];
  const labels = options.labels || options.beats;
  if (Array.isArray(labels)) args.push("--labels", labels.join(";"));
  else if (typeof labels === "string") args.push("--labels", labels);
  if (options.title) args.push("--title", options.title);
  if (options.cols) args.push("--cols", String(options.cols));
  return runProcess("python3", args);
}

export async function generateManifest(folder, outputPath = null) {
  const args = [PATHS.delivery, "manifest", folder];
  if (outputPath) args.push("--out", outputPath);
  const result = await runProcess("python3", args);
  try { result.report = JSON.parse(result.stdout); } catch {}
  return result;
}

async function runDelivery(action, projectDir, zipPath, extensions = "") {
  const args = [PATHS.delivery, action, projectDir, zipPath];
  if (extensions) args.push("--ext", extensions);
  const result = await runProcess("python3", args);
  try { result.report = JSON.parse(result.stdout); } catch {}
  return result;
}

/** Build a versioned delivery manifest, package its declared files, then verify the real ZIP. */
export async function exportDelivery(projectDir, outputZip) {
  return runDelivery("export", projectDir, outputZip);
}

/** Verify the project contract, source hashes, ZIP inventory, CRCs and archived hashes. */
export async function verifyDelivery(projectDir, zipPath) {
  return runDelivery("verify", projectDir, zipPath);
}

/** Backward-compatible export name; now uses the delivery contract and validates its ZIP. */
export async function exportZip(sourceDir, outputZip, extensions = "") {
  return runDelivery("export", sourceDir, outputZip, extensions);
}

export async function qaViewports(url, outdir, options = {}) {
  const args = [PATHS.qaViewports, url, outdir];
  if (options.wait) args.push(`--wait=${options.wait}`);
  if (options.canvas) args.push(`--canvas=${options.canvas}`);
  if (options.ignore) args.push(`--ignore=${options.ignore}`);
  return runProcess("node", args);
}
