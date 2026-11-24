/**
 * MOTION Core — reel/render.mjs
 * Deterministic render of a motion.timeline@1:
 *   1. voice: Voice Studio chain on the full source → cut on the frame grid → loudness
 *   2. video: one high-quality intermediate per segment (accurate seek, exact frame count,
 *      cover reframe + punch-in/progressive zoom, optional dip transitions)
 *   3. overlays: cards rendered by the Chromium engine to transparent PNG
 *   4. compose: concat + overlays (eased entrance) + kinetic ASS captions + AAC mux
 * Progress is written to <output>.progress.json for CLI/MCP polling.
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { buildAss, captionsJson, pagesToSrt, wordsToSrt } from "./captions.mjs";
import { renderOverlayLayers } from "./overlays.mjs";
import { assertTimeline, resolveFrom, timelineHash } from "./timeline.mjs";
import { measureLoudness } from "./analyze.mjs";
import { PRESETS } from "./presets.mjs";
import { processVoice } from "./voice.mjs";
import { clamp, mapLimit, probeMedia, reelError, REEL_ERRORS, requireFfmpeg, round, run, sha256File } from "./util.mjs";

/** Contiguous segments (zoom cuts) are merged so the audio has no boundary fades mid-phrase. */
export function audioRanges(segments) {
  const out = [];
  for (const s of segments) {
    const last = out.at(-1);
    const gain = s.gainDb ?? 0; // third element only when the stretch has its own level
    if (last && Math.abs(s.src[0] - last[1]) < 1e-6 && (last[2] ?? 0) === gain) last[1] = s.src[1]; else out.push(gain ? [s.src[0], s.src[1], gain] : [s.src[0], s.src[1]]);
  }
  return out;
}

async function atomicWriteFile(file, data, runId) {
  const temp = `${file}.${runId}.${randomUUID()}.tmp`;
  await writeFile(temp, data);
  await rename(temp, file);
}

async function atomicCopyFile(source, file, runId) {
  const temp = `${file}.${runId}.${randomUUID()}.tmp`;
  await copyFile(source, temp);
  await rename(temp, file);
}

async function writeProgress(file, data, runId) {
  if (!file) return;
  await atomicWriteFile(file, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), runId).catch(() => {});
}

async function ff(args, what, { onProgress } = {}) {
  const r = await run("ffmpeg", ["-hide_banner", "-nostats", "-y", ...args], { onStderr: onProgress });
  if (r.code !== 0) throw reelError(REEL_ERRORS.RENDER_FAILED, `FFmpeg falhou: ${what}`, { details: r.stderr.trim().split("\n").filter((l) => !/^[a-z_0-9]+=/.test(l)).slice(-6).join(" | ") });
  return r;
}

const ease = { cubicOut: (p) => `(1-pow(1-(${p}),3))` };

/**
 * Framing filter for one segment: cover-crop the source to the output aspect, then zoom
 * around the face centre (clamped inside the frame). Static zoom → crop+lanczos; animated
 * zoom (ease-in punch or drift) → perspective with per-frame sub-pixel corners.
 */
export function framingFilter(seg, { srcW, srcH, outW, outH, frames, prevZoom = null }) {
  const s0 = Math.max(outW / srcW, outH / srcH);
  const z0 = seg.zoom?.from ?? 1, z1 = seg.zoom?.to ?? z0;
  const cx = (seg.zoom?.cx ?? 0.5) * srcW, cy = (seg.zoom?.cy ?? 0.5) * srcH;
  const easeIn = seg.zoom?.easeInFrames ?? 0;
  const animated = z1 !== z0 || (easeIn > 0 && prevZoom !== null && prevZoom !== z0);
  if (!animated) {
    const ws = outW / (s0 * z0), hs = outH / (s0 * z0);
    const w = Math.min(srcW, Math.round(ws / 2) * 2), h = Math.min(srcH, Math.round(hs / 2) * 2);
    const x = Math.round(clamp(cx - w / 2, 0, srcW - w)), y = Math.round(clamp(cy - h / 2, 0, srcH - h));
    return `crop=${w}:${h}:${x}:${y},scale=${outW}:${outH}:flags=lanczos,setsar=1`;
  }
  let z;
  if (z1 !== z0) z = `(${z0}+(${z1 - z0})*in/${Math.max(1, frames - 1)})`;
  else { const a = prevZoom, k = easeIn; z = `if(lt(in,${k}),${a}+(${z0 - a})*${ease.cubicOut(`in/${k}`)},${z0})`; }
  const hw = `(${outW}/(2*${s0}*${z}))`, hh = `(${outH}/(2*${s0}*${z}))`;
  const X = `clip(${cx},${hw},${srcW}-${hw})`, Y = `clip(${cy},${hh},${srcH}-${hh})`;
  const corners = { x0: `${X}-${hw}`, y0: `${Y}-${hh}`, x1: `${X}+${hw}`, y1: `${Y}-${hh}`, x2: `${X}-${hw}`, y2: `${Y}+${hh}`, x3: `${X}+${hw}`, y3: `${Y}+${hh}` };
  return `perspective=${Object.entries(corners).map(([k, v]) => `${k}='${v}'`).join(":")}:interpolation=cubic:eval=frame,scale=${outW}:${outH}:flags=lanczos,setsar=1`;
}

