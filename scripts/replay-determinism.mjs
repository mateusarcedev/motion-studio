import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { composeFinalStage } from "../packages/motion-core/reel/render.mjs";
import { overlayLayers } from "../packages/motion-core/reel/overlays.mjs";
import { compareRenders } from "../packages/motion-core/reel/qa_reel.mjs";
import { resolveFrom } from "../packages/motion-core/reel/timeline.mjs";
import { requireFfmpeg, sha256File } from "../packages/motion-core/reel/util.mjs";
import { classifyDeterminismComparisons, parseDeterminismReplayArgs } from "./lib/determinism-investigation.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USAGE = [
  "Usage: node scripts/replay-determinism.mjs --source=<render-dir> [options]",
  "",
  "Replays only the final composition stage from a preserved reel render. It does not rerun",
  "analysis, voice processing, segment encoding, browser rendering, or the M23 pilots.",
  "",
  "Options:",
  "  --runs N                 number of final-stage renders (2-8; default 2)",
  "  --evidence-dir DIR       preserve all reports and MP4s under DIR",
  "  --expect-difference      classify a non-reproduced known incident as INCONCLUSIVE",
  "  --help                   show this help",
  "",
  "The source directory must contain reel.render.json, reel.timeline.json, and preserved",
  "reel.work/render-*/ intermediates from renderTimeline({ keepWork: true }).",
].join("\n");

function errorRecord(error) {
  return {
    name: error?.name ?? "Error",
    code: error?.code ?? null,
    message: error?.message ?? String(error),
    details: error?.details ?? null,
  };
}

async function isDirectory(dir) {
  try { return (await stat(dir)).isDirectory(); } catch { return false; }
}

async function regularFilesIn(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Symbolic links are not accepted in preserved font inputs: " + file);
    if (entry.isDirectory()) files.push(...await regularFilesIn(file));
    else if (entry.isFile()) files.push(file);
  }
  return files.sort();
}

async function resolveWorkDir(sourceDir, renderReport) {
  if (renderReport.workDir && await isDirectory(renderReport.workDir)) return path.resolve(renderReport.workDir);
  const direct = path.join(sourceDir, "reel.work");
  if (await isDirectory(direct)) {
    const candidates = (await readdir(direct, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("render-"))
      .map((entry) => path.join(direct, entry.name));
    if (candidates.length === 1) return candidates[0];
    throw new Error("Expected exactly one preserved render-* directory under " + direct + "; found " + candidates.length);
  }
  if (existsSync(path.join(sourceDir, "seg-001.mp4"))) return sourceDir;
  throw new Error("Preserved reel.work/render-* intermediates were not found under " + sourceDir);
}

async function loadSource(sourceDir) {
  const renderReportPath = path.join(sourceDir, "reel.render.json");
  const timelinePath = path.join(sourceDir, "reel.timeline.json");
  const renderReport = JSON.parse(await readFile(renderReportPath, "utf8"));
  const timeline = JSON.parse(await readFile(timelinePath, "utf8"));
  timeline.__file = timelinePath;
  const workDir = await resolveWorkDir(sourceDir, renderReport);

  const segmentFiles = (await readdir(workDir))
    .filter((name) => /^seg-\d+\.mp4$/.test(name))
    .sort()
    .map((name) => path.join(workDir, name));
  if (segmentFiles.length !== timeline.segments?.length || !segmentFiles.length) {
    throw new Error("Segment count does not match the timeline: " + segmentFiles.length + " file(s), " + (timeline.segments?.length ?? 0) + " expected");
  }

  const layersInTimeline = overlayLayers(timeline.overlays ?? []);
  const layersInReport = renderReport.overlays ?? [];
  if (layersInTimeline.length !== layersInReport.length) {
    throw new Error("Overlay layer count does not match render report");
  }
  const layers = layersInTimeline.map((layer, index) => {
    const record = layersInReport[index];
    if (record.id !== layer.overlay.id || record.step !== layer.step ||
      Math.abs(record.start - layer.start) > 0.000001 || Math.abs(record.end - layer.end) > 0.000001) {
      throw new Error("Overlay layer metadata mismatch at index " + index);
    }
    return { ...layer, png: path.join(workDir, "overlays", path.basename(record.png)) };
  });
  for (const layer of layers) if (!existsSync(layer.png)) throw new Error("Overlay input missing: " + layer.png);

  const voiceFile = renderReport.voice ? path.join(workDir, "voice.wav") : null;
  if (voiceFile && !existsSync(voiceFile)) throw new Error("Voice intermediate missing: " + voiceFile);
  const hasCaptions = Boolean(timeline.captions?.enabled && timeline.captions.pages?.length);
  const assFile = hasCaptions ? path.join(workDir, "captions.ass") : null;
  if (assFile && !existsSync(assFile)) throw new Error("ASS captions intermediate missing: " + assFile);
  const fontsDir = timeline.captions?.fontsDir ? resolveFrom(timeline, timeline.captions.fontsDir) : null;
  if (fontsDir && !existsSync(fontsDir)) throw new Error("Caption fonts directory missing: " + fontsDir);

  const inputs = [renderReportPath, timelinePath, ...segmentFiles, ...layers.map((layer) => layer.png), ...(voiceFile ? [voiceFile] : []), ...(assFile ? [assFile] : [])];
  if (fontsDir) inputs.push(...await regularFilesIn(fontsDir));
  const inputHashes = [];
  for (const file of inputs) {
    const details = await stat(file);
    if (!details.isFile()) throw new Error("Expected a regular input file: " + file);
    inputHashes.push({ path: file, bytes: details.size, sha256: await sha256File(file) });
  }
  return {
    renderReportPath,
    timelinePath,
    renderReport,
    timeline,
    workDir,
    segmentFiles,
    voiceFile,
    layers,
    assFile,
    fontsDir,
    inputs,
    inputHashes,
  };
}

function environment(ffmpegVersion) {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: os.cpus()[0]?.model ?? null,
    cpus: os.cpus().length,
    memoryGb: Math.round(os.totalmem() / (1024 ** 3)),
    ffmpeg: ffmpegVersion,
    chromium: {
      used: false,
      version: null,
      reason: "The final-stage replay consumes preserved overlay PNGs and does not launch Chromium.",
    },
  };
}

