/**
 * MOTION Core — reel/captions.mjs
 * Smart Captions: pages from destination-timed words, kinetic ASS (libass) with an
 * active-word highlight, placement that respects platform safe zones and the speaker's
 * face, and SRT / JSON exports. Words are displayed exactly as transcribed (only letter
 * case and trailing comma/period may be styled away; never words or meaning).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeWord, reelError, REEL_ERRORS, round } from "./util.mjs";
import { srtTime, toSrt } from "./stt/index.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_CAPTION_STYLE = Object.freeze({
  fontFamily: "Inter", fontWeight: 700, fontSize: 96, uppercase: true,
  color: "#FFFFFF", activeColor: "#2EE6A6", keywordColor: "#FFD23F",
  outlineColor: "#000000", outlineWidth: 6, shadow: 2, shadowColor: "#000000",
  maxWordsPerPage: 3, maxCharsPerLine: 14, maxLines: 2, minPageSec: 0.65, maxGapSec: 0.45,
  // libass metrics measured for Inter 700: cap height ≈ 0.567 × size, mean uppercase advance ≈ 0.466 em
  advanceEm: 0.47,
  holdSec: 0.25, punctuation: "minimal", animation: "pop", keywords: [],
  platform: "instagram-reels",
});

export function loadSafeZonePreset(platform = "instagram-reels") {
  const file = path.join(here, "..", "safe-zones", "presets.json");
  const data = JSON.parse(readFileSync(file, "utf8"));
  const p = data.presets[platform];
  if (!p) throw new Error(`safe zone desconhecida: ${platform}`);
  return { id: platform, ...p, version: data.version };
}

/** Text shown on screen for a word: case and minimal punctuation only. */
export function displayWord(text, style) {
  let t = text;
  if (style.punctuation === "minimal") t = t.replace(/[,.;:…]+$/u, "");
  return style.uppercase ? t.toLocaleUpperCase("pt-BR") : t;
}

/**
 * Groups words into caption pages: break on long gaps, sentence punctuation, word/char
 * budgets. Lines are balanced inside a page.
 */
// Words that must not end a page (they lean on the next word): articles, prepositions,
// conjunctions, quantifiers, demonstratives and a few modifiers.
const CARRY = new Set(["e", "o", "a", "os", "as", "de", "do", "da", "dos", "das", "que", "se", "em", "no", "na", "nos", "nas", "um", "uma", "pra", "pro", "para", "por", "com", "ao", "mas", "ou", "como", "quando", "porque",
  "muito", "muita", "muitos", "muitas", "esse", "essa", "este", "esta", "aquele", "aquela", "nao", "proprio", "propria", "seu", "sua", "meu", "minha", "mais", "the", "of", "and", "to", "in"]);
const CONJ = new Set(["e", "mas", "ou", "porque", "quando", "que", "como", "se"]);
const GENITIVE = new Set(["de", "da", "do", "das", "dos"]);
const isFunctionWord = (t) => CARRY.has(normalizeWord(t));

/**
 * Pages by dynamic programming over break positions: hard limits (≤ 5 words, char budget,
 * no long gap or sentence end inside a page) and costs that prefer 2–3 words, ≥ minPageSec,
 * breaks at punctuation/pauses/before conjunctions, and never after a function word or
 * inside "noun de noun" compounds.
 */