function transitionFades(timeline, idx, fps) {
  const seg = timeline.segments[idx];
  const f = [];
  const dur = seg.frames / fps;
  for (const tr of timeline.transitions ?? []) {
    const k = tr.frames ?? 4, d = k / fps;
    const color = tr.kind === "flash" ? "white" : "black";
    if (tr.kind !== "dip-black" && tr.kind !== "flash") continue;
    if (tr.after === seg.id) f.push(`fade=t=out:st=${round(dur - d, 6)}:d=${round(d, 6)}:color=${color}`);
    const prev = timeline.segments[idx - 1];
    if (prev && tr.after === prev.id) f.push(`fade=t=in:st=0:d=${round(d, 6)}:color=${color}`);
  }
  return f;
}

async function renderSegment(timeline, seg, idx, { work, mode, srcW, srcH, outW, outH }) {
  const fps = timeline.output.fps;
  const out = path.join(work, `seg-${String(idx + 1).padStart(3, "0")}.mp4`);
  const prevZoom = idx > 0 ? (timeline.segments[idx - 1].zoom?.to ?? 1) : null;
  const vf = [framingFilter(seg, { srcW, srcH, outW, outH, frames: seg.frames, prevZoom }), `fps=${fps}`, ...transitionFades(timeline, idx, fps), "format=yuv420p"].join(",");
  const enc = mode === "preview" ? ["-preset", "veryfast", "-crf", "20"] : ["-preset", "veryfast", "-crf", "10"];
  await ff(["-ss", seg.src[0].toFixed(6), "-i", timeline.source.path, "-t", ((seg.frames + 2) / fps).toFixed(6), "-an", "-sn", "-dn", "-vf", vf,
    "-frames:v", String(seg.frames), "-c:v", "libx264", ...enc, "-g", String(fps), "-bf", "0", "-threads", "2",
    "-fflags", "+bitexact", "-flags:v", "+bitexact", "-map_metadata", "-1", "-video_track_timescale", String(fps * 1000), out], `segmento ${seg.id}`);
  return out;
}

/**
 * Renders the timeline. mode "final" (full resolution) or "preview" (half resolution).
 * Returns a render report (JSON) with every output path, hashes and timings.
 */
