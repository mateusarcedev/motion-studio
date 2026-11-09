# Integrações Externas da Comunidade — MOTION Studio

O MOTION Studio foi projetado como uma plataforma modular e aberta. Além de seu catálogo nativo de habilidades e motores, o MOTION suporta **integrações externas da comunidade** sem acoplamento forçado, permitindo que criadores tragam especialidades externas mantendo a conformidade de licenciamento e os contratos de produção determinísticos.

---

## 1. Repositório Auditado: Gabriel Greco (`gabrielgreco1/skills`)

- **Repositório Upstream:** [https://github.com/gabrielgreco1/skills](https://github.com/gabrielgreco1/skills)
- **Commit SHA Auditado:** `9cf15be76c960c94edddcc78fc5fa237e0778c44`
- **Autor:** Gabriel Greco ([@greco_dev](https://x.com/greco_dev))
- **Licenciamento:** Custom (Uso e modificação autorizados no README; sem redistribuição como pacote derivado).

---

## 2. Especialidades Integradas

### 1. `aula-interativa`
Cria aulas interativas autocontidas em HTML/CSS/JS com modelos mentais, grafos visuais, runtime dinâmico funcional e exercícios com feedback causal.
- **Instalação:**
  ```bash
  npx skills add gabrielgreco1/skills --skill aula-interativa
  ```
- **Roteamento no MOTION:**
  Invocado pelo `studio-director` quando o entregável for pedagógico/educacional:
  `studio-director` ➔ `interactive-lesson` ➔ `aula-interativa`.
- **Scaffold via CLI:**
  ```bash
  npx motion create lesson nome-da-aula
  ```
- **Entrega Padrão:** `lesson.html` autocontido (inlined, zero dependências remotas), folha de contato, testes Playwright de responsividade e arquivo `.zip`.

### 2. `motion-designer`
Especialista em showreels, teasers de produto de alta densidade visual, HUDs geométricos e animações determinísticas com cortes no beat.
- **Instalação:**
  ```bash
  npx skills add gabrielgreco1/skills --skill motion-designer
  ```
- **Roteamento no MOTION:**
  Invocado pelo `motion-director` como departamento de animação cinética refinada:
  `studio-director` ➔ `motion-director` ➔ `motion-designer` ➔ `assemble_video.py`.
- **Entrega Padrão:** Composição frame-driven (`window.__onFrame__`), vídeo CFR 30 FPS MP4 YUV420p, folha de contato (`contact-sheet.png`) e relatório de QC.

### 3. `ui-humanizer`
Auditor de design e código que detecta clichês e "cara de IA" em páginas e interfaces, separando falsos positivos e oferecendo recomendações editoriais humanas.
- **Instalação:**
  ```bash
  npx skills add gabrielgreco1/skills --skill ui-humanizer
  ```
- **Roteamento no MOTION:**
  Invocado pelo `web-director` como auditoria de qualidade visual antes da entrega final:
  `web-director` ➔ Construção ➔ `ui-humanizer` ➔ Portão de Crítica ➔ Reparos.
- **Detecção:**
  ```bash
  python3 scripts/audit.py caminho/do/arquivo.html
  ```

---

## 2b. Repositório Auditado: Benji Taylor (`benjitaylor/skills`)

- **Repositório Upstream:** [https://github.com/benjitaylor/skills](https://github.com/benjitaylor/skills)
- **Autor:** Benji Taylor ([@benjitaylor](https://github.com/benjitaylor))
- **Licenciamento:** MIT (código e componentes; marcas registradas e logos excluídos).
- **Especialidade:** `stageshow`

### `stageshow`
Especialista em apresentações de software, product showcases de alta fidelidade, animação de cursores, microinterações de UI e layouts bento grid para demonstração de recursos de aplicações.
- **Instalação:**
  ```bash
  npx skills add benjitaylor/skills --skill stageshow
  ```
- **Roteamento no MOTION:**
  Invocado pelo `studio-director` ou `motion-director` quando o entregável envolve demonstração de aplicativos, software ou UI motion:
  `studio-director` ➔ `software_showcase` ➔ `stageshow` ➔ `motion-core`.
- **Quando Utilizar:**
  - Demonstrações de software / SaaS / apps web e mobile.
  - Animação de cursor (trajetória suave, hover, clique, seleção).
  - Bento grids com cards de produto ativos.
  - Microinterações e estados de interface ilustrativos.
- **Quando NÃO Utilizar:**
  - Conteúdo científico ou de natureza (ex: lulas gigantes, biologia marinha).
  - Processos industriais ou fabris (onde diagramas técnicos e infografia são adequados).
  - Vídeos puramente publicitários de bens de consumo físicos ou serviços artesanais.

---

## 3. Perfil de Instalação `interactive`

O MOTION Studio introduziu o perfil seletivo `interactive`, voltado para projetos focados em experiências educacionais, conteúdo interativo e apresentações visuais estruturadas:

```bash
# Inicializar estúdio com perfil interativo
npx motion init --brand="MinhaMarca" --profile=interactive
```

### Skills incluídas no perfil `interactive`:
- `studio-director` (orquestrador principal)
- `motion-director` (direção audiovisual)
- `web-director` (direção de experiências web)
- `brand` (identidade e memória de marca)
- `design` (fundamentos visuais e paletas)
- `design-system` (tokens e especificações de componentes)
- `diagram-design` (diagramas estruturados e técnicos)
- `slides` (apresentações estratégicas em HTML)

---

## 4. Diagnóstico via CLI (`motion doctor`)

O comando de diagnóstico verifica automaticamente a presença das dependências opcionais e a instalação local das skills da comunidade:

```bash
npx motion doctor
```

Saída de verificação:
```text
  [PASS] aula-interativa: instalada
  [PASS] motion-designer: instalada
  [PASS] ui-humanizer: instalada
```
*(Caso não estejam instaladas localmente, o comando exibirá `[INFO]` com a instrução exata para adição via `npx skills add`).*
