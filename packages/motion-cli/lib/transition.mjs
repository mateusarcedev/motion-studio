let core;
async function getCore() {
  if (core) return core;
  try { core = await import("@technomanceer/motion-core"); }
  catch { core = await import("../../motion-core/index.js"); }
  return core;
}

export async function runTransition(subcommand, positionalInputs = [], options = {}) {
  const api = await getCore();
  if (subcommand === "list") {
    console.log(JSON.stringify(await api.listTransitions(), null, 2));
    return;
  }
  if (!new Set(["render", "preview"]).has(subcommand)) throw new TypeError("Uso: motion transition <list|render|preview> <scene...> --output=out.mp4");
  if (!options.output) throw new TypeError("Informe --output para o vídeo de transições");
  const transition = {
    kind: options.kind || "wipe",
    direction: options.direction || "left", easing: options.easing || "ease-out",
    softness: Number(options.softness || 0), maskScale: Number(options.maskScale || 32),
  };
  if (options.duration !== undefined) transition.duration = Number(options.duration);
  if (options.offset !== undefined) transition.offset = Number(options.offset);
  if (options.accentColor !== undefined) transition.accentColor = options.accentColor;
  if (options.easingCoefficients) transition.easingCoefficients = String(options.easingCoefficients).split(",").map(Number);
  const result = await api.renderTransition(positionalInputs, options.output, transition, {
    fps: Number(options.fps || (subcommand === "preview" ? 15 : 30)),
    width: Number(options.width || (subcommand === "preview" ? 640 : 0)) || undefined,
    height: Number(options.height || (subcommand === "preview" ? 360 : 0)) || undefined,
    crf: options.crf === undefined ? undefined : Number(options.crf),
  });
  console.log(JSON.stringify({ ...result, preview: subcommand === "preview" }, null, 2));
}
