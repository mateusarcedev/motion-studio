# Relatório de Auditoria de Humanização Visual (UI Humanizer)

**Alvo:** Landing Page Oficial do MOTION (`projects/motion-landing/site/index.html`)  
**Data:** 30 de Outubro de 2026  
**Avaliador:** MOTION Studio QA Pipeline (integração `ui-humanizer` por Gabriel Greco @greco_dev)  
**Ferramentas:** `scripts/audit.py` (detecção heurística por regex) + Playwright multi-viewport screenshots (1440×900, 768×1024, 390×844)  
**Status da Intervenção:** Somente Análise (Nenhuma alteração aplicada à página pública sem autorização prévia)

---

## 1. Contexto e Intenção da Página

- **Tipo:** Landing page de framework open-source / ferramentas criativas.
- **Público:** Desenvolvedores, designers de código, diretores de arte e engenheiros de IA.
- **Intenção:** **Convencer e Operar** (apresentar o ecossistema, demonstrar seriedade técnica, conduzir para instalação local e visualização no GitHub).
- **Material Real:** 14 repositórios reais com avatares de autores, métricas técnicas (FPS, resoluções, tempos de render), código de terminal real (`npm i -g @motion/cli`).
- **Design System Vigente:** Dark theme (`#0c0d0e`), Mint Accent (`#15F5BA`), Pink Alert (`#FF4D8D`), tipografia Inter + JetBrains Mono.

---

## 2. Resultado Bruto do Detector Heurístico (`audit.py`)

Execução: `python3 -I scripts/audit.py projects/motion-landing/site/index.html`

| ID | Tell | Ocorrências | Linhas no Código |
|---|---|:---:|---|
| **A1** | Eyebrow (texto pequeno caixa alta com tracking largo) | **6x** | L125, L136, L177, L198, L217, L229 |
| **A7** | Bolinha/elemento pulsando (`@keyframes pulse`) | **1x** | L90 (`.brand-dot`) |
| **A12** | Glassmorphism (`backdrop-filter: blur`) | **2x** | L84 (header sticky), L105 (dropdown) |
| **A13** | Hover levantando/escala (`transform: translateY`) | **2x** | L207 (`.card:hover`), L232 (`.chip:hover`) |
| **B6** | Gradiente de fundo / glow (`linear-gradient`) | **4x** | L128, L169, L208, L235 |
| **B7** | Animação de scroll/entrada genérica (`fadeup`) | **2x** | L260, L264 (`@keyframes fadeup`) |

---

## 3. Análise Crítica: Falso Positivo vs. Exceção Justificada vs. Tell Real

A premissa do `ui-humanizer` é clara: *"O elemento não é o problema, o default é. O que denuncia é a soma: eyebrow + gradiente + bolinha pulsando + cards idênticos = template"*.

Abaixo a separação técnica entre o que é identidade legítima e o que deve ser considerado para refinamento humano:

### A7 — Bolinha pulsando (`.brand-dot`)
- **Evidência:** `@keyframes pulse{50%{opacity:.45}}` no ponto verde ao lado da logo `MOTION`.
- **Diagnóstico:** **Tell Moderado / Clichê de IA.**
- **Análise:** Não é um badge de urgência falsa de SaaS ("● 3 vagas restantes"), mas é um recurso frequentemente utilizado por modelos de linguagem para conferir "vida artificial" ao cabeçalho.
- **Recomendação:** Desativar a animação contínua e manter o ponto estático (`#15F5BA`), ativando a pulsação apenas quando houver um processo real em background (ex.: render em execução).

### A1 — Eyebrow sistemático em cada seção
- **Evidência:** 6 seções com `text-transform: uppercase; letter-spacing: .12em; font-size: 11px~12px`.
- **Diagnóstico:** **Tell Real (Fórmula Repetitiva).**
- **Análise:** A IA insere um sub-sub-título padronizado acima de todos os cabeçalhos (`COMO FUNCIONA`, `ECOSSISTEMA`, `ARQUITETURA`). Em design editorial de alto nível, o `h2` principal carrega a hierarquia sem precisar de muleta explicativa acima dele.
- **Recomendação:** Eliminar os eyebrows decorativos das seções de conteúdo editorial e manter rótulos pequenos apenas onde atuam como metadados funcionais (ex.: numeração de etapas ou tags técnicas).

### A12 — Glassmorphism no Header e Dropdown
- **Evidência:** `backdrop-filter: blur(8px) saturate(120%)`.
- **Diagnóstico:** **Exceção Justificada (Falso Positivo do Heurístico).**
- **Análise:** O blur não é aplicado como "card decorativo sobre blob roxo", mas sim na barra de navegação flutuante (`sticky top: 0`) para permitir legibilidade do conteúdo que passa por baixo durante o scroll. Está alinhado às diretrizes de interface do macOS / iOS e Apple Design System.
- **Recomendação:** Manter inalterado.

