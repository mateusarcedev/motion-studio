# Catálogo de Integrações — mente aberta, adição avaliada

Fonte: `motion_resources_catalog.yaml` (25 recursos). Política: inclusão ≠ instalação ≠ autorização de redistribuição. Evidências coletadas **2026-10-28** via GitHub API (`api.github.com/repos/<repo>/license`) e `raw.githubusercontent.com` — cada linha cita a evidência. Estados: `candidato_nao_integrado · verificado · aprovado · integrado · bloqueado`.

Distinção obrigatória: **gratuito** (sem custo, pode ter restrições de uso) ≠ **open source** (licença OSI aprovada, redistribuição normalmente ok) ≠ **source available** (código visível, licença proprietária com restrições).

## Matriz (25 registros, com evidência)

| # | id | Evidência (licença confirmada) | Uso comercial | Redistribuição | Deps | Maturidade | Segurança | Status | Ação votada |
|---|---|---|---|---|---|---|---|---|---|
| 1 | blender | licença GPL-family (repo oficial; ferramenta separada) | ✓ | ferramenta local, não embutida no repo; arquivos de cena gerados são livres | grande | 21k★, ativo d+28 | própria | **verificado** | ferramenta local opcional; nunca dependência do repo |
| 2 | threejs | MIT (GH API ✓ 117k★) | ✓ | ✓ incl. vendor no HTML | nenhum | ativo d+28 | própria | **verificado** | vendor sob demanda (peça 3D); CDN se online |
| 3 | numpy | BSD-3-Clause (LICENSE.txt lido ✓) | ✓ | ✓ | CBLAS etc. empacotado | 33k★ | própria | **verificado** | on-demand (simulações) |
| 4 | numba | BSD-2-Clause (GH API ✓ 11k★) | ✓ | ✓ | LLVM (pesada) | 11k★, ativo | própria | **candidato_nao_integrado** | só se simulação real precisar |
| 5 | gsap | **sem LICENSE no repo** `GreenSock/GSAP` master; "Standard No-Charge License" nos arquivos — *gratuito, não open source* | ✓ peças finais | ✓ código nos produtos finais | nenhum | 29.9k★ (último push 04/2026; desenvolvimento sob Webflow) | própria | **verificado** | runtime permitido em composição HTML entregue; ❌ NUNCA usar GSAP dentro de "editor visual" do estúdio (restrição de concorrência da licença) |
| 6 | remotion | LICENSE.md lido: Free (indivíduo/≤3 pessoas) vs **Company License** paga | ✓ no escopo solo (Free) | prohibido: redistribuir derivado como produto | react | 68k★, ativo | própria | **verificado** | primário se/video quando o projeto for React; instalar sob demanda; ❌ se o estúdio virar serviço de render para terceiros → contrato pago |
| 7 | puppeteer | Apache-2.0 (GH API ✓ 95k★) | ✓ | ✓ | chromium | 95k★ | própria | **verificado** | ❌ não instalar — Playwright já cobre; duplicação proibida pela política |
| 8 | tonejs | MIT (GH API ✓ 14.8k★) | ✓ | ✓ | nenhum | ativo | própria | **verificado** | opcional p/ cues de áudio em HTML |
| 9 | scipy | BSD-3-Clause (GH API ✓) | ✓ | ✓ | moderadas | 15k★ | própria | **verificado** | on-demand |
| 10 | pedalboard | **GPL-3.0** (GH API ✓) + JUCE/VST | ✓ | ⚠️ copyleft: embutir no repositório distribuído contamina | pybind, JUCE | 6.4k★, Spotify | própria | **verificado** | somente como ferramenta ISOLADA em venv próprio; nunca no `package.json` nem em código redistribuído |
| 11 | pyloudnorm | MIT (GH API ✓ 786★) | ✓ | ✓ | numpy | ok | própria | **verificado** | FFmpeg `loudnorm` (EBU R128) já cobre o caso principal → não instalar |
| 12 | faster_whisper | MIT (GH API ✓ 26k★); pesos de modelo têm termos próprios por arquivo | ✓ | código ✓; pesos = termos próprios | ctranslate2 | ativo d+25 | própria | **verificado** | instalar sob demanda (legendas com timestamps); checar termo dos pesos usados |
| 13 | opencv | Apache-2.0 (GH API ✓ 91k★) | ✓ | ✓ | modestas | 91k★ | própria | **verificado** | on-demand para detecção de frames anômalos |
| 14 | pillow | MIT-CMU/HPND family ("MIT-" no LICENSE ✓) | ✓ | ✓ | zlib/jpeg | 13.9k★ | própria | **verificado** | aprovado; contact sheet do estúdio usa HTML (zero-dep), Pillow só se raster direto for exigido |
| 15 | ffmpeg | build Ubuntu: LGPL/GPL mix (8.0.1-3ubuntu2, confirmado no PATH) | ✓ | binário distribuído → incluir licença correspondente | sistema | essencial, ativo | própria | **integrado** | em produção (v1); documentar build usado |
| 16 | reui | global não confirmada (LICENSE 404); componentes free MIT, templates premium | ✓ nos componentes MIT | variável — componente a componente | react | ok | confirmar | **candidato_nao_integrado** | referência; confirmar licença item a item antes de copiar |
| 17 | 21st | ToS existe (página renderiza no cliente); scraping proibido | variável | ❌ scraping e redistribuição de previews/metadata | — | marketplace | própria | **bloqueado** para scraping | descoberta somente por meio oficial (API/MCP); ❌ nunca `curl` do marketplace |
| 18 | spectrum_ui | **Apache-2.0** (GH API ✓ 1.5k★) — catálogo estava certo | ✓ | ✓ preservando NOTICE | react/tailwind | 1.5k★ | própria | **verificado** | aprovado component_only |
| 19 | reactdrops | **source available proprietário** — produtos finais ok; como UI kit/registry/template ❌ sem permissão | ✓ produto final | ❌ redistribuir como kit | react | ok | própria | **verificado** (restrição) | referência + componentes avulsos; ❌ nunca como kit/registry/galeria sem autorização |
| 20 | bencho | global não confirmada (só marketing, sem LICENSE/LEGAL acessível) | ? | ? | react | 151 blocos | confirmar | **candidato_nao_integrado** | referência; confirmar cada componente na origem |
| 21 | transitions_dev | LICENSE master lido: pessoal+comercial ilimitado, modificação e embed ok; tooling **MIT**; uma limite: não redistribuir biblioteca como produto concorrente | ✓ | ✓ embed nas peças; ❌ como "biblioteca" | nenhum (CSS) | 5.8k★, Jakub Antalik | própria | **verificado** | aprovado como referência/knowledge; cópia permitida em peças, nunca como pacote |
| 22 | feralui | global não confirmada (site client-rendered, sem licença acessível) | ? | ? | react | experimentos | confirmar | **candidato_nao_integrado** | referência apenas || 23 | kinetics | **sem LICENSE** no repo (GH API license 404, 626★) | ? | ❌ não copiar | react | 626★ | confirmar | **candidato_nao_integrado** | nenhuma cópia; referência visual + exercícios equivalentes feitos por nós |
| 24 | 8bitcn | MIT (GH API ✓ 2k★) | ✓ | ✓ | react/tailwind | 2k★ | própria | **verificado** | aprovado (baixa prioridade, estética retrô) |
| 25 | evilcharts | MIT (GH API ✓ 3.1k★) | ✓ | ✓ | react | 3.1k★ | própria | **verificado** | aprovado p/ infográficos/gráficos animados (feed/carrossel) |

