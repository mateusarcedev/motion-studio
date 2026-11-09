# CARGA / 01 — Uma jornada em movimento
**MOTION Studio Creative Portfolio Showcase · v1.0.0-rc.2**

Experiência digital cinematográfica autoral que explora a poética da infraestrutura pesada através da jornada contínua de um contêiner intermodal de 40 pés (**CRG-01-A**).

---

## 1. Visão Geral da Entrega
Este projeto foi concebido e produzido de forma independente no MOTION Studio, contemplando:
1. **Experiência Web 3D Interativa:** Aplicação com 5 cenas narrativas, câmera adaptativa, shaders PBR em Three.js r165 e React Three Fiber, suporte a acessibilidade e touch targets &ge; 44px.
2. **Dois Filmes Master (20 segundos @ 30 FPS CFR — 600 frames):**
   - Horizontal Master (16:9): `out/carga-01-16x9.mp4` (1920×1080)
   - Vertical Master (9:16): `out/carga-01-9x16.mp4` (1080×1920)
3. **Carrossel Editorial em 5 Slides (Formato 4:5):**
   - Slides em HTML editável em `carousel/slides/`
   - Render em escala padrão (1080×1350) e retina (2160×2700) em `carousel/out/`
   - Legenda social formatada em `carousel/caption.txt`
4. **Modelos 3D Procedurais & GLB:**
   - `models/carga-container.glb` (184 KB)
   - `models/carga-truck.glb` (41 KB)
   - `models/carga-crane.glb` (20 KB)
   - `models/carga-ship.glb` (127 KB)
5. **Auditoria Visual Multi-Viewport (5 Resoluções):**
   - Testes em 360×740, 390×844, 768×1024, 1440×900 e 1920×1080 em `reviews/viewports/`
   - Relatório de QA (`report.md`) e avaliação do Crítico Independente (`reviews/findings.md`).
6. **Vitrine / Showcase Local Interativa:** `index.html` (portal unificado para visualização, players de vídeo, carrossel e downloads).
7. **Pacote de Entrega Consolidado:** Arquivo `entrega-v1.zip` acompanhado do manifesto SHA-256 `assets.manifest.json`.

---

## 2. Estrutura de Diretórios
```text
projects/carga-01/
├── BRIEF.md                    # Briefing criativo original
├── STYLE.md                    # Diretrizes de direção de arte e atmosfera
├── STORYBOARD.md               # Roteiro visual detalhado em 5 cenas
├── SCENE_SPEC.md               # Especificação técnica tridimensional
├── CASE_STUDY.md               # Case study completo pronto para portfólio
├── README.md                   # Instruções de execução e documentação
├── index.html                  # Vitrine local / Showcase interativo
├── motion.config.json          # Configuração do estúdio MOTION
├── composition-16x9.html       # Composição para render do vídeo horizontal
├── composition-9x16.html       # Composição para render do vídeo vertical
├── models/                     # Modelos 3D binários GLB
├── web/                        # Código-fonte da aplicação web (React/R3F/Vite)
│   ├── src/                    # Componentes React e estilos
│   ├── public/                 # Modelos e assets estáticos
│   └── dist/                   # Build compilado e otimizado
├── carousel/                   # Produção do carrossel editorial
│   ├── slides/                 # Código HTML editável dos 5 slides
│   ├── out/                    # Renders em 1080x1350 e 2160x2700
│   └── caption.txt             # Legenda pronta para redes sociais
├── frames-16x9/                # 600 frames renderizados (16:9)
├── frames-9x16/                # 600 frames renderizados (9:16)
├── out/                        # Filmes MP4 finais
├── reviews/                    # Contact sheets e evidências de QA
└── scripts/                    # Scripts de geração 3D e auditoria Playwright
```

---

## 3. Instruções de Execução

### A. Executar a Vitrine Local (Showcase Portal)
```bash
# Iniciar servidor estático na raiz do projeto carga-01
npx serve projects/carga-01 -p 3340
# Abrir no navegador: http://127.0.0.1:3340
```

### B. Executar a Experiência Web Interativa
```bash
# Modo de desenvolvimento
cd projects/carga-01/web
npm run dev

# Ou visualizar o build de produção diretamente:
npm run preview
```

### C. Regenerar os Modelos 3D (GLB)
```bash
node projects/carga-01/scripts/build_models.mjs
```

### D. Renderizar os Vídeos Master (600 frames @ 30 FPS)
```bash
# Renderizar frames 16:9
node creative-core/renderers/render_frames.mjs projects/carga-01/composition-16x9.html projects/carga-01/frames-16x9 --frames=600 --fps=30 --width=1920 --height=1080

# Montar MP4 16:9
python3 creative-core/renderers/assemble_video.py projects/carga-01/frames-16x9 projects/carga-01/out/carga-01-16x9.mp4 --fps 30

# Renderizar frames 9:16
node creative-core/renderers/render_frames.mjs projects/carga-01/composition-9x16.html projects/carga-01/frames-9x16 --frames=600 --fps=30 --width=1080 --height=1920

# Montar MP4 9:16
python3 creative-core/renderers/assemble_video.py projects/carga-01/frames-9x16 projects/carga-01/out/carga-01-9x16.mp4 --fps 30
```

### E. Renderizar o Carrossel Editorial (1080×1350 & 2160×2700)
```bash
node packages/motion-cli/bin/motion.mjs render carousel projects/carga-01/carousel/slides projects/carga-01/carousel/out
```

### F. Executar a Auditoria de QA Multi-Viewport (Playwright)
```bash
node projects/carga-01/scripts/qa_carga.mjs
```

---

## 4. Notas de Conformidade & Ética
- **Projeto Conceitual Autoral:** Não foram utilizados nomes, logotipos ou informações de frotas comerciais existentes.
- **Rigor de Áudio:** Registrada com honestidade a ausência de trilha musical comercial proprietária, assegurando a fidelidade técnica do produto visual entregue.
- **Determinismo Gráfico:** Timeline masterizada em CFR 30 FPS sem drift de quadros.
