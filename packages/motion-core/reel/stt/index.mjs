/**
 * MOTION Core — reel/stt/index.mjs
 * Agent-agnostic Speech-to-Text with a provider interface.
 *
 *   provider = { id, kind: "local"|"cloud"|"import", implemented, describe(),
 *                available(opts) -> {ok, reason, details}, transcribe(media, opts) -> raw }
 *
 * Every provider result is normalized into `motion.transcript@1` (words with timestamps,
 * language, confidence, silences, coverage, provenance). The engine never depends on an
 * agent's multimodal ability: transcription runs from the CLI or the programmatic API.
 *
 * Implemented: faster-whisper (local, isolated venv), srt-import (SRT/VTT, scoped to the
 * media it belongs to). Declared but not implemented: whisper-cpp, openai, gemini — they
 * report `implemented:false` and are never silently substituted.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lastJsonObject, normalizeWord, probeMedia, reelError, REEL_ERRORS, round, run, sha256File } from "../util.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const FASTER_WHISPER_WORKER = path.join(here, "faster_whisper_worker.py");
export const TRANSCRIPT_SCHEMA = "motion.transcript";
export const PINNED_FASTER_WHISPER = "1.2.1";

export function sttHome() {
  return process.env.MOTION_STT_HOME || path.join(os.homedir(), ".local", "share", "motion", "stt");
}
export function sttPython() {
  if (process.env.MOTION_STT_PYTHON) return process.env.MOTION_STT_PYTHON;
  const venv = path.join(sttHome(), "venv");
  return process.platform === "win32" ? path.join(venv, "Scripts", "python.exe") : path.join(venv, "bin", "python");
}
export function sttModelsDir() {
  return process.env.MOTION_STT_MODELS || path.join(sttHome(), "models");
}

/** Shell commands that create the isolated environment. Printed, never run without consent. */
export function setupCommands({ model = "small" } = {}) {
  const home = sttHome();
  const py = sttPython();
  return [
    `# ambiente isolado (fora do repositório)`,
    `uv venv --python python3 "${path.join(home, "venv")}"   # ou: python3 -m venv "${path.join(home, "venv")}"`,
    `uv pip install --python "${py}" faster-whisper==${PINNED_FASTER_WHISPER}   # ou: "${py}" -m pip install faster-whisper==${PINNED_FASTER_WHISPER}`,
    `# baixa o modelo (${model}) uma vez para o cache local`,
    `"${py}" "${FASTER_WHISPER_WORKER}" --probe --model ${model} --models-dir "${sttModelsDir()}" --download`,
  ];
}

// ---------------------------------------------------------------- providers

const fasterWhisper = {
  id: "faster-whisper", kind: "local", implemented: true,
  describe: () => "faster-whisper (CTranslate2) local; padrão: modelo small multilíngue, CPU, INT8; timestamps por palavra.",
  async available({ model = "small" } = {}) {
    const py = sttPython();
    if (!process.env.MOTION_STT_PYTHON && !existsSync(py)) return { ok: false, reason: `ambiente Python isolado não encontrado (${py})`, hint: "motion stt setup" };
    const r = await run(py, [FASTER_WHISPER_WORKER, "--probe", "--model", model, "--models-dir", sttModelsDir()], { timeoutMs: 60000 });
    const j = lastJsonObject(r.stdout);
    if (!j || j.status !== "OK") return { ok: false, reason: j?.error?.message ?? (r.error ? r.error.message : r.stderr.trim().split("\n").at(-1) || "worker falhou"), hint: j?.error?.hint ?? "motion stt setup" };
    if (!j.modelCached) return { ok: false, reason: `modelo '${model}' não está no cache local (${sttModelsDir()})`, hint: `motion stt setup --model ${model}`, details: j };
    return { ok: true, details: j };
  },
  async transcribe(media, { model = "small", computeType = "int8", device = "cpu", language = null, beamSize = 5, hotwords = null, initialPrompt = null, threads = 0, start = null, duration = null, timeoutMs = 0 } = {}) {
    const args = [FASTER_WHISPER_WORKER, media, "--model", model, "--compute-type", computeType, "--device", device, "--beam-size", String(beamSize), "--models-dir", sttModelsDir()];
    if (language) args.push("--language", language);
    if (hotwords) args.push("--hotwords", Array.isArray(hotwords) ? hotwords.join(", ") : hotwords);
    if (initialPrompt) args.push("--initial-prompt", initialPrompt);
    if (threads) args.push("--threads", String(threads));
    if (start !== null) args.push("--start", String(start));
    if (duration !== null) args.push("--duration", String(duration));
    const r = await run(sttPython(), args, { timeoutMs, env: { HF_HUB_OFFLINE: process.env.MOTION_STT_ALLOW_DOWNLOAD ? "0" : "1" } });
    const j = lastJsonObject(r.stdout);
    if (r.error) throw reelError(REEL_ERRORS.STT_UNAVAILABLE, `Python do STT não executou: ${r.error.message}`, { hint: "motion stt setup", exitCode: 3 });
    if (!j) throw reelError(REEL_ERRORS.STT_FAILED, "O worker do faster-whisper não devolveu JSON.", { details: r.stderr.trim().split("\n").slice(-3).join(" ") });
    if (j.status !== "OK") throw reelError(j.error?.code === "MOTION_STT_UNAVAILABLE" ? REEL_ERRORS.STT_UNAVAILABLE : REEL_ERRORS.STT_FAILED, j.error?.message ?? "falha na transcrição", { hint: j.error?.hint, exitCode: j.error?.code === "MOTION_STT_UNAVAILABLE" ? 3 : 2 });
    return j;
  },
};