## Registro

| Nome | URL | Versão | Licença | Categoria | Finalidade | Status | Consumido por |
|---|---|---|---|---|---|---|---|
| playwright-core | https://github.com/microsoft/playwright | 1.64.1 | Apache-2.0 | renderização | HTML→PNG/Chromium (execução) | **integrado** | creative-core (todos os tracks) |
| ffmpeg | https://ffmpeg.org | 8.0.1 (Ubuntu) | LGPL/GPL mix (build) | renderização/export | frames→MP4, áudio | **integrado** | motion-director, story-studio |
| blender | ↓ | ↓ | GPL (ferramenta local) | 3D | rend/config | **verificado** | on-demand |
| demais | — | — | — | — | — | ver matriz | sob demanda |

## Erros registráveis (memory)

1. "gratuito" ≠ "open source" ≠ "source available" → nunca colapsar colunas.
2. Marketplace de design → licença é **por componente**, não pela marca.
3. Repos sem LICENSE no mono (`kinetics`, `gsap master`) → não copiar até confirmar.
4. GPL libs → ferramenta isolada, nunca dependência do repositório-distribuível.
5. Confirmação de licença sempre com evidência (URL + data +: API/linha citada).

---

# Lote 3 — Catálogo Incremental (20 ferramentas + 14 referências + extras)

