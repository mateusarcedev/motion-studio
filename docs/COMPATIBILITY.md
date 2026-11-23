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
`be87aee`: Node 20, 22 e 24 com 268 aprovados, 0 falhos e 2 pulados; determinismo PASS. GitHub Actions:
`NOT_TESTED` até o primeiro push.