function notImplemented(id, kind, what) {
  return {
    id, kind, implemented: false,
    describe: () => `${what} — interface reservada; não implementado nesta versão.`,
    async available() { return { ok: false, reason: "provedor declarado, ainda não implementado", hint: "Use --provider=faster-whisper ou contribua o adaptador (docs/SPEECH_TO_TEXT.md)." }; },
    async transcribe() { throw reelError(REEL_ERRORS.STT_PROVIDER_NOT_IMPLEMENTED, `Provedor STT '${id}' ainda não está implementado.`, { hint: "Use --provider=faster-whisper.", exitCode: 3 }); },
  };
}

const PROVIDERS = new Map();
export function registerSttProvider(provider) {
  for (const k of ["id", "kind", "available", "transcribe"]) if (!provider?.[k]) throw new TypeError(`provedor STT inválido: falta ${k}`);
  PROVIDERS.set(provider.id, { implemented: true, describe: () => provider.id, ...provider });
  return provider;
}
registerSttProvider(fasterWhisper);
registerSttProvider(notImplemented("whisper-cpp", "local", "whisper.cpp (binário whisper-cli)"));
registerSttProvider(notImplemented("openai", "cloud", "OpenAI Speech-to-Text (requer OPENAI_API_KEY e consentimento de envio)"));
registerSttProvider(notImplemented("gemini", "cloud", "Gemini API (requer GEMINI_API_KEY e consentimento de envio)"));

export function listSttProviders() {
  return [...PROVIDERS.values()].map((p) => ({ id: p.id, kind: p.kind, implemented: p.implemented !== false, description: p.describe() }));
}
export function getSttProvider(id) {
  const p = PROVIDERS.get(id);
  if (!p) throw reelError(REEL_ERRORS.STT_UNAVAILABLE, `Provedor STT desconhecido: ${id}`, { hint: `Disponíveis: ${[...PROVIDERS.keys()].join(", ")}` });
  return p;
}
export async function sttDoctor(opts = {}) {
  const out = [];
  for (const p of PROVIDERS.values()) out.push({ id: p.id, kind: p.kind, implemented: p.implemented !== false, ...(await p.available(opts)) });
  return { python: sttPython(), modelsDir: sttModelsDir(), providers: out };
}

// ---------------------------------------------------------------- normalization

/** Silences = gaps between consecutive words (plus leading/trailing), ≥ minSilence seconds. */
export function deriveSilences(words, durationSec, { minSilence = 0.25 } = {}) {
  const out = [];
  let cursor = 0;
  for (const w of words) {
    if (w.start - cursor >= minSilence) out.push({ start: round(cursor), end: round(w.start), duration: round(w.start - cursor), kind: cursor === 0 ? "leading" : "gap" });
    cursor = Math.max(cursor, w.end);
  }
  if (durationSec && durationSec - cursor >= minSilence) out.push({ start: round(cursor), end: round(durationSec), duration: round(durationSec - cursor), kind: "trailing" });
  return out;
}

