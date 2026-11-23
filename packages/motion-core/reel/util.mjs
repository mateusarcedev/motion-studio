/**
 * MOTION Core — reel/util.mjs
 * Shared helpers for the Smart Reel Editor: process execution, FFprobe, hashing,
 * frame-grid quantization and structured errors. No third-party dependencies.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { MotionError } from "../lib/errors.mjs";

export const REEL_ERRORS = Object.freeze({
  FFMPEG_MISSING: "MOTION_FFMPEG_MISSING",
  INPUT_INVALID: "MOTION_REEL_INPUT_INVALID",
  TIMELINE_INVALID: "MOTION_TIMELINE_INVALID",
  SOURCE_CHANGED: "MOTION_SOURCE_CHANGED",
  RENDER_FAILED: "MOTION_REEL_RENDER_FAILED",
  STT_UNAVAILABLE: "MOTION_STT_UNAVAILABLE",
  STT_FAILED: "MOTION_STT_FAILED",
  STT_PROVIDER_NOT_IMPLEMENTED: "MOTION_STT_PROVIDER_NOT_IMPLEMENTED",
  OVERLAY_FAILED: "MOTION_REEL_OVERLAY_FAILED",
});

export function reelError(code, message, { hint, details, exitCode = 2 } = {}) {
  return new MotionError(code, message, { hint, details, exitCode });
}

/**
 * Runs a command and collects output. Never throws on non-zero exit: callers decide.
 * `binary: true` keeps stdout as a Buffer. `onStdout` streams chunks (stdout is then not kept).
 */
export function run(cmd, args, { timeoutMs = 0, binary = false, onStdout, onStderr, cwd, env } = {}) {
  return new Promise((resolve) => {
    const chunks = [];
    let stderr = "";
    let settled = false;
    let child;
    try {
      child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], cwd, env: env ? { ...process.env, ...env } : process.env });
    } catch (error) {
      resolve({ code: -1, stdout: binary ? Buffer.alloc(0) : "", stderr: "", error });
      return;
    }
    const timer = timeoutMs ? setTimeout(() => child.kill("SIGKILL"), timeoutMs) : null;
    child.stdout.on("data", (d) => { if (onStdout) onStdout(d); else chunks.push(d); });
    child.stderr.on("data", (d) => { const s = d.toString(); stderr += s; if (stderr.length > 8e6) stderr = stderr.slice(-4e6); onStderr?.(s); });
    const finish = (payload) => { if (settled) return; settled = true; if (timer) clearTimeout(timer); resolve(payload); };
    child.on("error", (error) => finish({ code: -1, stdout: binary ? Buffer.alloc(0) : "", stderr, error }));
    child.on("close", (code) => {
      const out = Buffer.concat(chunks);
      finish({ code, stdout: binary ? out : out.toString("utf8"), stderr });
    });
  });
}

let toolCache = null;
/** Detects ffmpeg/ffprobe once per process. */
export async function ffmpegTools() {
  if (toolCache) return toolCache;
  const ff = await run("ffmpeg", ["-hide_banner", "-version"]);
  const fp = await run("ffprobe", ["-hide_banner", "-version"]);
  const version = ff.code === 0 ? (ff.stdout.match(/ffmpeg version (\S+)/)?.[1] ?? "unknown") : null;
  let filters = new Set();
  if (ff.code === 0) {
    const list = await run("ffmpeg", ["-hide_banner", "-filters"]);
    filters = new Set([...list.stdout.matchAll(/^\s*[TSC.]{2,3}\s+(\S+)/gm)].map((m) => m[1]));
  }
  toolCache = { ffmpeg: ff.code === 0, ffprobe: fp.code === 0, version, filters };
  return toolCache;
}

export async function requireFfmpeg(neededFilters = []) {
  const tools = await ffmpegTools();
  if (!tools.ffmpeg || !tools.ffprobe) {
    throw reelError(REEL_ERRORS.FFMPEG_MISSING, "FFmpeg/FFprobe não encontrados no PATH.", { hint: "Instale FFmpeg (apt install ffmpeg | brew install ffmpeg) e rode motion doctor.", exitCode: 3 });
  }
  const missing = neededFilters.filter((f) => !tools.filters.has(f));
  if (missing.length) {
    throw reelError(REEL_ERRORS.FFMPEG_MISSING, `Este FFmpeg não tem os filtros: ${missing.join(", ")}.`, { hint: "Use um build do FFmpeg com libass/libx264 (ex.: pacote da distribuição).", exitCode: 3 });
  }
  return tools;
}

