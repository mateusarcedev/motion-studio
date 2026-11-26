# Missão 23 — M6: homologação E2E e release gate

**Data:** 2026-11-26 · **Estado:** parcial enquanto o dry-run Motion-to-Design Doop aguarda autorização · **Referência da M6 original:** `0a2ed3a5a4d407b38d3914b5cf139a43be7eab50` · **Continuação local:** `main` em `6fa4240` · **Runtime local:** Node 24.16.0, Python 3.14.5, FFmpeg 8.0.1.

## Resultado

A homologação local está concluída para as capacidades do Motion Studio: campanha fictícia M6, Motion MCP stdio, QA, instalação limpa, testes MCP e correções de segurança. Com autorização limitada, foi criado o canvas `Motion Studio — Integration Lab` e exatamente seis frames sintéticos; eles foram relidos e nenhum outro canvas foi aberto ou alterado. Um plano adicional Motion-to-Design agora está validado em dry-run, mas a escrita nova aguarda autorização. O piloto OpenDesign 0.27.2 está concluído parcialmente por meio do agente OpenCode; o handoff nativo do app não foi homologado.

M1–M5 permanecem concluídas conforme seus relatórios. A M3 registra CI remoto aprovado. M6 não altera versão npm nem publica pacotes.

## Auditoria do estado

- `main` estava limpa e sincronizada com `origin/main` no commit de referência `0a2ed3a`; a árvore passou a conter apenas alterações desta M6.
- Foram conferidos os contratos Doop, o Motion Core, os handlers MCP e as Skills/manifestos existentes. O servidor local continua sendo stdio; Doop continua separado e opcional.
- O servidor anuncia **30 ferramentas**: 11 anteriores preservadas, 19 novas ferramentas locais. O catálogo público neste checkout tem 17 Skills; o monorepo mantém 57 Skills locais.
- `.agents/skills` é o catálogo canônico para Codex, Antigravity e clientes compatíveis. Os aliases `.claude/skills` e `.opencode/skills` das três Skills de integração e `explainer-motion` foram adicionados ao roteamento local.
- O perfil `integration` selecionou seis Skills: `studio-director`, `motion-director`, `web-director`, `design-to-motion`, `motion-to-design` e `doop-bridge`.

## Inventário das ferramentas MCP

| Grupo | Ferramentas |
|---|---|
| Ferramentas anteriores — compatibilidade mantida | `motion_edit_presets`, `motion_edit_analyze`, `motion_stt_doctor`, `motion_audio_doctor`, `motion_edit_transcribe`, `motion_edit_plan`, `motion_edit_audio`, `motion_edit_render`, `motion_job_status`, `motion_qa_reel`, `motion_edit_export` |
| Render | `render_static`, `render_frames`, `render_video`, `render_carousel` |
| QA | `qa_determinism`, `qa_safe_zones`, `qa_viewports` |
| SVG | `svg_validate`, `svg_optimize` |
| Design Bridge local | `bridge_validate_contract`, `bridge_import_design`, `bridge_import_tokens`, `bridge_hydrate_assets`, `bridge_normalize_design`, `bridge_prototype_storyboard`, `bridge_export_plan`, `bridge_export_validate`, `bridge_doop_payload`, `bridge_export_tokens` |

O teste de servidor usa `@modelcontextprotocol/client` real em subprocesso stdio. Descobriu schemas de entrada e saída para as 30 ferramentas, verificou as 11 ferramentas anteriores, paridade de render CLI×MCP, integridade SHA-256, validação de argumentos, cancelamento, workspace e saída protocolar.

## Clientes MCP

Os smoke tests usaram configuração e workspace temporários em `/tmp/m6-client-smoke`; configurações pessoais não foram alteradas.

