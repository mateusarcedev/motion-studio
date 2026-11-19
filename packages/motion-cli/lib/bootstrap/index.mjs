/**
 * MOTION Studio — shared bootstrap. Used by `motion init` and by the public installer
 * (`npx @technomanceer/motion-studio init`); there is exactly one implementation.
 */
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { PKG } from "../version.mjs";
import { detectAgents, resolveTargets, AGENTS } from "./agents.mjs";
import { CLI_NAME, CORE_NAME, SKILLS_NAME, checkPackageManagerBinary, detectPackageManager, expectedPackages, installDependencies, installedVersion, planDependencies } from "./packages.mjs";
import { ensureProjectFiles } from "./project.mjs";
import { installSkillFiles, linkClaudeSkills, loadCatalog } from "./skills.mjs";
import { BootstrapError, exists, readJson, treeHash, writeJsonAtomic } from "./util.mjs";

export { BootstrapError, AGENTS };
export const MANIFEST_REL = ".motion/install.json";
const SELF_NAMES = new Set([CLI_NAME, CORE_NAME, SKILLS_NAME, "@technomanceer/motion-studio", "motion-studio-monorepo"]);

function parseOverrides() {
  if (!process.env.MOTION_STUDIO_SPECS) return {};
  try {
    return JSON.parse(process.env.MOTION_STUDIO_SPECS);
  } catch {
    throw new BootstrapError("BAD_SPECS", "MOTION_STUDIO_SPECS não é um JSON válido ({\"<pacote>\": \"<spec>\"}).");
  }
}

async function guardAgainstRecursion(cwd, pkgJson) {
  if (process.env.MOTION_STUDIO_INSTALLING === "1") {
    throw new BootstrapError("RECURSION", "Instalação recursiva detectada (MOTION_STUDIO_INSTALLING=1).", "O instalador não pode ser executado dentro de si mesmo.");
  }
  const real = await realpath(cwd);
  if (real.split(path.sep).includes("node_modules")) {
    throw new BootstrapError("INSIDE_NODE_MODULES", "O diretório atual está dentro de node_modules.", "Execute o instalador na raiz do seu projeto.");
  }
  if (pkgJson && SELF_NAMES.has(pkgJson.name)) {
    throw new BootstrapError("SELF_INSTALL", `Este diretório é o próprio pacote '${pkgJson.name}'.`, "Execute o instalador em um projeto consumidor, não no repositório do MOTION Studio.");
  }
}

export async function readManifest(cwd) {
  return readJson(path.join(cwd, MANIFEST_REL), MANIFEST_REL);
}

/** Independent verification of an existing install (used by init and by `motion doctor`). */
export async function verifyInstall(cwd, { loader } = {}) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });
  const manifest = await readManifest(cwd).catch((e) => {
    add("manifesto de instalação", false, e.message);
    return null;
  });
  if (!manifest) {
    if (!checks.length) add("manifesto de instalação", false, `${MANIFEST_REL} ausente — execute \`npx @technomanceer/motion-studio init\``);
    return checks;
  }
  add("manifesto de instalação", manifest.status === "complete", manifest.status === "complete" ? MANIFEST_REL : `status '${manifest.status}' (instalação incompleta; reexecute init)`);
  const catalog = await loadCatalog({ loader, profile: manifest.profile || "all" }).catch((e) => {
    add("catálogo de Skills", false, e.message);
    return null;
  });
  const expectedNames = catalog ? catalog.selected.map((s) => s.name) : Object.keys(manifest.skills || {});
  for (const name of expectedNames) {
    const dir = path.join(cwd, ".agents", "skills", name);
    if (!(await exists(path.join(dir, "SKILL.md")))) {
      add(`skill ${name}`, false, ".agents/skills ausente");
      continue;
    }
    const rec = manifest.skills?.[name];
    const cur = await treeHash(dir);
    const modified = rec && rec.treeHash !== cur;
    add(`skill ${name}`, true, modified ? "presente (modificada localmente)" : rec?.status === "conflict" ? "presente (versão do usuário preservada)" : "íntegra");
  }
  if (manifest.agents?.claudeLink) {
    for (const name of expectedNames) {
      const ok = await exists(path.join(cwd, ".claude", "skills", name, "SKILL.md"));
      if (!ok) add(`claude link ${name}`, false, ".claude/skills ausente ou quebrado");
    }
  }
  return checks;
}

