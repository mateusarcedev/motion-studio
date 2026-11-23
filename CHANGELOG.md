# CHANGELOG — MOTION Studio

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

## [Unreleased] — Missão 21: Smart Reel Editor & Voice Studio (não publicada)

- **`motion edit`**: análise (loudness EBU R128, true peak, VAD, pausas, zumbido), transcrição local, plano de cortes inteligente (pausas, hesitações, repetições × ênfase, recomeços, decisões do operador, zoom cuts, punch-in), timeline `motion.timeline@1`, prévia/render H.264/AAC determinísticos, legendas cinéticas ASS + SRT/JSON, cards HTML→PNG, progresso em JSON. Ver `docs/REEL_EDITOR.md`.
- **Speech-to-Text agnóstico**: provedores (`faster-whisper` local em venv isolado; `srt-import`; `whisper-cpp`/`openai`/`gemini` declarados), `motion.transcript@1` com palavras, idioma, confiança, silêncios, revisão do modelo e correções com proveniência; `motion stt doctor|providers|setup`. Ver `docs/SPEECH_TO_TEXT.md`.
- **Voice Studio**: presets `natural`/`clean`/`studio`/`noisy-room`, notch de zumbido medido, expansor, compressão adaptativa, normalização linear com limitador oversampled, compensação de latência da cadeia, ducking, A/B com loudness casado.
- **`motion qa reel`**: sincronia de legendas no áudio final, caixa medida das legendas × safe zone × rosto, fala perdida em cortes, A/V, determinismo por hash de quadros/amostras.
- **`motion mcp`**: servidor MCP local stdio (sem dependências) com jobs em background.
- **Skills** `reel-editor` e `voice-studio`; `studio-director` roteia edição de vídeo existente. Pacote público de Skills: 13.
### Missão 21.1 — qualidade, CI e portabilidade

- **Voice Studio 2.0**: ganho no layout de entrega → expansor → um reajuste → limitador só para picos; compressor desligado em fonte já comprimida; `audio.speech-to-pause`; true peak medido e corrigido no AAC; A/B por trechos; bordas por energia > 4 kHz; `motion audio doctor`; DeepFilterNet só com SHA-256 conferido.
- **Captions 2.0**: remapeamento por energia; `captions.overlap` agora é **espacial** (o temporal virou `captions.page-overlap`); `captions.cps` com causa, `captions.contrast`, `captions.card-duplicate`; glossário do BRIEF; cor própria de palavra-chave.
- **Edição semântica**: bloco `motion-brief`, `opening`, cards que não antecipam nem ficam vazios.
- **Crítico**: parecer JSON gravado sem edição e verificado (`motion qa critic-*`).
- **QA mais estrito**: sem tolerância no true peak; LUFS ±0,5 (antes ±1) para `PASS`.
- **Limiares em `reel/presets.json`**; preset `institucional`.
- **CI** (`.github/workflows/ci.yml`), `init --skills-dir/--no-skills`, paridade MCP × CLI, `docs/COMPATIBILITY.md`.
- **Correções da homologação**: abertura movida não repete quadro da fonte nem divide página com a sequência; palavra cortada por pausa vira uma legenda só; card com título não some por 1 quadro ao ganhar chips; card que fecha o filme fica sólido.
- **Config**: `corrections` aceita `start`/`end`; `captions.breakBefore`/`noBreakBefore`.
- **Correção**: a suíte passa em clone limpo (stills regenerados no teste).

- **Core**: `render_static --transparent`; contrato de entrega aceita `.ass`.

## [1.1.1] — candidata de estabilização (não publicada)

Correção patch, compatível com a API existente. Os quatro pacotes são preparados juntos em `1.1.1`; a versão publicada `1.1.0` continua como `latest` até autorização explícita.