### A13 — Hover com `translateY(-2px)`
- **Evidência:** Cards e chips sobem 1px a 2px ao passar o mouse.
- **Diagnóstico:** **Parcialmente Justificado.**
- **Análise:** Os cards do ecossistema são links reais (`<a href="..." class="card">`), logo satisfazem a regra de interatividade real (não são divs mortas que enganam o usuário). No entanto, o micro-salto vertical mecânico em 14 cards idênticos é um padrão clássico de template.
- **Recomendação:** Substituir a translação física por transição tonal refinada na borda (`border-color: var(--mint-edge)`) e aumento de opacidade sutil de superfície, conferindo sensação de software nativo.

### B6 — Gradientes de fundo repetidos (`linear-gradient`)
- **Evidência:** Cards usam `background: linear-gradient(180deg, var(--surface), var(--bg))`.
- **Diagnóstico:** **Tell Estético Leve.**
- **Análise:** A opacidade é muito baixa (5% a 8%), não gerando poluição visual, mas o degradê vertical idêntico em todos os cartões reforça a uniformidade sintética.
- **Recomendação:** Introduzir variação de superfície sólida (`surface-1`, `surface-2`) e reservar o degradê sutil apenas para o bloco focal principal (Terminal / Quickstart).

### B7 — Animação `fadeup` no carregamento
- **Evidência:** `@keyframes fadeup{from{opacity:0;transform:translateY(10px)}}`.
- **Diagnóstico:** **Tell de Entrada Genérica.**
- **Análise:** Entrada previsível de template de landing page. Ferramentas para desenvolvedores ganham em percepção de rapidez com renderização direta e estável, respeitando `prefers-reduced-motion`.
- **Recomendação:** Adicionar suporte explícito a `@media (prefers-reduced-motion: reduce)` e considerar transição zero no texto principal para eliminar latência perceptual.

---

## 4. Auditoria de Telas (Evidências em Multi-Viewport)

Screenshots capturados e arquivados em `projects/ui-humanizer-audit/screenshots/`:
- `desktop-fold.png` e `desktop-full.png` (1440×900 / 1280×800)
- `tablet-fold.png` e `tablet-full.png` (768×1024)
- `mobile-fold.png` e `mobile-full.png` (390×844)
- `mobile-s-fold.png` e `mobile-s-full.png` (360×740)

### Achados por Dispositivo

#### Desktop (1440×900)
- **Hierarquia:** Excelente. O comando de terminal `npm i -g @motion/cli` e o botão "View on GitHub" ancoram a visão primária sem conflito.
- **Ritmo:** A grade de 14 repositórios com avatares reais humaniza profundamente o layout, quebrando o "vazio de imagens" típico de páginas geradas por IA.
- **Severidade:** `nit` (ajustar apenas o pulso contínuo do `.brand-dot`).

#### Tablet (768×1024)
- **Layout:** Responsividade íntegra, transição limpa para 2 colunas nos cards de ecossistema.
- **Acessibilidade:** Alvos de toque nos controles de tema e idioma preservam área ≥ 44×44px.
- **Severidade:** `OK`.

#### Mobile (390×844 & 360×740)
- **Hierarquia:** Título e CTA permanecem acima da dobra (`fold`). O comando de cópia do terminal é visível imediatamente.
- **Tipografia:** Sem quebras espúrias ou palavras viúvas críticas.
- **Severidade:** `OK`.

---

## 5. Laudo e Recomendações Priorizadas

| Severidade | Item | Diagnóstico | Intervenção Humana Sugerida |
|---|---|---|---|
| **médio** | Eyebrows sistemáticos (A1) | 6 seções repetem o mesmo padrão de caixa alta acima do título. | Remover eyebrows puramente decorativos; deixar o `h2` liderar a hierarquia. |
| **médio** | Pulso da marca (A7) | `.brand-dot` pulsa continuamente via `@keyframes pulse`. | Tornar a luz verde estática (`#15F5BA`); reservar animação para status dinâmicos. |
| **baixo** | Hover translate (A13) | Cartões sobem 2px ao passar o mouse. | Priorizar iluminação de borda (`border-color`) em vez de movimentação mecânica. |
| **baixo** | Entrada fadeup (B7) | Animação de entrada genérica em 3 elementos do hero. | Incluir cláusula de guarda `prefers-reduced-motion` e avaliar exibição instantânea. |
| **nit** | Gradiente em cards (B6) | Gradientes verticais idênticos em todos os blocos. | Alternar para fundos sólidos discretos com contraste tonal sutil. |

> **Nota:** Em conformidade com as diretrizes do MOTION Studio, nenhuma dessas modificações de design foi aplicada automaticamente ao arquivo em produção (`projects/motion-landing/site/index.html`), permanecendo documentada para aprovação do mantenedor.
