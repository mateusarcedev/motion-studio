# Benchmark da homologação — Missão 21.1

Dados brutos: `benchmark.json` (`node benchmark.mjs`) e `qa-reel.md`. Medido no MP4 final
`out/final/reel.mp4`, SHA-256 `e745f550a127ad4a6b997b2323d5aca1ebceb5b26a4fbf8177a76949d8243eac`.
Escuta humana e aprovação do Crítico não são métricas.

## Fala − pausa (sobre o corte)

| Versão | dB |
|---|---|
| Bruto cortado, sem tratamento | 12,0 |
| Missão 21 (`noisy-room`, cadeia antiga) | 9,9 |
| **Missão 21.1 (`natural`, MP4 final)** | **12,7** (7 pausas no corte final; as linhas acima são do corte anterior, 9 pausas) |

Amostras isoladas da cadeia nova: `natural` 13,1 · `clean` 13,5 · `studio` 12,9 · `noisy-room` 13,3.

## Áudio e ritmo

| | Bruto | Missão 21.1 |
|---|---|---|
| Duração | 66,40 s | 51,40 s |
| Loudness | −16,17 LUFS | −14,09 LUFS |
| True peak (após AAC) | −1,16 dBTP | −1,65 dBTP |
| LRA | 2,4 LU | 2,6 LU (Missão 21: 1,2) |
| Pausas > 0,3 s (análise do próprio arquivo) | 13 (5,69 s) | 4 (1,47 s) |
| Tempo com fala | 86,5% | 91,4% |
| Cortes de tempo / zoom cuts / cards | — | 5 / 10 / 5 |

Legendas: 44 páginas; 1 palavra oculta por decisão ("Mas", 0,05).
Dois renders com o mesmo SHA-256.

Referência de terceiros, legenda humana e capa: **BLOCKED** (originais apagados de Downloads). Os
valores anteriores da referência estão no histórico do Git.
