/** Mission 20 — SVG infrastructure, icon library, visual asset resolver, SVG motion engine. */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSvg, optimizeSvg, rasterizeSvg, applyTokens, paletteFromTokens, buildComponent, listComponents, contrastRatio } from "../packages/motion-core/svg/index.mjs";
import { loadIconPacks, renderIcon, createPack, createIconifyFetcher } from "../packages/motion-core/icons/index.mjs";
import { searchIcons, createAssetSession, LEXICON } from "../packages/motion-core/visual-assets/index.mjs";
import * as sm from "../packages/motion-core/design-system/svg-motion.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const tmp = path.join(here, "tmp", "visual-assets");
const FRAMES = path.join(root, "packages/motion-core/renderers/render_frames.mjs");
const GOOD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs><rect id="r" width="24" height="24" fill="url(#g)"/></svg>';
const brand = JSON.parse(await readFile(path.join(root, "creative-core/brands/mini-festa-da-rose/tokens.json"), "utf8"));
const sha = (b) => createHash("sha256").update(b).digest("hex");
let packs, browserOk = false;

before(async () => {
  await rm(tmp, { recursive: true, force: true }); await mkdir(tmp, { recursive: true });
  ({ packs } = await loadIconPacks({ cwd: tmp, env: { ...process.env, MOTION_ICON_PACKS: "" } }));
  try { await rasterizeSvg(GOOD, path.join(tmp, "probe.png"), { width: 16 }); browserOk = true; } catch {}
});