export async function renderTimeline(timelineIn, { output, mode = "final", workDir = null, keepWork = false, concurrency = 2, skipOverlays = false, skipCaptions = false, voiceAbDir = null } = {}) {
  const tools = await requireFfmpeg(["ass", "perspective", "afftdn", "loudnorm"]);
  const timeline = assertTimeline(structuredClone(timelineIn));
  timeline.__file = timelineIn.__file;
  if (!output) throw reelError(REEL_ERRORS.INPUT_INVALID, "Informe --output para o MP4.");
  const outFile = path.resolve(output);
  const outDir = path.dirname(outFile);
  const base = outFile.replace(/\.mp4$/i, "");
  const progress = `${outFile}.progress.json`;
  const runId = randomUUID();
  const workRoot = path.resolve(workDir ?? `${base}.work`);
  await mkdir(workRoot, { recursive: true });
  await mkdir(outDir, { recursive: true });
  const work = await mkdtemp(path.join(workRoot, `render-${runId}-`));
  const stagedOutput = path.join(outDir, `.${path.basename(base)}.${runId}.tmp.mp4`);
  const t0 = Date.now();
  let progressQueue = Promise.resolve();
  const stage = (name, done, total, extra = {}) => {
    const data = { status: "running", mode, stage: name, done, total, percent: round((done / Math.max(1, total)) * 100, 1), ...extra };
    progressQueue = progressQueue.then(() => writeProgress(progress, data, runId));
    return progressQueue;
  };

  // 0) source integrity
  if (!existsSync(timeline.source.path)) throw reelError(REEL_ERRORS.INPUT_INVALID, `Fonte não encontrada: ${timeline.source.path}`);
  const srcHash = await sha256File(timeline.source.path);
  if (srcHash !== timeline.source.sha256) throw reelError(REEL_ERRORS.SOURCE_CHANGED, "O arquivo de origem não é o mesmo da timeline (SHA-256 diferente).", { hint: "Use o original intacto ou regenere a timeline com motion edit plan." });
  const probe = await probeMedia(timeline.source.path);
  const fps = timeline.output.fps;
  const outW = mode === "preview" ? timeline.export.preview.width : timeline.output.width;
  const outH = mode === "preview" ? timeline.export.preview.height : timeline.output.height;
  const durationSec = timeline.segments.reduce((n, s) => n + s.frames, 0) / fps;
  const report = { schema: "motion.reel.render", schemaVersion: 1, mode, timelineHash: timelineHash(timeline), source: { path: timeline.source.path, sha256: srcHash }, output: outFile, width: outW, height: outH, fps, frames: timeline.output.frames, durationSec: round(durationSec, 6), ffmpeg: tools.version, files: {}, timings: {}, warnings: [] };
  if (keepWork) report.workDir = work;

  // 1) voice (treated + cut + normalized)
  await stage("audio", 0, 4);
  const audioOffset = (probe.audio?.startTime ?? 0) - (probe.video?.startTime ?? 0);
  const voiceWav = path.join(work, "voice.wav");
  const publishedVoiceWav = `${base}.voice.wav`;
  let voice = null;
  if (probe.audio) {
    const t = Date.now();
    voice = await processVoice(timeline.source.path, {
      output: voiceWav, preset: timeline.audio.preset, overrides: timeline.audio.overrides ?? {}, denoiser: timeline.audio.denoiser ?? "auto",
      segments: audioRanges(timeline.segments).map(([a, b, ...g]) => [a - audioOffset, b - audioOffset, ...g]),
      music: timeline.audio.music ? { ...timeline.audio.music, path: resolveFrom(timeline, timeline.audio.music.path) } : null,
      channels: timeline.export.audio.channels, abDir: voiceAbDir, workDir: path.join(work, "voice"),
    });
    report.files.voice = publishedVoiceWav;
    report.voice = { qa: voice.qa, after: voice.after.loudness, chain: voice.chain, latency: voice.latency, denoiser: voice.denoiser, denoiserFallback: voice.denoiserFallback, chainVersion: voice.chainVersion, params: voice.params, speechToPause: voice.speechToPause, loudnessPass: voice.loudnessPass, ab: voice.ab };
    if (voice.denoiserFallback) report.warnings.push(voice.denoiserFallback);
    report.timings.audioSec = round((Date.now() - t) / 1000, 2);
    if (Math.abs(audioOffset) > 0.001) report.warnings.push(`Áudio começa ${round(audioOffset * 1000, 1)} ms depois do vídeo na fonte; offset compensado no corte.`);
  } else report.warnings.push("Fonte sem áudio: vídeo renderizado sem trilha.");

  // 2) video segments
  const t1 = Date.now();
  let done = 0;
  const srcW = probe.video.width, srcH = probe.video.height;
  const segFiles = await mapLimit(timeline.segments, concurrency, async (seg, i) => {
    const f = await renderSegment(timeline, seg, i, { work, mode, srcW, srcH, outW, outH });
    done++; await stage("segments", done, timeline.segments.length);
    return f;
  });
  report.timings.segmentsSec = round((Date.now() - t1) / 1000, 2);
  const list = path.join(work, "segments.txt");
  await writeFile(list, segFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n");

  // 3) overlays
  let layers = [];
  if (!skipOverlays && timeline.overlays?.length) {
    await stage("overlays", 0, timeline.overlays.length);
    const t = Date.now();
    const style = timeline.overlayStyle ?? {};
    const fontsDir = style.fontsDir ? resolveFrom(timeline, style.fontsDir) : timeline.captions?.fontsDir ? resolveFrom(timeline, timeline.captions.fontsDir) : null;
    layers = await renderOverlayLayers(timeline.overlays, { width: timeline.output.width, height: timeline.output.height, style, fontsDir, workDir: path.join(work, "overlays") });
    report.overlays = layers.map((l) => ({ id: l.overlay.id, kind: l.overlay.kind, step: l.step, start: l.start, end: l.end, png: l.png, qa: l.qa }));
    report.timings.overlaysSec = round((Date.now() - t) / 1000, 2);
  }

  // 4) captions
  let assFile = null, fontsDir = null;
  if (!skipCaptions && timeline.captions?.enabled && timeline.captions.pages?.length) {
    assFile = path.join(work, "captions.ass");
    const captionsSrt = path.join(work, "captions.srt");
    const captionsWordsSrt = path.join(work, "captions.words.srt");
    const captionsJsonFile = path.join(work, "captions.json");
    await writeFile(assFile, buildAss(timeline.captions.pages, { width: timeline.output.width, height: timeline.output.height, styleIn: timeline.captions.style, placement: timeline.captions.placement }));
    await writeFile(captionsSrt, pagesToSrt(timeline.captions.pages));
    const hiddenIds = new Set(timeline.captions.hiddenWords ?? []);
    await writeFile(captionsWordsSrt, wordsToSrt(timeline.captions.words.filter((w) => !hiddenIds.has(String(w.id).split("#")[0]))));
    await writeFile(captionsJsonFile, JSON.stringify(captionsJson(timeline.captions.pages, { placement: timeline.captions.placement, style: timeline.captions.style, timelineHash: report.timelineHash }), null, 2));
    report.files.captionsAss = `${base}.captions.ass`; report.files.captionsSrt = `${base}.captions.srt`; report.files.captionsWordsSrt = `${base}.captions.words.srt`; report.files.captionsJson = `${base}.captions.json`;
    fontsDir = timeline.captions.fontsDir ? resolveFrom(timeline, timeline.captions.fontsDir) : null;
    if (!fontsDir) report.warnings.push("Legendas sem fontsDir: a fonte vem do sistema (fontconfig) e pode variar entre máquinas.");
  }

  // 5) compose
  await stage("compose", 0, 1);
  const t2 = Date.now();
  const args = ["-f", "concat", "-safe", "0", "-i", list];
  let aIdx = null;
  if (voice) { args.push("-i", voiceWav); aIdx = 1; }
  const firstOverlayInput = voice ? 2 : 1;
  const graph = [];
  let cur = "[0:v]";
  graph.push(`${cur}setpts=PTS-STARTPTS[b0]`);
  cur = "[b0]";
  layers.forEach((l, i) => {
    const dur = round(l.end - l.start, 6);
    // two spare frames: the looped image never runs out before the layer's last frame (enable ends it)
    args.push("-loop", "1", "-framerate", String(fps), "-t", String(round(dur + 2 / fps, 6)), "-i", l.png);
    const fi = l.crossfade ? 0.15 : l.enter ? 0.3 : 0, fo = l.exit && l.end < durationSec - 1 / fps ? 0.2 : 0; // a card that closes the film stays solid
    const chain = [`[${firstOverlayInput + i}:v]format=rgba`];
    if (outW !== timeline.output.width) chain.push(`scale=${outW}:${outH}`);
    if (fi) chain.push(`fade=t=in:st=0:d=${fi}:alpha=1`);
    if (fo) chain.push(`fade=t=out:st=${round(Math.max(0, dur - fo), 6)}:d=${fo}:alpha=1`);
    chain.push(`setpts=PTS+${round(l.start, 6)}/TB[o${i}]`);
    graph.push(chain.join(","));
    const slide = l.enter ? Math.round(28 * outH / 1920) : 0;
    const y = slide ? `'${slide}*(1-${ease.cubicOut(`min(1,max(0,(t-${round(l.start, 6)})/0.3))`)})'` : "0";
    graph.push(`${cur}[o${i}]overlay=x=0:y=${y}:eval=frame:eof_action=pass:enable='gte(t,${round(l.start - 0.25 / fps, 6)})*lt(t,${round(l.end - 0.25 / fps, 6)})'[b${i + 1}]`);
    cur = `[b${i + 1}]`;
  });
  if (assFile) {
    const esc = (p) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
    graph.push(`${cur}ass='${esc(assFile)}'${fontsDir ? `:fontsdir='${esc(fontsDir)}'` : ""}[vcap]`);
    cur = "[vcap]";
  }
  graph.push(`${cur}format=yuv420p[vout]`);
  const v = timeline.export.video, a = timeline.export.audio;
  const enc = mode === "preview" ? ["-preset", timeline.export.preview.preset, "-crf", String(timeline.export.preview.crf)] : ["-preset", v.preset, "-crf", String(v.crf)];
  args.push("-progress", "pipe:2", "-filter_complex", graph.join(";"), "-map", "[vout]");
  if (aIdx !== null) args.push("-map", `${aIdx}:a`, "-c:a", "aac", "-b:a", a.bitrate, "-ar", String(a.sampleRate), "-ac", String(a.channels), "-t", durationSec.toFixed(6));
  args.push("-frames:v", String(timeline.output.frames), "-r", String(fps), "-fps_mode", "cfr", "-c:v", "libx264", "-profile:v", v.profile, "-pix_fmt", "yuv420p", ...enc, "-g", String(v.gop),
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-threads", "4",
    "-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact", "-map_metadata", "-1", "-movflags", "+faststart", stagedOutput);
  const total = timeline.output.frames;
  await ff(args, "composição final", { onProgress: (s) => { const m = s.match(/frame=\s*(\d+)/g); if (m) { const n = Number(m.at(-1).replace(/\D/g, "")); stage("compose", n, total); } } });
  // 6) true peak is judged on the delivered AAC: the encoder adds inter-sample overshoot that no
  // limiter upstream can guarantee. Over the ceiling → less gain, audio re-encoded, video copied.
  if (aIdx !== null) {
    const ceiling = timeline.export.loudness.truePeakDb, cfg = { ...PRESETS.render.truePeak, ...(timeline.export.truePeak ?? {}) };
    let tp = (await measureLoudness(stagedOutput)).truePeakDbtp, trim = 0;
    const attempts = [{ gainDb: 0, truePeakDbtp: tp }];
    while (tp > ceiling && attempts.length <= cfg.maxReencodes) {
      trim -= tp - ceiling + cfg.marginDb;
      const tmpOut = path.join(work, "true-peak.mp4");
      await ff(["-i", stagedOutput, "-i", voiceWav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", `volume=${trim.toFixed(3)}dB`, "-c:a", "aac", "-b:a", a.bitrate, "-ar", String(a.sampleRate), "-ac", String(a.channels), "-t", durationSec.toFixed(6),
        "-fflags", "+bitexact", "-flags:a", "+bitexact", "-map_metadata", "-1", "-movflags", "+faststart", tmpOut], "recodificação do áudio (true peak)");
      await rename(tmpOut, stagedOutput);
      tp = (await measureLoudness(stagedOutput)).truePeakDbtp;
      attempts.push({ gainDb: round(trim, 3), truePeakDbtp: tp });
    }
    report.truePeak = { ceilingDbtp: ceiling, attempts, ok: tp <= ceiling };
    if (tp > ceiling) report.warnings.push(`True peak ${tp} dBTP acima do teto ${ceiling} após ${attempts.length - 1} recodificações: o QA reprova.`);
  }
  report.timings.composeSec = round((Date.now() - t2) / 1000, 2);
  report.timings.totalSec = round((Date.now() - t0) / 1000, 2);
  report.sha256 = await sha256File(stagedOutput);
  report.files.video = outFile;
  const timelineCopy = `${base}.timeline.json`;
  const { __file, ...clean } = timeline;
  const timelineText = JSON.stringify(clean, null, 2) + "\n";
  report.files.timeline = timelineCopy;
  const srcAfter = await sha256File(timeline.source.path);
  report.source.unchanged = srcAfter === srcHash;
  report.files.report = `${base}.render.json`;
  if (voice) await atomicCopyFile(voiceWav, publishedVoiceWav, runId);
  if (assFile) {
    await atomicCopyFile(assFile, report.files.captionsAss, runId);
    await atomicCopyFile(path.join(work, "captions.srt"), report.files.captionsSrt, runId);
    await atomicCopyFile(path.join(work, "captions.words.srt"), report.files.captionsWordsSrt, runId);
    await atomicCopyFile(path.join(work, "captions.json"), report.files.captionsJson, runId);
  }
  await atomicWriteFile(timelineCopy, timelineText, runId);
  await rename(stagedOutput, outFile);
  await atomicWriteFile(report.files.report, JSON.stringify(report, null, 2), runId);
  if (!keepWork) await rm(work, { recursive: true, force: true });
  await progressQueue;
  await writeProgress(progress, { status: "done", mode, stage: "done", done: 1, total: 1, percent: 100, output: outFile, report: report.files.report }, runId);
  return report;
}

export async function readProgress(outputMp4) {
  const { readFile } = await import("node:fs/promises");
  try { return JSON.parse(await readFile(`${path.resolve(outputMp4)}.progress.json`, "utf8")); }
  catch { return { status: "unknown", output: path.resolve(outputMp4) }; }
}

