/**
 * `motion assets|icons|svg` — developer/agent-facing helpers.
 * Normal users never need these: Skills call the same APIs when they build a piece.
 */
import { readFile, writeFile } from "node:fs/promises";
let core;
async function api() { return (core ??= await import("@technomanceer/motion-core").catch(() => import("../../motion-core/index.js"))); }

const out = (value) => console.log(JSON.stringify(value, null, 2));

export async function runAssets(sub, args, flags) {
  const c = await api();
  switch (sub) {
    case "resolve": {
      const intent = args.join(" ");
      if (!intent) throw new TypeError('Uso: motion assets resolve "<intenção visual>" [--size=48] [--stroke=2] [--color=#fff] [--svg]');
      const session = await c.createAssetSession({ size: Number(flags.size ?? 48), strokeWidth: flags.stroke ? Number(flags.stroke) : undefined, color: typeof flags.color === "string" ? flags.color : "currentColor" });
      const asset = await session.icon(intent);
      if (flags.svg) { console.log(asset.svg); return; }
      out({ intent, id: asset.id, confidence: asset.confidence, score: asset.score, fallback: asset.fallback, reasons: asset.reasons, alternatives: asset.alternatives, provenance: asset.provenance });
      return;
    }
    case "search": {
      const intent = args.join(" ");
      if (!intent) throw new TypeError('Uso: motion assets search "<consulta>" [--limit=8]');
      const { packs } = await c.loadIconPacks();
      out(await c.searchIcons(intent, { packs, limit: Number(flags.limit ?? 8) }));
      return;
    }
    case "packs": {
      const { packs, skipped } = await c.loadIconPacks();
      out({ packs: packs.map((p) => ({ prefix: p.prefix, name: p.name, version: p.version, icons: Object.keys(p.icons).length, license: p.license.spdx, style: p.style.kind })), skipped });
      return;
    }
    default:
      throw new TypeError("Uso: motion assets <resolve|search|packs>");
  }
}

export async function runSvg(sub, args, flags) {
  const c = await api();
  const [file, output] = args;
  switch (sub) {
    case "validate": {
      if (!file) throw new TypeError("Uso: motion svg validate <arquivo.svg> [--strict]");
      const r = c.validateSvg(await readFile(file, "utf8"), { strict: flags.strict === true });
      out({ status: r.status, viewBox: r.viewBox, findings: r.findings });
      if (!r.ok) process.exitCode = 4;
      return;
    }
    case "optimize": {
      if (!file || !output) throw new TypeError("Uso: motion svg optimize <entrada.svg> <saida.svg> [--prefix=ns]");
      const r = c.optimizeSvg(await readFile(file, "utf8"), { prefix: typeof flags.prefix === "string" ? flags.prefix : undefined });
      await writeFile(output, r.svg);
      out({ output, bytesBefore: r.bytesBefore, bytesAfter: r.bytesAfter, viewBox: r.viewBox });
      return;
    }
    case "rasterize": {
      if (!file || !output) throw new TypeError("Uso: motion svg rasterize <entrada.svg> <saida.png> [--width=W] [--scale=N] [--background=#fff]");
      out(await c.rasterizeSvg(await readFile(file, "utf8"), output, { width: flags.width ? Number(flags.width) : undefined, height: flags.height ? Number(flags.height) : undefined, scale: Number(flags.scale ?? 1), background: typeof flags.background === "string" ? flags.background : null }));
      return;
    }
    case "component": {
      const [name, dest] = args;
      if (!name) throw new TypeError(`Uso: motion svg component <${c.listSvgComponents().join("|")}> [saida.svg] [--seed=1] [--tokens=tokens.json]`);
      const tokens = flags.tokens ? JSON.parse(await readFile(flags.tokens, "utf8")) : undefined;
      const svg = c.buildSvgComponent(name, { tokens, seed: Number(flags.seed ?? 1), idPrefix: typeof flags.prefix === "string" ? flags.prefix : name });
      if (dest) { await writeFile(dest, svg); out({ output: dest, bytes: svg.length }); } else console.log(svg);
      return;
    }
    default:
      throw new TypeError("Uso: motion svg <validate|optimize|rasterize|component>");
  }
}
