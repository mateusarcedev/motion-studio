# STYLE — Homologação Teste E: DevMetrics Engine

## 1. Princípios Visuais & Linguagem Gráfica
- **Arquétipo:** Dark Modern Developer Tooling & Glassmorphic Bento UI.
- **Sensação:** Alta performance, latência zero, clareza cirúrgica de telemetria, estética tipo Linear/Vercel/Datadog moderno.
- **Padrões de Interação (Stageshow inspired):** Cursor de mouse fluido guiando a atenção visual do espectador, feedback de clique responsivo, zoom contextual e iluminação de contorno nos cards da interface.

## 2. Paleta Cromática

| Papel Semântico | Cor | Hex | Aplicação |
| :--- | :--- | :--- | :--- |
| **Fundo de Aplicação** | Deep Obsidian Slate | `#090D16` | Fundo base limpo de alto contraste |
| **Superfície do Painel** | Card Glass Obsidian | `#111827` | Cartões do Bento Grid |
| **Bordas & Separadores** | Subdued Wireframe | `#1F2937` | Linhas de divisão de dados |
| **Acento de Telemetria** | Violet Laser | `#8B5CF6` | Destaques primários de navegação |
| **Métrica Saudável** | Emerald Pulse | `#10B981` | Status 200 OK, uptime e buffers |
| **Alerta / Anomalia** | Coral Flare | `#F43F5E` | P99 latency spike e span quebrado |
| **Cursor & Ponteiro** | Crisp White Cursor | `#FFFFFF` | Seta de cursor SVG com sombra de profundidade |

## 3. Tipografia
- **Interface e Títulos:** Sans-serif moderno geométrico (`system-ui`, `-apple-system`, `sans-serif`), pesos 600 e 800.
- **Código e Dados Técnicos:** Monospaced (`"JetBrains Mono"`, `"Geist Mono"`, `SFMono-Regular`, `monospace`), peso 700.

## 4. Elementos Visuais Chave
- Terminal minimalista com syntax highlighting (`import { devmetrics } from "devmetrics"`).
- Bento Grid 2×2 dinâmico contendo:
  - Card A: Throughput em tempo real (RPS) com mini gráfico de sparkline.
  - Card B: P99 Latency Gauge com limiar de anomalia.
  - Card C: Distribuição de erros e status das microsserviços.
  - Card D: Painel de Distributed Tracing com cascata de spans (gateway → auth → db).
- Cursor Stageshow com rastro luminoso suave e clique tátil.
