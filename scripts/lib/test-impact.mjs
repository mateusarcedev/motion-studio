import { execFileSync } from "node:child_process";
import path from "node:path";
import { ROOT } from "../test-catalog.mjs";

function statusPaths(output, scope) {
  const tokens = output.split("\0").filter(Boolean);
  const files = [];
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++];
    if (/^[RC]/.test(status)) {
      const before = tokens[index++];
      const after = tokens[index++];
      files.push({ path: before, status: `${scope}-renamed-from` }, { path: after, status: `${scope}-renamed-to` });
    } else {
      const action = status[0] === "D" ? "deleted" : status[0] === "A" ? "added" : "modified";
      files.push({ path: tokens[index++], status: `${scope}-${action}` });
    }
  }
  return files;
}

function git(args, root = ROOT) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

export function getChangedFiles(base, root = ROOT) {
  const changes = [];
  if (base) changes.push(...statusPaths(git(["diff", "--name-status", "--find-renames", "-z", `${base}...HEAD`], root), "base"));
  changes.push(...statusPaths(git(["diff", "--cached", "--name-status", "--find-renames", "-z", "HEAD"], root), "staged"));
  changes.push(...statusPaths(git(["diff", "--name-status", "--find-renames", "-z"], root), "unstaged"));
  for (const file of git(["ls-files", "--others", "--exclude-standard", "-z"], root).split("\0").filter(Boolean)) changes.push({ path: file, status: "untracked" });
  const unique = new Map();
  for (const item of changes) unique.set(`${item.path}\0${item.status}`, item);
  return [...unique.values()].sort((a, b) => a.path.localeCompare(b.path) || a.status.localeCompare(b.status));
}

function fileModule(file) {
  const segments = file.split("/");
  if (segments[0] === "packages" && segments[1] === "motion-skills") {
    const index = segments.indexOf("skills");
    if (index >= 0 && segments[index + 1]) return `skill:${segments[index + 1]}`;
    return "motion-skills";
  }
  if (segments[0] === "packages" && segments[1]) return segments[1];
  if (segments[0] === "tests") return "motion-studio";
  return segments.slice(0, 2).join("/");
}

