import { spawnSync } from "node:child_process";
import path from "node:path";
import { BootstrapError, exists } from "./util.mjs";

/**
 * Skill discovery per agent, confirmed against each vendor's docs (2026-11):
 *  - Claude Code: .claude/skills
 *  - Codex:       .agents/skills (repo → cwd), symlinks followed
 *  - Gemini CLI:  .gemini/skills or alias .agents/skills
 *  - OpenCode:    .opencode/skills, .claude/skills, .agents/skills
 *  - Copilot:     .github/skills, .claude/skills, .agents/skills
 * `.agents/skills` is therefore the universal location; only Claude Code needs `.claude/skills`.
 */
export const AGENTS = {
  claude: { label: "Claude Code", location: ".claude/skills", markers: [".claude", "CLAUDE.md"], bin: "claude" },
  codex: { label: "OpenAI Codex", location: ".agents/skills", markers: [".codex", "AGENTS.md"], bin: "codex" },
  gemini: { label: "Gemini CLI", location: ".agents/skills", markers: [".gemini", "GEMINI.md"], bin: "gemini" },
  opencode: { label: "OpenCode", location: ".agents/skills", markers: [".opencode", "opencode.json", "opencode.jsonc"], bin: "opencode" },
  copilot: { label: "GitHub Copilot", location: ".agents/skills", markers: [".github/copilot-instructions.md", ".github/skills"], bin: "copilot" },
};

function onPath(bin) {
  const r = spawnSync(bin, ["--version"], { stdio: "ignore", timeout: 5000 });
  return !r.error;
}

export async function detectAgents(cwd, { probeBinaries = true } = {}) {
  const out = {};
  for (const [id, a] of Object.entries(AGENTS)) {
    let evidence = null;
    for (const m of a.markers) {
      if (await exists(path.join(cwd, m))) {
        evidence = `projeto: ${m}`;
        break;
      }
    }
    if (!evidence && probeBinaries && onPath(a.bin)) evidence = `binário '${a.bin}' no PATH`;
    out[id] = { ...a, detected: Boolean(evidence), evidence };
  }
  return out;
}

/** Which discovery directories to populate. `.agents/skills` is always populated. */
export function resolveTargets(detected, requested) {
  let ids;
  if (requested) {
    ids = String(requested).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const bad = ids.filter((i) => !(i in AGENTS));
    if (bad.length) throw new BootstrapError("BAD_AGENT", `Agente(s) desconhecido(s): ${bad.join(", ")}.`, `Válidos: ${Object.keys(AGENTS).join(", ")}`);
  } else {
    ids = Object.keys(AGENTS).filter((id) => detected[id].detected);
  }
  // Nothing detected: ship the universal dir plus Claude Code's (the most common) so no manual setup is needed.
  const claude = ids.includes("claude") || ids.length === 0;
  return { agents: ids, claudeLink: claude };
}
