import { cp, lstat, mkdir, readlink, realpath, rename, rm, stat, symlink } from "node:fs/promises";
import path from "node:path";
import { BootstrapError, exists, fileSha256, readJson, treeHash } from "./util.mjs";

/** Locates the public Skills package (installed dependency first, monorepo sibling as dev fallback). */
export async function defaultCatalogLoader() {
  let mod;
  try {
    mod = await import("@technomanceer/motion-studio-skills");
  } catch {
    try {
      mod = await import("../../../motion-skills/index.js");
    } catch {
      return null;
    }
  }
  return mod;
}

/**
 * Loads and verifies the public catalog. Throws if anything required is missing or tampered with.
 * Only skills listed in public-skills.json are ever considered (the other local skills never ship).
 */
export async function loadCatalog({ loader = defaultCatalogLoader, profile = "all" } = {}) {
  const mod = await loader();
  if (!mod?.SKILLS_DIR) {
    throw new BootstrapError("SKILLS_UNAVAILABLE", "Pacote de Skills (@technomanceer/motion-studio-skills) indisponível.", "As Skills são obrigatórias no MOTION Studio. Reinstale com `npm install -D @technomanceer/motion-studio-skills` e execute novamente.");
  }
  const root = path.dirname(mod.SKILLS_DIR);
  const pkg = await readJson(path.join(root, "package.json"), "package.json do pacote de Skills");
  const manifest = await readJson(path.join(root, "public-skills.json"), "public-skills.json");
  if (!pkg || !manifest?.skills?.length) {
    throw new BootstrapError("SKILLS_UNAVAILABLE", "Manifesto público de Skills ausente ou vazio.", "Reinstale @technomanceer/motion-studio-skills.");
  }
  if (manifest.package?.version !== pkg.version) {
    throw new BootstrapError("SKILLS_MISMATCH", `Manifesto de Skills (${manifest.package?.version}) não corresponde ao pacote (${pkg.version}).`, "Reinstale @technomanceer/motion-studio-skills.");
  }

  const all = [];
  for (const entry of manifest.skills) {
    const srcDir = path.join(root, "skills", entry.name);
    const skillFile = path.join(srcDir, "SKILL.md");
    if (!(await exists(skillFile))) {
      throw new BootstrapError("SKILL_MISSING", `Skill obrigatória ausente no pacote: ${entry.name}.`, "Reinstale @technomanceer/motion-studio-skills.");
    }
    const digest = await fileSha256(skillFile);
    if (digest !== entry.sha256) {
      throw new BootstrapError("SKILL_INTEGRITY", `Integridade falhou para a Skill '${entry.name}' (sha256 diverge do manifesto).`, "O pacote pode estar corrompido ou adulterado; reinstale-o.");
    }
    all.push({ name: entry.name, srcDir, sha256: entry.sha256, version: entry.version });
  }

  let selected = all;
  let excluded = [];
  if (profile && profile !== "all") {
    const names = new Set(mod.resolveSkillsForProfile(profile) ?? all.map((s) => s.name));
    selected = all.filter((s) => names.has(s.name));
    excluded = [...names].filter((n) => !all.some((s) => s.name === n));
    if (!selected.length) {
      throw new BootstrapError("PROFILE_EMPTY", `O perfil '${profile}' não contém nenhuma Skill redistribuível.`);
    }
  }
  return { version: pkg.version, root, all, selected, excluded };
}

