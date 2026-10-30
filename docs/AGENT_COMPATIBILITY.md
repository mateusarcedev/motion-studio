# Matriz de Compatibilidade com Agentes — MOTION Studio

O MOTION Studio adota a especificação aberta **Agent Skills** (`SKILL.md`). Os motores de renderização, validação e empacotamento são binários agnósticos de agente que rodam no terminal (`node`, `python3`, `ffmpeg`).

> [!IMPORTANT]
> **Distinção de Níveis de Compatibilidade:**
> 1. **Descoberta de Skill:** O agente lê e interpreta as instruções em `SKILL.md`.
> 2. **Execução de Comandos:** O agente possui ferramenta de terminal/shell para invocar a CLI (`motion`).
> 3. **Acesso aos Renderizadores:** O ambiente do agente tem acesso ao Chromium e ao FFmpeg.
> 4. **Visualização de Resultados:** O agente consegue inspecionar PNGs gerados (visão multimodal).
> 5. **Ferramentas MCP:** O agente pode operar servidores de Model Context Protocol (ex: Blender MCP).

---

## Matriz Honestamente Auditada

| Agente / Ambiente | Descoberta de Skills | Execução CLI | Renderizadores | Visão de Imagens | Suporte MCP | Status Geral | Observações |
|---|---|---|---|---|---|---|---|
| **Antigravity (Google DeepMind)** | ✅ `.agents/skills/` | ✅ Terminal bash | ✅ Chromium / FFmpeg | ✅ Multimodal nativo | ✅ Ferramentas MCP | **Totalmente Compatível** | Ambiente de desenvolvimento e validação desta distribuição. |
| **Claude Code (Anthropic)** | ✅ `.claude/skills/` (symlinks) | ✅ Terminal bash | ✅ Chromium / FFmpeg | ✅ `View` tool | ✅ MCP nativo | **Totalmente Compatível** | Validado no monorepo e no projeto consumidor. |
| **OpenCode** | ✅ `.opencode/skills/` | ✅ Terminal bash | ✅ Chromium / FFmpeg | ✅ Multimodal | ⚠️ Variável | **Totalmente Compatível** | Testado com sucesso via CLI. |
| **Codex CLI / Cline** | ✅ `.agents/skills/` | ✅ Terminal | ✅ Via terminal | ✅ Suportado | ⚠️ Depende do client | **Validado** | Roda comandos do studio normalmente. |
| **Gemini CLI / Copilot CLI** | ✅ `.agents/skills/` | ✅ Terminal | ✅ Via terminal | ⚠️ Variável | ❌ Não suportado | **Operacional** | Opera via shell padrão. |
| **ChatGPT Web / Custom GPT** | ⚠️ Somente colando prompt | ❌ Sem terminal | ❌ Sem acesso local | ✅ Multimodal | ❌ Sem MCP | **Parcial (Somente Roteiro/Crítica)** | Pode escrever `BRIEF.md`, `STYLE.md` e código HTML, mas o render precisa ser executado por um humano ou runner. |
| **Cowork / OpenBot / Grok** | ⚠️ Manual | ⚠️ Variável | ⚠️ Não testado | ⚠️ Variável | ❌ Não testado | **Não Testado** | Não alegada compatibilidade sem validação em máquina real. |

---

## Como Adicionar Suporte a um Novo Agente

1. Se o agente suporta a especificação Agent Skills:
   - Configure o caminho de descoberta para `.agents/skills/`.
2. Se o agente procura uma pasta proprietária (ex: `.meuagente/skills/`):
   - Crie symlinks relativos apontando para `.agents/skills/<nome-da-skill>`.
3. Se o agente não possui terminal:
   - Utilize o conteúdo de `SKILL.md` como diretriz de sistema no prompt do agente.
   - Execute os comandos `motion render` e `motion qa` localmente no seu computador.
