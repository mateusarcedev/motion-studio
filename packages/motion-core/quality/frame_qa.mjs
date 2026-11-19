/**
 * MOTION Core — quality/frame_qa.mjs
 * Automated visual-risk checks on rendered stills/frames (no extra dependencies: FFmpeg decodes PNGs).
 * Everything here is a HEURISTIC: it flags risk for the Critic, it does not prove artistic quality.
 */
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { createQaReport } from "./qa-status.mjs";

const W = 32, H = 18;

function thumbnail(file) {
  return new Promise((resolve) => {
    const chunks = [];
    const child = spawn("ffmpeg", ["-v", "error", "-i", file, "-vf", `scale=${W}:${H}:flags=area`, "-f", "rawvideo", "-pix_fmt", "gray", "-"], { stdio: ["ignore", "pipe", "ignore"] });
    child.stdout.on("data", (d) => chunks.push(d));
    child.on("error", () => resolve(null));
    child.on("close", (code) => { const b = Buffer.concat(chunks); resolve(code === 0 && b.length === W * H ? b : null); });
  });
}
export function stats(px) {
  let sum = 0; for (const v of px) sum += v;
  const mean = sum / px.length; let sq = 0; for (const v of px) sq += (v - mean) ** 2;
  return { mean, std: Math.sqrt(sq / px.length) };
}
export function averageHash(px) { const { mean } = stats(px); return Uint8Array.from(px, (v) => (v >= mean ? 1 : 0)); }
export function hamming(a, b) { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d / a.length; }

async function pool(items, size, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

/**
 * @param {string} dir directory of PNG frames/stills (numbered or named)
 * @param {{maxFrames?:number, expectedFrames?:number, blankStd?:number, darkMean?:number, similar?:number}} [opts]
 */
export async function qaFrames(dir, opts = {}) {
  const report = createQaReport({ subject: path.basename(path.resolve(dir)), kind: "frames" });
  const all = (await readdir(dir).catch(() => [])).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
  if (!all.length) return report.add({ id: "frames.exists", title: "Quadros encontrados", status: "FAIL", details: `nenhuma imagem em ${dir}` });
  if (opts.expectedFrames) report.add({ id: "frames.count", title: `Contagem de quadros = ${opts.expectedFrames}`, status: all.length === opts.expectedFrames ? "PASS" : "FAIL", details: `encontrados ${all.length}` });

  const step = Math.max(1, Math.ceil(all.length / (opts.maxFrames ?? 120)));
  const files = all.filter((_, i) => i % step === 0);
  const thumbs = await pool(files, 8, (f) => thumbnail(path.join(dir, f)));
  if (thumbs.every((t) => t === null)) {
    for (const [id, title] of [["blank", "Quadros vazios"], ["repetition", "Repetição de quadros"], ["dark", "Cenas escuras"]]) {
      report.add({ id, title, status: "BLOCKED", details: "ffmpeg indisponível ou imagens ilegíveis", reproduce: "Instale FFmpeg e rode: motion qa frames <pasta>" });
    }
    return report;
  }
  const data = files.map((f, i) => ({ file: f, px: thumbs[i] })).filter((d) => d.px);
  const unreadable = files.length - data.length;
  if (unreadable) report.add({ id: "frames.readable", title: "Todos os quadros decodificam", status: "FAIL", details: `${unreadable} ilegível(is)` });
  for (const d of data) { d.s = stats(d.px); d.h = averageHash(d.px); }

  const blank = data.filter((d) => d.s.std < (opts.blankStd ?? 2));
  report.add({ id: "blank", title: "Sem quadros inesperadamente vazios", status: blank.length ? "WARN" : "PASS", heuristic: true,
    details: blank.length ? `${blank.length}/${data.length} quase uniformes (ex.: ${blank.slice(0, 4).map((d) => d.file).join(", ")})` : null, evidence: blank.slice(0, 10).map((d) => d.file) });

  const dark = data.filter((d) => d.s.mean < (opts.darkMean ?? 25));
  const darkRatio = dark.length / data.length;
  report.add({ id: "dark", title: "Escuridão sob controle (cena escura precisa de intenção)", status: darkRatio > 0.6 ? "WARN" : "PASS", heuristic: true, details: `${(darkRatio * 100).toFixed(0)}% dos quadros com luminância média < ${opts.darkMean ?? 25}/255` });

  const lowContrast = data.filter((d) => d.s.std < 12 && d.s.std >= (opts.blankStd ?? 2));
  report.add({ id: "contrast.global", title: "Contraste global (variação tonal)", status: lowContrast.length / data.length > 0.5 ? "WARN" : "PASS", heuristic: true, details: `${lowContrast.length}/${data.length} com variação tonal baixa` });

  // repetition: identical neighbours and near-duplicate pairs across the film
  let identicalRuns = 0;
  for (let i = 1; i < data.length; i++) if (hamming(data[i].h, data[i - 1].h) === 0 && Math.abs(data[i].s.mean - data[i - 1].s.mean) < 0.5) identicalRuns++;
  const sim = opts.similar ?? 0.05;
  let withTwin = 0;
  for (let i = 0; i < data.length; i++) if (data.some((o, j) => Math.abs(i - j) > 1 && hamming(data[i].h, o.h) <= sim && Math.abs(data[i].s.mean - o.s.mean) < 6)) withTwin++;
  const twinRatio = data.length > 3 ? withTwin / data.length : 0;
  report.add({ id: "repetition", title: "Variedade entre cenas (sem repetição excessiva)", heuristic: true,
    status: twinRatio > 0.6 ? "WARN" : "PASS", details: `${(twinRatio * 100).toFixed(0)}% dos quadros têm um gêmeo visual não adjacente; ${identicalRuns} pares adjacentes idênticos` });
  if (data.length >= 6 && identicalRuns / (data.length - 1) > 0.9) report.add({ id: "static", title: "Animação presente (quadros mudam)", status: "FAIL", details: "praticamente todos os quadros são idênticos — controlador de animação provavelmente não executou" });
  else if (data.length >= 6) report.add({ id: "static", title: "Animação presente (quadros mudam)", status: "PASS" });
  return report;
}
