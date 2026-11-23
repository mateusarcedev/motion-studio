/**
 * MOTION Core — reel/brief.mjs
 * Machine-readable part of BRIEF.md: one fenced block ```json motion-brief … ```.
 * Everything is optional: hook, loop and CTA are decided by the brief, never assumed.
 */
import { readFile } from "node:fs/promises";
import { normalizeWord, reelError, REEL_ERRORS, round, sha256Text } from "./util.mjs";
import { PRESETS } from "./presets.mjs";
import { applyCorrections } from "./stt/index.mjs";

export const OPENINGS = Object.freeze(["original", "strongest-line", "custom"]);
const fail = (m) => { throw reelError(REEL_ERRORS.INPUT_INVALID, `BRIEF: ${m}`, { hint: "Veja docs/REEL_EDITOR.md (bloco motion-brief)." }); };

export function parseBrief(markdown) {
  const blocks = [...String(markdown).matchAll(/^```json motion-brief[^\S\n]*\n([\s\S]*?)^```/gm)];
  if (!blocks.length) return null;
  if (blocks.length > 1) fail("mais de um bloco motion-brief");
  let b;
  try { b = JSON.parse(blocks[0][1]); } catch (e) { fail(`JSON inválido no bloco motion-brief (${e.message})`); }
  const known = ["opening", "openingText", "openingApproval", "glossary", "intent", "keywords"];
  for (const k of Object.keys(b)) if (!known.includes(k)) fail(`campo desconhecido "${k}"`);
  if (b.opening !== undefined && !OPENINGS.includes(b.opening)) fail(`opening deve ser ${OPENINGS.join(" | ")}`);
  if (b.opening === "custom" && !b.openingText) fail("opening custom exige openingText");
  if (b.glossary !== undefined && !Array.isArray(b.glossary)) fail("glossary deve ser uma lista");
  return { ...b, sha256: sha256Text(String(markdown)) };
}
export async function loadBrief(file) { return parseBrief(await readFile(file, "utf8")); }

function similarity(a, b) {
  if (!a.length || !b.length) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

/**
 * Proper-name glossary. Applies: exact spelling differences, declared aliases, and close matches
 * of words the recognizer itself was unsure about. Anything else similar is only suggested.
 */
export function applyGlossary(transcript, glossary = [], { briefSha256 = null, params = {} } = {}) {
  const P = { ...PRESETS.captions.glossary, ...params };
  const terms = glossary.map((g) => (typeof g === "string" ? { term: g, aliases: [] } : { aliases: [], ...g }));
  const corrections = [], suggestions = [], used = new Set();
  for (const g of terms.sort((a, b) => b.term.length - a.term.length)) {
    const target = normalizeWord(g.term), n = g.term.split(/\s+/).length;
    const aliases = new Set(g.aliases.map(normalizeWord));
    for (let size = n + 1; size >= Math.max(1, n - 1); size--) {
      for (let i = 0; i + size <= transcript.words.length; i++) {
        const ws = transcript.words.slice(i, i + size);
        if (ws.some((w) => used.has(w.id) || w.corrected || w.suspect)) continue;
        const heard = ws.map((w) => w.text).join(" ");
        const norm = ws.map((w) => normalizeWord(w.text)).join("");
        if (norm.length < P.minChars) continue;
        const punct = ws.at(-1).text.match(/[,.;:!?…]+$/u)?.[0] ?? "";
        const sim = round(similarity(norm, target), 3);
        const conf = Math.min(...ws.map((w) => w.confidence ?? 0));
        const alias = aliases.has(norm), exact = norm === target;
        if (exact && heard.slice(0, heard.length - punct.length) === g.term) { ws.forEach((w) => used.add(w.id)); continue; }
        if (exact && size !== n && size !== 1) continue;
        const entry = { wordIds: ws.map((w) => w.id), text: g.term + punct, heard, term: g.term, similarity: sim, confidence: round(conf, 3) };
        const apply = exact || alias || (norm[0] === target[0] && sim >= P.applySimilarity && conf < P.maxConfidence);
        if (apply) {
          const why = exact ? "grafia" : alias ? "variante declarada" : `semelhança ${sim}, confiança do ASR ${round(conf, 2)}`;
          corrections.push({ wordIds: entry.wordIds, text: entry.text, by: "glossary", reason: `glossário do BRIEF: "${heard}" → "${g.term}" (${why})`, evidence: `BRIEF.md motion-brief.glossary${briefSha256 ? ` sha256 ${briefSha256.slice(0, 16)}` : ""}` });
          ws.forEach((w) => used.add(w.id));
        } else if (sim >= P.suggestSimilarity && size === n) suggestions.push({ ...entry, start: ws[0].start, end: ws.at(-1).end });
      }
    }
  }
  const t = applyCorrections(transcript, corrections);
  return { transcript: t, corrections, suggestions: suggestions.filter((s) => !s.wordIds.some((id) => used.has(id))) };
}

const YOU = new Set(["voce", "voces", "seu", "sua", "te", "tu"]);
const TURN = new Set(["mas", "nao", "nunca", "ninguem", "se", "porque", "erro", "problema", "errado", "perde", "perder", "ganha", "melhor", "pior", "para", "tras", "unico", "verdade"]);

/** Ranks sentences as possible openings. A proposal only: nothing is reordered here. */
export function proposeOpenings(words, cfg = PRESETS.opening) {
  const sentences = [];
  let cur = [];
  words.forEach((w, i) => {
    cur.push(w);
    const gap = words[i + 1] ? words[i + 1].start - w.end : Infinity;
    if (/[.!?…]$/u.test(w.text) || gap > cfg.breakGapSec || cur.at(-1).end - cur[0].start > cfg.maxSec) { sentences.push(cur); cur = []; }
  });
  return sentences.map((ws) => {
    const sec = ws.at(-1).end - ws[0].start, toks = ws.map((w) => normalizeWord(w.text));
    const conf = ws.reduce((n, w) => n + (w.confidence ?? 1), 0) / ws.length;
    const why = [];
    let score = 0;
    if (toks.some((t) => YOU.has(t))) { score += 2; why.push("fala com quem assiste"); }
    const turns = toks.filter((t) => TURN.has(t)).length;
    if (turns) { score += Math.min(3, turns); why.push("contraste/consequência"); }
    if (/\?/.test(ws.at(-1).text)) { score += 1; why.push("pergunta"); }
    if (toks.some((t) => /\d/.test(t))) { score += 0.5; why.push("número"); }
    if (sec >= cfg.minSec && sec <= cfg.idealMaxSec) { score += 1; why.push("duração adequada"); }
    score += conf - 1;
    return { text: ws.map((w) => w.text).join(" "), src: [round(ws[0].start), round(ws.at(-1).end)], wordIds: ws.map((w) => w.id), sec: round(sec, 2), score: round(score, 2), why };
  }).filter((s) => s.sec >= cfg.minSec).sort((a, b) => b.score - a.score || a.src[0] - b.src[0]).slice(0, cfg.proposals);
}
