/**
 * MOTION Core — reel/qa_reel.mjs
 * QA for an edited reel. Measured checks only; anything that cannot run is BLOCKED or
 * NOT_TESTED, never PASS. Human listening and the independent Critic stay outside.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createQaReport } from "../quality/qa-status.mjs";
import { readListening, verifyCritic } from "../quality/critic.mjs";
import { qaMedia } from "../quality/media_qa.mjs";
import { detectSpeech, energyEnvelope, measureLoudness } from "./analyze.mjs";
import { buildAss, loadSafeZonePreset } from "./captions.mjs";
import { captionContrast, captionCps, cardDuplicates, measureWordBoxes, wordOverlaps } from "./caption_qa.mjs";
import { layerTexts, overlayLayers } from "./overlays.mjs";
import { PRESETS, resolveQaParams } from "./presets.mjs";
import { audioRanges } from "./render.mjs";
import { highBandEnvelope } from "./sibilants.mjs";
import { cutWav, measureLatency, speechToPauseCheck } from "./voice.mjs";
import { monoDownmix, probeMedia, round, run, sha256File } from "./util.mjs";

const overlapSec = (a, b) => Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));

/**
 * Measured caption boxes: the ASS track is rendered over black at each page's midpoint
 * (half resolution, grayscale) and the bounding box of lit pixels is computed per frame.
 */
export async function measureCaptionBoxes(timeline, { workDir, resolveFont = null, threshold = 48 } = {}) {
  const { width, height } = timeline.output;
  const pages = timeline.captions.pages;
  await mkdir(workDir, { recursive: true });
  const ass = path.join(workDir, "qa-captions.ass");
  await writeFile(ass, buildAss(pages, { width, height, styleIn: timeline.captions.style, placement: timeline.captions.placement }));
  const esc = (p) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
  const fonts = resolveFont ? `:fontsdir='${esc(resolveFont)}'` : "";
  const fps = 30;
  const frames = [...new Set(pages.map((p) => Math.round((p.start + Math.min(0.5, (p.end - p.start) / 2)) * fps)))];
  const sel = frames.map((n) => `eq(n,${n})`).join("+");
  const w2 = Math.round(width / 2), h2 = Math.round(height / 2);
  const r = await run("ffmpeg", ["-hide_banner", "-v", "error", "-f", "lavfi", "-i", `color=black:s=${width}x${height}:r=${fps}:d=${timeline.output.durationSec}`,
    "-vf", `ass='${esc(ass)}'${fonts},select='${sel}',scale=${w2}:${h2},format=gray`, "-fps_mode", "passthrough", "-f", "rawvideo", "-"], { binary: true });
  const size = w2 * h2;
  const boxes = [];
  for (let k = 0; k * size + size <= r.stdout.length; k++) {
    let x1 = w2, x2 = -1, y1 = h2, y2 = -1;
    const off = k * size;
    for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) if (r.stdout[off + y * w2 + x] > threshold) { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
    if (x2 >= 0) boxes.push({ x1: x1 * 2, x2: x2 * 2 + 1, y1: y1 * 2, y2: y2 * 2 + 1, t: round((frames[k] ?? 0) / fps, 3) });
  }
  return { boxes, ok: r.code === 0, stderr: r.code === 0 ? null : r.stderr.split("\n").slice(-3).join(" ") };
}

/** Frame/sample hashes of two renders (decoded content, not container bytes). */
export async function compareRenders(a, b) {
  const h = async (f) => {
    const r = await run("ffmpeg", ["-v", "error", "-i", f, "-map", "0:v", "-map", "0:a?", "-f", "streamhash", "-hash", "sha256", "-"]);
    return r.code === 0 ? r.stdout.trim() : null;
  };
  const [ha, hb] = await Promise.all([h(a), h(b)]);
  return { a: ha, b: hb, identical: ha !== null && ha === hb };
}