/** Longest run of the same normalized token (repetition-loop hallucination signal). */
export function longestRepeatRun(texts) {
  let best = { word: null, run: 0, at: -1 }, cur = 0;
  for (let i = 0; i < texts.length; i++) {
    cur = i && normalizeWord(texts[i]) === normalizeWord(texts[i - 1]) ? cur + 1 : 1;
    if (cur > best.run) best = { word: normalizeWord(texts[i]), run: cur, at: i - cur + 1 };
  }
  return best;
}

export function normalizeFasterWhisper(raw, { source, lowConfidence = 0.5, maxRepeat = 6 } = {}) {
  const words = [];
  const segments = [];
  raw.segments.forEach((s, si) => {
    const ids = [];
    for (const w of s.words) {
      const text = w.text.trim();
      if (!text) continue;
      const id = `w${String(words.length + 1).padStart(4, "0")}`;
      words.push({ id, text, start: w.start, end: Math.max(w.end, w.start + 0.02), confidence: w.probability, timing: "word", segment: si });
      ids.push(id);
    }
    segments.push({ index: si, start: s.start, end: s.end, text: s.text, avgLogprob: s.avgLogprob, noSpeechProb: s.noSpeechProb, compressionRatio: s.compressionRatio, wordIds: ids });
  });
  const duration = raw.durationSec;
  const covered = words.length ? words.at(-1).end - words[0].start : 0;
  const warnings = [];
  const loopReview = [];
  for (const seg of segments) {
    const segWords = seg.wordIds.map((id) => words.find((w) => w.id === id));
    const rep = longestRepeatRun(segWords.map((w) => w.text));
    if (rep.run > maxRepeat || seg.compressionRatio > 2.4) {
      seg.hallucinationSuspected = true;
      warnings.push(`Segmento ${seg.start}-${seg.end}s: possível alucinação em loop ("${rep.word}" ×${rep.run}, compressão ${seg.compressionRatio}). Palavras marcadas para revisão; não use como legenda sem ouvir.`);
      for (const w of segWords.slice(rep.at + 1, rep.at + rep.run)) { w.suspect = true; loopReview.push({ wordId: w.id, text: w.text, start: w.start, end: w.end, confidence: w.confidence, reason: "repetição em loop (suspeita de alucinação)" }); }
    }
  }
  return {
    schema: TRANSCRIPT_SCHEMA, schemaVersion: 1,
    provider: { id: "faster-whisper", model: raw.model, versions: raw.versions, decoding: raw.decoding, timing: { loadSec: raw.loadSec, transcribeSec: raw.transcribeSec } },
    source: source ?? null,
    scope: "full-media",
    language: raw.language, languageProbability: raw.languageProbability, durationSec: duration,
    words, segments,
    silences: deriveSilences(words, duration),
    coverage: { fromSec: words[0]?.start ?? null, toSec: words.at(-1)?.end ?? null, ratio: round(covered / Math.max(0.001, duration), 3) },
    review: [...words.filter((w) => w.confidence < lowConfidence && !w.suspect).map((w) => ({ wordId: w.id, text: w.text, start: w.start, end: w.end, confidence: w.confidence, reason: "baixa confiança do reconhecimento" })), ...loopReview],
    corrections: [],
    warnings,
  };
}

/**
 * Transcribes a media file with a provider and returns motion.transcript@1.
 * The source file is only read (hash recorded before and after).
 */
export async function transcribeMedia(media, { provider = "faster-whisper", ...opts } = {}) {
  const p = getSttProvider(provider);
  if (p.implemented === false) return p.transcribe(media, opts); // throws NOT_IMPLEMENTED
  const probe = await probeMedia(media);
  if (!probe.audio) throw reelError(REEL_ERRORS.INPUT_INVALID, "A mídia não tem faixa de áudio para transcrever.");
  const sha256 = await sha256File(media);
  const avail = await p.available(opts);
  if (!avail.ok) throw reelError(REEL_ERRORS.STT_UNAVAILABLE, `STT '${provider}' indisponível: ${avail.reason}`, { hint: avail.hint, exitCode: 3 });
  const raw = await p.transcribe(media, opts);
  const after = await sha256File(media);
  if (after !== sha256) throw reelError(REEL_ERRORS.SOURCE_CHANGED, "O arquivo de origem mudou durante a transcrição.");
  const transcript = provider === "faster-whisper" ? normalizeFasterWhisper(raw, { source: { path: path.resolve(media), sha256, durationSec: probe.durationSec } }) : raw;
  if (Math.abs((transcript.durationSec ?? probe.durationSec) - probe.durationSec) > 0.5) transcript.warnings.push(`Duração decodificada (${transcript.durationSec}s) difere do container (${probe.durationSec}s).`);
  return transcript;
}