async function main() {
  let options;
  try { options = parseDeterminismReplayArgs(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write(JSON.stringify({ status: "INCONCLUSIVE", error: errorRecord(error) }) + "\n");
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    process.stdout.write(USAGE + "\n");
    return;
  }

  const evidenceBase = options.evidenceDir ? path.resolve(options.evidenceDir) : path.join(ROOT, "tests", "tmp");
  await mkdir(evidenceBase, { recursive: true });
  const evidenceDir = await mkdtemp(path.join(evidenceBase, "determinism-final-"));
  const output = {
    schema: "motion.determinism.final-replay",
    schemaVersion: 1,
    status: "INCONCLUSIVE",
    startedAt: new Date().toISOString(),
    sourceDir: path.resolve(options.source),
    sourceRunCount: options.runs,
    expectDifference: options.expectDifference,
    cachePolicy: {
      freshOutputDirectoryPerAttempt: true,
      reusedRenderOutputs: false,
      sourceInputsHashedBeforeAndAfter: true,
      note: "Only preserved intermediate inputs are reused; output files and FFmpeg work dirs are unique.",
    },
    evidenceDir,
    attempts: [],
    comparisons: [],
    executionErrors: [],
  };

  const oldPath = process.env.PATH ?? "";
  let ffmpegVersion = "unknown";
  try {
    const loaded = await loadSource(output.sourceDir);
    output.source = {
      renderReport: loaded.renderReportPath,
      timeline: loaded.timelinePath,
      workDir: loaded.workDir,
      originalRenderSha256: loaded.renderReport.sha256 ?? null,
      sourceFfmpeg: loaded.renderReport.ffmpeg ?? null,
      sourceChromium: loaded.renderReport.chromium ?? null,
      inputHashes: loaded.inputHashes,
    };

    const detected = spawnSync("sh", ["-c", "command -v ffmpeg"], { encoding: "utf8" });
    const realFfmpeg = detected.status === 0 ? detected.stdout.trim() : "";
    if (!realFfmpeg) throw new Error("ffmpeg was not found on PATH");
    const ffmpegInfo = spawnSync(realFfmpeg, ["-hide_banner", "-version"], { encoding: "utf8" });
    if (ffmpegInfo.status !== 0) throw new Error("Unable to read ffmpeg version");
    ffmpegVersion = ffmpegInfo.stdout.split("\n")[0];

    const binDir = path.join(evidenceDir, "bin");
    const commandLog = path.join(evidenceDir, "ffmpeg-commands.log");
    await mkdir(binDir);
    const wrapper = path.join(binDir, "ffmpeg");
    const shellQuote = (value) => "'" + value.replace(/'/g, "'\\''") + "'";
    await writeFile(wrapper, "#!/bin/bash\nprintf '%q ' \"$@\" >> " + shellQuote(commandLog) + "; echo >> " + shellQuote(commandLog) + "\nexec " + shellQuote(realFfmpeg) + " \"$@\"\n");
    await chmod(wrapper, 0o755);
    process.env.PATH = binDir + path.delimiter + oldPath;
    await requireFfmpeg(loaded.assFile ? ["ass"] : []);
    output.environment = environment(ffmpegVersion);
    output.ffmpegCommands = commandLog;

    for (let index = 0; index < options.runs; index++) {
      const runDir = path.join(evidenceDir, "attempt-" + String(index + 1).padStart(2, "0"));
      const workDir = path.join(runDir, "work");
      const outputFile = path.join(runDir, "replay.mp4");
      await mkdir(runDir, { recursive: true });
      try {
        const result = await composeFinalStage(loaded.timeline, {
          output: outputFile,
          workDir,
          mode: loaded.renderReport.mode ?? "final",
          segmentFiles: loaded.segmentFiles,
          voiceFile: loaded.voiceFile,
          layers: loaded.layers,
          assFile: loaded.assFile,
          fontsDir: loaded.fontsDir,
        });
        output.attempts.push({
          index: index + 1,
          status: "COMPLETED",
          output: result.output,
          sha256: result.sha256,
          truePeak: result.truePeak,
          warnings: result.warnings,
          composeSec: result.composeSec,
        });
      } catch (error) {
        output.attempts.push({ index: index + 1, status: "ERROR", output: outputFile, error: errorRecord(error) });
        output.executionErrors.push({ attempt: index + 1, error: errorRecord(error) });
      }
    }

    const completed = output.attempts.filter((attempt) => attempt.status === "COMPLETED");
    if (completed.length >= 2) {
      for (const current of completed.slice(1)) {
        const reference = completed[0];
        const comparison = await compareRenders(reference.output, current.output);
        output.comparisons.push({
          referenceAttempt: reference.index,
          attempt: current.index,
          status: comparison.status,
          identical: comparison.identical,
          different: comparison.different,
          streams: comparison.streams,
          container: comparison.container,
          errors: comparison.errors,
        });
      }
    } else {
      output.executionErrors.push({ error: "Fewer than two final-stage renders completed; a determinism comparison cannot be made." });
    }

    const afterHashes = [];
    for (const file of loaded.inputs) afterHashes.push({ path: file, sha256: await sha256File(file) });
    output.inputIntegrity = {
      unchanged: afterHashes.every((entry, index) => entry.sha256 === loaded.inputHashes[index].sha256),
      afterHashes,
    };
    if (!output.inputIntegrity.unchanged) {
      output.executionErrors.push({ error: "A preserved source intermediate changed during replay." });
    }
    const classification = classifyDeterminismComparisons(output.comparisons, {
      executionErrors: output.executionErrors,
      expectDifference: options.expectDifference,
    });
    output.status = classification.status;
    output.classification = classification;
  } catch (error) {
    output.executionErrors.push({ error: errorRecord(error) });
    output.classification = classifyDeterminismComparisons(output.comparisons, {
      executionErrors: output.executionErrors,
      expectDifference: options.expectDifference,
    });
    output.status = output.classification.status;
  } finally {
    process.env.PATH = oldPath;
    output.finishedAt = new Date().toISOString();
    output.reportPath = path.join(evidenceDir, "report.json");
    await writeFile(output.reportPath, JSON.stringify(output, null, 2) + "\n");
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    process.exitCode = output.classification?.exitCode ?? 2;
  }
}

main();
