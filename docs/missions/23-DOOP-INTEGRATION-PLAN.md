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

## Missão M3 — Exportador Seguro `Motion-to-Design` (Concluída; CI remoto aprovado)
- Implementação em `packages/motion-core/bridge/export-to-editor.mjs`: `Inspect → Plan → Validate → Execute → Verify`, contratos `ExportPlan@1`, `ExportOperation@1`, `ExportResult@1` e `ExportCompatibilityReport@1`, capacidades opcionais retrocompatíveis do `EditorAdapter` e `DoopAdapter` limitado aos nomes e parâmetros MCP verificados em 2026-11-24.
- O mock usa apenas ferramentas MCP disponíveis: `get_canvas`, `get_frame`, `create_frame`, `set_frame_html`, `append_frame_html`, `edit_frame_html`, `upload_asset`, `get_frame_screenshot`, `get_prototype` e `save_decision`. Não há ferramentas MCP disponíveis para leitura/escrita de tokens ou componentes; valores globais ficam intactos e sua leitura é reportada como não verificada. Fontes são bloqueadas porque `upload_font` não está disponível.
- Dry-run produz um plano determinístico sem escrita. A autorização de upload público é falsa por padrão; assets usam o grant `upload_asset(local_file: true)` e transporte injetado, com limite conservador de 5.000.000 bytes por imagem, hash SHA-256, deduplicação e teto compartilhado de 15 uploads/min + um upload por vez entre execuções que reutilizam o mesmo transporte MCP. `uploadRateLimitScope` permite compartilhar a fila entre adapters. Não há transporte remoto real nem canvas modificado nesta missão.
- Saídas distinguem HTML editável, assets rasterizados e referências de poster/storyboard. CSS local de tokens/temas, responsividade, SVG seguro, `data-doop-*` e `<doop-use>` são preservados quando compatíveis. Vídeo/3D/JavaScript não são declarados como reprodução nativa.
- Proteções: licença/proveniência, privacidade, sanitização, strip de metadados PNG/JPEG/WebP, MIME/tamanho, proteção de `ready_for_dev`, releitura de pré-condições sem garantia CAS, fila sequencial, retry apenas quando pre-commit é conhecido, falhas ambíguas sem repetição automática, cancelamento e retomada pelo `planHash`.
- Evidência offline: mock MCP stateful, seis fixtures M2, asset hidratado, reimportação, comparação quantitativa SSIM e contact sheet Chromium offline. A comunicação real com Doop permanece deliberadamente fora do escopo. O CI remoto da consolidação em `main` foi aprovado; confira a execução associada ao commit `b8e7d63` no GitHub Actions.
- Gates locais em Node 24.16.0/Python 3.14.5t: `npm run test:ci` (343 aprovados, 0 falhos, 0 pulados), `npm run test:determinism` (PASS, hashes idênticos), `npm run test:py` (25 aprovados), `npm run skills:verify` (14 Skills), `motion doctor --json` (dependências obrigatórias PASS) e `npm pack --dry-run` (PASS; 0 arquivos da pasta local preservada). Node 22 não está instalado no host; a CI pós-push usa matriz Node 20/22/24.
- Round-trip visual offline: SSIM por fixture `01-landing=0.907`, `02-dashboard=1.000`, `03-mobile=1.000`, `04-components=0.990`, `05-prototype=1.000`, `06-dark-theme=1.000`; contact sheet em `tests/tmp/bridge-m3-fidelity/roundtrip-contact-sheet.png`.
- Limite de fidelidade: a fixture `04-components` contém referências `<doop-use>` sem conteúdo de biblioteca no mock; elas são preservadas, mas não expandidas. Seu SSIM alto não atesta a aparência do componente real. A inspeção do contact sheet confirmou essa limitação; M6 deve validar componentes em canvas de laboratório autorizado.
- Cobertura de segurança: os testes de segurança do Bridge e do hydrator passaram no CI. O scan formal do Codex Security não foi iniciado porque o workbench rejeitou a seleção do diff local como desatualizada; portanto, não há um resultado formal de scan a declarar.

