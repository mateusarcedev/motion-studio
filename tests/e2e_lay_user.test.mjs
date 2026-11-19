/**
 * Mission 20 — end-to-end "usuário leigo": a plain request becomes a carousel with icons and vector art
 * chosen automatically, rendered through the real CLI, then checked by the automated QA.
 * No library, SVG or command is chosen by the "user" in this test.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAssetSession, buildSvgComponent, paletteFromTokens, qaFrames, validateSvg } from "../packages/motion-core/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const out = path.join(here, "tmp", "e2e-lay-user");
const CLI = path.join(root, "packages/motion-cli/bin/motion.mjs");
const brand = JSON.parse(await readFile(path.join(root, "creative-core/brands/mini-festa-da-rose/tokens.json"), "utf8"));

// "Crie um carrossel explicando cinco benefícios da inteligência artificial. Moderno, profissional, fácil de entender."
const BENEFITS = [
  ["Mais velocidade", "Tarefas repetitivas em segundos, não em horas."],
  ["Decisões com dados", "Padrões que ninguém via ficam claros."],
  ["Atendimento 24 horas", "Respostas imediatas, a qualquer momento."],
  ["Menos erros", "Verificação automática antes de entregar."],
  ["Mais criatividade", "Ideias novas a partir de poucas palavras."],
];

test("pedido em linguagem natural → carrossel com ícones e vetores escolhidos automaticamente → render → QA", async (t) => {
  await rm(out, { recursive: true, force: true }); await mkdir(path.join(out, "slides"), { recursive: true });
  const p = paletteFromTokens(brand);
  const session = await createAssetSession({ size: 120, strokeWidth: 1.75, color: p.primary });
  const icons = await session.assign(["velocidade", "dados e análise", "atendimento e suporte", "segurança e verificação", "ideias e criatividade"]);
  assert.equal(new Set(icons.map((i) => i.id)).size, 5, "cinco ícones distintos, do mesmo estilo");
  assert.equal(session.report().status, "PASS");

  for (const [i, [title, body]] of BENEFITS.entries()) {
    const art = buildSvgComponent(["waveLayers", "networkGraph", "orbitRings", "waveLayers", "networkGraph"][i], { tokens: brand, seed: 10 + i, width: 1080, height: 1350, size: 1080, nodes: 16, avoid: [[60, 380, 960, 640], [60, 60, 320, 120]], idPrefix: `s${i}` });
    assert.equal(validateSvg(art).status, "PASS");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box;margin:0;padding:0} body{width:1080px;height:1350px;background:${p.bg};color:${p.fg};font-family:system-ui,sans-serif;position:relative;overflow:hidden}
      .art{position:absolute;inset:0;opacity:.55}.art svg{width:100%;height:100%;display:block}
      .card{position:absolute;left:90px;right:90px;top:420px}.ic{margin-bottom:48px}h1{font-size:92px;line-height:1.05;margin-bottom:36px}p{font-size:44px;line-height:1.35;color:${p.fg}}
      .n{position:absolute;left:90px;top:90px;font-size:36px;color:${p.accent}}</style></head><body>
      <div class="art" data-bleed>${art.replace(/ width="\d+" height="\d+"/, ' preserveAspectRatio="xMidYMid slice"')}</div><div class="n">${i + 1} / 5</div>
      <div class="card"><div class="ic">${icons[i].svg}</div><h1>${title}</h1><p>${body}</p></div></body></html>`;
    await writeFile(path.join(out, "slides", `0${i + 1}.html`), html);
  }

  const r = spawnSync("node", [CLI, "render", "carousel", path.join(out, "slides"), path.join(out, "out")], { cwd: root, encoding: "utf8" });
  if (r.status !== 0 && /BROWSER|Chromium/i.test(r.stderr + r.stdout)) return t.skip("NOT_TESTED: Chromium indisponível");
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const pngs = (await readdir(path.join(out, "out"))).filter((f) => f.endsWith("-1080x1350.png"));
  assert.equal(pngs.length, 5);

  const view = path.join(out, "view"); await mkdir(view, { recursive: true });
  for (const f of pngs) await copyFile(path.join(out, "out", f), path.join(view, f));
  const qa = await qaFrames(view, { expectedFrames: 5 });
  const byId = Object.fromEntries(qa.checks.map((c) => [c.id, c]));
  assert.equal(byId["frames.count"].status, "PASS");
  assert.equal(byId.blank.status, "PASS", "nenhum slide vazio");
  assert.equal(byId.repetition.status, "PASS", "slides variados entre si");
  // proveniência pronta para o assets.manifest.json
  const manifest = session.manifest();
  assert.equal(manifest.assets.length, 5);
  await writeFile(path.join(out, "assets.provenance.json"), JSON.stringify(manifest, null, 2));
});
