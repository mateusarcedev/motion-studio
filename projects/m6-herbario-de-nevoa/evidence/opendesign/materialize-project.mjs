import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const project = path.resolve(process.argv[2] ?? "");
if (!process.argv[2] || !path.isAbsolute(project)) {
  throw new Error("Pass the absolute root of the newly authorized OpenDesign Integration Lab project.");
}
if (path.basename(project) !== "04691291-53a3-44d0-b4ce-5d1cb1bb091e") {
  throw new Error("Refusing to write outside the newly authorized Motion Studio — Integration Lab project.");
}
const out = path.join(project, "design-output", "production");
const campaign = path.join(repo, "projects/m6-herbario-de-nevoa");
await mkdir(out, { recursive: true });

const copy = async (source, relative) => {
  const destination = path.join(out, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
};
const save = async (relative, content) => {
  const destination = path.join(out, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content);
};

const tokens = JSON.parse(await readFile(path.join(campaign, "brand/tokens.json"), "utf8"));
await save("design-system/tokens.json", `${JSON.stringify(tokens, null, 2)}\n`);
const tokenCss = `:root{\n  --paper:${tokens.colors.paper};\n  --paper-light:${tokens.colors.paperLight};\n  --ink:${tokens.colors.ink};\n  --moss:${tokens.colors.moss};\n  --clay:${tokens.colors.clay};\n  --berry:${tokens.colors.berry};\n  --line:${tokens.colors.line};\n  --font-display:${tokens.typography.display};\n  --font-interface:${tokens.typography.interface};\n  --font-mono:${tokens.typography.mono};\n  --space-unit:${tokens.spacing.unit}px;\n  --space-page:${tokens.spacing.page}px;\n  --space-card:${tokens.spacing.card}px;\n  --space-gutter:${tokens.spacing.gutter}px;\n}\n`;
await save("design-system/tokens.css", tokenCss);
await save("dashboard/tokens.css", tokenCss);
await save("mobile/tokens.css", tokenCss);
await save("components/tokens.css", tokenCss);
await save("carousel/tokens.css", tokenCss);

const dashboard = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Herbário de Névoa · Caderno de campo</title><link rel="stylesheet" href="tokens.css"><style>
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--font-interface)}a{color:inherit}.shell{max-width:1440px;margin:auto;padding:28px clamp(20px,5vw,72px)}header,nav,.row,.cards,.stat{display:flex;gap:20px;align-items:center}header{justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:20px}h1,h2{font-family:var(--font-display);font-weight:400}h1{font-size:clamp(42px,6vw,76px);line-height:1.04;margin:45px 0 12px}.lead{max-width:52ch;font-size:18px;line-height:1.6;color:#415148}.topline,.label,.metric{font:12px var(--font-mono);letter-spacing:.05em;text-transform:uppercase}.workspace{display:grid;grid-template-columns:1.4fr .8fr;gap:24px;margin-top:36px}.card{background:var(--paper-light);border:1px solid var(--line);padding:26px}.specimens{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px}.specimen{min-height:170px;background:#d7d8cb;padding:18px;display:flex;flex-direction:column;justify-content:space-between}.specimen:nth-child(2){background:#d9c9c2}.specimen:nth-child(3){background:#cfd4c5}.mark{font:italic 28px var(--font-display)}.stats{display:grid;gap:12px}.stat{justify-content:space-between;padding:18px 0;border-bottom:1px solid var(--line)}.number{font:32px var(--font-display)}.note{margin-top:26px;padding:18px;border-left:3px solid var(--clay);line-height:1.5}@media(max-width:800px){.workspace{grid-template-columns:1fr}.specimens{grid-template-columns:1fr 1fr}nav{display:none}}
</style></head><body><main class="shell"><header><a href="../index.html" class="topline">Herbário / caderno</a><nav><span>Arquivo</span><span>Espécies</span><span>Notas</span></nav><span class="topline">Edição 01 · fictícia</span></header><section><h1>O que floresce<br>entre as páginas.</h1><p class="lead">Um painel de catalogação para espécimes imaginários. A interface mantém a cadência do caderno de campo: tinta, papel, notas à margem e dados que não fingem ser ciência real.</p></section><div class="workspace"><section class="card"><span class="label">Coleção em andamento</span><div class="specimens"><article class="specimen"><span class="label">A / 01</span><span class="mark">Lunária cinza</span><span>desenho · página escura</span></article><article class="specimen"><span class="label">B / 02</span><span class="mark">Brumária</span><span>nota de margem</span></article><article class="specimen"><span class="label">C / 03</span><span class="mark">Folha de órbita</span><span>estudo de forma</span></article></div></section><aside class="card"><span class="label">Notas de campo</span><div class="stats"><div class="stat"><span>Pranchas</span><span class="number">06</span></div><div class="stat"><span>Espécies fictícias</span><span class="number">03</span></div><div class="stat"><span>Última revisão</span><span class="number">26 nov.</span></div></div><p class="note">Nenhuma espécie, localidade ou medida representa um registro botânico real.</p></aside></div></main></body></html>`;
await save("dashboard/index.html", dashboard);

const mobile = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Herbário de Névoa · Móvel</title><link rel="stylesheet" href="tokens.css"><style>
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--font-interface)}main{max-width:430px;min-height:100vh;margin:auto;padding:22px 20px 30px}.bar{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:15px}.mono{font:11px var(--font-mono);letter-spacing:.08em;text-transform:uppercase}h1,h2{font-family:var(--font-display);font-weight:400}h1{font-size:48px;line-height:1.02;margin:35px 0 10px}p{line-height:1.55}.intro{font-size:15px;color:#43544a}.specimen{margin:24px 0;padding:18px;background:var(--paper-light);border:1px solid var(--line)}svg{width:100%;height:auto;display:block}.caption{display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--line);padding-top:12px;margin-top:12px}.caption strong{font:italic 24px var(--font-display);font-weight:400}.note{padding:14px 16px;border-left:3px solid var(--clay);background:#e5dfd1;font-size:14px}button{font:inherit;color:var(--paper-light);background:var(--ink);border:0;border-radius:2px;padding:14px 18px;width:100%}@media(prefers-reduced-motion:no-preference){button{transition:background .2s ease,transform .2s ease}button:hover{background:var(--moss);transform:translateY(-2px)}}
</style></head><body><main><header class="bar"><span class="mono">Herbário / índice</span><span class="mono">01—06</span></header><section><h1>Um atlas para o que ainda não existe.</h1><p class="intro">Percorra espécies imaginárias, desenhadas como notas de um caderno depois da chuva.</p></section><article class="specimen"><svg viewBox="0 0 300 250" role="img" aria-label="Ilustração vetorial de uma flor fictícia"><g fill="none" stroke="#56694f" stroke-width="2"><path d="M150 230V116m0 82c-30-27-53-30-77-16 15 28 42 39 77 26m0-23c26-34 51-39 75-24-15 30-42 43-75 34"/><g fill="#754652"><ellipse cx="150" cy="84" rx="16" ry="41"/><ellipse cx="150" cy="84" rx="16" ry="41" transform="rotate(60 150 125)"/><ellipse cx="150" cy="84" rx="16" ry="41" transform="rotate(120 150 125)"/></g><circle cx="150" cy="125" r="9" fill="#d2b17b"/></g></svg><div class="caption"><strong>Lunária cinza</strong><span class="mono">Espécime A</span></div></article><p class="note">Desenho e nomenclatura fictícios. Nenhuma relação com uma planta real.</p><p><button type="button">Abrir o caderno de campo</button></p></main></body></html>`;
await save("mobile/index.html", mobile);

const component = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Componente · Cartão de espécime</title><link rel="stylesheet" href="tokens.css"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#d9d7ca;color:#26352e;font-family:var(--font-interface)}.card{width:min(100%,360px);background:var(--paper-light);border:1px solid var(--line);padding:22px}.meta{display:flex;justify-content:space-between;font:11px var(--font-mono);letter-spacing:.05em;text-transform:uppercase}.illustration{width:100%;margin:22px 0 12px}.title{font:italic 30px var(--font-display);margin:8px 0}.copy{font-size:14px;line-height:1.55;color:#43544a}</style></head><body><article class="card" aria-label="Cartão de espécime reutilizável"><div class="meta"><span>Arquivo / A</span><span>01</span></div><svg class="illustration" viewBox="0 0 300 180" aria-hidden="true"><g fill="none" stroke="#56694f" stroke-width="2"><path d="M150 176V87m0 61c-23-23-41-25-61-13 13 22 34 31 61 21m0-19c20-29 41-33 61-21-13 25-36 35-61 29"/><g fill="#754652"><ellipse cx="150" cy="65" rx="13" ry="34"/><ellipse cx="150" cy="65" rx="13" ry="34" transform="rotate(60 150 90)"/><ellipse cx="150" cy="65" rx="13" ry="34" transform="rotate(120 150 90)"/></g><circle cx="150" cy="90" r="8" fill="#d2b17b"/></g></svg><h2 class="title">Lunária cinza</h2><p class="copy">Desenho original. Nomenclatura inventada para o caderno de campo.</p></article></body></html>`;
await save("components/specimen-card.html", component);
await save("assets/specimen-flower.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" role="img" aria-labelledby="t d"><title id="t">Lunária cinza</title><desc id="d">Ilustração vetorial original de uma flor fictícia</desc><g fill="none" stroke="#56694f" stroke-width="2"><path d="M150 280V150m0 100c-32-30-55-34-82-18 15 31 45 43 82 29m0-26c28-39 56-44 82-28-16 35-46 49-82 38"/><g fill="#754652"><ellipse cx="150" cy="100" rx="20" ry="52"/><ellipse cx="150" cy="100" rx="20" ry="52" transform="rotate(60 150 150)"/><ellipse cx="150" cy="100" rx="20" ry="52" transform="rotate(120 150 150)"/></g><circle cx="150" cy="150" r="12" fill="#d2b17b"/></g></svg>`);

await copy(path.join(campaign, "web/index.html"), "website/index.html");
for (const name of ["01-capa", "02-indice", "03-lunaria", "04-intervalo", "05-paisagem", "06-colofao"]) {
  await copy(path.join(campaign, `carousel/${name}.html`), `carousel/${name}.html`);
}
const carouselLinks = ["01-capa", "02-indice", "03-lunaria", "04-intervalo", "05-paisagem", "06-colofao"]
  .map((name) => `<li><a href="${name}.html">${name.replaceAll("-", " · ")}</a></li>`).join("");
await save("carousel/index.html", `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Carrossel · Herbário de Névoa</title><link rel="stylesheet" href="tokens.css"><style>body{margin:0;padding:32px;background:var(--paper);color:var(--ink);font:16px var(--font-interface)}main{max-width:900px;margin:auto}h1{font:normal 48px var(--font-display)}ol{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;list-style:none;padding:0}a{display:block;color:inherit;background:var(--paper-light);border:1px solid var(--line);padding:20px;text-decoration:none}small{font:12px var(--font-mono)}</style></head><body><main><small>CARROSSEL / 6 PRANCHAS</small><h1>Folhear o impossível</h1><ol>${carouselLinks}</ol></main></body></html>`);
await copy(path.join(campaign, "story/story.html"), "story/index.html");
await copy(path.join(campaign, "video/promo.html"), "video/promo.html");
await copy(path.join(campaign, "STORYBOARD.md"), "storyboard/STORYBOARD.md");
await copy(path.join(repo, "projects/m6-herbario-de-nevoa/evidence/doop-lab/motion-to-design/storyboard.html"), "storyboard/index.html");
await copy(path.join(repo, "projects/m6-herbario-de-nevoa/evidence/doop-lab/motion-to-design/svg-elements.html"), "svg-elements/index.html");
for (const [source, destination] of [
  ["out/m6-final/video/herbario-de-nevoa.mp4", "video/herbario-de-nevoa.mp4"],
  ["out/m6-final/story/herbario-de-nevoa-story.mp4", "story/herbario-de-nevoa-story.mp4"],
  ["out/m6-final/video/frames/0000.png", "animation-frames/promo-0000.png"],
  ["out/m6-final/video/frames/0060.png", "animation-frames/promo-0060.png"],
  ["out/m6-final/video/frames/0120.png", "animation-frames/promo-0120.png"],
  ["out/m6-final/video/frames/0180.png", "animation-frames/promo-0180.png"],
  ["out/m6-final/video/frames/0239.png", "animation-frames/promo-0239.png"],
]) await copy(path.join(campaign, source), destination);
for (const name of ["01-capa", "02-indice", "03-lunaria", "04-intervalo", "05-paisagem", "06-colofao"]) {
  await copy(path.join(campaign, `out/m6-final/carousel/${name}-1080x1350.png`), `carousel/exports/${name}-1080x1350.png`);
}

await save("index.html", `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Herbário de Névoa · Integration Lab</title><link rel="stylesheet" href="design-system/tokens.css"><style>body{margin:0;background:var(--paper);color:var(--ink);font:16px var(--font-interface)}main{max-width:1000px;margin:auto;padding:48px 24px}h1{font:normal clamp(40px,7vw,72px)/1.05 var(--font-display)}ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;padding:0;list-style:none}a{display:block;padding:20px;background:var(--paper-light);border:1px solid var(--line);color:inherit;text-decoration:none}a:hover{outline:2px solid var(--moss)}small{font:12px var(--font-mono)}</style></head><body><main><small>PROJECT INDEX / 2026-11-26</small><h1>Herbário de Névoa</h1><p>Projeto local do Motion Studio × OpenDesign. Todas as plantas e nomenclaturas são fictícias; paleta, tipografia e espaçamento reutilizam os tokens da campanha M6.</p><ul><li><a href="website/index.html">Landing responsiva</a></li><li><a href="dashboard/index.html">Dashboard editorial</a></li><li><a href="mobile/index.html">Interface mobile</a></li><li><a href="carousel/index.html">Carrossel editorial · 6 páginas</a></li><li><a href="story/index.html">Story vertical</a></li><li><a href="storyboard/index.html">Storyboard</a></li><li><a href="video/promo.html">Vídeo / composição</a></li><li><a href="components/specimen-card.html">Componente HTML</a></li><li><a href="svg-elements/index.html">Elementos SVG</a></li></ul><p><small>Identidade herdada de campaign-source/STYLE.md; sem upload de assets ou publicação externa.</small></p></main></body></html>`);
await save("README.md", `# Herbário de Névoa — OpenDesign Integration Lab\n\nEste conjunto foi materializado no projeto local recém-criado **Motion Studio — Integration Lab**, usando a campanha fictícia Herbário de Névoa produzida na M6. Ele preserva o sistema existente; não cria outra identidade.\n\n- HTML/CSS, tokens JSON/CSS e SVG permanecem editáveis como arquivos.\n- Landing, seis slides, story, storyboard, MP4s e quadros vieram dos artefatos M6 existentes.\n- Dashboard, variante mobile e cartão de espécime são extensões locais da mesma paleta e tipografia.\n- Cartão HTML não equivale a componente nativo reutilizável do editor.\n- Os arquivos ainda não foram importados como telas nativas do canvas OpenDesign: a sessão do app/MCP não foi alcançável deste runtime WSL.\n- Nenhum arquivo foi enviado a serviços externos.\n`);

async function inventory(dir, prefix = "") {
  const rows = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, item.name);
    const rel = path.posix.join(prefix, item.name);
    if (item.isDirectory()) rows.push(...await inventory(absolute, rel));
    else if (rel !== "manifest.json") {
      const bytes = await readFile(absolute);
      rows.push({ path: rel, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
    }
  }
  return rows;
}
const files = (await inventory(out)).sort((a, b) => a.path.localeCompare(b.path));
const manifest = {
  schemaVersion: "1.0.0",
  project: "Motion Studio — Integration Lab",
  campaign: "Herbário de Névoa",
  createdAt: "2026-11-26",
  source: "Motion Studio M6 campaign outputs; all external network uploads disabled",
  files,
};
await writeFile(path.join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ output: path.relative(project, out).split(path.sep).join("/"), files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0), manifestSha256: createHash("sha256").update(await readFile(path.join(out, "manifest.json"))).digest("hex") }));
