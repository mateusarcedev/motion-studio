/**
 * MOTION Core — reel/caption_qa.mjs
 * Measured caption checks: reading speed with a probable cause, word boxes at the animation
 * peak, contrast against the real footage, and cards that repeat the caption on screen.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildWordBoxAss, DEFAULT_CAPTION_STYLE } from "./captions.mjs";
import { layerTexts, overlayLayers } from "./overlays.mjs";
import { framingFilter } from "./render.mjs";
import { normalizeWord, round, run } from "./util.mjs";

const pageText = (p) => p.words.map((w) => w.display).join(" ");

/**
 * Pages read faster than the limit. The fix depends on the cause, so one is proposed:
 * - "timing do ASR": a word faster than anyone speaks, or the neighbouring pages (or an
 *   implausibly long word next to it) hold the missing time;
 * - "texto demais": the whole neighbourhood is equally fast (rapid speech or a long page).
 */
export function captionCps(pages, { warn, maxWordCps, windowPages }, { longWordSec }) {
  const out = [];
  pages.forEach((p, i) => {
    const text = pageText(p), dur = p.end - p.start, cps = text.length / Math.max(0.01, dur);
    if (cps <= warn) return;
    const near = pages.slice(Math.max(0, i - windowPages), i + windowPages + 1);
    const span = near.at(-1).end - near[0].start;
    const windowCps = round(near.reduce((n, q) => n + pageText(q).length, 0) / Math.max(0.01, span), 1);
    const fastest = p.words.map((w) => ({ w, cps: w.display.length / Math.max(0.01, w.end - w.start) })).filter((x) => x.w.display.length >= 4).sort((a, b) => b.cps - a.cps)[0];
    const long = near.flatMap((q) => q.words).find((w) => w.end - w.start > longWordSec);
    const evidence = [];
    if (fastest && fastest.cps > maxWordCps) evidence.push(`"${fastest.w.text}" a ${round(fastest.cps, 0)} cps, acima da fala humana`);
    if (long) evidence.push(`"${long.text}" ao lado com ${round(long.end - long.start, 2)} s`);
    if (windowCps <= warn && !evidence.length) evidence.push(`vizinhança a ${windowCps} cps`);
    const timing = evidence.length > 0;
    out.push({ index: p.index, start: p.start, text, cps: round(cps, 1), windowCps, cause: timing ? "timing do ASR" : "texto demais", evidence: timing ? evidence.join("; ") : `vizinhança também rápida (${windowCps} cps)` });
  });
  return out;
}

async function litBoxes(ass, count, { workDir, width, height, fonts, fps = 30, threshold = 48 }) {
  await mkdir(workDir, { recursive: true });
  const file = path.join(workDir, "qa-words.ass");
  await writeFile(file, ass);
  const esc = (p) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
  const w2 = Math.round(width / 2), h2 = Math.round(height / 2), size = w2 * h2;
  const boxes = [];
  let buf = Buffer.alloc(0);
  const r = await run("ffmpeg", ["-hide_banner", "-v", "error", "-f", "lavfi", "-i", `color=black:s=${width}x${height}:r=${fps}`, "-vf", `ass='${esc(file)}'${fonts ? `:fontsdir='${esc(fonts)}'` : ""},scale=${w2}:${h2},format=gray`, "-frames:v", String(count), "-f", "rawvideo", "-"], {
    onStdout: (c) => {
      buf = buf.length ? Buffer.concat([buf, c]) : c;
      while (buf.length >= size) {
        let x1 = w2, x2 = -1, y1 = h2, y2 = -1;
        for (let y = 0; y < h2; y++) for (let x = 0, o = y * w2; x < w2; x++) if (buf[o + x] > threshold) { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
        boxes.push(x2 < 0 ? null : { x1: x1 * 2, x2: x2 * 2 + 1, y1: y1 * 2, y2: y2 * 2 + 1 });
        buf = buf.subarray(size);
      }
    },
  });
  return { boxes, ok: r.code === 0 && boxes.length === count, stderr: r.code === 0 ? (boxes.length === count ? null : `${boxes.length}/${count} quadros`) : r.stderr.trim().split("\n").at(-1) };
}

/** Real box of every word (outline included) at the animation peak. */
export async function measureWordBoxes(timeline, { workDir, resolveFont = null } = {}) {
  const { width, height } = timeline.output;
  const pages = timeline.captions.pages;
  const { ass, index } = buildWordBoxAss(pages, { width, height, styleIn: timeline.captions.style, placement: timeline.captions.placement });
  const m = await litBoxes(ass, index.length, { workDir, width, height, fonts: resolveFont });
  const byIndex = new Map(pages.map((p) => [p.index, p]));
  return { ok: m.ok, stderr: m.stderr, boxes: m.boxes.map((b, i) => b && { ...b, ...index[i], text: byIndex.get(index[i].page).words[index[i].word].display, start: byIndex.get(index[i].page).start }).filter(Boolean) };
}

/** Pairs of words of one page whose boxes intersect by more than the tolerance in both axes. */
export function wordOverlaps(boxes, tolerancePx) {
  const out = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length && boxes[j].page === boxes[i].page; j++) {
    const a = boxes[i], b = boxes[j];
    const dx = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1), dy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
    if (dx > tolerancePx && dy > tolerancePx) out.push({ page: a.page, start: a.start, a: a.text, b: b.text, px: Math.min(dx, dy) });
  }
  return out;
}

