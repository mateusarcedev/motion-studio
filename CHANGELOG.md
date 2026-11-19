# CHANGELOG — MOTION Studio

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

## [1.0.0] — não publicado (preparado)

Primeira versão estável. Os quatro pacotes (`motion-core`, `motion-studio-skills`, `motion-cli`, `motion-studio`) estão em `1.0.0`, com dependências internas exatas e nenhuma dependência prerelease. Nenhuma RC publicada foi alterada.

### Instalador universal (Missão 19.7–19.9)
- Novo pacote `@technomanceer/motion-studio` (executável `motion-studio`): `npx @technomanceer/motion-studio init`. (`motion-studio` sem escopo pertence a outro projeto.)
- Bootstrap único compartilhado em `@technomanceer/motion-cli` (`motion init` e o instalador usam o mesmo código): detecção de gerenciador, instalação local exata sem scripts, Skills (11 oficiais, sha256 verificado), links Claude Code, manifesto `.motion/install.json`, verificação e diagnóstico.
- CLI passa a depender das Skills (antes: peer opcional, `init` não instalava nenhuma Skill). Perfil padrão agora é `all`.
- Idempotente, não destrutivo (conflitos preservados), recuperação de instalação interrompida, falha de rede com exit 2.
- Removido o adaptador duplicado `.opencode/skills` (OpenCode, Copilot e Gemini leem `.agents/skills`).
- `motion doctor` revalida a instalação.

## [1.0.0-rc.2] — 2026-10-30

### Integração Gabriel Greco Skills & Perfil Interactive (Missão 10)

#### Novidades & Melhorias
- **Integração de Skills da Comunidade (`gabrielgreco1/skills`):**
  - Integração arquitetural das especialidades `aula-interativa`, `motion-designer` e `ui-humanizer` auditadas no commit `9cf15be76c960c94edddcc78fc5fa237e0778c44`.
  - Política de conformidade de licença: código de terceiros não é redistribuído nos tarballs npm; usuários instalam via `npx skills add gabrielgreco1/skills --skill <name>`.
  - Catálogo de integrações externas exportado em `motion-studio-skills` (`EXTERNAL_INTEGRATIONS`).
- **Novo Perfil de Instalação `interactive`:**
  - Adicionado suporte a `--profile=interactive` no `motion init`, incluindo os diretores essenciais e ferramentas de diagramação, apresentações e design.
- **CLI (`motion-cli`):**
  - Novo gerador de scaffolds: `motion create lesson <nome>` para criação rápida de aulas interativas autocontidas.
  - Subcomando `motion list` exibe catálogo de especialidades e integrações da comunidade.
  - Subcomando `motion doctor` verifica status de instalação das skills e ferramentas opcionais.
- **Roteamento de Diretores:**
  - `studio-director` despacha entregáveis pedagógicos para `aula-interativa`.
  - `motion-director` integra `motion-designer` para refinamento de showreels e animações cinéticas de produto.
  - `web-director` integra `ui-humanizer` para portão de revisão visual e detecção de clichês de IA.
- **Entregáveis Reais de Demonstração & QA:**
  - `projects/example-state-machine-lesson`: Aula interativa autocontida sobre Máquinas de Estados Finitos com grafo SVG, simulador dinâmico, feedback causal e teste Playwright (100% aprovado).
  - `projects/example-motion-designer`: Teaser vertical 9:16 (1080×1920) a 30 FPS CFR com bandas HEAD/VIS/CAP, áudio sintetizado e contact sheet.
  - `projects/ui-humanizer-audit`: Laudo de auditoria visual da landing page com detector `audit.py` e evidências multi-viewport.
  - Ambos os projetos registrados na galeria persistente (`gallery.json`) com status `draft`.
- **Landing Page Oficial (`motion-landing`):**
  - Adicionado Gabriel Greco (@gabrielgreco1) como 15º criador do ecossistema open-source com avatar do GitHub e badge de proveniência.
  - QA multi-viewport executado com aprovação total (5/5 telas PASS: mobile-s, mobile, tablet, desktop, wide).
- **Suíte de Testes:**
  - Adicionado Teste 11 à suíte de regressão (`tests/suite.test.mjs`), cobrindo perfil `interactive`, catálogo e CLI (11/11 testes PASS).

## [1.0.0-rc.1] — 2026-10-30

