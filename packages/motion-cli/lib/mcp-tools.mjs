/** Central registry for the local Motion MCP surface. Handlers call Motion Core directly. */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const S = (properties = {}, required = []) => ({ type: "object", properties, required, additionalProperties: false });
const string = (description, extra = {}) => ({ type: "string", description, ...extra });
const number = (description, extra = {}) => ({ type: "number", description, ...extra });
const integer = (description, extra = {}) => ({ type: "integer", description, ...extra });
const bool = (description) => ({ type: "boolean", description });
const object = (description) => ({ type: "object", description });
const array = (description, items = {}, extra = {}) => ({ type: "array", description, items, ...extra });
const outputSchema = {
  type: "object",
  properties: {
    status: { type: "string", description: "Status estruturado da operação, quando aplicável." },
    executed: { type: "boolean", description: "False para planos/payloads externos que ainda não foram executados." },
    error: {
      type: "object",
      properties: {
        code: { type: "string" }, message: { type: "string" }, hint: { type: ["string", "null"] }, details: {},
      },
      required: ["code", "message"], additionalProperties: true,
    },
    artifact: {
      type: "object",
      properties: {
        path: { type: "string" }, kind: { type: "string", enum: ["file", "directory"] },
        bytes: { type: "integer", minimum: 0 }, fileCount: { type: "integer", minimum: 1 },
        sha256: { type: "string", pattern: "^[a-f0-9]{64}$" }, manifestSha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
      },
      required: ["path", "kind"], additionalProperties: false,
    },
  },
  additionalProperties: true,
};

export class ToolInputError extends Error {
  constructor(message) { super(message); this.code = "MOTION_INVALID_ARGUMENT"; }
}

function validateAgainstSchema(schema, value, where = "arguments") {
  if (Array.isArray(schema.type)) {
    const failures = [];
    for (const type of schema.type) {
      try { validateAgainstSchema({ ...schema, type }, value, where); return; }
      catch (error) { failures.push(error.message); }
    }
    throw new ToolInputError(`${where} tem tipo inválido; esperado ${schema.type.join(" ou ")}.`);
  }
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new ToolInputError(`${where} deve ser um objeto.`);
    for (const key of schema.required ?? []) if (!(key in value)) throw new ToolInputError(`${where}.${key} é obrigatório.`);
    for (const [key, entry] of Object.entries(value)) {
      if (!(key in (schema.properties ?? {}))) {
        if (schema.additionalProperties === false) throw new ToolInputError(`${where}.${key} não é permitido.`);
        continue;
      }
      validateAgainstSchema(schema.properties[key], entry, `${where}.${key}`);
    }
    return;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) throw new ToolInputError(`${where} deve ser um array.`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) throw new ToolInputError(`${where} excede ${schema.maxItems} itens.`);
    if (schema.minItems !== undefined && value.length < schema.minItems) throw new ToolInputError(`${where} exige ao menos ${schema.minItems} item(ns).`);
    if (schema.items) value.forEach((entry, index) => validateAgainstSchema(schema.items, entry, `${where}[${index}]`));
    return;
  }
  if (schema.type === "string") {
    if (typeof value !== "string") throw new ToolInputError(`${where} deve ser texto.`);
    if (schema.minLength !== undefined && value.length < schema.minLength) throw new ToolInputError(`${where} é curto demais.`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) throw new ToolInputError(`${where} excede ${schema.maxLength} caracteres.`);
  } else if (schema.type === "number" || schema.type === "integer") {
    if (typeof value !== "number" || !Number.isFinite(value) || (schema.type === "integer" && !Number.isInteger(value))) throw new ToolInputError(`${where} deve ser ${schema.type === "integer" ? "um inteiro" : "um número finito"}.`);
    if (schema.minimum !== undefined && value < schema.minimum) throw new ToolInputError(`${where} deve ser >= ${schema.minimum}.`);
    if (schema.maximum !== undefined && value > schema.maximum) throw new ToolInputError(`${where} deve ser <= ${schema.maximum}.`);
  } else if (schema.type === "boolean" && typeof value !== "boolean") throw new ToolInputError(`${where} deve ser booleano.`);
  if (schema.enum && !schema.enum.includes(value)) throw new ToolInputError(`${where} deve ser um de: ${schema.enum.join(", ")}.`);
}

export function createMcpRuntime({ workspaceRoot = process.cwd(), maxConcurrency = 2, maxExecutionMs = 600_000 } = {}) {
  return {
    workspaceRoot: path.resolve(workspaceRoot),
    maxConcurrency: Math.max(1, Math.min(4, Number(maxConcurrency) || 2)),
    maxExecutionMs: Math.max(1_000, Math.min(3_600_000, Number(maxExecutionMs) || 600_000)),
    outputReservations: new Set(),
    active: 0,
    waiters: [],
    jobs: new Map(),
    jobSeq: 0,
    pending: new Map(),
  };
}

function isWithin(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel));
}

async function getRealWorkspace(ctx) {
  if (!ctx.realWorkspaceRoot) ctx.realWorkspaceRoot = await realpath(ctx.workspaceRoot);
  return ctx.realWorkspaceRoot;
}

