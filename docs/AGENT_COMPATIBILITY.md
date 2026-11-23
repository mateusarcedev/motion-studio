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
| **OpenCode** | ✅ `.agents/skills/` e `.claude/skills/` | ✅ Terminal bash | ✅ Chromium / FFmpeg | ✅ Multimodal | ⚠️ Variável | **Totalmente Compatível** | Testado com sucesso via CLI. |
| **Codex CLI / Cline** | ✅ `.agents/skills/` | ✅ Terminal | ✅ Via terminal | ✅ Suportado | ⚠️ Depende do client | **Validado** | Roda comandos do studio normalmente. |
| **Google Antigravity (`agy`)** | ✅ `.agents/skills/` | ✅ Terminal | ⚠️ Não testado | ⚠️ Não testado | ⚠️ Não testado | **Descoberta validada** | Descoberta testada em 2026-11-19 com controle negativo; demais níveis não testados. |
| **Gemini CLI / Copilot CLI** | ⚠️ `.agents/skills/` (só docs oficiais) | ⚠️ Não testado | ⚠️ Não testado | ⚠️ Não testado | ⚠️ Não testado | **Não testado** | Não instalados no ambiente de validação; Gemini CLI possivelmente descontinuado. |
| **ChatGPT Web / Custom GPT** | ⚠️ Somente colando prompt | ❌ Sem terminal | ❌ Sem acesso local | ✅ Multimodal | ❌ Sem MCP | **Parcial (Somente Roteiro/Crítica)** | Pode escrever `BRIEF.md`, `STYLE.md` e código HTML, mas o render precisa ser executado por um humano ou runner. |
| **Cowork / OpenBot / Grok** | ⚠️ Manual | ⚠️ Variável | ⚠️ Não testado | ⚠️ Variável | ❌ Não testado | **Não Testado** | Não alegada compatibilidade sem validação em máquina real. |

---

## Smart Reel Editor / Voice Studio / STT (Missão 21, 2026-11-22)

| Cliente | Skills `reel-editor`/`voice-studio` | CLI `motion edit` / `motion stt` | MCP `motion mcp` | Status |
|---|---|---|---|---|
| **Claude Code** | ✅ redescobertas na sessão de implementação (`.claude/skills/` → `.agents/skills/`) | ✅ produção real executada pelo agente via terminal (analyze → transcribe → plan → preview → render → qa reel → export) | ✅ `claude -p --mcp-config` (stdio) conectou ao `motion mcp`, chamou `motion_edit_presets` e respondeu corretamente (2026-11-22); demais ferramentas cobertas pelo harness stdio dos testes | **CLI + MCP testados** |
| **OpenCode** | ⚠️ symlinks criados em `.opencode/skills/`; descoberta não reexecutada | ⚠️ não executado | ⚠️ não testado | **Não testado** |
| **Codex CLI** | ⚠️ `.agents/skills/` (mesmo padrão das demais); não reexecutado | ⚠️ não executado | ⚠️ não testado | **Não testado** |
| **Gemini CLI / Antigravity** | ⚠️ Gemini CLI não instalado; Antigravity não reexecutado | ⚠️ | ⚠️ | **Não testado** |
| **Clientes web (claude.ai, ChatGPT…)** | — | ❌ sem terminal local | ❌ sem ponte/conector para o servidor stdio local | **Sem suporte** — não alegado |

O motor não depende de visão do agente: transcrição, medição de áudio, sincronia de legenda e
safe zone são medidas pela CLI. Qualquer cliente com terminal ou MCP stdio usa o mesmo pipeline.

---

## Como Adicionar Suporte a um Novo Agente

1. Se o agente suporta a especificação Agent Skills:
   - Configure o caminho de descoberta para `.agents/skills/`.
2. Se o agente procura uma pasta proprietária (ex: `.meuagente/skills/`):
   - Crie symlinks relativos apontando para `.agents/skills/<nome-da-skill>`.
3. Se o agente não possui terminal:
   - Utilize o conteúdo de `SKILL.md` como diretriz de sistema no prompt do agente.
   - Execute os comandos `motion render` e `motion qa` localmente no seu computador.
