import { spawnSync } from "node:child_process";
import path from "node:path";
import { BootstrapError, compareVersions, exists, readJson } from "./util.mjs";

export const CLI_NAME = "@technomanceer/motion-cli";
export const CORE_NAME = "@technomanceer/motion-core";
export const SKILLS_NAME = "@technomanceer/motion-studio-skills";

const LOCKFILES = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"],
];

export async function detectPackageManager(cwd, pkgJson) {
  const field = pkgJson?.packageManager;
  if (typeof field === "string") {
    const name = field.split("@")[0];
    if (["npm", "pnpm", "yarn", "bun"].includes(name)) return { name, source: "package.json#packageManager" };
  }
  for (const [file, name] of LOCKFILES) {
    if (await exists(path.join(cwd, file))) return { name, source: file };
  }
  const ua = process.env.npm_config_user_agent || "";
  const m = ua.match(/^(pnpm|yarn|bun)\//);
  if (m) return { name: m[1], source: "npm_config_user_agent" };
  return { name: "npm", source: "padrão" };
}

/** Exact versions this CLI was tested with: itself + the pinned deps. */
export function expectedPackages(cliPkg) {
  const core = cliPkg.dependencies?.[CORE_NAME];
  const skills = cliPkg.dependencies?.[SKILLS_NAME];
  for (const [n, v] of [[CORE_NAME, core], [SKILLS_NAME, skills]]) {
    if (!v || !/^\d+\.\d+\.\d+/.test(v)) {
      throw new BootstrapError("BAD_MANIFEST", `Dependência '${n}' precisa estar fixada em versão exata no CLI (encontrado: ${v}).`);
    }
  }
  return {
    [CLI_NAME]: cliPkg.version,
    [CORE_NAME]: core,
    [SKILLS_NAME]: skills,
  };
}

export async function installedVersion(cwd, name) {
  const pkg = await readJson(path.join(cwd, "node_modules", ...name.split("/"), "package.json")).catch(() => null);
  return pkg?.version ?? null;
}

/** Decide what to do per package: ok | install | newer (kept, with warning). */
export async function planDependencies(cwd, pkgJson, expected) {
  const plan = {};
  for (const [name, want] of Object.entries(expected)) {
    const declared = pkgJson?.devDependencies?.[name] ?? pkgJson?.dependencies?.[name] ?? null;
    const have = await installedVersion(cwd, name);
    let action = "install";
    if (have && declared) {
      const cmp = compareVersions(have, want);
      action = cmp === 0 ? "ok" : cmp > 0 ? "newer" : "install";
    }
    plan[name] = { want, have, declared, action };
  }
  return plan;
}

const NETWORK_RE = /ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ESOCKETTIMEDOUT|network|getaddrinfo|socket hang up|fetch failed/i;

function addArgs(pm, specs) {
  switch (pm) {
    case "pnpm": return ["add", "-D", "-E", "--ignore-scripts", ...specs];
    case "yarn": return ["add", "-D", "-E", "--ignore-scripts", ...specs];
    case "bun": return ["add", "-d", "--exact", "--ignore-scripts", ...specs];
    default: return ["install", "--save-dev", "--save-exact", "--ignore-scripts", "--no-audit", "--no-fund", ...specs];
  }
}

export function checkPackageManagerBinary(pm) {
  const r = spawnSync(pm, ["--version"], { encoding: "utf8" });
  if (r.error || r.status !== 0) {
    throw new BootstrapError("PM_MISSING", `Gerenciador de pacotes '${pm}' detectado no projeto, mas não encontrado no PATH.`, `Instale '${pm}' (ou ative via corepack) e execute novamente.`);
  }
}

/**
 * Installs the three packages locally (devDependencies, never global).
 * overrides: { [name]: spec } replaces the registry spec (offline mirrors, tarballs, tests).
 */
export function installDependencies({ cwd, pm, names, expected, overrides = {}, attempts = 3, backoffMs = 1500, log }) {
  const specs = names.map((n) => overrides[n] ?? `${n}@${expected[n]}`);
  const env = { ...process.env, MOTION_STUDIO_INSTALLING: "1", YARN_ENABLE_SCRIPTS: "false" };
  let last = "";
  for (let i = 1; i <= attempts; i++) {
    log(`  ${pm} ${addArgs(pm, specs).slice(0, 2).join(" ")} ${names.join(" ")} (tentativa ${i}/${attempts})`);
    const r = spawnSync(pm, addArgs(pm, specs), { cwd, env, encoding: "utf8", timeout: 5 * 60_000 });
    if (!r.error && r.status === 0) return;
    last = `${r.stderr || ""}${r.stdout || ""}${r.error ? String(r.error) : ""}`;
    const tail = last.trim().split("\n").slice(-8).join("\n");
    if (!NETWORK_RE.test(last)) {
      throw new BootstrapError("INSTALL_FAILED", `'${pm}' falhou ao instalar os pacotes:\n${tail}`, "Corrija o erro acima (versão inexistente? permissão?) e execute novamente; nada foi alterado além do que o gerenciador já gravou.");
    }
    if (i < attempts) {
      const wait = backoffMs * i;
      log(`  ⚠ falha de rede; nova tentativa em ${wait}ms`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);
    }
  }
  throw new BootstrapError("NETWORK", `Falha de rede ao instalar os pacotes após ${attempts} tentativas:\n${last.trim().split("\n").slice(-6).join("\n")}`, "Verifique a conexão/registro npm e execute `npx @technomanceer/motion-studio init` novamente — a instalação é retomada do ponto em que parou.");
}
