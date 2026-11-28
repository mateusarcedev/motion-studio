# Relatório M24B — Infraestrutura incremental de testes

## Estado

M24B implementa o catálogo, os grupos incrementais, a seleção por impacto, a instrumentação e a divisão de jobs de CI. A cobertura permanece **parcial** por dois testes Python existentes cuja implementação sob teste não está no repositório: `test_catalog_refresh.py` requer dois scripts de refresh ausentes e `test_relevance_evaluator.py` requer `evaluate-relevance.py`, também ausente. Os testes foram mantidos e são registrados como `blocked`; seus resultados não contam como PASS. O smoke test Jianying continua manual.

M24A permanece concluída no commit `923b2e0`. A divergência intermitente permanece uma investigação independente, sem reexecuções de homologação da M23 nesta etapa. Além dos dois testes Python bloqueados por fontes ausentes, o run final na `main` observou uma divergência CLI × MCP de vídeo em Node 20, registrada abaixo; não houve retry nem declaração de resolução.

## Commits de implementação

- `f176cff` — catálogo central e seleção incremental.
- `a88fb50` — fixtures para o runner de Skills.
- `8ad242e` — separação dos jobs Python e Skills no CI.
- `a819148` e `f29e268` — documentação e medições iniciais.
- `800049a` — FFmpeg no job Python independente.
- `70cf12c` — preserva a forma de `execFile` promisificado, instala `esbuild` para testes e fornece `NODE_PATH` da raiz aos workers de Skills.

## Inventário e seleção

O catálogo fonte-controlado tem 127 registros: 124 executáveis, um manual e dois bloqueados. Os testes executáveis distribuem-se em 35 arquivos `node:test` centrais, quatro testes Python na matriz Node, 71 arquivos `node:test` de Skills, um arquivo Vitest e 13 arquivos Python independentes. Os números são arquivos de teste, não quantidade de casos individuais.

O seletor combina arquivos staged, unstaged e untracked com alterações desde `--base`; preserva estado de arquivo removido ou renomeado, calcula dependências locais diretas/transitivas e aplica regras de impacto para documentação, Skills, MCP, Design Bridge, SVG, áudio, render e dependências compartilhadas. Alteração de infraestrutura ou impacto não resolvido amplia para todos os registros executáveis. Seleção vazia usa `quick` ou falha; nunca vira aprovação vazia. Registros bloqueados atingidos aparecem separados.

Exemplos de comando no diff atual:

```bash
npm run test:changed -- --explain --dry-run
npm run test:changed -- --base=HEAD~1 --explain --dry-run
npm run test:changed -- --explain
```

Exemplos de impacto codificados e exercitados pelo mesmo seletor:

| Arquivo representativo | Seleção/validação selecionada |
|---|---|
| `docs/WORKFLOW.md` | `git diff --check`; nenhum teste de produto/mídia |
| `packages/motion-skills/skills/anatomy/kit/iso-kit.mjs` | 45 testes afetados e verificação de manifestos/hashes |
| `packages/motion-cli/lib/mcp.mjs` | 17 testes selecionados pelo impacto MCP |
| `packages/motion-core/bridge/normalize.mjs` | 31 testes de contrato/dependentes do Design Bridge |
| `packages/motion-core/design-system/svg-motion.js` | validação e segurança SVG |
| `packages/motion-skills/skills/media-use/audio/scripts/lib/audio-meta.mjs` | grupo `audio` e dependentes |
| `packages/motion-core/renderers/render_static.mjs` | 42 testes selecionados e gate de determinismo |
| `package-lock.json` | 124 testes executáveis e dois bloqueios reportados; verificação do catálogo |

As contagens acima foram produzidas executando o seletor sobre o catálogo atual com caminhos representativos; são seleções em dry-run, não resultados de execução das suítes hipotéticas. No diff real da M24B, o dry-run de `test:changed` também escolheu 124 arquivos e registrou os dois bloqueios, sem executar os testes.

## Medições e baseline

### Baseline antes de M24B