export async function selectTestsForChanges(changes, catalog) {
  const runnable = catalog.entries.filter((entry) => entry.ci?.status === "run");
  const byPath = new Map(catalog.entries.map((entry) => [entry.path, entry]));
  const selected = new Map();
  const blocked = new Map();
  const affectedModules = new Set();
  const validations = new Set();
  const reasons = [];

  const add = (entry, reason) => {
    if (!entry) return;
    if (entry.ci?.status === "blocked") {
      const record = blocked.get(entry.path) ?? { ...entry, reasons: [] };
      if (!record.reasons.includes(reason)) record.reasons.push(reason);
      blocked.set(entry.path, record);
      return;
    }
    if (entry.ci?.status !== "run") return;
    const record = selected.get(entry.path) ?? { ...entry, reasons: [] };
    if (!record.reasons.includes(reason)) record.reasons.push(reason);
    selected.set(entry.path, record);
  };
  const addGroup = (group, reason) => {
    for (const entry of runnable) if (entry.groups.includes(group)) add(entry, reason);
  };

  if (!changes.length) {
    addGroup("quick", "nenhuma alteração detectada; verificação mínima evita seleção vazia");
    reasons.push("Sem arquivos alterados: selecionado o grupo quick como fallback explícito.");
    return { changes, selected: [...selected.values()], blocked: [...blocked.values()], affectedModules: [], validations: ["test:quick"], mode: "quick-fallback", reasons };
  }

  const codeChanges = [];
  for (const change of changes) {
    const file = change.path.split(path.sep).join("/");
    if (byPath.has(file)) {
      add(byPath.get(file), `arquivo de teste alterado (${change.status})`);
      affectedModules.add(byPath.get(file).module);
      continue;
    }
    if (file === "docs/testing/test-catalog.json") {
      validations.add("catalog-check");
      add(byPath.get("tests/test_catalog.test.mjs"), "catálogo de testes alterado; conferir descobrimento e cobertura");
      reasons.push(`${file}: validar que o catálogo corresponde aos arquivos descobertos.`);
      continue;
    }
    if (/^(?:docs\/|AGENTS\.md$|CLAUDE\.md$|GEMINI\.md$)/.test(file) || /\.md$/i.test(file)) {
      validations.add("docs-diff-check");
      if (/^(?:packages\/motion-skills|packages\/motion-cli\/.*skills|\.(?:agents|claude|opencode)\/skills)\//.test(file)) validations.add("skills-verify");
      reasons.push(`${file}: validação documental sem iniciar testes de mídia.`);
      continue;
    }

    codeChanges.push(change);
    const module = fileModule(file);
    affectedModules.add(module);
    const changedDependencies = [];
    for (const entry of catalog.entries) {
      const closure = new Set([...(entry.dependencies ?? []), ...(entry.transitiveDependencies ?? [])]);
      if (closure.has(file)) {
        const relation = entry.dependencies?.includes(file) ? "direta" : "transitiva";
        add(entry, `dependência ${relation} importada por ${entry.path}`);
        changedDependencies.push(entry.path);
      }
    }

    const testInfrastructure = /^(?:scripts\/(?:test-|ci[_-]|run-test-selection\.)|scripts\/lib\/test-(?:execution|impact)\.|\.github\/workflows\/)/.test(file);
    if (/^(?:package\.json|package-lock\.json|packages\/[^/]+\/package(?:-lock)?\.json)$/.test(file) || testInfrastructure) {
      for (const entry of catalog.entries) add(entry, "grafo de dependências ou infraestrutura compartilhada; cobertura integral conservadora");
      validations.add("catalog-check");
      reasons.push(`${file}: altera dependências/infraestrutura compartilhada; selecionada toda a cobertura CI catalogada.`);
      continue;
    }

    if (/mcp/i.test(file)) { addGroup("mcp", `${file}: contrato MCP`); reasons.push(`${file}: impacto MCP.`); }
    if (/bridge/i.test(file)) { addGroup("bridge", `${file}: contratos e adapters Design Bridge`); addGroup("svg-security", `${file}: segurança de parsing/importação`); reasons.push(`${file}: impacto Design Bridge e segurança.`); }
    if (/audio|voice|caption|tts|bgm|sfx|media-use/i.test(file)) { addGroup("audio", `${file}: motores e contratos de áudio`); reasons.push(`${file}: impacto de áudio.`); }
    if (/svg/i.test(file)) { addGroup("svg-security", `${file}: validação/sanitização SVG`); reasons.push(`${file}: impacto SVG.`); }
    if (/render|remotion|reel|transitions|ffmpeg|visual_assets/i.test(file)) {
      addGroup("render", `${file}: renderização/composição`);
      addGroup("media", `${file}: QA e renderização de mídia`);
      if (/motion-core\/(?:reel|render|media)|renderers?\//i.test(file)) validations.add("determinism");
      reasons.push(`${file}: impacto de renderização/mídia${validations.has("determinism") ? " (inclui determinismo)" : ""}.`);
    }
    if (/^packages\/motion-skills\//.test(file)) {
      for (const entry of runnable) if (entry.module === module) add(entry, `${file}: módulo de Skill ${module}`);
      validations.add("skills-verify");
      reasons.push(`${file}: selecionados testes do módulo e verificação de manifestos/hashes de Skills.`);
    }

    if (changedDependencies.length) reasons.push(`${file}: dependência transitiva de ${changedDependencies.length} arquivo(s) de teste.`);
  }

  if (codeChanges.length && selected.size === 0) {
    for (const entry of catalog.entries) add(entry, "impacto não resolvido pelo grafo/regras; ampliado conservadoramente para todos os testes CI");
    validations.add("catalog-check");
    reasons.push("Nenhum teste relacionado pôde ser determinado; ampliada a seleção para todos os testes CI executáveis.");
  }

  if (selected.size === 0 && !validations.size) {
    for (const entry of catalog.entries) add(entry, "nenhuma regra explícita cobriu a alteração; fallback conservador");
    validations.add("catalog-check");
    reasons.push("Seleção inicialmente vazia; fallback conservador para todos os testes CI executáveis.");
  }

  return {
    changes,
    selected: [...selected.values()].sort((a, b) => a.path.localeCompare(b.path)),
    blocked: [...blocked.values()].sort((a, b) => a.path.localeCompare(b.path)),
    affectedModules: [...affectedModules].sort(),
    validations: [...validations].sort(),
    mode: selected.size ? "tests-selected" : "checks-only",
    reasons,
  };
}