function logger(quiet) {
  return (...a) => {
    if (!quiet) console.log(...a);
  };
}

/**
 * @param {object} o
 *  cwd, brand, profile (default "all"), agents ("claude,codex"), force, strict, json,
 *  skipInstall (use files from the running package, no dependency install),
 *  withPackageJson (create a minimal package.json when none exists),
 *  skipDoctor, catalogLoader, doctor (injectable)
 */
export async function runBootstrap(o = {}) {
  const cwd = path.resolve(o.cwd || process.cwd());
  const log = logger(o.json);
  const report = { ok: false, exitCode: 1, cwd, mode: null, packageManager: null, steps: [], warnings: [], versions: {}, skills: [], agents: {}, files: [], doctor: [] };
  const step = (name, status, detail = "") => {
    report.steps.push({ name, status, detail });
    log(`${status === "ok" ? "✅" : status === "warn" ? "⚠️ " : status === "skip" ? "⏭ " : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  };
  const warn = (m) => {
    report.warnings.push(m);
    log(`⚠️  ${m}`);
  };

  try {
    log(`\n🚀 MOTION Studio — instalação em ${cwd}\n`);
    const cliPkg = PKG;
    const expected = expectedPackages(cliPkg);
    report.versions.expected = expected;

    // 0. Preflight
    if (Number(process.versions.node.split(".")[0]) < 20) {
      throw new BootstrapError("NODE_TOO_OLD", `Node.js ${process.version} não suportado (mínimo 20, requisito do Playwright).`);
    }
    const pkgPath = path.join(cwd, "package.json");
    let pkgJson = await readJson(pkgPath, "package.json");
    await guardAgainstRecursion(cwd, pkgJson);
    const manifest = await readManifest(cwd);
    if (manifest && manifest.status !== "complete") warn(`Instalação anterior incompleta (${manifest.status}); retomando.`);

    // 1. Catalog (fail before touching anything if mandatory Skills are unavailable)
    const profile = o.profile && o.profile !== true ? String(o.profile) : "all";
    const catalog = await loadCatalog({ loader: o.catalogLoader, profile });
    report.versions.skills = catalog.version;
    if (catalog.excluded.length) warn(`${catalog.excluded.length} Skill(s) do perfil '${profile}' não são redistribuíveis e não foram incluídas: ${catalog.excluded.join(", ")}`);
    step("Catálogo de Skills verificado", "ok", `${catalog.selected.length} Skills públicas (sha256 conferido)`);

    // 2. Mode / package manager
    let mode = "project";
    if (!pkgJson) {
      if (o.withPackageJson || o["with-package-json"]) {
        await writeJsonAtomic(pkgPath, { private: true });
        pkgJson = { private: true };
        step("package.json criado", "ok", "mínimo, por --with-package-json");
      } else if (o.skipInstall || o["skip-install"]) {
        mode = "standalone";
      } else {
        mode = "standalone";
        warn("Sem package.json: modo standalone — somente Skills e configuração (nenhum package.json ou node_modules é criado). Para instalar também CLI e Core, rode com --with-package-json.");
      }
    }
    if (o.skipInstall || o["skip-install"]) mode = pkgJson ? "project-no-deps" : "standalone";
    report.mode = mode;

    const pm = await detectPackageManager(cwd, pkgJson);
    report.packageManager = pm;
    if (mode === "project") step("Gerenciador de pacotes", "ok", `${pm.name} (${pm.source})`);

    // 3. Mark in-progress BEFORE changing anything (enables recovery)
    await mkdir(path.join(cwd, ".motion"), { recursive: true });
    const manifestPath = path.join(cwd, MANIFEST_REL);
    const base = { schemaVersion: 1, mode, profile, packageManager: pm.name, versions: expected, skills: manifest?.skills || {} };
    await writeJsonAtomic(manifestPath, { ...base, status: "in-progress", pending: catalog.selected.map((s) => s.name) });

    // 4. Dependencies
    if (mode === "project") {
      const plan = await planDependencies(cwd, pkgJson, expected);
      report.versions.installed = Object.fromEntries(Object.entries(plan).map(([k, v]) => [k, v.have]));
      const need = Object.keys(plan).filter((n) => plan[n].action === "install");
      for (const [n, p] of Object.entries(plan)) {
        if (p.action === "newer") warn(`${n}@${p.have} é mais novo que a versão testada (${p.want}); mantido.`);
      }
      if (need.length === 0) {
        step("Dependências locais", "ok", "já instaladas nas versões compatíveis");
      } else {
        checkPackageManagerBinary(pm.name);
        log("📦 Instalando CLI, Core e Skills no projeto (devDependencies, sem scripts de terceiros)...");
        // Always install all three together so they stay mutually compatible.
        installDependencies({ cwd, pm: pm.name, names: Object.keys(expected), expected, overrides: parseOverrides(), log });
        const after = {};
        for (const n of Object.keys(expected)) after[n] = await installedVersion(cwd, n);
        const wrong = Object.keys(expected).filter((n) => after[n] !== expected[n] && !parseOverrides()[n]);
        if (wrong.length) throw new BootstrapError("VERSION_MISMATCH", `Versões instaladas divergem do esperado: ${wrong.map((n) => `${n}=${after[n]} (esperado ${expected[n]})`).join(", ")}.`);
        report.versions.installed = after;
        step("Dependências locais", "ok", Object.entries(after).map(([n, v]) => `${n.split("/")[1]}@${v}`).join(", "));
      }
    } else {
      step("Dependências locais", "skip", mode === "standalone" ? "modo standalone (sem package.json)" : "--skip-install");
    }

    // 5. Agents + Skills
    const detected = await detectAgents(cwd, { probeBinaries: !o.noProbe });
    const targets = resolveTargets(detected, o.agents && o.agents !== true ? o.agents : null);
    report.agents = { detected: Object.fromEntries(Object.entries(detected).map(([k, v]) => [k, { label: v.label, detected: v.detected, evidence: v.evidence, location: v.location }])), selected: targets.agents, claudeLink: targets.claudeLink };

    const force = Boolean(o.force);
    const skillRes = await installSkillFiles({ cwd, catalog, previous: manifest?.skills || {}, pending: manifest?.status !== "complete" ? manifest?.pending || [] : [], force });
    let linkRes = [];
    if (targets.claudeLink) linkRes = await linkClaudeSkills({ cwd, names: catalog.selected.map((s) => s.name), force });
    report.skills = skillRes;
    const count = (arr, s) => arr.filter((r) => r.status === s).length;
    const conflicts = [...skillRes, ...linkRes.map((r) => ({ ...r, name: `.claude/${r.name}` }))].filter((r) => r.status === "conflict");
    for (const c of conflicts) warn(`Conflito: '${c.name}' já existe com conteúdo diferente — preservado, não sobrescrito (use --force para substituir com backup em .motion/backups).`);
    step("Skills oficiais", conflicts.length ? "warn" : "ok", `${skillRes.length} em .agents/skills (novas ${count(skillRes, "installed")}, atualizadas ${count(skillRes, "updated") + count(skillRes, "repaired")}, inalteradas ${count(skillRes, "unchanged")}, conflitos ${count(skillRes, "conflict")})`);
    if (targets.claudeLink) step("Integração Claude Code", "ok", `.claude/skills (${count(linkRes, "linked")} links, ${count(linkRes, "copied")} cópias, ${count(linkRes, "unchanged")} inalterados)`);

    // 6. Project files
    report.files = await ensureProjectFiles({ cwd, brand: o.brand && o.brand !== true ? o.brand : null, profile, version: cliPkg.version, force });
    const cfg = report.files.find((f) => f.file === "motion.config.json");
    if (cfg.status === "preserved") step("motion.config.json", "ok", "existente preservado");
    else step("motion.config.json", "ok", cfg.status === "created" ? "criado" : "substituído (backup .bak-*)");

    // 7. Manifest complete + verification
    const skillsRecord = { ...(manifest?.skills || {}) };
    for (const r of skillRes) {
      // A conflicting skill belongs to the user: never record its hash as "ours" (it would be overwritten next run).
      if (r.status === "conflict") continue;
      skillsRecord[r.name] = { status: r.status, treeHash: r.treeHash, version: catalog.selected.find((s) => s.name === r.name).version };
    }
    await writeJsonAtomic(manifestPath, { ...base, skills: skillsRecord, agents: { selected: targets.agents, claudeLink: targets.claudeLink }, status: "complete", updatedAt: new Date().toISOString() });
    const checks = await verifyInstall(cwd, { loader: o.catalogLoader });
    report.verify = checks;
    const failed = checks.filter((c) => !c.ok);
    if (failed.length) throw new BootstrapError("VERIFY_FAILED", `Verificação pós-instalação falhou:\n${failed.map((c) => `  - ${c.name}: ${c.detail}`).join("\n")}`);
    step("Verificação de integridade", "ok", `${checks.length} verificações`);

    // 8. Engines diagnostic (never installs anything)
    let enginesOk = true;
    if (!o.skipDoctor) {
      const doctor = o.doctor || (await import("../doctor.mjs")).collectDoctor;
      report.doctor = await doctor();
      const missing = report.doctor.filter((r) => r.required && r.status === "FAIL");
      enginesOk = missing.length === 0;
      step("Diagnóstico de motores", enginesOk ? "ok" : "warn", enginesOk ? "obrigatórios presentes" : `ausentes: ${missing.map((m) => `${m.name} → ${m.details}`).join("; ")}`);
      for (const r of report.doctor.filter((r) => !r.required && r.status !== "PASS")) log(`   · ${r.name}: ${r.details}`);
    }

    report.ok = true;
    report.enginesOk = enginesOk;
    report.exitCode = !enginesOk && o.strict ? 3 : 0;
    printSummary(report, log, conflicts.length);
  } catch (err) {
    report.ok = false;
    report.exitCode = err instanceof BootstrapError && err.code === "NETWORK" ? 2 : 1;
    report.error = { code: err.code || "ERROR", message: err.message, hint: err.hint };
    if (!o.json) {
      console.error(`\n❌ ${err.message}`);
      if (err.hint) console.error(`   → ${err.hint}`);
    }
  }
  if (o.json) console.log(JSON.stringify(report, null, 2));
  return report;
}

function printSummary(r, log, conflicts) {
  const sel = r.agents.selected.length ? r.agents.selected.map((id) => AGENTS[id].label).join(", ") : "nenhum detectado (instalação universal)";
  log("\n──────── Relatório ────────");
  log(`Modo:        ${r.mode}${r.packageManager && r.mode === "project" ? ` (${r.packageManager.name})` : ""}`);
  log(`Skills:      ${r.skills.length} oficiais em .agents/skills${r.agents.claudeLink ? " + .claude/skills" : ""}`);
  log(`Agentes:     ${sel}`);
  log("Descoberta:  .agents/skills → Codex, OpenCode, Antigravity (testados)" + (r.agents.claudeLink ? " · .claude/skills → Claude Code (testado)" : ""));
  log("             Gemini CLI e GitHub Copilot: caminhos conforme a documentação oficial, não testados.");
  if (conflicts) log(`Conflitos:   ${conflicts} preservado(s)`);
  log(r.enginesOk === false ? "\n⚠️  Instalado, mas há motores obrigatórios ausentes (veja acima). Rode `npx motion doctor` após instalá-los." : "\n🎉 MOTION Studio pronto.");
  log("Próximos passos: `npx motion doctor` · `npx motion create video <nome>`");
  log("Integrações externas opcionais (nunca instaladas automaticamente): veja `npx motion list`.");
}