## Missão M4 — Motion MCP Server v2 local (`stdio`)

1. Evoluir o único `motion mcp` existente como interface local dos motores do Motion Core, mantendo inalteradas as 11 ferramentas legadas e sem dependência do Doop MCP.
2. Expor renderização, QA, SVG e Design Bridge apenas quando há implementação real no Motion Core; validar parâmetros, limitar workspace/concorrência, permitir cancelamento onde suportado e devolver resultados estruturados com hashes dos artefatos.
3. Operar somente por `stdio`; stdout é reservado ao protocolo e diagnósticos vão para stderr. As operações que exigem o Doop MCP oficial retornam planos/payloads `executed: false` para o agente inspecionar e executar no servidor oficial.
4. Documentar instalação local e configurações dos clientes com exemplos baseados em suas documentações oficiais, sem afirmar homologação além dos testes realmente realizados.
5. Executar os quality gates obrigatórios antes de checkpoint commit. Status: **concluída; checkpoint M4**.

**Validação M4 (ambiente local Node 24.16.0):** `npm run test:ci` (350 aprovados, 0 falhos, 0 pulados); `npm run test:determinism` (PASS, hashes idênticos); `npm run test:py` (25 aprovados); `npm run skills:verify` (14 Skills existentes antes da M5); `node packages/motion-cli/bin/motion.mjs doctor --json` (dependências obrigatórias PASS); `npm pack --dry-run` (PASS; 10.800 arquivos, 466,1 MB compactados e 675,6 MB descompactados). `git diff --check` também passou. Este host só disponibiliza Node 24.16.0; a matriz de CI do repositório cobre Node 20/22/24.

## Missão M5 — Skills (`design-to-motion`, `motion-to-design`, `doop-bridge`)
- Criar e publicar no catálogo local/npm `design-to-motion`, `motion-to-design` e `doop-bridge`, roteando para Skills e motores existentes sem duplicá-los.
- Tratar Doop MCP como integração externa opcional; a Skill inspeciona capacidades disponíveis e nunca inventa ferramenta ou operação.
- Atualizar perfis, metadados em `optional-integrations.json`, manifestos, hashes, lockfile, instalação e roteamento; registrar testes e gates. Status: **concluída**.

**Validação M5 (ambiente local Node 24.16.0):** `npm run test:ci` (354 aprovados, 0 falhos, 0 pulados); `npm run test:determinism` (PASS, hashes idênticos); `npm run test:py` (25 aprovados); `npm run skills:verify` (17 Skills públicas + 4 registros locais no `skills-lock.json`); `node packages/motion-cli/bin/motion.mjs doctor --json` (dependências obrigatórias PASS; catálogo de 17 Skills); `npm pack --dry-run` (PASS; 10.808 arquivos, 466,1 MB compactados e 675,6 MB descompactados); `git diff --check` (PASS). O teste M5 inicia `motion init --profile=integration` em um projeto temporário e simula Doop conectado/desconectado com a fixture de ferramentas verificadas; não executa chamadas externas nem altera canvases.