async function copyVerified(src, dest, tmpRoot, wantHash) {
  await mkdir(tmpRoot, { recursive: true });
  const tmp = path.join(tmpRoot, `${path.basename(dest)}-${process.pid}`);
  await rm(tmp, { recursive: true, force: true });
  await cp(src, tmp, { recursive: true });
  if ((await treeHash(tmp)) !== wantHash) {
    await rm(tmp, { recursive: true, force: true });
    throw new BootstrapError("COPY_CORRUPT", `Cópia de '${path.basename(dest)}' não confere com a origem.`);
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await rename(tmp, dest).catch(async () => {
    await cp(tmp, dest, { recursive: true });
    await rm(tmp, { recursive: true, force: true });
  });
}

/**
 * Non-destructive install into <cwd>/<skillsDir> (default .agents/skills).
 * - missing → copied (via temp dir + hash check, so a crash never leaves a half skill)
 * - identical → untouched
 * - differs, previously installed by us and unmodified (hash == manifest) → updated
 * - differs, listed as pending from an interrupted run → repaired
 * - anything else (user's own/edited skill) → preserved, reported as conflict
 */
export async function installSkillFiles({ cwd, skillsDir = ".agents/skills", catalog, previous = {}, pending = [], force = false }) {
  const base = path.join(cwd, skillsDir);
  const tmpRoot = path.join(cwd, ".motion", "tmp");
  const backupRoot = path.join(cwd, ".motion", "backups");
  const results = [];
  for (const skill of catalog.selected) {
    const dest = path.join(base, skill.name);
    const srcHash = await treeHash(skill.srcDir);
    const rec = { name: skill.name, status: "", treeHash: srcHash };
    if (!(await exists(dest))) {
      await copyVerified(skill.srcDir, dest, tmpRoot, srcHash);
      rec.status = "installed";
    } else {
      const st = await lstat(dest);
      const cur = st.isDirectory() ? await treeHash(dest) : null;
      if (cur === srcHash) {
        rec.status = "unchanged";
      } else if (cur && (previous[skill.name]?.treeHash === cur || pending.includes(skill.name))) {
        await rm(dest, { recursive: true, force: true });
        await copyVerified(skill.srcDir, dest, tmpRoot, srcHash);
        rec.status = pending.includes(skill.name) && previous[skill.name]?.treeHash !== cur ? "repaired" : "updated";
      } else if (force) {
        const bak = path.join(backupRoot, `${skill.name}-${Date.now()}`);
        await mkdir(backupRoot, { recursive: true });
        await rename(dest, bak);
        await copyVerified(skill.srcDir, dest, tmpRoot, srcHash);
        rec.status = "replaced";
        rec.backup = path.relative(cwd, bak);
      } else {
        rec.status = "conflict";
        rec.treeHash = cur;
      }
    }
    results.push(rec);
  }
  await rm(tmpRoot, { recursive: true, force: true });
  return results;
}

/** Claude Code discovers only .claude/skills → relative symlink to the canonical copy (copy on EPERM). */
export async function linkClaudeSkills({ cwd, names, force = false }) {
  const claudeDir = path.join(cwd, ".claude", "skills");
  await mkdir(claudeDir, { recursive: true });
  const results = [];
  for (const name of names) {
    const dest = path.join(claudeDir, name);
    const canonical = path.join(cwd, ".agents", "skills", name);
    const rel = path.relative(claudeDir, canonical);
    const rec = { name, status: "" };
    let st = null;
    try {
      st = await lstat(dest);
    } catch {}
    if (!st) {
      rec.status = await makeLink(rel, dest, canonical);
    } else if (st.isSymbolicLink()) {
      const ok = await stat(dest).then(() => true).catch(() => false);
      const same = ok && (await realpath(dest)) === (await realpath(canonical));
      if (same) rec.status = "unchanged";
      else if (!ok || (await readlink(dest)) === rel) {
        await rm(dest, { force: true });
        rec.status = await makeLink(rel, dest, canonical);
      } else {
        rec.status = "conflict";
      }
    } else if (st.isDirectory() && (await treeHash(dest)) === (await treeHash(canonical))) {
      rec.status = "unchanged";
    } else if (force) {
      const bak = path.join(cwd, ".motion", "backups", `claude-${name}-${Date.now()}`);
      await mkdir(path.dirname(bak), { recursive: true });
      await rename(dest, bak);
      rec.status = await makeLink(rel, dest, canonical);
    } else {
      rec.status = "conflict";
    }
    results.push(rec);
  }
  return results;
}

async function makeLink(rel, dest, canonical) {
  try {
    await symlink(rel, dest, "dir");
    return "linked";
  } catch {
    await cp(canonical, dest, { recursive: true });
    return "copied";
  }
}
