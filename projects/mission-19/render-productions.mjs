import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildContactSheet,
  generateComponentHtml,
  generateManifest,
  listTransitions,
  previewMotionComponent,
  renderFrames,
  renderMotionComponent,
  renderTransition,
  verifyDeterminism,
  qaSafeZones,
} from "../../packages/motion-core/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const outputArg = process.argv.slice(2).find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
const output = outputArg ? path.resolve(root, outputArg) : path.join(here, "productions", "final");
const font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const theme = { primary: "#35B6FF", accent: "#F4BA55", background: "#101827", surface: "#1A2A40", text: "#F3F7FB", muted: "#9DB0C7" };
const timings = {};

async function timed(label, work) {
  const start = performance.now();
  const result = await work();
  timings[label] = Number(((performance.now() - start) / 1000).toFixed(3));
  return result;
}

function parseJsonOutput(text) {
  const start = text.indexOf("{");
  return start < 0 ? {} : JSON.parse(text.slice(start));
}

function sha256(data) { return createHash("sha256").update(data).digest("hex"); }

function probe(file) {
  return JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { encoding: "utf8" }));
}

function ffmpeg(args) {
  execFileSync("ffmpeg", ["-y", "-v", "error", ...args], { stdio: ["ignore", "pipe", "pipe"] });
}

async function readConfig(name) {
  return JSON.parse(await readFile(path.join(here, "configs", name), "utf8"));
}

async function sourceAndFrames(config, sourceHtml, framesDir, size, frames) {
  await writeFile(sourceHtml, generateComponentHtml(config));
  await renderFrames(sourceHtml, framesDir, {
    frames, fps: config.fps, width: size.width, height: size.height, scale: 1, seed: 19,
    sampleFrames: [0, Math.floor(frames / 2), frames - 1], inspectBounds: true,
  });
}

async function deterministicAndSafe(html, prefix, config, size, platform, sampleTimes) {
  const determinism = await timed(`${prefix}-determinism`, () => verifyDeterminism(html, {
    duration: config.duration, fps: config.fps, width: size.width, height: size.height,
    seed: 19, sampleTimes, outputDir: path.join(output, prefix, "qa", "determinism"),
  }));
  const safeZones = await timed(`${prefix}-safe-zones`, () => qaSafeZones(html, {
    duration: config.duration, fps: config.fps, width: size.width, height: size.height,
    seed: 19, platform, sampleTimes, outputDir: path.join(output, prefix, "qa", "safe-zones"),
  }));
  return { determinism, safeZones };
}

await mkdir(output, { recursive: true });

