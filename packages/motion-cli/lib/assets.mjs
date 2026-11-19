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
    case "providers": {
      const reg = await c.createDefaultRegistry({ allowNetwork: flags.network === true });
      out(await reg.describe());
      return;
    }
    case "pick": {
      const intent = args.join(" ");
      if (!intent) throw new TypeError('Uso: motion assets pick "<intenção>" [--kind=icon|animated-icon|logo|character|illustration|lottie] [--network] [--svg]');
      const session = await c.createAssetSession({ size: Number(flags.size ?? 64), allowNetwork: flags.network === true });
      const a = await session.asset(intent, { kinds: typeof flags.kind === "string" ? [flags.kind] : undefined });
      if (flags.svg && a.svg) { console.log(a.svg); return; }
      out({ intent, kind: a.kind, id: a.id, provider: a.provider, confidence: a.confidence, fallback: a.fallback, reasons: a.reasons, alternatives: a.alternatives, license: a.provenance.licenseDetail ?? a.provenance.license, blocked: a.blocked, skipped: a.skipped, motion: a.motion ? a.motion.preset : undefined });
      return;
    }
    case "import": {
      const [dir] = args;
      if (!dir || typeof flags.prefix !== "string") throw new TypeError("Uso: motion assets import <pasta_de_svgs> --prefix=<kebab> [--kind=illustration|character|icon|logo] [--spdx=<SPDX> | --grant=user-licensed --commercial] [--attribution=\"texto\"]");
      const license = { spdx: typeof flags.spdx === "string" ? flags.spdx : "UNKNOWN", grant: flags.grant, commercialUse: flags.commercial === true, attribution: flags.attribution, attributionRequired: Boolean(flags.attribution) };
      const r = await c.importSvgPack({ dir, prefix: flags.prefix, kind: typeof flags.kind === "string" ? flags.kind : "illustration", license, outDir: typeof flags.out === "string" ? flags.out : ".motion/assets" });
      out(r);
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
      throw new TypeError("Uso: motion assets <pick|resolve|search|packs|providers|import>");
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