async function resolvePath(raw, ctx, { output = false, directory = false, allowLocalUrl = false } = {}) {
  if (typeof raw !== "string" || !raw.trim()) throw new ToolInputError("Caminho vazio ou inválido.");
  if (allowLocalUrl && /^https?:\/\//i.test(raw)) {
    let url;
    try { url = new URL(raw); } catch { throw new ToolInputError("URL inválida."); }
    if (url.username || url.password) throw Object.assign(new ToolInputError("URL localhost não pode conter credenciais."), { code: "MOTION_BRIDGE_UNSAFE_URL" });
    if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(url.hostname.toLowerCase())) {
      throw Object.assign(new ToolInputError("QA por URL aceita somente localhost; use arquivo local para evitar acesso externo/SSRF."), { code: "MOTION_BRIDGE_UNSAFE_URL" });
    }
    return url.href;
  }
  const root = await getRealWorkspace(ctx);
  const candidate = path.resolve(root, raw);
  if (!isWithin(root, candidate)) throw Object.assign(new ToolInputError("Caminho fora do workspace MCP."), { code: "MOTION_BRIDGE_PATH_TRAVERSAL" });
  if (!output) {
    let real;
    try { real = await realpath(candidate); } catch { throw new ToolInputError(`Caminho não existe: ${raw}`); }
    if (!isWithin(root, real)) throw Object.assign(new ToolInputError("Symlink sai do workspace MCP."), { code: "MOTION_BRIDGE_PATH_TRAVERSAL" });
    const info = await stat(real);
    if (directory ? !info.isDirectory() : !info.isFile()) throw new ToolInputError(`${raw} deve ser ${directory ? "um diretório" : "um arquivo"}.`);
    return real;
  }
  try {
    await lstat(candidate);
    throw Object.assign(new ToolInputError(`A saída já existe; para preservar arquivos, escolha outro caminho: ${raw}`), { code: "MOTION_OUTPUT_EXISTS" });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  let parent = path.dirname(candidate);
  for (;;) {
    try {
      const realParent = await realpath(parent);
      if (!isWithin(root, realParent)) throw Object.assign(new ToolInputError("Diretório de saída sai do workspace MCP."), { code: "MOTION_BRIDGE_PATH_TRAVERSAL" });
      break;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const next = path.dirname(parent);
      if (next === parent) throw Object.assign(new ToolInputError("Não foi possível resolver diretório de saída."), { code: "MOTION_BRIDGE_PATH_TRAVERSAL" });
      parent = next;
    }
  }
  const runtime = ctx.runtime ?? ctx;
  const reservations = runtime.outputReservations ?? (runtime.outputReservations = new Set());
  for (const reserved of reservations) {
    if (isWithin(reserved, candidate) || isWithin(candidate, reserved)) {
      throw Object.assign(new ToolInputError(`Saída conflita com outra operação MCP em andamento: ${raw}`), { code: "MOTION_OUTPUT_BUSY" });
    }
  }
  reservations.add(candidate);
  ctx.reservedOutputs?.push(candidate);
  return candidate;
}

