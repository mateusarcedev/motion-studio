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

### 1.4. `ExportPlan@1` & `ExportResult@1` (`export-plan.v1.json`, `export-result.v1.json`)
Contratos versionados (`1.0.0`) introduzidos na M3 em `packages/motion-core/bridge/` para o fluxo de 5 estágios (`Inspect → Plan → Validate → Execute → Verify`):
- `ExportPlan@1`: `{ schemaVersion, planId, planHash, targetEditor, documentId, policy, dryRun, authorization, compatibilityReport, operations[] }`
  - `policy`: `"create-new-frame" | "update-existing-frame" | "duplicate-as-draft" | "export-assets-only" | "dry-run"`
- `compatibilityReport`: `{ schemaVersion, classifications: { editable, rasterized, referential, blocked }, items[], tokenConflicts[], privacyBlocked[], warnings[], unverifiedCapabilities[], normalizationReport }`
- `operations[]`: `ExportOperation@1` ordenado por dependência com ID estável, origem, destino, dependências, `inputHash`, pré-condições, payload, resultado esperado, `reversible` e `compensable`.
- `ExportCompatibilityReport@1` registra limitações do editor, diferenças e verificações não disponíveis. `NormalizationReport@1` é validado e resumido no relatório de compatibilidade.
- `ExportResult@1`: `{ schemaVersion, planId, planHash, targetEditor, documentId, policy, dryRun, status, operations[], uploadedAssets, createdFrames[], reconciliation, rollbackNote }`
  - `status`: `"DRY_RUN" | "COMPLETED" | "PARTIAL" | "FAILED" | "BLOCKED" | "CANCELLED"`
  - `operations[].status`: `"planned" | "skipped" | "succeeded" | "failed" | "ambiguous"` (timeouts ou desfechos desconhecidos recebem `"ambiguous"` e **nunca** são reexecutados automaticamente na retomada via `previousResult`).

### 1.5. Interface `EditorAdapter` (`packages/motion-core/bridge/adapter.mjs`)
Contrato mínimo sem abstrações especulativas:
- `editor`: string identificadora (`"doop"`, futuro `"figma"`, `"pencil"`, `"paper"`)
- `capabilities`: `{ tokens: boolean, frames: boolean, components: boolean, prototypes: boolean, export?: boolean }`
- Métodos base obrigatórios (M1): `importTokens`, `exportTokens`, `importFrame`, `validateTargetReadiness`
- Capacidades opcionais de exportação (M3, verificadas por `supportsExportOperations(adapter)`): `inspectRemoteState`, `planExport`, `executeExportOperation`, `verifyExportedState` (retrocompatível com adapters M1).

### 1.6. Superfície MCP Doop verificada para M3

No schema MCP conectado em 2026-11-24, o adapter usa somente `get_canvas`, `get_frame`, `create_frame`, `set_frame_html`, `append_frame_html`, `edit_frame_html`, `upload_asset`, `get_frame_screenshot`, `get_prototype` e `save_decision`. `upload_asset` usa grant com `local_file: true` e um transporte de upload injetado. Não estavam disponíveis `get_tokens`, `create_tokens`, `set_tokens`, `create_components`, `inspect_frame`, `set_prototype_start` nem `upload_font`; M3 não chama nem simula essas ferramentas. A releitura de frame detecta conflito de revisão, mas sem CAS atômico não elimina a corrida entre leitura e escrita.

---

## 2. Matriz de Compatibilidade Técnica

