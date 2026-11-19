#!/usr/bin/env node
/**
 * Builds the offline provider packs shipped with @technomanceer/motion-core:
 *   - developer-icons.pack.json  (from devDependency `developer-icons`, MIT code; icons are TRADEMARKS of their owners)
 *   - humaaans.pack.json         (curated subset; source dir via HUMAAANS_SRC; CC0 per humaaans.com, recorded conservatively as CC-BY-4.0 attribution)
 * Every body goes through the SVG sanitizer + SVGO. Run: node scripts/build-provider-packs.mjs
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { validateSvg, optimizeSvg } from "../packages/motion-core/svg/index.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "packages/motion-core/assets/packs");
const require = createRequire(import.meta.url);
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().replace(/^-|-$/g, "");
const inner = (svg) => svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");

// ---------- developer-icons ----------
{
  const pkgDir = path.dirname(require.resolve("developer-icons/package.json"));
  const pkg = JSON.parse(await readFile(path.join(pkgDir, "package.json"), "utf8"));
  const mod = await import(path.join(pkgDir, "dist/main.js"));
  const icons = {}; const skipped = [];
  for (const [exportName, Component] of Object.entries(mod)) {
    if (typeof Component !== "function" || !/^[A-Z0-9]/.test(exportName)) continue;
    let svg;
    try { svg = renderToStaticMarkup(React.createElement(Component, { size: 48 })); } catch { skipped.push(exportName); continue; }
    if (!svg.startsWith("<svg")) { skipped.push(exportName); continue; }
    const vb = svg.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 48 48";
    const checked = validateSvg(svg.replace(/ class="[^"]*"/, "").replace(/ stroke="[^"]*"/, ""));
    if (!checked.ok || checked.findings.some((f) => f.severity === "unsafe")) { skipped.push(`${exportName}(unsafe)`); continue; }
    const opt = optimizeSvg(checked.svg, { prefix: kebab(exportName) });
    const [, , w, h] = vb.split(/\s+/).map(Number);
    const name = kebab(exportName);
    if (inner(opt.svg).length > 40000) { skipped.push(`${exportName}(>40KB)`); continue; } // keep the package lean
    icons[name] = { body: inner(opt.svg).replace(/<svg[^>]*>/, ""), width: w, height: h, tags: [exportName.toLowerCase(), name.replace(/-/g, " ")], aliases: [exportName.toLowerCase(), name.replace(/-/g, "")], sha: sha(opt.svg) };
  }
  await writeFile(path.join(out, "developer-icons.pack.json"), JSON.stringify({
    prefix: "developer-icons", name: "Developer Icons", version: pkg.version, kind: "logo", homepage: "https://xandemon.github.io/developer-icons/",
    license: { spdx: "MIT", scope: "code", url: "https://github.com/xandemon/developer-icons/blob/main/LICENSE", attribution: "Developer Icons © 2024 Sandesh Katwal (xandemon), MIT",
      assetsNote: "The MIT license covers the library code. The marks themselves are trademarks of their respective owners; MOTION uses them only to NAME the technology (nominative use), never recolored, distorted or implying endorsement.", trademark: true },
    style: { kind: "color", width: 48, height: 48 }, icons,
  }));
  console.log(`developer-icons ${pkg.version}: ${Object.keys(icons).length} logos (${skipped.length} skipped: ${skipped.slice(0, 5).join(", ")})`);
}

// ---------- humaaans (curated subset) ----------
if (process.env.HUMAAANS_SRC) {
  const dir = process.env.HUMAAANS_SRC;
  const icons = {};
  for (const f of (await readdir(dir)).filter((n) => n.endsWith(".svg")).sort()) {
    const raw = await readFile(path.join(dir, f), "utf8");
    const checked = validateSvg(raw);
    if (!checked.ok) { console.warn("skip", f); continue; }
    const name = f.slice(0, -4);
    const opt = optimizeSvg(checked.svg, { prefix: name.replace(/[^a-z0-9]/g, "") });
    const [, , w, h] = opt.viewBox;
    const pose = name.split("-")[0];
    icons[name] = { body: inner(opt.svg).replace(/<svg[^>]*>/, ""), width: w, height: h, pose, tags: ["person", "people", "human", "character", pose, pose === "sitting" ? "seated working laptop desk" : "standing walking presenting", "pessoa", "personagem", "usuario", "equipe"], sha: sha(opt.svg) };
  }
  await writeFile(path.join(out, "humaaans.pack.json"), JSON.stringify({
    prefix: "humaaans", name: "Humaaans", version: "2019-mirror", kind: "character", homepage: "https://www.humaaans.com/",
    license: { spdx: "CC-BY-4.0", scope: "assets", declaredByAuthor: "CC0-1.0 (humaaans.com)", url: "https://creativecommons.org/licenses/by/4.0/",
      attribution: "Humaaans by Pablo Stanley — https://www.humaaans.com", attributionRequired: true,
      assetsNote: "humaaans.com declares CC0; the public mirror used as source declares CC-BY-4.0. MOTION applies the stricter obligation (attribution) so the result is valid under both." },
    style: { kind: "illustration", width: 380, height: 480 }, icons,
  }));
  console.log(`humaaans: ${Object.keys(icons).length} characters`);
}
