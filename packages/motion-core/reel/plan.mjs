/**
 * MOTION Core — reel/plan.mjs
 * Smart Cuts: turns analysis (VAD) + transcript (word timestamps) + a preset into an
 * editable timeline proposal. Cuts never intersect speech: every boundary keeps padding
 * around detected speech and recognized words. Removals beyond silence (fillers,
 * repeated phrases, operator ranges) are recorded as decisions and listed for review.
 */
import path from "node:path";
import { analyzeMedia } from "./analyze.mjs";
import { buildPages, placeCaptions, DEFAULT_CAPTION_STYLE } from "./captions.mjs";
import { computeDst, refineWordTiming, remapWords, TIMELINE_SCHEMA, TIMELINE_VERSION, timelineHash, totalFrames } from "./timeline.mjs";
import { normalizeWord, probeMedia, reelError, REEL_ERRORS, round, sha256File, ffmpegTools } from "./util.mjs";

export const EDIT_PRESETS = Object.freeze({
  "talking-head": {
    description: "Reels/Shorts falados para a câmera: ritmo enxuto, jump cuts com punch-in, legendas cinéticas.",
    cut: { removePausesLongerThan: 0.32, padBefore: 0.09, padAfter: 0.13, tailHold: 0.45, minSegment: 0.25 },
    fillers: { remove: true }, repetitions: { autoRemovePhrases: true, autoRemoveStutter: true },
    zoom: { mode: "punch", levels: [1.0, 1.12], hookLevel: 1.16, minShotSec: 0.7, easeFrames: 0, maxShotSec: 5.5, minZoomCutSec: 2.2 },
    captions: { maxWordsPerPage: 3, maxCharsPerLine: 14, maxLines: 2 }, audio: { preset: "clean" },
    faceBox: { x: 0.2, y: 0.24, w: 0.6, h: 0.42 },
  },
  tutorial: {
    description: "Tutoriais/aulas: pausas mais longas preservadas para acompanhar o raciocínio; zoom discreto.",
    cut: { removePausesLongerThan: 0.7, padBefore: 0.12, padAfter: 0.25, tailHold: 0.6, minSegment: 0.3 },
    fillers: { remove: true }, repetitions: { autoRemovePhrases: false, autoRemoveStutter: true },
    zoom: { mode: "punch", levels: [1.0, 1.06], hookLevel: 1.08, minShotSec: 2.5, easeFrames: 6 },
    captions: { maxWordsPerPage: 5, maxCharsPerLine: 20, maxLines: 2 }, audio: { preset: "clean" },
    faceBox: null,
  },
  podcast: {
    description: "Podcast/entrevista: cortes só em silêncios longos, sem punch-in automático, legendas com mais palavras.",
    cut: { removePausesLongerThan: 1.0, padBefore: 0.15, padAfter: 0.35, tailHold: 0.8, minSegment: 0.4 },
    fillers: { remove: false }, repetitions: { autoRemovePhrases: false, autoRemoveStutter: false },
    zoom: { mode: "none", levels: [1.0], hookLevel: 1.0, minShotSec: 99, easeFrames: 0 },
    captions: { maxWordsPerPage: 6, maxCharsPerLine: 22, maxLines: 2 }, audio: { preset: "natural" },
    faceBox: null,
  },
  interview: {
    description: "Entrevista em plano único: preserva respirações, punch-in leve nas respostas.",
    cut: { removePausesLongerThan: 0.6, padBefore: 0.12, padAfter: 0.22, tailHold: 0.6, minSegment: 0.3 },
    fillers: { remove: true }, repetitions: { autoRemovePhrases: false, autoRemoveStutter: true },
    zoom: { mode: "punch", levels: [1.0, 1.08], hookLevel: 1.1, minShotSec: 2, easeFrames: 0 },
    captions: { maxWordsPerPage: 4, maxCharsPerLine: 18, maxLines: 2 }, audio: { preset: "natural" },
    faceBox: null,
  },
});

export function listEditPresets() {
  return Object.entries(EDIT_PRESETS).map(([id, p]) => ({ id, description: p.description, removePausesLongerThan: p.cut.removePausesLongerThan, zoom: p.zoom.mode, voicePreset: p.audio.preset }));
}

