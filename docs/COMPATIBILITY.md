# Compatibilidade — matriz única

Fonte única desde a Missão 21.1. Só conta o que foi executado; descoberta de Skills não implica execução.
O histórico de instalação e descoberta continua em `AGENT_COMPATIBILITY.md`.

## Fluxo `analyze → plan → preview → render → qa reel` (fixture sintética, 2026-11-23)

| Cliente | Versão | CLI | MCP `motion mcp` (stdio) | Evidência |
|---|---|---|---|---|
| Claude Code | 2.1.330 | funcionou | funcionou | CLI pela sessão da missão; MCP por `claude -p --strict-mcp-config`: 5 etapas, QA WARN (43 PASS, 1 WARN, 0 FAIL, 3 NOT_TESTED), 22 turnos, US$ 0,49 |
| Codex CLI | 0.171.0 | funcionou* | funcionou | 1 execução, sandbox `workspace-write`; MCP: QA WARN (43 PASS, 1 WARN, 0 FAIL, 3 NOT_TESTED). Consumo: 936.317 tokens de entrada (889.856 em cache), 3.530 de saída |
| OpenCode | 2.2.5 | funcionou | funcionou | 1 execução; mesmo QA. Consumo informado: 40.070 de entrada, 1.673 de saída, custo 0. MCP declarado com `opencode mcp add` (o formato v2 usa `mcp.servers`; o formato antigo `mcp.motion` não é lido) |
| Antigravity (`agy`) | 1.5.14 | funcionou | funcionou | 1 execução, 362 s; mesmo QA. Consumo: 83.327 de entrada, 14.535 de saída, 749.375 de cache. Só leu o MCP da configuração global (`agy mcp add`), não de `.agents/mcp_config.json`; a configuração foi restaurada |
| Gemini CLI | — | não testado | não testado | não instalado |
| Harness dos testes | Node 24.16 | funcionou | funcionou | `tests/mcp_parity.test.mjs`: mesma timeline, quadros e veredito nos dois caminhos |

\* O Codex relatou não ter capturado a saída do comando ("no output or completion status captured"), mas os
arquivos provam que o fluxo terminou: `qa.json` com WARN (43 PASS, 1 WARN, 0 FAIL, 3 NOT_TESTED).

As execuções de Codex, OpenCode e Antigravity foram autorizadas pelo dono: uma por cliente, só fixture sintética.

## Só funciona com servidor local

- `motion mcp` fala **stdio** com um processo na mesma máquina. Clientes web (claude.ai, ChatGPT e
  similares) **não alcançam** esse servidor, nem os arquivos e o FFmpeg locais. Sem suporte.
- Transcrição usa o ambiente local do faster-whisper; cards exigem Chromium local.

## Motion MCP v2 local (Missão 23 M4, 2026-11-25)

- A superfície v2 segue exclusivamente MCP `stdio`, sem HTTP, OAuth, túnel ou servidor remoto. O cliente deve iniciar o processo na mesma máquina em que estão o workspace, Node, Chromium/Playwright e FFmpeg.
- `tests/mcp_server.test.mjs` usa o cliente MCP oficial JS em subprocesso real para handshake, descoberta, preservação das 11 ferramentas anteriores, render CLI×MCP com hash de PNG idêntico, isolamento de workspace, bloqueio de symlink, schemas, limite concorrente de saída, artefatos, QA, SVG e planejamento Bridge sem chamada remota.
- Essa cobertura de protocolo não conta como homologação da versão M4 em clientes desktop específicos. Claude Code, Codex CLI, OpenCode e Antigravity têm evidência para a integração MCP anterior no quadro acima; Gemini CLI continua sem teste. Nenhuma homologação M6 ou chamada para canvas real ocorreu.
- Instalação pelo código-fonte e configurações: [`docs/MCP.md`](MCP.md).

## Modo repo-local (sem instalar Skills)

```bash
git clone --depth 1 <repo> motion-studio && cd motion-studio
npm ci && npx playwright-core install --with-deps chromium   # FFmpeg com libass no PATH
node packages/motion-cli/bin/motion.mjs doctor
node packages/motion-cli/bin/motion.mjs edit analyze video.mp4 --output=a.json
```

O CLI, o render e o QA não leem `.claude/` nem `.agents/`. Em outro projeto, `motion init --no-skills`
(só CLI e configuração) ou `motion init --skills-dir=<pasta do projeto>` (Skills ali, sem tocar em pastas de
agente). A escolha fica em `.motion/install.json` e vale nas próximas execuções; para voltar ao padrão,
`--skills-dir=.agents/skills`. Para um cliente MCP, aponte `node <clone>/packages/motion-cli/bin/motion.mjs mcp`.

## CI

`.github/workflows/ci.yml`: suíte em Node 20/22/24, testes Python, catálogo de Skills e determinismo.
Com `act` 0.2.98 (SHA-256 `d3344bd0…`, imagem `catthehacker/ubuntu:act-24.04`, FFmpeg 6.1.1):

```bash
act workflow_dispatch -j determinism -P ubuntu-24.04=catthehacker/ubuntu:act-24.04
act workflow_dispatch -j test --matrix node:22 -P ubuntu-24.04=catthehacker/ubuntu:act-24.04
```