// ---------------------------------------------------------------- SRT / VTT

const TS = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})|(\d{2}):(\d{2})[.](\d{3})/;
function parseTs(s) {
  const m = s.trim().match(TS);
  if (!m) return null;
  if (m[1] !== undefined) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, "0")) / 1000;
  return Number(m[5]) * 60 + Number(m[6]) + Number(m[7]) / 1000;
}

/** Parses SRT or WebVTT into cues. Strips markup tags; keeps the words exactly. */
export function parseSubtitles(text) {
  const cues = [];
  const blocks = text.replace(/\r/g, "").replace(/^﻿/, "").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const ti = lines.findIndex((l) => l.includes("-->"));
    if (ti < 0) continue;
    const [a, b] = lines[ti].split("-->");
    const start = parseTs(a), end = parseTs(b);
    if (start === null || end === null || end < start) throw reelError(REEL_ERRORS.INPUT_INVALID, `Tempo inválido na legenda: "${lines[ti]}"`);
    const body = lines.slice(ti + 1).join(" ").replace(/<[^>]+>/g, "").replace(/\{[^}]*\}/g, "").replace(/\s+/g, " ").trim();
    if (body) cues.push({ index: cues.length + 1, start: round(start), end: round(end), text: body });
  }
  return cues;
}

/**
 * Converts imported cues to a transcript. Word times are interpolated inside each cue by
 * character weight (timing:"interpolated"); the result is scoped to the media the subtitle
 * belongs to and is NEVER treated as a transcription of a different (e.g. raw) recording.
 */
export function subtitlesToTranscript(cues, { appliesTo = null, durationSec = null, language = null, origin = "imported-subtitle" } = {}) {
  const words = [];
  const segments = [];
  cues.forEach((c, ci) => {
    const tokens = c.text.split(/\s+/).filter(Boolean);
    const weights = tokens.map((t) => Math.max(1, normalizeWord(t).length));
    const total = weights.reduce((a, b) => a + b, 0);
    let t = c.start;
    const ids = [];
    tokens.forEach((tok, i) => {
      const d = (c.end - c.start) * (weights[i] / total);
      const id = `w${String(words.length + 1).padStart(4, "0")}`;
      words.push({ id, text: tok, start: round(t), end: round(t + d), confidence: null, timing: tokens.length === 1 ? "cue" : "interpolated", segment: ci });
      ids.push(id);
      t += d;
    });
    segments.push({ index: ci, start: c.start, end: c.end, text: c.text, wordIds: ids });
  });
  const dur = durationSec ?? (cues.at(-1)?.end ?? 0);
  return {
    schema: TRANSCRIPT_SCHEMA, schemaVersion: 1,
    provider: { id: "srt-import", model: null, versions: null, origin },
    source: appliesTo, scope: "imported-subtitle",
    language, languageProbability: null, durationSec: dur,
    words, segments, silences: deriveSilences(words, dur),
    coverage: { fromSec: words[0]?.start ?? null, toSec: words.at(-1)?.end ?? null, ratio: round(((words.at(-1)?.end ?? 0) - (words[0]?.start ?? 0)) / Math.max(0.001, dur), 3) },
    review: [], corrections: [],
    warnings: ["Legenda importada: tempos por palavra interpolados dentro de cada bloco; vale somente para a mídia a que pertence e não substitui a transcrição de uma gravação diferente (ex.: o bruto)."],
  };
}

