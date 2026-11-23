/**
 * MOTION CLI — `motion edit …` (Smart Reel Editor & Voice Studio) and `motion stt …`.
 * Every subcommand accepts --json and prints one JSON document: {ok, command, ...}.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function core() {
  const mod = await import("@technomanceer/motion-core").catch(() => import("../../motion-core/index.js"));
  return mod.reel;
}

const readJson = async (f) => JSON.parse(await readFile(f, "utf8"));
const num = (v, d) => (v === undefined || v === true ? d : Number(v));

function out(flags, command, payload, human) {
  if (flags.json) console.log(JSON.stringify({ ok: true, command, ...payload }, null, 2));
  else console.log(human ?? JSON.stringify(payload, null, 2));
}

/** Rewrites config-relative paths so they stay valid relative to the timeline file. */
function rebasePaths(config, configDir, timelineDir) {
  const fix = (p) => (p && !path.isAbsolute(p) ? path.relative(timelineDir, path.resolve(configDir, p)) || "." : p);
  const c = structuredClone(config);
  if (c.captions?.fontsDir) c.captions.fontsDir = fix(c.captions.fontsDir);
  if (c.overlayStyle?.fontsDir) c.overlayStyle.fontsDir = fix(c.overlayStyle.fontsDir);
  if (c.audio?.music?.path) c.audio.music.path = fix(c.audio.music.path);
  return c;
}

/** Plan shared by the CLI and the MCP server, so both resolve config, brief and paths alike. */
export async function buildPlan(R, video, o) {
  const output = path.resolve(o.output);
  let config = {};
  if (o.config) config = rebasePaths(await readJson(o.config), path.dirname(path.resolve(o.config)), path.dirname(output));
  let transcript = o.transcript ? await readJson(o.transcript) : null;
  if (transcript && config.corrections?.length) transcript = R.applyCorrections(transcript, config.corrections);
  const brief = o.brief ? await R.loadBrief(o.brief) : null;
  let suggestions = [];
  if (brief?.glossary && transcript) { const g = R.applyGlossary(transcript, brief.glossary, { briefSha256: brief.sha256 }); transcript = g.transcript; suggestions = g.suggestions; }
  const analysis = o.analysis ? await readJson(o.analysis) : null;
  const { corrections, preset: cfgPreset, ...opts } = config;
  if (brief) for (const k of ["opening", "openingText", "openingApproval", "keywords"]) if (brief[k] !== undefined && opts[k] === undefined) opts[k] = brief[k];
  const t = await R.planEdit(video, { analysis, transcript, preset: o.preset || cfgPreset || "talking-head", ...opts });
  for (const g of suggestions) t.review.push({ src: [g.start, g.end], reason: `glossário sugere "${g.term}" para "${g.heard}" (semelhança ${g.similarity}, confiança ${g.confidence}); não aplicado`, by: "engine" });
  if (brief) t.brief = { path: path.relative(path.dirname(output), path.resolve(o.brief)), sha256: brief.sha256 };
  await mkdir(path.dirname(output), { recursive: true });
  return { timeline: t, saved: await R.saveTimeline(t, output), output };
}

export const EDIT_HELP = `
  motion edit — Smart Reel Editor & Voice Studio (headless, agnóstico de agente; --json em todos)

    edit analyze <video> [--output=analysis.json] [--stills=<dir>]
    edit transcribe <video> [--provider=faster-whisper] [--model=small] [--compute-type=int8] [--language=pt]
                    [--hotwords="IA, Claude Code"] [--corrections=corrections.json] [--output=transcript.json] [--srt=out.srt]
    edit import-srt <legenda.srt> [--media=<video_da_legenda>] [--output=transcript.json]
    edit plan <video> [--preset=talking-head] [--transcript=t.json] [--analysis=a.json] [--config=edit.config.json] [--brief=BRIEF.md] --output=edit.json
    edit validate <edit.json>
    edit audio <video> [--preset=clean] --output=voice.wav [--ab=<dir>] [--report=voice.json] [--denoiser=auto|ffmpeg|deepfilternet|none] [--music=trilha.wav]
    edit captions <edit.json> --output-dir=<dir>      Exporta SRT/ASS/JSON sem renderizar
    edit preview <edit.json> --output=preview.mp4     Meia resolução, rápido
    edit render <edit.json> --output=reel.mp4 [--ab=<dir>] [--keep-work]
    edit progress <saida.mp4>
    edit presets

  motion audio doctor
  motion stt doctor | providers | setup [--model=small] [--yes]
  motion qa reel <reel.mp4> [--timeline=edit.json] [--compare=outro_render.mp4] [--json]
`;

