/**
 * Mission 20 — regression tests for M-009 (doctor), M-010 (sampleFrames via CLI),
 * M-011 (broken assets) and M-012 (JavaScript errors invalidate the render).
 * Fixtures are tiny and generated on the fly; no external campaign is required.
 */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseFrameSelection } from "../packages/motion-core/lib/frames.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const tmp = path.join(here, "tmp", "reliability");
const CLI = path.join(root, "packages/motion-cli/bin/motion.mjs");
const STATIC = path.join(root, "packages/motion-core/renderers/render_static.mjs");
const FRAMES = path.join(root, "packages/motion-core/renderers/render_frames.mjs");
const BROWSER_LIB = pathToFileURL(path.join(root, "packages/motion-core/lib/browser.mjs")).href;

const sh = (cmd, args, env = {}) => spawnSync(cmd, args, { cwd: root, encoding: "utf8", env: { ...process.env, ...env } });
const json = (r) => { const t = r.stdout; const i = t.indexOf("{"); return i < 0 ? null : JSON.parse(t.slice(i)); };
const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

const CONTROLLER = `<script>window.__onFrame__=(s)=>{document.getElementById("x").style.width=(10+s.frame)+"px"};</script>`;
const page = (body, head = "") => `<!doctype html><html><head><meta charset="utf-8">${head}<style>body{margin:0;width:200px;height:120px;background:#123}#x{height:20px;background:#fc0}</style></head><body><div id="x"></div>${body}</body></html>`;

async function fixture(name, html, files = {}) {
  const dir = path.join(tmp, name);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), html);
  for (const [f, c] of Object.entries(files)) await writeFile(path.join(dir, f), c);
  return path.join(dir, "index.html");
}

let browserInstalled = false;
before(async () => {
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  const r = sh("node", ["--input-type=module", "-e", `import {diagnoseBrowser} from "${BROWSER_LIB}"; const d=await diagnoseBrowser(); console.log(JSON.stringify(d));`]);
  browserInstalled = ["PASS", "WARN"].includes(JSON.parse(r.stdout).status);
});

describe("M-009 — doctor valida o Chromium exigido pelo Playwright", () => {
  const diagnose = (browsersPath, extraEnv = {}) => {
    const r = sh("node", ["--input-type=module", "-e", `import {diagnoseBrowser} from "${BROWSER_LIB}"; console.log(JSON.stringify(await diagnoseBrowser({timeoutMs:15000})));`],
      { PLAYWRIGHT_BROWSERS_PATH: browsersPath, MOTION_DISABLE_SYSTEM_BROWSERS: "1", CHROME_PATH: "", ...extraEnv });
    return JSON.parse(r.stdout);
  };
  const expectedExecutable = (browsersPath) => {
    const r = sh("node", ["--input-type=module", "-e", `import {playwrightInfo} from "${BROWSER_LIB}"; console.log((await playwrightInfo()).expectedExecutable)`], { PLAYWRIGHT_BROWSERS_PATH: browsersPath });
    return r.stdout.trim();
  };

  test("navegador ausente → FAIL MOTION_BROWSER_MISSING com instrução", async () => {
    const dir = path.join(tmp, "pw-empty"); await mkdir(dir, { recursive: true });
    const d = diagnose(dir);
    assert.equal(d.status, "FAIL");
    assert.equal(d.code, "MOTION_BROWSER_MISSING");
    assert.match(d.hint, /playwright install chromium/);
  });

  test("diretório chromium-* de outra revisão NÃO é PASS → MOTION_BROWSER_VERSION_MISMATCH", async () => {
    const dir = path.join(tmp, "pw-mismatch");
    await mkdir(path.join(dir, "chromium-1", "chrome-linux64"), { recursive: true });
    await writeFile(path.join(dir, "chromium-1", "chrome-linux64", "chrome"), "#!/bin/sh\nexit 0\n");
    await chmod(path.join(dir, "chromium-1", "chrome-linux64", "chrome"), 0o755);
    const d = diagnose(dir);
    assert.equal(d.status, "FAIL");
    assert.equal(d.code, "MOTION_BROWSER_VERSION_MISMATCH");
    assert.deepEqual(d.details.installedRevisions, ["1"]);
  });

  test("executável presente mas não inicia → FAIL MOTION_BROWSER_LAUNCH_FAILED", async () => {
    const dir = path.join(tmp, "pw-broken");
    const exe = expectedExecutable(dir);
    await mkdir(path.dirname(exe), { recursive: true });
    await writeFile(exe, "#!/bin/sh\nexit 1\n"); await chmod(exe, 0o755);
    const d = diagnose(dir);
    assert.equal(d.status, "FAIL");
    assert.equal(d.code, "MOTION_BROWSER_LAUNCH_FAILED");
  });

  test("bibliotecas de sistema ausentes → FAIL MOTION_BROWSER_SYSTEM_DEPS", async () => {
    const dir = path.join(tmp, "pw-deps");
    const exe = expectedExecutable(dir);
    await mkdir(path.dirname(exe), { recursive: true });
    await writeFile(exe, "#!/bin/sh\necho 'error while loading shared libraries: libnss3.so: cannot open shared object file' >&2\nexit 127\n"); await chmod(exe, 0o755);
    const d = diagnose(dir);
    assert.equal(d.status, "FAIL");
    assert.equal(d.code, "MOTION_BROWSER_SYSTEM_DEPS");
    assert.match(d.hint, /install-deps/);
  });

  test("Chromium correto com smoke test → PASS", { skip: !process.env.CI && false }, async (t) => {
    if (!browserInstalled) return t.skip("NOT_TESTED: Chromium não instalado neste ambiente");
    const r = sh("node", ["--input-type=module", "-e", `import {diagnoseBrowser} from "${BROWSER_LIB}"; console.log(JSON.stringify(await diagnoseBrowser()));`]);
    const d = JSON.parse(r.stdout);
    assert.ok(["PASS", "WARN"].includes(d.status));
    assert.ok(d.browserVersion);
  });
});