/** The untreated source cut exactly like the timeline (mono): the "before" of every audio comparison. */
export async function sourceCutWav(t, workDir) {
  await mkdir(workDir, { recursive: true });
  const full = path.join(workDir, "qa-source.wav"), cut = path.join(workDir, "qa-source-cut.wav");
  const down = monoDownmix(t.source.probe.audio.channels);
  const r = await run("ffmpeg", ["-v", "error", "-y", "-i", t.source.path, "-vn", ...(down ? ["-af", down] : []), "-ac", "1", "-ar", "48000", "-c:a", "pcm_f32le", full]);
  if (r.code !== 0) throw new Error(r.stderr.trim().split("\n").at(-1));
  const off = (t.source.probe.audio.startTime ?? 0) - (t.source.probe.video?.startTime ?? 0);
  await cutWav(full, audioRanges(t.segments).map(([a, b]) => [a - off, b - off]), cut);
  await rm(full, { force: true });
  return cut;
}

/** Critic and listening sign-offs count only when intact and bound to this exact file. */
async function addHumanChecks(report, mp4, reviewsDir) {
  const own = await sha256File(mp4);
  const dir = reviewsDir ?? defaultReviewsDir(mp4);
  const l = dir ? await readListening(dir) : null;
  const listening = { id: "human.listening", title: "Revisão auditiva humana (naturalidade, artefatos, fonemas)", required: false };
  if (!l) report.add({ ...listening, status: "NOT_TESTED", details: "obrigatória antes de declarar qualidade de áudio" });
  else if (l.invalid || l.sha256 !== own) report.add({ ...listening, status: "NOT_TESTED", details: l.invalid ? "listening.json inválido" : "listening.json é de outro arquivo" });
  else report.add({ ...listening, status: l.approved ? "PASS" : "FAIL", details: `${l.by}, ${l.at}` });
  const c = dir ? await verifyCritic(dir) : { state: "none", reason: "pasta de reviews não encontrada" };
  const critic = { id: "human.critic", title: "Crítico independente (contact sheet + prévia em movimento)", required: false };
  if (c.state === "none") { report.add({ ...critic, status: "NOT_TESTED", details: `${c.reason}; aprovação não é automática` }); return; }
  report.add({ id: "critic.integrity", title: "Parecer do Crítico íntegro (hash)", status: c.state === "intact" ? "PASS" : "FAIL", details: c.state === "intact" ? `rodada ${c.round}, ${c.jsonSha256}, por ${c.reviewer.id}` : c.problems.join("; ") });
  if (c.state !== "intact") report.add({ ...critic, status: "FAIL", details: "parecer adulterado" });
  else if (c.subject.sha256 !== own) report.add({ ...critic, status: "FAIL", details: `o parecer avaliou outro arquivo (${c.subject.sha256.slice(0, 16)}…)` });
  else report.add({ ...critic, status: c.verdict === "approved" ? "PASS" : "FAIL", details: `${c.verdict === "approved" ? "aprovado" : "reprovado"}, ${c.findings} achado(s)` });
}

function defaultReviewsDir(mp4) {
  for (let d = path.dirname(path.resolve(mp4)), i = 0; i < 4; i++, d = path.dirname(d)) if (existsSync(path.join(d, "reviews"))) return path.join(d, "reviews");
  return null;
}

/**
 * @param mp4 rendered reel
 * @param o { timeline (object), renderReport (object), compareWith (mp4 of a second render), workDir, platform }
 */
