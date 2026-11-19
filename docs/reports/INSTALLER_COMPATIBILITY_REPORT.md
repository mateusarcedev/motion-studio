# Relatório de Compatibilidade — Instalador Universal (Missão 19.7–19.9)

Data: 2026-11-19 · Node 24.16.0 · npm 11.13.0 · WSL2 Linux · **nada foi publicado, commitado ou enviado**.

## 1. Auditoria (estado inicial)

| Item | Achado |
|---|---|
| Nome `motion-studio` no npm | **Ocupado** (popmotion/Matt Perry, v2.2.0, licença própria). Decisão do dono: usar `@technomanceer/motion-studio` (livre no registro). |
| Versões públicas | `motion-core`, `motion-cli`, `motion-studio-skills`: todas `1.0.0-rc.4` (`latest` e `next`) |
| `motion init` (rc.4) | Testado em diretório limpo com tarballs: cria config, mas **não instala nenhuma Skill** (Skills eram peer dependency opcional) |
| Perfil padrão `core` | Só 3 das 11 Skills públicas |
| Idempotência (rc.4) | `init` aborta se `motion.config.json` existe (exige `--force`) |
| `.opencode/skills` (rc.4) | Duplicava Skills: OpenCode, Copilot e Gemini já leem `.agents/skills` |
| Riscos | Duplicação (`.opencode` + `.agents`), recursão (rodar dentro do próprio repo), sobrescrita de Skills do usuário |

## 2. Descoberta de Skills por agente

Fontes: documentação oficial de cada agente (consulta em 2026-11-19).

| Agente | Caminhos de projeto | Teste real neste ambiente |
|---|---|---|
| Claude Code 2.1.328 | `.claude/skills` | ✅ **11/11** no evento `init` (inclui o marcador exclusivo `thermo-nuclear-code-quality-review`) |
| OpenAI Codex 0.169.0 | `.agents/skills` (symlinks ok) | ✅ encontrou `thermo-nuclear…`, `story-studio`, `studio-director` num diretório só com `.agents/skills`; controle em diretório vazio respondeu `NONE` |
| OpenCode 2.2.5 | `.opencode/skills`, `.claude/skills`, `.agents/skills` | ✅ **10/11** listadas e usáveis. `thermo-nuclear-code-quality-review` tem `disable-model-invocation: true` e o OpenCode não a expõe ao modelo; controle com a flag removida → `YES`. Comportamento por design, Skill não alterada |
| Google Antigravity (`agy` 1.5.11) | `.agents/skills` (descoberto empiricamente; docs não consultadas) | ✅ listou `story-studio` e `studio-director` num diretório só com `.agents/skills`; controle em diretório vazio → `NONE`. `thermo-nuclear…` oculta pela flag `disable-model-invocation: true` (com a flag removida → `YES`), igual ao OpenCode |
| Gemini CLI | `.gemini/skills` ou alias `.agents/skills` | ⚠️ **Não testado** (não instalado; possivelmente descontinuado em favor do Antigravity, não confirmado). Só documentação oficial |
| GitHub Copilot | `.github/skills`, `.claude/skills`, `.agents/skills` | ⚠️ **Não testado** (não instalado). Só documentação oficial |

Cada teste "real" fez uma chamada mínima de modelo e perguntou quais Skills o agente enxerga. Claude Code foi verificado pela lista `skills` do evento `init`, sem depender da resposta do modelo.

Implementação: sempre `.agents/skills` (Codex, Gemini, OpenCode, Copilot); `.claude/skills` (links relativos) só para Claude Code ou quando nenhum agente é detectado. Nada é escrito em `AGENTS.md`/`CLAUDE.md`/configs.

## 3. Homologação (checklist da missão)

