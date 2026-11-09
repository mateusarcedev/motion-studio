# CASE STUDY — CARGA / 01
## Uma Jornada em Movimento · Creative Portfolio Showcase

---

### Visão Geral & Metadados
- **Nome do Projeto:** CARGA / 01 — Uma jornada em movimento
- **Natureza:** Projeto Conceitual Autoral (Showcase de Portfólio)
- **Papéis Desempenhados:** Creative Director, Senior Creative Developer, Motion Designer, 3D Technical Artist
- **Framework de Engenharia:** MOTION Studio `1.0.0-rc.2`
- **Ano de Produção:** 2026
- **Status:** Produção Completa e Validada

---

### 1. Descrição do Projeto
CARGA / 01 é uma experiência digital interativa e cinematográfica que investiga a poética da infraestrutura pesada global. Em vez de recorrer a objetos de consumo convencionais (como smartphones, fones de ouvido ou calçados esportivos), a experiência eleva o contêiner intermodal de aço corten — a invenção utilitária que transporta 90% dos bens do planeta — ao posto de protagonista estético e narrativo.

A narrativa acompanha uma unidade de carga (**ID: CRG-01-A**) através de 5 atos ininterruptos:
1. **O Porto:** Estabelecimento da atmosfera industrial ao crepúsculo marítimo (*blue hour*).
2. **O Contêiner:** Mergulho visual nas características técnicas, estêncil ISO 6346 e cantoneiras twistlock.
3. **A Movimentação:** Içamento vertical por guindaste de pórtico STS (*Ship-to-Shore*) e transferência sobre carreta.
4. **A Estrada:** Travessia noturna em alta velocidade por rodovia sob luzes de sódio e asfalto molhado.
5. **O Destino:** Chegada ao centro logístico metropolitano e revelação da síntese reflexiva: *"Cada jornada tem uma história."*

---

### 2. Desafio Criativo
O mercado de desenvolvimento criativo e design de interação contemporâneo saturou-se de certos vícios visuais: layouts que mimetizam dashboards de SaaS corporativo, cartões repetitivos com desfoque de fundo excessivo (*glassmorphism* descontextualizado), paletas roxas/magenta genéricas e animações com molas cartunescas infladas (*excessive bounce*).

O desafio central de CARGA / 01 foi formular uma **identidade visual rigorosa, sóbria e cinematográfica**, fundamentada em engenharia mecânica e logística portuária real. A experiência precisava transmitir o peso, a inércia e a escala monumental de guindastes de 800 toneladas e navios de 100 metros, equilibrando isso com detalhes milimétricos e tipografia editorial de alta legibilidade.

---

### 3. Conceito & Direção de Arte
A direção de arte foi orientada pelo princípio do **Realismo Industrial Cinematográfico**:
- **Atmosfera Cromática Bicromática:** O contraste acentuado entre o frio e o quente. Tons de ardósia profunda e azul marítimo (`#070A0F`, `#0F172A`) cortados por feixes de luz fria ciano (`#00F0FF`) nos holofotes portuários, equilibrados pela saturação quente do contêiner em âmbar industrial (`#FF8A00`) e pelas lâmpadas de vapor de sódio (`#F59E0B`).
- **Escala e Profundidade:** A proporção monumental entre máquinas titânicas e a unidade de contêiner de 40 pés, explorando reflexos em asfalto molhado e névoa volumétrica crepuscular.
- **Tipografia Editorial & Estêncil:** Títulos de grande porte em *Inter/Geist* com tracking aberto, acompanhados de telemetria estrita em *Geist Mono* (códigos ISO 6346, peso bruto máximo, tara e coordenadas geográficas).

---

### 4. Stack Tecnológica
- **Renderização Web 3D em Tempo Real:** Three.js r165, React Three Fiber (R3F) v8, `@react-three/drei` v9.
- **Frontend & Bundling:** React 18, Vite 8.
- **Pipeline de Animação & Vídeo:** Playwright Core (Chromium headless com swiftshader para renderização bit a bit CFR 30fps), FFmpeg 8 (codificação yuv420p).
- **Design Tokens & Validação:** MOTION Core, Python 3.14 (geração de contact sheets, manifestos SHA-256 e ZIP export).

---

### 5. Processo de Criação

#### A. Modelagem 3D Procedural & Exportação GLB
Com o Blender ausente no ambiente de produção do estúdio, desenvolveu-se uma suíte de geração procedural avançada em Three.js. Cada malha foi construída com geometria paramétrica exata:
- **Contêiner Protagonista:** Painéis laterais com 36 dobras corrugadas reais, 8 blocos de cantoneira fundida ISO twistlock, barras de fechamento e textura canvas PBR de 2048×1024 com numeração estêncil `CRG-01-A`, faixas de perigo zebradas e especificações de tara.
- **Caminhão Cavalo Mecânico:** Cabine aerodinâmica, grade cromada, para-brisa com refração física, faróis duplos xenon emissivos, eixos duplos traseiros com 8 pneus frisados e semirreboque rebaixado.
- **Guindaste Pórtico STS & Navio Cargueiro:** Estruturas treliçadas de 36m, spreader móvel com cabos tensores e casco naval de 100m com pilhas de contêineres coloridos.