const FILLERS = new Set(["ahn", "ah", "eh", "ehh", "ee", "hum", "hmm", "hm", "uhm", "um", "uh", "ha", "han", "aham", "er", "erm"]);

function union(ranges) {
  const r = ranges.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [a, b] of r) { const last = out.at(-1); if (last && a <= last[1] + 1e-6) last[1] = Math.max(last[1], b); else out.push([a, b]); }
  return out;
}
function subtract(base, cuts) {
  let out = base.map((r) => [...r]);
  for (const [a, b] of union(cuts)) {
    const next = [];
    for (const [x, y] of out) {
      if (b <= x || a >= y) { next.push([x, y]); continue; }
      if (a > x) next.push([x, a]);
      if (b < y) next.push([b, y]);
    }
    out = next;
  }
  return out;
}

/** Adjacent repeated n-grams (n ≥ 2 → false start; n = 1 run of 2 → stutter; run ≥ 3 → emphasis). */
export function findRepetitions(words) {
  const norm = words.map((w) => normalizeWord(w.text));
  const found = [];
  const used = new Set();
  for (let n = 5; n >= 1; n--) {
    for (let i = 0; i + 2 * n <= words.length; i++) {
      if (used.has(i)) continue;
      let same = true;
      for (let k = 0; k < n; k++) if (!norm[i + k] || norm[i + k] !== norm[i + n + k]) { same = false; break; }
      if (!same) continue;
      if (n === 1) {
        let run = 2;
        while (i + run < words.length && norm[i + run] === norm[i]) run++;
        if (norm[i].length < 2) continue;
        found.push({ kind: run >= 3 ? "emphasis" : "stutter", n, run, from: i, firstEnd: i + run - 2, text: words.slice(i, i + run).map((w) => w.text).join(" ") });
        for (let k = 0; k < run; k++) used.add(i + k);
        i += run - 1;
      } else {
        found.push({ kind: "phrase", n, run: 2, from: i, firstEnd: i + n - 1, text: words.slice(i, i + 2 * n).map((w) => w.text).join(" ") });
        for (let k = 0; k < 2 * n; k++) used.add(i + k);
        i += 2 * n - 1;
      }
    }
  }
  return found.sort((a, b) => a.from - b.from);
}

/** Same opening (≥ 3 words) of two transcript segments within 45 s → possible restart. */
export function findRestarts(transcript, words) {
  const out = [];
  const byId = new Map(words.map((w, i) => [w.id, i]));
  const opens = transcript.segments.map((s) => ({ s, ids: s.wordIds.filter((id) => byId.has(id)) })).filter((x) => x.ids.length >= 3);
  for (let i = 0; i < opens.length; i++) for (let j = i + 1; j < opens.length; j++) {
    const a = opens[i].ids.slice(0, 4).map((id) => normalizeWord(words[byId.get(id)].text));
    const b = opens[j].ids.slice(0, 4).map((id) => normalizeWord(words[byId.get(id)].text));
    let k = 0; while (k < Math.min(a.length, b.length) && a[k] === b[k]) k++;
    if (k >= 3 && opens[j].s.start - opens[i].s.start <= 45) out.push({ first: [opens[i].s.start, opens[i].s.end], later: [opens[j].s.start, opens[j].s.end], opening: a.slice(0, k).join(" ") });
  }
  return out;
}

function snapRangeToWords(a, b, words, pads) {
  let s = a, e = b;
  for (const w of words) {
    if (w.start < s && w.end > s) s = w.start;
    if (w.start < e && w.end > e) e = w.end;
  }
  return [Math.max(0, s - pads.padBefore), e + pads.padAfter];
}

/** Matches a phrase (normalized tokens) in dst words; returns the first word index or -1. */
export function findPhrase(words, phrase, from = 0) {
  const target = String(phrase).split(/\s+/).map(normalizeWord).filter(Boolean);
  if (!target.length) return -1;
  for (let i = from; i + target.length <= words.length; i++) {
    let ok = true;
    for (let k = 0; k < target.length; k++) if (normalizeWord(words[i + k].text) !== target[k]) { ok = false; break; }
    if (ok) return i;
  }
  return -1;
}

