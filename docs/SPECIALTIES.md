# Catálogo de Especialidades — MOTION Studio

O MOTION Studio opera sob uma divisão estrita de departamentos criativos e executivos. Cada especialidade possui um contrato de entrada e saída claramente definido.

---

## 1. `studio-director` (Diretor Geral & Dispatcher)
- **Papel:** Ponto de entrada do estúdio.
- **Entrada:** Briefing em linguagem natural ("preciso de um vídeo e 3 carrosséis para o lançamento de X").
- **Saída:** Roteamento coordenado para os diretores especialistas, plano de campanha multiformato e orquestração de entregáveis.
- **Gate:** Aprovação humana do plano de campanha antes de despachar para código.

---

## 2. `web-director` (Diretor de Web Experiences)
- **Papel:** Direção técnica e artística de experiências na web (Landing Pages, Portais, Heros 3D).
- **Entrada:** `BRIEF.md` com objetivos de conversão, arquitetura de informação e tokens de marca.
- **Saída:** Aplicação Next.js/Vite ou HTML modular, acessível (ARIA), com elemento 3D/interativo funcional e zero quebras.
- **Gate:** QA multi-viewport automatizado (5 telas: mobile-s, mobile, tablet, desktop, wide) com conformidade total.

---

## 3. `motion-director` (Diretor Cinematográfico de Vídeo)
- **Papel:** Direção cinematográfica para filmes e teasers animados dirigidos por código.
- **Entrada:** Mensagem, público-alvo, duração e formato (16:9, 9:16 ou 1:1).
- **Saída:** Pipeline de 5 departamentos:
  1. `BRIEF.md`
  2. `STYLE.md`
  3. `STORYBOARD.md`
  4. `composition.html` (frame-driven, determinístico via `frame.js`)
  5. Contact sheet e stills de batidas narrativas
  6. MP4 final CFR 30fps YUV420p
- **Gate:** Crítico independente avalia o contact sheet antes de autorizar o full render.

---

## 4. `carousel-studio` (Estúdio de Carrosséis)
- **Papel:** Criação de carrosséis sociais baseados em código editável (HTML/CSS).
- **Entrada:** Roteiro ou tema em 5 a 10 slides.
- **Saída:**
  - Lâminas HTML independentes.
  - Exportações PNG em 1080×1350 (Scale 1) e 2160×2700 (Scale 2 retina).
  - Legenda editorial (`caption.md`).
  - Pacote de entrega em ZIP com manifesto.
- **Gate:** Validação dimensional via `validate_static.py` e auditoria de legibilidade.

---

## 5. `story-studio` (Estúdio de Stories)
- **Papel:** Produção de stories verticais 9:16 (1080×1920) estáticos e animados.
- **Entrada:** Mensagem e elementos visuais de marca.
- **Saída:** Composições verticais respeitando safe-zones nativas de Instagram e WhatsApp.

---

## 6. `feed-studio` (Estúdio de Feed Social)
- **Papel:** Produção de posts de feed únicos (1:1 e 4:5), banners promocionais e infográficos.
- **Entrada:** Texto, chamada de ação e tokens visuais.
- **Saída:** PNG de alta resolução com grid tipográfico rigoroso.

---

## 7. `shorts-director` (Diretor de Shorts Narrados)
- **Papel:** Vídeos verticais narrados com legendas por palavra/beat.
- **Entrada:** Texto narrativo (história, versículo, roteiro).
- **Saída:** MP4 vertical CFR 30fps com legendas sincronizadas (`caption.srt` / `caption.ass`).
- **Política de Áudio:** Somente utiliza TTS se instalado e com model card de voz auditado; caso contrário, adota fallback silencioso transparente com legendas.

---

## 8. `3d-scene-director` (Diretor de Cenas 3D)
- **Papel:** Concepção e exportação de cenas tridimensionais proceduralmente.
- **Tecnologias:** Three.js / React Three Fiber / glTF Transform / Blender CLI (opcional).
- **Saída:** Modelos `.glb` otimizados para web e componentes interativos.
- **Isolamento:** Blender é tratado como ferramenta externa isolada; código Three.js serve como fallback autônomo.

