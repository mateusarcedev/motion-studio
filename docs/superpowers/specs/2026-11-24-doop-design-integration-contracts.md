# Contratos de Integração, Matriz de Compatibilidade & Riscos

> **Versão dos Contratos:** `1.0.0` (Missão M1)  
> **Localização no código:** `packages/motion-core/bridge/`

---

## 1. Contratos JSON Versionados

### 1.1. `MotionDesignIR@1` (`packages/motion-core/bridge/schemas/design-ir.v1.json`)
Contrato neutro de editor descrevendo um frame/estado importado para consumo determinístico no Motion:
- `schemaVersion`: `"1.0.0"`
- `source`: `{ editor, documentId, pageId?, frameId, frameName?, revision?, approvalStatus?, capturedAt? }`
- `viewport`: `{ width, height, theme, deviceScaleFactor }`
- `tokensRef?`: caminho relativo seguro para `DesignTokenBundle@1`
- `assetsRef?`: caminho relativo seguro para `AssetProvenanceManifest@1`
- `componentsUsed`: lista de instâncias `<doop-use>` / componentes detectados (`{ id?, component, props }`)
- `prototypeFlows`: transições/interações extraídas (`{ triggerElementId?, on, action, targetFrameId?, transition?, durationMs? }`)
- `referencedAssets`: URLs/fontes extraídas e validadas (`{ url, kind, safe, blockedReason? }`)
- `sanitizedHtml`: HTML limpo sem `<script>`, `on*`, `javascript:`, `<foreignObject>` ou `<iframe>`
- `securityFindings`: lista estruturada de bloqueios/sanitizações (`SCRIPT_STRIPPED`, `EVENT_HANDLER_STRIPPED`, `SSRF_URL_BLOCKED`, `BASE64_DATA_URI_FLAGGED`, `PROMPT_INJECTION_DETECTED`, etc.)
- `compatibilityDiagnostics`: sinais determinísticos (`CSS_KEYFRAMES_DETECTED`, `CLOCK_OR_RANDOM_API_DETECTED`, `EXTERNAL_NETWORK_ASSET`, etc.)
- `irHash`: SHA-256 canônico calculado deterministicamente (independente da ordem das chaves)

### 1.2. `DesignTokenBundle@1` (`packages/motion-core/bridge/schemas/token-bundle.v1.json`)
Contrato bidirecional de tokens:
- `schemaVersion`: `"1.0.0"`
- `sourceEditor`: string (ex. `"doop"`)
- `brandSlug`: slug `[a-z0-9-]+`
- `themes`: array de temas além de `"default"` (ex. `["light", "dark"]`, máx. 8)
- `tokens`: array ordenado de `{ cssVar, type, value, themes?, aliasOf?, description?, motionGroup?, motionKey? }`
  - Tipos válidos: `color | opacity | radius | spacing | container | breakpoint | fontFamily | fontWeight | fontSize | lineHeight | letterSpacing`
  - Validação de grafo de aliases: rejeita ciclos (`a -> b -> a`) e referências inexistentes.
  - Validação CSS: `<= 512` chars, bloqueia `;`, `{`, `}`, `<`, `>`, quebras de linha, `@import`, `expression(`, `javascript:`.
- `fonts`: `{ custom: string[], webFonts: string[] }`
- Mapeamento direto para `creative-core/brands/<slug>/tokens.json` (`{ $schemaVersion, color, roles, typography, scale, themes, cssVars }`) compatível com `paletteFromTokens()` em `packages/motion-core/svg/builder.mjs`.

### 1.3. `AssetProvenanceManifest@1` (`packages/motion-core/bridge/schemas/asset-provenance.v1.json`)
Contrato de proveniência, segurança e licenciamento:
- `schemaVersion`: `"1.0.0"`
- `assets`: array de `{ id, sourceUrl?, localPath, sha256, kind, origin, license: { spdx, scope?, attributionRequired?, attribution?, trademark? }, sanitized, trademark }`
- Validação obrigatória: `assertSafeRelativePath(localPath)`, `assertSafeRemoteUrl(sourceUrl)` (anti-SSRF) e `assessLicense(license)` (bloqueando NC/ND/SA/GPL/desconhecida em uso comercial).

### 1.4. Interface `EditorAdapter` (`packages/motion-core/bridge/adapter.mjs`)
Contrato mínimo sem abstrações especulativas:
- `editor`: string identificadora (`"doop"`, futuro `"figma"`, `"pencil"`, `"paper"`)
- `capabilities`: `{ tokens: boolean, frames: boolean, components: boolean, prototypes: boolean }`
- `importTokens(rawInput, options) -> DesignTokenBundle@1`
- `exportTokens(tokenBundle, options) -> editorPayload`
- `importFrame(rawFrame, options) -> MotionDesignIR@1`
- `validateTargetReadiness(ir) -> { ok, diagnostics }`

