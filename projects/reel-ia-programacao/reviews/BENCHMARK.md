# Benchmark da homologação — Missão 21.1

Dados brutos: `benchmark.json` (`node benchmark.mjs`) e `qa-reel.md`. Medido no MP4 final
`out/final/reel.mp4`, SHA-256 `ab69fff2f230e6d5c7776f9935fee57186884782b497b7759b69428af323a3a5`.
Escuta humana e aprovação do Crítico não são métricas.

## Fala − pausa (mesmas 9 pausas, sobre o corte)

| Versão | dB |
|---|---|
| Bruto cortado, sem tratamento | 12,0 |
| Missão 21 (`noisy-room`, cadeia antiga) | 9,9 |
| **Missão 21.1 (`natural`, MP4 final)** | **13,25** |

Amostras isoladas da cadeia nova: `natural` 13,1 · `clean` 13,5 · `studio` 12,9 · `noisy-room` 13,3.

## Áudio e ritmo

| | Bruto | Missão 21.1 |
|---|---|---|
| Duração | 66,40 s | 53,47 s |
| Loudness | −16,17 LUFS | −14,09 LUFS |
| True peak (após AAC) | −1,16 dBTP | −1,71 dBTP |
| LRA | 2,4 LU | 2,4 LU (Missão 21: 1,2) |
| Pausas > 0,3 s (análise do próprio arquivo) | 13 (5,69 s) | 4 (1,48 s) |
| Tempo com fala | 86,5% | 90,4% |
| Cortes de tempo / zoom cuts / cards | — | 5 / 10 / 4 |

Legendas: 45 páginas, 153 palavras sobre fala (100%), 2 ocultas por decisão ("Mas" 0,05 e "ruim" 0,08).
Dois renders com o mesmo SHA-256.

Referência de terceiros, legenda humana e capa: **BLOCKED** (originais apagados de Downloads). Os
valores anteriores da referência estão no histórico do Git.
