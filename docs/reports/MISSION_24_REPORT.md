# Relatório — Missão 24

**Data:** 26/11/2026  
**Base:** `89f265b8036482abf6cdcc0d95e31f6e68bd9f92` (`main`, limpa e sincronizada no início)  
**Escopo:** política de validação proporcional e infraestrutura reutilizável para replay focado de determinismo.

## Resultado

A política permanente foi alterada primeiro, em commit `910fbbe` (`docs(workflow): adopt impact-based test policy`). `docs/WORKFLOW.md`, `AGENTS.md`, `CLAUDE.md` e `GEMINI.md` agora orientam testes proporcionais ao impacto, gates direcionados e CI remoto abrangente. A política remove a obrigação de executar a suíte completa local antes de cada push e dispensa o empacotamento rotineiro da raiz privada do monorepo. Release gate permanece restrito a preparação de release.

Foi adicionado `npm run test:determinism:replay`, com tentativas repetidas (2–8) somente do estágio final usando intermediários preservados. O relatório guarda hashes de insumos antes/depois, saídas individuais, comandos FFmpeg, ambiente e comparações de vídeo e áudio decodificados, pacotes e contêiner. Cada tentativa usa uma nova pasta, MP4 e workdir. A leitura inválida não é uma divergência: `compareRenders` agora retorna `identical: null` em `read-error` e a classificação só confirma diferença quando o comparador terminou com `status: "different"`.

As classes têm códigos distintos: `PASS` (0), `FAIL_CONFIRMED` (1) e `INCONCLUSIVE` (2). Uma lista de comparação vazia, comparação inválida/ilegível, erro de execução ou divergência esperada que não reaparece é inconclusiva; não pode passar. Uma diferença de mídia já confirmada continua falhando mesmo que outras tentativas não concluam.

O artefato de diagnóstico do determinismo em falha no GitHub Actions teve retenção elevada de 14 para 30 dias. O pipeline normal continua intacto e não ignora divergências.

## Incidente de determinismo

O registro de referência é o run [45877470125](https://github.com/mateusarcedev/motion-studio/actions/runs/45877470125), já descrito no [relatório M23](MISSION_23_M6_REPORT.md). Ocorreu em Node 22.23.5, FFmpeg 6.1.1-3ubuntu5 e Chromium 156.0.8078.4: quatro de 183 frames finais divergiram (74, 77, 78, 79; PSNR de 104,03 a 107,04 dB), enquanto segmentos, overlays, legendas, áudio decodificado e pacotes de áudio permaneceram iguais. A reexecução do job passou. O incidente permanece intermitente e sem causa raiz; a M24 não altera esse status.

Foi feito um replay focado, e não um novo render de produção, usando os intermediários preservados do incidente. Duas composições foram executadas no host local Node 24.16.0 / FFmpeg 8.0.1-3ubuntu2, CPU Intel i5-1335U, 4 CPUs visíveis e 6 GiB de memória. Os dois MP4s resultaram no SHA-256 `8571f77d5288dba168bd000656e9bf6c6e6e0b8c2b735eec2a2a97586caca1b2`; hashes decodificados e de pacotes de vídeo/áudio e hash do contêiner foram idênticos. Os hashes dos intermediários permaneceram inalterados. Como a divergência esperada não apareceu em FFmpeg 8, o estado foi `INCONCLUSIVE` (código 2), não PASS para o incidente. O replay não iniciou Chromium; essa versão do ambiente histórico continua registrada na evidência M23.

Relatório completo do replay: [`final-stage-replay-2026-11-26.json`](assets/mission-24/final-stage-replay-2026-11-26.json). Ele registra o ambiente local, os hashes, os comandos, o estado inconclusivo e os caminhos temporários das saídas. Os MP4s temporários não foram adicionados ao repositório.

## Verificações locais

- `node --test tests/determinism_investigation.test.mjs`: **5/5 aprovados** na primeira execução.
- `node --test tests/compare_renders.test.mjs tests/determinism_investigation.test.mjs`: **9/9 aprovados**; cobre renders iguais, diferenças isoladas por stream, mudança apenas no contêiner e arquivos ausentes/truncados classificados como leitura inconclusiva.
- `node scripts/replay-determinism.mjs --help`: uso e escopo focado apresentados.
- `node --check scripts/replay-determinism.mjs`: aprovado.
- `node --check packages/motion-core/reel/render.mjs`: aprovado.
- Replay focado: duas tentativas concluídas; estado final **INCONCLUSIVE**, como esperado para a divergência histórica não reproduzida no ambiente local.
- O teste legado de render final foi refatorado para criar seu próprio timeline sintético em vez de depender de `tests/tmp/reel/edit.json`, que era produzido por outro teste. A seleção direta do teste final passou (**1/1**, incluindo dois renders e QA determinístico). Os testes `SOURCE_CHANGED` e validação CLI também criam o próprio timeline e passaram em seleção separada (**2/2**).

Não foram executados localmente `npm run test:ci`, `npm run test:determinism` (pipeline sintético completo), `npm run test:py`, `npm run skills:verify`, `motion doctor --json`, `npm pack` ou release gate. A suíte abrangente e a matriz Node 20/22/24 ficam para GitHub Actions conforme a política aprovada e o pedido desta missão. Não foram repetidas as homologações M23, nem alterados o laboratório Doop, o projeto OpenDesign ou os materiais da campanha.

## Commits e CI

1. `910fbbe` — política permanente de validação proporcional.
2. `05da71c` — replay focado, classificação, comparação triestado e testes direcionados.
3. Este relatório, o plano M24, a documentação de determinismo e a evidência arquivada ficam em commit documental separado.

Estado do CI remoto: pendente da execução disparada pelo push final. O CI executará a suíte abrangente e a matriz Node definida no workflow. Nenhuma versão npm foi alterada ou publicada.

## Pendências e limites

- Investigar a divergência intermitente apenas quando uma execução reproduzível estiver disponível; este trabalho não determina a causa.
- Reexecutar o replay com artefatos de uma falha futura sem modificar os critérios de determinismo.
- O replay atual cobre o estágio final e não reconstrói Chromium, segmentos, voz ou legendas.
- O fluxo permanece dependente da retenção/obtenção de `determinism-intermediates`; sem os insumos, o resultado é inconclusivo.