---

## 9. `aula-interativa` (Especialidade Educacional — Integração da Comunidade)
- **Origem:** Gabriel Greco (`gabrielgreco1/skills`).
- **Papel:** Criação de aulas interativas autocontidas em HTML/CSS/JS.
- **Entrada:** `BRIEF.md` (objetivo pedagógico, público, modelo mental) e `ROTEIRO.md` (telas, conceitos, feedbacks causais).
- **Saída:**
  - `lesson.html` autocontido (CSS, motion, kit de UI e player inlined, zero CDNs externas).
  - Componentes pedagógicos com feedback causal para respostas certas e erradas.
  - Teste automatizado de navegação e responsividade (mobile 390px e desktop).
  - Folha de contato (`contact-sheet.png`) e entrega empacotada em `.zip`.
- **Roteamento:** Invocado pelo `studio-director` quando o deliverable for educacional (`interactive-lesson`).

---

## 10. `motion-designer` (Especialidade Audiovisual — Integração da Comunidade)
- **Origem:** Gabriel Greco (`gabrielgreco1/skills`).
- **Papel:** Especialista em showreels, teasers de produto, transições cinéticas e sincronização rítmica.
- **Entrada:** `BRIEF.md` e `STORYBOARD.md` com batidas narrativas por frame.
- **Saída:**
  - `comp.html` com bandas de layout padronizadas (HEAD, VIS, CAP).
  - Animação determinística acionada por `window.__onFrame__(M)`.
  - Render CFR 30 FPS YUV420p via `render_frames.mjs` + `assemble_video.py`.
  - Portão de revisão do Crítico com folha de contato (`contact-sheet.png`) antes do full render.
- **Roteamento:** Invocado pelo `motion-director` para refinamento cinético ou estilo showreel.

---

## 11. `ui-humanizer` (Especialidade de Auditoria Visual — Integração da Comunidade)
- **Origem:** Gabriel Greco (`gabrielgreco1/skills`).
- **Papel:** Auditor de design para identificar e remover "cara de IA" e clichês repetitivos em interfaces.
- **Entrada:** Código de interface (HTML/CSS/Tailwind/React) e capturas de tela multi-viewport.
- **Saída:**
  - Diagnóstico heurístico via detector (`audit.py`).
  - Laudo estruturado separando tells reais, falsos positivos e exceções deliberadas de marca.
  - Recomendações priorizadas por severidade (`crítico`, `alto`, `médio`, `nit`).
- **Roteamento:** Invocado pelo `web-director` na fase de revisão visual pós-construção.

---

## 12. `explainer-motion` (Especialidade de Motion Graphics Explicativos & Pedagogia Visual)
- **Papel:** Criação de vídeos explicativos de alto nível para tópicos de tecnologia, ciência da computação, algoritmos e dados (padrão de benchmark Big O).
- **Entrada:** `BRIEF.md`, `STYLE.md` (paleta semântica e tipografia editorial) e `STORYBOARD.md` com atos pedagógicos mapeados por frame.
- **Saída:**
  - `composition.html` com layout arquitetado em 3 zonas (Âncora Titular, Motor Visual Interativo Canvas/SVG e Telemetria Sincronizada).
  - Animação determinística acionada exclusivamente pelo número absoluto do frame (`window.__onFrame__(frame, totalFrames, fps)`).
  - Diagramas vivos que demonstram conceitos com transformações geométricas, feixes de dados, feedback causal e curvas animadas.
  - Render CFR 30 FPS YUV420p Full HD (1080×1920 9:16 ou 1920×1080 16:9).
  - Contact sheet com frames decodificados do MP4 e auditoria de legibilidade temporal.
- **Roteamento:** Invocado pelo `studio-director` ou `motion-director` para explainer técnico, motion de produto, dados animados ou arquitetura de software.
