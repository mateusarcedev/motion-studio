# Missão 24A — Validação proporcional e investigação focada

Este arquivo registra a etapa M24A, concluída em `923b2e0`. A infraestrutura incremental prevista originalmente na Missão 24 foi separada em [M24B](24B-PLAN.md); M24A não representa a conclusão dos entregáveis de M24B.

## Objetivo

Reduzir o ciclo local de desenvolvimento com uma política permanente de validação proporcional ao impacto e um modo focado para repetir apenas a composição final de reels preservados. Manter o incidente intermitente registrado sem tratá-lo como resolvido por retries ou por uma reprodução em ambiente diferente.

## Escopo e estado

- [x] Substituir a exigência de rodar todos os quality gates antes de cada push por uma matriz de impacto em `docs/WORKFLOW.md`, com instruções alinhadas em `AGENTS.md`, `CLAUDE.md` e `GEMINI.md`.
- [x] Implementar replay do estágio final com 2–8 tentativas sob demanda, workdirs e saídas novos, hash dos insumos antes/depois e diagnóstico por stream/contêiner.
- [x] Distinguir `PASS`, `FAIL_CONFIRMED` e `INCONCLUSIVE`; resultado incompleto, leitura inválida ou divergência esperada não reproduzida não pode virar PASS.
- [x] Corrigir comparação de mídia para representar `read-error` como inconclusiva, sem reportar `identical: false` como diferença confirmada.
- [x] Remover a dependência do teste de render final em um arquivo criado por outro teste, permitindo executá-lo por seleção focada.
- [x] Preservar os artefatos do job de determinismo com retenção de 30 dias no GitHub Actions.
- [x] Preservar os renders/workdirs de paridade CLI × MCP quando testes falharem e disponibilizar `keepWork` no MCP de reel render como opção diagnóstica.
- [x] Reutilizar evidência histórica autorizada; não executar a campanha M23, laboratório Doop, pilotos OpenDesign ou release gate.
- [x] Executar CI abrangente remoto na matriz configurada e registrar o resultado após o push. Run [45886422855](https://github.com/mateusarcedev/motion-studio/actions/runs/45886422855) aprovado em Node 20/22/24, determinismo, testes Python e Skills; a divergência previamente confirmada continua aberta porque não reapareceu neste run.

## Interfaces entregues

```bash
npm run test:determinism:replay -- \
  --source=/caminho/para/render-preservado \
  --runs=4 \
  --evidence-dir=/caminho/para/evidencias \
  --expect-difference
```

O replay requer `reel.render.json`, `reel.timeline.json` e `reel.work/render-*/`. Ele apenas chama a composição final sobre intermediários preservados. Não repete análise, voz, segmentos nem Chromium. Consulte [`DETERMINISM.md`](../DETERMINISM.md) para semântica dos resultados e códigos de saída.

## Incidente histórico

O incidente Node 22.23.5 / FFmpeg 6.1.1-3ubuntu5 / Chromium 156, incluindo quatro frames finais divergentes com áudio e intermediários iguais, permanece aberto e sem causa raiz. Seu relatório e hashes são referência histórica; uma reexecução aprovada não substitui essa evidência. A missão entrega instrumentos para continuar a investigação de forma independente, sem ampliar seu escopo para uma análise ilimitada da causa.

O CI da M24 também confirmou uma divergência em vídeo no teste CLI × MCP em Node 22 / FFmpeg 6.1.1, com áudio, WAV, preview e legendas idênticos. Como aquela execução ainda não anexava os artefatos da paridade, não há frames ou segmentos preservados. Essa ocorrência é registrada como nova evidência intermitente, sem afirmar causa comum ou resolução; falhas futuras terão os intermediários disponíveis para replay focado.