function resolveAnchor(at, dstWords, segments, fallback = null) {
  if (!at) return fallback;
  if (at.dst !== undefined) return { t: Number(at.dst), how: "dst" };
  if (at.src !== undefined) {
    for (const s of segments) if (at.src >= s.src[0] && at.src <= s.src[1]) return { t: s.dst[0] + (at.src - s.src[0]), how: "src" };
    return null;
  }
  if (at.word) { const w = dstWords.find((x) => x.id === at.word); return w ? { t: w.start, how: "word", word: w.id } : null; }
  if (at.match) { const i = findPhrase(dstWords, at.match); return i >= 0 ? { t: dstWords[i].start, how: "match", word: dstWords[i].id, endWordIdx: i } : null; }
  return fallback;
}

/**
 * Builds a motion.timeline@1 proposal.
 * options: preset, output{width,height,fps}, faceBox, exclude:[[a,b]], hook:[a,b], overlays:[...],
 *   transitions:[{after, kind, frames}], captions{...style}, audio{preset, overrides, music}, keywords,
 *   removeRepetitions:boolean override, platform
 */
export async function planEdit(sourcePath, { analysis = null, transcript = null, preset = "talking-head", ...opt } = {}) {
  const P = EDIT_PRESETS[preset];
  if (!P) throw reelError(REEL_ERRORS.INPUT_INVALID, `Preset de edição desconhecido: ${preset}`, { hint: `Use: ${Object.keys(EDIT_PRESETS).join(", ")}` });
  const probe = await probeMedia(sourcePath);
  if (!probe.video) throw reelError(REEL_ERRORS.INPUT_INVALID, "A fonte não tem vídeo; use motion edit audio para tratar só a voz.");
  const sha256 = await sha256File(sourcePath);
  analysis ??= await analyzeMedia(sourcePath);
  if (analysis.source.sha256 !== sha256) throw reelError(REEL_ERRORS.SOURCE_CHANGED, "A análise pertence a outro arquivo (SHA-256 diferente).");
  const dur = probe.durationSec;
  const fps = opt.output?.fps ?? 30;
  const cut = { ...P.cut, ...(opt.cut ?? {}) };
  const decisions = [];
  const review = [];
  const warnings = [];

  // transcript usable only when it belongs to this exact file
  let words = [];
  let transcriptInfo = null;
  if (transcript) {
    const applies = transcript.source?.sha256 === sha256;
    if (!applies) {
      warnings.push(`Transcrição ignorada: pertence a outro arquivo (${transcript.source?.path ?? "origem desconhecida"}). Uma legenda de referência não é transcrição do bruto.`);
    } else {
      words = transcript.words.filter((w) => !w.suspect);
      transcriptInfo = { provider: transcript.provider, language: transcript.language, languageProbability: transcript.languageProbability, scope: transcript.scope, coverage: transcript.coverage, corrections: transcript.corrections ?? [], words: transcript.words, segments: transcript.segments.map(({ wordIds, ...s }) => ({ ...s, wordIds })) };
      if (transcript.scope !== "full-media") warnings.push("Transcrição não é de reconhecimento completo (legenda importada): tempos por palavra interpolados.");
    }
  } else warnings.push("Sem transcrição: cortes só por energia (VAD) e legendas desativadas. Rode motion edit transcribe.");

  const speech = analysis.audio?.speech ?? [];
  const pads = { padBefore: cut.padBefore, padAfter: cut.padAfter };
  // protected = speech energy (VAD), padded. Recognizer word ends often spill into silence,
  // so words only add protection where the VAD saw no energy (soft speech the VAD missed).
  const vadPadded = speech.map((s) => [s.start - cut.padBefore, s.end + cut.padAfter]);
  const unseenWords = words.filter((w) => !speech.some((s) => s.end > w.start && s.start < w.end));
  const protectedRanges = union([
    ...vadPadded,
    ...unseenWords.map((w) => [w.start - cut.padBefore, w.end + cut.padAfter]),
  ].map(([a, b]) => [Math.max(0, a), Math.min(dur, b)]));
  if (unseenWords.length) review.push({ src: [unseenWords[0].start, unseenWords.at(-1).end], reason: `${unseenWords.length} palavra(s) reconhecida(s) sem energia de fala detectada — protegidas por segurança`, by: "engine" });

  const removals = [];
  // leading/trailing silence and long pauses between protected ranges
  if (protectedRanges.length) {
    if (protectedRanges[0][0] > 0.02) removals.push({ src: [0, protectedRanges[0][0]], reason: "leading-silence", confidence: 1 });
    for (let i = 0; i + 1 < protectedRanges.length; i++) {
      const gapStart = protectedRanges[i][1], gapEnd = protectedRanges[i + 1][0];
      const pause = gapEnd - gapStart + cut.padBefore + cut.padAfter;
      if (pause > cut.removePausesLongerThan && gapEnd - gapStart > 1 / fps) removals.push({ src: [gapStart, gapEnd], reason: "pause", confidence: 0.95, pauseSec: round(pause, 3) });
    }
    const tailStart = Math.min(dur, protectedRanges.at(-1)[1] + Math.max(0, cut.tailHold - cut.padAfter));
    if (dur - tailStart > 0.02) removals.push({ src: [tailStart, dur], reason: "trailing-silence", confidence: 1 });
  }

  // fillers (only with true word timing)
  const fillerCfg = { ...P.fillers, ...(opt.fillers ?? {}) };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!FILLERS.has(normalizeWord(w.text))) continue;
    const gapBefore = i ? w.start - words[i - 1].end : 1, gapAfter = i + 1 < words.length ? words[i + 1].start - w.end : 1;
    const isolated = gapBefore >= 0.1 && gapAfter >= 0.1;
    if (fillerCfg.remove && w.timing === "word" && isolated) {
      removals.push({ src: [w.start - 0.02, w.end + 0.02], reason: "filler", confidence: 0.8, text: w.text, needsReview: true });
      decisions.push({ what: `remover hesitação "${w.text}" em ${w.start}s`, why: "hesitação isolada por pausas", by: "engine" });
    } else review.push({ src: [w.start, w.end], reason: `possível hesitação "${w.text}" mantida`, by: "engine" });
  }

  // repetitions
  const repCfg = { ...P.repetitions, ...(opt.repetitions ?? {}) };
  if (opt.removeRepetitions !== undefined) repCfg.autoRemovePhrases = repCfg.autoRemoveStutter = Boolean(opt.removeRepetitions);
  for (const r of findRepetitions(words)) {
    const a = words[r.from].start, b = words[r.firstEnd + 1].start; // remove first occurrence up to the repeat
    const auto = (r.kind === "phrase" && repCfg.autoRemovePhrases) || (r.kind === "stutter" && repCfg.autoRemoveStutter);
    if (r.kind === "emphasis") { review.push({ src: [a, words[r.from + r.run - 1].end], reason: `repetição enfática mantida: "${r.text}"`, by: "engine" }); continue; }
    if (auto) {
      removals.push({ src: [a - 0.01, b - 0.01], reason: r.kind === "phrase" ? "repeated-phrase" : "stutter", confidence: 0.75, text: r.text, needsReview: true });
      decisions.push({ what: `remover primeira ocorrência de "${words.slice(r.from, r.firstEnd + 1).map((w) => w.text).join(" ")}" (${round(a, 2)}–${round(b, 2)}s)`, why: r.kind === "phrase" ? "frase repetida em sequência (falso começo)" : "gagueira", by: "engine" });
      review.push({ src: [a, b], reason: `confirmar remoção da repetição: "${r.text}"`, by: "engine" });
    } else review.push({ src: [a, b], reason: `repetição detectada (mantida): "${r.text}"`, by: "engine" });
  }
  if (transcript && words.length) for (const r of findRestarts(transcript, words)) review.push({ src: r.first, reason: `possível recomeço: "${r.opening}…" também começa em ${r.later[0]}s — avalie excluir uma das tomadas`, by: "engine" });

  // operator ranges
  for (const [a, b] of opt.exclude ?? []) {
    const [s, e] = words.length ? snapRangeToWords(a, b, words, { padBefore: 0, padAfter: 0 }) : [a, b];
    removals.push({ src: [s, e], reason: "operator", confidence: 1, requested: [a, b] });
    decisions.push({ what: `excluir ${round(s, 2)}–${round(e, 2)}s`, why: opt.excludeReasons?.[`${a}-${b}`] ?? "decisão do operador", by: "operator" });
  }

  // kept = complement, then trim each kept range to its own speech (normalizes boundaries)
  let kept = subtract([[0, dur]], removals.map((r) => r.src));
  const speechish = union([...speech.map((s) => [s.start, s.end]), ...unseenWords.map((w) => [w.start, w.end])]);
  kept = kept.map(([a, b]) => {
    const inside = speechish.filter(([x, y]) => y > a && x < b);
    if (!inside.length) return null;
    return [Math.max(a, inside[0][0] - cut.padBefore), Math.min(b, inside.at(-1)[1] + cut.padAfter)];
  }).filter(Boolean);
  // the last kept range keeps the tail hold
  if (kept.length) kept[kept.length - 1][1] = Math.min(dur, Math.max(kept.at(-1)[1], (speechish.at(-1)?.[1] ?? 0) + cut.tailHold));

  // hook (moved to the front)
  let hookRange = null;
  if (opt.hook) {
    hookRange = words.length ? snapRangeToWords(opt.hook[0], opt.hook[1], words, pads) : [...opt.hook];
    hookRange = [Math.max(0, hookRange[0]), Math.min(dur, hookRange[1])];
    kept = subtract(kept, [hookRange]);
    decisions.push({ what: `gancho: ${round(hookRange[0], 2)}–${round(hookRange[1], 2)}s abre o vídeo`, why: opt.hookReason ?? "frase mais forte como abertura", by: "operator" });
  }

  // frame grid: expand outward (never shave speech), drop slivers without speech
  const toGrid = ([a, b]) => [Math.floor(a * fps + 1e-6) / fps, Math.min(Math.ceil(b * fps - 1e-6) / fps, Math.floor(dur * fps) / fps)];
  let ranges = kept.map(toGrid);
  ranges = union(ranges).filter(([a, b]) => b - a >= Math.max(2 / fps, cut.minSegment) || speechish.some(([x, y]) => y > a && x < b));
  if (hookRange) ranges.unshift(toGrid(hookRange));
  if (!ranges.length) throw reelError(REEL_ERRORS.INPUT_INVALID, "Nenhum trecho com fala foi encontrado para manter.", { hint: "Confira se o áudio tem fala audível ou ajuste --cut." });

  // segments + zoom plan. Long shots get "zoom cuts": contiguous splits (no time removed)
  // at phrase boundaries, so framing can change without touching the audio.
  const zoomCfg = { ...P.zoom, ...(opt.zoom ?? {}) };
  const faceBox = opt.faceBox ?? P.faceBox ?? null;
  const refinedWords = refineWordTiming(words, speech);
  const pieces = [];
  ranges.forEach(([a, b], i) => {
    const isHook = Boolean(hookRange) && i === 0;
    if (zoomCfg.mode === "none" || !zoomCfg.maxShotSec || b - a <= zoomCfg.maxShotSec || !refinedWords.length) { pieces.push({ src: [a, b], hook: isHook, zoomCut: false }); return; }
    const inside = refinedWords.filter((w) => w.start >= a && w.end <= b);
    const cands = [];
    for (let k = 0; k + 1 < inside.length; k++) {
      const gap = inside[k + 1].start - inside[k].end;
      const punct = /[,.;:!?]$/.test(inside[k].text);
      if (gap >= 0.06 || punct) cands.push({ t: Math.round(((inside[k].end + inside[k + 1].start) / 2) * fps) / fps, score: gap + (punct ? 0.3 : 0) });
    }
    let start = a;
    while (b - start > zoomCfg.maxShotSec) {
      const ok = cands.filter((c) => c.t - start >= zoomCfg.minZoomCutSec && c.t - start <= zoomCfg.maxShotSec && b - c.t >= zoomCfg.minZoomCutSec);
      if (!ok.length) break;
      const best = ok.reduce((m, c) => (c.score > m.score ? c : m));
      pieces.push({ src: [start, best.t], hook: isHook && start === a, zoomCut: start !== a });
      start = best.t;
    }
    pieces.push({ src: [start, b], hook: isHook && start === a, zoomCut: start !== a });
  });
  const segments = pieces.map((p, i) => ({ id: `s${String(i + 1).padStart(2, "0")}`, src: p.src, reason: p.hook ? "hook" : "speech", zoomCut: p.zoomCut }));
  computeDst(segments, fps);
  let level = 0;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i], prev = segments[i - 1];
    const jump = prev && Math.abs(s.src[0] - prev.src[1]) > 1.5 / fps;
    let z = zoomCfg.levels[0];
    if (zoomCfg.mode !== "none") {
      if (s.reason === "hook") z = zoomCfg.hookLevel;
      else {
        if ((jump || s.zoomCut) && (s.dst[1] - s.dst[0]) >= zoomCfg.minShotSec && zoomCfg.levels.length > 1) level = (level + 1) % zoomCfg.levels.length;
        z = zoomCfg.levels[level];
      }
    }
    s.cutBefore = Boolean(jump);
    s.zoom = { from: z, to: zoomCfg.mode === "drift" ? round(z * 1.04, 3) : z, cx: faceBox ? round(faceBox.x + faceBox.w / 2, 3) : 0.5, cy: faceBox ? round(faceBox.y + faceBox.h * 0.45, 3) : 0.45, easeInFrames: jump ? zoomCfg.easeFrames : 0 };
  }
  // operator emphasis: [{match:"ficando para trás", zoom:1.2}] sets the zoom of the shot holding that phrase
  for (const e of opt.emphasis ?? []) {
    const idx = findPhrase(refinedWords, e.match);
    if (idx < 0) { warnings.push(`Ênfase "${e.match}" não encontrada na transcrição.`); continue; }
    const t = refinedWords[idx].start;
    const seg = segments.find((s) => t >= s.src[0] && t < s.src[1]);
    if (seg) { seg.zoom.from = seg.zoom.to = e.zoom; seg.emphasis = e.match; decisions.push({ what: `ênfase (zoom ${e.zoom}) em "${e.match}"`, why: e.why ?? "frase-chave", by: "operator" }); }
  }
  const frames = totalFrames(segments);
  const outDur = round(frames / fps, 6);

  // words → dst, losses accounted
  const removedByDecision = removals.filter((r) => ["filler", "repeated-phrase", "stutter", "operator"].includes(r.reason)).map((r) => r.src);
  const { words: dstWords, lost } = remapWords(refinedWords, segments, { excluded: removedByDecision });
  const inDecision = (w) => removedByDecision.some(([a, b]) => Math.max(0, Math.min(w.end, b) - Math.max(w.start, a)) >= 0.5 * Math.max(1e-6, w.end - w.start));
  const unexpectedLost = lost.filter((w) => !inDecision(w));
  for (const w of unexpectedLost) review.push({ src: [w.start, w.end], reason: `palavra "${w.text}" ficou fora da edição sem decisão explícita`, by: "engine", severity: "high" });
  for (const w of dstWords) if (w.confidence !== null && w.confidence !== undefined && w.confidence < 0.5 && !w.corrected) review.push({ src: [w.srcStart, w.srcEnd], dst: [w.start, w.end], reason: `baixa confiança no reconhecimento: "${w.text}" (${round(w.confidence, 2)})`, by: "engine" });
  if (words.length) for (const s of speech) {
    const covered = words.some((w) => w.end > s.start && w.start < s.end);
    if (!covered && s.end - s.start >= 0.5) review.push({ src: [s.start, s.end], reason: "fala detectada sem palavras transcritas (lacuna do STT)", by: "engine" });
  }

  // captions
  const capStyle = { ...DEFAULT_CAPTION_STYLE, ...P.captions, ...(opt.captions ?? {}), keywords: opt.keywords ?? opt.captions?.keywords ?? [] };
  const width = opt.output?.width ?? 1080, height = opt.output?.height ?? 1920;
  const placement = placeCaptions({ width, height, faceBox, platform: capStyle.platform, lines: capStyle.maxLines, fontSize: capStyle.fontSize, override: opt.captions?.position });
  const pages = dstWords.length ? buildPages(dstWords, capStyle) : [];

  // overlays (cards/titles/CTA) anchored to words
  const overlays = [];
  for (const [i, o] of (opt.overlays ?? []).entries()) {
    const anchor = resolveAnchor(o.at, dstWords, segments, { t: 0, how: "default" });
    if (!anchor) { warnings.push(`Overlay ${o.id ?? i + 1}: âncora não encontrada (${JSON.stringify(o.at)}); não incluído.`); continue; }
    let start = Math.max(0, anchor.t - (o.leadSec ?? 0.1));
    let end = o.until ? (resolveAnchor(o.until, dstWords, segments)?.t ?? start + (o.durationSec ?? 2.5)) : start + (o.durationSec ?? 2.5);
    if (o.kind === "cta" && o.at?.dst === undefined && !o.at) start = Math.max(0, outDur - (o.durationSec ?? 2.5));
    end = Math.min(outDur, end);
    start = Math.round(start * fps) / fps; end = Math.round(end * fps) / fps;
    if (end - start < 0.5) { warnings.push(`Overlay ${o.id ?? i + 1}: menos de 0,5 s na tela; não incluído.`); continue; }
    const steps = (o.steps ?? []).map((st) => { const a = resolveAnchor(st.at, dstWords, segments); return { ...st, dst: a ? Math.max(start, Math.round(a.t * fps) / fps) : null }; });
    overlays.push({ ...o, id: o.id ?? `ov${String(i + 1).padStart(2, "0")}`, dst: [round(start, 6), round(end, 6)], anchor, steps: steps.length ? steps : undefined });
  }

  const tools = await ffmpegTools();
  const timeline = {
    schema: TIMELINE_SCHEMA, schemaVersion: TIMELINE_VERSION,
    preset,
    source: { path: path.resolve(sourcePath), sha256, bytes: probe.bytes, durationSec: dur, probe: { video: probe.video, audio: probe.audio, container: probe.container } },
    output: { width, height, fps, durationSec: outDur, frames, aspect: `${width}:${height}` },
    framing: { faceBox, faceBoxSource: opt.faceBox ? (opt.faceBoxSource ?? "operator") : P.faceBox ? "preset-default" : null, reframe: "cover" },
    segments,
    removed: union(removals.map((r) => r.src)).length ? removals.map((r) => ({ ...r, src: [round(Math.max(0, r.src[0]), 3), round(Math.min(dur, r.src[1]), 3)] })) : [],
    transcript: transcriptInfo,
    audio: { preset: opt.audio?.preset ?? P.audio.preset, overrides: opt.audio?.overrides ?? {}, denoiser: opt.audio?.denoiser ?? "auto", music: opt.audio?.music ?? null },
    captions: { enabled: pages.length > 0 && opt.captions?.enabled !== false, style: capStyle, placement, pages, words: dstWords, fontsDir: opt.captions?.fontsDir ?? null },
    overlays,
    overlayStyle: opt.overlayStyle ?? null,
    transitions: opt.transitions ?? [],
    export: {
      video: { codec: "libx264", profile: "high", pixFmt: "yuv420p", crf: 18, preset: "medium", gop: fps * 2, colorPrimaries: "bt709" },
      audio: { codec: "aac", bitrate: "192k", sampleRate: 48000, channels: 2 },
      preview: { width: Math.round(width / 2 / 2) * 2, height: Math.round(height / 2 / 2) * 2, crf: 28, preset: "veryfast" },
      loudness: { targetLufs: -14, truePeakDb: -1.5 },
    },
    stats: {
      sourceSec: dur, outputSec: outDur, removedSec: round(dur - outDur, 3), cuts: segments.filter((s) => s.cutBefore).length, zoomCuts: segments.filter((s) => s.zoomCut).length,
      wordsKept: dstWords.length, wordsRemovedByDecision: lost.length - unexpectedLost.length, wordsLostUnexpected: unexpectedLost.length,
    },
    review, decisions, warnings,
    provenance: { engine: "motion-core/reel", engineVersion: "1.1.1+reel", ffmpeg: tools.version, analysisSchema: analysis.schema, transcriptProvider: transcriptInfo?.provider?.id ?? null },
  };
  timeline.hash = timelineHash(timeline);
  return timeline;
}
