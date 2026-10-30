import { stat, writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
let installSkills;
try {
  const mod = await import("motion-studio-skills");
  installSkills = mod.installSkills;
} catch {
  const mod = await import("../../motion-skills/index.js");
  installSkills = mod.installSkills;
}

export async function runInit(options = {}) {
  const cwd = process.cwd();
  const configPath = path.join(cwd, "motion.config.json");
  const force = Boolean(options.force);

  try {
    await stat(configPath);
    if (!force) {
      console.error("❌ Erro: 'motion.config.json' já existe neste projeto.");
      console.error("Por segurança, o MOTION Studio não sobrescreve configurações sem autorização explícita.");
      console.error("Passe '--force' para reinicializar.");
      process.exit(1);
    }
  } catch {}

  const brandName = options.brand || path.basename(cwd);
  const brandSlug = brandName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

  console.log(`🚀 Inicializando MOTION Studio para a marca: "${brandName}"...\n`);

  const profile = options.profile || "core";

  const config = {
    name: brandName,
    brand: {
      name: brandName,
      slug: brandSlug,
      profile: "./motion/brand/PROFILE.md",
      tokens: "./motion/brand/tokens.json",
    },
    paths: {
      projects: "./motion/projects",
      out: "./motion/out",
      gallery: "./motion/gallery.json",
    },
    skills: {
      profile,
    },
    version: "1.0.0-rc.1",
  };

  await mkdir(path.join(cwd, "motion", "brand"), { recursive: true });
  await mkdir(path.join(cwd, "motion", "projects"), { recursive: true });
  await mkdir(path.join(cwd, "motion", "out"), { recursive: true });

  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  console.log("✅ Configuração criada: motion.config.json");

  // Isolated brand tokens
  const tokensPath = path.join(cwd, "motion", "brand", "tokens.json");
  try {
    await stat(tokensPath);
  } catch {
    const defaultTokens = {
      $comment: `Tokens da marca ${brandName} no projeto consumidor.`,
      color: {
        primary: "#0F172A",
        secondary: "#3B82F6",
        accent: "#10B981",
        background: "#090D16",
        surface: "#1E293B",
        text: "#F8FAFC",
        muted: "#94A3B8",
      },
      typography: {
        headline: { family: "Geist, system-ui, sans-serif", weight: "700" },
        body: { family: "Geist, system-ui, sans-serif", weight: "400" },
        mono: { family: "Geist Mono, monospace" },
      },
      spacing: {
        cardPadding: "32px",
        borderRadius: "16px",
      },
    };
    await writeFile(tokensPath, JSON.stringify(defaultTokens, null, 2) + "\n", "utf-8");
    console.log("✅ Tokens de marca criados: motion/brand/tokens.json");
  }

  // Isolated brand profile
  const profilePath = path.join(cwd, "motion", "brand", "PROFILE.md");
  try {
    await stat(profilePath);
  } catch {
    const defaultProfile = `# Perfil de Marca — ${brandName}\n\n` +
      `Identidade visual e diretrizes estéticas isoladas para o projeto consumidor.\n\n` +
      `## Tom de Voz\n- Confiante, técnico, cinematográfico, direto ao ponto.\n\n` +
      `## Regras Visuais\n- Contraste elevado para legibilidade.\n- Tipografia geométrica e consistente.\n- Animações sempre determinísticas.\n`;
    await writeFile(profilePath, defaultProfile, "utf-8");
    console.log("✅ Perfil de marca criado: motion/brand/PROFILE.md");
  }

  // Consumer local gallery
  const galleryPath = path.join(cwd, "motion", "gallery.json");
  try {
    await stat(galleryPath);
  } catch {
    const initialGallery = {
      $schema: "registro da galeria de produções do consumidor",
      brand: brandSlug,
      items: [],
    };
    await writeFile(galleryPath, JSON.stringify(initialGallery, null, 2) + "\n", "utf-8");
    console.log("✅ Registro da galeria isolada criado: motion/gallery.json");
  }

  // Install Agent Skills
  console.log(`\n📦 Instalando Agent Skills (Perfil selecionado: '${profile}')...`);
  const skillRes = await installSkills({
    targetDir: cwd,
    agents: ["agents", "claude", "opencode"],
    profile,
  });
  console.log(`✅ ${skillRes.installed.length} skills configuradas em .agents/skills (e adaptadores .claude / .opencode).`);
  if (profile !== "all") {
    console.log(`ℹ Dica: Para instalar perfis adicionais ou todas as skills: npx motion init --force --profile=all (perfis: core, web, motion, social, 3d, blender, all).`);
  }

  console.log("\n🎉 MOTION Studio inicializado com sucesso!");
  console.log("Para verificar seu ambiente, execute: `npx motion doctor`");
  console.log("Para criar um novo entregável: `npx motion create <website|video|carousel> <nome>`");
}