// A — same component/data contract at 9:16 and 16:9, plus a data-only substitution.
const verticalConfig = await readConfig("ranking-vertical.json");
const horizontalConfig = await readConfig("ranking-horizontal.json");
const rankDir = path.join(output, "A-ranking");
const rankVerticalHtml = path.join(rankDir, "source", "ranking-9x16.html");
const rankHorizontalHtml = path.join(rankDir, "source", "ranking-16x9.html");
const rankVerticalFrames = path.join(rankDir, "qa", "frames-9x16");
const rankHorizontalFrames = path.join(rankDir, "qa", "frames-16x9");
await mkdir(path.dirname(rankVerticalHtml), { recursive: true });
const framesA = verticalConfig.duration * verticalConfig.fps;
const framesAh = horizontalConfig.duration * horizontalConfig.fps;
await timed("A-source-and-qa-frames", async () => {
  await sourceAndFrames(verticalConfig, rankVerticalHtml, rankVerticalFrames, { width: 1080, height: 1920 }, framesA);
  await sourceAndFrames(horizontalConfig, rankHorizontalHtml, rankHorizontalFrames, { width: 1920, height: 1080 }, framesAh);
});
const rankVerticalVideo = path.join(rankDir, "ranking-9x16.mp4");
const rankAlphaVideo = path.join(rankDir, "ranking-transparent.webm");
const rankHorizontalVideo = path.join(rankDir, "ranking-16x9.mp4");
const rankVerticalRender = await timed("A-render-9x16-mp4", () => renderMotionComponent(verticalConfig, rankVerticalVideo, { width: 1080, height: 1920, seed: 19, baseDir: path.dirname(rankVerticalHtml) }));
const rankAlphaRender = await timed("A-render-transparent-webm", () => renderMotionComponent({ ...verticalConfig, transparent: true }, rankAlphaVideo, { width: 1080, height: 1920, seed: 19, baseDir: path.dirname(rankVerticalHtml) }));
const rankHorizontalRender = await timed("A-render-16x9-mp4", () => renderMotionComponent(horizontalConfig, rankHorizontalVideo, { width: 1920, height: 1080, seed: 19, baseDir: path.dirname(rankHorizontalHtml) }));
const rankPoster = path.join(rankDir, "poster-9x16.png");
const rankPosterHorizontal = path.join(rankDir, "poster-16x9.png");
await timed("A-posters-and-contact-sheets", async () => {
  await previewMotionComponent(verticalConfig, rankPoster, { width: 1080, height: 1920, frame: 90, seed: 19, baseDir: path.dirname(rankVerticalHtml) });
  await previewMotionComponent(horizontalConfig, rankPosterHorizontal, { width: 1920, height: 1080, frame: 90, seed: 19, baseDir: path.dirname(rankHorizontalHtml) });
  await buildContactSheet(rankVerticalFrames, path.join(rankDir, "contact-sheet-9x16.png"), { title: "A · Ranking parametrizado · 9:16", labels: ["abertura", "barras em movimento", "estado final"], cols: 3 });
  await buildContactSheet(rankHorizontalFrames, path.join(rankDir, "contact-sheet-16x9.png"), { title: "A · Ranking parametrizado · 16:9", labels: ["abertura", "barras em movimento", "estado final"], cols: 3 });
});
const verticalQA = await deterministicAndSafe(rankVerticalHtml, "A-ranking-9x16", verticalConfig, { width: 1080, height: 1920 }, "instagram-reels", [0, 0.5, 2.5, 4.9666667]);
const horizontalQA = await deterministicAndSafe(rankHorizontalHtml, "A-ranking-16x9", horizontalConfig, { width: 1920, height: 1080 }, "youtube-horizontal", [0, 0.5, 2.5, 4.9666667]);
const originalRankHashBeforeSwap = sha256(await readFile(rankVerticalHtml));
const alternateConfig = {
  ...verticalConfig, instanceId: "tech-ranking-alternate", title: "Engines · dados fictícios",
  items: [{ label: "Go", value: 94 }, { label: "Rust", value: 89 }, { label: "Python", value: 86 }, { label: "TypeScript", value: 80 }, { label: "SQL", value: 72 }],
};
const alternateHtml = path.join(rankDir, "source", "ranking-9x16-alternate-data.html");
await writeFile(alternateHtml, generateComponentHtml(alternateConfig));
await previewMotionComponent(alternateConfig, path.join(rankDir, "poster-alternate-data.png"), { width: 1080, height: 1920, frame: 90, seed: 19, baseDir: path.dirname(alternateHtml) });
const rankAlternateVideo = path.join(rankDir, "ranking-9x16-alternate-data.mp4");
await timed("A-render-data-only-variant", () => renderMotionComponent(alternateConfig, rankAlternateVideo, { width: 1080, height: 1920, seed: 19, baseDir: path.dirname(alternateHtml) }));
const originalRankHashAfterSwap = sha256(await readFile(rankVerticalHtml));

