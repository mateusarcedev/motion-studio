/** Mission 20 — automated production QA: status model, media (ffprobe/ffmpeg), frames, DOM visual risks. */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile, truncate } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { QA_STATUS, combineStatuses, createQaReport, qaMedia, qaFrames, qaProject, assembleVideo } from "../packages/motion-core/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const tmp = path.join(here, "tmp", "qa");
const STATIC = path.join(root, "packages/motion-core/renderers/render_static.mjs");
const ff = (args) => spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8" });
const have = spawnSync("ffmpeg", ["-version"]).status === 0 && spawnSync("ffprobe", ["-version"]).status === 0;
const byId = (r, id) => r.checks.find((c) => c.id === id);

before(async () => { await rm(tmp, { recursive: true, force: true }); await mkdir(tmp, { recursive: true }); });

describe("Modelo de estados de QA", () => {
  test("combina estados pelo pior caso; check não executado nunca vira PASS", () => {
    assert.equal(combineStatuses(["PASS", "PASS"]), "PASS");
    assert.equal(combineStatuses(["PASS", "WARN"]), "WARN");
    assert.equal(combineStatuses(["PASS", "NOT_TESTED"]), "NOT_TESTED");
    assert.equal(combineStatuses(["WARN", "BLOCKED"]), "BLOCKED");
    assert.equal(combineStatuses(["BLOCKED", "FAIL", "PASS"]), "FAIL");
    assert.equal(combineStatuses([]), "NOT_TESTED");
    assert.deepEqual(Object.keys(QA_STATUS).sort(), ["BLOCKED", "FAIL", "NOT_TESTED", "PASS", "WARN"]);
  });
  test("BLOCKED exige instruções de reprodução; estado inválido é rejeitado", () => {
    const r = createQaReport({ subject: "x" });
    assert.throws(() => r.add({ id: "a", title: "A", status: "BLOCKED" }), /reprodução/);
    assert.throws(() => r.add({ id: "a", title: "A", status: "OK" }), /inválido/);
    r.add({ id: "a", title: "A", status: "BLOCKED", reproduce: "rode X" });
    assert.equal(r.summary().status, "BLOCKED");
    assert.match(r.toMarkdown(), /rode X/);
  });
  test("relatório estruturado (JSON) traz veredito, contagens, checks e a ressalva sobre heurísticas", () => {
    const r = createQaReport({ subject: "demo" }).add({ id: "a", title: "A", status: "PASS" }).add({ id: "b", title: "B", status: "WARN", heuristic: true });
    const j = JSON.parse(JSON.stringify(r));
    assert.equal(j.status, "WARN"); assert.equal(j.counts.PASS, 1); assert.equal(j.checks.length, 2);
    assert.match(j.note, /Heurísticas/);
    assert.equal(createQaReport().add({ id: "o", title: "opt", status: "NOT_TESTED", required: false }).add({ id: "p", title: "P", status: "PASS" }).summary().status, "PASS", "opcional não executado não bloqueia");
  });
});

