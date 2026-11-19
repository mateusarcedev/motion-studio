import { readFile } from "node:fs/promises";

let core;
async function getCore() {
  if (core) return core;
  try { core = await import("@technomanceer/motion-core"); }
  catch { core = await import("../../motion-core/index.js"); }
  return core;
}

export async function runComponents(subcommand, target, options = {}) {
  const api = await getCore();
  if (subcommand === "list") {
    console.log(JSON.stringify(api.listMotionComponents().map(({ id, title, version, schema, provenance }) => ({
      id, title, version, schemaId: schema.$id, parameters: Object.keys(schema.properties).filter((key) => !["component", "instanceId", "duration", "fps", "aspectRatio", "transparent", "theme"].includes(key)), provenance,
    })), null, 2));
    return;
  }
  if (subcommand !== "render" && subcommand !== "preview") {
    throw new TypeError("Uso: motion components <list|render|preview> [id] [--config=file.json] [--output=file.mp4|png]");
  }
  if (!target) throw new TypeError(`motion components ${subcommand} requer um id de componente`);
  if (!options.config) throw new TypeError("Informe --config com um arquivo JSON de parâmetros");
  const config = JSON.parse(await readFile(options.config, "utf8"));
  if (config.component && config.component !== target) throw new TypeError(`O componente no JSON (${config.component}) diverge do id '${target}'`);
  config.component = target;
  if (!options.output) throw new TypeError("Informe --output com o caminho de saída");
  const result = subcommand === "preview"
    ? await api.previewMotionComponent(config, options.output, { width: options.width, height: options.height, baseDir: process.cwd() })
    : await api.renderMotionComponent(config, options.output, { width: options.width, height: options.height, scale: options.scale, seed: options.seed, baseDir: process.cwd() });
  console.log(JSON.stringify(result, null, 2));
}