Coletado **2026-10-29** via GitHub API + raw.githubusercontent.com. Fontes: `MOTION_INTEGRACAO_LOTE_03_REFERENCIAS.yaml` + missão. Deduplicados com catálogo base (Remotion, HyperFrames, Three.js, Tone.js, faster-whisper, FFmpeg já presentes).

## Matriz Lote 3 — Ferramentas (20 únicas)

| # | id | Evidência (licença confirmada) | Uso comercial | Redistribuição | Deps | Maturidade | Status | Ação votada |
|---|---|---|---|---|---|---|---|---|
| 26 | animejs | MIT (GH API ✓ 74k★, pushed 08/2026) | ✓ | ✓ | nenhum | 74k★, ativo | **verificado** | vendor on-demand (HTML/CSS/JS animações leves); CDN ok |
| 27 | react-spring | MIT (GH API ✓ 29k★, pushed 10/2026) | ✓ | ✓ | react | 29k★, ativo | **verificado** | on-demand p/ animações React/spring physics |
| 28 | pixijs | MIT (GH API ✓ 48k★, pushed 10/2026) | ✓ | ✓ | nenhum (WebGL/Canvas) | 48k★, ativo | **verificado** | renderer 2D on-demand; WebGL fallback |
| 29 | p5js | **LGPL-2.1** (GH API ✓ 24k★, pushed 10/2026) | ✓ | ⚠️ LGPL: link dinâmico/distribuição de alterações | nenhum | 24k★, ativo | **candidato_nao_integrado** | generative art on-demand; **não embutir no repo** (obrigações LGPL); preferir Three.js/PixiJS p/ 3D/2D |
| 30 | paperjs | MIT (LICENSE.txt lido ✓; repo NOASSERTION mas MIT) | ✓ | ✓ | nenhum | 15k★, ativo | **verificado** | vector 2D on-demand |
| 31 | matterjs | MIT (GH API ✓ 18.5k★, pushed 09/2026) | ✓ | ✓ | nenhum | 18.5k★, ativo | **verificado** | physics 2D on-demand |
| 32 | rapier | Apache-2.0 (GH API ✓ 6k★, pushed 10/2026) | ✓ | ✓ preservando NOTICE | WASM/Web | 6k★, ativo | **verificado** | physics 3D (WASM) on-demand |
| 33 | ogl | **Unlicense** (package.json lido ✓) — domínio público equivalente | ✓ | ✓ sem restrição | nenhum | 4.7k★, push 04/2025 | **verificado** | WebGL micro-lib on-demand; preferir Three.js p/ cenas complexas |
| 34 | tsparticles | MIT (GH API ✓ 9k★, pushed 10/2026) | ✓ | ✓ | nenhum | 9k★, ativo | **verificado** | partículas on-demand (CDN) |
| 35 | gltf-transform | MIT (GH API ✓ 2k★, pushed 10/2026) | ✓ | ✓ | node | 2k★, ativo | **verificado** | pipeline glTF on-demand (otimização/processamento) |
| 36 | gl-transitions | MIT (README lido ✓); **cada shader declara própria licença no header (MIT/BSD)** | ✓ | ✓ shader a shader | nenhum | 2.2k★, ativo | **verificado** | transições GLSL on-demand; CDN/npm; **verificar header de cada shader** |
| 37 | obs-studio | GPL-2.0 (GH API ✓ 78k★, pushed 10/2026) | ✓ | app isolado; **não embutir binário** | C++/Qt | 78k★, ativo | **external_tool** | ferramenta de captura local; não dependência do repo |
| 38 | chatterbox | MIT (repo GH API ✓ 27k★, pushed 07/2026); **pesos/model cards podem ter termos próprios** | ✓ código | ✓ código; pesos = termos próprios | python/torch | 27k★, ativo | **conditional** | TTS on-demand; validar PT-BR + CPU/GPU reqs; **não instalar sem model card auditado** |
| 39 | opencut | MIT (GH API ✓ 96k★, pushed 09/2026); **em reescrita, API/MCP/headless futuros** | ✓ | ✓ | electron | 96k★, ativo | **watch** | editor externo; não motor operacional; acompanhar releases |
| 40 | motion-canvas | MIT (GH API ✓ 19.5k★, pushed 07/2026) | ✓ | ✓ | python/ffmpeg | 19.5k★, ativo | **candidate** | animações vetoriais/explicativas por código; complementar se Remotion não cobrir |
| 41 | motion-dev | MIT (GH API ✓ 34k★, pushed 10/2026) | ✓ | ✓ | react | 34k★, ativo | **candidate** | avaliar overlap com GSAP/Anime/React-Spring; provável redundante |
| 42 | manim | MIT (GH API ✓ 42k★, pushed 10/2026) | ✓ | ✓ | python/cairo/ffmpeg | 42k★, ativo | **candidate** | animações técnicas/matemáticas; nicho explicativo |
| 43 | lottie-web | MIT (GH API ✓ 32k★, pushed 09/2025) | ✓ | ✓ | nenhum | 32k★, estável | **candidate** | playback vetorial; lottie/dotLottie como asset entregue |
| 44 | dotlottie-web | MIT (GH API ✓ 931★, pushed 10/2026) | ✓ | ✓ | nenhum | 931★, ativo | **candidate** | player/empacotamento portátil .lottie; complementar a lottie-web |
| 45 | libass/ASS/fontTools/Noto | — | — | — | — | — | **candidate** | legenda tipográfica (fallback emoji/Noto); licença a verificar item a item |