- **Delivery Integrity v1:** contrato por projeto (`delivery.contract.json`), manifesto versionado com SHA-256 integral, metadados de mídia e status por arquivo; pacote ZIP64 validado em disco (inventário, CRC, tamanhos, hashes, caminhos seguros e conteúdos omitidos). Metadados simbólicos e estruturas inválidas falham em JSON estruturado.
- **CLI:** `motion export` gera e valida a mesma entrega; `motion qa delivery --project <pasta> --zip <arquivo>` reabre e compara o pacote real. Arquivos obrigatórios ausentes causam `FAIL`; opcionais continuam opcionais.
- **Portabilidade:** verificação de recursos locais referenciados, fontes ausentes e metadados de licença/origem; fontes continuam dentro do projeto, sem aumento dos pacotes npm.
- **QA criativo:** contexto de mídia web/social para texto secundário, colisão e safe zones; contexto temporal opcional para pausas de leitura, cartelas estáticas e cenas escuras intencionais, sem desligar os detectores.
- **Skills e documentação:** narrativa demonstra resultado quando o brief pede; direção alterna hierarquia e composição de forma controlada. Atualizados guias de entrega, direção de arte e fontes.
- **Homologação/release:** não publicar, criar tag ou alterar `latest` automaticamente. Resultado e limitações serão registrados no relatório `RELEASE_1_1_1_REPORT.md`.

## [Não lançado] — correções encontradas na homologação pública do 1.1.0

Achados ao produzir a campanha real (`~/testes/motion-showcase`) só com os pacotes npm públicos. **Nenhuma versão nova foi publicada**; candidatas a 1.1.1.
- `motion render static --qa-visual`: a CLI não repassava a flag (o relatório saía sem `visual`); agora repassa também `--require-controller`.
- Overflow do render estático deixa de acusar `<br>`/`<wbr>` (sem extensão visual própria).
- `qa_viewports`: `ERR_ABORTED` de `<video preload="metadata">` não é mais contado como recurso com falha.
- `qa media`: detector de pretos usa `pix_th=0.03` — fundo escuro de marca (`#0A0E14`) deixa de ser "trecho preto"; preto real segue detectado.
- Proveniência de ícones Lucide passa a incluir `sha256` (antes `null`).
- Resolver: o conceito principal domina (conceitos secundários valem 60%): "revisão e verificação de qualidade" resolvia para ⭐ em vez de 👁; léxico ganhou `review` (revisão/crítico/auditoria).
- `motion qa frames --dark-mean=N` para marcas escuras.

## [1.1.0] — publicada no npm (latest)

Primeira versão menor após a 1.0.0: reúne a Missão 20 e a Missão 20.1. **Versão proposta 1.1.0** (SemVer: funcionalidades aditivas; contratos de API preservados; a única mudança de comportamento — render com erro deixa de ser "OK" — corrige um falso positivo e tem saídas explícitas).

### Node.js suportado
- **`engines.node` passa de `>=18` para `>=20`** nos quatro pacotes. O Playwright (`^1.64`) sempre exigiu Node ≥ 20; em Node 18 nenhum render funcionava, então não há regressão real — a declaração é que estava errada. Suíte validada em Node 20.20, 22.23 e 24.16; Node 18.20 reprova (Playwright).