Os testes de transcrição real são pulados e listados (o CI não baixa modelo). Resultado em 2026-11-23, commit
`e91e30a` (Missão 22), clone limpo: Node 20, 22 e 24 com 299 aprovados, 0 falhos e 2 pulados; 25 testes Python;
catálogo com 14 Skills; determinismo PASS. GitHub Actions: PASS em `7a7947b` (Missões 21 e 21.1;
[execução](https://github.com/mateusarcedev/motion-studio/actions/runs/45273665669)).

A pendência antiga de CI da `fix/reel-determinism` está encerrada: a correção foi integrada à `main` no PR #1. A branch não permanece ativa; o histórico continua nos commits e nos resultados de CI registrados acima.

## Bridge Design ↔ Motion (Missões M1–M3, 2026-11-24)

- **Escopo verificado localmente (Linux x64 / Node 24.16.0 / Chromium Playwright / FFmpeg / Python 3.14.5t em `.venv`; matriz Node 20/22/24 validada pelo workflow `.github/workflows/ci.yml` — Node 22 não está instalado localmente neste host):**
  - `Asset Hydrator` (`packages/motion-core/bridge/assets.mjs`): download por streaming com pinagem DNS em tempo de socket (defesa contra SSRF e DNS rebinding A+AAAA), bloqueio padrão de loopback/IPs privados/notações alternativas IPv4 e IPv6, validação manual de redirecionamentos sem vazamento de `Authorization`/`Cookie`, TLS estrito, proteção contra bomba de descompressão/respostas truncadas, checagem de assinatura binária + MIME, sanitização SVGO e emissão de `AssetProvenanceManifest@1` + `assets.manifest.json`.
  - Sanitização estruturada (`packages/motion-core/bridge/security.mjs` + `svg/svg-tools.mjs`): tokenizador HTML + decodificação de entidades + AST CSS (`css-tree`) + `svgo`.
  - Normalizador (`packages/motion-core/bridge/normalize.mjs`) & `Prototype-to-Storyboard` (`packages/motion-core/bridge/prototype-to-storyboard.mjs`): conversão determinística para `frame.js`, `svg-motion.js`, `carousel`, `story` e `web-director`, além de geração de `STORYBOARD.md` sem inventar interações.
  - Exportador Seguro Motion-to-Design (`packages/motion-core/bridge/export-to-editor.mjs`, contratos `ExportPlan@1`, `ExportOperation@1`, `ExportResult@1`, `ExportCompatibilityReport@1` e `DoopAdapter` M3 em `packages/motion-core/bridge/adapters/doop.mjs`): pipeline de 5 estágios (`Inspect → Plan → Validate → Execute → Verify`), `dry-run` obrigatório sem escritas, proteção estrita de `ready_for_dev` e conflito de revisão pré-escrita (`BRIDGE_EXPORT_CONFLICT` por releitura — o Doop MCP não fornece CAS atômico), remoção de `:root` e zero `base64` em frames, promoção de SVG `> 20 KB` para `upload_asset`, strip de metadados PNG/JPEG/WebP, bloqueio de arquivos confidenciais/licenças restritivas, autorização explícita antes de upload para URL pública permanente, limite conservador de imagem de `5.000.000` bytes, deduplicação SHA-256, teto de `15/min` e um upload por vez compartilhados entre execuções no mesmo transporte MCP, retomada idempotente e marcação não-reexecutável de timeouts `ambiguous`. Validado offline contra servidor mock stateful do protocolo Doop MCP (nenhum canvas real modificado) com round-trip `Doop → Motion → Doop → Motion` em 6 fixtures representativas + asset hidratado; SSIM por fixture: `0.907`, `1.000`, `1.000`, `0.990`, `1.000`, `1.000`.
  - Renderização offline (`--offline` em `render_static.mjs` e `render_frames.mjs`): `serviceWorkers: "block"` + interceptação `context.route("**/*")` abortando qualquer requisição externa fora da origem local do estúdio; determinismo verificado via `verifyDeterminism` em duas sessões Chromium independentes no mesmo ambiente (não afirma identidade binária entre sistemas operacionais ou builds distintos de Chromium/fontes).
  - Suíte Python (`npm run test:py`): testes aprovados com `.venv` isolado (`numpy 2.5.5`, `scipy 1.18.1`, `pillow 13.0.0`); CI permanece fixado em Python `3.12`.
  - Gates locais em 2026-11-24 (Node 24.16.0): `npm run test:ci` — 343 aprovados, 0 falhos, 0 pulados; `npm run test:determinism` — PASS, todos os hashes idênticos; `npm run test:py` — 25 aprovados; `npm run skills:verify` — 14 Skills verificadas; `motion doctor --json` — dependências obrigatórias PASS; `npm pack --dry-run` — PASS. A pasta pessoal `Skills para adicionar e apagar/` foi excluída do pacote via `.gitignore` e conferida com zero arquivos empacotados. O pacote raiz tem 466 MB compactados por conteúdo pré-existente do monorepo. Node 22 não está instalado neste host; o CI pós-push validará a matriz Node 20/22/24.
