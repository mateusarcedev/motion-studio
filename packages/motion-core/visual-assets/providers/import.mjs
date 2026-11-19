/**
 * Imports a folder of SVGs into a local provider pack (for libraries that cannot be redistributed,
 * e.g. LS Graphics, or the full Humaaans set). The user declares the license; MOTION never downloads
 * anything here and never redistributes the result: packs live in the project's .motion/assets/.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ERROR_CODES, MotionError } from "../../lib/errors.mjs";
import { optimizeSvg, validateSvg } from "../../svg/svg-tools.mjs";
import { assessLicense } from "../license-policy.mjs";

export async function importSvgPack({ dir, prefix, kind = "illustration", name, license, outDir, tagsFrom = "filename", commercial = true }) {
  if (!/^[a-z0-9-]+$/.test(prefix ?? "")) throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, "--prefix deve ser kebab-case (ex.: ls-graphics).");
  if (!["illustration", "character", "icon", "logo"].includes(kind)) throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, "--kind inválido.");
  const verdict = assessLicense(license, { commercial });
  if (!verdict.allowed) throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, `Licença não permite o uso: ${verdict.reason}`, { hint: 'Declare --spdx=<SPDX> ou --grant=user-licensed --commercial (você responde pela licença).' });
  const icons = {}, rejected = [];
  for (const f of (await readdir(dir)).filter((n) => n.toLowerCase().endsWith(".svg")).sort()) {
    const raw = await readFile(path.join(dir, f), "utf8");
    const checked = validateSvg(raw);
    if (!checked.ok) { rejected.push({ file: f, reason: checked.findings[0]?.message }); continue; }
    const n = f.slice(0, -4).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const opt = optimizeSvg(checked.svg, { prefix: n.replace(/-/g, "") });
    const [, , w, h] = opt.viewBox;
    icons[n] = { body: opt.svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, ""), width: w, height: h, tags: n.split("-").filter(Boolean), sha: createHash("sha256").update(opt.svg).digest("hex").slice(0, 16) };
  }
  const pack = { prefix, name: name ?? prefix, version: "local-import", kind, license: { ...license, scope: "assets" }, style: { kind: kind === "icon" ? "stroke" : kind === "logo" ? "color" : "illustration", width: 24, height: 24 }, icons };
  const out = path.join(outDir, `${prefix}.pack.json`);
  await mkdir(outDir, { recursive: true });
  await writeFile(out, JSON.stringify(pack));
  return { file: out, count: Object.keys(icons).length, rejected, verdict };
}
