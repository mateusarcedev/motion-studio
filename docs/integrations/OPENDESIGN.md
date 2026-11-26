# OpenDesign × Motion Studio

## Escopo e estado

Esta integração é opcional e local. Motion Core permanece independente do OpenDesign. Motion MCP roda por `stdio` e Skills coordenam o agente com os arquivos do projeto.

M6 examinou o OpenDesign instalado em **0.27.2**, release commit [`d9691d7a8ba21ab57c52916dcf07ea87598e04fc`](https://github.com/nexu-io/open-design/tree/d9691d7a8ba21ab57c52916dcf07ea87598e04fc). A aplicação é desktop Electron, guarda projetos no perfil local e distribui um daemon CLI (`daemon-cli.mjs`) com operações de projeto, arquivos, artefatos e MCP `stdio`. O CLI não estava no `PATH` WSL como `od`; foi chamado pelo executável instalado no Windows.

O OpenDesign delega a execução do agente a um adaptador/CLI instalado. O app desta máquina usa OpenCode empacotado 1.19.6; o OpenCode disponível no WSL era 2.2.5. A execução de um agente pelo painel do app terminou com `process_exit` (3221225786) e não produziu artefatos. A execução de projeto OpenCode 2.2.5 leu as Skills e descobriu Motion MCP via a configuração do projeto; depois parou quando o provedor configurado devolveu `429 FreeUsageLimitError`. Um smoke separado do mesmo agente chamou `render_static` pelo Motion MCP e produziu `design-output/mcp-smoke.png` (37.814 bytes, SHA-256 `91e3a1dc5a3dd193bd04a6fb4f54bebfb8489f585805c49446ef92b0650788ef`).

**Estado: parcial.** OpenCode via configuração local de projeto conectou ao Motion MCP. Isso não comprova que o painel/loop de agente do OpenDesign encaminha servidores MCP externos. O próprio MCP do OpenDesign está implementado no pacote instalado, mas seu handshake não foi concluído neste ambiente WSL/Windows; não declaramos integração nativa homologada.

## Projeto isolado

Foi criado no OpenDesign o projeto local **Motion Studio — Integration Lab**, ID `04691291-53a3-44d0-b4ce-5d1cb1bb091e`, sem editar projetos anteriores. Caminho local:

```text
C:\Users\marce\AppData\Roaming\Open Design\namespaces\release-stable-win\data\projects\04691291-53a3-44d0-b4ce-5d1cb1bb091e
```

O perfil do projeto recebeu 16 Skills públicas. As onze solicitadas estão presentes em `.agents/skills/`; nove relevantes foram carregadas na sessão OpenCode: `studio-director`, `motion-director`, `web-director`, `design-to-motion`, `motion-to-design`, `carousel-studio`, `story-studio`, `shorts-director` e `cinematic-product-director`. `reel-editor` ficou fora porque não havia um reel existente para editar; `3d-scene-director` ficou fora porque a campanha é 2D.

Uma configuração **somente neste projeto**, [opencode.json de referência](../../projects/m6-herbario-de-nevoa/evidence/opendesign/opencode.project.example.json), usa o OpenCode v2 `mcp.servers`, `type: local`, Node, `packages/motion-cli/bin/motion.mjs mcp` e `--workspace` apontado à raiz do projeto. Nenhum arquivo global/pessoal foi alterado. O caminho do Node deve corresponder ao runtime do agente no host do usuário.

## Arquivos de produção e verificação

O projeto reutiliza a campanha fictícia **Herbário de Névoa** da M6, seus tokens, paleta, tipografia, carrossel, story, storyboard, SVGs, MP4s e quadros. Foram acrescentadas variantes locais de dashboard e mobile e um cartão de espécime em HTML. O materializador só grava quando o ID de projeto permitido coincide; ele não envia assets a serviços externos.

`design-output/production/` contém 41 arquivos de produção, 1.927.522 bytes; manifesto SHA-256 `f7c5b091025079f49037a1cecabf5b2c6b3ad65ebecfe7318414216e50e9aa5b`. O cliente MCP oficial de referência descobriu 30 ferramentas e schemas de entrada/saída. Motion MCP renderizou nove previews, validou SVG e passou a landing pelos cinco viewports: 360×740, 390×844, 768×1024, 1280×800 e 1920×1080, sem overflow ou issues. Capturas, hashes e respostas estão em [`motion-mcp-results.json`](../../projects/m6-herbario-de-nevoa/evidence/opendesign/motion-mcp-results.json); o comando reprodutível é [`capture-project-evidence.mjs`](../../projects/m6-herbario-de-nevoa/evidence/opendesign/capture-project-evidence.mjs).

Os arquivos HTML/CSS/JSON/SVG são texto editável no workspace. A captura via Motion MCP demonstra render local; não prova importação para camadas ou componentes nativos do OpenDesign. O HTML de cartão não é uma instância da biblioteca nativa do editor. Não foi executada uma produção completa de vídeo pelo agente do OpenDesign.

## Configuração por projeto

Na raiz do projeto OpenDesign, configure o OpenCode usado naquele projeto. Exemplo POSIX/WSL:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "motion-studio": {
        "type": "local",
        "command": [
          "/caminho/para/node",
          "/caminho/para/motion-studio/packages/motion-cli/bin/motion.mjs",
          "mcp",
          "--workspace",
          "/caminho/para/projeto-opendesign"
        ],
        "cwd": "/caminho/para/projeto-opendesign",
        "timeout": 30000
      }
    }
  }
}
```

Verifique pelo agente usado pelo OpenDesign:

```bash
opencode mcp list
opencode run 'Use o Motion MCP para renderizar design-output/production/website/index.html para uma PNG dentro de design-output/production/qa.'
```

O teste M6 foi **indireto**: OpenCode CLI 2.2.5 executado na pasta do projeto leu a configuração e chamou Motion MCP. A configuração não foi registrada na conta OpenDesign nem em `app-config.json`. O processo do painel usa a versão empacotada 1.19.6 e não compartilhou aquela lista MCP no teste observado.

## Skills

Use o instalador/profile já existente, sem duplicar Skills ou criar forks para OpenDesign:

```bash
node /caminho/para/motion-studio/packages/motion-cli/bin/motion.mjs init \
  --brand=herbario-de-nevoa \
  --profile=integration,motion,social,3d \
  --agents=opencode \
  --skip-install
