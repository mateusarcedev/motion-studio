/** Mission 20.1 — Visual Asset Provider Registry: providers, licenses, cache, offline, determinism, Skills. */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDefaultRegistry, createProviderRegistry, defineProvider, createAssetSession, assessLicense, buildCredits, createAssetCache,
  validateLottie, importSvgPack, classifyNeed, validateSvg, buildSvgComponent,
} from "../packages/motion-core/index.js";
import { createIconifyProvider, readDotLottie, loadLottieFile, createPackProvider, MOTION_PRESETS, presetFor } from "../packages/motion-core/visual-assets/providers/index.mjs";
import { createPack } from "../packages/motion-core/icons/index.mjs";
import * as sm from "../packages/motion-core/design-system/svg-motion.js";
import { lottieFrameAt } from "../packages/motion-core/design-system/lottie-motion.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const tmp = path.join(here, "tmp", "providers");
const FRAMES = path.join(root, "packages/motion-core/renderers/render_frames.mjs");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const neverFetch = async () => { throw new Error("rede não deveria ser usada"); };
let registry, browserOk = false;

before(async () => {
  await rm(tmp, { recursive: true, force: true }); await mkdir(tmp, { recursive: true });
  registry = await createDefaultRegistry({ cwd: tmp, env: { ...process.env, MOTION_ICON_PACKS: "", MOTION_ASSET_PACKS: "", MOTION_LOTTIE: "" }, fetchImpl: neverFetch });
  const r = spawnSync("node", ["--input-type=module", "-e", `import {diagnoseBrowser} from "${path.join(root, "packages/motion-core/lib/browser.mjs")}"; console.log((await diagnoseBrowser()).status)`], { encoding: "utf8" });
  browserOk = /PASS|WARN/.test(r.stdout);
});

