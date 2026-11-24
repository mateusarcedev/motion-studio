# Missão 23+ — Plano de Implementação: MOTION Studio × Doop Design

> **Base:** `main` (via worktree isolado `feat/doop-integration`, preservando integralmente `fix/reel-determinism`).  
> **Princípio:** Contratos e testes offline primeiro; nenhuma funcionalidade especulativa; cada missão termina com qualidade verificada e commits rastreáveis.

---

## Missão M1 — Documentação Persistente, Contratos, Segurança Base & `DoopAdapter` (Concluída)
1. Persistir documentação técnica, PRD, ADRs, contratos, matriz e plano no repositório Git.
2. Implementar `packages/motion-core/bridge/`:
   - `schemas/design-ir.v1.json`, `token-bundle.v1.json`, `asset-provenance.v1.json`.
   - `security.mjs` (anti-traversal, anti-SSRF, sanitização HTML/CSS/JS, detecção de *prompt injection*, hash canônico SHA-256).
   - `contracts.mjs` (validadores estritos para IR, Tokens com checagem de ciclos/temas, e Proveniência integrada a `assessLicense`).
   - `adapter.mjs` (`EditorAdapter` + `AdapterRegistry`).
   - `adapters/doop.mjs` (`DoopAdapter`: `importTokens`, `exportTokens`, `toMotionBrandTokens`, `importFrame`, `validateTargetReadiness`).
   - Exportar `./bridge` em `packages/motion-core/package.json`.
3. Adicionar fixtures representativas e adversariais em `tests/fixtures/bridge/`.
4. Validar com testes unitários/contrato, determinismo de serialização e suíte completa existente (`npm run test:ci`, `npm run test:py`, `npm run skills:verify`, `npm run test:determinism`).

## Missão M2 — Asset Hydrator & Normalizador `Design-to-Motion` (Concluída)
- Hidratação offline segura de URLs remotas para `assets/` (`bridge/assets.mjs`: anti-SSRF + pinagem DNS + limites de tamanho/bomba de descompressão/MIME/assinatura binária + deduplicação SHA-256 + escrita atômica + `assessLicense` + `assertSafeSvg` + `AssetProvenanceManifest@1` + `assets.manifest.json`).
- Sanitização estruturada com tokenizador HTML + `css-tree` AST + `svgo` (`bridge/security.mjs` e `svg/svg-tools.mjs`), eliminando dependência exclusiva de regex.
- Conversor determinístico (`bridge/normalize.mjs`) para composições `frame.js` / `svg-motion.js` / `carousel` / `story` / `web-director` com relatório estruturado e zero URLs externas.
- Conversor `prototypeFlows` (`data-doop-*`) → `STORYBOARD.md` + beats de cena (`bridge/prototype-to-storyboard.mjs`).
- Renderização offline (`--offline` em `render_static.mjs` / `render_frames.mjs` bloqueando *service workers* e rede externa), comparação visual (`bridge/fidelity.mjs`) e suíte cobrindo 8 fixtures representativas + `verifyDeterminism` PASS + pendência `.venv`/NumPy resolvida em `scripts/ci_python_tests.py`.

## Missão M3 — Exportador Seguro `Motion-to-Design` (Próxima)
- Conversor `packages/motion-core/bridge/export-to-editor.mjs` de saídas Motion (stills representativos, contact sheets, slides, tokens derivados via `DoopAdapter.exportTokens`, SVGs `<= 20 KB` inline ou fila de upload respeitando 15/min) para payloads compatíveis com editores (`EditorAdapter`).
- Pré-condições herdadas da M2: consumo direto de `AssetProvenanceManifest@1`, `NormalizationReport` e `prototypeToStoryboard` para garantir zero `base64` inline em HTML Doop, preservação de `data-doop-id`, proteção estrita de frames `ready_for_dev` e publicação em páginas dedicadas sem sobrescrever originais.
- Validação offline com fixtures e verificação de integridade (zero perda de atributos, zero URL insegura, respeito a marcas `trademark: true`).

## Missão M4 — Evolução do `motion mcp` Server v2 (`stdio` + Streamable HTTP)
1. **Fase 4A (`stdio`):** expor motores determinísticos (`render_static`, `render_frames`, `render_video`, `render_carousel`, `qa_determinism`, `qa_safe_zones`, `qa_viewports`, `svg_validate`, `bridge_*`) em `packages/motion-cli/lib/mcp.mjs` mantendo as 11 tools atuais intactas e ampliando `tests/mcp_parity.test.mjs`.
2. **Fase 4B (Streamable HTTP opt-in):** adicionar `--transport=http` sobre o mesmo registro/schemas com OAuth 2.1 (RFC 9728/8414/9207/8707/PKCE), controle de acesso, isolamento por `userId/projectId`, fila com concorrência limitada, cancelamento, observabilidade e suporte documentado a **Secure MCP Tunnel** para validação com ChatGPT.

## Missão M5 — Skills (`design-to-motion`, `motion-to-design`, `doop-bridge`)
- Criar `design-to-motion` (consolidando UI motion sobre `animate`, `emil-design-eng`, `explainer-motion`, `prototype`, `web-director`) e `motion-to-design` em `@technomanceer/motion-studio-skills`.
- Criar `doop-bridge` como integração opcional em `optional-integrations.json` (zero dependência obrigatória de `doop-designer`).
- Atualizar contagens/hashes (`public-skills.json`, `skills-lock.json`, `verify-public-skills.mjs`).

## Missão M6 — Piloto E2E Controlado & Release Gate
- Criar canvas exclusivo **`Motion Studio — Integration Lab`** no Doop (somente com autorização mantida e sem tocar em *Bora Campo*, *Supertrans* ou outros canvases).
- Validar ciclo completo: tokens + componentes + frames + microinteração + vídeo/storyboard + carrossel + reimportação visual + `release-gate.mjs`.
- Atualizar `docs/COMPATIBILITY.md`, `docs/INTEGRATIONS.md` e relatórios finais.

---

## Critérios de Aceite Gerais
- Toda a suíte existente (`test:ci`, `test:py`, `test:determinism`, `skills:verify`) passa sem regressões.
- Contratos JSON, validação anti-SSRF/XSS/traversal/*prompt injection* e determinismo do bridge cobertos por testes automatizados.
- Zero dependências de IA pagas no `motion-core` e zero delegação automática para `@doop`.
