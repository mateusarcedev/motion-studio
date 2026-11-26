# Missão 23 — M6: homologação E2E e release gate

**Data:** 2026-11-26 · **Estado:** parcial · **Referência inicial:** `main` em `0a2ed3a5a4d407b38d3914b5cf139a43be7eab50` · **Runtime local:** Node 24.16.0, Python 3.14.5, FFmpeg 8.0.1.

## Resultado

A homologação local está concluída: campanha fictícia original produzida pelo fluxo criativo existente, execução pelo Motion MCP stdio, QA visual, instalação limpa dos quatro tarballs, testes MCP com cliente oficial e correções de segurança. Em 2026-11-26, com autorização limitada, foi criado o canvas `Motion Studio — Integration Lab` e nele foram criados somente os seis frames sintéticos descritos abaixo. A M6 permanece **parcial**: não houve autorização para exportar ao editor, e a biblioteca global de tokens/componentes não está exposta pelo Doop MCP conectado. Nenhum outro canvas foi aberto ou alterado.

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

## Segurança

O Codex Security concluiu uma análise estática direcionada no commit de referência, scan `5f83b734-750a-4aad-9adc-36121bacb26b`. Foram registrados dois achados médios no estado anterior à M6, ambos corrigidos no working tree e cobertos por regressões:

1. Arquivos com aparência de credencial podiam entrar em ZIPs de entrega inferidos. Agora são excluídos e a exportação falha fechada quando um arquivo sensível aparece no contrato explícito ou numa raiz produzida.
2. Linhas MCP, pedidos pendentes, filas e histórico de jobs não tinham limites agregados. Agora os limites são 20 MiB por linha, 64 pedidos pendentes, 32 operações em fila e 128 jobs retidos.

O relatório gerado pelo scan está em [`MISSION_23_M6_SECURITY_SCAN.md`](MISSION_23_M6_SECURITY_SCAN.md). A análise foi direcionada às superfícies de segurança críticas, não foi leitura linha a linha dos 10.859 arquivos inventariados, não testou serviço remoto e não é pentest independente. A heurística de nomes de credenciais não detecta segredos com nomes arbitrários. Os testes adversariais passaram; detalhes dos quality gates finais serão registrados abaixo.

## Auditoria dos pacotes npm

O `npm pack --dry-run` do diretório raiz resulta em `motion-studio-monorepo@1.1.1`, marcado `private: true`: **468.105.563 bytes compactados, 677.961.764 bytes descompactados, 10.832 arquivos**. Os 466,1 MB reportados na M5 pertenciam a esse monorepo privado; não são os tamanhos dos pacotes públicos.

| Pacote público | M5 — compactado / descompactado / arquivos | M6 após auditoria — compactado / descompactado / arquivos | Diferença observada |
|---|---:|---:|---:|
| `@technomanceer/motion-cli` | 61.660 / 203.744 / 26 | 62.566 / 206.947 / 26 | +906 / +3.203 / 0 |
| `@technomanceer/motion-core` | 783.164 / 2.781.435 / 105 | 783.819 / 2.783.835 / 105 | +655 / +2.400 / 0 |
| `@technomanceer/motion-studio-skills` | 14.248.382 / 27.870.491 / 208 | 14.065.752 / 27.680.507 / 194 | −182.630 / −189.984 / −14 |
| `@technomanceer/motion-studio` | 5.330 / 14.186 / 4 | 5.330 / 14.186 / 4 | 0 / 0 / 0 |

Os aumentos pequenos de CLI/Core são código e testes de runtime adicionados pela M6. A redução das Skills removeu `.github` e fixtures/pastas de teste que não são referenciadas pelo manifesto/Skills em runtime; exemplos, scripts e ativos das Skills necessários ao uso permanecem. Os quatro pacotes usam inclusão explícita; o scan do conteúdo e a instalação dos tarballs passaram. O script reproduzível é [`scripts/m6_distribution_smoke.mjs`](../../scripts/m6_distribution_smoke.mjs).

Instalação limpa em `/tmp/motion-m6-distribution-hYufo9`: os quatro tarballs 1.1.1 foram instalados sem scripts de terceiros. O instalador copiou as seis Skills de `integration` e validou os 17 hashes do manifesto. `motion doctor` passou nos requisitos obrigatórios e integridade; MCP instalado encontrou 30 ferramentas; `render_static` criou PNG válido, SHA-256 `3816f0af9bf59f92b92a70d44d1b7c47001a510d3c1788da94f4470639dd1177`; render CLI e MCP produziram o mesmo hash; traversal foi rejeitado.

Consulta ao registry em 2026-11-26 confirmou `1.1.1` como versão publicada de cada um dos quatro pacotes. Nenhuma publicação foi feita.

## Quality gates e CI