describe("Registry e contrato de providers", () => {
  test("descoberta: providers padrão com tipos, capacidades e licenças declaradas", async () => {
    const d = Object.fromEntries((await registry.describe()).map((p) => [p.id, p]));
    for (const id of ["lucide", "developer-icons", "humaaans", "animateicons", "lottie", "iconify"]) assert.ok(d[id], `provider ${id}`);
    assert.deepEqual(d["developer-icons"].kinds, ["logo"]); assert.deepEqual(d.humaaans.kinds, ["character"]);
    assert.equal(d.iconify.status.state, "opt-in", "rede é opt-in");
    assert.equal(d.animateicons.status.state, "limited", "limitação documentada no status");
    assert.equal(d.animateicons.capabilities.deterministicAnimation, true);
    assert.equal(d["developer-icons"].license.trademark, true);
    assert.match(d.humaaans.license.attribution, /Pablo Stanley/);
  });
  test("defineProvider rejeita contratos inválidos", () => {
    assert.throws(() => defineProvider({ id: "Bad ID", kinds: ["icon"], search() {}, resolve() {}, license: { code: "MIT" } }), /kebab/);
    assert.throws(() => defineProvider({ id: "x", kinds: ["emoji"], search() {}, resolve() {}, license: { code: "MIT" } }), /kinds/);
    assert.throws(() => defineProvider({ id: "x", kinds: ["icon"], license: { code: "MIT" } }), /search/);
    assert.throws(() => defineProvider({ id: "x", kinds: ["icon"], search() {}, resolve() {} }), /license/);
  });
  test("nova biblioteca = novo provider, sem alterar o núcleo do resolver", async () => {
    const reg = createProviderRegistry();
    reg.register({ id: "fixture-lib", kinds: ["icon"], license: { code: "MIT", spdx: "MIT" }, search: async () => [{ id: "fixture:rocket", kind: "icon", score: 20, reasons: ["fixture"], style: { kind: "stroke" }, license: { spdx: "MIT" } }], resolve: async (c) => ({ id: c.id, kind: "icon", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>', provenance: { id: c.id, pack: "Fixture", license: "MIT" }, license: { spdx: "MIT" } }) });
    assert.throws(() => reg.register({ id: "fixture-lib", kinds: ["icon"], license: { code: "MIT" }, search() {}, resolve() {} }), /já registrado/);
    const s = await createAssetSession({ registry: reg, packs: (await (await import("../packages/motion-core/icons/index.mjs")).loadIconPacks({ cwd: tmp })).packs });
    assert.equal((await s.asset("foguete")).id, "fixture:rocket");
  });
  test("provider indisponível ou com erro é ignorado e reportado; nunca derruba a busca", async () => {
    const reg = createProviderRegistry({ providers: [
      { id: "down", kinds: ["icon"], license: { code: "MIT" }, status: async () => ({ state: "unavailable", reason: "fora do ar" }), search: async () => [], resolve: async () => ({}) },
      { id: "boom", kinds: ["icon"], license: { code: "MIT" }, search: async () => { throw new Error("explodiu"); }, resolve: async () => ({}) },
    ] });
    const r = await reg.search("x");
    assert.deepEqual(r.skipped.map((s) => s.provider).sort(), ["boom", "down"]);
    assert.deepEqual(r.candidates, []);
  });
  test("licença não permitida é bloqueada e reportada (NC, ND, desconhecida)", async () => {
    const mk = (id, spdx) => ({ id, kinds: ["icon"], license: { code: spdx, spdx }, search: async () => [{ id: `${id}:a`, kind: "icon", score: 50, reasons: [], license: { spdx } }], resolve: async () => ({}) });
    const reg = createProviderRegistry({ providers: [mk("nc", "CC-BY-NC-4.0"), mk("nd", "CC-BY-ND-4.0"), mk("unk", "UNKNOWN"), mk("ok", "MIT")] });
    const r = await reg.search("x");
    assert.deepEqual(r.candidates.map((c) => c.provider), ["ok"]);
    assert.equal(r.blocked.length, 3);
    assert.match(r.blocked.find((b) => b.provider === "nc").reason, /comercial/);
  });
});

describe("Licenciamento e créditos", () => {
  test("política: permissivas ok, atribuição CC-BY, bloqueios, licença do código ≠ licença dos assets", () => {
    assert.equal(assessLicense({ spdx: "MIT" }).allowed, true);
    assert.deepEqual([assessLicense({ spdx: "CC-BY-4.0" }).allowed, assessLicense({ spdx: "CC-BY-4.0" }).attributionRequired], [true, true]);
    for (const s of ["CC-BY-NC-4.0", "CC-BY-SA-4.0", "GPL-3.0-only", "CC-BY-ND-4.0", "UNKNOWN"]) assert.equal(assessLicense({ spdx: s }).allowed, false, s);
    const code = assessLicense({ spdx: "MIT", scope: "code", trademark: true });
    assert.ok(code.warnings.some((w) => /código da biblioteca/.test(w)) && code.warnings.some((w) => /marca registrada/.test(w)) && code.trademark);
    assert.equal(assessLicense({ grant: "user-licensed" }).allowed, false, "licença do usuário exige confirmação comercial");
    assert.equal(assessLicense({ grant: "user-licensed", commercialUse: true }).allowed, true);
  });
  test("créditos listam atribuição obrigatória (Humaaans) e marcas (Developer Icons)", async () => {
    const s = await createAssetSession({ registry });
    await s.asset("pessoas apresentando"); await s.asset("Docker");
    const c = s.credits();
    assert.match(c.markdown, /Humaaans.*atribuição obrigatória.*Pablo Stanley/);
    assert.match(c.markdown, /Marcas pertencem aos respectivos titulares/);
    assert.ok(buildCredits([]).markdown.startsWith("# Créditos"));
    assert.ok(s.manifest().credits.length >= 2);
  });
  test("proveniência traz hash do asset, licença detalhada e escopo", async () => {
    const s = await createAssetSession({ registry });
    const a = await s.asset("Docker");
    assert.match(a.provenance.sha256, /^[0-9a-f]{16}$/);
    assert.equal(a.provenance.licenseDetail.trademark, true); assert.equal(a.provenance.licenseDetail.scope, "code");
    assert.equal(a.provenance.kind, "logo");
  });
});

describe("Seleção automática por intenção (PT/EN)", () => {
  test("classificação do tipo de recurso, sem o usuário escolher biblioteca", () => {
    assert.equal(classifyNeed("pessoas trabalhando").groups[0][0], "character");
    assert.equal(classifyNeed("sino de notificação animado").groups[1][0], "animated-icon");
    assert.equal(classifyNeed("success lottie").groups[0][0], "lottie");
    assert.equal(classifyNeed("cena de ilustração").groups[0][0], "illustration");
    assert.equal(classifyNeed("segurança").groups[1][0], "icon");
  });
  const logoCases = [["Docker", "docker"], ["PostgreSQL", "postgre-sql"], ["Postgres", "postgre-sql"], ["JavaScript", "java-script"], ["TypeScript", "type-script"], ["Node.js", "node-js"], ["usar K8s no deploy", "kubernetes"], ["Python", "python"]];
  for (const [intent, name] of logoCases) {
    test(`logo por nome/alias: "${intent}" → ${name}`, async () => {
      const r = await registry.search(intent, { kinds: ["logo"], limit: 3 });
      assert.ok(r.candidates.some((c) => c.id === `developer-icons:${name}`), `${intent}: ${r.candidates.map((c) => c.id)}`);
    });
  }
  test("logos só aparecem quando a tecnologia é citada: palavras comuns não viram marca", async () => {
    for (const intent of ["próximo passo do plano", "go ahead and react to feedback", "segurança dos dados", "equipe feliz"]) {
      assert.deepEqual((await registry.search(intent, { kinds: ["logo"] })).candidates, [], intent);
    }
    assert.ok((await registry.search("integração com React", { kinds: ["logo"] })).candidates.length, "React capitalizado = tecnologia");
    assert.ok((await registry.search("a biblioteca react", { kinds: ["logo"] })).candidates.length, "contexto 'biblioteca' autoriza");
  });
  test("logos nunca são recoloridos (marca preservada) e mantêm a proporção", async () => {
    const s = await createAssetSession({ registry, color: "#ff00aa", size: 64 });
    const a = await s.asset("Docker");
    assert.ok(!a.svg.includes("#ff00aa")); assert.match(a.svg, /viewBox="0 0 \d+ \d+"/);
    assert.equal(validateSvg(a.svg).status, "PASS");
  });
  test("personagens: pose sentada para trabalho, em pé para apresentação; sem repetir entre intenções", async () => {
    const s = await createAssetSession({ registry });
    const w = await s.asset("pessoa trabalhando no notebook"), p = await s.asset("pessoa apresentando um projeto"), q = await s.asset("equipe de pessoas estudando");
    assert.match(w.id, /sitting/); assert.match(p.id, /standing/);
    assert.equal(new Set([w.id, p.id, q.id]).size, 3);
    assert.equal(validateSvg(w.svg).ok, true);
  });
  test("consistência de estilo: ícones do mesmo traço; intenções diferentes → assets diferentes; mesma intenção estável", async () => {
    const s = await createAssetSession({ registry, strokeWidth: 1.75, size: 40, color: "#0af" });
    const a = await s.asset("segurança"), b = await s.asset("privacidade"), c = await s.asset("segurança");
    for (const x of [a, b]) { assert.equal(x.provider, "lucide"); assert.match(x.svg, /stroke-width="1.75"/); }
    assert.notEqual(a.id, b.id); assert.equal(a.id, c.id);
  });
  test("sem correspondência adequada → glifo original (WARN), nunca asset aleatório", async () => {
    const s = await createAssetSession({ registry });
    const a = await s.asset("xyzzy qwerty plugh");
    assert.equal(a.fallback, true); assert.equal(s.report().status, "WARN");
  });
  test("funciona 100% offline (nenhuma chamada de rede com padrões)", async () => {
    const s = await createAssetSession({ registry });
    for (const q of ["velocidade", "Docker", "pessoas", "sino animado"]) await s.asset(q);
    assert.ok(true); // neverFetch teria lançado
  });
});

describe("Iconify (opt-in): licença por coleção, cache e fallback", () => {
  const fixtures = (calls) => async (url) => {
    calls.push(url);
    const u = new URL(url);
    const json = (o, status = 200) => ({ ok: status === 200, status, json: async () => o });
    if (u.pathname === "/search") return json({ icons: ["tabler:rocket", "nclib:rocket", "evil:rocket"] });
    if (u.pathname === "/collections") {
      const p = u.searchParams.get("prefixes");
      return json({ tabler: { name: "Tabler", author: { name: "Paweł Kuna" }, license: { title: "MIT", spdx: "MIT" } }, nclib: { name: "NC Lib", license: { title: "CC BY-NC 4.0", spdx: "CC-BY-NC-4.0" } }, evil: { name: "Evil", license: { title: "MIT", spdx: "MIT" } } }[p] ? { [p]: { tabler: { name: "Tabler", author: { name: "Paweł Kuna" }, license: { title: "MIT", spdx: "MIT" } }, nclib: { name: "NC Lib", license: { title: "CC BY-NC 4.0", spdx: "CC-BY-NC-4.0" } }, evil: { name: "Evil", license: { title: "MIT", spdx: "MIT" } } }[p] } : {});
    }
    if (u.pathname === "/tabler.json") return json({ width: 24, height: 24, icons: { rocket: { body: '<path d="M4 4l16 16" stroke="currentColor" fill="none"/>' } } });
    if (u.pathname === "/evil.json") return json({ icons: { rocket: { body: '<script>alert(1)</script><path d="M0 0h24"/>' } } });
    return json({}, 404);
  };
  test("desativado por padrão; com allowNetwork usa coleção permitida e bloqueia NonCommercial", async () => {
    const off = createIconifyProvider({ fetchImpl: neverFetch });
    assert.equal((await off.status()).state, "opt-in");
    const calls = [], cache = createAssetCache({ dir: path.join(tmp, "iconify-cache") });
    const reg = createProviderRegistry({ providers: [createIconifyProvider({ allowNetwork: true, fetchImpl: fixtures(calls), cache })] });
    const r = await reg.search("foguete rocket", { kinds: ["icon"] });
    assert.ok(r.candidates.some((c) => c.id === "iconify:tabler:rocket"));
    assert.ok(r.blocked.some((b) => /nclib/.test(b.id) && /comercial/.test(b.reason)));
    const asset = await reg.resolve(r.candidates.find((c) => c.id.includes("tabler")), { size: 32 });
    assert.equal(asset.provenance.license, "MIT"); assert.match(asset.provenance.attribution, /Paweł Kuna/); assert.equal(validateSvg(asset.svg).status, "PASS");
  });
  test("cache: segunda execução funciona offline com o mesmo hash; entrada adulterada é descartada", async () => {
    const calls = [], dir = path.join(tmp, "iconify-cache2"), cache = createAssetCache({ dir });
    const online = createProviderRegistry({ providers: [createIconifyProvider({ allowNetwork: true, fetchImpl: fixtures(calls), cache })] });
    const c1 = (await online.search("rocket", { kinds: ["icon"] })).candidates.find((c) => c.id.includes("tabler"));
    const a1 = await online.resolve(c1);
    const before = calls.length;
    const offline = createProviderRegistry({ providers: [createIconifyProvider({ allowNetwork: false, fetchImpl: neverFetch, cache })] });
    // opt-in providers are skipped by the registry search, but cached resolution still works directly
    const a2 = await offline.resolve(c1);
    assert.equal(a1.sha256, a2.sha256); assert.equal(calls.length, before, "nenhuma chamada de rede");
    const key = "GET https://api.iconify.design/tabler.json?icons=rocket";
    const entry = await cache.get(key); assert.ok(entry && entry.sha256);
    const { readdir } = await import("node:fs/promises");
    for (const f of await readdir(dir)) { const e = JSON.parse(await readFile(path.join(dir, f), "utf8")); await writeFile(path.join(dir, f), JSON.stringify({ ...e, body: "{}" })); }
    assert.equal(await cache.get(key), null, "hash não confere → miss");
  });
  test("corpo remoto malicioso é rejeitado; indisponibilidade cai no Lucide (fallback)", async () => {
    const reg = createProviderRegistry({ providers: [createIconifyProvider({ allowNetwork: true, fetchImpl: fixtures([]), cache: createAssetCache({ dir: path.join(tmp, "iconify-cache3") }) })] });
    const evil = (await reg.search("rocket", { kinds: ["icon"] })).candidates.find((c) => c.id.includes("evil"));
    await assert.rejects(() => reg.resolve(evil), (e) => e.code === "MOTION_SVG_UNSAFE");
    const down = createProviderRegistry({ providers: [createIconifyProvider({ allowNetwork: true, fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }), cache: createAssetCache({ dir: path.join(tmp, "iconify-cache4") }) })] });
    assert.deepEqual((await down.search("rocket", { kinds: ["icon"] })).candidates, []);
    assert.equal((await down.search("rocket", { kinds: ["icon"] })).skipped[0].provider, "iconify");
    const s = await createAssetSession({ registry: await createDefaultRegistry({ cwd: tmp, allowNetwork: true, fetchImpl: async () => { throw new Error("offline"); }, cache: createAssetCache({ dir: path.join(tmp, "iconify-cache5") }) }) });
    assert.equal((await s.asset("velocidade")).provider, "lucide");
  });
});

describe("Packs locais (LS Graphics / Humaaans completo): licença declarada pelo usuário", () => {
  const svgDir = path.join(tmp, "ls-src");
  before(async () => {
    await mkdir(svgDir, { recursive: true });
    await writeFile(path.join(svgDir, "team-meeting.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><rect width="100" height="80" fill="#3b82f6"/></svg>');
    await writeFile(path.join(svgDir, "bad-script.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>x()</script><rect width="5" height="5"/></svg>');
    await writeFile(path.join(svgDir, "broken.svg"), "<svg><g></svg>");
  });
  test("importação exige licença confirmada; SVG malformado é rejeitado; inseguro é sanitizado", async () => {
    await assert.rejects(() => importSvgPack({ dir: svgDir, prefix: "ls-graphics", license: { spdx: "UNKNOWN" }, outDir: path.join(tmp, "p0") }), /Licença não permite/);
    await assert.rejects(() => importSvgPack({ dir: svgDir, prefix: "ls-graphics", license: { grant: "user-licensed" }, outDir: path.join(tmp, "p0") }), /comercial/);
    const r = await importSvgPack({ dir: svgDir, prefix: "ls-graphics", kind: "illustration", license: { grant: "user-licensed", commercialUse: true, attribution: "LS Graphics (licença do usuário)" }, outDir: path.join(tmp, ".motion", "assets") });
    assert.equal(r.count, 2); assert.equal(r.rejected.length, 1);
    const pack = JSON.parse(await readFile(r.file, "utf8"));
    assert.ok(!JSON.stringify(pack).includes("<script"));
  });
  test("pack importado é descoberto automaticamente e escolhido como ilustração", async () => {
    const reg = await createDefaultRegistry({ cwd: tmp, env: { ...process.env, MOTION_ICON_PACKS: "", MOTION_ASSET_PACKS: "" }, fetchImpl: neverFetch });
    assert.ok(reg.get("ls-graphics"));
    const s = await createAssetSession({ registry: reg });
    const a = await s.asset("ilustração de team meeting");
    assert.equal(a.provider, "ls-graphics"); assert.equal(a.kind, "illustration");
    assert.equal(a.provenance.licenseDetail.grant ?? a.license.grant, "user-licensed");
  });
});

describe("Lottie / dotLottie", () => {
  const goodPath = path.join(root, "packages/motion-core/assets/lottie/check-pop.json");
  test("validação: aceita Lottie bem formado; bloqueia expressões JS e assets externos", async () => {
    const good = JSON.parse(await readFile(goodPath, "utf8"));
    assert.equal(validateLottie(good).ok, true);
    const expr = structuredClone(good); expr.layers[0].ks.p = { a: 0, k: [0, 0], x: "wiggle(5,10)" };
    assert.match(validateLottie(expr).findings[0].message, /Expressão JavaScript bloqueada/);
    const ext = structuredClone(good); ext.assets = [{ id: "i", u: "https://evil.example/", p: "a.png", w: 1, h: 1 }];
    assert.equal(validateLottie(ext).ok, false);
    assert.equal(validateLottie({ fr: 30 }).ok, false); assert.equal(validateLottie(null).ok, false);
    assert.equal(validateLottie({ ...good, op: good.ip }).ok, false);
  });
  test("dotLottie (.lottie ZIP): lê a animação; ZIP inválido/traversal é rejeitado", async () => {
    const dir = path.join(tmp, "dot"); await mkdir(dir, { recursive: true });
    const py = `import zipfile,sys,json\nz=zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED)\nz.writestr('manifest.json',json.dumps({'version':'1','animations':[{'id':'check'}]}))\nz.writestr('animations/check.json',open(sys.argv[2]).read())\nz.writestr('../evil.json','{}')\nz.close()`;
    const f = path.join(dir, "check.lottie");
    assert.equal(spawnSync("python3", ["-c", py, f, goodPath]).status, 0);
    const r = readDotLottie(await readFile(f));
    assert.equal(r.animation.nm, "check-pop"); assert.equal(r.entry, "animations/check.json");
    assert.throws(() => readDotLottie(Buffer.from("not a zip at all, definitely")), /ZIP/);
    const loaded = await loadLottieFile(f); assert.equal(loaded.check.ok, true); assert.match(loaded.sha256, /^[0-9a-f]{64}$/);
  });
  test("mapeamento tempo → quadro Lottie é puro (loop, hold, atraso)", () => {
    const m = { ip: 0, op: 30, fr: 30 };
    assert.equal(lottieFrameAt(0.5, m), 15); assert.equal(lottieFrameAt(-1, m), 0);
    assert.ok(lottieFrameAt(5, m) < 30); assert.equal(lottieFrameAt(1.5, m, { loop: true }), 15);
    assert.equal(lottieFrameAt(1, m, { start: 0.5 }), 15);
  });
  test("provider local resolve 'sucesso' → check-pop com licença Apache-2.0 do sidecar", async () => {
    const s = await createAssetSession({ registry });
    const a = await s.asset("animação de sucesso", { kinds: ["lottie"] });
    assert.equal(a.id, "lottie:check-pop"); assert.equal(a.provenance.license, "Apache-2.0"); assert.equal(a.lottie.layers.length, 2);
  });
  async function lottieComposition(name) {
    const dir = path.join(tmp, name); await mkdir(dir, { recursive: true });
    const data = await readFile(goodPath, "utf8");
    await writeFile(path.join(dir, "index.html"), `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#0b0f14}#box{width:200px;height:200px}</style></head><body><div id="box"></div>
<script type="module">
import { createLottieMotion } from "@technomanceer/motion-core/lottie";
const data = ${data};
window.__MOTION_READY__ = createLottieMotion(document.getElementById("box"), data).then((lm) => { window.__onFrame__ = (M) => lm.seek(M); });
</script></body></html>`);
    return path.join(dir, "index.html");
  }
  const render = (html, out, extra) => spawnSync("node", [FRAMES, html, out, "--frames=30", "--width=200", "--height=200", ...extra], { encoding: "utf8" });
  test("renderização determinística de Lottie: mesmo quadro = mesmo PNG em sessões e ordens diferentes; quadros diferem", async (t) => {
    if (!browserOk) return t.skip("NOT_TESTED: Chromium indisponível");
    const html = await lottieComposition("lottie-det");
    const a = path.join(tmp, "lottie-det", "a"), b = path.join(tmp, "lottie-det", "b");
    const r1 = render(html, a, ["--sample-frames=0,12,29"]); assert.equal(r1.status, 0, r1.stderr + r1.stdout);
    assert.equal(JSON.parse(r1.stdout).status, "OK");
    assert.equal(render(html, b, ["--sample-frames=29,0,12"]).status, 0);
    for (const f of ["0000", "0012", "0029"]) assert.equal(sha(await readFile(path.join(a, `${f}.png`))), sha(await readFile(path.join(b, `${f}.png`))), `quadro ${f}`);
    assert.notEqual(sha(await readFile(path.join(a, "0000.png"))), sha(await readFile(path.join(a, "0029.png"))));
  });
});

describe("Ícones animados determinísticos (adapter AnimateIcons)", () => {
  test("presets escolhidos por semântica e efeitos puros (wobble assenta em 0; pulse volta a 1)", () => {
    assert.equal(presetFor("bell-ring"), "ring"); assert.equal(presetFor("refresh-cw"), "spin"); assert.equal(presetFor("heart"), "pulse"); assert.equal(presetFor("shield-check"), "draw");
    assert.equal(sm.evaluateEffect("wobble", 1, { amplitude: 14 }).transform, "rotate(0)");
    assert.equal(sm.evaluateEffect("pulse", 1, { amplitude: 0.14 }).transform, "scale(1)");
    assert.notEqual(sm.evaluateEffect("wobble", 0.3, { amplitude: 14 }).transform, "rotate(0)");
    for (const p of Object.values(MOTION_PRESETS)) assert.ok(p.steps.length && p.description);
  });
  test("asset animado traz SVG + preset + proveniência que não finge redistribuir os componentes React", async () => {
    const s = await createAssetSession({ registry });
    const a = await s.asset("sino de notificação animado");
    assert.equal(a.kind, "animated-icon"); assert.equal(a.motion.preset, "ring");
    assert.match(a.provenance.note, /não redistribuídos/); assert.equal(a.provenance.license, "ISC");
  });
  test("render por quadro do ícone animado é determinístico e realmente anima", async (t) => {
    if (!browserOk) return t.skip("NOT_TESTED: Chromium indisponível");
    const s = await createAssetSession({ registry, size: 160, color: "#4F8CFF" });
    const a = await s.asset("sino de notificação animado");
    const dir = path.join(tmp, "anim-icon"); await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#0b0f14;display:grid;place-items:center;width:240px;height:240px}</style></head><body>${a.svg}
<script type="module">
import { createSvgMotion } from "@technomanceer/motion-core/svg-motion";
const steps = ${JSON.stringify(a.motion.steps)};
const m = createSvgMotion(document.querySelector("svg"), steps);
window.__onFrame__ = (M) => m.seek(M);
</script></body></html>`);
    const run = (out, sel) => spawnSync("node", [FRAMES, path.join(dir, "index.html"), out, "--frames=30", "--width=240", "--height=240", `--sample-frames=${sel}`], { encoding: "utf8" });
    const o1 = path.join(dir, "a"), o2 = path.join(dir, "b");
    const r = run(o1, "0,6,12"); assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(run(o2, "12,0,6").status, 0);
    for (const f of ["0000", "0006", "0012"]) assert.equal(sha(await readFile(path.join(o1, `${f}.png`))), sha(await readFile(path.join(o2, `${f}.png`))));
    assert.notEqual(sha(await readFile(path.join(o1, "0000.png"))), sha(await readFile(path.join(o1, "0006.png"))));
  });
});

describe("Integração com Skills e regressões", () => {
  const SKILLS = ["studio-director", "motion-director", "carousel-studio", "story-studio", "feed-studio", "shorts-director", "explainer-motion", "web-director"];
  for (const base of [".agents/skills", "packages/motion-skills/skills"]) {
    test(`${base}: as 8 Skills usam o registry e proíbem pedir bibliotecas ao usuário`, async () => {
      for (const name of SKILLS) {
        const s = await readFile(path.join(root, base, name, "SKILL.md"), "utf8");
        assert.match(s, /motion assets pick/, name); assert.match(s, /credits\(\)/, name); assert.match(s, /Nunca peça a ele bibliotecas/, name);
      }
    });
  }
  test("não existe uma Skill obrigatória por provider", async () => {
    const { readdir } = await import("node:fs/promises");
    const names = await readdir(path.join(root, "packages/motion-skills/skills"));
    for (const bad of ["humaaans", "animateicons", "developer-icons", "lottie", "iconify", "ls-graphics"]) assert.ok(!names.includes(bad), bad);
  });
  test("regressão Missão 20: API de ícones continua funcionando (session.icon, searchIcons)", async () => {
    const s = await createAssetSession({});
    assert.equal((await s.icon("segurança dos dados")).id, "lucide:shield-check");
    assert.equal(s.manifest().assets[0].license, "ISC");
  });
  test("composição com SVG autoral + logo + personagem passa na validação", async () => {
    const s = await createAssetSession({ registry });
    for (const q of ["Docker", "pessoas apresentando"]) assert.equal(validateSvg((await s.asset(q)).svg).status, "PASS");
    assert.equal(validateSvg(buildSvgComponent("flowArrow", {})).status, "PASS");
  });
});
