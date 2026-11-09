# BRIEF — Homologação Teste E: DevMetrics Engine (UI Motion & Software Showcase)

## 1. Identificação do Projeto
- **Título:** DevMetrics Engine — Observabilidade de Alta Precisão para Engenharia
- **Subtítulo:** Tracing distribuído em tempo real com setup em 1 linha e dashboard interativo
- **Cliente / Produto:** DevMetrics / TelemetryKit Open-Source
- **ID:** `homolog-e-software-showcase`

## 2. Dimensões de Intenção Criativa (Studio Director v2)
- **Assunto:** Ferramental de Engenharia de Software e Observabilidade (`software` / `devops`)
- **Intenção:** Demonstrar o funcionamento do software, valor técnico e arquitetura de dashboard (`demonstrate` / `showcase_app`)
- **Público:** Engenheiros de software, DevOps, SREs e liderança técnica (`developers` / `technical_teams`)
- **Canal:** Vídeo vertical mobile 9:16 — LinkedIn, Twitter/X, GitHub Readme, Reels (`vertical_social`)
- **Linguagem Visual:** UI Motion contemporâneo, Bento Grid estruturado, cursor de mouse animado com física de mola (padrões Stageshow), Dark Terminal Glassmorphism (`ui_motion` / `stageshow_patterns`)

## 3. Especificações Técnicas
- **Formato:** 1080 × 1920 (9:16 vertical)
- **Taxa de quadros:** 30 FPS CFR determinístico
- **Duração Total:** 30 segundos (900 frames)
- **Estrutura de 4 Atos (7,5s / 225 frames por ato):**
  - Ato 1 (0s–7,5s / frames 0–225): Setup em 1 linha de código e inicialização do agente de telemetria.
  - Ato 2 (7,5s–15s / frames 226–450): Bento Grid interativo com métricas ao vivo (Throughput, P99 Latency, Error Budget).
  - Ato 3 (15s–22,5s / frames 451–675): Interação de Cursor — ponteiro suave aproxima do alerta de anomalia, clica e expande cascata de spans do distributed trace.
  - Ato 4 (22,5s–30s / frames 676–900): Diagnóstico de causa-raiz instantâneo e fechamento com release open-source (`npm i devmetrics`).
- **Pausa Cognitiva:** Mínimo de 1,8s de repouso visual em cada transição para absorção de dados de instrumentação.

## 4. Integração de Padrões Stageshow
- Cursor virtual com vetor natural SVG, easing desacelerado e estados visuais: *default*, *hovering* com halo, e *active click* com onda de expansão radial.
- Bento Grid com cartões modulares dotados de bordas luminosas suaves (`rgba(255,255,255,0.08)`) e tipografia monoespaçada alinhada por linha de base.
- Foco óptico: card ativo recebe realce de brilho enquanto cards secundários esmaecem suavemente.