export function buildPages(words, styleIn = {}) {
  const style = { ...DEFAULT_CAPTION_STYLE, ...styleIn };
  const usable = words.filter((w) => !w.suspect); // suspected hallucination never becomes a caption
  const n = usable.length;
  const disp = usable.map((w) => displayWord(w.text, style));
  const budget = style.maxCharsPerLine * style.maxLines;
  const hardMax = Math.max(style.maxWordsPerPage, Math.min(5, style.maxWordsPerPage + 2));
  const breakCost = (j) => { // break between usable[j-1] and usable[j]
    if (j >= n) return 0;
    const prev = usable[j - 1], next = usable[j];
    if (next.afterCut) return -0.5; // the picture changes here anyway
    if (/[.!?…]$/u.test(prev.text)) return -0.5;
    if (/[,;:]$/u.test(prev.text)) return 0;
    if (next.start - prev.end > 0.3) return 0;
    if (isFunctionWord(prev.text)) return 12;
    // proper-noun compounds ("Claude Code", "regra de Negócio" excluded): two capitalized words in a row
    if (/^\p{Lu}/u.test(prev.text) && /^\p{Lu}/u.test(next.text) && !/[.!?…]$/u.test(usable[j - 2]?.text ?? ".")) return 12;
    if (GENITIVE.has(normalizeWord(next.text))) return 5;
    if (CONJ.has(normalizeWord(next.text))) return 0.5;
    return 1.5;
  };
  const pageCost = (i, j) => { // usable[i..j-1]
    const k = j - i;
    if (k > hardMax) return Infinity;
    if (disp.slice(i, j).join(" ").length > budget && k > 1) return Infinity;
    for (let x = i; x < j - 1; x++) {
      const gap = usable[x + 1].start - usable[x].end;
      // a leaning word (article, quantifier…) may bridge a slightly longer pause to stay with its noun
      if (gap > style.maxGapSec && !(isFunctionWord(usable[x].text) && gap < 0.9)) return Infinity;
      if (/[.!?…]$/u.test(usable[x].text)) return Infinity;
    }
    let crossCut = 0;
    for (let x = i + 1; x < j; x++) if (usable[x].afterCut) crossCut += 4;
    const lenCost = ([0, 2.5, 0.4, 0, 1.2, 2.8][k] ?? 5) + crossCut;
    const dur = usable[j - 1].end - usable[i].start;
    const durCost = dur < 0.4 ? 9 : dur < style.minPageSec ? 2.5 + (style.minPageSec - dur) * 6 : dur > 2.4 ? 1.5 : 0;
    return lenCost + durCost;
  };
  const best = new Array(n + 1).fill(Infinity), from = new Array(n + 1).fill(-1);
  best[0] = 0;
  for (let j = 1; j <= n; j++) for (let i = Math.max(0, j - hardMax); i < j; i++) {
    const c = best[i] + pageCost(i, j) + breakCost(j);
    if (c < best[j]) { best[j] = c; from[j] = i; }
  }
  const groups = [];
  for (let j = n; j > 0; j = from[j]) { const i = from[j] >= 0 ? from[j] : j - 1; groups.unshift(usable.slice(i, j)); if (from[j] < 0) from[j] = j - 1; }
  const pages = groups;
  const kw = new Set((style.keywords ?? []).map(normalizeWord));
  return pages.map((ws, i) => {
    const next = pages[i + 1];
    const start = ws[0].start;
    let end = ws.at(-1).end + style.holdSec;
    if (next) end = Math.min(end, next[0].start);
    end = Math.max(end, start + style.minPageSec);
    if (next) end = Math.min(end, next[0].start);
    const lines = balanceLines(ws.map((w) => displayWord(w.text, style)), style.maxCharsPerLine, style.maxLines);
    return {
      index: i, start: round(start), end: round(end), lines,
      words: ws.map((w) => ({ id: w.id, text: w.text, display: displayWord(w.text, style), start: w.start, end: w.end, keyword: kw.has(normalizeWord(w.text)), confidence: w.confidence ?? null })),
    };
  });
}

/** Splits displayed words into ≤ maxLines lines, minimizing the longest line. Returns word counts per line. */
export function balanceLines(tokens, maxChars, maxLines) {
  const len = (a, b) => tokens.slice(a, b).join(" ").length;
  if (maxLines <= 1 || len(0, tokens.length) <= maxChars) return [tokens.length];
  let best = null;
  for (let k = 1; k < tokens.length; k++) {
    const worst = Math.max(len(0, k), len(k, tokens.length));
    if (!best || worst < best.worst) best = { k, worst };
  }
  return [best.k, tokens.length - best.k];
}

/**
 * Vertical placement (0..1, block centre). Avoids the eyes→mouth band of the face box and
 * stays inside the platform's safe area (above bottom UI, left of side controls).
 */