## Lote 3 — Skills Externas / Especiais

| # | id | Fonte | Categoria | Evidência | Status | Ação |
|---|---|---|---|---|---|---|
| 46 | motionsites-web-builder | https://github.com/Motionsites-AI/claude-skill | skill | MIT no code/scripts/referências; examples/media **© MotionSites** (uso em sites, não redistribuição); bloco promocional no README | **adapt_mit_only** | registrar como adaptador opcional `web-cinematic`; reaproveitar specs/recipes/QA; **não embutir examples/media**; não adicionar marketing em entregas MOTION |
| 47 | shorts-animator | https://www.tobiadonadon.com/projects/construct/material/skills/shorts-animator | external_skill | ZIP por email; **sem auditoria de código/licença** | **license_pending** | **não simular instalação**; criar `shorts-director` original no MOTION usando motors existentes; se ZIP autorizado chegar, inspecionar e decidir |

## Lote 3 — Referências de Design (14, `reference_only`, sem scraping)

| # | id | URL | Nota | Status |
|---|---|---|---|---|
| 48 | inspora-design | https://inspora.design | inspiração visual | **reference_only** |
| 49 | iter0-com | https://iter0.com | inspiração/componente | **reference_only** |
| 50 | backgrounds-supply | https://backgrounds.supply | assets p/ uso comercial; **não redistribuir como pack** | **reference_only** |
| 51 | v0-app | https://v0.app/templates | templates SaaS | **reference_only** |
| 52 | beui-dev | https://beui.dev | componentes UI | **reference_only** |
| 53 | mobbin-com | https://mobbin.com | padrões mobile (pago) | **reference_only** |
| 54 | navbar-gallery | https://navbar.gallery | padrões nav | **reference_only** |
| 55 | 60fps-design | https://60fps.design | motion reference | **reference_only** |
| 56 | motionin-design | https://motionin.design | motion reference | **reference_only** |
| 57 | land-book-com | https://land-book.com | landing pages | **reference_only** |
| 58 | landdding-com | https://landdding.com | landing pages | **reference_only** |
| 59 | fontshare-com | https://fontshare.com | fontes; **verificar direitos por família** | **reference_only** |
| 60 | remove-bg | https://remove.bg | serviço externo (não local) | **reference_only** |
| 61 | wedoflow-com | https://wedoflow.com | flow/design refs | **reference_only** |

## Lote 3 — Candidatos Extras (Fase D)

| # | id | URL | Categoria | Por que / redundância | Status |
|---|---|---|---|---|---|
| 62 | motion-canvas | https://github.com/motion-canvas/motion-canvas | animation | animações vetoriais/explicativas por código (Python→MP4); complementar se Remotion não cobrir; instalar on-demand | **candidate** |
| 63 | motion-dev | https://github.com/motiondivision/motion | animation | animação web/React; overlap com GSAP/Anime/React-Spring — avaliar antes de adotar | **candidate** |
| 64 | manim | https://github.com/ManimCommunity/manim | technical-animation | explicações matemáticas/técnicas; nicho próprio; Python + Cairo + FFmpeg | **candidate** |
| 65 | lottie-web | https://github.com/airbnb/lottie-web | vector-animation | playback vetorial amplamente usado; asset entregável (não runtime do studio) | **candidate** |
| 66 | dotlottie-web | https://github.com/LottieFiles/dotlottie-web | vector-animation | player .lottie portátil; complementar a lottie-web | **candidate** |
| 67 | libass/ASS/fontTools/Noto | — | caption/typography | legenda tipográfica, fallback emoji/Noto; licença a verificar por componente | **candidate** |