| Cliente | Estado M6 | Evidência |
|---|---|---|
| Claude Code 2.1.332 | Homologado em smoke MCP | Descobriu o servidor e 30 ferramentas, chamou `render_static`, recebeu PNG de 9.374 bytes, rejeitou traversal com `MOTION_BRIDGE_PATH_TRAVERSAL` e encerrou com código 0. |
| Codex CLI 0.172.0 | Homologado em smoke MCP | Mesmo fluxo e hash do PNG; a política padrão `never` impediu a primeira chamada. A chamada de teste foi repetida em diretório temporário com `--approve-for-me`. |
| Antigravity CLI (`agy`) 1.5.16 | Homologado em smoke MCP | Configuração workspace `.agents/mcp_config.json`, chamada real, artefato íntegro, traversal rejeitado e encerramento com código 0. `agy mcp list` mostra apenas servidores globais. |
| OpenCode 2.2.5 | Parcial | Descoberta, chamada real, PNG e traversal passaram. Um serviço `opencode serve --service` preexistente manteve o processo MCP filho após a execução; o encerramento isolado não foi provado. O modo `--standalone` desta versão não carregou a configuração MCP do smoke. |
| Gemini CLI | Indisponível | O executável não está instalado. Não foi instalado cliente novo. |
| Cliente MCP oficial JS | Testado como cliente de referência | Testes cobrem a superfície MCP em subprocesso, render, QA, SVG, Bridge, cancelamento, erro estruturado, schemas, encerramento e integridade. Isso não equivale a homologar todos os 30 handlers em cada aplicativo. |

Os quatro PNGs de smoke, um por cliente, têm SHA-256 `4f0b481e6f7a6d65a8e0686fb466377af6d249d84f53876efc5d6aec9e45a350`.

## Doop MCP oficial e limites de componentes