const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const contrastRatio = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

/**
 * Contrast of each caption colour against the footage under the caption box. Frames come from
 * the source through the same framing filter as the render, without captions on top.
 */
export async function captionContrast(t, boxes, { minRatio, outlineMinRatio, outlineMinPx, percentile }) {
  if (!existsSync(t.source.path)) return { status: "BLOCKED", details: "original indisponível" };
  if (!boxes?.length) return { status: "BLOCKED", details: "nenhuma caixa de legenda medida" };
  const s = { ...DEFAULT_CAPTION_STYLE, ...t.captions.style };
  const { width: W, height: H } = t.output;
  const probe = t.source.probe.video;
  const samples = [];
  for (const b of boxes) {
    const seg = t.segments.find((x) => b.t >= x.dst[0] - 1e-6 && b.t < x.dst[1] - 1e-6);
    if (!seg) continue;
    const src = seg.src[0] + (b.t - seg.dst[0]);
    const w = Math.max(2, b.x2 - b.x1), h = Math.max(2, b.y2 - b.y1);
    const vf = `${framingFilter({ ...seg, zoom: { ...seg.zoom, easeInFrames: 0 } }, { srcW: probe.width, srcH: probe.height, outW: W, outH: H, frames: seg.frames })},crop=${w}:${h}:${b.x1}:${b.y1},scale=48:24:flags=area,format=rgb24`;
    const r = await run("ffmpeg", ["-v", "error", "-ss", src.toFixed(4), "-i", t.source.path, "-frames:v", "1", "-vf", vf, "-f", "rawvideo", "-"], { binary: true });
    if (r.code !== 0 || r.stdout.length < 48 * 24 * 3) continue;
    const lum = [];
    for (let i = 0; i + 2 < r.stdout.length; i += 3) lum.push(luminance([r.stdout[i], r.stdout[i + 1], r.stdout[i + 2]]));
    samples.push({ t: b.t, lum });
  }
  if (!samples.length) return { status: "BLOCKED", details: "nenhum quadro da fonte pôde ser amostrado" };
  const colors = { texto: s.color, ativa: s.activeColor, ...((s.keywords ?? []).length ? { "palavra-chave": s.keywordColor } : {}) };
  const outlineLum = luminance(rgb(s.outlineColor));
  const weak = [], notes = [];
  let status = "PASS";
  for (const [name, hex] of Object.entries(colors)) {
    const L = luminance(rgb(hex));
    // ratio that (percentile)% of the pixels under the box reach or exceed
    const ratios = samples.map((x) => { const rs = x.lum.map((l) => contrastRatio(L, l)).sort((a, b) => b - a); return { t: x.t, ratio: rs[Math.min(rs.length - 1, Math.floor((percentile / 100) * rs.length))] }; });
    const worst = ratios.reduce((m, x) => (x.ratio < m.ratio ? x : m));
    const low = ratios.filter((x) => x.ratio < minRatio);
    notes.push(`${name} ${hex}: pior ${round(worst.ratio, 2)}:1 em ${round(worst.t, 2)}s`);
    if (!low.length) continue;
    const outlined = s.outlineWidth >= outlineMinPx && contrastRatio(L, outlineLum) >= outlineMinRatio;
    weak.push(`${name}: ${low.length}/${ratios.length} páginas abaixo${outlined ? ` (legível pelo contorno ${s.outlineWidth}px, ${round(contrastRatio(L, outlineLum), 1)}:1)` : " e sem contorno suficiente"}`);
    status = outlined && status !== "FAIL" ? "WARN" : "FAIL";
  }
  return { status, details: [...notes, ...weak].join("; "), samples: samples.length };
}

const STOP = new Set("e o a os as de do da dos das que se em no na nos nas um uma pra pro para por com ao mas ou como".split(" "));
const tokens = (s) => String(s).split(/\s+/).map(normalizeWord).filter((x) => x && !STOP.has(x));

/** Caption pages whose content words are mostly already readable on a visible card. */
export function cardDuplicates(t, minRatio) {
  const out = [], seen = new Set();
  for (const layer of overlayLayers(structuredClone(t.overlays ?? []))) {
    const card = new Set(layerTexts(layer).flatMap(tokens));
    if (!card.size) continue;
    for (const p of t.captions.pages) {
      if (p.end <= layer.start + 0.05 || p.start >= layer.end - 0.05) continue;
      const tk = tokens(p.words.map((w) => w.text).join(" "));
      if (!tk.length || tk.filter((x) => card.has(x)).length / tk.length < minRatio) continue;
      const key = `${layer.overlay.id}:${p.index}`;
      if (!seen.has(key)) { seen.add(key); out.push({ card: layer.overlay.id, caption: p.words.map((w) => w.text).join(" "), start: p.start }); }
    }
  }
  return out;
}