## Registro Atualizado (apenas novos)

| Nome | URL | Versão | Licença | Categoria | Finalidade | Status | Consumido por |
|---|---|---|---|---|---|---|---|
| animejs | https://github.com/juliangarnier/anime | 3.2.x | MIT | animation | animações leves on-demand | **verificado** | creative-core, story-studio, feed-studio |
| react-spring | https://github.com/pmndrs/react-spring | 9.7.x | MIT | animation | spring physics React | **verificado** | creative-core (opcional) |
| pixijs | https://github.com/pixijs/pixijs | 8.x | MIT | renderer2d | 2D WebGL/Canvas | **verificado** | creative-core (opcional) |
| p5js | https://github.com/processing/p5.js | 1.x | LGPL-2.1 | generative2d | generative art | **candidato_nao_integrado** | creative-core (isolado) |
| paperjs | https://github.com/paperjs/paper.js | 0.12.x | MIT | vector | vector 2D | **verificado** | creative-core (opcional) |
| matterjs | https://github.com/liabru/matter-js | 0.19.x | MIT | physics2d | física 2D | **verificado** | creative-core (opcional) |
| rapier | https://github.com/dimforge/rapier | 0.x | Apache-2.0 | physics3d | física 3D (WASM) | **verificado** | creative-core (opcional) |
| ogl | https://github.com/oframe/ogl | 1.0.x | Unlicense | webgl | micro WebGL lib | **verificado** | creative-core (opcional) |
| tsparticles | https://github.com/tsparticles/tsparticles | 3.x | MIT | particles | partículas | **verificado** | creative-core (opcional) |
| gltf-transform | https://github.com/donmccurdy/glTF-Transform | 4.x | MIT | assets3d | pipeline glTF | **verificado** | creative-core (opcional) |
| gl-transitions | https://github.com/gl-transitions/gl-transitions | 2.x | MIT/BSD (por shader) | transitions | GLSL transitions | **verificado** | creative-core (opcional) |
| obs-studio | https://github.com/obsproject/obs-studio | 30.x | GPL-2.0 | capture_app | captura local | **external_tool** | motion-director (ferramenta) |
| chatterbox | https://github.com/resemble-ai/chatterbox | — | MIT (pesos = termos próprios) | tts | TTS local | **conditional** | audio/ (sob demanda) |
| opencut | https://github.com/OpenCut-app/OpenCut | — | MIT | editor | editor externo | **watch** | — |
| motion-canvas | https://github.com/motion-canvas/motion-canvas | — | MIT | animation | animações explicativas | **candidate** | — |
| motion-dev | https://github.com/motiondivision/motion | — | MIT | animation | animação React | **candidate** | — |
| manim | https://github.com/ManimCommunity/manim | — | MIT | technical-animation | animações técnicas | **candidate** | — |
| lottie-web | https://github.com/airbnb/lottie-web | 5.12+ | MIT | vector-animation | playback vetorial | **candidate** | feed-studio, carousel-studio |
| dotlottie-web | https://github.com/LottieFiles/dotlottie-web | — | MIT | vector-animation | player .lottie | **candidate** | feed-studio, carousel-studio |

## Bloqueios / Pendências Lote 3

1. **p5.js LGPL-2.1** → não embutir no repo distribuído; uso isolado como ferramenta/venv se necessário.
2. **Chatterbox model cards** → cada peso pode ter condições (CC-BY, non-commercial, etc.); validar antes de usar em produção.
3. **Shorts Animator ZIP** → sem auditoria = não integra. Módulo original `shorts-director` criado no MOTION (Fase C).
4. **MotionSites media/examples** → © MotionSites; uso só em sites construídos com a skill, não redistribuição.
5. **GL Transitions shaders** → licença por shader (MIT/BSD); verificar header ao usar.
6. **Referências de design (14)** → sem scraping, sem redistribuição, licença por item.
7. **OBS Studio** → GPL-2.0 app isolado; nunca binário embutido.
8. **OpenCut** → watch; reescrita em andamento, não pronto como motor.
9. **fontshare/remove.bg** → serviços/verificação por item; não dependência local.

---

# Lote 4 — 3D Production Pipeline (Adendo Missão 05)

Coletado **2026-10-29** via GitHub API. Ferramentas do adendo da Missão 05 não presentes no Lote 3.

