/**
 * MOTION Core — index.js
 * Programmatic API for MOTION Studio engines.
 */
import { spawn } from "node:child_process";
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
  buildGallery: path.join(__dirname, "gallery", "build_gallery.py"),
  frameDriver: path.join(__dirname, "design-system", "frame.js"),
  presets: path.join(__dirname, "presets.json"),
};

export { createMotionDriver } from "./design-system/frame.js";

function runProcess(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["inherit", "pipe", "pipe"], ...options });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve({ code, stdout, stderr });
      else reject(new Error(`Command ${cmd} ${args.join(" ")} failed with code ${code}\nStderr: ${stderr}\nStdout: ${stdout}`));
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
  return runProcess("node", args);
}

export async function assembleVideo(framesDir, outputMp4, options = {}) {
  const args = [PATHS.assembleVideo, framesDir, outputMp4];
  if (options.fps) args.push("--fps", String(options.fps));
  if (options.audio) args.push("--audio", options.audio);
  if (options.crf) args.push("--crf", String(options.crf));
  return runProcess("python3", args);
}

export async function validateStatic(pngPath, expectedWxH, scale = 2) {
  const args = [PATHS.validateStatic, pngPath, "--expected", expectedWxH, "--scale", String(scale)];
  return runProcess("python3", args);
}

export async function buildContactSheet(framesDir, outputPng, options = {}) {
  const args = [PATHS.buildContactSheet, framesDir, outputPng];
  if (options.beats) args.push("--beats", options.beats);
  return runProcess("python3", args);
}

export async function generateManifest(folder, outputPath = null) {
  const args = [PATHS.manifest, folder];
  if (outputPath) args.push("-o", outputPath);
  return runProcess("python3", args);
}

export async function exportZip(sourceDir, outputZip, extensions = "") {
  const args = [PATHS.zipExport, sourceDir, outputZip];
  if (extensions) args.push("--ext", extensions);
  return runProcess("python3", args);
}

export async function qaViewports(url, outdir, options = {}) {
  const args = [PATHS.qaViewports, url, outdir];
  if (options.wait) args.push(`--wait=${options.wait}`);
  if (options.canvas) args.push(`--canvas=${options.canvas}`);
  if (options.ignore) args.push(`--ignore=${options.ignore}`);
  return runProcess("node", args);
}