export async function runEdit(sub, args, flags) {
  const command = `edit ${sub ?? ""}`.trim();
  try {
    const R = await core();
    switch (sub) {
      case "presets": {
        const payload = { edit: R.listEditPresets(), voice: R.listVoicePresets(), overlays: R.OVERLAY_KINDS, stt: R.listSttProviders() };
        return out(flags, command, payload, [
          "Presets de edição:", ...payload.edit.map((p) => `  ${p.id.padEnd(13)} ${p.description}`),
          "Presets de voz:", ...payload.voice.map((p) => `  ${p.id.padEnd(13)} ${p.description}`),
          `Overlays: ${payload.overlays.join(", ")}`, "Provedores STT:", ...payload.stt.map((p) => `  ${p.id.padEnd(15)} ${p.implemented ? "implementado" : "não implementado"} — ${p.description}`),
        ].join("\n"));
      }
      case "analyze": {
        const video = args[0];
        if (!video) throw new TypeError("Uso: motion edit analyze <video> [--output=analysis.json]");
        const a = await R.analyzeMedia(video, { stillsDir: flags.stills || null });
        if (flags.output) await writeFile(flags.output, JSON.stringify(a, null, 2));
        const au = a.audio;
        return out(flags, command, { analysis: a, output: flags.output ?? null }, [
          `${path.basename(video)} — ${a.probe.video ? `${a.probe.video.width}×${a.probe.video.height} ${a.probe.video.codec} ${a.probe.video.fps} fps` : "sem vídeo"}, ${a.probe.durationSec}s`,
          au ? `Áudio: ${a.probe.audio.codec} ${a.probe.audio.sampleRate} Hz ${a.probe.audio.channels}ch · ${au.loudness.integratedLufs} LUFS · TP ${au.loudness.truePeakDbtp} dBTP · LRA ${au.loudness.lraLu} LU` : "Sem áudio",
          au ? `Fala ${au.speechSec}s (${Math.round(au.speechRatio * 100)}%) · ruído ${au.noiseFloorDb} dBFS · SNR ~${au.snrDb} dB · zumbido: ${au.hum.detected ? `${au.hum.baseHz} Hz` : "não"} · pausas cortáveis: ${au.cutOpportunities.pausesOver300ms} (${au.cutOpportunities.removableSec}s)` : "",
          `Preset de voz sugerido: ${a.recommendations.voicePreset ?? "-"}`, ...a.warnings.map((w) => `⚠ ${w}`),
        ].filter(Boolean).join("\n"));
      }
      case "transcribe": {
        const video = args[0];
        if (!video) throw new TypeError("Uso: motion edit transcribe <video> [--output=transcript.json]");
        let t = await R.transcribeMedia(video, { provider: flags.provider || "faster-whisper", model: flags.model || "small", computeType: flags["compute-type"] || "int8", device: flags.device || "cpu", language: flags.language || null, hotwords: flags.hotwords || null, initialPrompt: flags.prompt || null, beamSize: num(flags["beam-size"], 5), threads: num(flags.threads, 0) });
        if (flags.corrections) t = R.applyCorrections(t, (await readJson(flags.corrections)).corrections ?? []);
        const output = flags.output || video.replace(/\.[^.]+$/, "") + ".transcript.json";
        await writeFile(output, JSON.stringify(t, null, 2));
        if (flags.srt) await writeFile(flags.srt, R.transcriptToSrt(t));
        return out(flags, command, { output, srt: flags.srt ?? null, language: t.language, languageProbability: t.languageProbability, words: t.words.length, review: t.review.length, warnings: t.warnings, provider: t.provider },
          `Transcrição (${t.provider.id} ${t.provider.model?.name ?? ""} rev ${t.provider.model?.revision?.slice(0, 10) ?? "?"}): ${t.language} (p=${t.languageProbability}) · ${t.words.length} palavras · ${t.review.length} para revisar\n→ ${output}${flags.srt ? `\n→ ${flags.srt}` : ""}${t.warnings.map((w) => `\n⚠ ${w}`).join("")}`);
      }
      case "import-srt": {
        if (!args[0]) throw new TypeError("Uso: motion edit import-srt <legenda.srt> [--media=<video>] [--output=transcript.json]");
        const t = await R.importSubtitleFile(args[0], { media: flags.media || null, language: flags.language || null });
        const output = flags.output || args[0].replace(/\.[^.]+$/, "") + ".transcript.json";
        await writeFile(output, JSON.stringify(t, null, 2));
        return out(flags, command, { output, words: t.words.length, scope: t.scope, appliesTo: t.source, warnings: t.warnings }, `Legenda importada: ${t.words.length} palavras (escopo: ${t.scope}) → ${output}${t.warnings.map((w) => `\n⚠ ${w}`).join("")}`);
      }
      case "plan": {
        const video = args[0];
        if (!video || !flags.output) throw new TypeError("Uso: motion edit plan <video> --output=edit.json [--transcript=t.json] [--config=edit.config.json] [--preset=talking-head]");
        const { timeline: t, saved, output } = await buildPlan(await core(), video, flags);
        return out(flags, command, { output, hash: saved.hash, stats: t.stats, opening: t.opening, decisions: t.decisions, review: t.review, warnings: t.warnings },
          `Plano: ${t.stats.sourceSec}s → ${t.stats.outputSec}s (−${t.stats.removedSec}s) · ${t.segments.length} segmentos · ${t.stats.cuts} cortes · ${t.stats.zoomCuts} zoom cuts · ${t.captions.pages.length} páginas de legenda · ${t.overlays.length} cards\n` +
          `Decisões: ${t.decisions.length} · para revisar: ${t.review.length} · palavras perdidas sem decisão: ${t.stats.wordsLostUnexpected}\n→ ${output}${t.warnings.map((w) => `\n⚠ ${w}`).join("")}`);
      }
      case "validate": {
        if (!args[0]) throw new TypeError("Uso: motion edit validate <edit.json>");
        const t = await readJson(args[0]);
        const errors = R.validateTimeline(t);
        const hashOk = !t.hash || t.hash === R.timelineHash(t);
        if (errors.length || !hashOk) process.exitCode = 2;
        return out(flags, command, { valid: !errors.length, errors, hashMatches: hashOk }, errors.length ? `Timeline inválida:\n${errors.map((e) => `- ${e}`).join("\n")}` : `Timeline válida${hashOk ? "" : " (hash difere: arquivo editado à mão — será recalculado no próximo plan/save)"}.`);
      }
      case "audio": {
        const video = args[0];
        if (!video || !flags.output) throw new TypeError("Uso: motion edit audio <video> --output=voice.wav [--preset=clean] [--ab=<dir>]");
        const r = await R.processVoice(video, { output: flags.output, preset: flags.preset || "clean", denoiser: flags.denoiser || "auto", abDir: flags.ab || null, music: flags.music ? { path: flags.music, gainDb: num(flags["music-gain"], -18) } : null });
        if (flags.report) await writeFile(flags.report, JSON.stringify(r, null, 2));
        if (r.qa.status === "FAIL") process.exitCode = 2;
        return out(flags, command, { report: r }, [
          `Voz tratada (${r.params.preset}, denoiser ${r.denoiser}) → ${r.output}`,
          `Antes: ${r.before.loudness.integratedLufs} LUFS / ${r.before.loudness.truePeakDbtp} dBTP · Depois: ${r.after.loudness.integratedLufs} LUFS / ${r.after.loudness.truePeakDbtp} dBTP`,
          `QA: ${r.qa.status}`, ...r.qa.checks.map((c) => `  ${c.status.padEnd(10)} ${c.title}${c.details ? ` — ${c.details}` : ""}`),
          r.ab ? `A/B (${r.ab.clips.length} trechos, volume igualado): ${r.ab.index}` : "",
        ].filter(Boolean).join("\n"));
      }
      case "captions": {
        if (!args[0] || !flags["output-dir"]) throw new TypeError("Uso: motion edit captions <edit.json> --output-dir=<dir>");
        const t = await R.loadTimeline(args[0]);
        const dir = path.resolve(flags["output-dir"]);
        await mkdir(dir, { recursive: true });
        const files = { srt: path.join(dir, "captions.srt"), wordsSrt: path.join(dir, "captions.words.srt"), ass: path.join(dir, "captions.ass"), json: path.join(dir, "captions.json") };
        await writeFile(files.srt, R.pagesToSrt(t.captions.pages));
        await writeFile(files.wordsSrt, R.wordsToSrt(t.captions.words));
        await writeFile(files.ass, R.buildAss(t.captions.pages, { width: t.output.width, height: t.output.height, styleIn: t.captions.style, placement: t.captions.placement }));
        await writeFile(files.json, JSON.stringify(R.captionsJson(t.captions.pages, { placement: t.captions.placement, style: t.captions.style, timelineHash: t.hash }), null, 2));
        return out(flags, command, { files, pages: t.captions.pages.length }, `Legendas exportadas (${t.captions.pages.length} páginas):\n${Object.values(files).map((f) => `→ ${f}`).join("\n")}`);
      }
      case "preview":
      case "render": {
        if (!args[0] || !flags.output) throw new TypeError(`Uso: motion edit ${sub} <edit.json> --output=<arquivo.mp4>`);
        const t = await R.loadTimeline(args[0]);
        const r = await R.renderTimeline(t, { output: flags.output, mode: sub === "preview" ? "preview" : "final", keepWork: Boolean(flags["keep-work"]), voiceAbDir: flags.ab || null, concurrency: num(flags.concurrency, 2) });
        return out(flags, command, { report: r }, `${sub === "preview" ? "Prévia" : "Render final"}: ${r.output} (${r.width}×${r.height}, ${r.durationSec}s, ${r.timings.totalSec}s de render)\nRelatório: ${r.files.report}${r.warnings.map((w) => `\n⚠ ${w}`).join("")}\nPróximo passo: motion qa reel ${r.output} --timeline=${r.files.timeline}`);
      }
      case "progress": {
        if (!args[0]) throw new TypeError("Uso: motion edit progress <saida.mp4>");
        const p = await R.readProgress(args[0]);
        return out(flags, command, { progress: p }, `${p.status} · ${p.stage ?? ""} ${p.percent ?? ""}%`);
      }
      default:
        console.log(EDIT_HELP);
        if (sub) { process.exitCode = 1; console.error(`Subcomando desconhecido: edit ${sub}`); }
    }
  } catch (error) {
    if (flags.json) {
      console.log(JSON.stringify({ ok: false, command, error: { code: error.code ?? "MOTION_UNEXPECTED", message: error.message, hint: error.hint ?? null, details: error.details ?? null } }, null, 2));
      process.exitCode = error.exitCode && error.exitCode > 1 ? error.exitCode : 2;
      return;
    }
    throw error;
  }
}

