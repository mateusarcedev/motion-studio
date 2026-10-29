# Compatibilidade com Agentes — status honesto

Fonte de verdade: `.agents/skills/` (padrão Agent Skills). Todos os **motores**
(creative-core: renderer Playwright/Chromium, validators, exporters, galeria) rodam por
**CLI** (`node` / `python3`) — independentes de qualquer agente.

| Agente | Descoberta de skills | Motores (CLI) | Status |
|---|---|---|---|
| Claude Code | ✅ `.claude/skills/` (symlinks) | ✅ terminal | testado neste repo |
| OpenCode | ✅ `.opencode/skills/` + `.agents/skills/` | ✅ terminal | testado neste repo |
| Codex CLI | ✅ `.agents/skills/` | ✅ terminal | descoberta conforme skills.sh; motores rodar |
| Antigravity | ✅ `.agents/skills/` | ✅ terminal | idem |
| Copilot / Gemini CLI / Cline etc. | ✅ `.agents/skills/` (skill.sh paths) | ✅ terminal | idem |
| ChatGPT (custom GPT / sem terminal) | ⚠️ **Instruções portáveis**: cole o conteúdo de `SKILL.md` no prompt do agente; geração e crítica funcionam, MAS o render PNG exige terminal (ou humano executa os comandos CLI e devolve os PNGs) | parcial | **não testado — sem teste nenhum não há compat alegada** |
| Cowork / OpenBot / GrokBot | ⚠️ idem ChatGPT — avaliar caso a caso conforme acesso real ao filesystem/terminal | parcial | não testado |

## Regras desta compatibilidade

1. **Nada de compatibilidade declarada sem teste.** A coluna Status é a única verdade.
2. Agentes sem terminal podem operar **os papéis criativos** (brief, arte, storyboard, crítica)
   com SKILL.md como instrução; o render é executado pelo operador humano ou por outro agente
   com terminal. Isso é importação documentada, não integração fantástica.
3. Importação manual (qualquer lugar): copie a pasta da skill; o contrato mínimo é um `SKILL.md`.

## Como integrar um agente novo

1. Descoberta: symlink da pasta `.agents/skills/<nova-skill>/` no caminho de skills do agente.
2. Sem suporte a skills de arquivo: aponte as instruções customizadas do agente para o
   conteúdo de `SKILL.md` (ex. `carousel-studio`).
3. Confirme que o agente pode invocar CLI (`node`, `python3`, `ffmpeg`). Se não puder,
   registre-o como "parcial" aqui.
4. Teste com uma peça real (ex. carrossel de 3 slides) **antes** de marcar ✅ nesta tabela.