| Gate | Resultado M6 |
|---|---|
| `npm run test:ci` | PASS — 361 testes, 0 falhas, 0 pulados, 0 cancelados. |
| `npm run test:determinism` | PASS — workspaces independentes; timeline, segmentos, captions, voz, streams decodificados e MP4 idênticos. |
| `npm run test:py` | PASS — 25 testes, 108,1 s, sem skips. |
| `npm run skills:verify` | PASS — 17 Skills públicas, 4 registros locais no lock e hashes/licenças íntegros. |
| `node packages/motion-cli/bin/motion.mjs doctor --json` | PASS — Node 24.16, Python, FFmpeg, Chromium e dependências obrigatórias; opcionais ausentes aparecem como `INFO`. |
| `npm pack --dry-run` | Raiz privada: 10.871 arquivos, cerca de 469,3 MB compactados e 679,6 MB descompactados; inclui as 33 evidências do piloto Doop. Pacotes públicos e instalação limpa descritos acima. |
| Release gate `scripts/release-gate.mjs` | O gate de publicação 1.1.1 terminou `FAIL`: R1–R14 passaram (R2: 361/361); R15 `NOT_TESTED` localmente para Node 20/22; R16 `BLOCKED` por ausência de login npm; R17 `FAIL` porque os quatro pacotes 1.1.1 já existem no registry. Nenhum pacote foi publicado nem tentativa de publicação feita. Relatório detalhado em [`MISSION_23_M6_RELEASE_GATE.md`](MISSION_23_M6_RELEASE_GATE.md). |
| Node.js | Somente 24.16.0 está instalado localmente. Node 20/22 estão ausentes; os três majors precisam ser confirmados no CI pós-push. |
| CI remoto | PASS em `c0e2ec0ee719fab1ed340601344891e7dea8e8a5`: testes Node 20/22/24 e determinismo, quatro jobs aprovados. [Execução GitHub Actions](https://github.com/mateusarcedev/motion-studio/actions/runs/45757036913). |

As suítes MCP e entrega executadas diretamente nesta M6 passaram: `node --test tests/mcp_server.test.mjs tests/mcp_resource_limits.test.mjs tests/delivery_integrity.test.mjs` — 29 testes, 0 falhas. A repetição final do script de distribuição após as correções também passou; os tarballs e os testes de instalação correspondem às métricas na tabela. O teste de produção via cliente MCP oficial completou chamadas reais de render, QA, SVG e Bridge. O `git diff --check` passou antes dos commits. O commit documental `19658db241aa0b17de46cfba42333afb0bdfb918` passou no CI com os quatro jobs; [execução GitHub Actions](https://github.com/mateusarcedev/motion-studio/actions/runs/45758023543).

## Recomendação de release

`v1.2.0` é uma versão minor coerente com a adição compatível de ferramentas MCP locais, três Skills de integração, perfis de instalação, proteções de recursos e empacotamento revisado. Os quatro `package.json` permanecem em `1.1.1`; os tarballs acima são validação local e não publicação. A proposta, checklist, compatibilidade e ordem de atualização estão em [`RELEASE_NOTES_1.2.0_PROPOSAL.md`](RELEASE_NOTES_1.2.0_PROPOSAL.md).

**Recomendação:** manter a versão como proposta. O piloto Doop agora comprova criação do laboratório autorizado, leitura, importação e transformação local; não comprova exportação ao editor, que ficou fora da autorização recebida. Antes da release, confirmar CI Node 20/22/24 no commit final e declarar claramente que a escrita Motion-to-Design no Doop continua sem homologação. Não alterar versão nem publicar nesta missão.

## Trabalho restante para fechar M6

1. A homologação autorizada do laboratório foi executada: canvas criado e exatamente seis frames sintéticos escritos, lidos de volta e capturados. O usuário autorizou apenas esse laboratório e esses frames; exports e alterações em outros canvases não estão autorizados.
2. A importação, validação DesignIR, normalização e render local passaram em 6/6 frames; a landing responsiva passou em 5/5 viewports no target `web-director`. O teste sobre o target fixo `frame` falhou nos viewports menores e permanece documentado como limitação, não como aprovação.
3. O fluxo de saída Motion-to-Design foi mantido em dry-run. Não realizar escrita no Doop sem nova autorização explícita. A falta de ferramentas Doop para tokens globais e biblioteca/componentes impede homologar esses recursos; `04-components` não demonstrou expansão de `<doop-use>`.
4. A escrita Motion-to-Design no Doop permanece sem homologação porque não foi autorizada nesta execução; qualquer piloto de exportação exige escopo e autorização separados. Tokens globais e componentes seguem indisponíveis no catálogo MCP observado. M6 permanece parcial.

Nenhum passo da M6 avança automaticamente para uma nova missão.