async function prepareOutput(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function readJson(filePath) {
  const bytes = await readFile(filePath);
  if (bytes.length > 20 * 1024 * 1024) throw new ToolInputError("JSON de entrada excede o limite de 20 MiB.");
  try { return JSON.parse(bytes.toString("utf8")); }
  catch { throw new ToolInputError(`JSON inválido em ${filePath}.`); }
}

async function writeJsonNew(filePath, value) {
  await prepareOutput(filePath);
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

async function artifactIntegrity(filePath, displayPath = filePath) {
  const rootInfo = await lstat(filePath);
  const records = [];
  async function visit(current, relative = "") {
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error(`Artefato contém symlink inesperado: ${current}`);
    if (info.isDirectory()) {
      const names = (await readdir(current)).sort();
      if (records.length + names.length > 100_000) throw new Error(`Artefato contém mais de 100.000 entradas: ${filePath}`);
      for (const name of names) await visit(path.join(current, name), path.join(relative, name));
    } else if (info.isFile()) {
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(current)) hash.update(chunk);
      records.push({ path: relative || path.basename(current), bytes: info.size, sha256: hash.digest("hex") });
    }
  }
  await visit(filePath);
  if (!records.length) throw new Error(`Nenhum artefato regular foi produzido em ${filePath}.`);
  records.sort((a, b) => a.path.localeCompare(b.path));
  const bytes = records.reduce((total, item) => total + item.bytes, 0);
  const manifest = records.map(({ path: name, bytes: size, sha256 }) => `${name}\0${size}\0${sha256}`).join("\n");
  return rootInfo.isDirectory()
    ? { path: displayPath, kind: "directory", fileCount: records.length, bytes, manifestSha256: createHash("sha256").update(manifest).digest("hex") }
    : { path: displayPath, kind: "file", ...records[0] };
}

async function runLimited(ctx, fn, signal) {
  if (signal?.aborted) throw Object.assign(new Error("Execução cancelada antes de iniciar."), { code: "MOTION_CANCELLED" });
  if (ctx.active >= ctx.maxConcurrency) {
    await new Promise((resolve, reject) => {
      const waiter = { resolve, reject, signal, abort: null };
      waiter.abort = () => {
        ctx.waiters = ctx.waiters.filter((entry) => entry !== waiter);
        reject(Object.assign(new Error("Execução cancelada durante a espera pela vaga local."), { code: "MOTION_CANCELLED" }));
      };
      signal?.addEventListener("abort", waiter.abort, { once: true });
      ctx.waiters.push(waiter);
    });
  }
  if (signal?.aborted) {
    const next = ctx.waiters.shift();
    if (next) {
      next.signal?.removeEventListener("abort", next.abort);
      next.resolve();
    }
    throw Object.assign(new Error("Execução cancelada antes de iniciar."), { code: "MOTION_CANCELLED" });
  }
  ctx.active++;
  try { return await fn(); }
  finally {
    ctx.active--;
    const next = ctx.waiters.shift();
    if (next) {
      next.signal?.removeEventListener("abort", next.abort);
      next.resolve();
    }
  }
}

function startJob(kind, fn, meta, ctx) {
  const state = ctx.runtime ?? ctx;
  const id = `${kind}-${++state.jobSeq}`;
  const job = { id, kind, status: "running", startedAt: Date.now(), meta, result: null, error: null, reservedOutputs: [...(ctx.reservedOutputs ?? [])] };
  if (job.reservedOutputs.length) ctx.keepOutputReservations = true;
  state.jobs.set(id, job);
  runLimited(state, fn, null).then((result) => { job.status = "done"; job.result = result; }).catch((error) => {
    job.status = "failed";
    job.error = { code: error.code ?? "MOTION_UNEXPECTED", message: error.message, hint: error.hint ?? null };
  }).finally(() => {
    for (const output of job.reservedOutputs) state.outputReservations.delete(output);
  });
  return job;
}

async function loadCore() {
  return import("@technomanceer/motion-core").catch(() => import("../../motion-core/index.js"));
}

function legacyTool(name, description, inputSchema) {
  return { name, description, inputSchema, outputSchema, handler: (args, context) => callLegacy(name, args, context) };
}

function tool(name, description, properties, required, handler) {
  return { name, description, inputSchema: S(properties, required), outputSchema, handler };
}

const legacyTools = [
  legacyTool("motion_edit_presets", "Lista presets de edição, voz, tipos de card e provedores STT.", S({})),
  legacyTool("motion_edit_analyze", "Analisa vídeo/áudio local: metadados, loudness, true peak, fala/pausas, ruído e zumbido.", S({ input: string("Vídeo/áudio existente dentro do workspace"), output: string("JSON de saída novo (opcional)") }, ["input"])),
  legacyTool("motion_stt_doctor", "Verifica provedores de Speech-to-Text locais.", S({ model: string("Modelo; padrão small") })),
  legacyTool("motion_audio_doctor", "Verifica filtros locais de voz e denoiser opcional.", S({})),
  legacyTool("motion_edit_transcribe", "Transcreve localmente com timestamps por palavra; retorna jobId.", S({ input: string("Vídeo local"), output: string("Novo transcript.json"), language: string("Idioma opcional"), model: string("Modelo opcional"), hotwords: string("Termos separados por vírgula") }, ["input", "output"])),
  legacyTool("motion_edit_plan", "Gera timeline editável a partir da mídia, transcrição e decisões do operador.", S({ input: string("Vídeo local"), output: string("Novo edit.json"), transcript: string("Transcrição local"), analysis: string("analysis.json opcional"), config: string("Config local opcional"), brief: string("BRIEF.md opcional"), preset: string("Preset opcional") }, ["input", "output", "transcript"])),
  legacyTool("motion_edit_audio", "Trata áudio localmente e exporta WAV/A-B como job.", S({ input: string("Vídeo/áudio local"), output: string("Novo WAV"), preset: string("Preset de voz"), denoiser: string("Denoiser"), music: string("Trilha local opcional"), abDir: string("Diretório A/B novo opcional") }, ["input", "output"])),
  legacyTool("motion_edit_render", "Renderiza uma timeline de edição local; retorna jobId.", S({ timeline: string("Timeline local"), output: string("Novo MP4"), mode: { type: "string", enum: ["preview", "final"] }, abDir: string("Diretório A/B opcional") }, ["timeline", "output"])),
  legacyTool("motion_job_status", "Consulta progresso e resultado de um job local.", S({ jobId: string("ID retornado ao iniciar job") }, ["jobId"])),
  legacyTool("motion_qa_reel", "Executa QA local do vídeo editado; PASS/WARN/FAIL/BLOCKED/NOT_TESTED.", S({ input: string("MP4 local"), timeline: string("Timeline opcional"), compare: string("Segundo render opcional"), reviews: string("Pasta de reviews opcional") }, ["input"])),
  legacyTool("motion_edit_export", "Empacota projeto local com contrato de entrega e verifica o ZIP.", S({ project: string("Pasta local com delivery.contract.json"), zip: string("Novo ZIP de saída") }, ["project", "zip"])),
];

async function callLegacy(name, a, ctx) {
  const mod = await loadCore();
  const R = mod.reel;
  switch (name) {
    case "motion_edit_presets": return { edit: R.listEditPresets(), voice: R.listVoicePresets(), overlays: R.OVERLAY_KINDS, stt: R.listSttProviders() };
    case "motion_edit_analyze": {
      const input = await resolvePath(a.input, ctx);
      const output = a.output ? await resolvePath(a.output, ctx, { output: true }) : null;
      const result = await R.analyzeMedia(input);
      if (output) await writeJsonNew(output, result);
      return { ...result, ...(output ? { artifact: await artifactIntegrity(output, a.output) } : {}) };
    }
    case "motion_stt_doctor": return R.sttDoctor({ model: a.model || "small" });
    case "motion_audio_doctor": return R.audioDoctor();
    case "motion_edit_transcribe": {
      const input = await resolvePath(a.input, ctx), output = await resolvePath(a.output, ctx, { output: true });
      const job = startJob("transcribe", async () => {
        const transcript = await R.transcribeMedia(input, { model: a.model || "small", language: a.language || null, hotwords: a.hotwords || null });
        await writeJsonNew(output, transcript);
        return { output: a.output, language: transcript.language, words: transcript.words.length, review: transcript.review.length, warnings: transcript.warnings, artifact: await artifactIntegrity(output, a.output) };
      }, { input: a.input }, ctx);
      return { jobId: job.id, status: job.status };
    }
    case "motion_edit_plan": {
      const input = await resolvePath(a.input, ctx), output = await resolvePath(a.output, ctx, { output: true });
      const opts = { ...a, input, output };
      for (const key of ["transcript", "analysis", "config", "brief"]) if (a[key]) opts[key] = await resolvePath(a[key], ctx);
      const { buildPlan } = await import("./edit.mjs");
      const { timeline, saved } = await buildPlan(R, input, opts);
      return { output: a.output, hash: saved.hash, stats: timeline.stats, opening: timeline.opening, decisions: timeline.decisions, review: timeline.review, warnings: timeline.warnings, artifact: await artifactIntegrity(output, a.output) };
    }
    case "motion_edit_audio": {
      const input = await resolvePath(a.input, ctx), output = await resolvePath(a.output, ctx, { output: true });
      const music = a.music ? await resolvePath(a.music, ctx) : null;
      const abDir = a.abDir ? await resolvePath(a.abDir, ctx, { output: true }) : null;
      const job = startJob("audio", async () => {
        const result = await R.processVoice(input, { output, preset: a.preset || "clean", denoiser: a.denoiser || "auto", music: music ? { path: music } : null, abDir });
        return { output: a.output, qa: result.qa, before: result.before.loudness, after: result.after.loudness, ab: result.ab, artifact: await artifactIntegrity(output, a.output) };
      }, { input: a.input }, ctx);
      return { jobId: job.id, status: job.status };
    }
    case "motion_edit_render": {
      const timelinePath = await resolvePath(a.timeline, ctx), output = await resolvePath(a.output, ctx, { output: true });
      const timeline = await R.loadTimeline(timelinePath);
      const abDir = a.abDir ? await resolvePath(a.abDir, ctx, { output: true }) : null;
      const job = startJob("render", async () => {
        const result = await R.renderTimeline(timeline, { output, mode: a.mode === "final" ? "final" : "preview", voiceAbDir: abDir });
        return { ...result, artifact: await artifactIntegrity(output, a.output) };
      }, { output }, ctx);
      return { jobId: job.id, status: job.status, progressFile: `${output}.progress.json` };
    }
    case "motion_job_status": {
      const job = (ctx.runtime ?? ctx).jobs.get(a.jobId);
      if (!job) throw Object.assign(new Error(`job desconhecido: ${a.jobId}`), { code: "MOTION_INVALID_ARGUMENT" });
      const progress = job.kind === "render" && job.status === "running" ? await R.readProgress(job.meta.output) : null;
      return { jobId: job.id, kind: job.kind, status: job.status, elapsedSec: Math.round((Date.now() - job.startedAt) / 1000), progress, result: job.result, error: job.error };
    }
    case "motion_qa_reel": {
      const { runReelQa } = await import("./qa.mjs");
      const args = { ...a, input: await resolvePath(a.input, ctx) };
      for (const key of ["timeline", "compare", "reviews"]) if (a[key]) args[key] = await resolvePath(a[key], ctx, { directory: key === "reviews" });
      return (await runReelQa(R, args.input, args)).toJSON();
    }
    case "motion_edit_export": {
      const project = await resolvePath(a.project, ctx, { directory: true }), zip = await resolvePath(a.zip, ctx, { output: true });
      const result = await mod.exportDelivery(project, zip);
      return { ...result.report, artifact: await artifactIntegrity(zip, a.zip) };
    }
    default: throw Object.assign(new Error(`ferramenta desconhecida: ${name}`), { code: "MOTION_INVALID_ARGUMENT" });
  }
}

async function callRender(name, a, ctx) {
  const core = await loadCore();
  if (name === "render_static") {
    const width = a.width ?? 1080, height = a.height ?? 1920, scale = a.scale ?? 1;
    if (width * height * scale ** 2 > 120_000_000) throw new ToolInputError("render_static excede o limite de 120 milhões de pixels de saída.");
    const input = await resolvePath(a.input, ctx), output = await resolvePath(a.output, ctx, { output: true });
    await core.renderStatic(input, output, { width, height, scale, frame: a.frame, time: a.time, seed: a.seed ?? 1, offline: true, signal: ctx.signal });
    return { status: "PASS", output: a.output, artifact: await artifactIntegrity(output, a.output) };
  }
  if (name === "render_frames") {
    const frames = a.frames ?? 90, width = a.width ?? 1080, height = a.height ?? 1920, scale = a.scale ?? 1;
    const renderedFrames = a.sampleFrames?.length ?? frames;
    if (renderedFrames * width * height * scale ** 2 > 250_000_000) throw new ToolInputError("render_frames excede o limite local de 250 milhões de pixels de saída; use amostragem ou divida o render.");
    const input = await resolvePath(a.input, ctx), output = await resolvePath(a.outputDir, ctx, { output: true });
    await core.renderFrames(input, output, { frames, fps: a.fps ?? 30, width, height, scale, seed: a.seed ?? 1, sampleFrames: a.sampleFrames, transparent: a.transparent ?? false, offline: true, signal: ctx.signal });
    return { status: "PASS", outputDir: a.outputDir, artifact: await artifactIntegrity(output, a.outputDir) };
  }
  if (name === "render_video") {
    const framesDir = await resolvePath(a.framesDir, ctx, { directory: true }), output = await resolvePath(a.output, ctx, { output: true });
    const audio = a.audio ? await resolvePath(a.audio, ctx) : null;
    await core.assembleVideo(framesDir, output, { fps: a.fps ?? 30, audio, crf: a.crf, signal: ctx.signal });
    return { status: "PASS", output: a.output, artifact: await artifactIntegrity(output, a.output) };
  }
  const slidesDir = await resolvePath(a.slidesDir, ctx, { directory: true }), outputDir = await resolvePath(a.outputDir, ctx, { output: true });
  const slides = (await readdir(slidesDir)).filter((file) => file.endsWith(".html")).sort();
  if (!slides.length) throw new ToolInputError("render_carousel não encontrou arquivos .html no diretório.");
  if (slides.length > 50) throw new ToolInputError("render_carousel aceita no máximo 50 slides por execução.");
  await prepareOutput(outputDir);
  await mkdir(outputDir, { recursive: false });
  for (const slide of slides) {
    if (ctx.signal?.aborted) throw Object.assign(new Error("Renderização cancelada."), { code: "MOTION_CANCELLED" });
    const stem = path.parse(slide).name, source = path.join(slidesDir, slide);
    const outputs = [[`${stem}-1080x1350.png`, 1], [`${stem}-2160x2700.png`, 2]];
    for (const [filename, scale] of outputs) {
      const target = path.join(outputDir, filename);
      await core.renderStatic(source, target, { width: 1080, height: 1350, scale, offline: true, signal: ctx.signal });
      await core.validateStatic(target, `${1080 * scale}x${1350 * scale}`, scale);
    }
  }
  return { status: "PASS", slides: slides.length, outputDir: a.outputDir, artifact: await artifactIntegrity(outputDir, a.outputDir) };
}

const designIr = object("MotionDesignIR@1 validated object");
const tokenBundle = object("DesignTokenBundle@1 object");
const provenance = object("AssetProvenanceManifest@1 object");

const newTools = [
  tool("render_static", "Renderiza HTML local para PNG usando Chromium local e bloqueando rede externa.", {
    input: string("HTML local dentro do workspace"), output: string("Novo PNG dentro do workspace"), width: integer("Largura CSS", { minimum: 1, maximum: 7680 }), height: integer("Altura CSS", { minimum: 1, maximum: 7680 }), scale: number("Escala de pixel", { minimum: 0.25, maximum: 4 }), frame: integer("Índice de quadro opcional", { minimum: 0 }), time: number("Tempo de captura em segundos", { minimum: 0 }), seed: integer("Seed determinística"),
  }, ["input", "output"], (a, ctx) => callRender("render_static", a, ctx)),
  tool("render_frames", "Renderiza frames determinísticos offline em Chromium local.", {
    input: string("Composição HTML local"), outputDir: string("Diretório de saída novo"), frames: integer("Quantidade de frames", { minimum: 1, maximum: 30000 }), fps: integer("Frames por segundo", { minimum: 1, maximum: 120 }), width: integer("Largura", { minimum: 1, maximum: 7680 }), height: integer("Altura", { minimum: 1, maximum: 7680 }), scale: number("Escala", { minimum: 0.25, maximum: 4 }), seed: integer("Seed determinística"), sampleFrames: array("Índices de frames opcionais", { type: "integer" }, { maxItems: 1000 }), transparent: bool("Renderizar com transparência"),
  }, ["input", "outputDir"], (a, ctx) => callRender("render_frames", a, ctx)),
  tool("render_video", "Monta MP4 CFR a partir de uma pasta local de frames; pode incluir áudio local.", {
    framesDir: string("Pasta local de PNGs numerados"), output: string("Novo MP4"), fps: integer("FPS", { minimum: 1, maximum: 120 }), audio: string("Trilha local opcional"), crf: integer("Qualidade CRF opcional", { minimum: 0, maximum: 51 }),
  }, ["framesDir", "output"], (a, ctx) => callRender("render_video", a, ctx)),
  tool("render_carousel", "Renderiza cada slide HTML local em PNG 1080×1350 e 2160×2700.", { slidesDir: string("Pasta de HTMLs dos slides"), outputDir: string("Pasta de saída nova") }, ["slidesDir", "outputDir"], (a, ctx) => callRender("render_carousel", a, ctx)),
  tool("qa_determinism", "Compara hashes de frames em duas sessões Chromium independentes no mesmo host.", {
    input: string("Composição HTML local"), outputDir: string("Diretório de evidências novo"), duration: number("Duração em segundos", { minimum: 0.1, maximum: 300 }), fps: integer("FPS", { minimum: 1, maximum: 120 }), width: integer("Largura", { minimum: 1, maximum: 7680 }), height: integer("Altura", { minimum: 1, maximum: 7680 }), sampleTimes: array("Tempos de amostragem", { type: "number" }, { maxItems: 40 }), seed: integer("Seed"),
  }, ["input", "outputDir"], async (a, ctx) => {
    const sampleCount = a.sampleTimes?.length ?? 3, pixels = (a.width ?? 1080) * (a.height ?? 1920) * sampleCount * 2;
    if (pixels > 250_000_000) throw new ToolInputError("qa_determinism excede o limite local de 250 milhões de pixels amostrados.");
    const core = await loadCore(), input = await resolvePath(a.input, ctx), outputDir = await resolvePath(a.outputDir, ctx, { output: true });
    const report = await core.verifyDeterminism(input, { outputDir, duration: a.duration ?? 8, fps: a.fps ?? 30, width: a.width ?? 1080, height: a.height ?? 1920, sampleTimes: a.sampleTimes, seed: a.seed ?? 1, offline: true, signal: ctx.signal });
    return { ...report, artifact: await artifactIntegrity(outputDir, a.outputDir) };
  }),
  tool("qa_safe_zones", "Analisa safe zones em amostras temporais; heurísticas e mídia exigem revisão visual indicada no relatório.", {
    input: string("HTML local"), outputDir: string("Diretório de evidências novo"), platform: string("Preset de plataforma"), duration: number("Duração", { minimum: 0.1, maximum: 300 }), fps: integer("FPS", { minimum: 1, maximum: 120 }), width: integer("Largura", { minimum: 1, maximum: 7680 }), height: integer("Altura", { minimum: 1, maximum: 7680 }), sampleTimes: array("Tempos de amostragem", { type: "number" }, { maxItems: 50 }), seed: integer("Seed"),
  }, ["input", "outputDir"], async (a, ctx) => {
    const duration = a.duration ?? 8, sampleCount = a.sampleTimes?.length ?? Math.ceil(duration / 0.5) + 1;
    const pixels = (a.width ?? 1080) * (a.height ?? 1920) * sampleCount;
    if (sampleCount > 50 || pixels > 250_000_000) throw new ToolInputError("qa_safe_zones excede o limite local de 50 amostras ou 250 milhões de pixels; reduza duração, resolução ou amostras.");
    const core = await loadCore(), input = await resolvePath(a.input, ctx), outputDir = await resolvePath(a.outputDir, ctx, { output: true });
    const report = await core.qaSafeZones(input, { outputDir, platform: a.platform, duration, fps: a.fps, width: a.width, height: a.height, sampleTimes: a.sampleTimes, seed: a.seed, signal: ctx.signal });
    return { ...report, artifact: await artifactIntegrity(outputDir, a.outputDir) };
  }),
  tool("qa_viewports", "Executa QA multi-viewport via Chromium. Arquivo local ou URL localhost; não acessa hosts externos.", {
    input: string("HTML local ou URL localhost"), outputDir: string("Diretório de relatório novo"), wait: integer("Espera após navegação em ms", { minimum: 0, maximum: 30000 }), canvas: string("Seletor de canvas opcional"), ignore: string("Seletor CSS a ignorar opcional"),
  }, ["input", "outputDir"], async (a, ctx) => {
    const core = await loadCore(), input = await resolvePath(a.input, ctx, { allowLocalUrl: true }), outputDir = await resolvePath(a.outputDir, ctx, { output: true });
    let result, failure = null;
    try {
      result = await core.qaViewports(input, outputDir, { wait: a.wait, canvas: a.canvas, ignore: a.ignore, offline: true, workspaceRoot: await getRealWorkspace(ctx), signal: ctx.signal });
    } catch (error) { failure = error; }
    let report;
    try { report = await readJson(path.join(outputDir, "report.json")); }
    catch { if (failure) throw failure; throw new Error("QA multi-viewport terminou sem report.json."); }
    if (failure && !report.results?.length) throw failure;
    return { status: report.results.every((viewport) => viewport.ok) ? "PASS" : "FAIL", report, stdout: result?.stdout ?? "", ...(failure ? { diagnostic: failure.message } : {}), artifact: await artifactIntegrity(outputDir, a.outputDir) };
  }),
  tool("svg_validate", "Valida e sanitiza SVG não confiável; nunca executa conteúdo ativo.", { svg: string("Conteúdo SVG (máximo 5 MB)", { maxLength: 5_000_000 }), strict: bool("Falhar em avisos de segurança") }, ["svg"], async (a) => {
    const core = await loadCore();
    return core.validateSvg(a.svg, { trusted: false, strict: a.strict ?? true });
  }),
  tool("svg_optimize", "Otimiza SVG já validado e devolve conteúdo sanitizado sem gravar arquivo.", { svg: string("Conteúdo SVG (máximo 5 MB)", { maxLength: 5_000_000 }), prefix: string("Prefixo determinístico de IDs"), multipass: bool("Ativar SVGO multipass") }, ["svg"], async (a) => {
    const core = await loadCore();
    return { svg: core.optimizeSvg(a.svg, { prefix: a.prefix ?? "motion", multipass: a.multipass ?? true, trusted: false }) };
  }),
  tool("bridge_validate_contract", "Valida um contrato Motion Bridge sem acessar Doop ou rede.", { contract: { type: "string", enum: ["designIR", "tokenBundle", "assetProvenance", "exportPlan", "exportOperation", "exportResult", "compatibilityReport"] }, value: object("Objeto de contrato") }, ["contract", "value"], async (a) => {
    const { bridge } = await loadCore();
    const validators = { designIR: bridge.validateDesignIR, tokenBundle: bridge.validateTokenBundle, assetProvenance: bridge.validateAssetProvenance, exportPlan: bridge.validateExportPlan, exportOperation: bridge.validateExportOperation, exportResult: bridge.validateExportResult, compatibilityReport: bridge.validateExportCompatibilityReport };
    return { valid: true, contract: a.contract, value: validators[a.contract](a.value) };
  }),
  tool("bridge_import_design", "Converte um frame já obtido pelo Doop MCP oficial em DesignIR sanitizado; não chama Doop.", { documentId: string("ID do canvas/documento"), frame: object("Frame JSON obtido pelo agente via ferramenta oficial") }, ["documentId", "frame"], async (a) => {
    const { bridge } = await loadCore();
    return { designIR: bridge.createDoopAdapter().importFrame(a.frame, { documentId: a.documentId }) };
  }),
  tool("bridge_import_tokens", "Converte tokens locais/Doop para DesignTokenBundle@1 validado.", { tokens: { type: ["object", "array", "string"], description: "Array, objeto {tokens} ou CSS de tokens obtido pelo agente" }, brandSlug: string("Slug de marca"), webFonts: array("URLs de fontes informativas", { type: "string" }), customFonts: array("Fontes locais informativas", { type: "string" }) }, ["tokens"], async (a) => {
    const { bridge } = await loadCore();
    return { tokenBundle: bridge.createDoopAdapter().importTokens(a.tokens, { brandSlug: a.brandSlug, webFonts: a.webFonts, customFonts: a.customFonts }) };
  }),
  tool("bridge_hydrate_assets", "Baixa assets apenas a partir de URLs já presentes no DesignIR, valida SSRF/MIME/licença e grava localmente. Requer confirmação explícita para downloads externos.", { designIR: designIr, projectDir: string("Diretório de projeto local dentro do workspace"), allowRemoteDownloads: bool("Confirma explicitamente downloads dos URLs contidos no DesignIR"), tokenBundle: tokenBundle, assetMetadata: object("Metadados de licença/proveniência por URL") }, ["designIR", "projectDir", "allowRemoteDownloads"], async (a, ctx) => {
    if (a.allowRemoteDownloads !== true) throw new ToolInputError("Defina allowRemoteDownloads=true após revisar os URLs e licenças do DesignIR.");
    const { bridge } = await loadCore(), projectDir = await resolvePath(a.projectDir, ctx, { output: true });
    await prepareOutput(projectDir);
    await mkdir(projectDir, { recursive: false });
    const result = await bridge.hydrateAssets(a.designIR, { projectDir, tokenBundle: a.tokenBundle ?? null, assetMetadata: a.assetMetadata ?? {}, signal: ctx.signal });
    return { ...result, artifact: await artifactIntegrity(projectDir, a.projectDir) };
  }),
  tool("bridge_normalize_design", "Normaliza DesignIR para composição, carrossel, story ou scaffold web; arquivos são gravados apenas no diretório novo solicitado.", { designIR: { type: ["object", "array"], description: "DesignIR@1 ou lista de frames" }, target: { type: "string", enum: ["frame", "carousel", "story", "web-director"] }, outDir: string("Diretório de saída novo opcional"), tokenBundle: tokenBundle, provenanceManifest: provenance, seed: integer("Seed determinística"), fps: integer("FPS", { minimum: 1, maximum: 120 }) }, ["designIR"], async (a, ctx) => {
    const { bridge } = await loadCore(), outDir = a.outDir ? await resolvePath(a.outDir, ctx, { output: true }) : undefined;
    const result = await bridge.normalizeDesignToMotion(a.designIR, { target: a.target ?? "frame", outDir, tokenBundle: a.tokenBundle, provenanceManifest: a.provenanceManifest, seed: a.seed ?? 1, fps: a.fps ?? 30 });
    return { ...result, ...(outDir ? { artifact: await artifactIntegrity(outDir, a.outDir) } : {}) };
  }),
  tool("bridge_prototype_storyboard", "Converte fluxos de protótipo já importados em DesignIR para STORYBOARD.md; não inventa interações.", { designIR: { type: ["object", "array"], description: "Um ou mais DesignIR@1" }, projectSlug: string("Slug do projeto"), fps: integer("FPS", { minimum: 1, maximum: 120 }), defaultHoldSec: number("Duração padrão de cena", { minimum: 0.1, maximum: 300 }), output: string("Caminho novo opcional para salvar markdown") }, ["designIR"], async (a, ctx) => {
    const { bridge } = await loadCore(), result = bridge.prototypeToStoryboard(a.designIR, { projectSlug: a.projectSlug, fps: a.fps ?? 30, defaultHoldSec: a.defaultHoldSec });
    if (a.output) {
      const output = await resolvePath(a.output, ctx, { output: true });
      await prepareOutput(output);
      await writeFile(output, result.markdown, { encoding: "utf8", flag: "wx" });
      return { ...result, artifact: await artifactIntegrity(output, a.output) };
    }
    return result;
  }),
  tool("bridge_export_plan", "Inspeciona artefatos locais e gera ExportPlan@1 determinístico em dry-run; não modifica o editor.", { documentId: string("Canvas/document ID informado pelo agente"), designIR: designIr, tokenBundle, provenanceManifest: provenance, artifacts: array("Artefatos relativos ao workspace", object("Artifact descriptor")), storyboard: object("Storyboard validado opcional"), prototypeToStoryboard: object("Storyboard originado de protótipo opcional") }, ["documentId"], async (a, ctx) => {
    const { bridge } = await loadCore(), adapter = bridge.createDoopAdapter();
    const input = { ir: a.designIR, tokenBundle: a.tokenBundle, provenanceManifest: a.provenanceManifest, artifacts: a.artifacts, storyboard: a.storyboard, prototypeToStoryboard: a.prototypeToStoryboard };
    const inspected = await bridge.inspectExportSource(input, { adapter, documentId: a.documentId, projectDir: await getRealWorkspace(ctx) });
    const plan = bridge.planExportToEditor(inspected, { adapter, policy: "dry-run", dryRun: true, allowUpdateExisting: false, allowTokenMutation: false, allowComponentMutation: false, allowPublicUpload: false });
    return { status: "DRY_RUN", executed: false, inspected: { documentId: inspected.documentId, items: inspected.items.map(({ id, category, strategy, warnings }) => ({ id, category, strategy, warnings })), privacyBlocked: inspected.privacyBlocked }, plan };
  }),
  tool("bridge_export_validate", "Valida schema, precondições, política de privacidade e proteções do ExportPlan; não executa ações.", { plan: object("ExportPlan@1") }, ["plan"], async (a) => {
    const { bridge } = await loadCore();
    return { ...bridge.validateExportPlanAndPreconditions(a.plan), executed: false };
  }),
  tool("bridge_doop_payload", "Gera sequência de payloads para ferramentas Doop MCP verificadas. O agente deve conferir os schemas disponíveis; nada é executado.", { plan: object("ExportPlan@1 validado") }, ["plan"], async (a) => {
    const { bridge } = await loadCore(), plan = bridge.validateExportPlan(a.plan), allowed = new Set(Object.values(bridge.DOOP_MCP_TOOL_NAMES));
    const operations = [];
    for (const op of plan.operations) {
      if (!allowed.has(op.kind)) {
        operations.push({ operationId: op.id, status: "BLOCKED", reason: `Sem ferramenta Doop verificada para '${op.kind}'.` });
        continue;
      }
      if (op.kind === "upload_asset") {
        operations.push({ operationId: op.id, tool: "upload_asset", arguments: { canvas_id: op.payload.canvas_id, local_file: true, agent_name: op.payload.agent_name }, requiresLocalAssetTransfer: true, dependsOn: op.dependsOn });
      } else if (op.kind === "create_frame") {
        const payload = op.payload;
        const base = { canvas_id: payload.canvas_id, name: payload.name, width: payload.width, height: payload.height, ...(payload.pageId ? { pageId: payload.pageId } : {}), html: payload.stream ? "<!doctype html><html><body></body></html>" : payload.html, agent_name: payload.agent_name };
        operations.push({ operationId: op.id, tool: "create_frame", arguments: base, dependsOn: op.dependsOn, ...(payload.stream ? { appendChunks: (await import("../../motion-core/bridge/adapters/doop.mjs")).splitHtmlChunks(payload.html, 3072).map((html_chunk, index, all) => ({ tool: "append_frame_html", arguments: { frame_id: `{{${op.id}.frameId}}`, html_chunk, start: index === 0, done: index === all.length - 1, agent_name: payload.agent_name } })) } : {}) });
      } else if (op.kind === "set_frame_html") {
        operations.push({ operationId: op.id, tool: "set_frame_html", arguments: { frame_id: op.payload.frame_id, html: op.payload.html, agent_name: op.payload.agent_name }, dependsOn: op.dependsOn, requiresAuthorization: true });
      } else {
        operations.push({ operationId: op.id, tool: op.kind, arguments: op.payload, dependsOn: op.dependsOn, requiresAuthorization: ["create_frame", "edit_frame_html", "append_frame_html", "upload_asset"].includes(op.kind) });
      }
    }
    return { status: operations.some((op) => op.status === "BLOCKED") ? "WARN" : "PASS", executed: false, requiresDoopMcp: operations.length > 0, verifiedToolNames: [...allowed], operations };
  }),
  tool("bridge_export_tokens", "Serializa DesignTokenBundle@1 para o formato conhecido do Doop, sem chamada externa.", { tokenBundle }, ["tokenBundle"], async (a) => {
    const { bridge } = await loadCore();
    return { executed: false, payload: bridge.createDoopAdapter().exportTokens(a.tokenBundle) };
  }),
];

export const TOOL_REGISTRY = Object.freeze([...legacyTools, ...newTools]);
const byName = new Map(TOOL_REGISTRY.map((entry) => [entry.name, entry]));
if (byName.size !== TOOL_REGISTRY.length) throw new Error("MCP tool registry has duplicate names.");

export const TOOLS = Object.freeze(TOOL_REGISTRY.map(({ handler, ...definition }) => definition));

export async function invokeTool(name, args, context) {
  const entry = byName.get(name);
  if (!entry) throw Object.assign(new Error(`ferramenta desconhecida: ${name}`), { code: "MOTION_INVALID_ARGUMENT" });
  validateAgainstSchema(entry.inputSchema, args);
  if (context.signal?.aborted) throw Object.assign(new Error("Execução cancelada."), { code: "MOTION_CANCELLED" });
  const runtime = context.runtime ?? context;
  const scope = Object.assign(Object.create(context), { runtime, reservedOutputs: [] });
  try {
    return await runLimited(runtime, () => entry.handler(args, scope), scope.signal);
  } finally {
    if (!scope.keepOutputReservations) {
      for (const output of scope.reservedOutputs) runtime.outputReservations.delete(output);
    }
  }
}
