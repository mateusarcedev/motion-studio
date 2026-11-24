import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const RISK_PATTERNS = [
  ["wall-clock-time", /\bDate\.now\s*\(|\bnew\s+Date\s*\(|\bperformance\.now\s*\(/g],
  ["unseeded-random", /\bMath\.random\s*\(/g],
  ["timer-outside-timeline", /\bset(?:Timeout|Interval)\s*\(/g],
  ["css-clock-animation", /@keyframes|\banimation\s*:/gi],
  ["realtime-frame-loop", /\brequestAnimationFrame\s*\(/g],
];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr.trim() || `${command} exited with ${code}`)));
  });
}

function parseRendererResult(result) {
  const start = result.stdout.indexOf("{");
  if (start < 0) throw new Error("frame renderer returned no JSON metadata");
  return JSON.parse(result.stdout.slice(start));
}

async function inspectInputs(inputHtml) {
  const root = path.resolve(inputHtml);
  const sources = [], files = new Map(), externalAssets = new Set(), queue = [root], visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    let bytes;
    try { bytes = await readFile(current); } catch { continue; }
    files.set(current, sha256(bytes));
    if (!/\.(?:html?|js|mjs|css|json|svg|xml)$/i.test(current)) continue;
    const content = bytes.toString("utf8");
    sources.push({ path: current, content });
    const refs = new Set();
    for (const match of content.matchAll(/<(?:script|img|image|video|audio|source|link)\b[^>]*\b(?:src|href|poster|srcset)\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
      const value = match[1];
      if (/\bsrcset\s*=/i.test(match[0])) value.split(",").forEach((entry) => refs.add(entry.trim().split(/\s+/)[0]));
      else refs.add(value);
    }
    for (const match of content.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)|@import\s+["']([^"']+)["']/gi)) refs.add(match[1] || match[2]);
    for (const ref of refs) {
      if (!ref || ref.startsWith("#") || /^(?:data:|blob:)/i.test(ref)) continue;
      if (/^(?:[a-z]+:|\/\/)/i.test(ref)) { externalAssets.add(ref); continue; }
      const file = path.resolve(path.dirname(current), decodeURIComponent(ref.split(/[?#]/, 1)[0]));
      if (!visited.has(file)) queue.push(file);
    }
  }
  return {
    sources,
    files: [...files].map(([file, sha256]) => ({ path: file, sha256 })),
    externalAssets: [...externalAssets].sort(),
  };
}

function staticRiskDiagnostics(sources) {
  const findings = [];
  for (const source of sources) {
    for (const [category, pattern] of RISK_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(source.content))) {
        const line = source.content.slice(0, match.index).split("\n").length;
        findings.push({ category, path: source.path, line, snippet: match[0] });
      }
    }
  }
  return findings;
}

function firstLine(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.split("\n")[0].trim() : "unavailable";
}

function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

async function pixelDiff(fileA, fileB, output) {
  await run("ffmpeg", ["-y", "-v", "error", "-i", fileA, "-i", fileB,
    "-filter_complex", "[0:v][1:v]blend=all_mode=difference,eq=contrast=4:brightness=0.03[out]",
    "-map", "[out]", "-frames:v", "1", output]);
}