| # | Cenário | Resultado |
|---|---|---|
| 1 | Diretório vazio | ✅ standalone (Skills + config, sem package.json/node_modules); com `--with-package-json` instala CLI+Core+Skills |
| 2 | Repositório Node existente | ✅ deps `devDependencies` exatas; package.json preservado (formatação reescrita pelo npm) |
| 3 | Sem `package.json` | ✅ modo standalone explícito, aviso impresso |
| 4 | Reexecução | ✅ `inalteradas 11`, árvore de Skills idêntica, config preservada |
| 5 | Falha de rede | ✅ exit 2, nenhuma Skill/config criada, manifesto `in-progress`; rerun conclui |
| 6 | Pacote Skills indisponível | ✅ `SKILLS_UNAVAILABLE`, exit 1, diretório intocado |
| 7 | Conflito de configuração | ✅ config válida preservada; JSON inválido aborta sem tocar; Skill do usuário preservada; `--force` substitui com backup |
| 8 | Compatibilidade de versões | ✅ plano `ok/install/newer`; manifesto de Skills vs pacote validado; adulteração (sha256) rejeitada |
| 9 | Descoberta real pelos agentes | ✅ Claude Code, Codex, OpenCode, Antigravity (ver §2); ⚠️ Gemini CLI/Copilot não testados |
| 10 | Comandos CLI | ✅ `motion doctor`, `motion create video`, `motion init`, `motion --version` |
| 11 | Render de vídeo simples | ✅ `motion render project` → MP4 h264 1920×1080 30 fps, 450 frames |
| 12 | Briefing criativo com Skill oficial | ⚠️ **Não executado de ponta a ponta.** Provado apenas que o agente enxerga a Skill (item 9). Rodar um briefing completo da `motion-director` exige aprovações humanas do pipeline (BRIEF/STYLE) |

Testes automatizados: `tests/installer.test.mjs` (15 casos) + suíte existente (46 testes) passam. Os testes de instalação em ambiente limpo (cenários 1–3, 11) foram executados à mão em diretórios temporários a partir de tarballs reais (`npm pack`).

### Limitações da homologação
- **Registro:** o `npx` contra o registro público não pôde ser exercitado porque rc.5 não está publicado. Tentei um registro local (verdaccio) e o ambiente bloqueou; usei então uma árvore equivalente à do `npx` (`npm install` do tarball do instalador com `overrides` para o CLI rc.5) e a variável `MOTION_STUDIO_SPECS` para apontar o CLI rc.5 dentro do projeto de teste. **A homologação final precisa ser repetida após a publicação** (checklist).
- `pnpm`, `yarn` e `bun`: detecção e argumentos de instalação cobertos por teste unitário, mas **instalação real não exercitada** (não verificado neste ambiente).
- Windows/macOS não testados (links simbólicos têm fallback para cópia no EPERM).

## 4. Decisões e comportamentos a conhecer
- Motores obrigatórios ausentes (FFmpeg, Chromium…) **não** derrubam o `init` (exit 0 com aviso); use `--strict` para exit 3. Nada pesado é instalado sem consentimento.
- `package.json` do projeto é reescrito pelo gerenciador ao adicionar dependências (comportamento normal do npm).
- Em um diretório sem agente detectado, `.claude/skills` também é criado.

## 5. Revalidação 1.0.0 (Missão 19.9)

| Gerenciador | Instalação real | Resultado |
|---|---|---|
| npm 11.13.0 | ✅ | CLI, Core e Skills 1.0.0 exatos; 11 Skills; rerun `inalteradas 11` |
| pnpm 12.15.0 | ✅ | idem (exigiu `overrides` em `pnpm-workspace.yaml` só porque o 1.0.0 ainda não está no registro) |
| Yarn | ❌ **não testado** (não instalado; instalar ferramenta nova fora do escopo) | só detecção + argumentos cobertos por teste unitário |
| Bun | ❌ **não testado** (não instalado) | idem |

Claude Code redescobriu 11/11 Skills na instalação 1.0.0. Codex, OpenCode e Antigravity não foram reexecutados: as Skills são byte a byte as mesmas da rc.4 (sha256 em `public-skills.json`); só o número de versão do manifesto mudou. Gemini CLI e Copilot seguem não testados.
