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
