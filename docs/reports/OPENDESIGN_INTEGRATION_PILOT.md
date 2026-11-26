# Relatório do piloto OpenDesign — Missão 23 M6

**Data:** 2026-11-26 · **Resultado:** parcial. O caminho indireto por OpenCode executou Motion MCP; o handshake nativo OpenDesign não ficou acessível pelo WSL nesta instalação. Uma produção de vídeo iniciada pelo agente chegou ao limite HTTP 429 do provedor.

## Instalação auditada

| Item | Valor verificado |
|---|---|
| OpenDesign | 0.27.2, commit `d9691d7a8ba21ab57c52916dcf07ea87598e04fc` |
| Runtime | Electron 41.3.0, Node 24.15.0, V8 14.6.202.33-electron.0 |
| Aplicativo | `C:\Users\marce\AppData\Local\Programs\Open Design` |
| Perfil | `C:\Users\marce\AppData\Roaming\Open Design\namespaces\release-stable-win\data` |
| Projeto de laboratório | `Motion Studio — Integration Lab`, ID `04691291-53a3-44d0-b4ce-5d1cb1bb091e` |
| Agente no app | OpenCode embutido 1.19.6 |
| Agente separado | OpenCode CLI 2.2.5 no WSL |
| CLI empacotado | `resources/app/prebundled/daemon/daemon-cli.mjs`; `od` não estava no `PATH` WSL |
| Configuração pessoal | Nenhum arquivo global/pessoal foi alterado; projeto existente e demais projetos foram preservados |

