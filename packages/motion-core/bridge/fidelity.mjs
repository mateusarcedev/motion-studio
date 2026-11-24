/**
 * MOTION Core Bridge — fidelity.mjs
 * Visual fidelity metrics (SSIM + PSNR + perceptual difference PNG) using FFmpeg,
 * keeping security removals distinct from renderer fidelity measurements.
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

function runFfmpeg(args, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`ffmpeg timeout (${timeoutMs} ms)`));
    }, timeoutMs);
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

/**
 * Compares two rendered PNG screenshots visually via FFmpeg SSIM and PSNR.
 * Optionally writes a highlighted pixel-difference PNG at `diffPng`.
 */
export async function compareVisualFidelity(referencePng, candidatePng, { diffPng = null, minSsim = 0.85, securityRemovedCount = 0 } = {}) {
  const refAbs = path.resolve(referencePng);
  const candAbs = path.resolve(candidatePng);
  const [bufA, bufB] = await Promise.all([readFile(refAbs), readFile(candAbs)]);
  const shaA = createHash("sha256").update(bufA).digest("hex");
  const shaB = createHash("sha256").update(bufB).digest("hex");
  const byteIdentical = shaA === shaB;

  const { stderr } = await runFfmpeg([
    "-v", "info",
    "-i", refAbs,
    "-i", candAbs,
    "-filter_complex", "[0:v][1:v]ssim;[0:v][1:v]psnr",
    "-f", "null", "-",
  ]);

  const ssimMatch = stderr.match(/All:([0-9.]+)/);
  const psnrMatch = stderr.match(/average:([0-9.]+|inf)/i);
  const ssim = ssimMatch ? Number(ssimMatch[1]) : (byteIdentical ? 1 : 0);
  const psnrDb = psnrMatch ? (psnrMatch[1] === "inf" ? Infinity : Number(psnrMatch[1])) : (byteIdentical ? Infinity : 0);

  if (diffPng) {
    const diffAbs = path.resolve(diffPng);
    await mkdir(path.dirname(diffAbs), { recursive: true });
    await runFfmpeg([
      "-y", "-v", "error",
      "-i", refAbs,
      "-i", candAbs,
      "-filter_complex", "[0:v][1:v]blend=all_mode=difference,eq=contrast=3:brightness=0.02[out]",
      "-map", "[out]",
      "-frames:v", "1",
      diffAbs,
    ]);
  }

  return {
    referencePng: refAbs,
    candidatePng: candAbs,
    referenceSha256: shaA,
    candidateSha256: shaB,
    byteIdentical,
    ssim,
    psnrDb,
    thresholdSsim: minSsim,
    visuallyAcceptable: ssim >= minSsim,
    securityDistinction: securityRemovedCount > 0
      ? `${securityRemovedCount} item(ns) removidos por segurança não foram reintroduzidos para aumentar fidelidade visual.`
      : "Nenhuma remoção por segurança.",
    diffPng: diffPng ? path.resolve(diffPng) : null,
  };
}
