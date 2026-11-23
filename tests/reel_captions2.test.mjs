/** Mission 21.1 (B2/B3) — remapping by energy, caption checks, glossary, opening, spoken cards. */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reel as R } from "../packages/motion-core/index.js";
import { BURSTS, burstTranscript, noisySpeechWav, verticalVideo } from "./helpers/reel-fixtures.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = path.join(root, "tests", "tmp", "captions2");
let video, transcript;
before(async () => { await rm(tmp, { recursive: true, force: true }); await mkdir(tmp, { recursive: true }); video = await verticalVideo(tmp, await noisySpeechWav(tmp)); transcript = burstTranscript(await R.sha256File(video), video); });
const face = { x: 0.25, y: 0.25, w: 0.5, h: 0.4 };
const plan = (o = {}) => R.planEdit(video, { transcript, preset: "talking-head", faceBox: face, ...o });

describe("Remapeamento por energia (corte conhecido: 2,0–3,0 s)", () => {
  const segs = () => R.computeDst([{ id: "a", src: [0, 2] }, { id: "b", src: [3, 5] }], 30);
  const energy = (ranges) => { const env = new Float64Array(600).fill(-70); for (const [a, b] of ranges) for (let i = Math.round(a * 100); i < Math.round(b * 100); i++) env[i] = -20; return { env, thresholdDb: -45 }; };
  test("energia no trecho removido: a legenda sai e não migra para o próximo trecho", () => {
    const w = [{ id: "w", text: "sumiu", start: 1.7, end: 3.3 }]; // span touches both stretches
    const r = R.remapWords(w, segs(), { energy: energy([[2.2, 2.8]]) });
    assert.deepEqual(r.words, []); assert.equal(r.lost[0].lostReason, "removed");
  });
  test("parcialmente audível: tempo recalculado pela energia que sobrou, no trecho onde está", () => {
    const r = R.remapWords([{ id: "w", text: "parte", start: 1.5, end: 2.6 }], segs(), { energy: energy([[1.6, 2.2]]) });
    assert.equal(r.words.length, 1);
    assert.deepEqual([r.words[0].start, r.words[0].end, r.words[0].segment, r.words[0].clipped], [1.6, 2, "a", true]);
  });
  test("sobra residual de energia (< 30%) não vira legenda", () => {
    const r = R.remapWords([{ id: "w", text: "resto", start: 1.5, end: 2.9 }], segs(), { energy: energy([[1.95, 2.85]]) });
    assert.equal(r.words.length, 0); assert.equal(r.lost[0].lostReason, "energy-cut");
  });
  test("inteira: tempo exato; zoom cut (trechos contíguos) não recorta a palavra", () => {
    const z = R.computeDst([{ id: "a", src: [0, 2] }, { id: "b", src: [2, 4] }], 30);
    const r = R.remapWords([{ id: "w", text: "inteira", start: 1.8, end: 2.4 }], z, { energy: energy([[1.8, 2.4]]) });
    assert.deepEqual([r.words[0].start, r.words[0].end, r.words[0].clipped], [1.8, 2.4, false]);
  });
});

