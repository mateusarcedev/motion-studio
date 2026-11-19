import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { componentSize, generateComponentHtml, validateComponentConfig } from "./index.js";

let tempSequence = 0;

async function withGeneratedHtml(config, baseDir, operation) {
  const safeBase = path.resolve(baseDir || process.cwd());
  const hashTag = `${process.pid}-${++tempSequence}`;
  const htmlPath = path.join(safeBase, `.motion-${config.component}-${hashTag}.html`);
  await writeFile(htmlPath, generateComponentHtml(config), { flag: "wx", encoding: "utf8" });
  try { return await operation(htmlPath); }
  finally { await rm(htmlPath, { force: true }); }
}

export async function previewMotionComponent(input, outputPng, options = {}) {
  const config = validateComponentConfig(input);
  await mkdir(path.dirname(path.resolve(outputPng)), { recursive: true });
  const { width, height } = componentSize(config.aspectRatio);
  return withGeneratedHtml(config, options.baseDir || path.dirname(path.resolve(outputPng)), async (htmlPath) => {
    const core = await import("../index.js");
    const result = await core.renderStatic(htmlPath, outputPng, {
      width: options.width || width, height: options.height || height,
      scale: options.scale || 1, frame: options.frame ?? 0, seed: options.seed ?? 1,
      fps: config.fps, frames: Math.max(1, Math.round(config.duration * config.fps)),
    });
    return { ...result, component: config.component, instanceId: config.instanceId, output: path.resolve(outputPng), preview: true };
  });
}

export async function renderMotionComponent(input, outputFile, options = {}) {
  const output = path.resolve(outputFile);
  await mkdir(path.dirname(output), { recursive: true });
  const config = validateComponentConfig(input);
  const format = path.extname(output).toLowerCase() === ".webm" ? "webm" : path.extname(output).toLowerCase() === ".mp4" ? "mp4" : null;
  if (!format) throw new TypeError("output: use a extensão .mp4 ou .webm");
  if (format === "mp4" && (config.transparent || config.theme.background === "transparent")) throw new TypeError("MP4 não preserva canal alfa; use saída .webm para transparência real");
  const transparent = format === "webm" || config.transparent;
  const renderConfig = { ...config, transparent };
  const { width, height } = componentSize(config.aspectRatio);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "motion-component-"));
  const framesDir = path.join(tempRoot, "frames");
  try {
    const core = await import("../index.js");
    await withGeneratedHtml(renderConfig, options.baseDir || path.dirname(output), async (htmlPath) => {
      await core.renderFrames(htmlPath, framesDir, {
        frames: Math.max(1, Math.round(config.duration * config.fps)),
        fps: config.fps, width: options.width || width, height: options.height || height,
        scale: options.scale || 1, seed: options.seed ?? 1, transparent,
      });
    });
    const result = await core.assembleVideo(framesDir, output, { fps: config.fps, format });
    return {
      output, component: config.component, instanceId: config.instanceId,
      width: options.width || width, height: options.height || height, fps: config.fps,
      frames: Math.max(1, Math.round(config.duration * config.fps)),
      duration: Math.max(1, Math.round(config.duration * config.fps)) / config.fps,
      format, transparent: format === "webm", provenance: {
        kind: "motion-core-native", schema: "motion-component@1", componentVersion: 1,
        parameters: config, renderer: "motion-core Playwright frame renderer + FFmpeg",
      },
      stdout: result.stdout,
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

export async function renderComposition(inputHtml, outputFile, options = {}) {
  const output = path.resolve(outputFile);
  await mkdir(path.dirname(output), { recursive: true });
  const format = path.extname(output).toLowerCase() === ".webm" ? "webm" : path.extname(output).toLowerCase() === ".mp4" ? "mp4" : null;
  if (!format) throw new TypeError("output: use a extensão .mp4 ou .webm");
  if (format === "mp4" && options.transparent === true) throw new TypeError("MP4 não preserva canal alfa; use saída .webm para transparência real");
  const frames = Number(options.frames || Number(options.duration || 8) * Number(options.fps || 30));
  const fps = Number(options.fps || 30);
  const width = Number(options.width || 1080), height = Number(options.height || 1920);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "motion-composition-"));
  try {
    const core = await import("../index.js");
    await core.renderFrames(inputHtml, path.join(tempRoot, "frames"), {
      frames, fps, width, height, scale: Number(options.scale || 1),
      seed: options.seed ?? 1, transparent: format === "webm" || options.transparent === true,
    });
    return await core.assembleVideo(path.join(tempRoot, "frames"), output, { fps, audio: options.audio, format });
  } finally { await rm(tempRoot, { recursive: true, force: true }); }
}