## Matriz Lote 4 — Ferramentas 3D (6 ferramentas)

| # | id | Evidência (licença confirmada) | Uso comercial | Redistribuição | Deps | Maturidade | Status | Ação votada |
|---|---|---|---|---|---|---|---|---|
| 46 | spec-kit | MIT (GH API ✓ 143k★, pushed 10/2029) | ✓ | ✓ | node/python | 143k★, ativo | **verificado** | orientar especificação (spec-driven); não impor scaffold |
| 47 | penpot | MPL-2.0 (GH API ✓ 61k★, pushed 10/2029) | ✓ | ✓ (MPL) | rust/node | 61k★, ativo | **verificado** | design boards/direção visual opcional; open-source |
| 48 | svg.js | MIT (package.json ✓ 11.8k★, pushed 08/2026) | ✓ | ✓ | nenhum | 11.8k★, ativo | **verificado** | animação/manipulação SVG on-demand; leve |
| 49 | mcp-for-blender | MIT (GH API ✓ 32k★, pushed 10/2029) | ✓ | ✓ | python/blender | 32k★, ativo | **conditional** | **opt-in + consentimento**; segurança obrigatória (ver skill 3d-scene-director) |
| 49b | gltfjsx | MIT (GH API ✓ 5.8k★, pushed 11/2024) | ✓ | ✓ | node/react | 5.8k★, estável | **verificado** | converter GLB → componente React (R3F) quando útil; fonte Blender preservada |
| 49c | react-three-fiber | MIT (GH API ✓ 33k★, pushed 10/2026) | ✓ | ✓ | react/threejs | 33k★, ativo | **verificado** | engine 3D React para web; integração com web-director |

## Matriz Lote 4 — Ferramentas Já Catalogadas (reconciliação)

| # | id | Status Lote 3 | Nota Adendo |
|---|---|---|---|
| — | blender | **verificado** | ferramenta local opcional; GPL; nunca dependência do repo; MCP opt-in |
| — | threejs | **verificado** | base para R3F; vendor on-demand |
| — | gltf-transform | **verificado** | pipeline glTF otimização; on-demand |
| — | remotion | **verificado** | vídeo React; Company License se serviço |
| — | ffmpeg | **integrado** | em produção; frames→MP4, áudio |
| — | gltfjsx | **verificado** (Lote 3 #49b) | GLB → React component; fonte Blender preservada |
| — | react-three-fiber | **verificado** (Lote 3 #49c) | engine 3D React; web-director integração |

## Registro Atualizado — Lote 4

| Nome | URL | Versão | Licença | Categoria | Finalidade | Status | Consumido por |
|---|---|---|---|---|---|---|---|
| spec-kit | https://github.com/github/spec-kit | — | MIT | spec-driven | orientar especificação técnica | **verificado** | 3d-scene-director (SCENE_SPEC) |
| penpot | https://github.com/penpot/penpot | 2.x | MPL-2.0 | design/boards | boards, direção visual, design system | **verificado** | 3d-scene-director (BOARDS) |
| svg.js | https://github.com/svgdotjs/svg.js | 3.x | MIT | animation/2d | animação SVG, manipulação DOM | **verificado** | creative-core, feed-studio |
| mcp-for-blender | https://github.com/ahujasid/mcp-for-blender | — | MIT | mcp/blender | automação Blender via agente | **conditional** | 3d-scene-director (opt-in) |
| gltfjsx | https://github.com/pmndrs/gltfjsx | 6.x | MIT | converter | GLB → React component (R3F) | **verificado** | 3d-scene-director (web) |
| react-three-fiber | https://github.com/pmndrs/react-three-fiber | 8.x | MIT | engine3d | 3D React declarativo | **verificado** | web-director, 3d-scene-director |

## Bloqueios / Pendências Lote 4

1. **MCP for Blender** → **não habilitar automaticamente**; opt-in + consentimento; segurança obrigatória (ver skill 3d-scene-director §5).
2. **Blender** → não instalado no ambiente; ferramenta local opcional; GPL; nunca dependência do repo.
3. **gltfjsx / react-three-fiber** → usar quando destino for React; fonte Blender (.blend) **sempre preservada** independentemente do componente React gerado.
3. **Penpot MPL-2.0** → copyleft fraco; modificações no Penpot devem ser compartilhadas; uso normal OK.
4. **Spec Kit** → não impor scaffold; usar apenas para orientar especificação (SCENE_SPEC).