export function placeCaptions({ width, height, faceBox = null, platform = "instagram-reels", lines = 2, fontSize = 96, override = null }) {
  const sz = loadSafeZonePreset(platform);
  const top = sz.margins.top / 100, bottom = 1 - sz.margins.bottom / 100;
  const blockH = (lines * fontSize * 0.95) / height; // libass line height ≈ 0.95 × size for Inter
  const reserved = sz.reservedRegions.map((r) => ({ ...r, x0: r.x / 100, x1: (r.x + r.width) / 100, y0: r.y / 100, y1: (r.y + r.height) / 100 }));
  const side = reserved.filter((r) => r.x0 > 0.5).reduce((m, r) => Math.min(m, r.x0), 1 - sz.margins.right / 100);
  const maxWidthPx = Math.floor(2 * (side - 0.5) * width) - 16;
  if (override?.y !== undefined) return { y: override.y, maxWidthPx, reason: "definido pelo operador", safe: { top, bottom, side }, blockH };
  let band = null;
  // faceBox = head bounding box (top of hair → chin). Protected band: eyes → mouth.
  if (faceBox) band = [faceBox.y + 0.35 * faceBox.h, faceBox.y + 0.7 * faceBox.h];
  const lowestCenter = bottom - blockH / 2 - 0.01;
  if (!band) return { y: round(Math.min(0.72, lowestCenter), 3), maxWidthPx, reason: "sem rosto declarado: terço inferior seguro", safe: { top, bottom, side }, blockH };
  const below = band[1] + blockH / 2 + 0.015;
  if (below <= lowestCenter) return { y: round(below, 3), maxWidthPx, reason: "abaixo da boca, dentro da área segura", safe: { top, bottom, side }, blockH, faceBand: band };
  const above = band[0] - blockH / 2 - 0.015;
  if (above - blockH / 2 >= top + 0.12) return { y: round(above, 3), maxWidthPx, reason: "acima dos olhos (sem espaço abaixo)", safe: { top, bottom, side }, blockH, faceBand: band };
  return { y: round(lowestCenter, 3), maxWidthPx, reason: "limite inferior seguro (rosto ocupa o quadro; sobreposição mínima ao queixo)", safe: { top, bottom, side }, blockH, faceBand: band };
}