describe("M-010 — --sample-frames encaminhado pelo CLI", () => {
  test("parser: índices, intervalos, ordem preservada", () => {
    assert.deepEqual(parseFrameSelection("0,120,240-242,899", 900), [0, 120, 240, 241, 242, 899]);
    assert.deepEqual(parseFrameSelection([5, 3], 10), [5, 3]);
    assert.equal(parseFrameSelection(undefined, 10), null);
  });

  test("parser rejeita duplicatas, fora do intervalo, intervalo invertido e lixo", () => {
    for (const bad of ["1,1", "0,10", "5-3", "a,b", "-1", "", "1,,2"]) {
      assert.throws(() => parseFrameSelection(bad, 10), (e) => e.code === "MOTION_INVALID_SAMPLE_FRAMES", `deveria rejeitar "${bad}"`);
    }
  });

  test("CLI → Core: renderiza exatamente os quadros pedidos", async (t) => {
    if (!browserInstalled) return t.skip("NOT_TESTED: Chromium indisponível");
    const html = await fixture("sample-ok", page("", CONTROLLER));
    const out = path.join(tmp, "sample-ok", "frames");
    const r = sh("node", [CLI, "render", "frames", html, out, "--frames=60", "--width=200", "--height=120", "--sample-frames=0,10,20-21"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const files = (await readdir(out)).filter((f) => f.endsWith(".png")).sort();
    assert.deepEqual(files, ["0000.png", "0010.png", "0020.png", "0021.png"]);
    const report = json(r);
    assert.equal(report.status, "OK");
    assert.deepEqual(report.producedFrames, [0, 10, 20, 21]);
    assert.equal(report.framesRequested, 4);
  });

  test("CLI aceita a forma com espaço e rejeita seleção inválida com código estruturado", async (t) => {
    if (!browserInstalled) return t.skip("NOT_TESTED: Chromium indisponível");
    const html = await fixture("sample-bad", page("", CONTROLLER));
    const out = path.join(tmp, "sample-bad", "frames");
    const r = sh("node", [CLI, "render", "frames", html, out, "--frames=30", "--sample-frames", "2,2"]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /MOTION_INVALID_SAMPLE_FRAMES/);
    assert.deepEqual(await readdir(out), [], "nenhum quadro deve ser gerado");
  });
});

describe("M-011 — imagens e recursos com falha são reportados", () => {
  const run = (html, extra = []) => sh("node", [STATIC, html, html.replace("index.html", "out.png"), "--width=200", "--height=120", "--scale=1", "--wait=0", ...extra]);

  test("imagem local quebrada (404) → FAIL com URL afetada", async (t) => {
    if (!browserInstalled) return t.skip("NOT_TESTED: Chromium indisponível");
    const html = await fixture("img-broken", page('<img src="missing.png" width="20" height="20">'));
    const r = run(html);
    assert.equal(r.status, 4);
    const rep = json(r);
    assert.equal(rep.status, "FAIL");
    assert.ok(rep.health.errorCodes.includes("MOTION_RENDER_ASSET_FAILED"));
    assert.ok(rep.health.errors.some((e) => /missing\.png/.test(e.url ?? e.message)));
  });

  test("imagem corrompida (bytes inválidos) → FAIL", async (t) => {
    if (!browserInstalled) return t.skip("NOT_TESTED: Chromium indisponível");
    const html = await fixture("img-corrupt", page('<img src="bad.png" width="20" height="20">'), { "bad.png": "not a png" });
    assert.equal(json(run(html)).status, "FAIL");
  });

  test("imagem opcional (data-optional) → WARN, não bloqueia", async (t) => {
    if (!browserInstalled) return t.skip("NOT_TESTED: Chromium indisponível");
    const html = await fixture("img-optional", page('<img data-optional src="missing.png" width="20" height="20">'));
    const r = run(html);
    assert.equal(r.status, 0);
    assert.equal(json(r).status, "WARN");
  });

  test("--optional-assets rebaixa padrão de URL para aviso", async (t) => {
    if (!browserInstalled) return t.skip("NOT_TESTED: Chromium indisponível");
    const html = await fixture("img-optional-flag", page('<img src="deco-1.png" width="20" height="20">'));
    assert.equal(json(run(html, ["--optional-assets=deco-*.png"])).status, "WARN");
  });

  test("render estático válido com SVG como imagem → OK", async (t) => {
    if (!browserInstalled) return t.skip("NOT_TESTED: Chromium indisponível");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#f00"/></svg>';
    const html = await fixture("img-ok", page('<img src="a.svg" width="20" height="20">'), { "a.svg": svg });
    const r = run(html);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(json(r).status, "OK");
  });
});

describe("M-012 — erros de JavaScript invalidam o render", () => {
  const runStatic = (html, extra = []) => sh("node", [STATIC, html, html.replace("index.html", "out.png"), "--width=200", "--height=120", "--scale=1", "--wait=0", ...extra]);

  test("import de módulo com especificador solto → FAIL MOTION_RENDER_MODULE_IMPORT (caso GTA VI)", async (t) => {
    if (!browserInstalled) return t.skip("NOT_TESTED: Chromium indisponível");
    const html = await fixture("module-bad", page('<script type="module">import { createMotionDriver } from "creative-core/design-system/frame.js"; createMotionDriver();</script>'));
    const r = runStatic(html);
    assert.equal(r.status, 4);
    const rep = json(r);
    assert.equal(rep.status, "FAIL");
    assert.ok(rep.health.errorCodes.includes("MOTION_RENDER_MODULE_IMPORT"));
    assert.ok(rep.pageErrors.length >= 1, "pageErrors deve continuar exposto por compatibilidade");
  });

  test("exceção em script → FAIL MOTION_RENDER_PAGE_ERROR", async (t) => {
    if (!browserInstalled) return t.skip("NOT_TESTED: Chromium indisponível");
    const html = await fixture("js-throw", page("<script>throw new Error('boom')</script>"));
    const rep = json(runStatic(html));
    assert.equal(rep.status, "FAIL");
    assert.ok(rep.health.errorCodes.includes("MOTION_RENDER_PAGE_ERROR"));
  });

  test("render por quadro sem controlador (__onFrame__) → FAIL MOTION_RENDER_CONTROLLER_MISSING", async (t) => {
    if (!browserInstalled) return t.skip("NOT_TESTED: Chromium indisponível");
    const html = await fixture("no-controller", page(""));
    const rep = json(runStatic(html, ["--frame=5", "--frames=30"]));
    assert.equal(rep.status, "FAIL");
    assert.ok(rep.health.errorCodes.includes("MOTION_RENDER_CONTROLLER_MISSING"));
  });

  test("controlador que lança exceção → FAIL", async (t) => {
    if (!browserInstalled) return t.skip("NOT_TESTED: Chromium indisponível");
    const html = await fixture("controller-throws", page("<script>window.__onFrame__=()=>{throw new Error('frame boom')}</script>"));
    const rep = json(runStatic(html, ["--frame=5", "--frames=30"]));
    assert.equal(rep.status, "FAIL");
  });

  test("render_frames: composição quebrada falha cedo, sem gerar quadros enganosos", async (t) => {
    if (!browserInstalled) return t.skip("NOT_TESTED: Chromium indisponível");
    const html = await fixture("frames-broken", page('<script type="module">import "bare-specifier";</script>', CONTROLLER));
    const out = path.join(tmp, "frames-broken", "frames");
    const r = sh("node", [FRAMES, html, out, "--frames=30", "--width=200", "--height=120"]);
    assert.equal(r.status, 4);
    const rep = json(r);
    assert.equal(rep.status, "FAIL");
    assert.equal(rep.framesRendered, 0);
    assert.ok(rep.health.errorCodes.includes("MOTION_RENDER_MODULE_IMPORT"));
  });

  test("render_frames: sem controlador → FAIL, a menos que --allow-no-controller", async (t) => {
    if (!browserInstalled) return t.skip("NOT_TESTED: Chromium indisponível");
    const html = await fixture("frames-static", page(""));
    const out = path.join(tmp, "frames-static", "frames");
    const strict = sh("node", [FRAMES, html, out, "--frames=3", "--width=200", "--height=120"]);
    assert.equal(json(strict).status, "FAIL");
    const lax = sh("node", [FRAMES, html, out, "--frames=3", "--width=200", "--height=120", "--allow-no-controller"]);
    assert.equal(lax.status, 0, lax.stderr);
    assert.equal(json(lax).framesRendered, 3);
  });

  test("composição saudável com controlador → OK e quadros diferentes", async (t) => {
    if (!browserInstalled) return t.skip("NOT_TESTED: Chromium indisponível");
    const html = await fixture("frames-ok", page("", CONTROLLER));
    const out = path.join(tmp, "frames-ok", "frames");
    const r = sh("node", [FRAMES, html, out, "--frames=20", "--width=200", "--height=120", "--sample-frames=0,19"]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(json(r).status, "OK");
    assert.ok(await exists(path.join(out, "0019.png")));
  });
});
