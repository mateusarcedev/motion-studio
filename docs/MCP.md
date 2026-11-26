# Motion MCP local (`stdio`)

O `motion mcp` inicia o servidor MCP local que chama diretamente os motores do Motion Core. Ele não abre portas de rede. O Doop mantém seu próprio MCP oficial; o agente conecta-se aos dois servidores e coordena as operações. Nenhum arquivo local é enviado a um serviço externo automaticamente.

## Instalação e execução

Até uma versão contendo M4/M5 ser publicada, use o checkout do repositório:

```bash
git clone https://github.com/mateusarcedev/motion-studio.git
cd motion-studio
npm ci
node packages/motion-cli/bin/motion.mjs doctor --json
node packages/motion-cli/bin/motion.mjs mcp --workspace=/caminho/absoluto/do/projeto --max-concurrency=2
```

O processo MCP deve ser iniciado pelo cliente configurado abaixo; não execute o último comando em um terminal separado. `--workspace` limita leituras e gravações ao projeto selecionado. As saídas precisam apontar para caminhos ainda inexistentes. `--max-concurrency` aceita 1–4 operações locais simultâneas (padrão 2); `--max-execution-ms` define o limite por chamada síncrona de ferramenta (padrão 600.000 ms, mínimo 1.000 ms, máximo 3.600.000 ms). O stdio rejeita linhas acima de 20 MiB, limita 64 pedidos pendentes, 32 operações aguardando vaga e 128 jobs retidos; o histórico remove jobs concluídos mais antigos. Node.js 20+ é obrigatório; renderização exige Chromium instalado via Playwright, e montagem de vídeo exige FFmpeg. Consulte [`docs/INSTALLATION.md`](INSTALLATION.md).

Quando uma versão atualizada do pacote estiver disponível, o executável instalado poderá ser iniciado como `motion mcp --workspace=/caminho/do/projeto`; o comando e opções são os mesmos. Esta missão não publica pacotes npm.

As Skills M5 `design-to-motion`, `motion-to-design` e `doop-bridge` podem ser instaladas do checkout no projeto consumidor com `installSkills()`; use o perfil `integration` ou `doop-bridge`. O exemplo e as limitações de distribuição estão em [`INSTALLATION.md`](INSTALLATION.md). A instalação da Skill `doop-bridge` não configura nem instala o servidor Doop.

## Configuração de clientes

Substitua `/CAMINHO/motion-studio` e `/CAMINHO/projeto` pelos caminhos absolutos da máquina. As configurações abaixo seguem os formatos documentados pelos respectivos clientes; os testes desta missão usam o cliente MCP oficial JS em subprocesso. Isso **não** equivale à homologação de cada aplicativo.

### Claude Code

Na raiz do projeto, `.mcp.json`:

```json
{
  "mcpServers": {
    "motion-studio": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/CAMINHO/motion-studio/packages/motion-cli/bin/motion.mjs",
        "mcp",
        "--workspace=/CAMINHO/projeto"
      ]
    }
  }
}
```

Ou registre com `claude mcp add --transport stdio motion-studio -- node /CAMINHO/motion-studio/packages/motion-cli/bin/motion.mjs mcp --workspace=/CAMINHO/projeto`.

### OpenAI Codex CLI

Adicione ao `~/.codex/config.toml`:

```toml
[mcp_servers.motion-studio]
command = "node"
args = ["/CAMINHO/motion-studio/packages/motion-cli/bin/motion.mjs", "mcp", "--workspace=/CAMINHO/projeto"]
```

Ou rode `codex mcp add motion-studio -- node /CAMINHO/motion-studio/packages/motion-cli/bin/motion.mjs mcp --workspace=/CAMINHO/projeto` e use `/mcp` na sessão para inspecionar conexões.

### Gemini CLI

Adicione a `.gemini/settings.json` do projeto ou `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "motion-studio": {
      "command": "node",
      "args": [
        "/CAMINHO/motion-studio/packages/motion-cli/bin/motion.mjs",
        "mcp",
        "--workspace=/CAMINHO/projeto"
      ],
      "timeout": 120000
    }
  }
}
```

Gemini CLI oferece também o comando `gemini mcp add`; confirme a sintaxe com `gemini mcp --help` na versão instalada.

### Google Antigravity

No escopo do workspace, `.agents/mcp_config.json` (ou a configuração MCP global do Antigravity):

```json
{
  "mcpServers": {
    "motion-studio": {
      "command": "node",
      "args": [
        "/CAMINHO/motion-studio/packages/motion-cli/bin/motion.mjs",
        "mcp",
        "--workspace=/CAMINHO/projeto"
      ]
    }
  }
}
```

### OpenCode

