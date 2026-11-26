# Missão 23 — M6: homologação E2E e release gate

**Data:** 2026-11-26 · **Estado:** parcial · **Referência inicial:** `main` em `0a2ed3a5a4d407b38d3914b5cf139a43be7eab50` · **Runtime local:** Node 24.16.0, Python 3.14.5, FFmpeg 8.0.1.

## Resultado

A homologação local está concluída: campanha fictícia original produzida pelo fluxo criativo existente, execução pelo Motion MCP stdio, QA visual, instalação limpa dos quatro tarballs, testes MCP com cliente oficial e correções de segurança. A M6 permanece **parcial** porque o Doop MCP não listou o canvas permitido `Motion Studio — Integration Lab`. Não houve leitura nem escrita em canvases externos. A autorização específica para criar/popular o laboratório ainda não foi concedida.

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

O Doop MCP oficial estava disponível. `list_canvases` não encontrou `Motion Studio — Integration Lab`; canvases de outros projetos não foram abertos nem modificados. O catálogo oferece `create_canvas`, `create_frame`, `get_canvas`, `get_frame`, `get_frame_screenshot`, `get_prototype`, operações de HTML e `upload_asset`. `create_canvas` não foi chamado sem autorização específica.

O guia do Doop menciona operações `create_tokens` e `create_components`, mas esses nomes não existem no catálogo MCP conectado. Também não há ferramenta de inspeção/expansão de uma biblioteca de componentes. Por isso:

- O fluxo externo de importação, leitura de screenshots, exportação e releitura continua `NOT_TESTED`.
- A fixture `04-components` preserva `<doop-use>`, mas não comprova resolução, aparência ou reutilização do componente real.
- Fidelidade visual e fidelidade estrutural do canvas Doop, editabilidade de componentes e preservação de tokens globais permanecem sem medida.
- Não foi calculado SSIM contra Doop. SSIM de fixtures anteriores não comprova aparência, editabilidade ou componentes que não foram renderizados.
- O dry-run local classificou HTML sanitizado como editável, PNG com licença desconhecida como bloqueado, e vídeo como poster/storyboard referencial. JavaScript, vídeo e 3D não são declarados como elementos nativos editáveis.

O dry-run sintético de Motion-to-Design retornou `executed: false`; nenhuma operação externa foi simulada como sucesso.

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
| `npm pack --dry-run` | Raiz privada: 10.837 arquivos, 468.122.610 bytes compactados, 678.013.298 descompactados. Pacotes públicos e instalação limpa descritos acima. |
| Release gate `scripts/release-gate.mjs` | O gate de publicação 1.1.1 terminou `FAIL`: R1–R14 passaram (R2: 361/361); R15 `NOT_TESTED` localmente para Node 20/22; R16 `BLOCKED` por ausência de login npm; R17 `FAIL` porque os quatro pacotes 1.1.1 já existem no registry. Nenhum pacote foi publicado nem tentativa de publicação feita. Relatório detalhado em [`MISSION_23_M6_RELEASE_GATE.md`](MISSION_23_M6_RELEASE_GATE.md). |
| Node.js | Somente 24.16.0 está instalado localmente. Node 20/22 estão ausentes; os três majors precisam ser confirmados no CI pós-push. |
| CI remoto | PASS em `c0e2ec0ee719fab1ed340601344891e7dea8e8a5`: testes Node 20/22/24 e determinismo, quatro jobs aprovados. [Execução GitHub Actions](https://github.com/mateusarcedev/motion-studio/actions/runs/45757036913). |

As suítes MCP e entrega executadas diretamente nesta M6 passaram: `node --test tests/mcp_server.test.mjs tests/mcp_resource_limits.test.mjs tests/delivery_integrity.test.mjs` — 29 testes, 0 falhas. A repetição final do script de distribuição após as correções também passou; os tarballs e os testes de instalação correspondem às métricas na tabela. O teste de produção via cliente MCP oficial completou chamadas reais de render, QA, SVG e Bridge. O `git diff --check` passou antes dos commits. O commit documental `19658db241aa0b17de46cfba42333afb0bdfb918` passou no CI com os quatro jobs; [execução GitHub Actions](https://github.com/mateusarcedev/motion-studio/actions/runs/45758023543).

## Recomendação de release

`v1.2.0` é uma versão minor coerente com a adição compatível de ferramentas MCP locais, três Skills de integração, perfis de instalação, proteções de recursos e empacotamento revisado. Os quatro `package.json` permanecem em `1.1.1`; os tarballs acima são validação local e não publicação. A proposta, checklist, compatibilidade e ordem de atualização estão em [`RELEASE_NOTES_1.2.0_PROPOSAL.md`](RELEASE_NOTES_1.2.0_PROPOSAL.md).

**Recomendação:** manter a versão como proposta até o CI Node 20/22/24 passar e o piloto Doop ser concluído, ou a próxima release declarar explicitamente o Doop externo como não homologado. Não publicar nesta missão.

## Trabalho restante para fechar M6

1. Autorizar explicitamente a chamada oficial `create_canvas` com o nome **Motion Studio — Integration Lab**. Nenhuma criação externa ocorreu.
2. Criar nesse canvas apenas os seis frames sintéticos previstos: `01-landing`, `02-dashboard`, `03-mobile`, `04-components`, `05-prototype` e `06-dark-theme`.
3. Ler os frames/protótipo e screenshots com as ferramentas Doop atualmente disponíveis; importar, validar e produzir através do Motion MCP; registrar perdas estruturais/visuais e a ausência de APIs globais de tokens/componentes.
4. Rodar `motion-to-design` para gerar e validar um dry-run. Apresentar o plano exato e pedir autorização separada antes de qualquer escrita de exportação no Doop.
5. Reler as telas alteradas, comparar screenshots e hashes, reexecutar gates afetados, registrar resultados e atualizar M6 para completa apenas se a homologação externa terminar.

Nenhum passo da M6 avança automaticamente para uma nova missão.