describe("SVG — validação, segurança e otimização", () => {
  test("SVG válido → PASS com viewBox preservado", () => {
    const r = validateSvg(GOOD);
    assert.equal(r.status, "PASS");
    assert.deepEqual(r.viewBox, [0, 0, 24, 24]);
  });
  test("SVG malformado → FAIL MOTION_SVG_INVALID", () => {
    const r = validateSvg("<svg><g></svg>");
    assert.equal(r.status, "FAIL");
    assert.equal(r.findings[0].code, "MOTION_SVG_INVALID");
    assert.equal(validateSvg("").status, "FAIL");
    assert.equal(validateSvg("<div/>").status, "FAIL");
  });
  test("SVG não confiável: scripts, eventos, URLs externas e foreignObject são removidos e reportados", () => {
    const evil = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="x()"><script>alert(1)</script><rect width="5" height="5" onclick="y()" style="fill:url(http://evil/a)"/><image href="https://evil/x.png"/><foreignObject><iframe/></foreignObject><animate attributeName="x"/><use href="javascript:alert(1)"/></svg>';
    const r = validateSvg(evil);
    assert.equal(r.status, "WARN");
    for (const bad of ["<script", "onload", "onclick", "evil", "foreignObject", "iframe", "<animate", "javascript:"]) assert.ok(!r.svg.includes(bad), `deveria remover ${bad}`);
    assert.ok(r.findings.filter((f) => f.code === "MOTION_SVG_UNSAFE").length >= 6);
    assert.equal(validateSvg(evil, { strict: true }).status, "FAIL", "strict reprova conteúdo inseguro");
  });
  test("imagem raster embutida (data:) é permitida; data:text/html não", () => {
    const ok = validateSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><image href="data:image/png;base64,AAAA" width="2" height="2"/></svg>');
    assert.ok(ok.svg.includes("data:image/png"));
    const bad = validateSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><image href="data:text/html;base64,AAAA"/></svg>');
    assert.ok(!bad.svg.includes("data:text/html"));
  });
  test("viewBox ausente é derivado de width/height; sem ambos → FAIL", () => {
    const d = validateSvg('<svg xmlns="http://www.w3.org/2000/svg" width="30" height="20"><rect width="30" height="20"/></svg>');
    assert.deepEqual(d.viewBox, [0, 0, 30, 20]);
    assert.equal(validateSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect width="3" height="3"/></svg>').status, "FAIL");
  });
  test("IDs duplicados e referências quebradas viram avisos", () => {
    const r = validateSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect id="a" width="1" height="1"/><rect id="a" width="1" height="1" fill="url(#nope)"/></svg>');
    assert.equal(r.status, "WARN");
    assert.ok(r.findings.some((f) => /duplicados/.test(f.message)) && r.findings.some((f) => /sem destino/.test(f.message)));
  });
  test("otimização preserva viewBox e prefixa IDs/referências (sem colisões ao combinar SVGs)", () => {
    const a = optimizeSvg(GOOD, { prefix: "a" }), b = optimizeSvg(GOOD, { prefix: "b" });
    assert.deepEqual(a.viewBox, [0, 0, 24, 24]);
    assert.match(a.svg, /id="a__g"/); assert.match(a.svg, /url\(#a__g\)/);
    const ids = [...(a.svg + b.svg).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, "IDs únicos entre SVGs");
  });
  test("rasterização gera PNG nas dimensões do viewBox × escala", async (t) => {
    if (!browserOk) return t.skip("NOT_TESTED: Chromium indisponível");
    const r = await rasterizeSvg(GOOD, path.join(tmp, "g.png"), { width: 48, scale: 2 });
    assert.equal(r.width, 96); assert.equal(r.height, 96);
    assert.ok((await readFile(r.png)).subarray(0, 4).toString("hex") === "89504e47");
  });
  test("rasterização recusa SVG malformado", async () => {
    await assert.rejects(() => rasterizeSvg("<svg><g></svg>", path.join(tmp, "x.png")), (e) => e.code === "MOTION_SVG_INVALID");
  });
});

describe("Tokens e componentes SVG", () => {
  test("applyTokens substitui placeholders e falha em token inexistente", () => {
    assert.equal(applyTokens('<rect fill="{{color.rose}}"/>', brand), '<rect fill="#F38FA8"/>');
    assert.throws(() => applyTokens('<rect fill="{{color.nope}}"/>', brand), /Token de design não encontrado/);
  });
  test("paleta derivada de tokens da marca é legível (contraste ≥ 4.5)", () => {
    const p = paletteFromTokens(brand);
    assert.ok(contrastRatio(p.fg, p.bg) >= 4.5);
    assert.equal(p.readable, true);
    assert.equal(paletteFromTokens({ color: { a: "#000000", b: "#ffffff", c: "#ff0000" }, roles: { primary: "c" } }).primary, "#ff0000");
  });
  test("todos os componentes são válidos, determinísticos e variam com a seed", () => {
    for (const name of listComponents()) {
      const a = buildComponent(name, { tokens: brand, seed: 5 }), b = buildComponent(name, { tokens: brand, seed: 5 });
      assert.equal(a, b, `${name} deve ser determinístico`);
      assert.equal(validateSvg(a).status, "PASS", `${name} válido`);
      assert.ok(a.includes("viewBox"));
    }
    assert.notEqual(buildComponent("networkGraph", { tokens: brand, seed: 1 }), buildComponent("networkGraph", { tokens: brand, seed: 2 }));
  });
  test("componentes usam cores dos tokens da marca (nada hard-coded fora da paleta)", () => {
    const svg = buildComponent("ringProgress", { tokens: brand });
    const p = paletteFromTokens(brand);
    for (const c of svg.match(/#[0-9a-f]{6}/gi)) assert.ok(Object.values(p).includes(c.toLowerCase()) || Object.values(p).includes(c), `cor fora da paleta: ${c}`);
  });
  test("namespaces de ID impedem colisão entre instâncias", () => {
    const a = buildComponent("ringProgress", { idPrefix: "one" }), b = buildComponent("ringProgress", { idPrefix: "two" });
    assert.ok(a.includes("one__g") && b.includes("two__g") && !a.includes("two__"));
  });
});

describe("Icon Library Manager", () => {
  test("pacote Lucide offline carregado com licença registrada", () => {
    const lucide = packs.find((p) => p.prefix === "lucide");
    assert.ok(lucide && Object.keys(lucide.icons).length > 1000);
    assert.equal(lucide.license.spdx, "ISC");
    assert.match(lucide.license.attribution, /Lucide/);
  });
  test("renderIcon padroniza tamanho, espessura e cor", () => {
    const svg = renderIcon(packs[0], "zap", { size: 64, strokeWidth: 1.5, color: "#ff0" });
    assert.match(svg, /width="64"/); assert.match(svg, /stroke-width="1.5"/); assert.match(svg, /stroke="#ff0"/);
    assert.equal(validateSvg(svg).status, "PASS");
    assert.throws(() => renderIcon(packs[0], "does-not-exist"), (e) => e.code === "MOTION_ICON_NOT_FOUND");
  });
  test("todo ícone citado no léxico existe no pacote (sem referências obsoletas)", () => {
    const lucide = packs.find((p) => p.prefix === "lucide");
    const missing = LEXICON.flatMap((c) => c.icons.filter((i) => !lucide.icons[i]).map((i) => `${c.id}:${i}`));
    assert.deepEqual(missing, []);
  });
  test("pacotes extras (formato Iconify) são descobertos via MOTION_ICON_PACKS; inválidos são ignorados e reportados", async () => {
    const dir = path.join(tmp, "packs"); await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "mini.json"), JSON.stringify({ prefix: "mini", width: 16, height: 16, info: { license: { spdx: "MIT" } }, icons: { hello: { body: '<circle cx="8" cy="8" r="6"/>' } } }));
    await writeFile(path.join(dir, "broken.json"), "{not json");
    const r = await loadIconPacks({ cwd: tmp, env: { ...process.env, MOTION_ICON_PACKS: dir } });
    assert.ok(r.packs.some((p) => p.prefix === "mini" && p.license.spdx === "MIT"));
    assert.equal(r.skipped.length, 1);
  });
  test("Iconify remoto: cache em disco e corpo malicioso é rejeitado", async () => {
    let calls = 0;
    const good = { ok: true, json: async () => ({ width: 24, height: 24, icons: { ok: { body: '<path d="M0 0h24"/>' } }, info: { license: "MIT" } }) };
    const evil = { ok: true, json: async () => ({ icons: { bad: { body: '<script>alert(1)</script><path d="M0 0"/>' } } }) };
    const fetchIcon = createIconifyFetcher({ cacheDir: path.join(tmp, "cache"), fetchImpl: async (u) => { calls++; return u.includes("icons=bad") ? evil : good; } });
    const a = await fetchIcon("tabler", "ok"); const b = await fetchIcon("tabler", "ok");
    assert.equal(calls, 1, "segunda leitura vem do cache"); assert.deepEqual(a, b);
    const bad = await fetchIcon("tabler", "bad");
    assert.ok(!bad.body.includes("script"), "corpo sanitizado");
    await assert.rejects(() => fetchIcon("../etc", "passwd"), (e) => e.code === "MOTION_INVALID_ARGUMENT");
  });
});

describe("Visual Asset Resolver", () => {
  const cases = [
    ["segurança dos dados", ["shield-check", "lock", "shield"]],
    ["velocidade", ["zap", "gauge", "timer"]],
    ["inteligência artificial", ["brain-circuit", "bot", "sparkles", "cpu"]],
    ["trabalho em equipe", ["users", "users-round", "handshake"]],
    ["crescimento das vendas", ["trending-up", "chart-no-axes-column-increasing", "chart-line"]],
    ["aprendizado contínuo", ["graduation-cap", "book-open"]],
    ["internet", ["globe", "wifi", "network"]],
    ["cloud storage", ["cloud", "cloud-upload"]],
  ];
  for (const [intent, accepted] of cases) {
    test(`"${intent}" → ícone semanticamente correto`, async () => {
      const r = await searchIcons(intent, { packs, limit: 3 });
      assert.ok(accepted.some((n) => r.candidates.slice(0, 2).some((c) => c.name === n)), `${intent}: ${r.candidates.map((c) => c.name)}`);
      assert.notEqual(r.confidence, "none");
    });
  }
  test("não depende só de correspondência literal: termo sem nome de ícone resolve por conceito", async () => {
    const r = await searchIcons("privacidade", { packs });
    assert.ok(["lock", "shield-check", "shield", "key-round", "fingerprint"].includes(r.candidates[0].name));
  });
  test("intenção sem correspondência usa fallback geométrico marcado e gera WARN", async () => {
    const s = await createAssetSession({ packs });
    const a = await s.icon("xyzzy qwerty plugh");
    assert.equal(a.fallback, true); assert.equal(a.provenance.pack, "MOTION generated");
    assert.equal(validateSvg(a.svg).status, "PASS");
    assert.equal(s.report().status, "WARN"); assert.deepEqual(s.report().fallbacks, ["xyzzy qwerty plugh"]);
  });
  test("sessão trava um estilo (mesmo pacote/espessura/tamanho/cor) em todos os ícones", async () => {
    const s = await createAssetSession({ packs, size: 40, strokeWidth: 1.75, color: "#0af" });
    const assets = await s.assign(["velocidade", "segurança", "equipe", "dinheiro"]);
    for (const a of assets) { assert.match(a.svg, /width="40"/); assert.match(a.svg, /stroke-width="1.75"/); assert.match(a.svg, /stroke="#0af"/); }
    assert.equal(s.report().status, "PASS");
  });
  test("conceitos diferentes não recebem o mesmo ícone; mesma intenção repete o mesmo ícone", async () => {
    const s = await createAssetSession({ packs });
    const a = await s.icon("segurança"), b = await s.icon("privacidade"), c = await s.icon("segurança");
    assert.notEqual(a.id, b.id); assert.equal(a.id, c.id);
  });
  test("proveniência e licença registradas para cada asset", async () => {
    const s = await createAssetSession({ packs });
    await s.assign(["velocidade", "tempo"]);
    const m = s.manifest();
    assert.equal(m.assets.length, 2);
    for (const a of m.assets) { assert.equal(a.license, "ISC"); assert.ok(a.pack && a.id); }
  });
  test("gancho `rerank` permite plugar mecanismo semântico sem mudar chamadores", async () => {
    const r = await searchIcons("velocidade", { packs, rerank: async (_q, c) => [...c].reverse() });
    assert.notEqual(r.candidates[0].name, "zap");
  });
});

describe("SVG Motion Engine — determinismo", () => {
  test("easings e janelas de progresso são puros e limitados", () => {
    assert.equal(sm.progressAt(-1, { start: 0, duration: 1, easing: "linear" }), 0);
    assert.equal(sm.progressAt(5, { start: 0, duration: 1, easing: "outCubic" }), 1);
    assert.equal(sm.progressAt(0.5, { start: 0, duration: 1, easing: "linear" }), 0.5);
    assert.equal(sm.progressAt(0.5, { start: 0, duration: 1, easing: "linear" }, 0.25), 0.25);
    assert.throws(() => sm.resolveEasing("bounceyMcBounce"), /easing desconhecido/);
    for (const e of Object.values(sm.easings)) { assert.ok(Math.abs(e(0)) < 1e-9); assert.ok(Math.abs(e(1) - 1) < 1e-9); }
  });
  test("morph interpola caminhos com a mesma estrutura e recusa estruturas diferentes", () => {
    assert.equal(sm.interpolatePath("M0 0L10 10", "M10 10L20 30", 0.5), "M5 5L15 20");
    assert.equal(sm.canMorph("M0 0L1 1", "M0 0C1 1 2 2 3 3"), false);
    assert.throws(() => sm.interpolatePath("M0 0L1 1", "M0 0Z", 0.5), /mesma estrutura/);
  });
  test("draw / reveal / orbit / color avaliados como funções puras", () => {
    assert.deepEqual(sm.evaluateEffect("draw", 0.25, {}, { length: 200 }).attrs, { "stroke-dasharray": "200 200", "stroke-dashoffset": 150 });
    assert.equal(sm.evaluateEffect("reveal", 0.5, { direction: "left" }).style["clip-path"], "inset(0 50% 0 0)");
    assert.equal(sm.lerpColor("#000000", "#ffffff", 0.5), "#808080");
    const o = sm.evaluateEffect("orbit", 0, {}, { orbit: 10, phase: 0, cx: 100, cy: 100 }).attrs;
    assert.deepEqual(o, { cx: 110, cy: 100 });
  });

  async function composition(name) {
    const dir = path.join(tmp, name); await mkdir(dir, { recursive: true });
    const svg = buildComponent("networkGraph", { tokens: brand, seed: 3, width: 400, height: 240, nodes: 8 });
    await writeFile(path.join(dir, "index.html"), `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#173C5B}svg{display:block}</style></head><body>${svg}
<script type="module">
import { createSvgMotion } from "@technomanceer/motion-core/svg-motion";
const m = createSvgMotion(document.querySelector("svg"), [
  { target: "[data-motion-path]", effect: "draw", start: 0, duration: 0.6, stagger: 0.03, easing: "outCubic" },
  { target: '[data-layer="node"]', effect: "pop", start: 0.2, duration: 0.4, stagger: 0.04 },
]);
window.__onFrame__ = (M) => m.seek(M);
</script></body></html>`);
    return path.join(dir, "index.html");
  }
  const render = (html, out, extra) => spawnSync("node", [FRAMES, html, out, "--frames=30", "--width=400", "--height=240", ...extra], { encoding: "utf8" });

  test("composição real importa o motor via import map e renderiza sem erros (caso M-012)", async (t) => {
    if (!browserOk) return t.skip("NOT_TESTED: Chromium indisponível");
    const html = await composition("motion-ok");
    const r = render(html, path.join(tmp, "motion-ok", "a"), ["--sample-frames=0,15,29"]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).status, "OK");
  });
  test("mesmo frame, mesma seed → PNG idêntico em duas sessões; ordem de seek não importa; frames diferem", async (t) => {
    if (!browserOk) return t.skip("NOT_TESTED: Chromium indisponível");
    const html = await composition("motion-det");
    const a = path.join(tmp, "motion-det", "a"), b = path.join(tmp, "motion-det", "b");
    assert.equal(render(html, a, ["--sample-frames=0,10,20"]).status, 0);
    assert.equal(render(html, b, ["--sample-frames=20,0,10"]).status, 0); // ordem invertida
    for (const f of ["0000", "0010", "0020"]) assert.equal(sha(await readFile(path.join(a, `${f}.png`))), sha(await readFile(path.join(b, `${f}.png`))), `frame ${f} idêntico`);
    assert.notEqual(sha(await readFile(path.join(a, "0000.png"))), sha(await readFile(path.join(a, "0020.png"))), "a animação realmente muda entre frames");
  });
});