export async function importSubtitleFile(file, { media = null, language = null } = {}) {
  const cues = parseSubtitles(await readFile(file, "utf8"));
  if (!cues.length) throw reelError(REEL_ERRORS.INPUT_INVALID, `Nenhum bloco de legenda em ${file}`);
  let appliesTo = null, durationSec = null;
  if (media) {
    const probe = await probeMedia(media);
    appliesTo = { path: path.resolve(media), sha256: await sha256File(media), durationSec: probe.durationSec };
    durationSec = probe.durationSec;
  }
  const t = subtitlesToTranscript(cues, { appliesTo, durationSec, language });
  t.provider.file = { path: path.resolve(file), sha256: await sha256File(file) };
  if (media && cues.at(-1).end > durationSec + 0.5) t.warnings.push(`A legenda termina em ${cues.at(-1).end}s, depois do fim da mídia (${durationSec}s): provavelmente pertence a outro arquivo.`);
  return t;
}

const pad = (n, w = 2) => String(n).padStart(w, "0");
export function srtTime(t) {
  const ms = Math.max(0, Math.round(t * 1000));
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

/** Cues → SRT text. */
export function toSrt(cues) {
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join("\n");
}

/** Transcript segments → SRT (one cue per recognized segment, split at ~42 chars). */
export function transcriptToSrt(transcript, { maxChars = 42 } = {}) {
  const byId = new Map(transcript.words.map((w) => [w.id, w]));
  const cues = [];
  for (const s of transcript.segments) {
    let cur = [];
    const flush = () => { if (cur.length) cues.push({ start: cur[0].start, end: cur.at(-1).end, text: cur.map((w) => w.text).join(" ") }); cur = []; };
    for (const id of s.wordIds) {
      const w = byId.get(id);
      if (!w) continue;
      if (cur.length && [...cur, w].map((x) => x.text).join(" ").length > maxChars) flush();
      cur.push(w);
    }
    flush();
  }
  return toSrt(cues);
}

/**
 * Applies operator-reviewed corrections (e.g. a misrecognized product name confirmed by
 * listening or by a human-made caption of the same audio). Each correction is recorded
 * with provenance; timing is preserved from the recognized words it replaces.
 * correction = { wordIds:[...] | {from,to} (word ids range), text, reason, by, evidence }
 */
export function applyCorrections(transcript, corrections = []) {
  const t = structuredClone(transcript);
  for (const c of corrections) {
    const ids = c.wordIds ?? [];
    const idx = ids.map((id) => t.words.findIndex((w) => w.id === id)).filter((i) => i >= 0).sort((a, b) => a - b);
    if (!idx.length || idx.length !== ids.length) throw reelError(REEL_ERRORS.INPUT_INVALID, `Correção aponta para palavras inexistentes: ${ids.join(",")}`);
    for (let k = 1; k < idx.length; k++) if (idx[k] !== idx[k - 1] + 1) throw reelError(REEL_ERRORS.INPUT_INVALID, `Correção deve cobrir palavras consecutivas: ${ids.join(",")}`);
    if (!c.reason || !c.by) throw reelError(REEL_ERRORS.INPUT_INVALID, "Toda correção precisa de 'reason' e 'by' (proveniência).");
    const first = t.words[idx[0]], last = t.words[idx.at(-1)];
    const before = idx.map((i) => t.words[i].text).join(" ");
    const tokens = String(c.text).split(/\s+/).filter(Boolean);
    const span = last.end - first.start;
    const replacement = tokens.map((tok, k) => ({
      id: k === 0 ? first.id : `${first.id}.${k}`, text: tok,
      start: round(first.start + (span * k) / tokens.length), end: round(first.start + (span * (k + 1)) / tokens.length),
      confidence: null, timing: tokens.length === 1 ? first.timing : "interpolated", segment: first.segment, corrected: true,
    }));
    t.words.splice(idx[0], idx.length, ...replacement);
    for (const s of t.segments) {
      if (s.wordIds.includes(first.id)) {
        const pos = s.wordIds.indexOf(first.id);
        s.wordIds.splice(pos, ids.length, ...replacement.map((w) => w.id));
      }
    }
    t.corrections.push({ before, after: c.text, wordIds: ids, start: first.start, end: last.end, reason: c.reason, by: c.by, evidence: c.evidence ?? null });
    t.review = t.review.filter((r) => !ids.includes(r.wordId));
  }
  for (const s of t.segments) s.text = s.wordIds.map((id) => t.words.find((w) => w.id === id)?.text).filter(Boolean).join(" ");
  return t;
}
