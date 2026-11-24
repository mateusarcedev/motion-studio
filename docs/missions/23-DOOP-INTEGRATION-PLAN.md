# Missão 23+ — Plano de Implementação: MOTION Studio × Doop Design

> **Base vigente:** `main`; M1 e M2 integradas. Todo trabalho atual e futuro ocorre diretamente em `main`, sem branches auxiliares ou worktrees. O histórico anterior está preservado nos commits e registros de auditoria.
> **Princípio:** Contratos e testes offline primeiro; nenhuma funcionalidade especulativa; commits atômicos; quality gates antes de qualquer envio remoto.

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

## Missão M3 — Exportador Seguro `Motion-to-Design` (Concluída localmente; CI remoto pós-push pendente)
- Implementação em `packages/motion-core/bridge/export-to-editor.mjs`: `Inspect → Plan → Validate → Execute → Verify`, contratos `ExportPlan@1`, `ExportOperation@1`, `ExportResult@1` e `ExportCompatibilityReport@1`, capacidades opcionais retrocompatíveis do `EditorAdapter` e `DoopAdapter` limitado aos nomes e parâmetros MCP verificados em 2026-11-24.
- O mock usa apenas ferramentas MCP disponíveis: `get_canvas`, `get_frame`, `create_frame`, `set_frame_html`, `append_frame_html`, `edit_frame_html`, `upload_asset`, `get_frame_screenshot`, `get_prototype` e `save_decision`. Não há ferramentas MCP disponíveis para leitura/escrita de tokens ou componentes; valores globais ficam intactos e sua leitura é reportada como não verificada. Fontes são bloqueadas porque `upload_font` não está disponível.
- Dry-run produz um plano determinístico sem escrita. A autorização de upload público é falsa por padrão; assets usam o grant `upload_asset(local_file: true)` e transporte injetado, com limite conservador de 5.000.000 bytes por imagem, hash SHA-256, deduplicação e teto compartilhado de 15 uploads/min + um upload por vez entre execuções que reutilizam o mesmo transporte MCP. `uploadRateLimitScope` permite compartilhar a fila entre adapters. Não há transporte remoto real nem canvas modificado nesta missão.
- Saídas distinguem HTML editável, assets rasterizados e referências de poster/storyboard. CSS local de tokens/temas, responsividade, SVG seguro, `data-doop-*` e `<doop-use>` são preservados quando compatíveis. Vídeo/3D/JavaScript não são declarados como reprodução nativa.
- Proteções: licença/proveniência, privacidade, sanitização, strip de metadados PNG/JPEG/WebP, MIME/tamanho, proteção de `ready_for_dev`, releitura de pré-condições sem garantia CAS, fila sequencial, retry apenas quando pre-commit é conhecido, falhas ambíguas sem repetição automática, cancelamento e retomada pelo `planHash`.
- Evidência offline: mock MCP stateful, seis fixtures M2, asset hidratado, reimportação, comparação quantitativa SSIM e contact sheet Chromium offline. A comunicação real com Doop permanece deliberadamente fora do escopo; CI remoto da consolidação será confirmado após o push.
- Gates locais em Node 24.16.0/Python 3.14.5t: `npm run test:ci` (343 aprovados, 0 falhos, 0 pulados), `npm run test:determinism` (PASS, hashes idênticos), `npm run test:py` (25 aprovados), `npm run skills:verify` (14 Skills), `motion doctor --json` (dependências obrigatórias PASS) e `npm pack --dry-run` (PASS; 0 arquivos da pasta local preservada). Node 22 não está instalado no host; a CI pós-push usa matriz Node 20/22/24.
- Round-trip visual offline: SSIM por fixture `01-landing=0.907`, `02-dashboard=1.000`, `03-mobile=1.000`, `04-components=0.990`, `05-prototype=1.000`, `06-dark-theme=1.000`; contact sheet em `tests/tmp/bridge-m3-fidelity/roundtrip-contact-sheet.png`.
- Limite de fidelidade: a fixture `04-components` contém referências `<doop-use>` sem conteúdo de biblioteca no mock; elas são preservadas, mas não expandidas. Seu SSIM alto não atesta a aparência do componente real. A inspeção do contact sheet confirmou essa limitação; M6 deve validar componentes em canvas de laboratório autorizado.
- Cobertura de segurança: os testes de segurança do Bridge e do hydrator passaram no CI. O scan formal do Codex Security não foi iniciado porque o workbench rejeitou a seleção do diff local como desatualizada; portanto, não há um resultado formal de scan a declarar.

## Missão M4 — Evolução do `motion mcp` Server v2 (`stdio` + Streamable HTTP) (Próxima)
1. Congelar os contratos M1–M3 e usar a execução offline do M3 como base para paridade; não ampliar o servidor Doop nem presumir métodos MCP externos ausentes.
2. **Fase 4A (`stdio`):** expor motores determinísticos (`render_static`, `render_frames`, `render_video`, `render_carousel`, `qa_determinism`, `qa_safe_zones`, `qa_viewports`, `svg_validate`, `bridge_*`) em `packages/motion-cli/lib/mcp.mjs` mantendo as 11 tools atuais intactas e ampliando `tests/mcp_parity.test.mjs`.
3. **Fase 4B (Streamable HTTP opt-in):** adicionar `--transport=http` sobre o mesmo registro/schemas com OAuth 2.1 (RFC 9728/8414/9207/8707/PKCE), controle de acesso, isolamento por `userId/projectId`, fila com concorrência limitada, cancelamento, observabilidade e suporte documentado a **Secure MCP Tunnel** para validação com ChatGPT.

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
