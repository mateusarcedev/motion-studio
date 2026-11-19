---
name: explainer-motion
description: Produz motion graphics explicativos de alto nível para temas técnicos, algoritmos, produtos, negócios e visualização de dados (1080×1920 9:16 ou 1920×1080 16:9 a 30 FPS CFR). Inspirado pelo benchmark de qualidade do vídeo Big O Notation — onde o movimento ensina, demonstra e conecta conceitos através de diagramas vivos, transformações geométricas, tipografia editorial expressiva e contadores sincronizados. Nunca gera apresentações com 'cara de PowerPoint'.
---

# Explainer Motion — Visual Pedagogy & Motion Graphics Benchmark

O `explainer-motion` é a especialidade do MOTION Studio dedicada à produção de vídeos explicativos onde **cada animação tem função narrativa**: explicar visualmente o comportamento interno de um sistema, algoritmo, arquitetura de software, regra de negócio ou dado abstrato.

Não substitui os pipelines 3D (`3d-scene-director` / `lemo-opuscar`) nem os teasers rápidos com beat sync (`motion-designer`), mas estabelece o padrão de excelência para **vídeos educacionais e explicativos profissionais**.

---

## 1. Princípios Fundamentais (Benchmark Big O)

1. **O Movimento Ensina (Motion with Narrative Function):**
   - Nenhuma forma surge ou se move apenas para preencher o tempo de tela.
   - O movimento responde a causas: um evento empurra um dado, uma condição valida ou bloqueia uma porta, uma curva acelera para demonstrar complexidade computacional.

2. **Arquitetura Espacial Vertical 9:16 (1080×1920):**
   - **Âncora Superior (Y: 15% a 25%):** Tipografia grande, imponente e hierarquizada. Título do conceito em destaque cromático (`font-size: 110px–150px`, peso 800–900) acompanhado de subtítulo explicativo de 1 a 2 linhas (`font-size: 36px–42px`, `#FFFFFF`).
   - **Motor Visual Interativo (Y: 30% a 75%):** Diagramas SVG ou Canvas que evoluem no tempo (nós, arcos direcionados, matrizes, arrays com ponteiros, gates lógicos, gráficos cartesianos).
   - **Telemetria Sincronizada (Y: 78% a 90%):** Contadores em tempo real, rótulos de estado e métricas numéricas (`passos: N`, `estado_ativo = X`, `n = 6 / operações: 64`) que ancoram a abstração matemática em valores tangíveis.

3. **Ritmo e Respiração Visual (Pacing):**
   - **Entrada (0.6s – 1.0s):** Entrada limpa com easing cúbico (`cubic-bezier(0.16, 1, 0.3, 1)`) ou spring amortecido.
   - **Demonstração Ativa (2.5s – 4.5s):** Ação visual progressiva, onde elementos se transformam, feixes percorrem conexões e contadores incrementam.
   - **Pausa de Compreensão (1.5s – 2.0s):** O estado final estabiliza para permitir a leitura e o processamento cognitivo antes da próxima transição.
   - **Transição Conectiva (0.5s – 0.8s):** Continuidade espacial (o elemento da cena anterior se transforma ou dá origem ao elemento da próxima, evitando cortes secos descontextualizados).

4. **Paleta Semântica Controlada:**
   - Fundo escuro profundo (`#050811` a `#0B0F19`) com brilho radial atmosférico sutil.
   - Uma cor de ênfase primária forte (ex: Âmbar `#FF8A00` ou Ciano `#00F0FF`).
   - Cores secundárias estritamente semânticas: Menta (`#15F5BA`) para validação/sucesso, Coral (`#FF4757`) para erro/bloqueio, Zinco/Slate (`#334155` a `#94A3B8`) para nós passivos e estrutura.

---

## 2. O Que Jamais Fazer (Anti-Patterns)

- ❌ Slides estáticos com fade-in genérico (aspecto de "PowerPoint exportado para MP4").
- ❌ Textos surgindo repetidamente sem progressão visual.
- ❌ Diagramas estáticos que não se animam nem respondem a eventos.
- ❌ Contadores desconectados da demonstração visual.
- ❌ Transições circenses ou aleatórias que rompem a continuidade espacial.
- ❌ Cenas sem tempo de leitura suficiente ou com cortes abruptos.

---

## 3. Contrato Técnico Determinístico

- **Resolução Nativa:** 1080×1920 (9:16 vertical) ou 1920×1080 (16:9 horizontal).
- **Taxa de Quadros:** 30 FPS CFR (Constant Frame Rate).
- **Driver de Quadro:** Função pura dependente exclusivamente do número absoluto do frame via `window.__onFrame__(frame, totalFrames, fps)`.
- **Zero Dependência Externa:** Fontes locais/embutidas, sem chamadas de rede externas, renderização instantânea em Chromium headless.

## Primitivas reutilizáveis do MOTION Core

Para dados já validados e linguagem visual aprovada, `animated-counter`, `timeline-sequence`, `data-callout`, `kinetic-text-reveal`, `comparison-panel` e `progress-gauge` podem compor uma explicação. Consulte os schemas com `motion components list`; configure os parâmetros em vez de alterar o código do componente. Use transições com easing apenas quando ajudarem a explicar continuidade ou mudança de estado. Componentes são opcionais: diagramas causais e cenas customizadas continuam preferíveis quando ensinam melhor. Antes da entrega, use `motion qa determinism` e `motion qa safe-zones` e inspecione as evidências visuais.
