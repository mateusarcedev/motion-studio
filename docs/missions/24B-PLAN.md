# Missão 24B — Infraestrutura incremental de testes

## Contexto e relação com M24A

M24A, encerrada em 923b2e0, entregou a política de validação proporcional e os instrumentos de replay/diagnóstico focados descritos em [MISSION_24_REPORT.md](../reports/MISSION_24_REPORT.md). M24B implementa os demais entregáveis da Missão 24 original: catálogo central, seleção por impacto, medições de execução e redução da repetição no GitHub Actions.

O incidente intermitente de determinismo continua sendo uma investigação separada. Esta etapa preserva suas evidências, não tenta resolver sua causa raiz e não trata retries aprovados como resolução.

## Plano e estado

- [x] Confirmar main, worktree limpo e referência 923b2e0.
- [x] Inventariar testes canônicos em tests/, packages/ e scripts/, incluindo runners e cobertura CI/manual.
- [x] Adicionar detecção de novos testes sem classificação e cobertura vazia.
- [x] Implementar seleções distintas test:quick, test:changed, test:unit, test:integration, test:media e test:release.
- [x] Incluir staged, unstaged, arquivos novos/removidos/renomeados e commits a partir de --base.
- [x] Adicionar dependências locais diretas/transitivas e regras explícitas por impacto; fallback desconhecido é conservador.
- [x] Instrumentar duração/preparação por arquivo e suíte, subprocessos, render/mídia, Chromium, FFmpeg/ffprobe, Python, MCP, fixtures e recursos do processo.
- [x] Separar Python independente da matriz Node e manter na matriz os contratos Python que executam Node.
- [x] Executar testes Node das Skills e Vitest uma vez; verificar catálogo público uma vez.
- [x] Reservar release gate a acionamento manual; não executar gate nem empacotar a raiz privada nesta missão.
- [x] Atualizar instruções, matriz de impacto, workflow e documentação de métricas/cache.
- [x] Fazer commits atômicos em main, enviar, validar o CI remoto para os registros executáveis e registrar suas medições finais; run [46105820880](https://github.com/mateusarcedev/motion-studio/actions/runs/46105820880) aprovado em Node 20/22/24, Python independente e de matriz, Skills, catálogo e determinismo.
- [ ] Recuperar as três fontes de `ui-ux-pro-max` ausentes e reabilitar os dois testes Python correspondentes. M24B permanece parcial enquanto isso não for feito.

## Seleção e comandos

Os detalhes de instalação e uso estão em [TESTING.md](../testing/TESTING.md). O catálogo fonte-controlado está em [test-catalog.json](../testing/test-catalog.json).

O catálogo parte das convenções de arquivos de teste dentro dos diretórios canônicos do código. As cópias instaladas de Skills e as fixtures de projetos não são executadas como suítes adicionais. O teste Jianying permanece listado como manual por depender de macOS/aplicativo desktop e por instalar um rascunho na biblioteca do usuário.

## CI

O catálogo contém 127 arquivos: 124 executáveis, um manual e dois testes Python bloqueados porque seus módulos fonte ausentes não existem no repositório/histórico disponível. A matriz Node 20/22/24 executa os 35 testes JS centrais e quatro contratos Python que precisam daquele Node. Um job Python executa os 13 arquivos independentes executáveis uma vez. Um job Node 22 executa os 71 testes Node de Skills, o arquivo Vitest, a verificação do catálogo e a integridade de Skills. O smoke test Jianying permanece manual. Os dois testes bloqueados são destacados no catálogo e nos comandos e não contam como aprovados; essa lacuna impede declarar a cobertura completa. Determinismo continua independente. O job de release só inicia por workflow_dispatch com run_release_gate=true.

No run 46105820880, cada Node passou 382 testes dos 35 arquivos centrais (0 falhas e dois skips já previstos), e seus quatro contratos Python passaram 61 testes. Python independente passou 184 testes em 13 arquivos; Skills passou 503 casos Node e 23 Vitest, sem skips. O job de determinismo passou. O gate de release permaneceu ignorado por não ter sido acionado manualmente.

## Estado de cobertura

M24B entrega a infraestrutura incremental, mas fica **parcial** enquanto os dois testes `ui-ux-pro-max` não puderem coletar. Suas fontes esperadas (`refresh-google-fonts.py`, `refresh-icon-catalog.py`, `evaluate-relevance.py`) não constam no código rastreado nem foram localizadas no histórico consultável. Os testes não foram removidos, reescritos ou tratados como aprovados. Restaurar as implementações e então reabilitar seus registros é trabalho pendente; não bloqueia a execução dos demais testes catalogados.

As permissões do workflow permanecem contents: read; não há etapa de publicação. Métricas de execução e os artefatos diagnósticos da paridade/determinismo preservam 30 dias.

## Limites

- O grafo de dependência local é estático; importação dinâmica, caminhos montados em runtime e subprocessos internos a um shell podem exigir regra conservadora de impacto.
- A instrumentação mede chamadas observáveis pelas APIs de processo interceptadas e recursos do processo que grava o relatório. Não substitui profiler completo.
- Cache de resultados foi avaliado e adiado. Seleção por impacto cobre o ganho frequente sem risco de reutilizar PASS após alteração de ambiente/runtime nem ocultar falha intermitente.
- O incidente de determinismo Node 22/FFmpeg 6 e ocorrências anteriores em Node 24 permanecem abertos, sem causa raiz.
- As metas de duração são objetivos de engenharia: quick 30s, changed comum 2min, unit 2min, integration 5min, media 10min. Resultados acima das metas devem ser reportados com gargalo, não escondidos por skips, cache ou menor critério.