No `opencode.json` do projeto:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "motion-studio": {
        "type": "local",
        "command": [
          "node",
          "/CAMINHO/motion-studio/packages/motion-cli/bin/motion.mjs",
          "mcp",
          "--workspace=/CAMINHO/projeto"
        ],
        "cwd": "/CAMINHO/projeto"
      }
    }
  }
}
```

### Outros clientes com suporte a MCP stdio

Configure `command: "node"` e os argumentos equivalentes (`<clone>/packages/motion-cli/bin/motion.mjs`, `mcp`, `--workspace=<projeto>`), seguindo o formato específico do cliente. O processo filho precisa receber stdin/stdout como pipes locais. Não adicione redirecionamentos de stdout para arquivo ou mensagens de inicialização no canal do protocolo.

## Ferramentas

O servidor publica 30 ferramentas. As 11 ferramentas de Smart Reel, Voice Studio, STT, job status, QA e exportação permanecem compatíveis com a versão anterior. A lista completa e as descrições/schemas são retornadas por `tools/list` no início de cada conexão.

| Grupo | Ferramentas |
|---|---|
| Smart Reel, voz e jobs (compatibilidade anterior) | `motion_edit_presets`, `motion_edit_analyze`, `motion_stt_doctor`, `motion_audio_doctor`, `motion_edit_transcribe`, `motion_edit_plan`, `motion_edit_audio`, `motion_edit_render`, `motion_job_status`, `motion_qa_reel`, `motion_edit_export` |
| Renderização | `render_static`, `render_frames`, `render_video`, `render_carousel` |
| QA | `qa_determinism`, `qa_safe_zones`, `qa_viewports` |
| SVG | `svg_validate`, `svg_optimize` |
| Design Bridge local | `bridge_validate_contract`, `bridge_import_design`, `bridge_import_tokens`, `bridge_hydrate_assets`, `bridge_normalize_design`, `bridge_prototype_storyboard`, `bridge_export_plan`, `bridge_export_validate`, `bridge_doop_payload`, `bridge_export_tokens` |

Render, QA, leitura de entrada e saída são restritos ao workspace. A hidratação de URL exige `allowRemoteDownloads: true` explícito após revisar proveniência/licença; o hydrator continua aplicando anti-SSRF, MIME, tamanho, hash e sanitização. Não use uma resposta de plano como confirmação de escrita remota.

## Exemplos de chamada

Renderizar HTML local para PNG (a saída precisa ainda não existir):

```json
{
  "input": "motion/pages/hero.html",
  "output": "motion/out/hero.png",
  "width": 1080,
  "height": 1920,
  "scale": 1
}
```

Validação offline multi-viewport:

```json
{
  "input": "motion/pages/hero.html",
  "outputDir": "motion/out/hero-qa"
}
```

Fluxo Doop → Motion → Doop: o agente primeiro lê um canvas/frame com as ferramentas que **estiverem realmente disponíveis** no Doop MCP oficial; passa o resultado a `bridge_import_design`; valida/normaliza o DesignIR e cria um plano com `bridge_export_plan`; então valida o plano e pede `bridge_doop_payload`. Essa ferramenta devolve `executed: false`, nomes conhecidos e argumentos sugeridos. Antes de qualquer chamada, o agente precisa conferir novamente a lista e os schemas expostos pela conexão Doop atual, respeitar a autorização para alterações e executar as ferramentas somente pelo Doop MCP oficial. Por fim, o agente relê e verifica o resultado com o Doop MCP e registra compatibilidade. A M4/M5 não editam canvases reais.

Todas as respostas incluem `structuredContent`; erros têm `status: "FAIL"` e `{ code, message, hint }`. Artefatos gravados incluem SHA-256 e tamanho (ou hash agregado de manifesto para uma pasta). O protocolo MCP usa stdout exclusivamente; diagnósticos ficam em stderr.

## Descoberta e troubleshooting

1. Reinicie/recarregue o cliente depois de editar sua configuração.
2. Inspecione a conexão e a ferramenta `tools/list` no painel MCP ou comando do próprio cliente.
3. Confirme Node `>=20`, caminho absoluto para o checkout, permissão de execução/leitura e o `--workspace` correto.
4. Rode `node .../motion.mjs doctor --json` no ambiente do processo para diagnosticar FFmpeg, Python e Chromium.
5. Erro `MOTION_BRIDGE_PATH_TRAVERSAL`: o caminho ou symlink sai do workspace configurado. Erro `MOTION_OUTPUT_EXISTS`: selecione outro destino; arquivos existentes nunca são sobrescritos.
6. Ferramentas de render precisam de Chromium Playwright instalado; `render_video` precisa de FFmpeg.
7. Se o cliente reportar JSON/handshake inválido, remova wrappers que escrevem banners em stdout. O Motion registra startup e falhas apenas em stderr.
8. `bridge_doop_payload` não executa nada. Se uma ferramenta indicada não existir no Doop MCP conectado, não a substitua por um método presumido; reporte a limitação.

## Estado de homologação

Na M6, Claude Code 2.1.332, Codex CLI 0.172.0 e Antigravity CLI 1.5.16 passaram por smoke tests reais com conexão stdio, descoberta, render, validação de entrada insegura, retorno do PNG e encerramento. OpenCode 2.2.5 passou chamadas reais; em seu primeiro smoke, o serviço MCP filho permaneceu sob um daemon preexistente, mas no piloto OpenDesign uma configuração de projeto também chamou Motion MCP. Gemini CLI não estava instalado. A matriz detalhada está em [`COMPATIBILITY.md`](COMPATIBILITY.md).

O cliente MCP oficial JS exercitou as 30 ferramentas e as 11 ferramentas preservadas em subprocesso real. O Doop MCP oficial conectou ao laboratório autorizado; seus seis frames foram relidos e importados localmente. Um plano Motion-to-Design para adicionar 15 frames e 5 PNGs foi validado em dry-run e não executado; exige autorização específica porque cria URLs públicas permanentes. OpenDesign 0.27.2 foi homologado parcialmente pelo agente OpenCode, sem validação do loop MCP nativo do painel. Veja [`integrations/OPENDESIGN.md`](integrations/OPENDESIGN.md). Clientes exclusivamente web não conseguem iniciar Motion MCP local.

Configurações e comandos mudam ao longo do tempo. Consulte os guias oficiais antes de atualizar sua instalação: [Claude Code](https://code.claude.com/docs/en/mcp), [Codex](https://developers.openai.com/codex/mcp), [Gemini CLI](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md), [Antigravity](https://antigravity.google/docs/mcp), [OpenCode](https://opencode.ai/docs/mcp-servers/) e [cliente MCP TypeScript](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/get-started/first-client.md).
