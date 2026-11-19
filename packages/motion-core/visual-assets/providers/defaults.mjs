/**
 * Default provider set for a production. Order = priority on ties.
 * Local user packs (.motion/…) are discovered here, so adding a library never touches the resolver.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createIconifyFetcher, loadIconPacks, loadPackFile } from "../../icons/icon-library.mjs";
import { createAnimatedIconProvider } from "./animated.mjs";
import { createIconifyProvider } from "./iconify.mjs";
import { createLottieProvider } from "./lottie.mjs";
import { createPackProvider } from "./pack.mjs";
import { createProviderRegistry } from "./registry.mjs";

const ASSETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../assets");

export async function createDefaultRegistry({ cwd = process.cwd(), env = process.env, allowNetwork = false, fetchImpl, cache, commercial = true, extraPacks = [] } = {}) {
  const registry = createProviderRegistry({ commercial });
  const { packs } = await loadIconPacks({ cwd, env });
  const lucide = packs.find((p) => p.prefix === "lucide");
  for (const pack of packs) registry.register(createPackProvider({ pack, id: pack.prefix, kind: "icon" }));
  // bundled provider packs
  for (const f of ["developer-icons.pack.json", "humaaans.pack.json"]) {
    try { const pack = await loadPackFile(path.join(ASSETS, "packs", f)); registry.register(createPackProvider({ pack })); } catch {}
  }
  // user packs for any kind (e.g. LS Graphics, full Humaaans): .motion/assets/*/*.pack.json and $MOTION_ASSET_PACKS
  const dirs = [path.join(cwd, ".motion", "assets"), ...(env.MOTION_ASSET_PACKS ?? "").split(path.delimiter).filter(Boolean)];
  const seen = new Set(registry.list().map((p) => p.id));
  for (const dir of dirs) {
    const files = [];
    for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (e.isFile() && e.name.endsWith(".pack.json")) files.push(path.join(dir, e.name));
      if (e.isDirectory()) for (const f of await readdir(path.join(dir, e.name)).catch(() => [])) if (f.endsWith(".pack.json")) files.push(path.join(dir, e.name, f));
    }
    for (const f of [...files, ...extraPacks]) {
      try { const pack = await loadPackFile(f); if (!seen.has(pack.prefix)) { registry.register(createPackProvider({ pack })); seen.add(pack.prefix); } } catch {}
    }
  }
  if (lucide) registry.register(createAnimatedIconProvider({ lucide }));
  registry.register(createLottieProvider({ dirs: [path.join(ASSETS, "lottie"), path.join(cwd, ".motion", "lottie"), ...(env.MOTION_LOTTIE ?? "").split(path.delimiter).filter(Boolean)] }));
  registry.register(createIconifyProvider({ allowNetwork, fetchImpl, cache }));
  return registry;
}
