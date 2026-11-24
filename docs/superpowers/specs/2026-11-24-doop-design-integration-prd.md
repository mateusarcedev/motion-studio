# Diagnóstico Técnico & PRD — Integração MOTION Studio × Editores de Design (Doop Design)

> **Status:** Aprovado (Etapa 1 concluída em 2026-11-24)  
> **Escopo inicial:** Doop Design como primeiro editor integrado via adaptador desacoplado, preservando abertura para Figma, Pencil e Paper.

---

## 1. Diagnóstico Técnico do Estado Atual

### 1.1. Inventário do MOTION Studio (`v1.1.1`)

| Camada | Artefatos Auditados | Capacidades Reutilizáveis | Lacunas Frente à Integração com Editores |
| :--- | :--- | :--- | :--- |
| **Core & Drivers** | `packages/motion-core/index.js`, `design-system/frame.js`, `svg-motion.js`, `lottie-motion.js` | Driver determinístico `window.__MOTION__` / `window.__onFrame__`; SVG Motion Engine (*seekable*, 14 efeitos, 4 casas decimais); `lottie_light` determinístico; `three@0.165.0`. | Vídeo determinístico proíbe CSS `@keyframes`, `SMIL`, `requestAnimationFrame` autônomo, `Math.random()` e `Date.now()` — comuns em frames interativos de editores. |
| **Renderizadores** | `render_static.mjs`, `render_frames.mjs`, `assemble_video.py`, `qa_viewports.mjs` | Render PNG via Playwright (`deviceScaleFactor` nativo, overflow/font checks); batch de frames determinísticos; MP4 H.264 CFR (`yuv420p`) e WebM VP9 alpha; auditoria em 5 viewports (`360×740`, `390×844`, `768×1024`, `1280×800`, `1920×1080`). | `static-server.mjs` injeta import map (`@technomanceer/motion-core/*`) e serve arquivos locais; frames Doop dependem de `<style data-doop-tokens>`, `<style data-doop-fonts>` e `<link data-doop-webfonts>`. |
| **Componentes & Transições** | `packages/motion-core/components/*`, `transitions/*` | 8 componentes SVG/DOM parametrizados (`counter`, `animated-ranking`, `comparison-panel`, `timeline-sequence`, `progress-gauge`, `kinetic-text-reveal`, `image-reveal`, `data-callout`); 8 transições FFmpeg `xfade`. | Sem adaptador para `<doop-use>` / `data-doop-prop` / `data-doop-slot`. |
| **Assets, Ícones & SVG** | `svg/svg-tools.mjs`, `svg/builder.mjs`, `icons/*`, `visual-assets/*` | 2.404 ícones Lucide + 326 `developer-icons` + 10 `humaaans` offline; `animateicons` determinístico; `iconify` opt-in com cache SHA-256; sanitizador SVGO estrito (`assertSafeSvg`); gate comercial `assessLicense`. | Editores externos referenciam URLs remotas; renders offline do Motion exigem hidratação local com `sha256` e checagem de licença antes do render. |
| **Marcas & Tokens** | `creative-core/brands/*/tokens.json`, `presets.json`, `safe-zones/presets.json` | Tokens de marca (`color`, `roles`, `typography`) compatíveis com `paletteFromTokens` e `applyTokens`; presets e *safe zones*. | `tokens.json` atual é enxuto frente aos 11 tipos e multi-tema (`tokenThemes`) do Doop. |
| **QA, Crítico & Entrega** | `quality/*`, `exporters/delivery.py` | `verifyDeterminism` (2 sessões Chromium independentes + SHA-256), `qaFrames`, `qaMedia`, `qaProject`, `validate_static.py`, `build_contact_sheet.py`, parecer `motion.critic.findings@1`, `delivery.contract.json` + ZIP seguro. | Sem mapeamento nativo para `approvalStatus` (`ready_for_dev`/`needs_review`) ou âncoras `data-doop-id`. |
| **CLI & MCP Existente** | `packages/motion-cli/lib/main.mjs`, `packages/motion-cli/lib/mcp.mjs` | **Servidor `motion mcp` já existente** (`stdio`, JSON-RPC 2.0 `2025-06-18`, fila de jobs `motion_job_status`, 11 tools do Smart Reel Editor / Voice Studio / STT com `tests/mcp_parity.test.mjs`). | Motores centrais (`render static/frames/video/carousel`, `components`, `transition`, `qa determinism/safe-zones/viewports`, `svg`, `bridge`) ainda não expostos no MCP; transporte apenas `stdio`. |
| **Skills & Distribuição** | `packages/motion-skills/public-skills.json`, `optional-integrations.json`, `bootstrap/*` | 14 skills oficiais em `.agents/skills` + symlink `.claude/skills`, verificação SHA-256 (`verify-public-skills.mjs`), detecção de agentes. | Sem skills de ponte bidirecional (`design-to-motion`, `motion-to-design`, `doop-bridge`). |