describe("Checks de legenda", () => {
  const page = (i, start, end, texts, spans) => ({ index: i, start, end, lines: [texts.length], words: texts.map((t, k) => ({ id: `${i}-${k}`, text: t, display: t, start: spans?.[k]?.[0] ?? start + (k * (end - start)) / texts.length, end: spans?.[k]?.[1] ?? start + ((k + 1) * (end - start)) / texts.length })) });
  const cfg = R.resolveQaParams("talking-head").captions;
  test("cps: causa texto demais × timing do ASR; página confortável não aparece", () => {
    const fast = [page(0, 0, 0.8, ["CONSTANTEMENTE", "RAPIDAMENTE"]), page(1, 0.8, 1.6, ["EXTRAORDINÁRIO", "IMENSAMENTE"])];
    const a = R.captionCps(fast.map((p) => ({ ...p, words: p.words.map((w) => ({ ...w, start: w.start, end: w.start + 0.6 })) })), cfg.cps, cfg);
    assert.equal(a.length, 2); assert.equal(a[0].cause, "texto demais");
    const b = R.captionCps([page(0, 0, 0.4, ["IMPOSSIVELMENTEE"]), page(1, 0.4, 2.4, ["FAÇA"])], cfg.cps, cfg);
    assert.equal(b.length, 1); assert.equal(b[0].cause, "timing do ASR"); assert.match(b[0].evidence, /cps|2 s/);
    assert.deepEqual(R.captionCps([page(0, 0, 1, ["BOM", "RITMO"])], cfg.cps, cfg), []);
  });
  test("overlap espacial: palavras reais separadas (PASS) e caixas sobrepostas (detecta)", async () => {
    const t = await plan();
    const m = await R.measureWordBoxes(t, { workDir: path.join(tmp, "wb") });
    assert.equal(m.ok, true, m.stderr); assert.equal(m.boxes.length, t.captions.pages.reduce((n, p) => n + p.words.length, 0));
    assert.deepEqual(R.wordOverlaps(m.boxes, 2), []);
    // many words: every measured box must belong to its own word (regression: 1-frame slip)
    const pages = Array.from({ length: 45 }, (_, i) => ({ index: i, start: i, end: i + 1, lines: [1, 2], words: ["E", "QUER", "REFINAR"].map((d, k) => ({ id: `${i}-${k}`, text: d, display: d, start: i + k / 3, end: i + (k + 1) / 3 })) }));
    const big = await R.measureWordBoxes({ ...t, captions: { ...t.captions, pages } }, { workDir: path.join(tmp, "wb3") });
    for (const b of big.boxes) assert.deepEqual([b.x1, b.x2, b.y1, b.y2], [big.boxes[b.word].x1, big.boxes[b.word].x2, big.boxes[b.word].y1, big.boxes[b.word].y2], `página ${b.page} palavra ${b.word}`);
    const wide = structuredClone(t); wide.captions.style.outlineWidth = 40;
    assert.ok(R.wordOverlaps((await R.measureWordBoxes(wide, { workDir: path.join(tmp, "wb2") })).boxes, 2).length > 0, "contorno enorme precisa colidir");
  });
  test("contrast: sem contorno sobre fundo parecido → FAIL; com contorno → WARN", async () => {
    const white = path.join(tmp, "white.mp4");
    assert.equal(spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=white:s=1080x1920:r=30:d=8", "-i", video, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "copy", white]).status, 0);
    const t = await R.planEdit(white, { transcript: burstTranscript(await R.sha256File(white), white), preset: "talking-head", faceBox: face });
    const boxes = [{ x1: 300, x2: 700, y1: 1300, y2: 1400, t: t.captions.pages[0].start + 0.1 }];
    assert.equal((await R.captionContrast(t, boxes, cfg.contrast)).status, "WARN");
    t.captions.style.outlineWidth = 0;
    const bad = await R.captionContrast(t, boxes, cfg.contrast);
    assert.equal(bad.status, "FAIL", bad.details);
    assert.equal((await R.captionContrast({ ...t, source: { ...t.source, path: "/nao/existe.mp4" } }, boxes, cfg.contrast)).status, "BLOCKED");
  });
  test("card-duplicate: avisa quando o card visível repete a legenda; texto diferente passa", () => {
    const t = { overlays: [{ id: "c", kind: "label", title: "o sistema funcionando", dst: [0, 2] }], captions: { pages: [page(0, 0.2, 1, ["o", "sistema", "funcionando"])] } };
    assert.equal(R.cardDuplicates(t, 0.6).length, 1);
    t.overlays[0].title = "o que o cliente quer";
    assert.equal(R.cardDuplicates(t, 0.6).length, 0);
  });
  test("cor de palavra-chave própria: iguais são recusadas; a palavra-chave não usa a cor ativa", async () => {
    await assert.rejects(plan({ keywords: ["legenda"], captions: { keywordColor: "#2EE6A6" } }), /keywordColor/);
    const t = await plan({ keywords: ["legenda"] });
    const ass = R.buildAss(t.captions.pages, { width: 1080, height: 1920, styleIn: t.captions.style, placement: t.captions.placement });
    assert.match(ass, /3FD2FF/i);
    assert.notEqual(R.DEFAULT_CAPTION_STYLE.keywordColor, R.DEFAULT_CAPTION_STYLE.activeColor);
  });
});

describe("BRIEF: glossário e abertura", () => {
  const brief = (o) => `# BRIEF\n\n\`\`\`json motion-brief\n${JSON.stringify(o)}\n\`\`\`\n`;
  test("bloco motion-brief: opcional, validado, sem campos desconhecidos", () => {
    assert.equal(R.parseBrief("# BRIEF sem bloco"), null);
    assert.equal(R.parseBrief(brief({ opening: "original" })).opening, "original");
    assert.throws(() => R.parseBrief(brief({ opening: "gancho" })), /opening/);
    assert.throws(() => R.parseBrief(brief({ loop: true })), /desconhecido/);
    assert.throws(() => R.parseBrief("```json motion-brief\n{\n```\n"), /JSON inválido/);
  });
  test("glossário: aplica variante insegura com motivo; palavra comum confiante só vira sugestão", () => {
    const w = (id, text, confidence, i) => ({ id, text, start: i, end: i + 0.5, confidence, timing: "word" });
    const words = [w("a", "AdGravity,", 0.4, 0), w("b", "cloud", 0.3, 1), w("c", "code", 0.5, 2), w("d", "codecs", 0.98, 3), w("e", "código", 0.9, 4)];
    const t = { words, segments: [{ id: "s", start: 0, end: 5, wordIds: words.map((x) => x.id) }], corrections: [], review: [] };
    const r = R.applyGlossary(t, [{ term: "Antigravity" }, { term: "Claude Code", aliases: ["cloud code"] }, "Codex"], { briefSha256: "f".repeat(64) });
    assert.deepEqual(r.transcript.words.map((x) => x.text), ["Antigravity,", "Claude", "Code", "codecs", "código"]);
    for (const c of r.transcript.corrections) { assert.equal(c.by, "glossary"); assert.match(c.reason, /glossário do BRIEF/); assert.match(c.evidence, /sha256/); }
    assert.ok(r.suggestions.some((s) => s.term === "Codex" && s.heard === "codecs"));
    assert.equal(t.words[0].text, "AdGravity,", "a transcrição original não muda");
  });
  test("opening strongest-line: só propõe; a ordem é a mesma de original até haver aprovação", async () => {
    const src = (t) => t.segments.map((s) => s.src);
    const original = await plan(), proposed = await plan({ opening: "strongest-line", openingParams: { minSec: 0.3, breakGapSec: 0.3 } });
    assert.deepEqual(src(proposed), src(original));
    assert.equal(proposed.opening.applied, false); assert.ok(proposed.opening.proposals.length > 0);
    assert.ok(proposed.review.some((r) => r.severity === "gate"));
    const last = proposed.opening.proposals.find((x) => x.src[0] > 2) ?? proposed.opening.proposals[0];
    const ok = await plan({ opening: "strongest-line", openingParams: { minSec: 0.3, breakGapSec: 0.3 }, openingApproval: { by: "dono", at: "2026-11-23", src: last.src } });
    assert.equal(ok.opening.applied, true); assert.equal(ok.segments[0].reason, "hook");
    await assert.rejects(plan({ opening: "strongest-line", openingApproval: { by: "dono", at: "2026-11-23", src: [0.1, 0.2] } }), /não corresponde/);
    await assert.rejects(plan({ opening: "strongest-line", openingApproval: { src: last.src } }), /by, at/);
    await assert.rejects(plan({ opening: "custom", openingText: "nunca dito" }), /não foi dito/);
  });
  test("CLI: --brief aplica glossário e registra o hash do BRIEF", async () => {
    const b = path.join(tmp, "BRIEF.md"), tf = path.join(tmp, "t.json"), out = path.join(tmp, "edit.json");
    await writeFile(b, brief({ opening: "original", glossary: [{ term: "Codex", aliases: ["corte"] }] }));
    await writeFile(tf, JSON.stringify(transcript));
    const r = spawnSync("node", [path.join(root, "packages/motion-cli/bin/motion.mjs"), "edit", "plan", video, `--transcript=${tf}`, `--brief=${b}`, `--output=${out}`, "--json"], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const t = await R.loadTimeline(out);
    assert.ok(t.captions.words.some((w) => w.text === "Codex")); assert.match(t.brief.sha256, /^[0-9a-f]{64}$/);
  });
});

describe("Cards ancorados na fala", () => {
  test("não antecipa: leadSec padrão zero e citação literal adia a entrada", async () => {
    const t = await plan({ overlays: [{ id: "q", kind: "label", at: { match: "corte" }, durationSec: 2, title: "legenda no tempo" }] });
    const said = t.captions.words[R.findPhrase(t.captions.words, "legenda no tempo")];
    assert.ok(t.overlays[0].dst[0] >= said.start - 1 / 30 - 1e-6, `${t.overlays[0].dst[0]} < ${said.start}`);
    assert.ok(t.warnings.some((w) => /antecipar/.test(w)));
  });
  test("vazio ≤ 0,8 s: lista entra com o primeiro item; card com título não reserva área vazia", async () => {
    const mk = (extra) => plan({ overlays: [{ id: "l", kind: "list", at: { match: "teste" }, durationSec: 4, items: ["legenda"], steps: [{ at: { match: "legenda" } }], ...extra }] });
    const t = await mk({});
    const w = t.captions.words.find((x) => x.text === "legenda");
    assert.ok(Math.abs(t.overlays[0].dst[0] - w.start) <= 1 / 30 + 1e-6);
    const titled = await mk({ kind: "label", title: "Ferramentas", chips: ["legenda"], items: undefined });
    const layers = R.overlayLayers(titled.overlays);
    assert.equal(layers[0].step, -1); assert.deepEqual(R.layerTexts(layers[0]), ["Ferramentas"]);
    assert.doesNotMatch(R.overlayHtml(titled.overlays[0], { width: 1080, height: 1920, step: -1 }), /class="chips"/);
  });
});