```

OpenCode procura Skills em `.agents/skills` e `.opencode/skills`. No projeto piloto, `.agents/skills` foi instalado e nove Skills foram efetivamente lidas. As duas Skills condicionais acima não foram invocadas porque o trabalho não editava um reel e não usava 3D. Outros agentes só devem ser marcados compatíveis após teste próprio.

## Matriz Doop × OpenDesign

| Capacidade | Doop | OpenDesign |
|---|---|---|
| Integração com agentes | PASS — MCP oficial conectado e operações de leitura no laboratório | PARTIAL — agente do app delega para CLI; smoke via OpenCode 2.2.5 funcionou |
| MCP próprio | PASS — servidor oficial disponível na sessão | PARTIAL — servidor stdio consta no app instalado; handshake local não foi concluído |
| MCP externo | NOT_TESTED — sem contrato verificado para registrar servidor externo | PARTIAL — configurado e chamado por OpenCode do projeto; painel do app não encaminhou MCP no teste |
| Skills externas | PARTIAL — fluxo Motion usa Skills e MCPs pelo agente | PASS — 16 Skills instaladas no projeto; nove solicitadas lidas pelo OpenCode |
| Importação de HTML | PARTIAL — frames podem conter HTML; fluxo novo ficou em dry-run | PARTIAL — arquivo HTML local; importação como design nativo não testada |
| Exportação de HTML | NOT_AVAILABLE — catálogo atual não fornece exportação HTML | PARTIAL — HTML gravado no projeto; exportação nativa do editor não testada |
| SVG | PARTIAL — SVG inline/upload disponível; round-trip novo pendente | PARTIAL — SVG local validado pelo Motion MCP; camada nativa não testada |
| Design tokens | BLOCKED — tokens globais não expostos; CSS local funciona | PARTIAL — JSON/CSS editáveis, sem modelo semântico nativo homologado |
| Componentes | NOT_AVAILABLE — biblioteca e expansão de `<doop-use>` indisponíveis | PARTIAL — cartão HTML editável; componente nativo não verificado |
| Protótipos | PASS — cinco ações/destinos do frame de laboratório relidos | NOT_TESTED |
| Editabilidade | PARTIAL — HTML dos frames editável; round-trip não testado | PARTIAL — texto HTML/CSS/SVG editável; camadas nativas não verificadas |
| Assets locais | BLOCKED — transferência pública não autorizada neste plano | PASS — assets locais no projeto e renderização local |
| Design-to-Motion | PASS — seis frames importados/normalizados/renderizados localmente | PARTIAL — HTML/SVG local renderizados; importação Design Bridge não executada |
| Motion-to-Design | BLOCKED — 15 frames/5 uploads em dry-run aguardam autorização | PARTIAL — arquivos copiados ao projeto; releitura via OpenDesign MCP não validada |
| Produção usando Motion MCP | PASS — chamadas locais após importação do canvas | PARTIAL — smoke `render_static` por OpenCode passou; produção completa pelo painel falhou |
| Fidelidade visual | PARTIAL — seis screenshots relidas; sem SSIM de round-trip | PARTIAL — previews revisados; sem comparação de importação nativa |
| Execução offline | NOT_AVAILABLE — editor/MCP oficial remoto | PARTIAL — Motion MCP e previews locais funcionam sem upload; app/daemon offline não homologado |

## Limitações Doop que permanecem

- Tokens globais e biblioteca global de componentes: ausentes no catálogo público visto.
- `<doop-use>`: referência preservada; expansão da biblioteca não suportada.
- Upload de fontes: não existe ferramenta pública verificada.
- CAS atômico: o Doop MCP não fornece controle de revisão compare-and-swap; a ponte só pode reler antes da escrita e detectar conflito antes de tentar.
- O dry-run não escreve nem reserva nomes. Enviar PNGs com `upload_asset` cria URLs públicas permanentes; isso requer autorização antes da execução.

O Bridge atual importa frames através do adapter específico do Doop (`bridge_import_design` espera frame JSON do Doop e grava `source.editor: "doop"`). Embora `bridge_normalize_design` aceite `MotionDesignIR@1`, não existe extractor suportado do projeto OpenDesign (árvore de HTML/CSS/JSON/SVG e metadados/componentes) para esse contrato. Os arquivos locais foram renderizados diretamente; não foram rotulados como Doop nem importados como DesignIR. Um adapter OpenDesign completo não foi implementado por estar fora do piloto. Esse gap não bloqueia render, QA, SVG ou normalização dos Designs já contratados; consulte o [roadmap do Universal Design Bridge](../roadmap/UNIVERSAL_DESIGN_BRIDGE.md).

## Fontes oficiais

- [OpenDesign agent adapters no commit testado](https://github.com/nexu-io/open-design/blob/d9691d7a8ba21ab57c52916dcf07ea87598e04fc/docs/agent-adapters.md)
- [OpenDesign Skills protocol no commit testado](https://github.com/nexu-io/open-design/blob/d9691d7a8ba21ab57c52916dcf07ea87598e04fc/docs/skills-protocol.md)
- [OpenDesign plugin specification no commit testado](https://github.com/nexu-io/open-design/blob/d9691d7a8ba21ab57c52916dcf07ea87598e04fc/docs/plugins-spec.md)
- [OpenCode MCP servers](https://opencode.ai/docs/mcp-servers/)
- [OpenCode Skills discovery](https://opencode.ai/docs/skills/)
