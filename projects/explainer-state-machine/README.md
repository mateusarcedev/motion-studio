# Máquinas de Estados em Programação — Explainer Motion (60s @ 30 FPS CFR)

**MOTION Studio — Benchmark de Qualidade Audiovisual & Pedagogia Visual**  
**Formato:** 1080 × 1920 (Vertical 9:16)  
**Taxa de Quadros:** 30.00 FPS CFR (Constant Frame Rate)  
**Duração:** 60.00 segundos (1800 quadros exatos)  
**Codec:** H.264 / AVC (High Profile, yuv420p)  
**Áudio:** Master Visual Puro (`audio: null`)  

---

## 1. Visão Geral do Projeto

Esta produção foi criada para estabelecer o novo padrão de **Explainer Motion** no MOTION Studio, utilizando a linguagem, o ritmo e o acabamento do benchmark *Big O Notation*. O objetivo é demonstrar como o movimento ensina conceitos complexos de ciência da computação e arquitetura de software através de código, transformações geométricas e telemetria viva.

### Estrutura em 7 Atos Narrativos
1. **00.0s – 08.0s (F000–F239) · Sopa de Booleanos:** O problema real de flags soltas (`isLoading`, `isError`, etc.) colapsando em combinações contraditórias de $2^4 = 16$ estados e o erro simultâneo de spinner + sucesso.
2. **08.0s – 16.0s (F240–F479) · Estados Finitos:** O modelo formal da Máquina de Estados Finita (FSM). Nós discretos onde apenas um estado pode estar ativo por vez (`IDLE` ativo com anéis orbitais).
3. **16.0s – 25.0s (F480–F749) · A Transição:** Disparo do evento `FETCH`. Uma partícula de dados viaja ao longo do arco vetorial, desativando `IDLE` e ativando `FETCHING` com expansão elástica de mola (*spring rebound*).
4. **25.0s – 34.0s (F750–F1019) · Guardas Lógicas:** Portal de validação condicional (`hasValidData()`). Teste 1 com payload vazio é bloqueado e repelido; Teste 2 com payload válido abre os feixes em menta fluorescente.
5. **34.0s – 43.0s (F1020–F1289) · Evento Inválido Repelido:** Em `RESOLVED`, um evento ilegal `FETCH` tenta disparar sem reset prévio. O nó ativo repele o ataque com escudo defletor e vibração amortecida física, sem alterar o estado.
6. **43.0s – 52.0s (F1290–F1559) · Ciclo Completo em Ação:** Grafo quadrangular completo executando o ciclo de vida real: `IDLE` ➔ `FETCHING` ➔ falha de rede `ERROR` ➔ ação de `RETRY` ➔ `RESOLVED`.
7. **52.0s – 60.0s (F1560–F1799) · Conclusão & Síntese:** Os nós convergem e se fundem em um monograma geométrico estável e 3 preceitos de arquitetura: *Estados Discretos*, *Transições Explícitas*, *Modelagem Explícita* ("Uma modelagem explícita ajuda a impedir estados e transições inválidos").

---

## 2. Como Reproduzir e Renderizar

### Pré-requisitos
- Node.js $\ge 18$
- Playwright Chromium (`~/.cache/ms-playwright/` ou `/usr/bin/chromium`)
- Python 3 + FFmpeg / FFprobe instalados

### Passo a Passo

1. **Testar o Determinismo:**
   ```bash
   node projects/explainer-state-machine/test_determinism.mjs
   ```
   Valida a ausência de erros de console e confirma que o mesmo frame (ex: frame 450) gera o mesmo hash SHA-256 isoladamente e em lote sequencial.

2. **Renderizar Keyframes de Inspeção:**
   ```bash
   node projects/explainer-state-machine/scripts/render_keyframes.mjs
   ```

3. **Renderizar Todos os 1800 Quadros (CFR 30 FPS):**
   ```bash
   node creative-core/renderers/render_frames.mjs \
     projects/explainer-state-machine/composition.html \
     projects/explainer-state-machine/frames \
     --frames=1800 --fps=30 --width=1080 --height=1920
   ```

4. **Montar o Vídeo Master MP4:**
   ```bash
   python3 creative-core/renderers/assemble_video.py \
     projects/explainer-state-machine/frames \
     projects/explainer-state-machine/out/state-machine-9x16.mp4 \
     --fps 30
   ```

5. **Executar Auditoria QA e Decodificar Frames:**
   ```bash
   python3 projects/explainer-state-machine/scripts/qa_explainer.py
   node projects/explainer-state-machine/scripts/build_contact_sheet.mjs
   ```

---

## 3. Estrutura de Arquivos

```
projects/explainer-state-machine/
├── BRIEF.md                 # Briefing pedagógico e técnico
├── STYLE.md                 # Design system, paleta semântica e física de movimento
├── STORYBOARD.md            # Storyboard cena a cena com faixas de frames
├── TIMELINE.md              # Mapa matemático de interpolação analítica
├── composition.html         # Composição visual master 1080×1920 determinística
├── test_determinism.mjs     # Teste automatizado de determinismo bit a bit
├── README.md                # Este documento de reprodução
├── scripts/
│   ├── render_keyframes.mjs     # Renderizador de stills de storyboard
│   ├── qa_explainer.py          # Extrator de frames decodificados do MP4
│   └── build_contact_sheet.mjs  # Gerador de contact sheet em alta resolução
├── reviews/
│   ├── keyframes/           # Keyframes representativos dos 7 atos
│   ├── decoded/             # Frames decodificados diretamente do MP4 final
│   ├── qa_explainer.json    # Metadados e telemetria FFprobe
│   └── contact-sheet.png    # Contact sheet oficial de validação
└── out/
    └── state-machine-9x16.mp4  # Master final 1080×1920 30 FPS CFR (60.0s)
```
