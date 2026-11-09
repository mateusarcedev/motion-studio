# STORYBOARD — Homologação Teste C: Liofilização Industrial (45s / 1350 frames)

## Visão Geral da Linha do Tempo

```
00s ---------------- 11s ---------------- 23s ---------------- 35s ---------------- 45s
|  ATO 1: CONGELAR   | ATO 2: SUBLIMAÇÃO  | ATO 3: DESSORÇÃO   | ATO 4: NITROGÊNIO  |
|  -45°C Criogenia   | Vácuo < 6,11 mbar  | +30°C Vácuo Alto   | Selagem a vácuo    |
|  Microcristalização| Sólido -> Vapor    | Água Residual <2%  | Validade: 25 anos  |
```

---

## Detalhamento dos Atos

### ATO 1: Ultracongelamento Rápido (Frames 0–330 / 0s–11s)
- **Foco Visual:** Alimento entra no túnel criogênico. Temperatura despenca de +20 °C para -45 °C em segundos.
- **Gráfico:** Matriz celular com água livre se transformando em microcristais hexagonais de gelo, sem romper as paredes celulares.
- **Telemetria:** Temp: `-45.0 °C` | Pressão: `1013 mbar` | Umidade: `85.0%`.
- **Keyframe Still:** Frame 160 (`out/still-01-freeze.png`).

### ATO 2: Vácuo Profundo & Sublimação Primária (Frames 331–690 / 11s–23s)
- **Foco Visual:** Câmara de liofilização é selada. Bomba de vácuo reduz a pressão para 0,08 mbar (muito abaixo do Ponto Triplo de 6,11 mbar). Prateleiras aquecem suavemente a -15 °C.
- **Gráfico:** As moléculas de gelo passam diretamente para vapor sem gotículas líquidas. O vapor é atraído e capturado pelo condensador a -70 °C.
- **Telemetria:** Temp: `-15.0 °C` | Pressão: `0.08 mbar` | Umidade: `18.5%`.
- **Keyframe Still:** Frame 500 (`out/still-02-sublimation.png`).

### ATO 3: Dessorção Secundária (Frames 691–1050 / 23s–35s)
- **Foco Visual:** Aquecimento suave a +30 °C sob vácuo máximo (< 0,02 mbar) remove as moléculas de água quimicamente ligadas à matéria biológica.
- **Gráfico:** A estrutura interna revela uma matriz porosa esponjosa intacta, com cor e formato idênticos ao produto fresco original.
- **Telemetria:** Temp: `+30.0 °C` | Pressão: `0.02 mbar` | Umidade: `1.8%`.
- **Keyframe Still:** Frame 870 (`out/still-03-desorption.png`).

### ATO 4: Selagem sob Atmosfera Inerte ($N_2$) & Síntese (Frames 1051–1350 / 35s–45s)
- **Foco Visual:** Quebra de vácuo com injeção controlada de gás Nitrogênio ultrapuro ($N_2$). Envasamento em embalagem hermética aluminizada.
- **Gráfico:** Alimento pronto para consumo imediato ou reidratação instantânea em água, mantendo 98% dos nutrientes originais sem conservantes por 25 anos.
- **Telemetria:** Temp: `+22.0 °C` | Pressão: `1013 mbar (N₂)` | Umidade: `1.5%`.
- **Keyframe Still:** Frame 1200 (`out/still-04-sealing.png`).