export async function verifyDeterminism(inputHtml, options = {}) {
  const source = path.resolve(inputHtml);
  const duration = Number(options.duration ?? 8);
  const fps = Number(options.fps ?? 30);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 300) throw new TypeError("duration must be between 0 and 300 seconds");
  if (!Number.isInteger(fps) || fps < 1 || fps > 120) throw new TypeError("fps must be an integer from 1 to 120");
  const totalFrames = Math.max(1, Math.round(duration * fps));
  const sampleTimes = options.sampleTimes ?? [0, Math.max(0, duration / 2), Math.max(0, duration - 1 / fps)];
  if (!Array.isArray(sampleTimes) || !sampleTimes.length) throw new TypeError("sampleTimes must be a non-empty array");
  const samples = sampleTimes.map((time) => {
    if (typeof time !== "number" || !Number.isFinite(time) || time < 0 || time >= duration) throw new TypeError(`sample time must be within [0, ${duration})`);
    return { time, frame: Math.min(totalFrames - 1, Math.round(time * fps)) };
  });
  if (new Set(samples.map((sample) => sample.frame)).size !== samples.length) throw new TypeError("sampleTimes map to duplicate frames at the selected fps");

  const outputDir = path.resolve(options.outputDir || path.join(path.dirname(source), "qa-determinism"));
  await mkdir(outputDir, { recursive: true });
  const runRoot = await mkdtemp(path.join(outputDir, "determinism-"));
  const runA = path.join(runRoot, "session-a"), runB = path.join(runRoot, "session-b");
  const core = await import("../index.js");
  const renderOptions = {
    frames: totalFrames, fps, width: Number(options.width || 1080), height: Number(options.height || 1920),
    scale: Number(options.scale || 1), seed: options.seed ?? 1,
    sampleFrames: samples.map((sample) => sample.frame), transparent: options.transparent === true,
    offline: options.offline === true,
  };
  const renderedA = parseRendererResult(await core.renderFrames(source, runA, renderOptions));
  const renderedB = parseRendererResult(await core.renderFrames(source, runB, renderOptions));
  const reportSamples = [];
  for (const sample of samples) {
    const filename = `${String(sample.frame).padStart(4, "0")}.png`;
    const fileA = path.join(runA, filename), fileB = path.join(runB, filename);
    const hashA = sha256(await readFile(fileA)), hashB = sha256(await readFile(fileB));
    const report = {
      frame: sample.frame, time: sample.time,
      sessionA: { sha256: hashA, path: fileA }, sessionB: { sha256: hashB, path: fileB },
      identical: hashA === hashB,
    };
    if (!report.identical) {
      const diff = path.join(runRoot, `${String(sample.frame).padStart(4, "0")}-difference.png`);
      await pixelDiff(fileA, fileB, diff);
      report.evidence = { sessionA: fileA, sessionB: fileB, diff };
    }
    reportSamples.push(report);
  }
  const inputs = await inspectInputs(source);
  const staticRisks = staticRiskDiagnostics(inputs.sources);
  const pageErrors = [...(renderedA.pageErrors || []), ...(renderedB.pageErrors || [])];
  const fontFaces = [...(renderedA.fonts?.faces || []), ...(renderedB.fonts?.faces || [])];
  const fontErrors = fontFaces.filter((font) => font.status !== "loaded");
  const fontsReady = renderedA.fonts?.status === "loaded" && renderedB.fonts?.status === "loaded" && fontErrors.length === 0;
  const framePixelDeterminism = reportSamples.every((sample) => sample.identical);
  const passed = framePixelDeterminism && fontsReady && pageErrors.length === 0;
  const require = createRequire(import.meta.url);
  let playwrightVersion = "unavailable";
  try { playwrightVersion = JSON.parse(await readFile(require.resolve("playwright-core/package.json"), "utf8")).version; } catch {}
  const reportPath = path.join(runRoot, "determinism-report.json");
  const report = {
    schema: "motion-determinism-report@1", passed, approval: passed ? "approved-for-pixel-determinism" : "blocked",
    framePixelDeterminism, duration, fps, dimensions: { width: renderOptions.width, height: renderOptions.height },
    samples: reportSamples, staticRisks,
    inputs: { files: inputs.files, externalAssets: inputs.externalAssets },
    diagnostics: { pageErrors, fontsReady, fontErrors, fontFaces: renderedA.fonts?.faces ?? [] },
    scope: {
      pixelDeterminism: "sampled PNG SHA-256 equality in two fresh Playwright renderer processes",
      timeline: "sampled frame indices are derived from fps and selected times",
      artifactIntegrity: "PNG SHA-256 values identify captured frames; no video-container identity is inferred",
      binaryVideoIdentity: "not asserted across different FFmpeg, Chromium, font, or codec environments",
    },
    environment: {
      node: process.version, platform: process.platform, arch: process.arch,
      chromium: { sessionA: renderedA.browserVersion || "unavailable", sessionB: renderedB.browserVersion || "unavailable" }, playwright: playwrightVersion,
      ffmpeg: firstLine("ffmpeg", ["-version"]), ffprobe: firstLine("ffprobe", ["-version"]),
      fontsReady: fontsReady, fonts: renderedA.fonts?.faces ?? [],
    },
    reportPath,
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  return report;
}

