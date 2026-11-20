/**
 * MOTION Core — quality/qa_project.mjs
 * Automated pre-check handed to the Critic: media + frames (+ composition risks) for a project folder.
 * Writes reviews/qa-report.json and reviews/qa-report.md. It does NOT replace the Critic: it gives the
 * Critic measured evidence so human-style review can focus on art direction.
 */
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createQaReport } from "./qa-status.mjs";
import { qaMedia } from "./media_qa.mjs";
import { qaFrames } from "./frame_qa.mjs";

async function exists(p) { try { await stat(p); return true; } catch { return false; } }
async function projectSceneContext(dir) {
  for (const rel of ["temporal-context.json", "reviews/temporal-context.json"]) {
    try { return JSON.parse(await readFile(path.join(dir, rel), "utf8")); } catch {}
  }
  return undefined;
}
function scopedSceneContext(context, group, name) {
  if (!context || Array.isArray(context)) return context;
  return context[group]?.[name] ?? context;
}

export async function qaProject(projectDir, { width, height, fps, durationSec, audio, outDir, write = true } = {}) {
  const dir = path.resolve(projectDir);
  const sceneContext = await projectSceneContext(dir);
  const report = createQaReport({ subject: path.basename(dir), kind: "project" });
  const videos = [];
  for (const sub of ["out", "out/final", "."]) {
    const d = path.join(dir, sub);
    for (const f of (await readdir(d).catch(() => [])).filter((n) => /\.(mp4|webm|mov)$/i.test(n))) videos.push(path.join(d, f));
  }
  if (!videos.length) report.add({ id: "media", title: "Vídeo entregue", status: "NOT_TESTED", details: "nenhum vídeo em out/ — nada a validar", required: false });
  for (const v of videos) report.merge(await qaMedia(v, { width, height, fps, durationSec, audio, sceneContext: scopedSceneContext(sceneContext, "videos", path.basename(v)) }), `media(${path.basename(v)})`);

  const frameDirs = [];
  for (const sub of ["frames", "stills", "out/stills", "reviews/frames", "out/previews"]) if (await exists(path.join(dir, sub))) frameDirs.push(path.join(dir, sub));
  if (!frameDirs.length) report.add({ id: "frames", title: "Quadros/stills para análise visual", status: "NOT_TESTED", details: "nenhuma pasta frames/ ou stills/ encontrada", required: false });
  for (const f of frameDirs) {
    const rel = path.relative(dir, f);
    const frameContext = scopedSceneContext(sceneContext, "frames", rel) ?? scopedSceneContext(sceneContext, "frames", path.basename(f));
    report.merge(await qaFrames(f, { sceneContext: frameContext, fps: frameContext?.fps }), `frames(${rel})`);
  }

  if (write) {
    const out = outDir ?? path.join(dir, "reviews");
    await mkdir(out, { recursive: true });
    await writeFile(path.join(out, "qa-report.json"), JSON.stringify(report.toJSON(), null, 2));
    await writeFile(path.join(out, "qa-report.md"), report.toMarkdown());
  }
  return report;
}