## Missão M6 — Piloto E2E Controlado & Release Gate (**parcialmente homologada; Doop executado, OpenDesign e incidente de determinismo pendentes**)
- **Escopo externo:** somente o canvas `Motion Studio — Integration Lab` (`Gz620okdHY`). A autorização posterior permitiu 15 frames, cinco uploads sintéticos planejados, inserção, screenshots/readbacks e correções nos frames novos. Nenhum outro canvas foi tocado.
- **Doop Design-to-Motion:** os seis frames originais foram lidos, importados, validados, normalizados e renderizados localmente. Cinco fluxos `click → navigate` foram confirmados. A landing local passou nos cinco viewports através do target `web-director`.
- **Doop Motion-to-Design:** 35/35 operações planejadas concluídas: cinco uploads PNG com download/hash posterior coincidente, 15 frames adicionados e 15 screenshots/readbacks. O canvas final tem 21 frames; os hashes dos seis originais permanecem iguais. Plano SHA-256 `8c4c7ac53a3834e7fbf0136e80e7ee586da03787c88f5c2064e22f0f08491e50`; ledger em [`execution-evidence.json`](../../projects/m6-herbario-de-nevoa/evidence/doop-lab/motion-to-design/execution-evidence.json). O frame 10 recebeu edição posterior do usuário e foi preservado.
- **Fidelidade e limites Doop:** markup e assets verificados; comparação visual qualitativa, sem SSIM. Vídeo é representado por stills rasterizados; a landing no editor é artboard fixo e responsividade foi testada localmente. Tokens globais, biblioteca global, expansão `<doop-use>`, upload de fontes e CAS atômico continuam indisponíveis no catálogo observado.
- **OpenDesign 0.27.2:** projeto local isolado, 16 Skills instaladas e nove lidas pelo OpenCode CLI; 30 ferramentas Motion MCP descobertas e chamadas locais. O handshake do MCP próprio não alcançou o daemon Windows via WSL (`UtilAcceptVsock: accept4 failed 110`); o painel observado não injetou o Motion MCP. O vídeo novo solicitado pelo agente parou em HTTP 429. Status parcial, sem alegar compatibilidade nativa ou importar arquivos como layers nativas. Ver [`integrations/OPENDESIGN.md`](../integrations/OPENDESIGN.md) e [`reports/OPENDESIGN_INTEGRATION_PILOT.md`](../reports/OPENDESIGN_INTEGRATION_PILOT.md).
- **QA por composição:** `resolveQualityRouting` separa websites responsivos, artboards fixos, carrosséis, stories, vídeos e composições animadas; critérios de overflow responsivo permanecem sem enfraquecimento.
- **Determinismo Node 24:** dois testes locais de paridade passaram (Node 24.16.0, FFmpeg 8.0.1, Chromium 156.0.8078.4), com hashes de vídeo decodificado, pacotes, áudio e contêiner idênticos. Isso não reproduziu a falha histórica de CI (Node 24.22.3/FFmpeg 6.1.1); causa raiz não comprovada. Incidente permanece aberto, sem mudança de critério.
- **Release:** nenhum pacote npm publicado e nenhuma versão alterada. Proposta `1.2.0` permanece proposta; gates locais e CI final são registrados no relatório M6.

**Resultado M6 (2026-11-26):** produção local concluída e round-trip Doop homologado no escopo autorizado. O estado geral é **parcialmente homologado** por handshake/painel OpenDesign ainda não demonstrados, vídeo via agente bloqueado por 429 e incidente intermitente Node 24 sem causa raiz. Relatório consolidado: [`MISSION_23_M6_REPORT.md`](../reports/MISSION_23_M6_REPORT.md).

**Pendências não bloqueantes para o Motion Studio:** reabrir teste de handshake OpenDesign quando daemon Windows/integração WSL acessível; repetir a produção de vídeo somente quando o provedor configurado permitir; investigar o incidente Node 24 comparando ambientes CI/local. Tokens/componentes/fontes/CAS do Doop são limitações externas, não tarefas pendentes que bloqueiem produção local.