| Recurso | Doop Design | MOTION Studio | Estratégia na Ponte |
| :--- | :--- | :--- | :--- |
| **Tokens & Temas** | CSS vars e temas | `tokens.json` (`color`, `roles`, `typography`) | M1 importa/exporta o bundle. M3 preserva CSS local e reporta que leitura/escrita global de tokens não está disponível no MCP conectado; não altera tokens globais |
| **HTML/CSS Estático** | Iframe sandbox; inline `style` + `<style>` | Playwright + `static-server.mjs` | Preserva CSS local, `data-doop-*` e `<doop-use>`; remove scripts não confiáveis e scripts de driver; cria frames novos ou atualiza somente com autorização (`create_frame`, `set_frame_html`, `append_frame_html`, `edit_frame_html`) |
| **CSS `@keyframes` / JS** | Permitido em preview Doop | Bloqueado em vídeo determinístico | Detectado na M1; convertido para `frame.js` / `svg-motion.js` na M2; saída Motion não suportada volta como poster + notas (M3) |
| **SVG** | Inline `<=20KB` ou `upload_asset` | `assertSafeSvg` + `svg-motion.js` | Sanitização estrita SVGO; SVGs `<=20KB` inline ou promovidos para `upload_asset` na M3 |
| **Assets & `base64`** | `upload_asset` com grant para arquivo local; imagens de até 5 MB; upload limitado | Exige assets locais offline com `sha256` | M2 hidrata localmente; M3 extrai `data:` de imagem e SVG, remove metadados comuns, usa limite conservador de 5.000.000 bytes, exige licença e autorização de publicação, deduplica por SHA-256 e compartilha fila sequencial com teto de 15/min por transporte MCP (`uploadRateLimitScope` permite adapters irmãos). `upload_font` não está disponível, então fontes são bloqueadas |
| **Vídeo, 3D & Áudio** | Apenas poster image estático | MP4 CFR / WebM / Three.js / GSAP | M3 classifica como `referential` e exporta poster + resumo de storyboard sem embutir vídeo/bundles JS |
| **Protótipos (`data-doop-*`)** | `navigate`, `overlay`, `delay`, `key` | Storyboards e sequências temporais | M1 extrai `prototypeFlows`; M2 gera `STORYBOARD.md`; M3 preserva atributos e protege `ready_for_dev` + revisão pré-escrita |
| **Figma / Pencil / Paper** | N/A | `EditorAdapter` + `AdapterRegistry` | Registro pronto desde a M1; implementação apenas em frentes futuras |

---

## 3. Matriz de Compatibilidade por Agente

| Agente / Cliente | Skill Global `doop-designer` | Skills Motion (`design-to-motion` / `motion-to-design`) | `motion mcp` | Observação |
| :--- | :--- | :--- | :--- | :--- |
| **Antigravity CLI & IDE** | Junction em `.gemini/config/skills` e `.gemini/antigravity/skills` | `.agents/skills/` | `stdio` | Ativo com Doop MCP |
| **Codex CLI & VS Code** | Nativo em `.agents/skills/` + `agents/openai.yaml` | `.agents/skills/` | `stdio` | Requer configurar Doop MCP em `~/.codex/config.toml` |
| **Claude Code CLI & VS Code** | Junction em `.claude/skills/` | Symlink `.claude/skills/` | `stdio` (já validado) | Requer configurar Doop MCP em `.claude.json` |
| **OpenCode & Cursor & Copilot** | Junctions nos diretórios globais | `.agents/skills/` (ou link local) | `stdio` | Dependem de configurar Doop MCP em cada cliente |
| **ChatGPT Web** | Sem acesso direto ao catálogo local | Não alcança os motores locais | Sem suporte a Motion MCP stdio | Sem filesystem ou shell local; usar cliente local que inicie processos MCP |

> O servidor Motion vigente é exclusivamente local `stdio`; a antiga alternativa HTTP/OAuth foi arquivada como decisão supersedida em ADR-007. A lista de clientes nesta tabela indica caminhos documentados, não homologação. Consulte [`docs/COMPATIBILITY.md`](../../COMPATIBILITY.md) para evidência de testes por cliente.

---

## 4. Análise de Riscos & Mitigações

| Risco | Impacto | Mitigação |
| :--- | :---: | :--- |
| Divergência entre agentes ou trabalhos locais | Alto | Regra permanente em `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` e `docs/WORKFLOW.md`: todo desenvolvimento na `main`, sem branches auxiliares ou worktrees, com commits atômicos e documentação versionada. |
| Conteúdo malicioso em frames importados (XSS, SSRF, traversal, prompt injection) | Crítico | Camada dedicada `bridge/security.mjs` executada automaticamente em toda importação/validação antes de render ou escrita em disco. |
| Quebra de determinismo por `@keyframes` / `Math.random()` herdados | Alto | Diagnóstico explícito no IR + bloqueio antes de render de vídeo até normalização (`M2`) e `verifyDeterminism`. |
| Degradação ou alteração acidental de canvases em produção (`Bora Campo`, `Supertrans`) | Crítico | Proibição estrita em toda a suíte; piloto E2E (M6) restrito ao canvas novo `Motion Studio — Integration Lab`. |
| Duplicação de servidor MCP ou quebra de paridade | Alto | Evolução única de `packages/motion-cli/lib/mcp.mjs` na M4 após estabilizar contratos (M1–M3). |
| Vazamento de credenciais ou consumo oculto de APIs pagas | Crítico | Zero armazenamento de tokens OAuth no bridge; zero delegação automática para `@doop`; zero uso de IA pelo `motion-core`. |
