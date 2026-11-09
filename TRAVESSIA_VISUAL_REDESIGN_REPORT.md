# RELATÓRIO DE RECONSTRUÇÃO VISUAL & CINEMATOGRÁFICA
## PROJETO: TRAVESSIA — Do cais ao destino
**Framework:** MOTION Studio 1.0  
**Status da Revisão:** APROVADO PARA PRODUÇÃO (OVERHAUL CONCLUÍDO)  
**Autor:** Mateus Arce  
**Data:** 30 de Outubro de 2026  

---

## 1. RESUMO EXECUTIVO & DIAGNÓSTICO DO ESTADO ANTERIOR

Após a auditoria humana da Missão 13, a versão preliminar foi classificada como **VISUAL REJECTED** devido a sérios problemas de direção de arte, iluminação e estrutura de layout:

1. **Cena 3D excessivamente escura:** O sombreamento PBR estava com subexposição severa (`ACESFilmicToneMapping` calibrado para luminâncias irreais), as fontes de luz estavam mal posicionadas (atrás dos objetos principais) e o fundo era um vácuo preto absoluto, provocando *black crush* e tornando navio, guindaste e contêiner quase invisíveis.
2. **Abismo vertical vazio (5000px de preto):** A aplicação 3D Web possuía uma estrutura arcaica de `.scroll-track` com 5 divs `.scene-trigger-block` de `height: 100vh` vazias (500vh de altura invisível no DOM). O conteúdo real ficava empurrado para quilômetros abaixo da dobra inicial, criando a impressão de uma tela quebrada ou travada em uma região escura e sem nada.
3. **Experiência com aspecto de protótipo de engenharia:** O HUD possuía telemetria técnica excessiva, fontes minúsculas, tabelas de QA no viewport principal e ausência de poesia e impacto cinematográfico.
4. **Enquadramento cortado em telas mobile:** Em resoluções móveis verticais (360px a 390px), a câmera utilizava distância fixa calculada para monitores ultra-wide, cortando mais de 60% do contêiner e navio pelas laterais.

---

## 2. A NOVA DIREÇÃO DE ARTE — TRAVESSIA

O projeto foi integralmente reconstruído sob uma nova identidade autoral:

- **Título Oficial:** **TRAVESSIA**
- **Subtítulo (PT):** **Do cais ao destino.**
- **Subtítulo (EN):** **From Port to Destination.**
- **Linguagem Visual:** Cinema industrial com fotografia durante a *Blue Hour* marítima aliada à energia utilitária do âmbar rodoviário.

### Paleta Cromática e Atmosfera
- **Azul-Noturno Profundo (`#0A111E` / `#05080E`):** Tons marinhos atmosféricos com gradiente de neblina e horizonte definido, eliminando o vácuo preto total.
- **Âmbar Industrial (`#FF8A00`):** Luzes de vapor de sódio nos postes da rodovia, faixas de segurança e a textura de aço corten do contêiner protagonista.
- **Ciano Frio Controlado (`#00F0FF`):** Holofotes de alta potência instalados no topo dos guindastes Ship-to-Shore (STS) Liebherr e na baía de descarregamento do centro logístico.
- **Asfalto Molhado & Concreto Úmido:** Superfícies PBR com rugosidade calibrada (`roughness: 0.18`, `metalness: 0.12`), gerando reflexos especulares dinâmicos das luzes circundantes.
- **Iluminação Tridimensional Equilibrada:**
  - Luz ambiente hemisférica elevada (`skyColor: #3b506d`, `groundColor: #0d1520`, intensidade `1.4`).
  - Luz solar poente direta com sombras suaves (`directionalLight: 2.2`).
  - Rim lights (luzes de contra-plano) em ciano e âmbar contornando a geometria metálica para destacá-la claramente do plano de fundo.

---

## 3. CORREÇÕES ESTRUTURAIS & DE ENGENHARIA 3D

### A. Eliminação Definitiva do Abismo de 5000px
- **Diagnóstico:** No arquivo `projects/carga-01/web/src/App.jsx`, existia um bloco `<div className="scroll-track">` com 5 divs vazias de 100vh que serviam de scroll-trigger artificial.
- **Solução Implementada:** O bloco artificial de 500vh foi removido. A aplicação 3D agora é um viewport cinematográfico limpo de `100vh` com controle gestual nativo e desacoplado:
  - Navegação suave por `Wheel` (roda do mouse com debounce inercial).
  - Gestos de toque horizontal/vertical (`touch swipe`).
  - Teclado (`1` a `5` para salto direto, setas `←` e `→`).
  - HUD interativo com abas nomeadas (`01 O PORTO`, `02 O CONTÊINER`, `03 A MOVIMENTAÇÃO`, `04 A ESTRADA`, `05 O DESTINO`).