---

## 2. Matriz de Compatibilidade Técnica

| Recurso | Doop Design | MOTION Studio | Estratégia na Ponte |
| :--- | :--- | :--- | :--- |
| **Tokens & Temas** | 11 tipos CSS vars + `tokenThemes` | `tokens.json` (`color`, `roles`, `typography`) | `DoopAdapter.importTokens` / `exportTokens` + `toMotionBrandTokens` |
| **HTML/CSS Estático** | Iframe sandbox; inline `style` + `<style>` | Playwright + `static-server.mjs` | Preserva estrutura; sanitiza scripts/handlers; extrai CSS vars |
| **CSS `@keyframes` / JS** | Permitido em preview Doop | Bloqueado em vídeo determinístico | Detectado em `compatibilityDiagnostics` na M1; convertido para `frame.js` / `svg-motion.js` na M2 |
| **SVG** | Inline `<=20KB` ou `upload_asset` | `assertSafeSvg` + `svg-motion.js` | Sanitização estrita SVGO; controle de tamanho na M3 |
| **Assets & `base64`** | Rejeita `base64 data:` URIs | Exige assets locais offline com `sha256` | M1 valida URLs/caminhos; M2 hidrata com gate de licença; M3 sobe via `upload_asset` |
| **Vídeo & Áudio** | Apenas poster image em frames | MP4 CFR 30fps / WebM VP9 alpha | M3 exporta stills/storyboards/posters para Doop |
| **Protótipos (`data-doop-*`)** | `navigate`, `overlay`, `delay`, `key` | Storyboards e sequências temporais | M1 extrai `prototypeFlows`; M2 gera `STORYBOARD.md` + cenas |
| **Figma / Pencil / Paper** | N/A | `EditorAdapter` + `AdapterRegistry` | Registro pronto na M1; implementação apenas em frentes futuras |

---

## 3. Matriz de Compatibilidade por Agente

| Agente / Cliente | Skill Global `doop-designer` | Skills Motion (`design-to-motion` / `motion-to-design`) | `motion mcp` | Observação |
| :--- | :--- | :--- | :--- | :--- |
| **Antigravity CLI & IDE** | Junction em `.gemini/config/skills` e `.gemini/antigravity/skills` | `.agents/skills/` | `stdio` | Ativo com Doop MCP |
| **Codex CLI & VS Code** | Nativo em `.agents/skills/` + `agents/openai.yaml` | `.agents/skills/` | `stdio` | Requer configurar Doop MCP em `~/.codex/config.toml` |
| **Claude Code CLI & VS Code** | Junction em `.claude/skills/` | Symlink `.claude/skills/` | `stdio` (já validado) | Requer configurar Doop MCP em `.claude.json` |
| **OpenCode & Cursor & Copilot** | Junctions nos diretórios globais | `.agents/skills/` (ou link local) | `stdio` | Dependem de configurar Doop MCP em cada cliente |
| **ChatGPT Web** | Via `Universal Agent Design Protocol` no canvas | Via endpoint remoto quando M4 HTTP estiver ativo | Streamable HTTP + OAuth 2.1 / Secure Tunnel | Sem filesystem ou shell local |

---

## 4. Análise de Riscos & Mitigações

| Risco | Impacto | Mitigação |
| :--- | :---: | :--- |
| Mistura acidental com trabalho pendente em `fix/reel-determinism` | Alto | Execução em *git worktree* dedicado (`feat/doop-integration` a partir de `main`), preservando `fix/reel-determinism` intacto. |
| Conteúdo malicioso em frames importados (XSS, SSRF, traversal, prompt injection) | Crítico | Camada dedicada `bridge/security.mjs` executada automaticamente em toda importação/validação antes de render ou escrita em disco. |
| Quebra de determinismo por `@keyframes` / `Math.random()` herdados | Alto | Diagnóstico explícito no IR + bloqueio antes de render de vídeo até normalização (`M2`) e `verifyDeterminism`. |
| Degradação ou alteração acidental de canvases em produção (`Bora Campo`, `Supertrans`) | Crítico | Proibição estrita em toda a suíte; piloto E2E (M6) restrito ao canvas novo `Motion Studio — Integration Lab`. |
| Duplicação de servidor MCP ou quebra de paridade | Alto | Evolução única de `packages/motion-cli/lib/mcp.mjs` na M4 após estabilizar contratos (M1–M3). |
| Vazamento de credenciais ou consumo oculto de APIs pagas | Crítico | Zero armazenamento de tokens OAuth no bridge; zero delegação automática para `@doop`; zero uso de IA pelo `motion-core`. |