export async function runAudio(sub, args, flags) {
  if (sub !== "doctor") { console.log("Uso: motion audio doctor [--json]   (tratamento: motion edit audio)"); if (sub) process.exitCode = 1; return; }
  const R = await core();
  const d = await R.audioDoctor();
  if (!d.ok) process.exitCode = 3;
  return out(flags, "audio doctor", d, [`${d.ffmpeg ?? "FFmpeg ausente"}`, d.missingFilters.length ? `✗ filtros ausentes: ${d.missingFilters.join(", ")}` : "✓ filtros de voz", `DeepFilterNet ${d.deepfilternet.version}: ${d.deepfilternet.state}${d.deepfilternet.reason ? ` — ${d.deepfilternet.reason}` : ""}`, `Modo auto usa: ${d.autoDenoiser}`, ...d.warnings.map((w) => `⚠ ${w}`)].join("\n"));
}

export async function runStt(sub, args, flags) {
  const R = await core();
  switch (sub) {
    case "providers":
      return out(flags, "stt providers", { providers: R.listSttProviders() }, R.listSttProviders().map((p) => `${p.id.padEnd(15)} ${p.kind.padEnd(6)} ${p.implemented ? "implementado    " : "não implementado"} ${p.description}`).join("\n"));
    case "doctor": {
      const d = await R.sttDoctor({ model: flags.model || "small" });
      const fw = d.providers.find((p) => p.id === "faster-whisper");
      if (!fw.ok) process.exitCode = 3;
      return out(flags, "stt doctor", d, [`Python STT: ${d.python}`, `Modelos: ${d.modelsDir}`, ...d.providers.map((p) => `${p.ok ? "✓" : "✗"} ${p.id}${p.ok ? ` — ${p.details?.versions ? `faster-whisper ${p.details.versions.faster_whisper}, CTranslate2 ${p.details.versions.ctranslate2}, modelo ${p.details.model?.name} rev ${p.details.model?.revision?.slice(0, 10)}` : ""}` : ` — ${p.reason}${p.hint ? ` (→ ${p.hint})` : ""}`}`)].join("\n"));
    }
    case "setup": {
      const cmds = R.setupCommands({ model: flags.model || "small" });
      if (!flags.yes) return out(flags, "stt setup", { executed: false, commands: cmds }, `Ambiente isolado de transcrição (nada foi instalado). Rode com --yes para executar, ou manualmente:\n${cmds.join("\n")}`);
      const home = path.dirname(R.sttPython()).replace(/[\\/](bin|Scripts)$/, "");
      const uv = spawnSync("uv", ["--version"]).status === 0;
      const steps = uv
        ? [["uv", ["venv", "--python", "python3", home]], ["uv", ["pip", "install", "--python", R.sttPython(), "faster-whisper==1.2.1"]]]
        : [["python3", ["-m", "venv", home]], [R.sttPython(), ["-m", "pip", "install", "faster-whisper==1.2.1"]]];
      for (const [i, [c, a]] of steps.entries()) {
        if (i === 0 && existsSync(R.sttPython())) continue; // venv already exists
        const r = spawnSync(c, a, { stdio: "inherit" });
        if (r.status !== 0) throw new Error(`falhou: ${c} ${a.join(" ")}`);
      }
      const worker = (await import("@technomanceer/motion-core/reel/stt").catch(() => import("../../motion-core/reel/stt/index.mjs"))).FASTER_WHISPER_WORKER;
      const r = spawnSync(R.sttPython(), [worker, "--probe", "--download", "--model", flags.model || "small", "--models-dir", R.sttModelsDir()], { stdio: ["ignore", "pipe", "inherit"], env: { ...process.env, HF_HUB_OFFLINE: "0" } });
      return out(flags, "stt setup", { executed: true, probe: String(r.stdout) }, String(r.stdout));
    }
    default:
      console.log(EDIT_HELP);
  }
}