Documentação e código da versão instalada foram consultados nos links oficiais fixados ao commit: [agent adapters](https://github.com/nexu-io/open-design/blob/d9691d7a8ba21ab57c52916dcf07ea87598e04fc/docs/agent-adapters.md), [Skills protocol](https://github.com/nexu-io/open-design/blob/d9691d7a8ba21ab57c52916dcf07ea87598e04fc/docs/skills-protocol.md) e [plugin specification](https://github.com/nexu-io/open-design/blob/d9691d7a8ba21ab57c52916dcf07ea87598e04fc/docs/plugins-spec.md). Formatos MCP e Skills do OpenCode foram comparados à [documentação MCP](https://opencode.ai/docs/mcp-servers/) e [documentação de Skills](https://opencode.ai/docs/skills/).

## Investigação do handshake MCP próprio

O `od mcp --help` da instalação identifica o comando como MCP `stdio` que encaminha ao daemon local do OpenDesign, por padrão em `127.0.0.1:7456`. O perfil atual não possuía registro do Motion MCP no `app-config.json`.

Na tentativa observada, o daemon gravou estado `clean_shutdown`, encerrou com sucesso e não havia processo Linux OpenDesign nem listener local nas portas 7456, 7457 ou 7460. A tentativa de cruzar WSL para o processo Windows falhou antes da inicialização do MCP com `UtilAcceptVsock: accept4 failed 110`. Portanto não se obteve um `initialize`/handshake MCP válido e não foi possível separar falha de descoberta de ferramentas de falha de transporte/daemon: o processo proxy não alcançou o daemon.

O painel acionou o agente embutido, mas o processo terminou com código Windows `3221225786` (`process_exit`) sem criar artefatos. Na execução observada, `toolBundle.mcpServers` estava vazio. A config `opencode.json` dentro do projeto aponta para Node e caminhos WSL; ela serviu ao OpenCode CLI 2.2.5, mas não demonstra que o agente Windows OpenCode 1.19.6 a interprete. Não se alterou configuração pessoal ou global para tentar contornar isso.

A versão oficial documenta adaptadores que delegam o loop para um CLI e suportam injeção de MCP externo. Logo, a integração nativa é suportada como arquitetura pública, mas permanece **não homologada nesta máquina/execução**. Para homologar, será necessário tornar o daemon Windows alcançável pelo adaptador sem contornar os caminhos oficiais e comprovar o registro do servidor no painel. Não se conclui incompatibilidade geral do OpenDesign.

## Projeto, Skills e execução indireta

O projeto de ID `04691291-53a3-44d0-b4ce-5d1cb1bb091e` reutiliza a identidade fictícia **Herbário de Névoa** e contém landing, dashboard, mobile, seis slides, story vertical, storyboard, frames representativos do vídeo, tokens, SVG e cartão HTML. O output `design-output/production/` tem 41 arquivos, 1.927.522 bytes; manifesto SHA-256 `f7c5b091025079f49037a1cecabf5b2c6b3ad65ebecfe7318414216e50e9aa5b`.

O instalador/perfis existentes forneceram 16 Skills públicas no projeto; as onze pedidas estão instaladas. OpenCode CLI carregou nove aplicáveis: `studio-director`, `motion-director`, `web-director`, `design-to-motion`, `motion-to-design`, `carousel-studio`, `story-studio`, `shorts-director` e `cinematic-product-director`. `reel-editor` não se aplicava a uma edição de reel existente; `3d-scene-director` não se aplicava à campanha 2D. A descoberta dessas Skills pelo loop do painel OpenDesign não foi provada.

O cliente MCP de referência descobriu 30 ferramentas e os schemas correspondentes. Nove renders locais foram aprovados; `svg_validate` passou; `qa_viewports` aprovou 5/5 viewports (360×740, 390×844, 768×1024, 1280×800, 1920×1080). Respostas, caminhos e SHA-256 estão em [`motion-mcp-results.json`](../../projects/m6-herbario-de-nevoa/evidence/opendesign/motion-mcp-results.json). O OpenCode CLI separado chamou `render_static` e produziu `design-output/mcp-smoke.png` (37.814 bytes; SHA-256 `91e3a1dc5a3dd193bd04a6fb4f54bebfb8489f585805c49446ef92b0650788ef`).

Uma execução posterior pelo agente leu as Skills e chamou o Motion MCP durante a solicitação de um vídeo vertical de 15 s, animações, tipografia cinética, transições e capa. O provedor configurado respondeu `429 FreeUsageLimitError` antes da conclusão. Não houve troca de provedor ou nova tentativa para contornar o limite. Os MP4s previamente existentes da campanha M6 não são evidência de uma nova produção pelo agente OpenDesign.

## Formatos e classificação de fidelidade

| Material | Classificação verificada |
|---|---|
| HTML/CSS, tokens JSON e SVG | Editável como texto no workspace; importação em camadas nativas não testada |
| PNGs e frames de animação | Rasterizados; referência visual |
| MP4 | Referência/playback; timeline nativa editável não testada |
| Dashboard e mobile | Arquivos HTML/CSS locais; edição nativa responsiva não testada |
| Storyboard | Markdown/HTML local; suporte como camada nativa não testado |
| Cartão de espécime | HTML/CSS, não um componente da biblioteca nativa |
| Tokens | CSS/JSON preservados como arquivos; modelo semântico OpenDesign não verificado |

O Motion Bridge atual importa frame JSON do Doop e registra proveniência `doop`. `bridge_normalize_design` aceita `MotionDesignIR@1`, mas não há extrator OpenDesign → IR implementado ou homologado. Arquivos OpenDesign não foram rotulados como Doop; não houve importação/releitura pelo MCP OpenDesign. Um adapter completo não se justifica apenas pelo piloto e fica como lacuna candidata ao Universal Design Bridge.

## Doop cruzado com evidência atualizada

O [plano dry-run](../../projects/m6-herbario-de-nevoa/evidence/doop-lab/motion-to-design/export-plan.dry-run.json), SHA-256 `8c4c7ac53a3834e7fbf0136e80e7ee586da03787c88f5c2064e22f0f08491e50`, foi executado após autorização explícita limitada ao canvas `Gz620okdHY`. Foram concluídos 5 uploads planejados, 15 frames novos e 15 screenshots; o canvas tem 21 frames totais. As seis fontes originais foram relidas e mantiveram os hashes; nenhum outro canvas foi tocado. Ledger, hashes, readbacks e screenshots estão em [`execution-evidence.json`](../../projects/m6-herbario-de-nevoa/evidence/doop-lab/motion-to-design/execution-evidence.json) e na pasta [`screenshots/`](../../projects/m6-herbario-de-nevoa/evidence/doop-lab/motion-to-design/screenshots/).

Uma edição posterior do usuário no frame 10 foi identificada por autoria/versão e preservada, não sobrescrita. A landing recebeu correção de altura para evitar corte no CTA; a story recebeu fallback estático legível no primeiro quadro. A comparação foi visual/humana, sem SSIM e sem comprovação da reprodução de animação dentro do Doop.

Continuam indisponíveis no Doop MCP: tokens globais, biblioteca global de componentes, expansão de `<doop-use>`, upload público de fontes e CAS atômico. A conclusão das operações HTML/raster autorizadas não habilita esses recursos.

## Matriz consolidada

A matriz explícita Doop × OpenDesign, com estados `PASS`, `PARTIAL`, `FAIL`, `BLOCKED`, `NOT_AVAILABLE` e `NOT_TESTED`, está no [guia de integração](../integrations/OPENDESIGN.md). Resumo:

| Fluxo | Estado |
|---|---|
| OpenCode CLI separado → Motion MCP | PASS para configuração de projeto, descoberta e chamada real de `render_static` |
| OpenDesign painel → MCP externo | PARTIAL / não homologado; processo sem servidor injetado na execução observada |
| MCP próprio OpenDesign no WSL | BLOCKED nesta execução pela indisponibilidade do daemon Windows via WSL; não é incompatibilidade geral demonstrada |
| Skills no projeto e leitura pelo OpenCode CLI | PASS para 16 instaladas e nove lidas; painel não verificado |
| Produção de vídeo de 15 s pelo agente OpenDesign | BLOCKED por HTTP 429; sem novo vídeo gerado |
| Importação nativa de HTML/Design Bridge | NOT_TESTED; contrato atual não possui extractor OpenDesign |
| Doop Motion-to-Design no laboratório | PASS para as 35 operações autorizadas, com limites de fidelidade listados acima |

Não houve fork, APIs privadas, alteração de configuração pessoal ou projeto externo adicional. Nenhum pacote npm foi publicado.