// B — a single API story, three connected component scenes, then easing-based FFmpeg transitions.
const apiDir = path.join(output, "B-api-explainer");
const apiSourceDir = path.join(apiDir, "source");
const apiSceneDir = path.join(apiDir, "scenes");
const apiConfigNames = ["api-01-kinetic-text.json", "api-02-timeline.json", "api-03-callout.json"];
const apiConfigs = await Promise.all(apiConfigNames.map(readConfig));
await mkdir(apiSceneDir, { recursive: true });
const apiHtmls = [], apiSceneVideos = [];
for (let index = 0; index < apiConfigs.length; index++) {
  const config = apiConfigs[index];
  const sceneName = `scene-${String(index + 1).padStart(2, "0")}`;
  const html = path.join(apiSourceDir, `${sceneName}.html`);
  const video = path.join(apiSceneDir, `${sceneName}.mp4`);
  await mkdir(apiSourceDir, { recursive: true });
  await writeFile(html, generateComponentHtml(config));
  apiHtmls.push(html);
  apiSceneVideos.push(video);
  await timed(`B-render-${sceneName}`, () => renderMotionComponent(config, video, { width: 1280, height: 720, seed: 19, baseDir: apiSourceDir }));
}
const apiVideo = path.join(apiDir, "api-request-explainer.mp4");
const apiTransition = await timed("B-compose-transitions", () => renderTransition(apiSceneVideos, apiVideo, {
  kind: "push", duration: 0.45, direction: "left", easing: "ease-in-out",
}, { fps: 24, width: 1280, height: 720 }));
const apiContactFrames = path.join(apiDir, "qa", "final-frames");
await mkdir(apiContactFrames, { recursive: true });
const apiDuration = Number(probe(apiVideo).format.duration);
for (const [index, time] of [0, apiDuration / 2, Math.max(0, apiDuration - 1 / 24)].entries()) {
  ffmpeg(["-ss", time.toFixed(4), "-i", apiVideo, "-frames:v", "1", path.join(apiContactFrames, `${String(index).padStart(4, "0")}.png`)]);
}
await buildContactSheet(apiContactFrames, path.join(apiDir, "contact-sheet.png"), { title: "B · Como uma API responde", labels: ["request", "validate/process", "200 OK"], cols: 3 });
const apiQA = [];
const apiTimes = [[0, 0.5, 1.6, 3.15], [0, 0.25, 1.0, 1.85, 2.8, 3.15], [0, 0.5, 1.6, 3.15]];
for (let index = 0; index < apiConfigs.length; index++) {
  apiQA.push(await deterministicAndSafe(apiHtmls[index], `B-api-scene-${index + 1}`, apiConfigs[index], { width: 1280, height: 720 }, "youtube-horizontal", apiTimes[index]));
}

// C — a real-alpha comparison overlay composed on bright, dark, and moving demonstration footage.
const overlayConfig = await readConfig("overlay-comparison.json");
const overlayDir = path.join(output, "C-alpha-overlay");
const overlaySource = path.join(overlayDir, "source", "comparison-overlay.html");
const overlayWebm = path.join(overlayDir, "latency-comparison.webm");
await mkdir(path.dirname(overlaySource), { recursive: true });
await writeFile(overlaySource, generateComponentHtml(overlayConfig));
const overlayRender = await timed("C-render-transparent-webm", () => renderMotionComponent(overlayConfig, overlayWebm, { width: 640, height: 360, seed: 19, baseDir: path.dirname(overlaySource) }));
const backgroundDir = path.join(overlayDir, "backgrounds");
const compositeDir = path.join(overlayDir, "composites");
await mkdir(backgroundDir, { recursive: true });
await mkdir(compositeDir, { recursive: true });
const backgrounds = [
  ["bright", "color=c=white:s=640x360:r=24:d=4.5"],
  ["dark", "color=c=0x10131A:s=640x360:r=24:d=4.5"],
  ["moving", "testsrc2=size=640x360:rate=24:duration=4.5"],
];
const composites = [];
for (const [name, source] of backgrounds) {
  const video = path.join(backgroundDir, `${name}.mp4`);
  ffmpeg(["-f", "lavfi", "-i", source, "-t", "4.5", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "24", video]);
  const composite = path.join(compositeDir, `${name}-background-composite.mp4`);
  ffmpeg(["-i", video, "-c:v", "libvpx-vp9", "-i", overlayWebm,
    "-filter_complex", "[0:v]fps=24,format=rgba[bg];[1:v]fps=24,format=rgba[fg];[bg][fg]overlay=shortest=1:format=auto,format=yuv420p[outv]",
    "-map", "[outv]", "-an", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "24", composite]);
  composites.push({ name, background: video, output: composite, metadata: probe(composite) });
}
const alphaQA = parseJsonOutput(overlayRender.stdout);
const overlayQA = await deterministicAndSafe(overlaySource, "C-alpha-overlay", overlayConfig, { width: 640, height: 360 }, "youtube-horizontal", [0, 0.5, 2.25, 4.4583333]);
const compositeFrames = path.join(overlayDir, "qa", "composite-frames");
await mkdir(compositeFrames, { recursive: true });
for (const [index, entry] of composites.entries()) {
  const frame = path.join(compositeFrames, `${String(index).padStart(4, "0")}.png`);
  ffmpeg(["-ss", "2.25", "-i", entry.output, "-frames:v", "1", frame]);
}
await buildContactSheet(compositeFrames, path.join(overlayDir, "composite-contact-sheet.png"), { title: "C · Alpha composto sobre claro, escuro e movimento", labels: ["fundo claro", "fundo escuro", "fundo em movimento"], cols: 3 });

