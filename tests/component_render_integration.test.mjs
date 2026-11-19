import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateComponentHtml, renderComposition, renderFrames, renderMotionComponent } from "../packages/motion-core/index.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, "tmp", "mission-19");

test("component renderer produces VP9 WebM with decoded transparent and antialiased pixels", async () => {
  await mkdir(outDir, { recursive: true });
  const config = {
    component: "animated-counter", label: "Requests", value: 7, duration: 1, fps: 6,
    aspectRatio: "16:9", transparent: true,
    theme: { background: "transparent", primary: "#2864DC", text: "#FFFFFF" },
  };
  const htmlPath = path.join(outDir, "transparent-counter.html");
  const framesDir = path.join(outDir, "rgba-frames");
  await writeFile(htmlPath, generateComponentHtml(config));
  await renderFrames(htmlPath, framesDir, { frames: 6, fps: 6, width: 320, height: 180, scale: 1, transparent: true });
  const pngAlpha = execFileSync("ffmpeg", ["-v", "error", "-i", path.join(framesDir, "0005.png"), "-vf", "alphaextract", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"]);
  assert.ok(pngAlpha.some((pixel) => pixel === 0), "RGBA renderer must leave the background transparent");
  assert.ok(pngAlpha.some((pixel) => pixel > 0 && pixel < 255), "RGBA renderer must preserve antialiased edges");
  const output = path.join(outDir, "transparent-counter.webm");
  const result = await renderMotionComponent(config, output, { width: 320, height: 180, scale: 1 });

  assert.equal(result.format, "webm");
  assert.equal(result.transparent, true);
  const metadata = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", output], { encoding: "utf8" }));
  assert.equal(metadata.streams[0].codec_name, "vp9");
  assert.equal(metadata.streams[0].tags.ALPHA_MODE ?? metadata.streams[0].tags.alpha_mode, "1");
  const alpha = execFileSync("ffmpeg", ["-v", "error", "-c:v", "libvpx-vp9", "-i", output, "-vf", "alphaextract", "-frames:v", "6", "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"]);
  assert.ok(alpha.some((pixel) => pixel === 0), "decoded alpha must include fully transparent pixels");
  assert.ok(alpha.some((pixel) => pixel > 0 && pixel < 255), "decoded alpha must preserve partially transparent edges");
  assert.ok((await readFile(output)).length > 1000);

  const compositionOutput = path.join(outDir, "transparent-composition.webm");
  await renderComposition(htmlPath, compositionOutput, { duration: 1, fps: 6, width: 320, height: 180 });
  const compositionMetadata = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", compositionOutput], { encoding: "utf8" }));
  assert.equal(compositionMetadata.streams[0].codec_name, "vp9");
  assert.equal(compositionMetadata.streams[0].tags.ALPHA_MODE ?? compositionMetadata.streams[0].tags.alpha_mode, "1");
  const compositionAlpha = execFileSync("ffmpeg", ["-v", "error", "-c:v", "libvpx-vp9", "-i", compositionOutput, "-vf", "alphaextract", "-frames:v", "6", "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"]);
  assert.ok(compositionAlpha.some((pixel) => pixel === 0), "composition alpha must retain transparent pixels");
  assert.ok(compositionAlpha.some((pixel) => pixel > 0 && pixel < 255), "composition alpha must retain partial edge pixels");
  assert.ok((await readFile(compositionOutput)).length > 1000, "composition render must await FFmpeg before cleaning its frames");
});
