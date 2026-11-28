# Testes incrementais

## Fluxo local

Comece pelo diff. Para ver a seleção e executá-la:

```bash
npm run test:changed -- --explain
```

Para inspecionar sem executar, ou comparar com uma referência:

```bash
npm run test:changed -- --explain --dry-run
npm run test:changed -- --explain --base=HEAD~1
npm run test:changed -- --base=v1.1.1 --dry-run
```

O seletor combina alterações staged e unstaged, arquivos novos, remoções e renomes; com `--base`, também considera commits em `BASE...HEAD`. Ele usa dependências estáticas locais e regras de impacto explícitas. O diff aparece com status, módulos, grupos escolhidos e motivo por teste. Um diff sem mudanças executa o grupo `quick`; impacto sem regra ou dependência conhecida amplia para toda a cobertura CI executável. Documentação isolada executa verificações documentais e deixa claro que nenhum teste de produto rodou.

## Comandos

| Comando | Seleção |
|---|---|
| `npm test`, `npm run test:ci` | Testes `node:test` do Motion Core atribuídos à matriz Node. A cobertura de Skills, Python, Vitest e determinismo é executada nos jobs separados do CI. |
| `npm run test:quick` | Quatro arquivos de contrato curtos: bridge, comparação de renders, roteamento de QA e integridade de delivery. |
| `npm run test:changed` | Seleção baseada no diff atual; aceita `--base=REF`, `--explain` e `--dry-run`. |
| `npm run test:unit` | Arquivos do grupo unit no catálogo, incluindo runners Node, pytest e Vitest quando presentes. Testes marcados `blocked` aparecem separados e nunca contam como aprovados. |
| `npm run test:integration` | Contratos entre módulos, MCP, distribuição e integrações locais. |
| `npm run test:media` | Testes que produzem ou inspecionam mídia; também executa o gate existente de determinismo. |
| `npm run test:skills` | Testes Node/Vitest das Skills. Requer a instalação isolada descrita abaixo para o teste Vitest. |
| `npm run test:py` | Todos os arquivos Python executáveis no catálogo. |
| `npm run test:py:standalone` | Python sem dependência de uma versão Node específica; lista explicitamente os testes bloqueados fora da execução. |
| `npm run test:py:matrix` | Quatro contratos Python que executam Node e, portanto, rodam para cada versão da matriz. |
| `npm run skills:verify` | Integridade de catálogo, manifestos e hashes de Skills. |
| `npm run test:determinism` | Gate de determinismo com critério integral. Uma reexecução não apaga falha intermitente anterior. |
| `npm run test:determinism:replay` | Replay focado com intermediários preservados; consulte [DETERMINISM.md](../DETERMINISM.md). |
| `npm run test:release` | Gate explícito de preparação de release; executa checklist de release e gera tarballs públicos. Não publicar. |