O Doop MCP oficial estava disponível. `list_canvases` confirmou que o laboratório ainda não existia; não foram abertos canvases de outros projetos. Após a autorização limitada do usuário, foi criado o canvas [Motion Studio — Integration Lab](https://doop.design/c/Gz620okdHY). Foram feitas apenas as operações neste canvas: criação dos seis frames, pequenos ajustes visuais/ligação de protótipo nesses mesmos frames, releitura dos seis frames, leitura do protótipo e screenshots. Não houve upload de assets, alterações globais de tokens/componentes, exportação ou operação em outro canvas.

| Frame | ID Doop | Tamanho | Screenshot Doop persistido e SHA-256 |
|---|---|---:|---|
| `01-landing` | `h9rCOmRg0g` | 1280×800 | [PNG](../../projects/m6-herbario-de-nevoa/evidence/doop-lab/01-landing.png) · `c31f7926a097fbbb175cfe07c9f2d4aef7c3a6d4e6b55e8595c86161a6746d56` |
| `02-dashboard` | `CwjMdBJXXs` | 1280×800 | [PNG](../../projects/m6-herbario-de-nevoa/evidence/doop-lab/02-dashboard.png) · `fa56a6c9c8d3314deec521afef57c39865d06000a7e11f042affdb2cfd0c44fa` |
| `03-mobile` | `-_E_wx3ROp` | 390×844 | [PNG](../../projects/m6-herbario-de-nevoa/evidence/doop-lab/03-mobile.png) · `03a8223aa8500f9260f8162ed511e69d2d5f1772644b2a01ebc4e4cd79f412b8` |
| `04-components` | `w0A1aPBoAb` | 1280×800 | [PNG](../../projects/m6-herbario-de-nevoa/evidence/doop-lab/04-components.png) · `5957b3b2089214bdf1baa57faa36beb4283f9de53ea7a316246c42cbe47cfb7b` |
| `05-prototype` | `Xw8Is9_4vi` | 1280×800 | [PNG](../../projects/m6-herbario-de-nevoa/evidence/doop-lab/05-prototype.png) · `c2a64a7d62d870b994da5c4d68f58fc5f5c81b47e1ff771eca7caa4766afc7d3` |
| `06-dark-theme` | `unjOCGtIza` | 1280×800 | [PNG](../../projects/m6-herbario-de-nevoa/evidence/doop-lab/06-dark-theme.png) · `77c5b0777b8500cacbbb3a5d98c9dad971e277a21f98969aca534fbfe3382138` |

O readback dos seis frames e `get_prototype` está em [`doop-frames-readback.json`](../../projects/m6-herbario-de-nevoa/evidence/doop-lab/doop-frames-readback.json). `get_prototype` confirmou cinco ações `click → navigate` de `05-prototype`, com todos os cinco destinos existentes. O Motion MCP stdio importou os seis frames: **6/6 DesignIR válidos**, **6/6 normalizações para frame** e **6/6 renders estáticos PASS**. Os renders persistidos e seus hashes estão em [`motion-rendered/`](../../projects/m6-herbario-de-nevoa/evidence/doop-lab/motion-rendered/) e no resumo [`local-bridge-results.json`](../../projects/m6-herbario-de-nevoa/evidence/doop-lab/local-bridge-results.json). O target `web-director` também normalizou a landing page e passou `qa_viewports` nos cinco tamanhos: 360×740, 390×844, 768×1024, 1280×800 e 1920×1080. A captura Motion correspondente é [01-landing-web.png](../../projects/m6-herbario-de-nevoa/evidence/doop-lab/motion-rendered/01-landing-web.png), SHA-256 `fcb3e06fd99cc9531e0461bb295b89c77f3380ad1eea472cd8975259e6971b64`.

O primeiro `qa_viewports` foi executado sobre o target `frame`, que mantém o artboard fixo em 1280×800; a verificação multiviewport falhou com overflow nos viewports menores e erro do import bare `@technomanceer/motion-core/frame` fora do runtime de animação. Esse resultado não foi tratado como aprovação responsiva. A landing foi verificada separadamente pelo target responsivo `web-director`, que passou nos cinco viewports. As screenshots Doop foram comparadas visualmente com os renders locais; não foi calculado SSIM.

O `get_canvas` não expôs tokens globais nem uma biblioteca de componentes, e o catálogo MCP atual não oferece operações de leitura/escrita para esses recursos. `bridge_import_tokens` extraiu e validou **10 tokens locais** do `:root` de `01-landing`; isso não comprova nem altera tokens globais do editor. A criação de `04-components` retornou `COMPONENT: no component “Specimen Card”`; a instância `<doop-use>` não aparece no `get_frame` posterior. O frame conserva uma representação textual do contrato, mas não demonstra expansão, aparência ou reutilização de componente real.

Na importação local, o sanitizador removeu os scripts inline de `01-landing` e `03-mobile` (`SCRIPT_STRIPPED`); quatro transições CSS também foram removidas para render determinístico. Não havia URLs de assets externos. O storyboard local derivado dos fluxos observados está em [`doop-lab-prototype-storyboard.md`](../../projects/m6-herbario-de-nevoa/evidence/doop-lab/doop-lab-prototype-storyboard.md), SHA-256 `80e8a98f00e86e8402e87a703777ca06df2e1b5f49db6f0ae7770aba73fb9e7e`. A ausência de resolução real de componentes, tokens globais e comportamento JavaScript limita a fidelidade funcional; as classificações de editabilidade não devem ser estendidas a esses recursos.

Não foram executados exports para o Doop: eles ficaram explicitamente fora da autorização recebida. O relatório anterior de dry-run continua sendo apenas plano local; nenhuma operação externa foi simulada como sucesso.

## Plano Motion-to-Design para o laboratório Doop

O cliente MCP local chamou `bridge_export_plan`, `bridge_export_validate` e `bridge_doop_payload` contra o documento autorizado `Gz620okdHY`; nenhuma dessas chamadas invocou o Doop MCP para escrita. O plano versionado está em [`export-plan.dry-run.json`](../../projects/m6-herbario-de-nevoa/evidence/doop-lab/motion-to-design/export-plan.dry-run.json), SHA-256 `8c4c7ac53a3834e7fbf0136e80e7ee586da03787c88f5c2064e22f0f08491e50`.

| Operação planejada | Quantidade | Conteúdo |
|---|---:|---|
| `create_frame` | 15 | Landing editável, seis páginas de carrossel, story vertical, cinco stills de vídeo, storyboard e showcase SVG |
| `upload_asset` | 5 | PNGs representativos do vídeo, até 72.429 bytes cada; o Doop retornaria URLs públicas permanentes |
| `get_frame_screenshot` | 15 | Screenshot de verificação após cada novo frame |

Validação `ok:true`, nenhum finding, nenhum bloqueio; `status: DRY_RUN`, `executed:false`. O plano proíbe atualizações de frames existentes, mutações de tokens/componentes e upload público sem autorização. Os seis frames existentes são preservados. O Doop MCP não oferece CAS atômico, portanto uma releitura anterior à escrita detecta algumas mudanças concorrentes, mas não garante atomicidade. Nenhum upload de fonte é planejado.

O usuário ainda precisa autorizar explicitamente esses 15 frames e cinco uploads públicos antes de qualquer chamada externa. Após autorização, a execução precisa reler os seis frames originais e os 15 novos, capturar screenshots e validar estrutura/fidelidade. Até lá, o round-trip externo segue `NOT_TESTED`.

## Produções criativas locais

A campanha original **Herbário de Névoa** é fictícia e não utiliza assets externos. O projeto, briefing, tokens, storyboard e fontes HTML estão em [`projects/m6-herbario-de-nevoa/`](../../projects/m6-herbario-de-nevoa/). O roteiro de execução pelo cliente MCP oficial está em [`produce.mjs`](../../projects/m6-herbario-de-nevoa/produce.mjs). Foram usadas as Skills `design-to-motion`, `web-director`, `cinematic-product-director`, `carousel-studio`, `story-studio`, `motion-to-design` e `doop-bridge`.

| Produção | QA e métricas | Artefato final e integridade |
|---|---|---|
| Website responsivo com microinterações | `qa_viewports`: 5/5 PASS — 360×740, 390×844, 768×1024, 1280×800, 1920×1080; sem overflow horizontal, fontes ausentes ou texto pequeno sinalizado. | PNG de validação `projects/m6-herbario-de-nevoa/out/m6-final/web/hero.png`, 121.705 bytes, SHA-256 `84df88d7533deaaa9bc0f4743192f082d8c1260ef52a7550f96e224f9315b5d5`. |
| Vídeo promocional 16:9 | 240 quadros a 24 fps, 10 s, 1280×720; determinismo em seis amostras e seis amostras de safe zone PASS. | [`herbario-de-nevoa.mp4`](../../projects/m6-herbario-de-nevoa/out/m6-final/video/herbario-de-nevoa.mp4), H.264/yuv420p, 538.574 bytes, SHA-256 `450d881858d615f079b7fb424e0693da314fd0a043b73b61033986dafadfbeb9`. |
| Carrossel editorial | 6 slides; 1080×1350 e 2160×2700 (12 PNGs); safe zone aprovada nos seis slides sem warnings. Manifesto SHA-256 `a98816878a8f1273137a0e4e084afe800b43bd79caeb1908e223ffdd506b26ac`. | `projects/m6-herbario-de-nevoa/out/m6-final/carousel/`. |
| Story vertical 9:16 | 240 quadros a 24 fps, 10 s, 720×1280; determinismo em seis amostras e seis amostras de safe zone PASS. | [`herbario-de-nevoa-story.mp4`](../../projects/m6-herbario-de-nevoa/out/m6-final/story/herbario-de-nevoa-story.mp4), H.264/yuv420p, 366.469 bytes, SHA-256 `0bfe9a14f95a6424e156f53fd87e539b54591bc002cd395b51719ddaf364148e`. |

Safe zones são heurísticas configuradas no estúdio e servem de prévia; não garantem os overlays ou cortes de cada versão de aplicativo social. O teste de determinismo confirma as amostras de frames reportadas, não igualdade binária do MP4 em sistemas/builds diferentes. As quatro folhas de contato versionadas podem ser abertas: [website e viewports](assets/mission-23-m6/web-viewports.png), [promo](assets/mission-23-m6/promo-contact-sheet.png), [carrossel](assets/mission-23-m6/carousel-contact-sheet.png) e [story](assets/mission-23-m6/story-contact-sheet.png). SHA-256 respectivamente: `77cd590ee35789fe1af465417cd87b9a5e19c01cc87adf2f93ccc32921ab45a7`, `fbf91f996c226d2d022141aae268063ec9bf9924a9335d20e335435eba59d8fc`, `076a7d58eab5647b3cc0a0c2dedb4ddea8b69b1f09a730f0b97495f6a1eb7670` e `fe9ff8fc3344e4ebb11d2bac02988e743cae10396cb844f3f2a6275c49bed1a8`. As evidências `mcp-run.json` e `dry-run-export.json` têm SHA-256 `19e2dc0e1b3be5570e8d731764938890fdc563cb1962240a6ae8923d1e4945d2` e `67045303922c9ca15c4fa9e81822a9667a14a698a617e0321acc804002fb81bc`.

A crítica visual identificou corpo pequeno no carrossel e contraste no story. O texto dos slides 2 e 5 foi ampliado e o acento do story escurecido; as renderizações e os contact sheets finais foram refeitos e revistos. As saídas completas e as sequências de frames estão em `projects/m6-herbario-de-nevoa/out/m6-final/` e são ignoradas pelo Git para manter os tarballs enxutos. Fontes e evidências JSON permanecem versionadas.

## Piloto OpenDesign 0.27.2

O aplicativo instalado foi auditado no commit `d9691d7a8ba21ab57c52916dcf07ea87598e04fc`. Ele é Electron desktop e contém daemon CLI local, operações de projeto/arquivo/artefato e um MCP stdio próprio. O bundle usa OpenCode 1.19.6; no WSL, OpenCode 2.2.5 estava disponível. Nenhuma configuração pessoal do OpenDesign ou de agentes foi modificada.

Foi criado o projeto local **Motion Studio — Integration Lab**, ID `04691291-53a3-44d0-b4ce-5d1cb1bb091e`, no perfil já instalado. As 16 Skills públicas do perfil foram instaladas; as onze Skills pedidas estão presentes e nove relevantes foram carregadas pelo OpenCode. Uma configuração `opencode.json` dentro apenas do projeto apontou Node, Motion MCP `stdio` e workspace explicitamente limitado. O OpenDesign painel não encaminhou MCP externo na execução observada; o MCP próprio do app não completou handshake deste ambiente WSL/Windows. Portanto a validação MCP é indireta, pelo agente OpenCode.

A pasta `design-output/production/` no projeto local tem landing, dashboard, interface mobile, seis slides, story, storyboard, cinco frames representativos, dois MP4s, tokens, SVG e cartão HTML. São 41 arquivos/1.927.522 bytes; manifesto SHA-256 `f7c5b091025079f49037a1cecabf5b2c6b3ad65ebecfe7318414216e50e9aa5b`. Motion MCP descobriu 30 ferramentas/schemas, renderizou nove previews, validou o SVG e executou QA responsivo 5/5 sem issues. Screenshots e hashes estão em [`motion-mcp-results.json`](../../projects/m6-herbario-de-nevoa/evidence/opendesign/motion-mcp-results.json); instruções/matriz estão em [`OPENDESIGN.md`](../integrations/OPENDESIGN.md), e o relatório detalhado em [`OPENDESIGN_INTEGRATION_PILOT.md`](OPENDESIGN_INTEGRATION_PILOT.md).

O OpenCode direto produziu um smoke PNG via `render_static` (37.814 bytes, SHA-256 `91e3a1dc5a3dd193bd04a6fb4f54bebfb8489f585805c49446ef92b0650788ef`). A execução posterior para vídeo vertical leu as Skills e chamou o servidor, mas parou no limite gratuito `429 FreeUsageLimitError`. A primeira execução do painel também falhou antes de criar saídas. Os MP4s no projeto foram reutilizados da campanha M6; não são resultado de uma execução completa do agente OpenDesign.

HTML/CSS/JSON/SVG estão editáveis como texto no workspace; não houve importação ou releitura pelo MCP nativo do OpenDesign, nem prova de camadas/componentes nativos. O cartão não é um componente nativo e os vídeos não são timelines editáveis. `bridge_import_design` chama o adapter de Doop e exige frame JSON Doop; `bridge_normalize_design` aceita DesignIR validado, mas não há extractor OpenDesign→DesignIR suportado. Renderizamos os arquivos diretamente sem relabelar a proveniência; nenhum adapter OpenDesign foi implementado. O gap e o formato estão na [matriz](../integrations/OPENDESIGN.md) e no [roadmap do Universal Design Bridge](../roadmap/UNIVERSAL_DESIGN_BRIDGE.md).

## Roteamento de QA por composição

`resolveQualityRouting` inclui no relatório as ferramentas MCP registradas, verificações do Motion Core, ferramentas condicionais e revisão manual em campos separados. Não anuncia `qa_frames` nem `qa_media` como ferramentas MCP inexistentes. O roteamento é guia de execução do agente/CLI; não substitui os gates indicados.

| Composição | Ferramentas MCP | Core | Revisão humana / condição |
|---|---|---|---|
| Website responsivo | `render_static`, `qa_viewports` | — | hierarquia, resposta e acessibilidade de movimento; `render_frames` + `qa_determinism` se houver animação |
| Artboard fixo | `render_static` | — | composição à dimensão declarada; sem QA responsivo |
| Carrossel | `render_carousel`, `qa_safe_zones` | `qaFrames` | continuidade narrativa; frames/determinismo se slides animarem |
| Story | `render_frames`, `qa_determinism`, `qa_safe_zones` | `qaFrames` | arco e legibilidade dentro dos overlays |
| Vídeo | `render_frames`, `qa_determinism`, `render_video` | `qaFrames`, `qaMedia` | ritmo/transições/tipografia; safe zones só para entrega social/vertical |
| Composição animada | `render_frames`, `qa_determinism` | `qaFrames` | intenção/continuidade; safe zones para entrega social |

O runtime `qa_viewports` serve HTML do próprio workspace através do servidor local seguro e mapeia imports bare do Motion Core sem rede externa. A regressão passa nos cinco viewports; o teste responsivo não foi enfraquecido. `qaFrames` e `qaMedia` são funções do Core, não nomes de ferramentas MCP.

## Segurança

O Codex Security concluiu uma análise estática direcionada no commit de referência, scan `5f83b734-750a-4aad-9adc-36121bacb26b`. Foram registrados dois achados médios no estado anterior à M6, ambos corrigidos no working tree e cobertos por regressões:

1. Arquivos com aparência de credencial podiam entrar em ZIPs de entrega inferidos. Agora são excluídos e a exportação falha fechada quando um arquivo sensível aparece no contrato explícito ou numa raiz produzida.
2. Linhas MCP, pedidos pendentes, filas e histórico de jobs não tinham limites agregados. Agora os limites são 20 MiB por linha, 64 pedidos pendentes, 32 operações em fila e 128 jobs retidos.

O relatório gerado pelo scan está em [`MISSION_23_M6_SECURITY_SCAN.md`](MISSION_23_M6_SECURITY_SCAN.md). A análise foi direcionada às superfícies de segurança críticas, não foi leitura linha a linha dos 10.859 arquivos inventariados, não testou serviço remoto e não é pentest independente. A heurística de nomes de credenciais não detecta segredos com nomes arbitrários. Os testes adversariais passaram; detalhes dos quality gates finais serão registrados abaixo.

## Auditoria dos pacotes npm

O `npm pack --dry-run` do diretório raiz resulta em `motion-studio-monorepo@1.1.1`, marcado `private: true`: **cerca de 469,4 MB compactados, 679,8 MB descompactados, 10.890 arquivos**. Os 466,1 MB reportados na M5 pertenciam a esse monorepo privado; não são os tamanhos dos pacotes públicos. As alterações desta continuação não adicionaram arquivos de produção grandes aos tarballs públicos.

| Pacote público | M5 — compactado / descompactado / arquivos | M6 após auditoria — compactado / descompactado / arquivos | Diferença observada |
|---|---:|---:|---:|
| `@technomanceer/motion-cli` | 61.660 / 203.744 / 26 | 62.566 / 206.947 / 26 | +906 / +3.203 / 0 |
| `@technomanceer/motion-core` | 783.164 / 2.781.435 / 105 | 785.422 / 2.789.158 / 106 | +2.258 / +7.723 / +1 |
| `@technomanceer/motion-studio-skills` | 14.248.382 / 27.870.491 / 208 | 14.065.752 / 27.680.507 / 194 | −182.630 / −189.984 / −14 |
| `@technomanceer/motion-studio` | 5.330 / 14.186 / 4 | 5.330 / 14.186 / 4 | 0 / 0 / 0 |

Os aumentos pequenos de CLI/Core são código de runtime da M6, incluindo renderização, QA e Design Bridge. A redução das Skills removeu `.github` e fixtures/pastas de teste que não são referenciadas pelo manifesto/Skills em runtime; exemplos, scripts e ativos das Skills necessários ao uso permanecem. Os quatro pacotes usam inclusão explícita; o scan do conteúdo e a instalação dos tarballs passaram. O script reproduzível é [`scripts/m6_distribution_smoke.mjs`](../../scripts/m6_distribution_smoke.mjs).

Instalação limpa em `/tmp/motion-m6-distribution-hYufo9`: os quatro tarballs 1.1.1 foram instalados sem scripts de terceiros. O instalador copiou as seis Skills de `integration` e validou os 17 hashes do manifesto. `motion doctor` passou nos requisitos obrigatórios e integridade; MCP instalado encontrou 30 ferramentas; `render_static` criou PNG válido, SHA-256 `3816f0af9bf59f92b92a70d44d1b7c47001a510d3c1788da94f4470639dd1177`; render CLI e MCP produziram o mesmo hash; traversal foi rejeitado.

Consulta ao registry em 2026-11-26 confirmou `1.1.1` como versão publicada de cada um dos quatro pacotes. Nenhuma publicação foi feita.

## Quality gates e CI

| Gate | Resultado M6 |
|---|---|
| `npm run test:ci` | PASS — 364 testes, 0 falhas, 0 pulados, 0 cancelados. |
| `npm run test:determinism` | PASS — workspaces independentes; timeline, segmentos, captions, voz, streams decodificados e MP4 idênticos. |
| `npm run test:py` | PASS — 25 testes, 123,6 s, sem skips. |
| `npm run skills:verify` | PASS — 17 Skills públicas, 4 registros locais no lock e hashes/licenças íntegros. |
| `node packages/motion-cli/bin/motion.mjs doctor --json` | PASS — Node 24.16, Python, FFmpeg, Chromium e dependências obrigatórias; opcionais ausentes aparecem como `INFO`. |
| `npm pack --dry-run` | Pacote raiz privado: 10.890 arquivos, ~469,4 MB compactados e ~679,8 MB descompactados. Quatro pacotes públicos auditados individualmente; tamanhos antes/depois e conteúdo estão acima. |
| Release gate `scripts/release-gate.mjs` | `R4–R14` PASS; R2 foi omitido para não repetir `test:ci` e aparece `NOT_TESTED` no relatório. A instalação limpa (R6) passou. Node 20/22 ausentes localmente (R15 `NOT_TESTED`), login npm ausente (R16 `BLOCKED`) e 1.1.1 já publicada (R17 `FAIL`). R12/R13 não tiveram falhas, mas reportaram warnings de loudness e repetição no fixture de teste. Nenhum pacote foi publicado. Detalhes em [`MISSION_23_M6_RELEASE_GATE.md`](MISSION_23_M6_RELEASE_GATE.md). |
| Node.js | Somente 24.16.0 está instalado localmente. Node 20/22 estão ausentes; os três majors precisam ser confirmados no CI pós-push. |
| CI remoto | CI do commit desta continuação será confirmado após o push; o CI aprovado anterior cobriu Node 20/22/24 e determinismo em quatro jobs. |

As suítes MCP/Bridge e de distribuição estão incluídas em `test:ci`; o gate de instalação limpa também verifica os tarballs. O cliente MCP de referência executou 30 ferramentas/schemas no piloto. `git diff --check` passou nesta continuação. O CI remoto desta continuação será registrado após o push.

## Recomendação de release

`v1.2.0` é uma versão minor coerente com a adição compatível de ferramentas MCP locais, três Skills de integração, perfis de instalação, proteções de recursos e empacotamento revisado. Os quatro `package.json` permanecem em `1.1.1`; os tarballs acima são validação local e não publicação. A proposta, checklist, compatibilidade e ordem de atualização estão em [`RELEASE_NOTES_1.2.0_PROPOSAL.md`](RELEASE_NOTES_1.2.0_PROPOSAL.md).

**Recomendação:** manter a versão como proposta. O piloto Doop agora comprova criação do laboratório autorizado, leitura, importação e transformação local; não comprova exportação ao editor, que ficou fora da autorização recebida. Antes da release, confirmar CI Node 20/22/24 no commit final e declarar claramente que a escrita Motion-to-Design no Doop continua sem homologação. Não alterar versão nem publicar nesta missão.

## Trabalho restante para fechar M6

1. A homologação autorizada do laboratório foi executada: canvas criado e exatamente seis frames sintéticos escritos, lidos de volta e capturados. O usuário autorizou apenas esse laboratório e esses frames; exports e alterações em outros canvases não estão autorizados.
2. A importação, validação DesignIR, normalização e render local passaram em 6/6 frames; a landing responsiva passou em 5/5 viewports no target `web-director`. O target fixo `frame` não é responsivo; o roteador agora reserva a verificação de overflow aos websites responsivos e mantém artboards fixos na dimensão declarada.
3. O fluxo de saída Motion-to-Design foi mantido em dry-run. Não realizar escrita no Doop sem nova autorização explícita. A falta de ferramentas Doop para tokens globais e biblioteca/componentes impede homologar esses recursos; `04-components` não demonstrou expansão de `<doop-use>`.
4. O piloto OpenDesign é parcial: integração indireta via OpenCode e um smoke real pelo Motion MCP passaram; o painel não demonstrou encaminhamento MCP, o MCP próprio não completou handshake no ambiente WSL/Windows, e a produção de vídeo do agente parou no limite 429 do provedor.
5. O release gate não certifica publicação da 1.1.1 já publicada nem autenticação npm; nada foi publicado. Node 20 e 22 precisam ser confirmados no CI desta continuação. A M6 permanece **parcial quanto ao round-trip externo Doop e à integração nativa OpenDesign**. Não iniciar nova missão ou publicação automaticamente.

Nenhum passo da M6 avança automaticamente para uma nova missão.