Os assets foram exportados para o padrão binário GLB otimizado, totalizando menos de 400 KB para todo o ecossistema 3D, garantindo carregamento instantâneo em navegadores móveis e desktop.

#### B. Desenvolvimento Web & Scroll-Driven Choreography
A experiência web foi concebida com um modelo híbrido de interação:
- Permite tanto a navegação por rolagem natural contínua (*scroll-driven storytelling*) quanto a seleção direta via HUD de 5 cenas.
- O enquadramento de câmera (*framing*) é computado dinamicamente com base na proporção do viewport: dispositivos móveis recebem aumento compensatório de distância focal e recuo em Z para evitar qualquer clipping ou corte lateral dos contêineres.
- Inclui modo de inspeção 3D com órbita livre, chaveamento de iluminação (*Crepúsculo* vs. *Blue Hour*) e modal de telemetria ISO 6346.

#### C. Motion Design & Masterização de Vídeo CFR 30 FPS
Para os materiais audiovisuais do MOTION Studio:
- Produziu-se a timeline de 20 segundos (600 frames exatos a 30 FPS).
- Roteirizou-se a transição sem cortes em duas resoluções nativas: Master Horizontal 1920×1080 (16:9) e Master Vertical 1080×1920 (9:16).
- A renderização utilizou o driver determinístico do MOTION, garantindo que o frame N reproduz bit a bit, sem oscilação de taxa de quadros (*zero frame drop / zero drift*).

---

### 6. Desafios Técnicos Reais & Soluções

1. **Ausência do Blender no Ambiente de Execução:**
   - *Desafio:* Não havia binário do Blender instalado na máquina de produção para exportação de malhas complexas.
   - *Solução:* Criação de um gerador procedural em Node.js com Three.js e exportação direta via `GLTFExporter` em ambiente headless Chromium. Os modelos gerados alcançaram alto detalhamento e fidelidade PBR respeitando o orçamento de performance.

2. **Reflow Responsivo de Câmera 3D em Viewports Estreitos (360px):**
   - *Desafio:* Um enquadramento 3D pensado para desktop 16:9 corta as extremidades de um contêiner de 12 metros quando visualizado em smartphones verticais estreitos (360×740).
   - *Solução:* Implementação de matriz de enquadramento adaptativo (`SceneDirector`), que interpola posições de câmera e campo de visão (FOV) em função da largura do viewport (`size.width < 768px`).

3. **Garantia de Determinismo Temporal CFR 30 FPS nos 600 Frames:**
   - *Desafio:* Renderizar 600 frames em tempo real via navegador comum acarreta flutuações de clock e perda de sincronia visual.
   - *Solução:* Utilização do motor `render_frames.mjs` do MOTION, injetando `window.__MOTION__ = { frame, time, fps }` a cada captura, desacoplando o render do tempo de parede (*wall-clock time*).

---

### 7. Aprendizados
- A consistência de design tokens compartilhados (`tokens.json`) entre CSS, shaders WebGL e overlays de vídeo é o fator primordial que confere unidade estética a uma campanha multiformato.
- Restrições técnicas (como a ausência de softwares 3D tradicionais de desktop) estimulam o desenvolvimento de habilidades procedurais mais eficientes, gerando assets muito mais leves para a web final.
- Storytelling com base em objetos utilitários da infraestrutura real possui alto poder de conexão emocional e diferenciação artística perante portfolios saturados de interfaces corporativas genéricas.

---

### 8. Galeria de Entregáveis & Artefatos
- **Vídeo Master 16:9 (1920×1080):** `out/carga-01-16x9.mp4` (20.0s, 30 FPS CFR, 600 frames)
- **Vídeo Master 9:16 (1080×1920):** `out/carga-01-9x16.mp4` (20.0s, 30 FPS CFR, 600 frames)
- **Carrossel Editorial 4:5:** 5 slides renderizados em 1080×1350 e 2160×2700 (`carousel/out/`)
- **Modelos 3D GLB:** `carga-container.glb`, `carga-truck.glb`, `carga-crane.glb`, `carga-ship.glb`
- **Build Web:** Aplicativo React/R3F otimizado e empacotado em `web/dist/`
- **Auditoria de Qualidade:** Evidências fotográficas e relatório nos 5 viewports em `reviews/viewports/`
- **Pacote Distribuível:** Arquivo `entrega-v1.zip` acompanhado do manifesto SHA-256 `assets.manifest.json`.