describe("QA de vídeo e áudio (FFprobe/FFmpeg)", { skip: !have && "NOT_TESTED: ffmpeg/ffprobe indisponíveis" }, () => {
  const good = () => path.join(tmp, "good.mp4");
  before(async () => {
    ff(["-f", "lavfi", "-i", "testsrc=size=320x180:rate=30:duration=2", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2,volume=0.2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", good()]);
    ff(["-f", "lavfi", "-i", "testsrc=size=320x180:rate=30:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(tmp, "noaudio.mp4")]);
    ff(["-f", "lavfi", "-i", "testsrc=size=320x180:rate=30:duration=2", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", path.join(tmp, "silent.mp4")]);
    ff(["-f", "lavfi", "-i", "color=c=black:size=320x180:rate=30:duration=2", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", path.join(tmp, "black.mp4")]);
    ff(["-f", "lavfi", "-i", "testsrc=size=320x180:rate=30:duration=2", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2,volume=40dB,alimiter=limit=1:level=disabled", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path.join(tmp, "loud.mp4")]);
    const buf = await readFile(good()); await writeFile(path.join(tmp, "corrupt.mp4"), buf.subarray(0, Math.floor(buf.length * 0.6)));
    await writeFile(path.join(tmp, "garbage.mp4"), "not a video at all");
  });

  test("vídeo+áudio válidos com expectativas corretas → PASS", async () => {
    const r = await qaMedia(good(), { width: 320, height: 180, fps: 30, durationSec: 2, audio: true, codec: "h264" });
    const failing = r.checks.filter((c) => c.status === "FAIL");
    assert.deepEqual(failing, [], JSON.stringify(failing));
    assert.ok(["PASS", "WARN"].includes(r.summary().status));
    for (const id of ["video.codec", "video.resolution", "video.fps", "video.duration", "decode", "audio.stream", "audio.silence"]) assert.equal(byId(r, id).status, "PASS", id);
  });
  test("resolução, fps e duração divergentes → FAIL específico", async () => {
    const r = await qaMedia(good(), { width: 1920, height: 1080, fps: 24, durationSec: 5 });
    for (const id of ["video.resolution", "video.fps", "video.duration"]) assert.equal(byId(r, id).status, "FAIL", id);
  });
  test("áudio exigido mas ausente → FAIL", async () => {
    assert.equal(byId(await qaMedia(path.join(tmp, "noaudio.mp4"), { audio: true }), "audio.stream").status, "FAIL");
    assert.equal(byId(await qaMedia(path.join(tmp, "noaudio.mp4"), {}), "audio.stream").status, "PASS");
  });
  test("áudio totalmente silencioso → FAIL (silêncio inesperado)", async () => {
    const r = await qaMedia(path.join(tmp, "silent.mp4"), { audio: true });
    assert.equal(byId(r, "audio.silence").status, "FAIL");
  });
  test("áudio estourado → FAIL de clipping", async () => {
    const r = await qaMedia(path.join(tmp, "loud.mp4"), { audio: true });
    assert.ok(["FAIL", "WARN"].includes(byId(r, "audio.loudness").status));
  });
  test("trecho preto longo → WARN (heurística)", async () => {
    const r = await qaMedia(path.join(tmp, "black.mp4"), {});
    assert.equal(byId(r, "video.black").status, "WARN");
  });
  test("arquivo truncado → FAIL na decodificação; arquivo inválido → FAIL na leitura", async () => {
    const t = await qaMedia(path.join(tmp, "corrupt.mp4"), {});
    assert.equal(t.summary().status, "FAIL");
    const g = await qaMedia(path.join(tmp, "garbage.mp4"), {});
    assert.equal(g.summary().status, "FAIL");
    assert.equal((await qaMedia(path.join(tmp, "nope.mp4"), {})).summary().status, "FAIL");
  });
  test("sem ffprobe/ffmpeg no PATH → BLOCKED (nunca PASS) com instruções de reprodução", () => {
    const script = `import {qaMedia} from "${path.join(root, "packages/motion-core/quality/media_qa.mjs")}"; const r=await qaMedia(${JSON.stringify(good())},{audio:true}); console.log(JSON.stringify(r.toJSON()))`;
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", env: { ...process.env, PATH: "" } });
    const j = JSON.parse(r.stdout);
    assert.equal(j.status, "BLOCKED");
    assert.ok(j.checks.every((c) => c.status !== "PASS"));
    assert.match(j.checks[0].reproduce, /ffmpeg/i);
  });
  test("exportação real: frames + áudio via assembleVideo passam no QA com sincronismo", async () => {
    const frames = path.join(tmp, "export-frames"); await mkdir(frames, { recursive: true });
    for (let i = 0; i < 60; i++) ff(["-f", "lavfi", "-i", `color=c=0x${(i * 4).toString(16).padStart(2, "0")}40a0:size=160x90`, "-frames:v", "1", path.join(frames, `${String(i).padStart(4, "0")}.png`)]);
    ff(["-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000:duration=2,volume=0.3", path.join(tmp, "tone.wav")]);
    const out = path.join(tmp, "export.mp4");
    await assembleVideo(frames, out, { fps: 30, audio: path.join(tmp, "tone.wav") });
    const r = await qaMedia(out, { width: 160, height: 90, fps: 30, durationSec: 2, audio: true, codec: "h264" });
    const failing = r.checks.filter((c) => c.status === "FAIL");
    assert.deepEqual(failing, [], JSON.stringify(failing));
    assert.notEqual(byId(r, "audio.sync").status, "FAIL");
  });
});

describe("QA de quadros e do projeto", { skip: !have && "NOT_TESTED: ffmpeg indisponível" }, () => {
  async function frames(name, makers) {
    const dir = path.join(tmp, name); await mkdir(dir, { recursive: true });
    makers.forEach((src, i) => ff(["-f", "lavfi", "-i", src, "-frames:v", "1", path.join(dir, `${String(i).padStart(4, "0")}.png`)]));
    return dir;
  }
  test("quadros vazios (cor uniforme) e escuros são sinalizados", async () => {
    const dir = await frames("blank", Array(6).fill("color=c=0x050505:size=160x90"));
    const r = await qaFrames(dir);
    assert.equal(byId(r, "blank").status, "WARN"); assert.equal(byId(r, "dark").status, "WARN");
  });
  test("sequência variada e bem iluminada → sem avisos de repetição/escuridão", async () => {
    const dir = await frames("varied", ["testsrc=size=160x90", "smptebars=size=160x90", "mandelbrot=size=160x90", "gradients=size=160x90:seed=3", "life=size=160x90:seed=2", "rgbtestsrc=size=160x90", "cellauto=size=160x90:seed=1"]);
    const r = await qaFrames(dir);
    assert.equal(byId(r, "repetition").status, "PASS"); assert.equal(byId(r, "dark").status, "PASS");
  });
  test("cenas repetidas (mesma imagem várias vezes) → WARN de variedade; quadros idênticos o tempo todo → FAIL (animação ausente)", async () => {
    const same = await frames("same", Array(8).fill("testsrc=size=160x90"));
    const r = await qaFrames(same);
    assert.equal(byId(r, "repetition").status, "WARN"); assert.equal(byId(r, "static").status, "FAIL");
  });
  test("contagem esperada de quadros é verificada", async () => {
    const dir = await frames("count", ["testsrc=size=160x90", "smptebars=size=160x90"]);
    assert.equal(byId(await qaFrames(dir, { expectedFrames: 3 }), "frames.count").status, "FAIL");
  });
  test("qaProject escreve reviews/qa-report.{json,md} e marca o que não foi testado", async () => {
    const proj = path.join(tmp, "proj"); await mkdir(path.join(proj, "stills"), { recursive: true });
    ff(["-f", "lavfi", "-i", "testsrc=size=160x90", "-frames:v", "1", path.join(proj, "stills", "0000.png")]);
    const r = await qaProject(proj, {});
    const json = JSON.parse(await readFile(path.join(proj, "reviews", "qa-report.json"), "utf8"));
    assert.equal(json.kind, "project");
    assert.ok(json.checks.some((c) => c.id === "media" && c.status === "NOT_TESTED"), "sem vídeo → NOT_TESTED, não PASS");
    assert.match(await readFile(path.join(proj, "reviews", "qa-report.md"), "utf8"), /QA automatizado/);
    assert.ok(r.summary().status !== "PASS" || json.checks.every((c) => c.status === "PASS" || !c.required));
  });
  test("qaProject aplica contexto de cena específico por arquivo do storyboard", async () => {
    const proj = path.join(tmp, "scoped-context"), out = path.join(proj, "out/final"); await mkdir(out, { recursive: true });
    const video = path.join(out, "intentional-dark.mp4");
    ff(["-f", "lavfi", "-i", "color=c=0x0A0E14:size=160x90:rate=10:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", video]);
    await writeFile(path.join(proj, "temporal-context.json"), JSON.stringify({ videos: { "intentional-dark.mp4": { scenes: [{ startSec: 0, endSec: 2, kind: "intentional-dark", label: "fundo da marca" }] } } }));
    const report = await qaProject(proj, { write: false });
    assert.equal(report.checks.find((c) => c.id === "media(intentional-dark.mp4).video.black").status, "PASS");
  });
});

describe("Riscos visuais no DOM (--qa-visual)", () => {
  test("texto cortado, contraste baixo e excesso de texto são reportados como WARN heurístico", async (t) => {
    const dir = path.join(tmp, "dom"); await mkdir(dir, { recursive: true });
    const words = Array(60).fill("palavra").join(" ");
    await writeFile(path.join(dir, "index.html"), `<!doctype html><body style="margin:0;width:800px;height:600px;background:#fff"><p style="color:#bbb;font-size:30px">baixo contraste</p><div style="width:60px;overflow:hidden;white-space:nowrap;font-size:30px">texto muito longo cortado</div><p style="font-size:26px;color:#000">${words}</p><p style="font-size:30px;color:#111">ok</p></body>`);
    const r = spawnSync("node", [STATIC, path.join(dir, "index.html"), path.join(dir, "o.png"), "--width=800", "--height=600", "--scale=1", "--wait=0", "--qa-visual"], { encoding: "utf8" });
    if (r.status !== 0 && /BROWSER/.test(r.stderr)) return t.skip("NOT_TESTED: Chromium indisponível");
    const rep = JSON.parse(r.stdout);
    assert.equal(rep.status, "WARN");
    assert.equal(rep.visual.lowContrast.length, 1); assert.equal(rep.visual.lowContrast[0].text, "baixo contraste");
    assert.equal(rep.visual.clipped.length, 1); assert.equal(rep.visual.textOverload, true);
  });
  test("composição limpa → OK (sem falso positivo)", async (t) => {
    const dir = path.join(tmp, "dom-ok"); await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), `<!doctype html><body style="margin:0;width:800px;height:600px;background:#0b0f14"><h1 style="color:#fff;font-size:48px">Título claro</h1><p style="color:#e6edf3;font-size:28px">Texto legível</p></body>`);
    const r = spawnSync("node", [STATIC, path.join(dir, "index.html"), path.join(dir, "o.png"), "--width=800", "--height=600", "--scale=1", "--wait=0", "--qa-visual"], { encoding: "utf8" });
    if (r.status !== 0 && /BROWSER/.test(r.stderr)) return t.skip("NOT_TESTED: Chromium indisponível");
    assert.equal(JSON.parse(r.stdout).status, "OK");
  });
});

describe("Regressões da homologação 1.1.0 (showcase)", { skip: !have && "NOT_TESTED: ffmpeg indisponível" }, () => {
  test("qa_viewports resolve imports do Motion Core no servidor local e mantém modo offline", async (t) => {
    const dir = path.join(tmp, "motion-importmap"); await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), '<!doctype html><html><head><meta name="viewport" content="width=device-width"><script type="module">import * as Motion from "@technomanceer/motion-core/frame"; window.__motionResolved = typeof Motion.createMotionDriver === "function";</script></head><body style="margin:0;background:#24342d;color:#fff"><main>Motion runtime</main></body></html>');
    const r = spawnSync(process.execPath, [path.join(root, "packages/motion-core/renderers/qa_viewports.mjs"), path.join(dir, "index.html"), path.join(dir, "out"), "--wait=0", "--offline", `--workspace-root=${root}`], { encoding: "utf8" });
    if (/BROWSER/.test(r.stderr)) return t.skip("NOT_TESTED: Chromium indisponível");
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const report = JSON.parse(await readFile(path.join(dir, "out", "report.json"), "utf8"));
    assert.equal(report.results.length, 5);
    assert.ok(report.results.every((viewport) => viewport.ok), JSON.stringify(report.results));
  });

  test("marca escura intencional (fundo #0A0E14) NÃO é 'trecho preto'; preto real continua detectado", async () => {
    const dir = path.join(tmp, "dark-brand"); await mkdir(dir, { recursive: true });
    ff(["-f", "lavfi", "-i", "color=c=0x0A0E14:size=320x180:rate=30:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(dir, "ink.mp4")]);
    const ink = await qaMedia(path.join(dir, "ink.mp4"), {});
    assert.equal(ink.checks.find((c) => c.id === "video.black").status, "PASS", "fundo de marca escuro ≠ preto");
    const black = await qaMedia(path.join(tmp, "black.mp4"), {});
    assert.equal(black.checks.find((c) => c.id === "video.black").status, "WARN", "preto real segue acusado");
  });
  test("qa_viewports não trata ERR_ABORTED de <video preload=metadata> como falha de recurso", async (t) => {
    const dir = path.join(tmp, "video-page"); await mkdir(dir, { recursive: true });
    ff(["-f", "lavfi", "-i", "testsrc=size=160x90:rate=30:duration=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(dir, "v.mp4")]);
    await writeFile(path.join(dir, "index.html"), '<!doctype html><meta name=viewport content="width=device-width"><body style="margin:0"><video controls preload="metadata" src="v.mp4" style="width:100%"></video><p>ok</p></body>');
    const r = spawnSync("node", [path.join(root, "packages/motion-core/renderers/qa_viewports.mjs"), path.join(dir, "index.html"), path.join(dir, "out"), "--wait=300"], { encoding: "utf8" });
    if (/BROWSER/.test(r.stderr)) return t.skip("NOT_TESTED: Chromium indisponível");
    assert.ok(!/failed requests/.test(r.stdout), r.stdout);
  });
});