// Comparative transition reel: same two scenes and easing curve, all supported kinds in registry order.
const transitionDir = path.join(output, "transition-showcase");
const transitionSceneDir = path.join(transitionDir, "scenes");
const transitionClipDir = path.join(transitionDir, "clips");
await mkdir(transitionSceneDir, { recursive: true });
await mkdir(transitionClipDir, { recursive: true });
const sceneA = path.join(transitionSceneDir, "scene-a.mp4"), sceneB = path.join(transitionSceneDir, "scene-b.mp4");
const sceneFilter = (color, label) => `drawbox=x=0:y=0:w=iw:h=12:color=0x35B6FF:t=fill,drawtext=fontfile=${font}:text=${label}:fontcolor=white:fontsize=46:x=(w-text_w)/2:y=(h-text_h)/2`;
ffmpeg(["-f", "lavfi", "-i", "color=c=0x0E2D4B:s=640x360:r=24:d=2", "-vf", sceneFilter("0x0E2D4B", "REQUEST"), "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "24", sceneA]);
ffmpeg(["-f", "lavfi", "-i", "color=c=0x7C3D16:s=640x360:r=24:d=2", "-vf", sceneFilter("0x7C3D16", "RESPONSE"), "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "24", sceneB]);
const transitionCatalog = await listTransitions();
const transitionMap = [];
const labeledTransitions = [];
let montageCursor = 0;
for (const [index, descriptor] of transitionCatalog.entries()) {
  const id = descriptor.id;
  const clip = path.join(transitionClipDir, `${String(index + 1).padStart(2, "0")}-${id}.mp4`);
  await timed(`transition-${id}`, () => renderTransition([sceneA, sceneB], clip, {
    kind: id, duration: 0.45, direction: "left", easing: "ease-in-out", accentColor: "#F4BA55",
  }, { fps: 24, width: 640, height: 360 }));
  const labeled = path.join(transitionClipDir, `${String(index + 1).padStart(2, "0")}-${id}-labeled.mp4`);
  ffmpeg(["-i", clip, "-vf", `drawbox=x=0:y=0:w=iw:h=58:color=black@0.66:t=fill,drawtext=fontfile=${font}:text='${id.toUpperCase()} · EASE-IN-OUT':fontcolor=white:fontsize=22:x=22:y=16`, "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "24", labeled]);
  const seconds = Number(probe(labeled).format.duration);
  transitionMap.push({ id, start: Number(montageCursor.toFixed(3)), end: Number((montageCursor + seconds).toFixed(3)), duration: seconds, easing: "ease-in-out", clip: path.relative(transitionDir, labeled) });
  montageCursor += seconds;
  labeledTransitions.push(labeled);
}
const concatList = path.join(transitionDir, "concat-list.txt");
await writeFile(concatList, labeledTransitions.map((file) => `file '${file}'`).join("\n") + "\n");
const transitionMontage = path.join(transitionDir, "transition-showcase.mp4");
ffmpeg(["-f", "concat", "-safe", "0", "-i", concatList, "-c", "copy", transitionMontage]);
await writeFile(path.join(transitionDir, "transition-map.json"), JSON.stringify({ easing: "ease-in-out", transitions: transitionMap }, null, 2));

const outputSummary = {
  schema: "motion-mission-19-homologation@1",
  fictionalData: true,
  environment: {
    node: process.version,
    ffmpeg: execFileSync("ffmpeg", ["-version"], { encoding: "utf8" }).split("\n")[0],
    ffprobe: execFileSync("ffprobe", ["-version"], { encoding: "utf8" }).split("\n")[0],
  },
  productionA: {
    files: [rankVerticalVideo, rankHorizontalVideo, rankAlphaVideo, rankAlternateVideo, rankPoster, rankPosterHorizontal],
    ffprobe: { verticalMp4: probe(rankVerticalVideo), horizontalMp4: probe(rankHorizontalVideo), transparentWebm: probe(rankAlphaVideo), alternateMp4: probe(rankAlternateVideo) },
    renderResults: { verticalMp4: parseJsonOutput(rankVerticalRender.stdout), transparentWebm: parseJsonOutput(rankAlphaRender.stdout), horizontalMp4: parseJsonOutput(rankHorizontalRender.stdout) },
    dataSwap: { originalComponentId: verticalConfig.component, originalSourceSha256Before: originalRankHashBeforeSwap, originalSourceSha256After: originalRankHashAfterSwap, unchanged: originalRankHashBeforeSwap === originalRankHashAfterSwap, alternateValues: alternateConfig.items },
    qa: { vertical: verticalQA, horizontal: horizontalQA },
  },
  productionB: { finalVideo: apiVideo, ffprobe: probe(apiVideo), transitions: apiTransition, sceneVideos: apiSceneVideos, sceneQA: apiQA, contactSheet: path.join(apiDir, "contact-sheet.png") },
  productionC: { transparentWebm: overlayWebm, webmProbe: probe(overlayWebm), alphaValidation: alphaQA, backgrounds: composites, qa: overlayQA, contactSheet: path.join(overlayDir, "composite-contact-sheet.png") },
  transitionShowcase: { video: transitionMontage, ffprobe: probe(transitionMontage), map: path.join(transitionDir, "transition-map.json"), transitions: transitionMap },
  timingsSeconds: timings,
};
await writeFile(path.join(output, "homologation.json"), JSON.stringify(outputSummary, null, 2));
await generateManifest(output, path.join(output, "assets.manifest.json"));

const failed = [
  !outputSummary.productionA.dataSwap.unchanged,
  !outputSummary.productionA.qa.vertical.determinism.passed,
  !outputSummary.productionA.qa.horizontal.determinism.passed,
  !outputSummary.productionA.qa.vertical.safeZones.passed,
  !outputSummary.productionA.qa.horizontal.safeZones.passed,
  !outputSummary.productionA.renderResults.transparentWebm.alphaSamples?.some((sample) => sample.min === 0 && sample.max > 0 && sample.partialPixels > 0),
  ...outputSummary.productionB.sceneQA.flatMap((qa) => [!qa.determinism.passed, !qa.safeZones.passed]),
  !outputSummary.productionC.qa.determinism.passed,
  !outputSummary.productionC.qa.safeZones.passed,
  !outputSummary.productionC.alphaValidation.alphaSamples?.some((sample) => sample.min === 0 && sample.max > 0 && sample.partialPixels > 0),
];
if (failed.some(Boolean)) throw new Error(`One or more homologation gates failed; inspect ${path.join(output, "homologation.json")} and QA evidence.`);
console.log(JSON.stringify({ status: "passed", output, transitionShowcase: transitionMontage, timingsSeconds: timings }, null, 2));