export async function qaReel(mp4, o = {}) {
  const report = createQaReport({ subject: path.basename(mp4), kind: "reel" });
  const t = o.timeline ?? null;
  const fps = t?.output?.fps ?? 30;
  const Q = resolveQaParams(t?.preset, t?.qa ?? o.qa);
  const work = o.workDir ?? path.join(path.dirname(path.resolve(mp4)), ".qa-work");
  const media = await qaMedia(mp4, { width: t?.output?.width ?? (o.preview ? undefined : 1080), height: t?.output?.height ?? (o.preview ? undefined : 1920), fps, durationSec: t?.output?.durationSec, durationTolerance: 1.5 / fps, codec: "h264", audio: true, minLufs: Q.loudness.minLufs, maxLufs: Q.loudness.maxLufs, maxPeakDb: t?.export?.loudness?.truePeakDb ?? -1.5 });
  report.merge(media, "media");
  if (!existsSync(mp4)) return report;
  const probe = await probeMedia(mp4).catch(() => null);
  report.add({ id: "subject.sha256", title: "Arquivo medido (SHA-256)", status: "PASS", required: false, details: await sha256File(mp4) });
  if (probe) {
    report.add({ id: "format.audio-codec", title: "Áudio AAC", status: probe.audio?.codec === "aac" ? "PASS" : "FAIL", details: probe.audio ? `${probe.audio.codec} ${probe.audio.sampleRate} Hz ${probe.audio.channels}ch` : "sem áudio" });
    report.add({ id: "format.pixfmt", title: "yuv420p (compatível com redes sociais)", status: probe.video?.pixFmt === "yuv420p" ? "PASS" : "FAIL", details: probe.video?.pixFmt });
    report.add({ id: "format.vertical", title: "Vertical 9:16", status: probe.video && Math.abs(probe.video.width / probe.video.height - 9 / 16) < 0.01 ? "PASS" : "FAIL", details: probe.video ? `${probe.video.width}×${probe.video.height}` : null });
  }
  const rr0 = o.renderReport ?? null;
  const loud = await measureLoudness(mp4).catch(() => null);
  const target = t?.export?.loudness?.targetLufs ?? -14, tpMax = t?.export?.loudness?.truePeakDb ?? -1.5;
  if (loud) {
    const d = Math.abs((loud.integratedLufs ?? -99) - target);
    report.add({ id: "audio.loudness-target", title: `Loudness ${target} LUFS ±${Q.loudness.toleranceLu} LU (EBU R128)`, status: d <= Q.loudness.toleranceLu ? "PASS" : d <= Q.loudness.failLu ? "WARN" : "FAIL", details: `${loud.integratedLufs} LUFS, LRA ${loud.lraLu} LU` });
    report.add({ id: "audio.true-peak", title: `True peak ≤ ${tpMax} dBTP após AAC (sem clipping)`, status: loud.truePeakDbtp !== null && loud.truePeakDbtp <= tpMax ? "PASS" : "FAIL", details: `${loud.truePeakDbtp} dBTP` });
  }

  if (!t) {
    for (const [id, title] of [["source.preserved", "Original preservado"], ["cuts.speech", "Sem fala perdida nos cortes"], ["captions.sync", "Legendas sincronizadas"], ["captions.safe-zone", "Legendas em zona segura"]]) report.add({ id, title, status: "NOT_TESTED", details: "rode com --timeline para checar contra a edição" });
    await addHumanChecks(report, mp4, o.reviewsDir);
    return report;
  }
  report.add({ id: "timeline.frames", title: `Quadros = timeline (${t.output.frames})`, status: probe?.video?.frames === t.output.frames || probe?.video?.frames === undefined ? (probe?.video?.frames ? "PASS" : "NOT_TESTED") : "FAIL", details: `${probe?.video?.frames ?? "?"} no MP4` });

  // source preservation
  if (!existsSync(t.source.path)) report.add({ id: "source.preserved", title: "Arquivo original preservado (SHA-256)", status: "BLOCKED", details: `original não encontrado em ${t.source.path}`, reproduce: "Disponibilize o original no caminho da timeline e rode motion qa reel de novo." });
  else { const h = await sha256File(t.source.path); report.add({ id: "source.preserved", title: "Arquivo original preservado (SHA-256)", status: h === t.source.sha256 ? "PASS" : "FAIL", details: h === t.source.sha256 ? h.slice(0, 16) + "…" : "o original mudou desde a timeline" }); }

  // visual shots = timeline segments split by discontinuities already inside the source
  {
    const cuts = t.source.sourceCuts ?? [];
    const shots = [];
    for (const sg of t.segments) {
      const inner = cuts.filter((c) => c > sg.src[0] + 1e-6 && c < sg.src[1] - 1e-6).map((c) => sg.dst[0] + (c - sg.src[0]));
      const b = [sg.dst[0], ...inner, sg.dst[1]];
      for (let i = 0; i + 1 < b.length; i++) shots.push({ start: b[i], end: b[i + 1], frames: Math.round((b[i + 1] - b[i]) * fps), seg: sg.id });
    }
    const orphan = shots.filter((x) => x.frames < Q.shots.orphanFrames), short = shots.filter((x) => x.frames >= Q.shots.orphanFrames && x.end - x.start < Q.shots.minSec);
    report.add({ id: "shots.orphan", title: "Sem planos de 1–2 quadros (cortes + saltos da fonte)", status: orphan.length ? "FAIL" : "PASS", details: orphan.length ? orphan.map((x) => `${round(x.start, 2)}s (${x.frames} q)`).join(", ") : `${shots.length} planos visuais; ${cuts.length} saltos da fonte considerados` });
    report.add({ id: "shots.min", title: `Planos visuais ≥ ${Q.shots.minSec} s`, heuristic: true, status: short.length ? "WARN" : "PASS", details: short.length ? short.map((x) => `${round(x.start, 2)}–${round(x.end, 2)}s (${x.frames} q)`).join(", ") : null });
  }

  // speech vs cuts (measured on the source)
  if (existsSync(t.source.path) && t.source.probe?.audio) {
    const env = await energyEnvelope(t.source.path, { channels: t.source.probe.audio.channels });
    const vad = detectSpeech(env);
    const silenceRemovals = t.removed.filter((r) => ["pause", "leading-silence", "trailing-silence"].includes(r.reason));
    const decided = t.removed.filter((r) => !["pause", "leading-silence", "trailing-silence"].includes(r.reason));
    const keptSrc = t.segments.map((s) => s.src);
    const lostIn = (r) => vad.segments.reduce((n, s) => n + Math.max(0, overlapSec([s.start, s.end], r.src) - keptSrc.reduce((k, src) => k + overlapSec(src, [Math.max(s.start, r.src[0]), Math.min(s.end, r.src[1])]), 0)), 0);
    const bad = silenceRemovals.map((r) => ({ r, lost: lostIn(r) })).filter((x) => x.lost > Q.cuts.lostSpeechSec);
    report.add({ id: "cuts.speech", title: "Cortes de silêncio não removem fala (VAD na fonte)", status: bad.length ? "FAIL" : "PASS", details: bad.length ? bad.map((x) => `${x.r.src.join("–")}s perde ${round(x.lost, 2)}s`).join("; ") : `${silenceRemovals.length} cortes de pausa verificados` });
    const decidedSec = round(decided.reduce((n, r) => n + lostIn(r), 0), 2);
    report.add({ id: "cuts.decisions", title: "Fala removida por decisão editorial (repetição/hesitação/operador)", status: decided.length ? "WARN" : "PASS", required: false, details: decided.length ? `${decidedSec}s em ${decided.length} trechos — confirmar na revisão: ${decided.map((r) => `${r.reason} ${r.src.join("–")}`).join("; ")}` : "nenhuma" });
    const hop = 0.01;
    const boundaryLevel = (tt) => { const i = Math.round(tt / hop); const span = Math.round(Q.cuts.boundarySec / hop); let m = -120; for (let k = i - span; k <= i + span; k++) if (env[k] !== undefined) m = Math.max(m, env[k]); return m; };
    const jumps = t.segments.filter((s, i) => i > 0 && s.cutBefore);
    const hot = [];
    t.segments.forEach((s, i) => { if (!s.cutBefore || i === 0) return; const prev = t.segments[i - 1]; for (const tt of [prev.src[1], s.src[0]]) if (boundaryLevel(tt) > vad.thresholdDb) hot.push(round(tt, 2)); });
    report.add({ id: "cuts.boundaries", title: "Pontos de corte em silêncio (±20 ms abaixo do limiar de fala)", heuristic: true, status: hot.length ? "WARN" : "PASS", details: hot.length ? `com energia de fala: ${hot.join(", ")}s` : `${jumps.length} cortes, ${jumps.length * 2} bordas` });
    if (t.effective?.cut?.sibilants) {
      const cfg = t.effective.cut.sibilants;
      const hb = await highBandEnvelope(t.source.path, { ...cfg, channels: t.source.probe.audio.channels });
      const span = Math.round(Q.cuts.sibilantBoundarySec / hop);
      // energy on BOTH sides of the cut: the sibilant continues past the kept range
      const peak = (i0, i1) => { let m = -120; for (let k = i0; k < i1; k++) if (hb.env[k] !== undefined) m = Math.max(m, hb.env[k]); return m; };
      const torn = [];
      t.segments.forEach((sg, i) => { if (!sg.cutBefore || i === 0) return; for (const tt of [t.segments[i - 1].src[1], sg.src[0]]) { const k = Math.round(tt / hop); if (peak(k - span, k) > hb.thresholdDb && peak(k, k + span) > hb.thresholdDb) torn.push(round(tt, 3)); } });
      report.add({ id: "cuts.sibilants", title: `Bordas não truncam sibilantes (energia > ${cfg.hz} Hz dos dois lados)`, heuristic: true, status: torn.length ? "WARN" : "PASS", details: torn.length ? `possível /s/ truncado (tempo da fonte): ${torn.join(", ")}s` : `limiar ${hb.thresholdDb} dBFS` });
    }
    // speech − pause on the delivered MP4 versus the same cut without treatment
    const limits = rr0?.voice?.params?.speechToPause ?? PRESETS.voice[t.audio?.preset]?.speechToPause ?? PRESETS.voice.clean.speechToPause;
    if (t.audio?.music) report.add({ id: "audio.speech-to-pause", title: "Relação fala − pausa não piora", status: "NOT_TESTED", required: false, details: "trilha musical nas pausas: a métrica mede só voz" });
    else {
      try {
        const cut = await sourceCutWav(t, work);
        const c = speechToPauseCheck(await energyEnvelope(cut, { channels: 1 }), await energyEnvelope(mp4, { channels: probe?.audio?.channels ?? 2 }), limits, { durationSec: t.output.durationSec });
        report.add({ id: c.id, title: `${c.title}, no MP4 final, preset ${t.audio?.preset}`, heuristic: true, required: c.status !== "NOT_TESTED", status: c.status, details: c.details });
        await rm(cut, { force: true });
      } catch (e) { report.add({ id: "audio.speech-to-pause", title: "Relação fala − pausa não piora", status: "BLOCKED", details: e.message, reproduce: "Disponibilize o original e rode motion qa reel de novo." }); }
    }
  } else report.add({ id: "cuts.speech", title: "Cortes não removem fala", status: "BLOCKED", details: "original indisponível", reproduce: "Disponibilize o original e rode de novo." });

  // captions
  if (t.captions?.enabled && t.captions.pages?.length) {
    const outEnv = await energyEnvelope(mp4, { channels: 2 });
    const outVad = detectSpeech(outEnv);
    const words = t.captions.words.filter((w) => !w.suspect);
    const tol = Q.captions.syncToleranceSec;
    const synced = words.filter((w) => outVad.segments.some((s) => s.end + tol > w.start && s.start - tol < w.end));
    const ratio = words.length ? synced.length / words.length : 1;
    report.add({ id: "captions.sync", title: "Legendas sincronizadas com a fala do vídeo final (±120 ms)", status: ratio >= Q.captions.syncPass ? "PASS" : ratio >= Q.captions.syncWarn ? "WARN" : "FAIL", details: `${synced.length}/${words.length} palavras sobre fala detectada no áudio final (${round(ratio * 100, 1)}%)` });
    const beyond = t.captions.pages.filter((p) => p.end > t.output.durationSec + 1e-3);
    report.add({ id: "captions.bounds", title: "Legendas dentro da duração final", status: beyond.length ? "FAIL" : "PASS", details: beyond.length ? `${beyond.length} páginas passam do fim` : `${t.captions.pages.length} páginas` });
    const overlaps = t.captions.pages.filter((p, i) => i && p.start < t.captions.pages[i - 1].end - 1e-3);
    report.add({ id: "captions.page-overlap", title: "Sem páginas de legenda sobrepostas", status: overlaps.length ? "FAIL" : "PASS", details: overlaps.length ? `${overlaps.length} sobreposições` : null });
    const shownIds = new Set(t.captions.pages.flatMap((p) => p.words.map((w) => w.id)));
    const hiddenIds = new Set(t.captions.hiddenWords ?? []);
    const uncovered = words.filter((w) => !shownIds.has(w.id) && !hiddenIds.has(w.id.split("#")[0]));
    report.add({ id: "captions.coverage", title: "Toda palavra falada tem página de legenda (exceto ocultas por decisão)", status: uncovered.length ? "WARN" : "PASS", details: uncovered.length ? `${uncovered.length} sem página: ${uncovered.slice(0, 8).map((w) => `"${w.text}"@${w.start}s`).join(", ")}` : `${hiddenIds.size} oculta(s) por decisão registrada` });
    const long = words.filter((w) => w.end - w.start > Q.captions.longWordSec);
    report.add({ id: "captions.long-words", title: "Palavras com duração plausível (≤ 1 s)", heuristic: true, status: long.length ? "WARN" : "PASS", details: long.length ? `possíveis palavras não reconhecidas: ${long.map((w) => `"${w.text}" ${round(w.end - w.start, 2)}s @${w.start}s`).join(", ")}` : null });
    const low = words.filter((w) => w.confidence !== null && w.confidence !== undefined && w.confidence < Q.captions.lowConfidence && !w.corrected);
    report.add({ id: "captions.confidence", title: "Palavras de baixa confiança revisadas", status: low.length ? "WARN" : "PASS", required: false, details: low.length ? `${low.length} palavras < 0,5 sem revisão: ${low.slice(0, 8).map((w) => `"${w.text}"@${w.start}s`).join(", ")}${low.length > 8 ? "…" : ""}` : "nenhuma" });
    const cps = captionCps(t.captions.pages, Q.captions.cps, { longWordSec: Q.captions.longWordSec });
    report.add({ id: "captions.cps", title: `Velocidade de leitura ≤ ${Q.captions.cps.warn} caracteres/s (FAIL acima de ${Q.captions.cps.fail})`, heuristic: true, status: cps.some((c) => c.cps > Q.captions.cps.fail) ? "FAIL" : cps.length ? "WARN" : "PASS", details: cps.length ? cps.map((c) => `${c.cps} cps @${c.start}s "${c.text}" [${c.cause}: ${c.evidence}]`).join(" | ") : `${t.captions.pages.length} páginas` });
    const dup = cardDuplicates(t, Q.captions.cardDuplicateRatio);
    report.add({ id: "captions.card-duplicate", title: "Cards não repetem a legenda ativa", heuristic: true, required: false, status: dup.length ? "WARN" : "PASS", details: dup.length ? dup.map((d) => `${d.card} × "${d.caption}" @${d.start}s`).join(" | ") : null });
    // measured placement
    const sz = loadSafeZonePreset(t.captions.style.platform ?? "instagram-reels");
    const fontsDir = t.captions.fontsDir ? path.resolve(path.dirname(t.__file ?? mp4), t.captions.fontsDir) : null;
    const m = await measureCaptionBoxes(t, { workDir: work, resolveFont: fontsDir });
    const wb = await measureWordBoxes(t, { workDir: work, resolveFont: fontsDir });
    if (!wb.ok) report.add({ id: "captions.overlap", title: "Caixas das palavras não se sobrepõem (pico da animação)", status: "BLOCKED", details: wb.stderr, reproduce: "Verifique FFmpeg com libass e rode motion qa reel de novo." });
    else { const ov = wordOverlaps(wb.boxes, Q.captions.overlapTolerancePx); report.add({ id: "captions.overlap", title: "Caixas das palavras não se sobrepõem (contorno incluído, pico da animação)", status: ov.length ? "FAIL" : "PASS", details: ov.length ? ov.slice(0, 6).map((x) => `página ${x.page} (${x.start}s): "${x.a}" × "${x.b}" ${x.px}px`).join("; ") : `${wb.boxes.length} palavras medidas` }); }
    const ct = await captionContrast(t, m.boxes, Q.captions.contrast);
    report.add({ id: "captions.contrast", title: `Contraste do texto sobre a filmagem ≥ ${Q.captions.contrast.minRatio}:1 (amostrado sem a legenda)`, heuristic: true, status: ct.status, details: ct.details, reproduce: ct.status === "BLOCKED" ? "Disponibilize o original e rode motion qa reel de novo." : null });
    if (!m.ok || !m.boxes.length) report.add({ id: "captions.safe-zone", title: "Legendas dentro da zona segura (medido)", status: "BLOCKED", details: m.stderr ?? "nenhuma caixa medida", reproduce: "Verifique FFmpeg com libass e rode motion qa reel de novo." });
    else {
      const W = t.output.width, H = t.output.height;
      const out = [];
      for (const b of m.boxes) {
        const reasons = [];
        if (b.y1 < (sz.margins.top / 100) * H) reasons.push("topo");
        if (b.y2 > (1 - sz.margins.bottom / 100) * H) reasons.push("base");
        if (b.x1 < (sz.margins.left / 100) * W) reasons.push("esquerda");
        for (const r of sz.reservedRegions) {
          const rx1 = (r.x / 100) * W, rx2 = ((r.x + r.width) / 100) * W, ry1 = (r.y / 100) * H, ry2 = ((r.y + r.height) / 100) * H;
          if (b.x2 > rx1 && b.x1 < rx2 && b.y2 > ry1 && b.y1 < ry2) reasons.push(r.id);
        }
        if (reasons.length) out.push(`${round(b.t, 2)}s (${reasons.join(",")})`);
      }
      const ys = m.boxes.map((b) => [b.y1, b.y2]);
      report.add({ id: "captions.safe-zone", title: `Legendas dentro da zona segura ${sz.platform} (medido no render do ASS)`, status: out.length ? "FAIL" : "PASS", details: out.length ? `fora: ${out.slice(0, 6).join("; ")}` : `${m.boxes.length} páginas medidas; faixa vertical ${Math.min(...ys.map((y) => y[0]))}–${Math.max(...ys.map((y) => y[1]))} px` });
      const fb = t.framing?.faceBox;
      if (!fb) report.add({ id: "captions.face", title: "Legendas fora de olhos/boca", status: "NOT_TESTED", details: "sem faceBox declarado" });
      else {
        const band = [(fb.y + 0.35 * fb.h) * H, (fb.y + 0.7 * fb.h) * H];
        const hits = m.boxes.filter((b) => b.y1 < band[1] && b.y2 > band[0]);
        const src = t.framing.faceBoxSource;
        report.add({ id: "captions.face", title: "Legendas não cobrem olhos/boca (faixa do rosto declarado)", heuristic: true, status: hits.length ? "WARN" : src === "operator" ? "PASS" : "WARN", details: `${hits.length} páginas sobre a faixa ${Math.round(band[0])}–${Math.round(band[1])} px; rosto ${src === "operator" ? "declarado pelo operador a partir dos stills" : "padrão do preset (sem detecção automática)"}; zoom pode deslocar o rosto` });
      }
    }
  } else report.add({ id: "captions.sync", title: "Legendas sincronizadas", status: "NOT_TESTED", details: "edição sem legendas (sem transcrição)" });

  // overlays from the render report
  const rr = o.renderReport;
  if (t.overlays?.length) {
    const max = t.effective?.overlays?.maxEmptySec;
    if (max !== undefined) {
      const empty = overlayLayers(structuredClone(t.overlays)).filter((l) => !layerTexts(l).length && l.end - l.start > max + 0.2 + 1 / fps);
      report.add({ id: "overlays.empty", title: `Cards não ficam vazios por mais de ${max} s`, status: empty.length ? "FAIL" : "PASS", details: empty.length ? empty.map((l) => `${l.overlay.id} ${round(l.end - l.start, 2)}s`).join(", ") : null });
      const early = t.overlays.filter((o) => o.anchor?.word && o.dst[0] < o.anchor.t - t.effective.overlays.anticipationToleranceSec - 1 / fps);
      report.add({ id: "overlays.anticipation", title: "Cards não antecipam a fala da âncora", status: early.length ? "FAIL" : "PASS", details: early.length ? early.map((o) => o.id).join(", ") : null });
    }
    if (!rr?.overlays) report.add({ id: "overlays.render", title: "Cards renderizados (Chromium)", status: "NOT_TESTED", details: "relatório de render ausente" });
    else {
      const bad = rr.overlays.filter((x) => x.qa?.status === "FAIL" || x.qa?.fontsLoaded === false || x.qa?.overflow > 0);
      const vis = rr.overlays.filter((x) => x.qa?.visual && (x.qa.visual.outsideSafeZone?.length || x.qa.visual.lowContrast?.length || x.qa.visual.tiny?.length));
      report.add({ id: "overlays.render", title: "Cards: fontes carregadas e sem overflow", status: bad.length ? "FAIL" : "PASS", details: `${rr.overlays.length} camadas${bad.length ? `; problemas: ${bad.map((x) => x.id).join(", ")}` : ""}` });
      const why = (v) => [v.outsideSafeZone?.length ? `fora da safe zone genérica (${v.outsideSafeZone.map((e) => `${e.el} topo ${e.bounds?.top}px`).join("; ")})` : null, v.lowContrast?.length ? `baixo contraste (${v.lowContrast.length})` : null, v.tiny?.length ? `texto pequeno (${v.tiny.length})` : null].filter(Boolean).join(", ");
      report.add({ id: "overlays.visual", title: "Cards: zona segura, contraste e tamanho de texto (DOM, heurística genérica video-vertical: topo 15%)", heuristic: true, status: vis.length ? "WARN" : "PASS", details: vis.length ? vis.map((x) => `${x.id}${x.step !== null ? `#${x.step}` : ""}: ${why(x.qa.visual)}`).join(" | ") : null });
    }
  }

  // A/V alignment: treated voice WAV vs the muxed AAC track
  if (rr?.files?.voice && existsSync(rr.files.voice)) {
    const lat = await measureLatency(rr.files.voice, mp4, { start: 0, duration: Math.min(20, t.output.durationSec) });
    report.add({ id: "av.sync", title: "Trilha do MP4 alinhada à voz tratada (t=0 = quadro 0)", status: Math.abs(lat.seconds) <= Q.avSync.passSec ? "PASS" : Math.abs(lat.seconds) <= 1 / fps ? "WARN" : "FAIL", details: `desvio ${round(lat.seconds * 1000, 2)} ms (correlação ${lat.envelopeCorrelation})` });
  } else report.add({ id: "av.sync", title: "Trilha do MP4 alinhada à voz tratada", status: "NOT_TESTED", details: "voz tratada do render não disponível" });

  if (o.compareWith) {
    const c = await compareRenders(mp4, o.compareWith);
    report.add({ id: "determinism", title: "Render reprodutível (hash de quadros/amostras decodificados)", status: c.identical ? "PASS" : c.a && c.b ? "FAIL" : "BLOCKED", details: c.identical ? "idêntico ao segundo render" : "diferente do segundo render", reproduce: c.a && c.b ? null : "Renderize duas vezes a mesma timeline e compare com motion qa reel --compare." });
  } else report.add({ id: "determinism", title: "Render reprodutível", status: "NOT_TESTED", required: false, details: "use --compare=<segundo_render.mp4>" });

  await addHumanChecks(report, mp4, o.reviewsDir);
  return report;
}

export async function loadRenderReport(mp4) {
  const f = mp4.replace(/\.mp4$/i, "") + ".render.json";
  try { return JSON.parse(await readFile(f, "utf8")); } catch { return null; }
}