### B. Novo Estêncil e Modelos 3D Atualizados
- No script paramétrico `projects/carga-01/scripts/build_models.mjs`:
  - O canvas de textura industrial de 2048×1024 foi atualizado: o contêiner agora estampa em tipografia bold técnica de 110px a marca **`TRAVESSIA`**, o serial **`TRV-01-A`**, **`OPERATOR: MOTION STUDIO · TRAVESSIA`** e o lema **`STATUS: DO CAIS AO DESTINO`**.
  - O navio porta-contêineres foi alinhado ao longo do cais (`rotação 90°` no eixo Z), abrindo o canal de visão e corrigindo a colisão de perspectiva com a orla.
  - Modelos GLB recompilados e injetados tanto na web app quanto na landing page (`site/demos/travessia/` e `site/demos/carga-01/`).

### C. Câmera Adaptativa com Compensação de Aspect Ratio
- **Problema de Truncamento:** Três.js utiliza *Vertical Field of View* (vFOV). Em um smartphone (ex: 390×844, proporção ~0.46), o campo de visão horizontal é drasticamente reduzido.
- **Solução no `SceneDirector`:** Criamos um algoritmo de enquadramento sensível ao aspect ratio:
  - Se `aspect < 1.0` (mobile portrait), a câmera recua dinamicamente entre **18m e 24m** e eleva seu ponto focal para `Y = 1.6m`, enquadrando 100% dos 12 metros do contêiner e a orla sem qualquer corte lateral.
  - Em telas desktop (aspect >= 1.0), a câmera aproxima-se para **10m a 14m**, mantendo a proximidade dramática da composição cinematográfica.

### D. Redesenho do HUD e Telemetria Editorial
- **Header:** Linha única no mobile, branding elegante `TRAVESSIA — EXPERIÊNCIA 3D` com status ativo em verde-menta.
- **Narrativa Inferior:** Transformada em um card editorial elegante que funciona como *bottom sheet* translúcido em mobile, liberando os 70% superiores da tela exclusivamente para a experiência 3D.
- **Cena 05 (O Destino):** Finalização com a citação poética em destaque âmbar itálico:
  > *"Cada jornada tem uma história."*

---

## 4. INTEGRAÇÃO EDITORIAL NO SITE DO MOTION STUDIO

### A. Card em Destaque na Homepage (`/#work`)
- Título: **TRAVESSIA**
- Subtítulo: **Do cais ao destino.**
- Descrição: *"Uma jornada cinematográfica por portos, estradas e movimento. Experiência 3D interativa que acompanha o percurso de um contêiner sob iluminação industrial e 30 FPS CFR determinísticos."*
- Capa: Render real de alta luminosidade destacando o contêiner em primeiro plano e os guindastes ao fundo.
- Links:
  - Explorar Case Study: `/projects/travessia/` (versão EN: `/en/projects/travessia/`)
  - Demonstração 3D: `/demos/travessia/`

### B. Case Study Dedicado (`/projects/travessia/` e `/en/projects/travessia/`)
1. **Hero Cinematográfico:** Título em escala colossal, badges de categoria, metagrid industrial e fundo do render real do porto iluminado.
2. **Demonstração 3D Incorporada:** Player 100% interativo com iframe em `/demos/travessia/`, barra de ferramentas, botão para modo Tela Cheia e guia de comandos.
3. **The Journey (5 Atos):**
   - *01 — O Porto:* Vista panorâmica do terminal marítimo ao crepúsculo.
   - *02 — O Contêiner:* O protagonista de aço corten âmbar estampado com a marca TRAVESSIA (TRV-01-A).
   - *03 — A Movimentação:* O spreader do guindaste STS içando a carga a 9 metros de altura.
   - *04 — A Estrada:* Traveling lateral dinâmico pela rodovia sob chuva fina e reflexos especulares.
   - *05 — O Destino:* A chegada ao hub logístico metropolitano sob holofotes ciano.
