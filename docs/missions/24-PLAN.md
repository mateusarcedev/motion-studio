# Missão 24 — Validação proporcional e investigação focada

## Objetivo

Reduzir o ciclo local de desenvolvimento com uma política permanente de validação proporcional ao impacto e um modo focado para repetir apenas a composição final de reels preservados. Manter o incidente intermitente registrado sem tratá-lo como resolvido por retries ou por uma reprodução em ambiente diferente.

## Escopo e estado

- [x] Substituir a exigência de rodar todos os quality gates antes de cada push por uma matriz de impacto em `docs/WORKFLOW.md`, com instruções alinhadas em `AGENTS.md`, `CLAUDE.md` e `GEMINI.md`.
- [x] Implementar replay do estágio final com 2–8 tentativas sob demanda, workdirs e saídas novos, hash dos insumos antes/depois e diagnóstico por stream/contêiner.
- [x] Distinguir `PASS`, `FAIL_CONFIRMED` e `INCONCLUSIVE`; resultado incompleto, leitura inválida ou divergência esperada não reproduzida não pode virar PASS.
- [x] Corrigir comparação de mídia para representar `read-error` como inconclusiva, sem reportar `identical: false` como diferença confirmada.
- [x] Remover a dependência do teste de render final em um arquivo criado por outro teste, permitindo executá-lo por seleção focada.
- [x] Preservar os artefatos do job de determinismo com retenção de 30 dias no GitHub Actions.
- [x] Reutilizar evidência histórica autorizada; não executar a campanha M23, laboratório Doop, pilotos OpenDesign ou release gate.
- [ ] Executar CI abrangente remoto na matriz configurada e registrar o resultado após o push.

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
