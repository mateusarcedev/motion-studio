import { readFile } from "node:fs/promises";
import path from "node:path";
let qaViewports;
try {
  const mod = await import("@technomanceer/motion-core");
  qaViewports = mod.qaViewports;
} catch {
  const mod = await import("../../motion-core/index.js");
  qaViewports = mod.qaViewports;
}

export async function runQA(urlOrHtml, outdir, options = {}) {
  if (urlOrHtml === "delivery") {
    const project = options.project || outdir;
    const zip = options.zip;
    if (!project || !zip) throw new TypeError("Uso: motion qa delivery --project <pasta> --zip <entrega.zip>");
    const api = await import("@technomanceer/motion-core").catch(() => import("../../motion-core/index.js"));
    try {
      const result = await api.verifyDelivery(project, zip);
      const report = result.report;
      console.log(options.json ? JSON.stringify(report, null, 2) : `${report.status}: ${report.files} arquivos verificados no ZIP.\n${report.findings.map((f) => `- ${f.status} ${f.id}${f.path ? ` (${f.path})` : ""}${f.details ? `: ${f.details}` : ""}`).join("\n")}`);
      if (report.status === "FAIL") process.exitCode = 2;
      else if (report.status === "BLOCKED") process.exitCode = 3;
    } catch (error) {
      const report = error.report ?? { status: "FAIL", error: error.message };
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = report.status === "BLOCKED" ? 3 : 2;
    }
    return;
  }
  if (urlOrHtml === "determinism") {
    const input = outdir;
    if (!input) throw new TypeError("Uso: motion qa determinism <composition.html> [--output=<dir>]");
    const api = await import("@technomanceer/motion-core").catch(() => import("../../motion-core/index.js"));
    const report = await api.verifyDeterminism(input, {
      outputDir: options.output || options.outdir, duration: Number(options.duration || 8),
      fps: Number(options.fps || 30), width: options.width ? Number(options.width) : 1080,
      height: options.height ? Number(options.height) : 1920, seed: options.seed === undefined ? 1 : Number(options.seed),
    });
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 2;
    return;
  }
  if (urlOrHtml === "media" || urlOrHtml === "frames" || urlOrHtml === "precheck") {
    const target = outdir;
    if (!target) throw new TypeError(`Uso: motion qa ${urlOrHtml} <${urlOrHtml === "media" ? "arquivo.mp4" : urlOrHtml === "frames" ? "pasta_de_frames" : "pasta_do_projeto"}> [--width=W --height=H --fps=30 --duration=S --audio]`);
    const api = await import("@technomanceer/motion-core").catch(() => import("../../motion-core/index.js"));
    const num = (v) => (v === undefined || v === true ? undefined : Number(v));
    const rawContext = options.context ? JSON.parse(await readFile(options.context, "utf8")) : undefined;
    const sceneContext = rawContext && !Array.isArray(rawContext) && !Array.isArray(rawContext.scenes)
      ? rawContext.videos?.[path.basename(target)] ?? rawContext.frames?.[path.basename(target)] ?? rawContext
      : rawContext;
    const report = urlOrHtml === "media"
      ? await api.qaMedia(target, { width: num(options.width), height: num(options.height), fps: num(options.fps), durationSec: num(options.duration), audio: options.audio === true ? true : options.audio === "optional" ? "optional" : undefined, codec: typeof options.codec === "string" ? options.codec : undefined, sceneContext })
      : urlOrHtml === "frames"
        ? await api.qaFrames(target, { expectedFrames: num(options.expected), darkMean: num(options["dark-mean"]), fps: num(options.fps), sceneContext })
        : await api.qaProject(target, { width: num(options.width), height: num(options.height), fps: num(options.fps), durationSec: num(options.duration), audio: options.audio === true ? true : undefined });
    if (options.json) console.log(JSON.stringify(report.toJSON(), null, 2)); else console.log(report.toMarkdown());
    const status = report.summary().status;
    if (status === "FAIL") process.exitCode = 2; else if (status === "BLOCKED") process.exitCode = 3;
    return;
  }
  if (urlOrHtml === "safe-zones") {
    const input = outdir;
    if (!input) throw new TypeError("Uso: motion qa safe-zones <composition.html> [--platform=instagram-reels]");
    const api = await import("@technomanceer/motion-core").catch(() => import("../../motion-core/index.js"));
    const customPreset = options.presetFile ? JSON.parse(await readFile(options.presetFile, "utf8")) : undefined;
    const report = await api.qaSafeZones(input, {
      outputDir: options.output || options.outdir, platform: options.platform || "instagram-reels",
      customPreset,
      width: options.width ? Number(options.width) : undefined, height: options.height ? Number(options.height) : undefined,
      duration: Number(options.duration || 8), fps: Number(options.fps || 30), seed: options.seed === undefined ? 1 : Number(options.seed),
    });
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 2;
    return;
  }
  if (!urlOrHtml || !outdir) {
    console.error("Uso: motion qa <url_ou_html> <diretorio_de_saida> [--wait=ms]");
    process.exit(1);
  }

  console.log(`🔍 Executando QA multi-viewport em 5 telas para: ${urlOrHtml}`);
  console.log(`Saída de relatórios e capturas: ${outdir}`);

  const res = await qaViewports(urlOrHtml, outdir, {
    wait: options.wait,
    canvas: options.canvas,
    ignore: options.ignore,
  });

  console.log(res.stdout || "QA multi-viewport concluído.");
}