4. **Behind the Scenes:** 6 blocos editoriais explicando modelagem procedural, shaders PBR, câmera multi-viewport, render determinístico CFR, auditoria de qualidade e orquestração multiformato.
5. **Filmes Master (16:9 e 9:16):** Players responsivos de 20 segundos a 30 FPS CFR com controles nativos e sem áudio automático intrusivo.
6. **Carrossel Social 4:5:** Visualizador navegável de 5 slides em alta definição com seletor de miniaturas e legenda de publicação oficial.
7. **Notas Técnicas & Créditos:** Transparência sobre ausência de trilha sonora proprietária e declaração de projeto autoral conceitual de Mateus Arce com MOTION Studio.

### C. Compatibilidade Retroativa
- URLs antigas `/projects/carga-01/` e `/en/projects/carga-01/` redirecionam automaticamente via `<meta http-equiv="refresh">` e `window.location.replace` para `/projects/travessia/` e `/en/projects/travessia/`.
- O endpoint `/demos/carga-01/` permanece ativo como alias de `/demos/travessia/`.

---

## 5. EVIDÊNCIAS DE TESTE & QUALIDADE TÉCNICA

A suíte ponta a ponta Playwright (`projects/motion-landing/test_frontend.mjs`) foi executada contra o servidor local (`http://127.0.0.1:3388/`):

| Teste / Validação | Cenário | Resultado |
| :--- | :--- | :--- |
| **Landing Page PT** | Card `.work-spotlight` TRAVESSIA em `#work` | **PASS (100%)** |
| **Ausência de Animação Contínua** | `.brand-dot` estático com hover sob demanda | **PASS** |
| **Alternância de Tema** | Dark ➔ Light ➔ Dark com persistência em localStorage | **PASS** |
| **Case Study TRAVESSIA** | Acesso direto a `/projects/travessia/` com H1 e seções | **PASS** |
| **Compatibilidade Retroativa** | `/projects/carga-01/` ➔ `/projects/travessia/` | **PASS** |
| **Bilingualidade PT ↔ EN** | `/projects/travessia/` ↔ `/en/projects/travessia/` | **PASS** |
| **Standalone 3D Demo** | WebGL Canvas Three.js ativo em `/demos/travessia/` | **PASS** |
| **Filmes Master** | Posters reais vinculados e `autoplay: null` | **PASS** |
| **Carrossel 4:5** | Troca interativa de lâminas no visualizador | **PASS** |
| **Erros de Console** | Monitoramento de runtime sem exceções | **ZERO ERROS** |
| **Overflow Mobile-S (360×740)** | `scrollWidth - innerWidth` <= 1px | **0px (PASS)** |
| **Overflow Mobile (390×844)** | `scrollWidth - innerWidth` <= 1px | **0px (PASS)** |
| **Overflow Tablet (768×1024)** | `scrollWidth - innerWidth` <= 1px | **0px (PASS)** |
| **Overflow Desktop (1440×900)** | `scrollWidth - innerWidth` <= 1px | **0px (PASS)** |
| **Overflow Wide (1920×1080)** | `scrollWidth - innerWidth` <= 1px | **0px (PASS)** |

### Portfólio Pessoal `mateusarce.dev`
Em estrito cumprimento das diretrizes de isolamento:
- O diretório `/home/mateusarcedev/projetos/mateusarce.dev` permaneceu **100% intocado**.
- `git status` validado: *working tree clean*.
- Nenhuma alteração foi realizada fora do escopo do MOTION Studio.

---

## 6. COMO NAVEGAR E TESTAR LOCALMENTE

O servidor HTTP local está ativo na porta `3388`:

1. **Card de Destaque na Homepage:**
   - Acesse: `http://localhost:3388/#work`
   - Observe o card visual **TRAVESSIA**, o selo *"Case em Destaque"* e os botões de ação.
2. **Case Study Dedicado (PT):**
   - Acesse: `http://localhost:3388/projects/travessia/`
   - Experimente a demonstração 3D incorporada, assista aos filmes 16:9 e 9:16 e clique nas lâminas do carrossel 4:5.
3. **Case Study Dedicado (EN):**
   - Acesse: `http://localhost:3388/en/projects/travessia/`
4. **Demonstração 3D Standalone (Tela Cheia):**
   - Acesse: `http://localhost:3388/demos/travessia/`
   - Use a roda do mouse, as setas do teclado ou as teclas `1` a `5` para saltar diretamente entre os atos.
   - Alterne o tamanho da janela para inspecionar a compensação adaptativa de câmera no mobile.
5. **Teste de Redirecionamento:**
   - Acesse: `http://localhost:3388/projects/carga-01/`
   - Confirme o redirecionamento instantâneo para `/projects/travessia/`.
