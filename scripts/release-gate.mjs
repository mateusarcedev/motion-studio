#!/usr/bin/env node
/**
 * Release gate (NO publishing). Runs the full pre-publish checklist and writes a report.
 *   node scripts/release-gate.mjs [--report=docs/reports/RELEASE_1_1_0_REPORT.md] [--skip-tests]
 * Every step is PASS / FAIL / BLOCKED / NOT_TESTED — a step that did not run is never PASS.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const PKGS = ["motion-core", "motion-skills", "motion-cli", "motion-studio"];
const manifests = Object.fromEntries(await Promise.all(PKGS.map(async (p) => [p, JSON.parse(await readFile(path.join(root, "packages", p, "package.json"), "utf8"))])));
const VERSION = manifests["motion-core"].version;
const reportPath = path.resolve(root, args.report ?? `docs/reports/RELEASE_${VERSION.replaceAll(".", "_")}_REPORT.md`);
const results = [];
const sh = (cmd, a, o = {}) => spawnSync(cmd, a, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...o });
const step = (id, title, status, details = "", evidence = "") => { results.push({ id, title, status, details, evidence }); console.log(`${{ PASS: "✅", FAIL: "❌", BLOCKED: "⛔", NOT_TESTED: "⚪", WARN: "⚠️" }[status]} ${id} ${title}${details ? ` — ${details}` : ""}`); };
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

// 1 ── versions & internal deps
{
  const problems = [];
  const versions = new Set(Object.values(manifests).map((m) => m.version));
  if (versions.size !== 1) problems.push(`versões divergentes: ${[...versions]}`);
  for (const m of Object.values(manifests)) for (const [n, v] of Object.entries({ ...m.dependencies, ...m.peerDependencies })) {
    if (n.startsWith("@technomanceer/") && v !== VERSION) problems.push(`${m.name} → ${n}@${v} (esperado ${VERSION})`);
    if (/^(file|workspace|link):/.test(v)) problems.push(`${m.name} → ${n} usa ${v}`);
    if (/-(rc|alpha|beta|next)/.test(v) && n.startsWith("@technomanceer/")) problems.push(`${m.name} depende de prerelease ${n}@${v}`);
  }
  step("R1", "Versionamento e dependências internas exatas", problems.length ? "FAIL" : "PASS", problems.join("; ") || `4 pacotes em ${VERSION}, deps internas exatas, sem prerelease/file:`);
}

// 3 ── tarballs
const dist = path.join(root, "dist", "packages");
await rm(dist, { recursive: true, force: true });
const pack = sh("node", ["scripts/pack-all.mjs"]);
const tarballs = (await readdir(dist).catch(() => [])).filter((f) => f.endsWith(".tgz")).sort();
if (pack.status !== 0 || tarballs.length !== 4) step("R4", "Geração de tarballs", "FAIL", pack.stderr.slice(0, 300));
else {
  const sums = [];
  for (const t of tarballs) sums.push(`${sha(await readFile(path.join(dist, t)))}  ${t}`);
  await writeFile(path.join(dist, `SHA256SUMS-${VERSION}.txt`), sums.join("\n") + "\n");
  step("R4", "Geração de tarballs + SHA-256", "PASS", tarballs.map((t) => `${t} (${Math.round((await_size(path.join(dist, t))) / 1024)} kB)`).join(", "));
}
function await_size(p) { return Number(spawnSync("stat", ["-c", "%s", p], { encoding: "utf8" }).stdout); }

// 2 ── tests
if (args["skip-tests"]) step("R2", "Suíte de testes", "NOT_TESTED", "--skip-tests");
else {
  const r = sh("node", ["--test", ...(await readdir(path.join(root, "tests"))).filter((f) => f.endsWith(".test.mjs")).map((f) => `tests/${f}`)]);
  const get = (k) => r.stdout.match(new RegExp(`ℹ ${k} (\\d+)`))?.[1];
  step("R2", "Suíte de testes completa", r.status === 0 && get("fail") === "0" ? "PASS" : "FAIL", `tests ${get("tests")}, pass ${get("pass")}, fail ${get("fail")}, skipped ${get("skipped")}`);
}
{ const r = sh("node", ["scripts/verify-public-skills.mjs"]); step("R3", "Skills públicas: manifesto, licenças e hashes", r.status === 0 ? "PASS" : "FAIL", r.stdout.trim().split("\n").pop()); }

// 4 ── tarball content audit
{
  const problems = [], info = [];
  for (const t of tarballs) {
    const list = sh("tar", ["-tzf", path.join(dist, t)]).stdout.split("\n").filter(Boolean);
    // the Skills package legitimately carries third-party skill scripts/tests; the strict filter applies to code packages
    const strict = !t.includes("skills");
    const bad = list.filter((f) => (strict ? /(__pycache__|\.pyc$|\/tests?\/|\.env|\.DS_Store|node_modules\/|\/tmp\/|\.test\.mjs$)/ : /(__pycache__|\.pyc$|\.env$|\.DS_Store|node_modules\/|\/tmp\/)/).test(f));
    if (bad.length) problems.push(`${t}: arquivos indevidos ${bad.slice(0, 3)}`);
    info.push(`${t.replace("technomanceer-", "").replace(`-${VERSION}.tgz`, "")}: ${list.length} arquivos`);
    const pj = JSON.parse(sh("tar", ["-xzOf", path.join(dist, t), "package/package.json"]).stdout);
    for (const [n, v] of Object.entries(pj.dependencies ?? {})) if (/^(file|workspace):/.test(v)) problems.push(`${pj.name}: dep ${n}=${v}`);
    for (const bin of Object.values(pj.bin ?? {})) if (!list.includes(`package/${bin.replace(/^\.\//, "")}`)) problems.push(`${pj.name}: bin ausente ${bin}`);
  }
  const core = sh("tar", ["-tzf", path.join(dist, tarballs.find((t) => t.includes("motion-core")) ?? "")]).stdout;
  for (const must of ["design-system/svg-motion.js", "design-system/lottie-motion.js", "assets/vendor/lottie_light.min.js", "assets/vendor/LICENSE-lottie-web.md", "assets/icons/lucide.pack.json", "assets/icons/LICENSE-lucide.txt", "assets/packs/developer-icons.pack.json", "assets/packs/humaaans.pack.json", "assets/lottie/check-pop.json", "lib/static-server.mjs", "visual-assets/providers/registry.mjs"]) if (!core.includes(`package/${must}`)) problems.push(`motion-core sem ${must}`);
  step("R5", "Conteúdo dos tarballs (sem lixo, bins, assets e licenças presentes)", problems.length ? "FAIL" : "PASS", problems.join("; ") || info.join(" · "));
}

// 5 ── clean consumer (offline-from-repo: only the 4 tarballs; third-party deps come from the registry)
const work = await (async () => { const d = path.join(os.tmpdir(), `motion-release-gate-${process.pid}`); await rm(d, { recursive: true, force: true }); await mkdir(d, { recursive: true }); return d; })();
const run = (cmd, a, o = {}) => spawnSync(cmd, a, { cwd: work, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...o });
let installed = false;
{
  run("npm", ["init", "-y"]);
  const r = run("npm", ["install", "--no-audit", "--no-fund", ...tarballs.map((t) => path.join(dist, t))]);
  installed = r.status === 0;
  const lock = installed ? JSON.parse(await readFile(path.join(work, "package.json"), "utf8")) : {};
  step("R6", "Instalação em diretório limpo a partir dos tarballs", installed ? "PASS" : "BLOCKED", installed ? `dependências: ${Object.keys(lock.dependencies ?? {}).join(", ")}` : `npm install falhou (rede/registro?): ${r.stderr.split("\n").slice(0, 3).join(" ")}`);
}
const motion = (a, o = {}) => run("npx", ["--no-install", "motion", ...a], o);
if (!installed) for (const id of ["R7", "R8", "R9", "R10", "R11", "R12", "R13", "R14"]) step(id, "Verificação no consumidor", "BLOCKED", "instalação indisponível — reproduzir: instalar os 4 tarballs de dist/packages em uma pasta limpa e repetir os comandos do relatório");
else {
  const v = motion(["--version"]);
  step("R7", "CLI instalada: versão e binário", v.stdout.includes(`v${VERSION}`) ? "PASS" : "FAIL", v.stdout.trim());
  const d = motion(["doctor"]);
  const line = d.stdout.split("\n").find((l) => l.includes("Chromium (Playwright)")) ?? "";
  step("R8", "motion doctor (Chromium pinado + smoke test)", /PASS/.test(line) ? "PASS" : /WARN/.test(line) ? "WARN" : /FAIL/.test(line) ? "FAIL" : "NOT_TESTED", line.replace(/\|/g, "·").slice(0, 200));

  // assets
  const picks = [["velocidade", "icon"], ["Docker", "logo"], ["pessoas apresentando", "character"], ["sino de notificação animado", "animated-icon"], ["animação de sucesso", "lottie"]];
  const bad = [];
  for (const [q, kind] of picks) { const r = motion(["assets", "pick", q]); try { const j = JSON.parse(r.stdout); if (j.kind !== kind || j.fallback) bad.push(`${q}→${j.kind}`); } catch { bad.push(`${q}: erro`); } }
  step("R9", "Resolução automática de assets (5 tipos) no consumidor", bad.length ? "FAIL" : "PASS", bad.join("; ") || "icon, logo, character, animated-icon, lottie");

  // svg
  await writeFile(path.join(work, "a.svg"), "x");
  const comp = motion(["svg", "component", "waveLayers", "w.svg", "--seed=3"]);
  const val = motion(["svg", "validate", "w.svg"]);
  const ras = motion(["svg", "rasterize", "w.svg", "w.png", "--width=400"]);
  const badSvg = run("sh", ["-c", `printf '<svg><g></svg>' > bad.svg && npx --no-install motion svg validate bad.svg`]);
  step("R10", "SVG: gerar, validar, rasterizar; malformado reprovado", comp.status === 0 && /"PASS"/.test(val.stdout) && ras.status === 0 && badSvg.status === 4 ? "PASS" : "FAIL", `component ${comp.status}, validate ${val.status}, rasterize ${ras.status}, malformado exit ${badSvg.status}`);

  // render: static + frames (svg-motion + lottie via import map) + video with audio + qa
  const lottie = await readFile(path.join(root, "packages/motion-core/assets/lottie/check-pop.json"), "utf8");
  await writeFile(path.join(work, "scene.html"), `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#0b0f14;width:320px;height:180px;display:flex;align-items:center;justify-content:space-around}#box{width:140px;height:140px}svg.ic{width:100px;height:100px}</style></head><body><div id="box"></div>
<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="#4F8CFF" stroke-width="2" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>
<script type="module">
import { createSvgMotion } from "@technomanceer/motion-core/svg-motion";
import { createLottieMotion } from "@technomanceer/motion-core/lottie";
const sm = createSvgMotion(document.querySelector("svg.ic"), [{ target: ":scope > *", effect: "draw", start: 0, duration: 1 }]);
const data = ${lottie};
window.__MOTION_READY__ = createLottieMotion(document.getElementById("box"), data).then((lm) => { window.__onFrame__ = (M) => { sm.seek(M); lm.seek(M); }; });
</script></body></html>`);
  const st = motion(["render", "static", "scene.html", "s.png", "--width=320", "--height=180", "--scale=1", "--frame=20", "--frames=30"]);
  const fr = motion(["render", "frames", "scene.html", "frames", "--frames=30", "--width=320", "--height=180"]);
  const frOk = fr.status === 0 && (await readdir(path.join(work, "frames")).catch(() => [])).filter((f) => f.endsWith(".png")).length === 30;
  step("R11", "Render real: PNG estático + 30 frames (svg-motion + Lottie via import map)", st.status === 0 && frOk ? "PASS" : "FAIL", `static exit ${st.status}, frames exit ${fr.status}, quadros ${frOk ? 30 : "≠30"}`);

  const ff = (a) => spawnSync("ffmpeg", ["-v", "error", "-y", ...a], { encoding: "utf8" });
  if (!frOk || ff(["-version"]).error) step("R12", "Vídeo com áudio + QA de mídia", "BLOCKED", "frames ou ffmpeg indisponíveis", "reproduzir: motion render video frames out.mp4 --audio=tone.wav && motion qa media out.mp4 --audio");
  else {
    ff(["-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000:duration=1,volume=0.3", path.join(work, "tone.wav")]);
    const vid = motion(["render", "video", "frames", "out.mp4", "--fps=30", "--audio=tone.wav"]);
    const qa = motion(["qa", "media", "out.mp4", "--width=320", "--height=180", "--fps=30", "--duration=1", "--audio", "--json"]);
    let j = null; try { j = JSON.parse(qa.stdout); } catch {}
    const failing = j?.checks?.filter((c) => c.status === "FAIL") ?? [];
    step("R12", "Vídeo MP4 com áudio + QA de mídia (codec/fps/duração/áudio/sync)", vid.status === 0 && j && failing.length === 0 ? "PASS" : "FAIL", `render ${vid.status}, veredito ${j?.status}, falhas: ${failing.map((c) => c.id).join(",") || "nenhuma"}`);
  }
  const qf = motion(["qa", "frames", "frames", "--expected=30", "--json"]);
  let qj = null; try { qj = JSON.parse(qf.stdout); } catch {}
  step("R13", "QA de quadros (animação presente, sem vazios)", qj && !qj.checks.some((c) => c.status === "FAIL") ? "PASS" : "FAIL", `veredito ${qj?.status}`);

  await writeFile(path.join(work, "bad.html"), '<!doctype html><script type="module">import "nope-bare";</script>');
  const e1 = motion(["render", "static", "bad.html", "bad.png", "--width=100", "--height=100"]);
  const e2 = motion(["render", "frames", "scene.html", "x", "--frames=30", "--sample-frames=5,5"]);
  step("R14", "Erros estruturados (import quebrado → exit 4; sample-frames inválido → exit 2)", e1.status === 4 && /MOTION_RENDER_MODULE_IMPORT/.test(e1.stderr) && e2.status === 2 && /MOTION_INVALID_SAMPLE_FRAMES/.test(e2.stderr) ? "PASS" : "FAIL", `exit ${e1.status} / ${e2.status}`);
}

// 6 ── node versions & registry
{
  const nodeV = process.version;
  step("R15", "Compatibilidade com Node.js (engines: >=18)", "NOT_TESTED", `executado apenas em ${nodeV}; reproduzir em Node 18/20/22 (ex.: \`npx -p node@18 -- node scripts/release-gate.mjs --skip-tests\`)`);
  const who = sh("npm", ["whoami"]);
  step("R16", "Autenticação npm", who.status === 0 ? "PASS" : "BLOCKED", who.status === 0 ? `logado como ${who.stdout.trim()}` : "npm login necessário");
  const free = [];
  for (const m of Object.values(manifests)) { const r = sh("npm", ["view", `${m.name}@${VERSION}`, "version"]); free.push(`${m.name}@${VERSION} ${r.status !== 0 && /E404/.test(r.stderr) ? "livre" : r.status === 0 ? "JÁ EXISTE" : "?"}`); }
  step("R17", "Versão ainda não publicada no registro", free.every((f) => f.endsWith("livre")) ? "PASS" : "FAIL", free.join(" · "));
}

await rm(work, { recursive: true, force: true });
const overall = results.some((r) => r.status === "FAIL") ? "FAIL" : results.some((r) => r.status === "BLOCKED") ? "BLOCKED" : results.some((r) => r.status === "NOT_TESTED") ? "NOT_TESTED (itens declarados)" : "PASS";
const md = [`# Relatório do release gate — ${VERSION}`, "", `Gerado por \`scripts/release-gate.mjs\` em ${new Date().toISOString()} (Node ${process.version}, ${os.platform()} ${os.release()}).`, `**Nada foi publicado.** Veredito: **${overall}**`, "", "| # | Verificação | Estado | Detalhes |", "|---|---|---|---|", ...results.map((r) => `| ${r.id} | ${r.title} | ${r.status} | ${r.details.replace(/\|/g, "·")} |`), ""].join("\n");
await writeFile(reportPath, md);
console.log(`\nVeredito: ${overall}\nRelatório: ${path.relative(root, reportPath)}`);
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