export async function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(file).on("data", (d) => h.update(d)).on("error", reject).on("end", () => resolve(h.digest("hex")));
  });
}

export function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}

const frac = (s) => { const [a, b] = String(s ?? "0").split("/").map(Number); return b ? a / b : a || 0; };

/** FFprobe summary with display rotation applied to width/height. */
export async function probeMedia(file) {
  await requireFfmpeg();
  let st;
  try { st = await stat(file); } catch {
    throw reelError(REEL_ERRORS.INPUT_INVALID, `Arquivo não encontrado: ${file}`, { hint: "Confira o caminho do vídeo de entrada." });
  }
  const res = await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]);
  let info = null;
  try { info = JSON.parse(res.stdout); } catch {}
  if (res.code !== 0 || !info?.streams?.length) {
    throw reelError(REEL_ERRORS.INPUT_INVALID, `FFprobe não reconheceu o arquivo: ${file}`, { details: res.stderr.trim().split("\n")[0] || null, hint: "Use um arquivo de mídia suportado pelo FFmpeg (MP4, MOV, MKV, WEBM...)." });
  }
  const v = info.streams.find((s) => s.codec_type === "video" && s.disposition?.attached_pic !== 1);
  const a = info.streams.find((s) => s.codec_type === "audio");
  let rotation = 0;
  if (v) {
    const sd = (v.side_data_list ?? []).find((d) => d.rotation !== undefined);
    rotation = Number(sd?.rotation ?? v.tags?.rotate ?? 0) || 0;
  }
  const swap = Math.abs(rotation) % 180 === 90;
  const durationSec = Number(info.format?.duration ?? v?.duration ?? a?.duration ?? 0);
  const video = v ? {
    codec: v.codec_name, profile: v.profile ?? null, pixFmt: v.pix_fmt ?? null,
    codedWidth: v.width, codedHeight: v.height,
    width: swap ? v.height : v.width, height: swap ? v.width : v.height, rotation,
    fps: round(frac(v.avg_frame_rate), 3), nominalFps: round(frac(v.r_frame_rate), 3),
    vfr: Math.abs(frac(v.avg_frame_rate) - frac(v.r_frame_rate)) > 0.01,
    frames: v.nb_frames ? Number(v.nb_frames) : null, bitRate: v.bit_rate ? Number(v.bit_rate) : null,
    colorSpace: v.color_space ?? null, colorTransfer: v.color_transfer ?? null, startTime: Number(v.start_time ?? 0),
  } : null;
  const audio = a ? {
    codec: a.codec_name, sampleRate: Number(a.sample_rate), channels: a.channels, channelLayout: a.channel_layout ?? null,
    bitRate: a.bit_rate ? Number(a.bit_rate) : null, startTime: Number(a.start_time ?? 0), durationSec: Number(a.duration ?? durationSec),
  } : null;
  return {
    path: file, bytes: st.size, container: info.format?.format_name ?? null, durationSec: round(durationSec, 3),
    bitRate: info.format?.bit_rate ? Number(info.format.bit_rate) : null, video, audio,
    streams: info.streams.length,
  };
}

export const round = (n, d = 3) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : n);
/** Snap a time (s) to the nearest frame boundary of the output grid. */
export const snap = (t, fps) => Math.round(t * fps) / fps;
export const toFrame = (t, fps) => Math.round(t * fps);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Parse the last JSON object printed in a text blob (FFmpeg loudnorm prints it on stderr). */
export function lastJsonObject(text) {
  const end = text.lastIndexOf("}");
  if (end < 0) return null;
  let depth = 0;
  for (let i = end; i >= 0; i--) {
    if (text[i] === "}") depth++;
    else if (text[i] === "{") { depth--; if (depth === 0) { try { return JSON.parse(text.slice(i, end + 1)); } catch { return null; } } }
  }
  return null;
}

/** Simple concurrency limiter for independent FFmpeg jobs. */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await fn(items[i], i); }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Mono downmix that averages channels. `-ac 1` sums correlated stereo (+3 dB) and can push
 * a phone recording (identical L/R) past 0 dBFS, which would fake clipping in measurements.
 */
export function monoDownmix(channels) {
  if (!channels || channels === 1) return null;
  const terms = Array.from({ length: channels }, (_, i) => `${(1 / channels).toFixed(6)}*c${i}`).join("+");
  return `pan=mono|c0=${terms}`;
}

/** Strips accents/punctuation for comparisons (never used to alter displayed words). */
export function normalizeWord(w) {
  return String(w).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, "");
}
