# OpenDesign × Motion Studio

## Escopo e estado

A integração é opcional e local. Motion Core permanece independente do OpenDesign; Motion MCP usa exclusivamente `stdio`. O agente pode coordenar o MCP do Motion Studio com o aplicativo/editor, sem proxy remoto.

O OpenDesign instalado foi **0.27.2**, commit [`d9691d7a8ba21ab57c52916dcf07ea87598e04fc`](https://github.com/nexu-io/open-design/tree/d9691d7a8ba21ab57c52916dcf07ea87598e04fc), Electron 41.3.0 com Node 24.15.0. O app fica em `C:\Users\marce\AppData\Local\Programs\Open Design`; o perfil `release-stable-win` fica em `C:\Users\marce\AppData\Roaming\Open Design\namespaces\release-stable-win\data`. O agente empacotado é OpenCode 1.19.6. Um OpenCode 2.2.5 separado está instalado no WSL.

**Estado: parcialmente homologado, integração nativa não concluída.** O OpenCode 2.2.5, executado diretamente no projeto isolado, conectou ao Motion MCP e gerou um PNG real. Isso demonstra o caminho indireto pelo agente subjacente, não o acesso ao MCP a partir do painel/loop nativo do OpenDesign. O MCP próprio do OpenDesign está documentado e empacotado, mas não completou handshake neste ambiente.

## Projeto isolado

O projeto **Motion Studio — Integration Lab**, ID `04691291-53a3-44d0-b4ce-5d1cb1bb091e`, foi criado no perfil existente sem tocar em outros projetos. Não foram alteradas configurações globais/pessoais de OpenDesign, OpenCode ou de outros agentes. O projeto e o inventário de Skills estão detalhados no [relatório do piloto](../reports/OPENDESIGN_INTEGRATION_PILOT.md).

## Diagnóstico do handshake nativo

O CLI fornecido pela instalação em `resources/app/prebundled/daemon/daemon-cli.mjs` documenta `od mcp` como servidor MCP `stdio` que encaminha chamadas para o daemon local OpenDesign, normalmente em `127.0.0.1:7456`. A ajuda do executável instalado foi consultada; não foi usado endpoint privado do Motion Studio nem endpoint HTTP próprio.

Na sessão de diagnóstico:

- O perfil `app-config.json` não continha um registro MCP externo do Motion Studio.
- O daemon reportou `clean_shutdown` e terminou limpidamente; não havia processo Linux do OpenDesign nem listener local nas portas 7456, 7457 ou 7460.
- A tentativa de acessar o processo Windows/daemon a partir do WSL falhou na camada de interop (`UtilAcceptVsock: accept4 failed 110`), antes de um handshake MCP válido.
- O painel executou o agente embutido, mas o processo terminou com `process_exit` / código `3221225786`; o bundle não encaminhou uma lista de servidores MCP (`toolBundle.mcpServers` vazio na execução observada).
- O `opencode.json` existente no projeto é POSIX/WSL e aponta para Node e caminhos Linux. Ele funciona com o OpenCode CLI do WSL, mas não prova que os caminhos/configurações sejam consumidos pelo agente Windows empacotado.

Portanto, a evidência aponta para ausência de daemon acessível entre Windows e WSL e ausência de configuração de servidor no loop do painel observado. Não prova incompatibilidade geral do protocolo: a documentação oficial da versão descreve injeção de MCP externo no adaptador do agente. A integração nativa pode ser tentada novamente quando o daemon Windows estiver acessível e houver um mecanismo suportado para registrar o Motion MCP no agente do painel. Nenhuma configuração pessoal foi alterada para contornar a falha.

Uma execução separada do agente no OpenCode 2.2.5 chegou a chamar o Motion MCP, mas a produção solicitada foi interrompida pelo provedor configurado com `429 FreeUsageLimitError`. Não houve troca de provedor nem nova tentativa para contornar o limite. Um smoke independente anterior permanece evidência válida apenas de `render_static`: PNG de 37.814 bytes, SHA-256 `91e3a1dc5a3dd193bd04a6fb4f54bebfb8489f585805c49446ef92b0650788ef`. Não é evidência de um novo vídeo de 15 segundos.

## Motion MCP e Skills

No projeto isolado foi preservada a configuração por projeto do OpenCode CLI, com Node, entrypoint `packages/motion-cli/bin/motion.mjs`, comando `mcp`, transporte local `stdio` e `--workspace` delimitado ao projeto. O MCP de referência descobriu 30 ferramentas e executou nove renders, QA nos cinco viewports e validação SVG. O script e as respostas com hashes estão em [`motion-mcp-results.json`](../../projects/m6-herbario-de-nevoa/evidence/opendesign/motion-mcp-results.json).

O perfil local contém 16 Skills públicas, incluindo as onze pedidas. Nove foram carregadas pelo OpenCode CLI: `studio-director`, `motion-director`, `web-director`, `design-to-motion`, `motion-to-design`, `carousel-studio`, `story-studio`, `shorts-director` e `cinematic-product-director`. `reel-editor` e `3d-scene-director` não foram invocadas por não se aplicarem ao trabalho 2D executado. A descoberta efetiva pelo agente do painel OpenDesign não foi demonstrada. O projeto usa a distribuição e os perfis existentes do Motion Studio; não há cópia específica das Skills para OpenDesign.

## Formatos, importação e fidelidade

O projeto local contém HTML, CSS, JSON/tokens, SVG, PNGs, MP4s e storyboard da campanha fictícia **Herbário de Névoa**. O inventário e o manifesto estão no [relatório](../reports/OPENDESIGN_INTEGRATION_PILOT.md). Os renders confirmam que o Motion MCP lê esses arquivos do workspace e produz imagens. Não confirmam importação desses arquivos como camadas ou componentes nativos do OpenDesign.

O `bridge_import_design` atual exige frame JSON Doop e marca a proveniência Doop. `bridge_normalize_design` aceita `MotionDesignIR@1`, mas não existe extractor suportado de um projeto OpenDesign para esse contrato. Não rotulamos arquivos OpenDesign como Doop nem implementamos um adapter específico no piloto. HTML/CSS/JSON/SVG ficam editáveis como texto; vídeo e imagens são referências rasterizadas; semântica nativa de componentes, tokens, protótipos, timeline e reimportação não foi homologada.

## Matriz Doop × OpenDesign

Estados descrevem as operações efetivamente verificadas nesta instalação. `PARTIAL` não significa compatibilidade integral.

| Capacidade | Doop | OpenDesign |
|---|---|---|
| Integração com agentes | PASS — MCP oficial utilizado no laboratório | PARTIAL — execução direta por OpenCode funcionou; painel não demonstrou handoff |
| MCP próprio | PASS — MCP oficial conectado | PARTIAL — CLI `stdio` existe, daemon/handshake não ficou acessível pelo WSL |
| Suporte a MCP externo | NOT_TESTED — sem mecanismo externo verificado nesta sessão | PARTIAL — OpenCode CLI por projeto conectado; injeção no painel não observada |
| Skills externas | PARTIAL — Skills coordenam o agente, não são mecanismo próprio do editor | PARTIAL — 16 instaladas no projeto e nove lidas pelo OpenCode; painel não verificado |
| Importação de HTML | PASS — HTML importado em frames Doop | PARTIAL — arquivos locais presentes; importação nativa não testada |
| Exportação de HTML | NOT_AVAILABLE — sem exportador HTML no catálogo Doop verificado | PARTIAL — arquivos locais criados; exportação pelo editor não testada |
| SVG | PARTIAL — elementos compatíveis exibidos; round-trip de edição limitado | PARTIAL — SVG local validado/renderizado; camada nativa não verificada |
| Design tokens | PARTIAL — tokens locais do frame preservados; tokens globais não expostos | PARTIAL — JSON/CSS local disponível; modelo semântico nativo não verificado |
| Componentes | NOT_AVAILABLE — biblioteca global e expansão de `<doop-use>` indisponíveis | NOT_TESTED — componentes nativos não verificados |
| Protótipos | PASS — seis frames originais preservados; protótipo original relido | NOT_TESTED |
| Editabilidade | PARTIAL — markup dos novos frames é HTML; vídeos são imagens de referência | PARTIAL — HTML/CSS/JSON/SVG são texto; camadas nativas não provadas |
| Assets locais | PASS — cinco PNGs sintéticos planejados, hash verificado e colocados nos frames | PASS — arquivos existentes no workspace local; sem envio externo automático |
| Design-to-Motion | PASS — seis frames importados/normalizados/renderizados localmente | PARTIAL — renders de arquivos locais; importação Design Bridge não executada |
| Motion-to-Design | PASS — 15 frames e cinco assets enviados, relidos e capturados no laboratório | PARTIAL — arquivos do projeto existem; reimportação pelo OpenDesign não provada |
| Produção utilizando Motion MCP | PASS — operações do bridge executadas pelo MCP oficial | PARTIAL — smoke `render_static` pelo OpenCode; produção de 15 s bloqueada por 429 |
| Fidelidade visual | PARTIAL — screenshots após exportação; revisão visual, sem métrica de round-trip equivalente | PARTIAL — previews locais revisados; sem comparação de importação nativa |
| Execução offline | NOT_AVAILABLE — serviço/editor remoto | PARTIAL — produção Motion local; app e daemon offline não homologados |

## Limitações externas do Doop

- Tokens globais do Doop e biblioteca global de componentes não aparecem nas ferramentas disponíveis.
- Referências `<doop-use>` não expandiram para instâncias renderizadas nesta versão/conta.
- Ferramenta pública para upload de fontes não foi encontrada.
- O MCP não fornece CAS atômico. A releitura detecta alterações observadas antes da escrita, mas não elimina uma corrida posterior.

Esses limites não bloqueiam renders, QA, SVG, storyboard nem produção local. Veja as evidências transacionais e os limites de fidelity no [relatório M6](../reports/MISSION_23_M6_REPORT.md).

## Referências oficiais

- [OpenDesign agent adapters no commit testado](https://github.com/nexu-io/open-design/blob/d9691d7a8ba21ab57c52916dcf07ea87598e04fc/docs/agent-adapters.md)
- [OpenDesign Skills protocol no commit testado](https://github.com/nexu-io/open-design/blob/d9691d7a8ba21ab57c52916dcf07ea87598e04fc/docs/skills-protocol.md)
- [OpenDesign plugin specification no commit testado](https://github.com/nexu-io/open-design/blob/d9691d7a8ba21ab57c52916dcf07ea87598e04fc/docs/plugins-spec.md)
- [OpenCode MCP servers](https://opencode.ai/docs/mcp-servers/)
- [OpenCode Skills discovery](https://opencode.ai/docs/skills/)
