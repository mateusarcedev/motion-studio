# STORYBOARD — Homologação Teste E: DevMetrics Engine (30s / 900 frames)

## Visão Geral da Linha do Tempo

```
00s ------------- 07.5s ------------- 15.0s ------------- 22.5s ------------- 30.0s
| ATO 1: SETUP    | ATO 2: DASHBOARD  | ATO 3: INTERAÇÃO  | ATO 4: RESOLUÇÃO  |
| 1-Line SDK Init | Bento Grid Live   | Cursor Clica      | Causa Identificada|
| Terminal Verde  | Throughput & P99  | Trace Waterfall   | npm i devmetrics  |
```

---

## Detalhamento dos Atos

### ATO 1: Zero-Config SDK Setup (Frames 0–225 / 0s–7,5s)
- **Visual:** Terminal de desenvolvedor limpo em primeiro plano. Linha de comando digita automaticamente: `npm i @devmetrics/node`. Código de integração em 1 linha exibido com realce de sintaxe: `devmetrics.init({ traceSample: 1.0 })`.
- **Motion:** Digitação de código fluida (typewriter effect), luz verde de conexão socket ativada: `CONNECTED TO CLUSTER US-EAST (0.8ms)`.
- **Keyframe Still:** Frame 120 (`out/still-01-setup.png`).

### ATO 2: Bento Grid Live Telemetry (Frames 226–450 / 7,5s–15,0s)
- **Visual:** O terminal se retrai e revela um Bento Grid moderno de 4 quadrantes:
  - Throughput: `48,210 RPS` com sparkline em onda senoidal.
  - Latência P99: `18.4 ms` (verde estável).
  - Error Budget: `99.98%` disponível.
  - Active Spans: `1,420 spans/s`.
- **Motion:** Cards revelados com staggered fade + slide vertical. Sparklines renderizadas dinamicamente.
- **Keyframe Still:** Frame 340 (`out/still-02-bento.png`).

### ATO 3: Stageshow Cursor & Distributed Trace Inspection (Frames 451–675 / 15,0s–22,5s)
- **Visual:** Um pico súbito de latência P99 ocorre no card (`18.4 ms → 340 ms ⚠️`). O cursor Stageshow entra na cena em curva bezier suave, aproxima do card em alerta, exibe tooltip de inspeção e clica com efeito de ripple circular.
- **Motion:** O card expande em tela cheia, revelando a cascata detalhada de spans do trace distribuído:
  - `POST /checkout` (340 ms)
  - `auth.validate_session` (2 ms)
  - `db.acquire_connection_pool` (338 ms ❌ Lock Contention).
- **Keyframe Still:** Frame 580 (`out/still-03-cursor-click.png`).

### ATO 4: Causa-Raiz & CTA Open-Source (Frames 676–900 / 22,5s–30,0s)
- **Visual:** O painel sintetiza a causa-raiz com badge verde de diagnóstico: *"Pool exhaustion detected on postgres-replica-02. Auto-scaling pool +30 connections."* A latência normaliza para `16.2 ms`.
- **Motion:** Tela fecha com card de CTA para desenvolvedores: comando de instalação, link para documentação e badge GitHub com estrelas.
- **Keyframe Still:** Frame 800 (`out/still-04-solution.png`).