**Gates remotos anteriores da M6:** CI PASS no commit `c0e2ec0ee719fab1ed340601344891e7dea8e8a5` — testes Node 20/22/24 e determinismo, 4/4 jobs. [Execução GitHub Actions](https://github.com/mateusarcedev/motion-studio/actions/runs/45757036913). Nesta continuação, `test:ci` aprovou 364 testes, `test:determinism`, 25 testes Python, Skills, Doctor e empacotamento passaram. O release gate instalou os quatro tarballs em diretório limpo; Node 20/22 não estão instalados localmente, e os pacotes 1.1.1 já existem no registry. Nada foi publicado. O CI desta continuação aprovou Node 20/22/24 e determinismo em 4/4 jobs no commit `58c21a1a01c65cb4dcae67cdca22099332c97dcf`; [execução GitHub Actions](https://github.com/mateusarcedev/motion-studio/actions/runs/45853277921).

**CI final após a execução autorizada Doop e a atualização dos relatórios:** PASS em 4/4 jobs no commit `5ebbc30fd82bd0a3e22463d2f7a576093d12bc6b` — determinismo e testes completos em Node 20, 22 e 24. [Execução GitHub Actions](https://github.com/mateusarcedev/motion-studio/actions/runs/45873168038).

**CI do commit documental final `a19c9d7`:** PASS em 4/4 jobs após retry de Node 24, cujo setup do Chromium recebeu HTTP 403 na primeira tentativa. [Execução GitHub Actions](https://github.com/mateusarcedev/motion-studio/actions/runs/45874719534).

**CI da investigação final `0525b3f`:** testes Node 20/22/24 passaram. A primeira tentativa do job de determinismo falhou no estágio final, apesar de segmentos, overlay, legendas e áudio intermediários idênticos: hashes do vídeo decodificado, pacotes de vídeo e contêiner divergiram em quatro frames; hashes do áudio ficaram idênticos. A reexecução apenas do job falho passou. Isso confirma intermitência em Node 22.23.5/FFmpeg 6.1.1-3ubuntu5, sem causa raiz confirmada; a falha histórica Node 24 também segue aberta. Evidência detalhada e hashes: [`ci-run-45877470125-node22-report.json`](../../projects/m6-herbario-de-nevoa/evidence/node24-determinism/ci-run-45877470125-node22-report.json), SHA-256 `a2dc1a7a088dc889ced1533d27a5732d00960eb84f2500e4ec148f7973e473e7`. [Execução GitHub Actions](https://github.com/mateusarcedev/motion-studio/actions/runs/45877470125).

**Pacotes e release:** os tarballs locais 1.1.1 foram instalados em ambiente temporário limpo; nenhum pacote foi publicado e nenhuma versão foi alterada. A recomendação e proposta de changelog v1.2.0 estão em [`docs/reports/RELEASE_NOTES_1.2.0_PROPOSAL.md`](../reports/RELEASE_NOTES_1.2.0_PROPOSAL.md). O round-trip Motion-to-Design foi homologado no canvas e escopo autorizados. Tokens globais, componentes/`<doop-use>`, upload de fontes e CAS atômico continuam indisponíveis; OpenDesign nativo e incidente de determinismo Node 22/24 permanecem parciais/abertos.

As lacunas gerais de interoperabilidade permanecem documentadas para referência futura em [`docs/roadmap/UNIVERSAL_DESIGN_BRIDGE.md`](../roadmap/UNIVERSAL_DESIGN_BRIDGE.md); esta referência não inicia nova missão.

### Arquitetura vigente (M4–M6)

- `motion mcp` é exclusivamente um processo local MCP `stdio`; não há servidor HTTP nem acesso por clientes web.
- Não desenvolver OAuth 2.1, Secure MCP Tunnel, hospedagem remota, autenticação multiusuário, proxy/serviço intermediário do Doop ou infraestrutura remota de execução.
- O agente coordena os dois servidores MCP. O Motion MCP transforma e produz localmente; o Doop MCP oficial acessa e altera o editor segundo suas ferramentas e autorizações reais.
- A antiga proposta HTTP/OAuth preserva-se nos registros ADR históricos, mas foi supersedida pela decisão arquitetural vigente.

---

## Critérios de Aceite Gerais
- Toda a suíte existente (`test:ci`, `test:py`, `test:determinism`, `skills:verify`) passa sem regressões.
- Contratos JSON, validação anti-SSRF/XSS/traversal/*prompt injection* e determinismo do bridge cobertos por testes automatizados.
- Zero dependências de IA pagas no `motion-core` e zero delegação automática para `@doop`.