### Missão 20.1 — Ecossistema visual de terceiros
- **Visual Asset Provider Registry** (`defineProvider`, `createProviderRegistry`, `createDefaultRegistry`): novos providers sem alterar o resolver. `session.asset()` escolhe o tipo (ícone, ícone animado, logo, personagem, ilustração, Lottie) e a fonte automaticamente; `session.icon()` segue igual.
- Providers: **Developer Icons** (326 logos, por nome/alias, ciente de marcas), **Humaaans** (10 personagens, atribuição CC-BY registrada), **AnimateIcons** (adapter: formas Lucide + presets determinísticos; componentes React em tempo real não são seekable), **Lottie/dotLottie** (validação sem expressões/assets externos, runtime lottie-web light, render determinístico), **Iconify** (opt-in, licença por coleção, cache com hash), **pacotes locais** (`motion assets import`, ex.: LS Graphics com licença declarada pelo usuário).
- Licenciamento: `assessLicense` (código ≠ assets; bloqueia NC/ND/SA/GPL/desconhecida), `credits()`, proveniência com SHA-256, `createAssetCache`.
- `@technomanceer/motion-core/lottie` e `/svg-motion` com `wobble`/`pulse`; `/providers`.
- CLI: `motion assets pick|providers|import`.
- Skills (8) passam a usar `assets pick` e a incluir créditos. `scripts/release-gate.mjs` (gate de publicação sem publicar).
- Correção: SVGs de ferramentas de design (IDs duplicados/não usados) são limpos na otimização.

### Missão 20: Production Reliability & Visual Intelligence

Nenhum pacote foi publicado. Mudanças são aditivas; contratos públicos existentes preservados (veja "Compatibilidade").

### Confiabilidade de produção
- **M-009** `motion doctor` valida a revisão do Chromium fixada pelo Playwright e executa *smoke test* real; diferencia ausente / revisão incompatível / dependências de sistema / falha de inicialização.
- **M-010** `motion render frames --sample-frames=0,120,240-250` (e `sampleFrames` na API) com validação de índices, intervalos e duplicatas; pedido = produzido.
- **M-011** imagens e recursos com falha (404, rede, bytes inválidos) são detectados; opcionais via `data-optional`/`--optional-assets`. Corrigido travamento do renderer em imagem já falha (`complete` + largura 0).
- **M-012** erros de JavaScript, falha de import de módulo, controlador ausente ou lançando exceção ⇒ `status: "FAIL"` (exit 4). Os renderers agora servem `/@motion/` e injetam *import map* para `@technomanceer/motion-core/frame` e `/svg-motion` (causa provável do `Failed to resolve module specifier`).
- Códigos de erro `MOTION_*` estruturados (`MotionError`, `ERROR_CODES`).

### Visual Asset Intelligence
- Resolver semântico PT/EN de ícones (`createAssetSession`, `searchIcons`), estilo travado por produção, fallback geométrico, proveniência/licença.
- Icon Library Manager: Lucide 1.76 (ISC) offline + pacotes Iconify do usuário + fetcher Iconify opcional com cache e sanitização.
- SVG Design Studio: validação/sanitização (SVGO 4, lista de permissão), otimização com prefixo de IDs, rasterização, 6 componentes vetoriais com tokens da marca.
- SVG Motion Engine (`@technomanceer/motion-core/svg-motion`): draw, reveal, pop, orbit, parallax, morph, gradient-shift, color — puro e seekable.
- CLI: `motion assets`, `motion svg`.

### QA automatizado
- Estados `PASS/WARN/FAIL/BLOCKED/NOT_TESTED` (`createQaReport`); `motion qa media|frames|precheck`; `render static --qa-visual`.
- Skills (studio-director, motion-director, carousel/story/feed-studio, shorts-director, explainer-motion, web-director) passam a usar a infraestrutura; `docs/ART_DIRECTION.md`, `docs/QA.md`, `docs/VISUAL_INTELLIGENCE.md`.

### Compatibilidade
- Novas dependências de runtime em `motion-core`: `svgo` (MIT). Novos assets embutidos: lottie-web light (MIT), Developer Icons (MIT, marcas dos titulares), Humaaans (subconjunto). `lucide-static` é apenas devDependency (gera o pacote offline).
- Mudança de comportamento intencional: renders com erro de JS / controlador ausente / imagem essencial quebrada deixam de retornar sucesso. Composições estáticas legítimas em `render frames` usam `--allow-no-controller`; imagens decorativas, `data-optional`.
- `creative-core/renderers/{render_static,render_frames,qa_viewports}.mjs` viram wrappers do código canônico em `packages/motion-core`.

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
