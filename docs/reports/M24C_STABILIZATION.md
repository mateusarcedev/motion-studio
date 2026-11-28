# Relatório M24C — Paridade, catálogo e estabilização

## Classificação

**Parcial.** A integridade do catálogo Python foi recuperada e validada. A divergência intermitente CLI × MCP continua **inconclusiva**: os artefatos localizam a diferença na composição final do vídeo, mas o replay focado não reproduziu os MP4s históricos e não revelou a causa. Não foi feita uma alteração no motor de renderização nem se declara a paridade resolvida. A aceitação final depende de identificar uma causa reproduzível, corrigi-la e confirmar a correção sob as condições problemáticas.

## Estado inicial

- Branch `main`, HEAD e `origin/main` em `3cfb15af6f55070dca7d010a603af8e3cd7e9bf8`; árvore inicialmente limpa.
- A validação abrangente anterior estava aprovada no run [46109037653](https://github.com/mateusarcedev/motion-studio/actions/runs/46109037653); M24B ainda registrava dois contratos Python bloqueados por fontes ausentes e o incidente de paridade em aberto.
- Foram lidos os contratos e instruções aplicáveis e preservada a política proporcional de [WORKFLOW.md](../WORKFLOW.md). M23 não foi repetida.

## Investigação da paridade CLI × MCP

### Execuções e artefatos históricos

| Run | Resultado relevante | Evidência |
|---|---|---|
| [45884408723](https://github.com/mateusarcedev/motion-studio/actions/runs/45884408723) | Incidente anterior na matriz Node 22; a divergência documentada afetou vídeo, enquanto áudio permaneceu igual. | Histórico de M24A e registro de CI. |
| [46106703492](https://github.com/mateusarcedev/motion-studio/actions/runs/46106703492) | Node 20 falhou; Node 22/24 passaram. | [Artefato 15248270932](https://github.com/mateusarcedev/motion-studio/actions/runs/46106703492/artifacts/15248270932), SHA-256 `dd39962c911d156a105df25ffedfcc813918c2afdd4e21109a3dbbab8a79651f`. |
| [46107491931](https://github.com/mateusarcedev/motion-studio/actions/runs/46107491931) | Todos os jobs passaram entre duas falhas de Node 20; a não reprodução não resolve o incidente. | Run de CI aprovado. |
| [46108296635](https://github.com/mateusarcedev/motion-studio/actions/runs/46108296635) | Node 20 voltou a falhar com os mesmos hashes por stream; demais jobs aplicáveis passaram. | [Artefato 15248339059](https://github.com/mateusarcedev/motion-studio/actions/runs/46108296635/artifacts/15248339059), SHA-256 `63c54df55dc7250fe7fdf2f780cea5f3278b2e1245e422601587c8d4a3274950`. |
| [46109037653](https://github.com/mateusarcedev/motion-studio/actions/runs/46109037653) | CI abrangente aprovado no baseline desta missão. | Não apaga as falhas intermitentes anteriores. |

Nos runs 46106703492 e 46108296635, os artefatos CLI e MCP concordam byte a byte nas entradas/timeline, WAV de voz, captions e três segmentos MP4 intermediários. Os MP4s finais diferem:

| Métrica do vídeo final | CLI | MCP |
|---|---|---|
| SHA-256 do contêiner | `97b607bb476566d4f8b03e26581e28a8977ec9ef984c90856ef11bf10e0d12e0` | `280f3345c8586ba5fcb235c4f812f4bc3aabe5d0369597167d3be49a561694a0` |
| SHA-256 do vídeo decodificado | `583ba61ea52105ec30674e07676079092efe99683eb8a0249c1768a002a71dac` | `3f488e55be49084ddc10977653e4b4f51665393d358bc268121a9344d9313a2e` |
| SHA-256 dos pacotes de vídeo | `254e39693ed8545b0b8934b56edc9c078579bb2108fe9416ffb0f1c65aaa5de7` | `9f54c69ffc7da9ce19c9f0d6442b150491f629b7e7038437feb142ae5b458a53` |
| Áudio decodificado e pacotes de áudio | iguais | iguais |

Os relatórios históricos identificam FFmpeg `6.1.1-3ubuntu5`, 183 quadros a 30 fps e Node `v20.20.2` nos dois runs Node 20. A reprodução visual frame a frame feita localmente com FFmpeg 8 identificou diferenças nos quadros 74–77; no quadro 75, 4.888 pixels diferiram, com caixa delimitadora x=160–1079/y=410–1425 e delta RGB máximo 37; os quadros 74, 76 e 77 tiveram diferenças menores. Esta decodificação usa FFmpeg 8 e é somente uma análise posterior dos arquivos, não uma medição de hash decodificado no runtime histórico.

### Replay focado e hipóteses

O replay focado de M24A foi executado duas vezes de forma independente para cada origem CLI/MCP, sob Node 20.20.2 e FFmpeg 6.1.1. Os dois lados e as duas origens produziram o mesmo SHA-256 de saída `367558142379ea9a7d30d60920a3da3ac391f1cb1ce9f0b3544970420d56c11e`; os hashes das entradas ficaram inalterados. O resultado **não** é igual a nenhum dos dois MP4s históricos: comparado com cada original, o vídeo decodificado e os pacotes de vídeo diferem, embora o áudio continue igual. A mesma reprodução foi feita com os artefatos montados em `/artifacts` e no caminho absoluto original de GitHub Actions; o resultado foi o mesmo. Portanto, o replay é estável, mas não reconstitui a execução que falhou e não prova uma correção.

Hipóteses e evidência disponível:

- **Entradas, fontes e assets:** artefatos históricos confirmam igualdade das entradas, timeline, fonte Inter, WAV, captions e segmentos CLI/MCP. Isso desloca a primeira diferença observável para a composição final, sem explicar a divergência dentro dela.
- **Parâmetros FFmpeg:** os artefatos históricos guardam versão e parâmetros do render, mas não a linha de comando completa nem a configuração de build. Em execução local aprovada, CLI e MCP usaram argumentos finais equivalentes após normalizar PID, identificadores e caminhos temporários: AAC 192 kbit/s, 48 kHz, estéreo; vídeo libx264 high/yuv420p, CRF 18, preset medium, GOP 60, BT.709, 30 fps CFR, 183 quadros, quatro threads e flags bitexact. Isso é evidência do ambiente local, não dos processos históricos que divergiram.
- **Threads, concorrência e estado:** o teste executa CLI e MCP sequencialmente; no CI, `MOTION_TEST_CONCURRENCY=1`. As duas saídas têm workdirs e nomes temporários diferentes. Os registros antigos não retêm argumentos ou ambiente suficientes para testar todas as diferenças de estado/concorrência.
- **Tempo, FPS, timebase e pixel format:** 30 fps e 183 quadros estão registrados; os argumentos locais indicam CFR, yuv420p e BT.709. Não há captura histórica completa de timebase/argv para comparar as chamadas CLI/MCP que divergiram.
- **Node/plataforma:** as ocorrências documentadas abrangem Node 22 e Node 20, e houve execuções verdes entre falhas. O replay local aprovado usou Node 20 em um runner Docker com CPU Intel i5-1335U e quatro CPUs, diferente do Intel Xeon 6975P-C do CI. Os resultados não isolam uma versão Node ou arquitetura como causa.
- **Codificação, timestamps, ordenação e cache:** os hashes de segmentos e o áudio iguais descartam divergência observável nessas saídas, mas os artefatos não capturam todos os timestamps internos, logs de chamadas ou estados de cache necessários para atribuição causal.

O teste `tests/mcp_parity.test.mjs` agora pode, quando `MOTION_MCP_PARITY_CAPTURE_FFMPEG=1`, registrar cada chamada FFmpeg, argumentos, diretório atual e ambiente (Node/V8, sistema/CPU, concorrência e saída completa de `ffmpeg -version`). O CI Node configura essa coleta, e publica a pasta diagnóstica em caso de falha. O workflow manual de replay aceita Node 20/22/24, executa todas as rodadas solicitadas sem mascarar falhas e copia os dados de cada rodada malsucedida antes de continuar. A instrumentação melhora o próximo diagnóstico; **não corrige a causa nem enfraquece o teste exato**.

### Veredito da paridade

**INCONCLUSIVA / NÃO RESOLVIDA.** Não há causa raiz identificada, patch do renderizador ou teste de regressão associado a uma causa confirmada. Replays estáveis fora do runner problemático e CI verde isolado não cumprem os critérios de resolução. A pendência permanece para investigação focada se uma falha instrumentada registrar a primeira chamada/parâmetro divergente.

## Scripts Python e integridade do catálogo

O histórico Git local não continha os três scripts. A revisão upstream identificável [a38d04c3d5c298c851dbe5e6ee1965ee3de42cb5](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/commit/a38d04c3d5c298c851dbe5e6ee1965ee3de42cb5) adicionou os contratos correspondentes e está sob MIT. Foram restaurados `refresh-google-fonts.py`, `refresh-icon-catalog.py`, `evaluate-relevance.py` e seu helper puro `relevance_metrics.py`, com a licença upstream. O avaliador mantém o comportamento offline padrão; o refresh Google Fonts só usa rede no modo explícito `--live` e possui `--api-input` para uso offline.

O evaluator é executado de uma árvore vendorizada e achatada. Foi adicionado um fallback de resolução para esse layout sem alterar o caminho canônico upstream. Como o fingerprint oracle cobre o código do avaliador, os dois manifests agora apontam para o fingerprint resultante `ce3d0a3eb2d083056577297380cc2e2ba84d7940f8f8d6639e54151309d05b48`. Métricas, amostras, splits, fingerprint do runtime, floors, tolerâncias e casos bloqueados não foram alterados. A regressão executa o CLI sem API/rede e compara métricas/amostras/splits com o baseline aprovado.

| Teste/validação | Resultado local |
|---|---|
| `test_catalog_refresh.py` | 11/11 passaram; 3,20 s no runner oficial instrumentado. |
| `test_relevance_evaluator.py` | 13/13 passaram; 8,25 s, incluindo CLI offline e igualdade do baseline. |
| Runner pytest dos dois arquivos | 24 passaram, zero falhas/skips, 11,62 s total, 0,10 s de preparação; 34 processos observados, 23 fábricas de fixtures, zero FFmpeg/Chromium e pico RSS 357.376 KB. Executado em venv temporário com `scripts/test-requirements.txt`. |
| `npm run test:catalog:check` | 127 arquivos classificados; sem testes `blocked`. |
| `node --test tests/test_catalog.test.mjs` | 15/15 passaram; execução mais recente em 8,01 s. |
| `npm run skills:verify` | 17 Skills públicas, quatro registros de lock, licenças e hashes aprovados. |
| Compilação Python, `node --check tests/mcp_parity.test.mjs`, YAML dos dois workflows via Ruby, `git diff --check` | Passaram. |

O catálogo mantém **127 registros: 126 executáveis e um manual**, que continua sendo o smoke test Jianying por necessitar do app macOS e alterar a biblioteca do usuário. Os novos testes Python estão no job `python`, grupo `python-standalone`, com dependências explícitas em seus scripts de produção. A verificação de catálogo reverte para `blocked` se uma das implementações necessárias desaparecer; o seletor de impacto direciona alterações nos quatro scripts/helpers aos contratos respectivos.

## Preservação da eficiência da M24B

Os comandos `test:quick`, `test:unit`, `test:changed`, `test:integration`, `test:media`, `test:release`, `test:py:standalone`, `test:py:matrix`, `test:determinism:replay` e `skills:verify` foram preservados. As mudanças na seleção e na estrutura dos jobs de CI mantêm o fallback conservador de impacto desconhecido, a matriz Node e os jobs Python/Skills independentes.

`npm run test:changed -- --explain --dry-run` foi executado sobre o diff então composto por 18 caminhos e selecionou os 126 testes executáveis porque a alteração em workflows e no seletor é infraestrutura compartilhada. O modo `--dry-run` não iniciou testes. Nenhuma suíte completa local foi executada. A suíte integral abrangente fica no CI remoto.

As medições locais deste escopo não são uma comparação de suíte completa com o baseline M24B. O grupo restaurado, que antes estava bloqueado e portanto não tinha duração executável anterior, passou em 11,62 s no runner Python oficial. O replay independente de paridade levou 66,16 s e 78,36 s nas duas reproduções anteriores já documentadas, ambas aprovadas em outro hardware. M24B permanece historicamente parcial no seu ponto de encerramento; os acompanhamentos desta missão registram o desbloqueio posterior sem reescrever a medição histórica.

O release gate não foi executado porque seus pré-requisitos locais não estavam satisfeitos: só Node 24 está instalado por asdf (Node 20/22 não estão disponíveis) e `npm whoami --registry=https://registry.npmjs.org/` retornou HTTP 401. O workflow também gera quatro tarballs em `dist/packages`, onde já existem artefatos 1.1.1, e sobrescreve o relatório padrão; esses arquivos foram preservados. A matriz de versões será verificada no CI final. Não houve `npm pack`, publicação, tag ou distribuição.

## Commits, CI e riscos

**Commits e CI final:** pendentes antes do push desta estabilização; serão preenchidos após commits atômicos e execução do CI no HEAD final.

Riscos/pedências:

1. A divergência final de vídeo continua sem causa raiz e sem correção. O requisito de conclusão 1–3 da Missão 24C não está cumprido.
2. Os artefatos históricos não contêm as linhas FFmpeg nem o build configuration completos; a coleta de falha foi ampliada para capturar isso em ocorrências futuras.
3. O runner pytest na máquina de desenvolvimento não estava instalado. Os testes foram executados em ambiente virtual temporário usando as dependências versionadas; o CI remoto é a validação final de cobertura.
4. Jianying continua manual por depender de ambiente/app macOS.

A Missão 24C só pode ser classificada como **concluída** depois de uma causa reproduzível, correção com regressão, replays independentes aprovados em condições equivalentes e CI verde. Até lá, status parcial, sem retry usado como critério de sucesso.