### 1.2. Auditoria do Doop (`doop.design/mcp` e `kgoedecke/doop`)

- **MCP & Auth:** Streamable HTTP (`https://doop.design/mcp`) com OAuth 2.0/2.1.
- **Frames:** `<iframe sandbox="allow-scripts">` isolado sem same-origin; morphing de DOM em tempo real.
- **Tokens:** 11 tipos (`color`, `opacity`, `radius`, `spacing`, `container`, `breakpoint`, `fontFamily`, `fontWeight`, `fontSize`, `lineHeight`, `letterSpacing`), namespaces Tailwind v4 (`--color-*`, etc.), valores `<= 512` chars sem `;{}<>`, até 8 temas por canvas.
- **Componentes:** materializados no HTML com `data-doop-instance`, `data-doop-part`, `data-doop-props`, `data-doop-overrides` e compactados como `<doop-use>` em `get_frame`.
- **Limitações de interoperabilidade identificadas:**
  1. Doop **rejeita `base64 data:` URIs** e recomenda SVGs inline `<= ~20 KB` (maiores via `upload_asset`, limite de 15 uploads/min).
  2. Frames Doop **não embutem vídeo/áudio** (usam poster images); vídeos do Motion retornam como stills, contact sheets ou storyboards.
  3. Protótipos Doop (`data-doop-on` / `data-doop-action`) são inertes fora do player; precisam virar sequência temporal no Motion.
  4. A ferramenta `view_website` do Doop apresentou erro MCP `-32602` (*Invalid tools/call result*) durante a auditoria — o fluxo não deve depender dela exclusivamente (fallback para `import_webpage` ou Playwright local).

---

## 2. PRD — Objetivos, Requisitos e Segurança

### 2.1. Objetivo Estratégico
Posicionar o **MOTION Studio** como a camada de produção criativa determinística (motion graphics, microinterações, vídeos demo, landing pages cinematográficas, storyboards, carrosséis, stories e posts) conectada a editores visuais via contratos independentes — estreando com o **Doop Design** e preparado para Figma, Pencil e Paper.

### 2.2. Requisitos Funcionais
- **RF-01 (Contratos IR & Tokens):** definir `MotionDesignIR@1`, `DesignTokenBundle@1`, `AssetProvenanceManifest@1` e `EditorAdapter`, com `DoopAdapter` bidirecional para tokens (`tokens.json` + `paletteFromTokens`) e frames.
- **RF-02 (Design-to-Motion):** importar frames, componentes e protótipos (`data-doop-*`) como entradas determinísticas para vídeo, UI motion (`frame.js` / `svg-motion.js`), carrosséis, stories, posts e landing pages (`web-director`).
- **RF-03 (Motion-to-Design):** devolver stills, contact sheets, storyboards, tokens derivados e SVGs sanitizados (`<= 20 KB` ou fila de upload) sem `base64` e preservando `ready_for_dev` e `data-doop-id`.
- **RF-04 (Skills Modulares):** consolidar UI motion dentro de `design-to-motion` (reaproveitando `animate`, `emil-design-eng`, `explainer-motion`, `prototype`, `web-director`), criar `motion-to-design` no catálogo oficial e manter `doop-bridge` em `optional-integrations.json` sem dependência obrigatória de `doop-designer`.
- **RF-05 (Motion MCP Server v2):** evoluir `packages/motion-cli/lib/mcp.mjs` (sem duplicar servidor) com `stdio` padrão + Streamable HTTP opcional autenticado após estabilização dos contratos e ferramentas locais.

### 2.3. Requisitos Não-Funcionais & Segurança (Conteúdo Não Confiável)
Todo conteúdo importado de editores ou URLs externas deve ser tratado como **não confiável**:
- **Path Traversal:** validação estrita de caminhos relativos (rejeitar `..`, `\`, `\0`, letras de drive, symlinks fora da raiz).
- **SSRF:** bloqueio de esquemas não-HTTP(S), credenciais em URL, loopback (`127.0.0.0/8`, `::1`), redes privadas RFC 1918/4193 e endpoints de metadados (`169.254.0.0/16`, `fe80::/10`).
- **Injeção de comandos & JS arbitrário:** zero concatenação em shell; sanitização de HTML/CSS/SVG importado removendo `<script>`, atributos `on*`, `javascript:`, `<foreignObject>`, `<iframe>` e `@import` antes de processar/renderizar.
- **Prompt Injection:** detecção e isolamento de diretivas suspeitas em comentários HTML, `aria-label`, `alt` e metadados importados, rotulados explicitamente como dados não confiáveis.
- **Limites & Isolamento:** renderizações em ambiente isolado com limites de tempo/memória/concorrência e preservação integral de proveniência, licença (`assessLicense`) e `sha256` de cada asset.
- **Independência de Agentes e Assinaturas:** zero exigência de modelo/fornecedor/API key de IA no Motion; cada agente usa sua própria assinatura sem delegação automática a `@doop` ou APIs pagas.
