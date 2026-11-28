# Relatório M24B — Infraestrutura incremental de testes

## Estado

M24B implementa o catálogo, os grupos incrementais, a seleção por impacto, a instrumentação e a divisão de jobs de CI. A cobertura permanece **parcial** por dois testes Python existentes cuja implementação sob teste não está no repositório: `test_catalog_refresh.py` requer dois scripts de refresh ausentes e `test_relevance_evaluator.py` requer `evaluate-relevance.py`, também ausente. Os testes foram mantidos e são registrados como `blocked`; seus resultados não contam como PASS. O smoke test Jianying continua manual.

M24A permanece concluída no commit `923b2e0`. A divergência intermitente Node 22/24 permanece uma investigação independente, sem reexecuções de homologação da M23 nesta etapa.

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
| `test:quick` | total 6,76s (prep 2,64s; execução 4,12s); 4 arquivos, 31 casos | dentro da meta de 30s |
| `test:unit` | total 9,53s (prep 1,84s; execução 7,69s); 43 arquivos/399 casos aprovados | dentro da meta de 2min; dois testes são `BLOCKED` e não contam nos 399 |
| `test:changed --base=HEAD~1 --explain --dry-run` no diff da M24B | 2,95s; selecionou os 124 registros executáveis e listou os dois bloqueados | dry-run; nenhum produto foi aprovado por essa medição |
| `node --test tests/test_catalog.test.mjs` | 14/14 testes do seletor e do catálogo aprovados | direcionado; inclui staged/unstaged, renomes e referências de catálogo |
| `test:changed` para documentação | só verificação documental | não executa testes de produto nem mídia |
| `test:changed` para lockfile/infra | amplia para a cobertura executável catalogada | intencionalmente acima da meta comum de 2min |

Os relatórios em `tests/tmp/test-report-*.json`, `test-report-command-*.json` e `python-test-metrics-*.json` registram preparação, execução, total, duração por arquivo, subprocessos observáveis, renderizações, Chromium, FFmpeg, ffprobe, Python, MCP, fixtures e RSS/CPU do processo escritor. Os artefatos de CI têm retenção de 30 dias. Os tempos locais não substituem a medição final nos runners Ubuntu; a tabela será complementada com a execução remota da branch main desta mudança.

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

Medição local mais recente de `test:quick`: total 6,76s, 97 inícios observáveis de processo, 46 saídas de mídia, 49 FFmpeg, 12 ffprobe, 36 Python, 18 preparações de diretórios temporários e RSS máximo de 109.668 KB. Os arquivos mais lentos foram `delivery_integrity.test.mjs` (4,10s) e `compare_renders.test.mjs` (3,19s). `test:unit` executou 29 arquivos Node (178 casos, 1,65s), 13 arquivos Python (198 casos, 5,19s; mais lentos `test_data_contracts.py` 2,41s e `test_core.py` 2,16s) e um arquivo Vitest (23 casos, 0,58s); total 399 casos aprovados em 9,53s end-to-end, com dois testes bloqueados. O contrato Python da matriz executou 4 arquivos/61 casos em 0,26s. Esses contadores incluem atividade indireta via subprocesso e não são profiler de host.

## Testes realizados e pendências

Verificações direcionadas executadas durante a implementação: validação de sintaxe dos scripts, compilação Python, 14 testes do catálogo/seletor, quatro arquivos do grupo quick e quatro contratos Python da matriz (61 casos). O grupo unit passou em 29 arquivos Node (178 casos), 13 arquivos Python (198 casos) e um arquivo Vitest (23 casos); os dois testes sem fonte foram destacados como `BLOCKED`. A execução por alteração desde `HEAD~1` selecionou os 124 registros executáveis e listou os bloqueios; foi apenas dry-run.

O ambiente local não tem Chromium; `integration` com browser e a suíte de Skills dependente dele serão validados no GitHub Actions. Não executar localmente `test:ci`, `test:skills`, `test:media` ou release gate como bateria completa. O determinismo será executado pelo job remoto independente.

**Pendente:** recuperar as três implementações ausentes para reabilitar dois testes Python e completar a aceitação “nenhum teste existente fora da cobertura de execução”. Até lá, M24B é parcial, mesmo se os jobs para os registros executáveis passarem.