Use Node 20 ou superior. Os grupos Python usam pytest, NumPy, SciPy e Pillow conforme os testes; instale-os em ambiente isolado:

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r scripts/test-requirements.txt
```

Para executar os testes Node/Vitest de Skills localmente:

```bash
npm ci
npm ci --prefix packages/motion-skills/skills/video-shotcraft
npm run test:skills
```

As dependências Vitest continuam isoladas no pacote de origem e não são adicionadas à raiz do monorepo.

## Catálogo e cobertura

[`test-catalog.json`](test-catalog.json) classifica cada arquivo de teste nos diretórios canônicos `tests/`, `packages/` e `scripts/`. Cópias versionadas das Skills em `.agents/`, `.claude/`, `.opencode/` e fixtures de demonstração em `projects/` não são descobertas como novas suítes, para não executar o mesmo teste várias vezes. O catálogo registra runner, categoria, módulo, importações locais diretas, recursos externos, requisitos de Chromium/FFmpeg/Python/MCP subprocesso, custo, criticidade, grupos e responsável do CI.

Novos arquivos que seguem as convenções `*.test.*`, `*.spec.*`, `test_*.py`, `*_test.py` ou `smoke_test.py` precisam ser classificados. Atualize e revise o catálogo com:

```bash
npm run test:catalog:write
npm run test:catalog:check
```

O verificador recompõe a lista a partir do Git e compara o JSON fonte-controlado. Um novo teste não classificado ou sem responsável de cobertura faz o CI falhar. O único arquivo marcado manualmente é o smoke test de Jianying para macOS: ele exige o aplicativo desktop e altera a biblioteca local do usuário, portanto não é seguro para CI sem intervenção.

O catálogo descreve cada arquivo de teste e não troca testes existentes por uma classificação. Há 127 registros: 124 executáveis, um smoke test Jianying explicitamente manual e dois testes Python de `ui-ux-pro-max` marcados `blocked`. Esses dois testes apontam para `refresh-google-fonts.py`, `refresh-icon-catalog.py` e `evaluate-relevance.py`, fontes ausentes do repositório e do histórico disponível; os arquivos de teste foram preservados. A saída do verificador e os relatórios de execução destacam esses bloqueios. Eles não contam como cobertura aprovada e precisam ser desbloqueados restaurando suas implementações. A classificação é reavaliada pela presença dos scripts: ao restaurá-los, o catálogo volta a atribuir os testes ao job Python executável.

O CI executa todos os 124 registros executáveis: 35 testes JavaScript centrais em cada Node 20/22/24, quatro contratos Python dependentes de Node em cada versão, 71 testes Node das Skills, um arquivo Vitest e 13 arquivos Python independentes. O smoke test Jianying é manual e os dois testes acima permanecem sem execução até que seus scripts-fonte sejam recuperados.

Os grupos atuais têm estes tamanhos antes de excluir estados `blocked`: `quick` 4, `unit` 45 (43 executáveis e 2 bloqueados), `integration` 40, `media` 41 e `skills-node` 72. Os grupos se sobrepõem por intenção; não são contagens aditivas.

## Impacto e exemplos

| Alteração | Seleção esperada | Exemplo de inspeção |
|---|---|---|
| `docs/WORKFLOW.md` | `git diff --check`; nenhum teste de mídia/produto | `npm run test:changed -- --explain --dry-run` |
| `docs/testing/test-catalog.json` | Verificador do catálogo e teste de descobrimento/cobertura | `npm run test:changed -- --explain --dry-run` |
| Texto, manifesto ou conteúdo público de Skill | Verificação de Skills; testes do módulo quando um arquivo de teste/código também mudou | `npm run test:changed -- --base=HEAD~1 --explain --dry-run` |
| Servidor, schema ou ferramenta MCP | Ex.: `packages/motion-cli/lib/mcp.mjs` seleciona 17 testes MCP | `npm run test:changed -- --explain` |
| Design Bridge | Ex.: `packages/motion-core/bridge/normalize.mjs` seleciona 31 contratos/dependentes | `npm run test:changed -- --explain` |
| SVG ou sanitizador | Validação SVG e segurança de parsing | `npm run test:changed -- --explain` |
| Áudio | Contratos `audio` e importadores do módulo | `npm run test:changed -- --explain` |
| Renderização, composição ou QA de mídia | Ex.: `render_static.mjs` seleciona 42 testes e aciona determinismo | `npm run test:changed -- --explain` |
| `package.json`, lockfile ou runner de testes | 124 testes executáveis, bloqueios listados e verificação do catálogo | `npm run test:changed -- --base=HEAD~1 --explain --dry-run` |

Os totais dos exemplos foram medidos com a função de seleção real sobre o catálogo atual; são dry-runs, não resultados das suítes hipotéticas. A seleção de documentação retorna zero testes de produto e apenas `git diff --check`. Mudanças em código de Skills também acionam `skills:verify`. Quando um impacto atinge registros `blocked`, o comando lista os motivos separadamente e os exclui da contagem de testes aprovados.

## Métricas e cache

As execuções Node e Vitest registram JSON em `tests/tmp/test-report-*.json`; as Python em `tests/tmp/python-test-metrics-*.json`. Os relatórios incluem runner/runtime, tempo de preparação, duração total e por arquivo, pass/fail/skip, chamadas a subprocessos classificados, renderizações/mídia, Chromium, FFmpeg/ffprobe, Python, MCP, criação de diretórios temporários e recursos máximos medidos. O runner Vitest exige que o número de arquivos coletados corresponda à seleção e reprova testes pendentes/todo. O CI guarda relatórios por 30 dias. A instrumentação registra apenas basename de executáveis e contagens, sem argumentos ou variáveis de ambiente.

As contagens de processos e temporários são instrumentadas nas APIs Node/Python interceptadas; uma chamada dentro de um shell ou subprocesso proprietário não é expandida em todos os subprocessos descendentes. RSS/CPU é do processo que escreveu o relatório, não um perfil completo do host. Use esses números para encontrar tendências e testes lentos, não como profiler de baixo nível.

Não há cache de resultados de teste. Seleção por impacto reduz as validações comuns sem risco de reutilizar PASS obsoleto. Um cache teria de incluir código, dependências, lockfiles, fixtures, configuração, argumentos e versões/ambiente dos runtimes; além disso, poderia ocultar o incidente intermitente de determinismo. O grupo de determinismo sempre executa renders independentes e não aceita reaproveitamento de artefatos como segunda execução.

Chromium não é compartilhado entre testes; cada cenário que exige processo/browser mantém o isolamento existente. Fixtures não são compartilhadas entre execuções. A concorrência pode ser limitada via `MOTION_TEST_CONCURRENCY=1`; no CI a suíte da matriz usa esse limite para preservar estabilidade de recursos.
