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

## 5. Motion MCP × Doop MCP oficial (Missão 23)

O servidor `motion mcp` é um processo local por `stdio` e chama os motores do Motion Core. Doop mantém seu próprio MCP oficial; `doop-bridge` coordena ambos por meio do agente e não instala um cliente, inventa ferramentas ou cria um proxy.

As Skills `design-to-motion` e `motion-to-design` fazem parte do manifesto público local do pacote. O metadata `optional-integrations.json` registra `doop-mcp` como servidor externo opcional, sem `installCommand`: o agente precisa descobrir as ferramentas e schemas que o cliente Doop expõe na sessão atual.

Para configurar o servidor local e acompanhar a matriz honesta de homologação, consulte [`MCP.md`](MCP.md) e [`COMPATIBILITY.md`](COMPATIBILITY.md). A falta do Doop MCP não bloqueia operações locais de Motion.

### Resultado do piloto M6

O Doop MCP oficial foi conectado. A primeira autorização criou os seis frames sintéticos originais; uma autorização posterior, com escopo explícito, permitiu completar o export-plan somente no canvas `Gz620okdHY`. O canvas final tem 21 frames. Os seis originais mantiveram seus hashes, e nenhum outro canvas foi modificado.

O Motion MCP local importou, normalizou e renderizou os seis frames. Depois da autorização, o Doop MCP recebeu os cinco PNGs sintéticos previstos (URLs públicas permanentes e hashes conferidos), criou os 15 frames planejados e retornou 15 screenshots/readbacks. O ledger [`execution-evidence.json`](../projects/m6-herbario-de-nevoa/evidence/doop-lab/motion-to-design/execution-evidence.json) registra 35/35 operações e preservação dos frames originais; screenshots estão no mesmo diretório. A comparação visual foi qualitativa, sem SSIM. O frame 10 teve uma edição posterior do usuário, que foi preservada. Tokens globais, biblioteca/expansão de componentes, fonte upload e CAS atômico continuam indisponíveis no Doop MCP.

OpenDesign 0.27.2 foi testado em um novo projeto local isolado. Skills instaladas e configuração de Motion MCP por projeto funcionaram pelo OpenCode 2.2.5 separado do app. Um smoke real chamou `render_static`; depois 9 previews, QA responsivo em cinco viewports e validação SVG passaram. A investigação do MCP próprio encontrou o comando `stdio` oficial apontando para daemon local, mas o daemon Windows não ficou acessível pelo WSL (`UtilAcceptVsock: accept4 failed 110`); o painel observado não injetou servidores MCP e encerrou com `process_exit`. A produção de vídeo chegou ao limite HTTP 429 do provedor. Isso continua integração indireta/parcial, sem declaração de compatibilidade nativa.

Tokens globais, biblioteca de componentes, expansão de `<doop-use>`, upload de fontes e CAS atômico continuam indisponíveis ou não homologados. Essas capacidades não bloqueiam o Motion Core nem as operações locais. Veja [OPENDESIGN.md](integrations/OPENDESIGN.md), a [matriz de compatibilidade](COMPATIBILITY.md), o [relatório M6](reports/MISSION_23_M6_REPORT.md) e o [roadmap do Universal Design Bridge](roadmap/UNIVERSAL_DESIGN_BRIDGE.md) para resultados detalhados.
