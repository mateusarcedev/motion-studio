/**
 * MOTION Core — reel/denoisers.mjs
 * Declared denoise providers. An external binary is only trusted when its SHA-256 matches the
 * declared one (or MOTION_DEEPFILTER_SHA256, set by whoever vetted the file): otherwise the
 * same project would sound different on each machine.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { run, sha256File } from "./util.mjs";

export const DENOISERS = Object.freeze(JSON.parse(readFileSync(new URL("./denoisers.json", import.meta.url), "utf8")).providers);

export function deepFilterBinary() {
  const env = process.env.MOTION_DEEPFILTER;
  if (env && existsSync(env)) return env;
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    for (const name of ["deep-filter", "deepFilter"]) {
      const c = path.join(dir, name);
      if (existsSync(c)) return c;
    }
  }
  return null;
}

/** {state: "ready"|"absent"|"unverified"|"mismatch", usable, ...evidence} */
export async function deepFilterStatus() {
  const spec = DENOISERS.find((d) => d.id === "deepfilternet");
  const expected = (process.env.MOTION_DEEPFILTER_SHA256 || spec.platforms[`${process.platform}-${process.arch}`]?.sha256 || "").toLowerCase() || null;
  const binary = deepFilterBinary();
  const common = { id: spec.id, version: spec.version, source: spec.source, license: spec.license, binary, expectedSha256: expected };
  if (!binary) return { ...common, state: "absent", usable: false, reason: "binário deep-filter não encontrado (PATH ou MOTION_DEEPFILTER)" };
  const sha256 = await sha256File(binary);
  if (!expected) return { ...common, sha256, state: "unverified", usable: false, reason: "sem SHA-256 de referência: a release oficial não publica hash; defina MOTION_DEEPFILTER_SHA256 depois de conferir o arquivo" };
  if (sha256 !== expected) return { ...common, sha256, state: "mismatch", usable: false, reason: "SHA-256 do binário difere do declarado" };
  return { ...common, sha256, state: "ready", usable: true, reason: null };
}

export async function audioDoctor() {
  const ffv = await run("ffmpeg", ["-hide_banner", "-version"]).catch(() => null);
  const filters = ffv ? (await run("ffmpeg", ["-hide_banner", "-filters"])).stdout : "";
  const need = ["afftdn", "loudnorm", "acompressor", "alimiter", "sidechaingate", "highshelf", "equalizer"];
  const missing = need.filter((f) => !new RegExp(`\\s${f}\\s`).test(filters));
  const df = await deepFilterStatus();
  return {
    ok: Boolean(ffv) && !missing.length,
    ffmpeg: ffv?.stdout.split("\n")[0] ?? null, missingFilters: missing, deepfilternet: df,
    autoDenoiser: df.usable ? "deepfilternet" : "ffmpeg-afftdn",
    warnings: df.usable ? [] : [`DeepFilterNet indisponível (${df.reason}); o modo auto usa o denoise do FFmpeg e registra a troca no relatório.`],
  };
}