Run [45887866107](https://github.com/mateusarcedev/motion-studio/actions/runs/45887866107), em `923b2e0`, concluiu com sucesso. A suíte JS central levou 351s em Node 20, 352s em Node 22 e 356s em Node 24. Cada matriz também executou a suíte Python inteira: 86s, 87s e 87s, respectivamente. Os 260 segundos-agente Python representavam aproximadamente 173 segundos de execução redundante além de um único job de 87s. A verificação de Skills também era repetida uma vez por matriz.

### Medições M24B

| Seleção | Resultado local medido | Limite/observação |
|---|---:|---|
| `test:quick` | total 7,68s (prep 2,15s; execução 5,53s); 4 arquivos, 31 casos | dentro da meta de 30s |
| `test:unit` | total 9,53s (prep 1,84s; execução 7,69s); 43 arquivos/399 casos aprovados | dentro da meta de 2min; dois testes são `BLOCKED` e não contam nos 399 |
| `test:changed --base=923b2e0 --explain --dry-run` para a M24B inteira | 2,57s; selecionou os 124 registros executáveis e listou os dois bloqueados | dry-run; nenhum produto foi aprovado por essa medição |
| `node --test tests/test_catalog.test.mjs` | 15/15 testes do seletor, catálogo e preloader aprovados | direcionado; inclui staged/unstaged, renomes, referências e forma promisificada de `execFile` |
| Anatomy, runner incremental instrumentado | 33/33 casos em seis arquivos, 17,79s; 9 inicializações de Chromium | cobre subprocessos browser, módulos React/esbuild e a captura de saída em Node 24 |
| `test:changed` para documentação | só verificação documental | não executa testes de produto nem mídia |
| `test:changed` para lockfile/infra | amplia para a cobertura executável catalogada | intencionalmente acima da meta comum de 2min |

Os relatórios em `tests/tmp/test-report-*.json`, `test-report-command-*.json` e `python-test-metrics-*.json` registram preparação, execução, total, duração por arquivo, subprocessos observáveis, renderizações, Chromium, FFmpeg, ffprobe, Python, MCP, fixtures e RSS/CPU do processo escritor. Os artefatos de CI têm retenção de 30 dias. A tabela remota abaixo complementa as medições locais com duração de jobs e arquivos nos runners Ubuntu.

### CI final da implementação

O run [46105820880](https://github.com/mateusarcedev/motion-studio/actions/runs/46105820880), no commit de implementação `70cf12c`, concluiu todos os jobs executáveis em **7min38s**. O run baseline [45887866107](https://github.com/mateusarcedev/motion-studio/actions/runs/45887866107) levou **9min05s**. A parede total caiu 87s (16%), mesmo adicionando a suíte completa de Skills que antes não era executada como testes.

| Job | Antes | M24B | Evidência M24B |
|---|---:|---:|---|
| Node 20 | 508s | 432s | suíte principal 358,11s; 382 aprovados, 0 falhas, 2 skips existentes; 35 arquivos |
| Node 22 | 519s | 441s | suíte principal 368,12s; 382 aprovados, 0 falhas, 2 skips existentes; 35 arquivos |
| Node 24 | 541s | 455s | suíte principal 365,65s; 382 aprovados, 0 falhas, 2 skips existentes; 35 arquivos |
| Python independente | repetido na matriz | 149s | 13 arquivos, 184 aprovados em 94,04s; dois bloqueados excluídos explicitamente |
| Python dependente de Node | incluso na suíte Python repetida | 0,50–0,79s por Node | 4 arquivos/61 aprovados em cada Node 20/22/24 |
| Skills, catálogo e Node | verificação repetida; testes Node não executados | 255s | 503 aprovados/0 falhas/0 skips em 71 arquivos Node; 23/23 Vitest; catálogo e `skills:verify` aprovados |
| Determinismo | 94s | 89s | gate aprovado; sem nova evidência sobre a causa raiz intermitente |

O tempo da suíte JavaScript principal variou de 351–356s no baseline para 358–368s no run M24B; portanto, a suíte Node isolada não ficou mais rápida. O ganho veio de retirar aproximadamente 86–87s de Python serializados de cada job da matriz: a suíte Python independente agora roda uma vez, enquanto somente os quatro contratos que precisam da versão Node permanecem na matriz. Somados os contratos, a execução Python observada caiu de 260s de agente no baseline para cerca de 96s. Os jobs independentes de Python, Skills e determinismo rodaram em paralelo à matriz.

### Redundâncias removidas e cobertura adicionada

- Python independente da versão Node roda uma vez, em job dedicado; só os quatro contratos que invocam Node continuam na matriz 20/22/24.
- `skills:verify` e a suíte Node/Vitest das Skills rodam uma vez num job Node 22, em vez de repetir a verificação pública em cada versão Node.
- O CI agora executa 71 arquivos Node e um arquivo Vitest das Skills que o workflow anterior não executava como testes; essa cobertura nova aumenta o trabalho total de CI, embora reduza trabalho duplicado.
- Determinismo continua isolado e com critérios e evidências intactos. O cache é só de dependências/browsers; não há cache de resultados ou de renders.
- O release gate só roda por `workflow_dispatch` com `run_release_gate=true`. Não foi executado; nenhum pacote foi publicado ou empacotado a partir da raiz privada.

## Comandos e otimizações

Implementados: `test:quick`, `test:changed`, `test:unit`, `test:integration`, `test:media`, `test:release`, `test:skills`, `test:catalog:check`, `test:catalog:write`, `test:py:standalone` e `test:py:matrix`. Permanecem `npm test`, `test:ci`, `test:py`, determinismo e `skills:verify`.

O runner Node registra duração por arquivo; o runner Vitest exige correspondência do conjunto selecionado/coletado e nenhuma pendência; a instrumentação preload observa APIs de subprocesso, FFmpeg/render, Chromium, MCP, criação de fixtures e recursos dos processos. O coletor Python registra preparação, execução, duração por arquivo, skips, subprocessos classificados e recursos do processo. Não há compartilhamento de browser ou fixtures entre execuções independentes. A concorrência dos testes Node do CI é limitada a 1; os jobs têm timeouts de 15–30 minutos. Não foi introduzido timeout artificial por teste nem cache de evidências.

## Workflow e validação

O workflow separa matriz JS/contratos Python Node, Python independente, Skills/catálogo e determinismo. `contents: read`, política de skips e upload de diagnósticos permanecem. O job opcional de release é manual e não publica.

Medição local mais recente de `test:quick`: total 7,68s, 97 inícios observáveis de processo, 46 saídas de mídia, 49 FFmpeg, 12 ffprobe, 36 Python, 18 preparações de diretórios temporários e RSS máximo de 108.880 KB. Os arquivos mais lentos foram `delivery_integrity.test.mjs` (5,51s) e `compare_renders.test.mjs` (4,26s). `test:unit` executou 29 arquivos Node (178 casos, 1,65s), 13 arquivos Python (198 casos, 5,19s; mais lentos `test_data_contracts.py` 2,41s e `test_core.py` 2,16s) e um arquivo Vitest (23 casos, 0,58s); total 399 casos aprovados em 9,53s end-to-end, com dois testes bloqueados. O contrato Python da matriz executou 4 arquivos/61 casos em 0,26s. O replay direcionado de seis testes Anatomy passou 33 casos em 17,79s, com nove inícios de Chromium. Esses contadores incluem atividade indireta via subprocesso e não são profiler de host.

## Testes realizados e pendências

Verificações direcionadas executadas durante a implementação: validação de sintaxe dos scripts, compilação Python, 15 testes do catálogo/seletor/preloader, quatro arquivos do grupo quick, quatro contratos Python da matriz (61 casos), `test:quick` (31 casos) e seis arquivos Anatomy (33 casos). O grupo unit passou em 29 arquivos Node (178 casos), 13 arquivos Python (198 casos) e um arquivo Vitest (23 casos); os dois testes sem fonte foram destacados como `BLOCKED`. A execução por alteração desde `923b2e0` selecionou os 124 registros executáveis e listou os bloqueios; foi apenas dry-run.

O ambiente local possui Chromium pelo cache Playwright e os testes de browser acima foram executados pelo runner instrumentado. A suíte completa de Skills, `test:ci`, `test:media` e release gate não foram executados localmente; a cobertura abrangente fica delegada ao GitHub Actions. O determinismo permanece no job remoto independente.

### Diagnóstico das validações remotas

O primeiro workflow precisou de FFmpeg no job Python independente. A execução inicial das Skills também encontrou que o preload de métricas substituía `child_process.execFile` sem preservar `util.promisify.custom`, que os workers Anatomy não recebiam o `NODE_PATH` da raiz e que três testes React dependiam de `esbuild` sem declarar a dependência de desenvolvimento. A correção instalou FFmpeg no job dedicado, preservou o resultado promisificado e a contagem de processos, forneceu o caminho raiz aos workers e declarou `esbuild`. O teste de regressão do preloader e 33 casos Anatomy direcionados passaram localmente; em CI, os 503 testes Node e 23 Vitest passaram sem falhas ou skips.

**Validação remota final da implementação:** run [46105820880](https://github.com/mateusarcedev/motion-studio/actions/runs/46105820880), commit `70cf12c`: matriz Node 20/22/24, Python, Skills/catálogo e determinismo aprovados. O job Release gate foi ignorado conforme esperado, pois não houve acionamento explícito. Nenhum pacote foi empacotado ou publicado.

### Incidente intermitente observado no CI do commit documental

O run posterior [46106703492](https://github.com/mateusarcedev/motion-studio/actions/runs/46106703492), no commit `90e2812` (documentação), não concluiu integralmente: o único job com falha foi Node 20, em `tests/mcp_parity.test.mjs`, no round-trip CLI × MCP. O teste registrou divergência em `video.decoded`, `video.packets` e `container`; os dois streams de áudio comparados eram idênticos e não houve erros reportados pelo comparador. Evidência registrada no runner: Node `v20.20.2`, CPU Intel Xeon 6975P-C (4 CPUs), FFmpeg `6.1.1-3ubuntu5`.

Hashes observados (`a` = CLI; `b` = MCP):

| Stream | CLI (`a`) | MCP (`b`) | Resultado |
|---|---|---|---|
| Vídeo decodificado | `583ba61ea52105ec30674e07676079092efe99683eb8a0249c1768a002a71dac` | `3f488e55be49084ddc10977653e4b4f51665393d358bc268121a9344d9313a2e` | diferente |
| Pacotes de vídeo | `254e39693ed8545b0b8934b56edc9c078579bb2108fe9416ffb0f1c65aaa5de7` | `9f54c69ffc7da9ce19c9f0d6442b150491f629b7e7038437feb142ae5b458a53` | diferente |
| Áudio decodificado | `6f3b78d63b9a1d44f33b63c2208ca62b0b1e8bd7651bd847cdad421999d2bbc5` | igual a CLI | idêntico |
| Pacotes de áudio | `7b49f2181ce8a8cc5854c5cdee44dc45c1673755fcab32ea4cc95f2a7fffc5b7` | igual a CLI | idêntico |
| Contêiner | `97b607bb476566d4f8b03e26581e28a8977ec9ef984c90856ef11bf10e0d12e0` | `280f3345c8586ba5fcb235c4f812f4bc3aabe5d0369597167d3be49a561694a0` | diferente |

O artefato de falha do workflow foi preservado como [mcp-parity-node20, artifact 15248270932](https://github.com/mateusarcedev/motion-studio/actions/runs/46106703492/artifacts/15248270932), 70.447.044 bytes, SHA-256 `dd39962c911d156a105df25ffedfcc813918c2afdd4e21109a3dbbab8a79651f`, retenção até 2026-12-28. Node 22/24, Python independente, Skills/catálogo e o job separado `test:determinism` passaram nesse run; o job Node 20 encerrou antes do contrato Python da matriz, que já havia passado em todas as versões no run 46105820880.

Esse resultado é divergência confirmada entre os artefatos de vídeo, não apenas diferença de metadados do contêiner. Uma aprovação no run 46105820880 e o PASS do job dedicado de determinismo não apagam a falha. A causa permanece **intermitente e sob investigação independente**; esta missão preserva o artefato e os hashes, não repete o cenário nem declara resolução. Como o último CI não ficou totalmente verde e dois testes Python seguem bloqueados por fontes ausentes, o estado global de M24B permanece **parcial**.

**Pendente:** recuperar as três implementações ausentes para reabilitar dois testes Python e completar a aceitação “nenhum teste existente fora da cobertura de execução”. Até lá, M24B é parcial, mesmo se os jobs para os registros executáveis passarem.
