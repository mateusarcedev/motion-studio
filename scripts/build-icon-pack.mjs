#!/usr/bin/env node
/**
 * Builds the offline Lucide icon pack shipped with @technomanceer/motion-core.
 * Source: devDependency `lucide-static` (ISC). Output: assets/icons/lucide.pack.json (+ license).
 * Run: node scripts/build-icon-pack.mjs
 */
import { readFile, readdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve("lucide-static/package.json"));
const pkg = JSON.parse(await readFile(path.join(pkgDir, "package.json"), "utf8"));
const tags = JSON.parse(await readFile(path.join(pkgDir, "tags.json"), "utf8"));
const outDir = path.join(root, "packages/motion-core/assets/icons");

const icons = {};
for (const file of (await readdir(path.join(pkgDir, "icons"))).filter((f) => f.endsWith(".svg")).sort()) {
  const name = file.slice(0, -4);
  const svg = await readFile(path.join(pkgDir, "icons", file), "utf8");
  const body = svg.replace(/<!--[\s\S]*?-->/g, "").replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")
    .replace(/\s*\n\s*/g, "").replace(/\s+\/>/g, "/>").trim();
  if (!body) continue;
  icons[name] = { body, tags: tags[name] ?? [] };
}

const pack = {
  prefix: "lucide",
  name: "Lucide",
  version: pkg.version,
  homepage: "https://lucide.dev",
  license: {
    spdx: "ISC",
    url: "https://github.com/lucide-icons/lucide/blob/main/LICENSE",
    attribution: "Copyright (c) 2026 Lucide Icons and Contributors",
    notice: "Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.",
  },
  style: { kind: "stroke", viewBox: "0 0 24 24", width: 24, height: 24, strokeWidth: 2, linecap: "round", linejoin: "round" },
  icons,
};
await writeFile(path.join(outDir, "lucide.pack.json"), JSON.stringify(pack));
await copyFile(path.join(pkgDir, "LICENSE"), path.join(outDir, "LICENSE-lucide.txt"));
console.log(`lucide ${pkg.version}: ${Object.keys(icons).length} icons`);
