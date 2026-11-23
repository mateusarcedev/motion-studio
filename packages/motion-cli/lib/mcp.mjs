/**
 * MOTION CLI — `motion mcp`: local MCP server over stdio (JSON-RPC 2.0, newline-delimited).
 * No SDK dependency. Exposes the Smart Reel Editor / Voice Studio / STT operations so any
 * MCP client can drive the same engine the CLI uses. Long jobs (transcribe, audio, render)
 * run in the background and are polled with motion_job_status.
 * stdout carries protocol messages only; logs go to stderr.
 */
import { createInterface } from "node:readline";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { VERSION } from "./version.mjs";

export const PROTOCOL_VERSION = "2025-06-18";

async function core() {
  const mod = await import("@technomanceer/motion-core").catch(() => import("../../motion-core/index.js"));
  return mod.reel;
}

const S = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });
const str = (description) => ({ type: "string", description });

export const TOOLS = [
  { name: "motion_edit_presets", description: "Lista presets de edição, de voz, tipos de card e provedores STT.", inputSchema: S({}) },
  { name: "motion_edit_analyze", description: "Analisa um vídeo/áudio: metadados, loudness EBU R128, true peak, fala/pausas (VAD), ruído e zumbido. Somente leitura.", inputSchema: S({ input: str("caminho do vídeo"), output: str("JSON de saída (opcional)") }, ["input"]) },
  { name: "motion_stt_doctor", description: "Verifica provedores de Speech-to-Text (faster-whisper local em venv isolado).", inputSchema: S({ model: str("modelo, padrão small") }) },
  { name: "motion_audio_doctor", description: "Verifica filtros de voz do FFmpeg e o DeepFilterNet opcional (hash conferido).", inputSchema: S({}) },
  { name: "motion_edit_transcribe", description: "Transcreve a fala com timestamps por palavra (job em background). Retorna jobId.", inputSchema: S({ input: str("vídeo"), output: str("transcript.json"), language: str("ex.: pt (opcional: detecção automática)"), model: str("small por padrão"), hotwords: str("glossário de nomes próprios, separados por vírgula") }, ["input", "output"]) },
  { name: "motion_edit_plan", description: "Gera a timeline editável (cortes, zoom, legendas, cards) a partir do vídeo, da transcrição e de um config de decisões do operador.", inputSchema: S({ input: str("vídeo"), output: str("edit.json"), transcript: str("transcript.json"), analysis: str("analysis.json (opcional)"), config: str("edit.config.json (decisões: exclude, overlays, emphasis, faceBox...)"), brief: str("BRIEF.md com bloco motion-brief (opcional)"), preset: str("talking-head | tutorial | podcast | interview | institucional") }, ["input", "output"]) },
  { name: "motion_edit_audio", description: "Voice Studio: trata a voz (job em background) e exporta WAV + A/B.", inputSchema: S({ input: str("vídeo/áudio"), output: str("voice.wav"), preset: str("natural | clean | studio | noisy-room"), denoiser: str("auto | ffmpeg | deepfilternet | none"), music: str("trilha (opcional)"), abDir: str("pasta A/B (opcional)") }, ["input", "output"]) },
  { name: "motion_edit_render", description: "Renderiza a timeline (job em background). mode=preview (meia resolução) ou final.", inputSchema: S({ timeline: str("edit.json"), output: str("reel.mp4"), mode: { type: "string", enum: ["preview", "final"] }, abDir: str("pasta A/B (opcional)") }, ["timeline", "output"]) },
  { name: "motion_job_status", description: "Consulta o progresso/resultado de um job (transcribe, audio, render).", inputSchema: S({ jobId: str("id retornado ao iniciar o job") }, ["jobId"]) },
  { name: "motion_qa_reel", description: "QA do vídeo editado (PASS/WARN/FAIL/BLOCKED/NOT_TESTED).", inputSchema: S({ input: str("reel.mp4"), timeline: str("edit.json (opcional)"), compare: str("segundo render (opcional, determinismo)"), reviews: str("pasta reviews (opcional)") }, ["input"]) },
  { name: "motion_edit_export", description: "Empacota e verifica a entrega (delivery.contract.json → ZIP verificado).", inputSchema: S({ project: str("pasta do projeto com delivery.contract.json"), zip: str("saída .zip") }, ["project", "zip"]) },
];

const jobs = new Map();
let jobSeq = 0;
function startJob(kind, fn, meta = {}) {
  const id = `${kind}-${++jobSeq}`;
  const job = { id, kind, status: "running", startedAt: Date.now(), meta, result: null, error: null };
  jobs.set(id, job);
  fn().then((r) => { job.status = "done"; job.result = r; }).catch((e) => { job.status = "failed"; job.error = { code: e.code ?? "MOTION_UNEXPECTED", message: e.message, hint: e.hint ?? null }; });
  return job;
}