### Release Candidate e Preparação Pública (Missão 08)

#### Novidades & Melhorias
- **Perfis de Distribuição Seletiva de Skills (`--profile`):**
  - Implementado sistema de perfis no `motion init` (`core`, `web`, `motion`, `social`, `3d`, `blender`, `all`).
  - O perfil padrão `core` instala apenas os 6 diretores e contratos compartilhados essenciais (`studio-director`, `motion-director`, `web-director`, `brand`, `design`, `design-system`).
  - Funções `SKILL_PROFILES` e `resolveSkillsForProfile()` exportadas em `motion-studio-skills`.
- **Otimização do Pacote de Skills (`motion-studio-skills`):**
  - Prunagem de caches de mídia (vídeos MP4 de terceiros, PDFs volumosos e áudios MP3 pesados) via `.npmignore`.
  - Tamanho do tarball reduzido de 148.4 MB para 44.1 MB (~70% de economia), preservando 100% dos códigos de instrução e prompts.
- **QA Multi-Viewport & Acessibilidade:**
  - Suporte nativo a caminhos de arquivos relativos e absolutos no `qa_viewports.mjs` via protocolo `file://`.
  - Resolução dinâmica de executável Chromium no motor de QA.
  - Ajuste de acessibilidade no template de website do `motion create website` para garantir alvos de toque mínimos de 44×44px (WCAG 2.5.5 / Apple HIG).
- **CLI & Flags:**
  - Correção de precedência para `-v` / `--version` na CLI.
  - Exibição de catálogo de perfis no comando `motion list`.
- **Auditoria de Segurança & Verificação de Registro NPM:**
  - Varredura de credenciais confirmou zero tokens ou segredos expostos.
  - Nomes de pacote `motion-cli`, `motion-core` e `motion-studio-skills` auditados e confirmados disponíveis no registro público npm (HTTP 404).
- **Expansão da Suíte de Testes:**
  - Adicionado teste 10 validando a integridade dos perfis e resolução de dependências seletivas (10/10 testes passando).

## [1.0.0] — 2026-10-30

### Primeira Distribuição Instalável (Missão 07)

#### Novidades
- **Arquitetura Modular de Pacotes (`packages/`):**
  - `motion-core`: Motores de captura estática, batch de frames determinísticos, montador FFmpeg CFR 30fps, QA multi-viewport, validadores e exportadores.
  - `motion-studio-skills`: Catálogo das 50 Agent Skills com instalador automatizado para `.agents/skills`, `.claude/skills` e `.opencode/skills`.
  - `motion-cli`: Interface de linha de comando (`motion`) com subcomandos reais para `init`, `doctor`, `list`, `create`, `preview`, `render`, `export` e `qa`.
- **Batch Determinístico de Frames (`render_frames.mjs`):**
  - Implementação completa do motor batch (1 instância do Chromium, N frames determinísticos) com injeção de estado `__onFrame__`.
- **Resolução Dinâmica do Chromium:**
  - `resolveChrome()` aprimorado para detectar dinamicamente `chromium.executablePath()`, cache local `chromium-*` ou binários do sistema operacional.
- **Suíte de Testes Automatizados (`tests/suite.test.mjs`):**
  - 9 testes automatizados cobrindo diagnóstico, render estático, determinismo bit-a-bit por MD5, montagem de vídeo, validação de carrossel, manifesto SHA-256 e isolamento de galeria.
- **Projeto Consumidor Isolado (`kronos-consumer-next`):**
  - Teste de produção multiformato completo em projeto Next.js externo sem symlinks para o monorepo.
  - Landing page com elemento 3D auditada e aprovada em 5 viewports (mobile-s, mobile, tablet, desktop, wide).
  - Vídeo promocional de 15 segundos (450 frames @ 30fps MP4) com contact sheet e verificação de frames.
  - Carrossel de 5 slides em 1080×1350 e 2160×2700 com manifesto e pacote ZIP.
- **Documentação de Distribuição (`docs/`):**
  - `INSTALLATION.md`, `QUICK_START.md`, `CLI_REFERENCE.md`, `SPECIALTIES.md`, `AGENT_COMPATIBILITY.md`, `LICENSES.md`, `ADDING_SKILLS.md`, `PRODUCTION_GUIDE.md`, `TROUBLESHOOTING.md`, `EXAMPLES.md`.
