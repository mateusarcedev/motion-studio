/**
 * MOTION Studio Skills — index.js
 * Catalog and installer for Agent Skills.
 */
import { readdir, readFile, mkdir, cp, symlink, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SKILLS_DIR = path.join(__dirname, "skills");

export const SKILL_PROFILES = {
  core: [
    "studio-director",
    "motion-director",
    "web-director",
    "brand",
    "design",
    "design-system",
  ],
  web: [
    "studio-director",
    "motion-director",
    "web-director",
    "brand",
    "design",
    "design-system",
    "ui-styling",
    "ui-ux-pro-max",
    "impeccable",
    "animate",
    "emil-design-eng",
    "apple-design",
    "prototype",
    "revenue-centric-design",
  ],
  motion: [
    "studio-director",
    "motion-director",
    "web-director",
    "brand",
    "design",
    "design-system",
    "shorts-director",
    "video-shotcraft",
    "brag",
    "lemo-opuscar",
    "animation-performance",
    "animation-vocabulary",
    "review-animations",
    "improve-animations",
    "find-animation-opportunities",
    "media-use",
    "hyperframes",
    "hyperframes-cli",
    "hyperframes-registry",
    "remotion-best-practices",
    "remotion-captions",
    "remotion-create",
    "remotion-docs",
    "remotion-interactivity",
    "remotion-maps",
    "remotion-markup",
    "remotion-multimedia",
    "remotion-render",
    "remotion-saas",
    "remotion-studio",
    "remotion-upgrade",
  ],
  social: [
    "studio-director",
    "motion-director",
    "web-director",
    "brand",
    "design",
    "design-system",
    "carousel-studio",
    "story-studio",
    "feed-studio",
    "banner-design",
    "slides",
  ],
  "3d": [
    "studio-director",
    "motion-director",
    "web-director",
    "brand",
    "design",
    "design-system",
    "3d-scene-director",
    "anatomy",
    "diagram-design",
  ],
  blender: [
    "studio-director",
    "motion-director",
    "web-director",
    "brand",
    "design",
    "design-system",
    "3d-scene-director",
    "anatomy",
    "diagram-design",
  ],
  all: null,
};

export function resolveSkillsForProfile(profile) {
  if (!profile || profile === "all") return null;
  const parts = String(profile).split(",").map((p) => p.trim().toLowerCase());
  const skillSet = new Set();
  for (const part of parts) {
    if (!(part in SKILL_PROFILES)) {
      throw new Error(
        `Perfil desconhecido '${part}'. Perfis válidos: ${Object.keys(SKILL_PROFILES).join(", ")}`
      );
    }
    const list = SKILL_PROFILES[part];
    if (list === null) return null; // 'all' selected
    for (const name of list) skillSet.add(name);
  }
  return Array.from(skillSet);
}

export async function listSkills() {
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  const skills = [];

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const skillPath = path.join(SKILLS_DIR, ent.name, "SKILL.md");
    let description = "";
    try {
      const content = await readFile(skillPath, "utf-8");
      const match = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
      if (match) {
        const descMatch = match[1].match(/description:\s*([^\r\n]+)/);
        if (descMatch) description = descMatch[1].trim();
      }
    } catch {}

    skills.push({
      name: ent.name,
      path: path.join(SKILLS_DIR, ent.name),
      description: description || "MOTION Studio Agent Skill",
    });
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export async function installSkills({
  targetDir = process.cwd(),
  agents = ["agents", "claude", "opencode"],
  profile = null,
  selectedSkills = null,
  copy = true,
} = {}) {
  const allSkills = await listSkills();
  let filterList = selectedSkills;
  if (!filterList && profile) {
    filterList = resolveSkillsForProfile(profile);
  }
  const toInstall = filterList
    ? allSkills.filter((s) => filterList.includes(s.name))
    : allSkills;

  const results = {
    profile: profile || (filterList ? "custom" : "all"),
    installed: [],
    targets: [],
  };

  const agentsTarget = path.join(targetDir, ".agents", "skills");
  await mkdir(agentsTarget, { recursive: true });
  results.targets.push(agentsTarget);

  for (const skill of toInstall) {
    const dest = path.join(agentsTarget, skill.name);
    try {
      await stat(dest);
    } catch {
      await cp(skill.path, dest, { recursive: true });
      results.installed.push(skill.name);
    }
  }

  if (agents.includes("claude")) {
    const claudeTarget = path.join(targetDir, ".claude", "skills");
    await mkdir(claudeTarget, { recursive: true });
    results.targets.push(claudeTarget);
    for (const skill of toInstall) {
      const dest = path.join(claudeTarget, skill.name);
      try {
        await stat(dest);
      } catch {
        const rel = path.relative(claudeTarget, path.join(agentsTarget, skill.name));
        try {
          await symlink(rel, dest);
        } catch {
          await cp(path.join(agentsTarget, skill.name), dest, { recursive: true });
        }
      }
    }
  }

  if (agents.includes("opencode")) {
    const opencodeTarget = path.join(targetDir, ".opencode", "skills");
    await mkdir(opencodeTarget, { recursive: true });
    results.targets.push(opencodeTarget);
    for (const skill of toInstall) {
      const dest = path.join(opencodeTarget, skill.name);
      try {
        await stat(dest);
      } catch {
        const rel = path.relative(opencodeTarget, path.join(agentsTarget, skill.name));
        try {
          await symlink(rel, dest);
        } catch {
          await cp(path.join(agentsTarget, skill.name), dest, { recursive: true });
        }
      }
    }
  }

  return results;
}
