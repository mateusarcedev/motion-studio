import { mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { BootstrapError, exists, readJson, writeJsonAtomic } from "./util.mjs";

/** Creates motion.config.json and the isolated brand skeleton. Never overwrites existing files. */
export async function ensureProjectFiles({ cwd, brand, profile, version, force = false }) {
  const configPath = path.join(cwd, "motion.config.json");
  const brandName = brand || path.basename(cwd);
  const slug = brandName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const done = [];

  const existing = await readJson(configPath, "motion.config.json"); // throws on invalid JSON
  let config = "preserved";
  if (existing === null || force) {
    if (existing !== null) {
      await rename(configPath, `${configPath}.bak-${Date.now()}`);
      config = "replaced";
    } else config = "created";
    await writeJsonAtomic(configPath, {
      name: brandName,
      brand: { name: brandName, slug, profile: "./motion/brand/PROFILE.md", tokens: "./motion/brand/tokens.json" },
      paths: { projects: "./motion/projects", out: "./motion/out", gallery: "./motion/gallery.json" },
      skills: { profile: profile || "all" },
      version,
    });
  }
  done.push({ file: "motion.config.json", status: config });

  for (const dir of ["brand", "projects", "out"]) await mkdir(path.join(cwd, "motion", dir), { recursive: true });
  const effectiveSlug = existing?.brand?.slug || slug;
  const effectiveName = existing?.brand?.name || brandName;

  const files = {
    "motion/brand/tokens.json": JSON.stringify({
      $comment: `Tokens da marca ${effectiveName} no projeto consumidor.`,
      color: { primary: "#0F172A", secondary: "#3B82F6", accent: "#10B981", background: "#090D16", surface: "#1E293B", text: "#F8FAFC", muted: "#94A3B8" },
      typography: {
        headline: { family: "Geist, system-ui, sans-serif", weight: "700" },
        body: { family: "Geist, system-ui, sans-serif", weight: "400" },
        mono: { family: "Geist Mono, monospace" },
      },
      spacing: { cardPadding: "32px", borderRadius: "16px" },
    }, null, 2) + "\n",
    "motion/brand/PROFILE.md": `# Perfil de Marca — ${effectiveName}\n\nIdentidade visual e diretrizes estéticas isoladas para o projeto consumidor.\n\n## Tom de Voz\n- Confiante, técnico, cinematográfico, direto ao ponto.\n\n## Regras Visuais\n- Contraste elevado para legibilidade.\n- Tipografia geométrica e consistente.\n- Animações sempre determinísticas.\n`,
    "motion/gallery.json": JSON.stringify({ $schema: "registro da galeria de produções do consumidor", brand: effectiveSlug, items: [] }, null, 2) + "\n",
  };
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(cwd, rel);
    if (await exists(p)) {
      done.push({ file: rel, status: "preserved" });
    } else {
      await writeFile(p, content, "utf8");
      done.push({ file: rel, status: "created" });
    }
  }
  return done;
}