const assColor = (hex, alpha = 0) => {
  const h = hex.replace("#", "");
  const [r, g, b] = [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
  return `&H${alpha.toString(16).padStart(2, "0").toUpperCase()}${b}${g}${r}`.toUpperCase();
};
// floor to the 10 ms ASS grid for both start and end: consistent (no 1-frame gaps between pages)
// and an end placed exactly on a frame never leaks into that frame
const assTime = (t) => {
  const cs = Math.max(0, Math.floor(t * 100 + 1e-6));
  return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
const escapeAss = (s) => s.replace(/\\/g, "\\\\").replace(/\{/g, "(").replace(/\}/g, ")");

/** Auto-fit scale (%): a long word must never push the page into the side controls. */
export function pageFit(p, s, placement) {
  let k = 0;
  const longest = Math.max(...p.lines.map((n) => { const t = p.words.slice(k, k + n).map((w) => w.display).join(" "); k += n; return t.length; }));
  const estW = longest * s.advanceEm * s.fontSize + 2 * s.outlineWidth;
  return placement.maxWidthPx && estW > placement.maxWidthPx ? Math.floor((placement.maxWidthPx / estW) * 100) : 100;
}

/** Keyword and active colours must differ, otherwise the keyword disappears while it is spoken. */
export function assertCaptionColors(style) {
  const s = { ...DEFAULT_CAPTION_STYLE, ...style };
  const eq = (a, b) => a.toLowerCase() === b.toLowerCase();
  if ((s.keywords ?? []).length && (eq(s.keywordColor, s.activeColor) || eq(s.keywordColor, s.color))) throw reelError(REEL_ERRORS.INPUT_INVALID, `keywordColor (${s.keywordColor}) precisa ser diferente da cor ativa e da cor do texto.`, { hint: "Defina captions.keywordColor no config." });
}

const assHeader = (s, width, height) => [
  "[Script Info]", "; MOTION Smart Captions — gerado por motion-core/reel", "ScriptType: v4.00+", `PlayResX: ${width}`, `PlayResY: ${height}`, "WrapStyle: 2", "ScaledBorderAndShadow: yes", "YCbCr Matrix: TV.709", "",
  "[V4+ Styles]",
  "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
  `Style: Caption,${s.fontFamily},${s.fontSize},${assColor(s.color)},${assColor(s.color)},${assColor(s.outlineColor)},${assColor(s.shadowColor, 0x60)},${s.fontWeight >= 600 ? -1 : 0},0,0,0,100,100,0,0,1,${s.outlineWidth},${s.shadow},5,0,0,0,1`,
  "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
];

/** Largest scale (%) the entrance animation reaches, relative to the resting size. */
export const animationPeak = (s) => Math.max(100, s.popPeak ?? 100);

/**
 * QA track: every (page, word) alone on one frame, same layout and peak animation scale, fill
 * and outline white and no shadow, so each word's real box (outline included) can be measured.
 */
export function buildWordBoxAss(pages, { width, height, styleIn = {}, placement, fps = 30 }) {
  const s = { ...DEFAULT_CAPTION_STYLE, ...styleIn, color: "#FFFFFF", outlineColor: "#FFFFFF", shadow: 0 };
  const events = [], index = [];
  const x = Math.round(width / 2);
  for (const p of pages) {
    const scale = Math.round((pageFit(p, { ...DEFAULT_CAPTION_STYLE, ...styleIn }, placement) * animationPeak(s)) / 100);
    p.words.forEach((_, i) => {
      let k = 0;
      const text = p.lines.map((n) => { const parts = []; for (let j = 0; j < n; j++, k++) parts.push(`{\\alpha${k === i ? "&H00&" : "&HFF&"}}${escapeAss(p.words[k].display)}`); return parts.join(" "); }).join("\\N");
      const f = index.length;
      index.push({ page: p.index, word: i });
      events.push(`Dialogue: 0,${assTime(f / fps)},${assTime((f + 1) / fps)},Caption,,0,0,0,,{\\an5\\pos(${x},${Math.round((p.y ?? placement.y) * height)})\\fscx${scale}\\fscy${scale}}${text}`);
    });
  }
  return { ass: assHeader(s, width, height).concat(events).join("\n") + "\n", index };
}

/**
 * Kinetic ASS: one Dialogue per (page, active word). Page entrance pop on the first state
 * only; the active word switches colour (no reflow). Times are on the 10 ms ASS grid.
 */
export function buildAss(pages, { width, height, styleIn = {}, placement }) {
  const s = { ...DEFAULT_CAPTION_STYLE, ...styleIn };
  const header = assHeader(s, width, height);
  const x = Math.round(width / 2);
  const events = [];
  for (const p of pages) {
    const y = Math.round((p.y ?? placement.y) * height);
    const words = p.words;
    for (let i = 0; i < words.length; i++) {
      const st = i === 0 ? p.start : words[i].start;
      const en = i + 1 < words.length ? words[i + 1].start : p.end;
      if (en - st < 0.01) continue;
      let k = 0;
      const lineTexts = p.lines.map((n) => {
        const parts = [];
        for (let j = 0; j < n; j++, k++) {
          const w = words[k];
          const col = w.keyword ? s.keywordColor : k === i ? s.activeColor : s.color;
          parts.push(`{\\c${assColor(col)}}${escapeAss(w.display)}`);
        }
        return parts.join(" ");
      });
      const fit = pageFit(p, s, placement);
      const base = fit < 100 ? `\\fscx${fit}\\fscy${fit}` : "";
      const intro = i === 0 && s.animation === "pop" ? `\\fscx${Math.round(fit * 0.86)}\\fscy${Math.round(fit * 0.86)}\\t(0,90,\\fscx${fit}\\fscy${fit})\\fad(60,0)` : base;
      events.push(`Dialogue: 0,${assTime(st)},${assTime(en)},Caption,,0,0,0,,{\\an5\\pos(${x},${y})${intro}}${lineTexts.join("\\N")}`);
    }
  }
  return header.concat(events).join("\n") + "\n";
}

/** Caption pages → SRT (one cue per page, original words). */
export function pagesToSrt(pages) {
  return toSrt(pages.map((p) => ({ start: p.start, end: p.end, text: p.words.map((w) => w.text).join(" ") })));
}

/** Word-level SRT (one cue per word) for tools that need it. */
export function wordsToSrt(words) {
  return toSrt(words.filter((w) => !w.suspect).map((w) => ({ start: w.start, end: w.end, text: w.text })));
}

export function captionsJson(pages, { placement, style, timelineHash = null } = {}) {
  return { schema: "motion.captions", schemaVersion: 1, timelineHash, style, placement, pages };
}

export { srtTime };