async function callTool(name, a) {
  const R = await core();
  switch (name) {
    case "motion_edit_presets": return { edit: R.listEditPresets(), voice: R.listVoicePresets(), overlays: R.OVERLAY_KINDS, stt: R.listSttProviders() };
    case "motion_edit_analyze": {
      const r = await R.analyzeMedia(a.input);
      if (a.output) await writeFile(a.output, JSON.stringify(r, null, 2));
      return r;
    }
    case "motion_stt_doctor": return R.sttDoctor({ model: a.model || "small" });
    case "motion_audio_doctor": return R.audioDoctor();
    case "motion_edit_transcribe": {
      const job = startJob("transcribe", async () => {
        const t = await R.transcribeMedia(a.input, { model: a.model || "small", language: a.language || null, hotwords: a.hotwords || null });
        await writeFile(a.output, JSON.stringify(t, null, 2));
        return { output: a.output, language: t.language, words: t.words.length, review: t.review.length, warnings: t.warnings };
      }, { input: a.input });
      return { jobId: job.id, status: job.status };
    }
    case "motion_edit_plan": {
      const { buildPlan } = await import("./edit.mjs");
      const { timeline, saved } = await buildPlan(R, a.input, a);
      return { output: a.output, hash: saved.hash, stats: timeline.stats, opening: timeline.opening, decisions: timeline.decisions, review: timeline.review, warnings: timeline.warnings };
    }
    case "motion_edit_audio": {
      const job = startJob("audio", async () => {
        const r = await R.processVoice(a.input, { output: a.output, preset: a.preset || "clean", denoiser: a.denoiser || "auto", music: a.music ? { path: a.music } : null, abDir: a.abDir || null });
        return { output: r.output, qa: r.qa, before: r.before.loudness, after: r.after.loudness, ab: r.ab };
      }, { input: a.input });
      return { jobId: job.id, status: job.status };
    }
    case "motion_edit_render": {
      const t = await R.loadTimeline(a.timeline);
      const job = startJob("render", async () => R.renderTimeline(t, { output: a.output, mode: a.mode === "final" ? "final" : "preview", voiceAbDir: a.abDir || null }), { output: a.output });
      return { jobId: job.id, status: job.status, progressFile: `${path.resolve(a.output)}.progress.json` };
    }
    case "motion_job_status": {
      const job = jobs.get(a.jobId);
      if (!job) throw Object.assign(new Error(`job desconhecido: ${a.jobId}`), { code: "MOTION_INVALID_ARGUMENT" });
      const progress = job.kind === "render" && job.status === "running" ? await R.readProgress(job.meta.output) : null;
      return { jobId: job.id, kind: job.kind, status: job.status, elapsedSec: Math.round((Date.now() - job.startedAt) / 1000), progress, result: job.result, error: job.error };
    }
    case "motion_qa_reel": {
      const { runReelQa } = await import("./qa.mjs");
      const report = await runReelQa(R, a.input, a);
      return report.toJSON();
    }
    case "motion_edit_export": {
      const api = await import("@technomanceer/motion-core").catch(() => import("../../motion-core/index.js"));
      const r = await api.exportDelivery(a.project, a.zip).catch((e) => ({ report: e.report ?? { status: "FAIL", error: e.message } }));
      return r.report;
    }
    default: throw Object.assign(new Error(`ferramenta desconhecida: ${name}`), { code: "MOTION_INVALID_ARGUMENT" });
  }
}

/** Handles one JSON-RPC message; returns a response object or null (notifications). */
export async function handleMessage(msg) {
  const reply = (result) => ({ jsonrpc: "2.0", id: msg.id, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });
  if (msg?.jsonrpc !== "2.0" || typeof msg.method !== "string") return msg?.id !== undefined ? fail(-32600, "Invalid Request") : null;
  const isNotification = msg.id === undefined || msg.id === null;
  switch (msg.method) {
    case "initialize":
      return reply({ protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "motion-studio", title: "MOTION Studio — Smart Reel Editor", version: VERSION }, instructions: "Use motion_edit_analyze → motion_edit_transcribe → motion_edit_plan → motion_edit_render (preview, depois final) → motion_qa_reel. Jobs longos: consulte motion_job_status." });
    case "notifications/initialized":
    case "notifications/cancelled":
      return null;
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const { name, arguments: args = {} } = msg.params ?? {};
      if (!TOOLS.some((t) => t.name === name)) return fail(-32602, `Unknown tool: ${name}`);
      try {
        const result = await callTool(name, args);
        return reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result && typeof result === "object" && !Array.isArray(result) ? result : { value: result }, isError: false });
      } catch (e) {
        return reply({ content: [{ type: "text", text: JSON.stringify({ code: e.code ?? "MOTION_UNEXPECTED", message: e.message, hint: e.hint ?? null }) }], isError: true });
      }
    }
    default:
      return isNotification ? null : fail(-32601, `Method not found: ${msg.method}`);
  }
}

export async function runMcpServer() {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  process.stderr.write(`motion mcp v${VERSION} pronto (stdio)\n`);
  const pending = new Set();
  for await (const line of rl) {
    if (!line.trim()) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n"); continue; }
    const p = handleMessage(msg).then((res) => { if (res) process.stdout.write(JSON.stringify(res) + "\n"); });
    pending.add(p); p.finally(() => pending.delete(p));
  }
  await Promise.all(pending);
  // keep running while background jobs finish
  while ([...jobs.values()].some((j) => j.status === "running")) await new Promise((r) => setTimeout(r, 500));
}
