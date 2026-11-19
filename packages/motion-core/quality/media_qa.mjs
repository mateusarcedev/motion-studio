/**
 * MOTION Core — quality/media_qa.mjs
 * Video/audio QA with FFprobe/FFmpeg: stream presence, codec, resolution, fps, duration,
 * decodability, A/V sync, silence, loudness, black/frozen frames.
 * Missing ffmpeg/ffprobe → BLOCKED (never silently PASS).
 */
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { createQaReport } from "./qa-status.mjs";

function run(cmd, args, { timeoutMs = 300000 } = {}) {
  return new Promise((resolve) => {
    let stdout = "", stderr = "", done = false;
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => { if (!done) { child.kill("SIGKILL"); } }, timeoutMs);
    child.stdout.on("data", (d) => { stdout += d; }); child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", (error) => { done = true; clearTimeout(timer); resolve({ code: -1, stdout, stderr, error }); });
    child.on("close", (code) => { done = true; clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}
const frac = (s) => { const [a, b] = String(s).split("/").map(Number); return b ? a / b : a; };
const REPRODUCE_TOOLS = "Instale FFmpeg (apt install ffmpeg | brew install ffmpeg) e rode: motion qa media <arquivo>";

/**
 * @param {string} file
 * @param {{width?:number,height?:number,fps?:number,durationSec?:number,durationTolerance?:number,codec?:string,audio?:boolean|"optional",
 *          maxSilenceRatio?:number,minLufs?:number,maxLufs?:number,maxPeakDb?:number, checkBlack?:boolean}} [expect]
 */
export async function qaMedia(file, expect = {}) {
  const report = createQaReport({ subject: path.basename(file), kind: "media" });
  try { await stat(file); } catch {
    return report.add({ id: "file.exists", title: "Arquivo existe", status: "FAIL", details: `Não encontrado: ${file}` });
  }
  const probe = await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]);
  if (probe.error) {
    for (const [id, title] of [["probe", "Integridade e metadados (ffprobe)"], ["decode", "Decodificação completa"], ["audio", "Áudio (silêncio, nível, sincronismo)"]]) {
      report.add({ id, title, status: "BLOCKED", details: "ffprobe/ffmpeg não disponível neste ambiente", reproduce: REPRODUCE_TOOLS });
    }
    return report;
  }
  let info;
  try { info = JSON.parse(probe.stdout); } catch { info = null; }
  if (probe.code !== 0 || !info?.streams?.length) {
    return report.add({ id: "probe", title: "Arquivo de mídia legível", status: "FAIL", details: (probe.stderr.trim().split("\n")[0] || "ffprobe não reconheceu o arquivo") });
  }
  report.add({ id: "probe", title: "Arquivo de mídia legível", status: "PASS", details: `${info.format.format_name}, ${Number(info.format.duration ?? 0).toFixed(2)}s` });

  const v = info.streams.find((s) => s.codec_type === "video");
  const a = info.streams.find((s) => s.codec_type === "audio");
  if (!v) report.add({ id: "video.stream", title: "Stream de vídeo presente", status: "FAIL" });
  else {
    report.add({ id: "video.stream", title: "Stream de vídeo presente", status: "PASS", details: `${v.codec_name} ${v.pix_fmt ?? ""}`.trim() });
    if (expect.codec) report.add({ id: "video.codec", title: `Codec de vídeo = ${expect.codec}`, status: v.codec_name === expect.codec ? "PASS" : "FAIL", details: `encontrado ${v.codec_name}` });
    if (expect.width || expect.height) {
      const ok = (!expect.width || v.width === expect.width) && (!expect.height || v.height === expect.height);
      report.add({ id: "video.resolution", title: `Resolução ${expect.width ?? "?"}×${expect.height ?? "?"}`, status: ok ? "PASS" : "FAIL", details: `encontrado ${v.width}×${v.height}` });
    }
    const fps = frac(v.avg_frame_rate), rfps = frac(v.r_frame_rate);
    if (expect.fps) {
      const cfr = Math.abs(fps - rfps) < 0.01;
      report.add({ id: "video.fps", title: `Taxa de quadros ${expect.fps} fps (CFR)`, status: Math.abs(fps - expect.fps) < 0.01 && cfr ? "PASS" : "FAIL", details: `média ${fps.toFixed(3)} fps, nominal ${rfps.toFixed(3)} fps${cfr ? "" : " (VFR detectado)"}` });
    }
    const vDur = Number(v.duration ?? info.format.duration);
    if (expect.durationSec) {
      const tol = expect.durationTolerance ?? 0.1;
      report.add({ id: "video.duration", title: `Duração ≈ ${expect.durationSec}s`, status: Math.abs(vDur - expect.durationSec) <= tol ? "PASS" : "FAIL", details: `encontrado ${vDur.toFixed(3)}s (±${tol}s)` });
    }
    if (expect.durationSec && expect.fps && v.nb_frames) {
      const expected = Math.round(expect.durationSec * expect.fps);
      report.add({ id: "video.frames", title: `Contagem de quadros = ${expected}`, status: Math.abs(Number(v.nb_frames) - expected) <= 1 ? "PASS" : "FAIL", details: `encontrado ${v.nb_frames}` });
    }
  }

  // decode whole file
  const dec = await run("ffmpeg", ["-v", "error", "-xerror", "-i", file, "-f", "null", "-"]);
  report.add({ id: "decode", title: "Decodificação completa sem erros", status: dec.error ? "BLOCKED" : dec.code === 0 && !dec.stderr.trim() ? "PASS" : "FAIL",
    details: dec.error ? "ffmpeg indisponível" : dec.stderr.trim().split("\n")[0] || null, reproduce: dec.error ? REPRODUCE_TOOLS : null });

  // audio
  if (expect.audio === true && !a) report.add({ id: "audio.stream", title: "Stream de áudio presente", status: "FAIL", details: "o arquivo não tem áudio" });
  else if (!a) report.add({ id: "audio.stream", title: "Stream de áudio", status: expect.audio === "optional" || expect.audio === undefined ? "PASS" : "FAIL", details: "sem áudio (não exigido)", required: false });
  else {
    report.add({ id: "audio.stream", title: "Stream de áudio presente", status: "PASS", details: `${a.codec_name} ${a.sample_rate}Hz ${a.channels}ch` });
    if (v) {
      const diff = Math.abs(Number(a.duration ?? info.format.duration) - Number(v.duration ?? info.format.duration));
      report.add({ id: "audio.sync", title: "Sincronismo áudio/vídeo (duração)", status: diff <= 0.15 ? "PASS" : diff <= 0.5 ? "WARN" : "FAIL", details: `diferença ${diff.toFixed(3)}s`, heuristic: true });
      const offset = Number(a.start_time ?? 0) - Number(v.start_time ?? 0);
      report.add({ id: "audio.start", title: "Início alinhado (t=0 = frame 0)", status: Math.abs(offset) <= 0.05 ? "PASS" : "WARN", details: `offset ${offset.toFixed(3)}s` });
    }
    const sil = await run("ffmpeg", ["-nostats", "-i", file, "-vn", "-af", "silencedetect=noise=-50dB:d=0.5", "-f", "null", "-"]);
    if (!sil.error) {
      const total = Number(a.duration ?? info.format.duration) || 1;
      const silent = [...sil.stderr.matchAll(/silence_duration:\s*([\d.]+)/g)].reduce((n, m) => n + Number(m[1]), 0)
        + (/silence_start/.test(sil.stderr) && (sil.stderr.match(/silence_start/g) ?? []).length > (sil.stderr.match(/silence_end/g) ?? []).length ? 0.5 : 0);
      const ratio = Math.min(1, silent / total), max = expect.maxSilenceRatio ?? 0.5;
      report.add({ id: "audio.silence", title: "Silêncio inesperado", status: ratio >= 0.98 ? "FAIL" : ratio > max ? "WARN" : "PASS", details: `${(ratio * 100).toFixed(0)}% abaixo de −50 dB`, heuristic: true });
    }
    const loud = await run("ffmpeg", ["-nostats", "-i", file, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"]);
    if (!loud.error) {
      const I = [...loud.stderr.matchAll(/I:\s+(-?[\d.]+|-inf)\s+LUFS/g)].at(-1)?.[1];
      const peak = [...loud.stderr.matchAll(/Peak:\s+(-?[\d.]+|-inf)\s+dBFS/g)].at(-1)?.[1];
      const lufs = I === undefined || I === "-inf" ? null : Number(I), pk = peak === undefined || peak === "-inf" ? null : Number(peak);
      if (lufs === null) report.add({ id: "audio.loudness", title: "Nível de áudio", status: "FAIL", details: "áudio sem sinal mensurável (silêncio total)" });
      else {
        const lo = expect.minLufs ?? -30, hi = expect.maxLufs ?? -9;
        report.add({ id: "audio.loudness", title: `Loudness integrado entre ${lo} e ${hi} LUFS`, status: lufs >= lo && lufs <= hi ? "PASS" : "WARN", details: `${lufs} LUFS`, heuristic: true });
        const maxPeak = expect.maxPeakDb ?? -0.1;
        report.add({ id: "audio.clipping", title: "Sem clipping (true peak)", status: pk !== null && pk > maxPeak ? "FAIL" : "PASS", details: `pico ${pk} dBFS` });
      }
    }
  }

  // black / frozen frames
  if (v && expect.checkBlack !== false) {
    const black = await run("ffmpeg", ["-nostats", "-i", file, "-an", "-vf", "blackdetect=d=0.5:pix_th=0.10", "-f", "null", "-"]);
    if (!black.error) {
      const spans = [...black.stderr.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
      report.add({ id: "video.black", title: "Sem trechos pretos inesperados (≥0,5 s)", status: spans.length ? "WARN" : "PASS", details: spans.length ? spans.map(([s, e]) => `${s.toFixed(2)}–${e.toFixed(2)}s`).join(", ") : null, heuristic: true });
    }
    const freeze = await run("ffmpeg", ["-nostats", "-i", file, "-an", "-vf", "freezedetect=n=-60dB:d=1.5", "-f", "null", "-"]);
    if (!freeze.error) {
      const spans = [...freeze.stderr.matchAll(/freeze_start:\s*([\d.]+)/g)].map((m) => Number(m[1]));
      report.add({ id: "video.frozen", title: "Sem quadros congelados longos (≥1,5 s)", status: spans.length ? "WARN" : "PASS", details: spans.length ? `início em ${spans.map((s) => s.toFixed(2)).join(", ")}s` : null, heuristic: true });
    }
  }
  return report;
}
