# Documentação de Licenças & Proveniência — MOTION Studio

O MOTION Studio segue uma política estrita de segregação de licenças e auditoria de terceiros (baseada em `creative-core/THIRD_PARTY.md` e `creative-core/INTEGRATIONS.md`).

---

## 1. Licença do Código MOTION

O código original em `@technomanceer/motion-core` e `@technomanceer/motion-cli` é distribuído sob **Apache-2.0**. `@technomanceer/motion-studio-skills` tem licenças mistas: seu tarball inclui somente as Skills do manifesto público, com a licença individual em `packages/motion-skills/LICENSES.md`. As demais pastas permanecem no catálogo do repositório e não são copiadas pelo instalador público. Consulte [`SKILLS_LICENSE_AUDIT.md`](SKILLS_LICENSE_AUDIT.md) para a revisão das 51 Skills. As 12 Skills Remotion seguem bloqueadas porque a origem não identificou licença para redistribuição.

---

## 2. Dependências de Runtime

| Pacote / Ferramenta | Licença | Finalidade | Regra de Distribuição |
|---|---|---|---|
| **`playwright-core`** | Apache-2.0 | Motor headless Chromium | Permitido em código redistribuído. |
| **`three`** | MIT | Motor 3D procedural e WebGL | Totalmente permissiva. |
| **`FFmpeg`** | LGPL-2.1+ / GPL-2.0+ (build Ubuntu) | Montagem CFR e codificação YUV420p | Binário de sistema. Não é embutido diretamente nos pacotes npm do MOTION. |
| **`Python 3`** | PSF License | Runtime de scripts stdlib | Binário de sistema operacional. |

### Pesquisa de referência para motion graphics parametrizados
- `skeattt/motion-graphics-programatico` declara MIT. Seus arquivos foram estudados para a missão de componentes, `xfade` com easing e comparação de renderizações.
- Nenhum arquivo ou trecho de código desse projeto foi redistribuído. Os componentes, contratos, expressões e QA adicionados ao MOTION são implementações originais sobre o Creative Core existente.
- GSAP e assets/fontes de exemplo da referência não foram incluídos como dependências nem copiados. Qualquer asset de produção continua sujeito à licença e atribuição próprias.

---

## 3. Limites Estritos de Ferramentas com Restrições

### Blender (GPL)
- O Blender é tratado estritamente como **ferramenta externa opcional**.
- **Nunca é embutido no monorepo ou nos pacotes npm**, preservando o isolamento e impedindo contaminação por copyleft.
- O MOTION oferece fallback procedural via Three.js no Node.js (`export-gltf.mjs`).

### Remotion
- Remotion possui termos duplos: Gratuito para indivíduos e pequenas equipes (<= 3 pessoas), mas exige **Company License paga** para empresas maiores ou prestação de serviços de renderização.
- O MOTION não depende obrigatoriamente do Remotion para renderizar vídeos: o motor nativo `render_frames.mjs` + `assemble_video.py` opera com Playwright e FFmpeg sob licenças permissivas.

### GSAP (GreenSock)
- Licença proprietária "Standard No-Charge".
- Permitido em código entregue para projetos web finais; **proibido o uso do GSAP dentro de qualquer editor ou ferramenta de criação comercial concorrente**.

### Model Cards de Áudio / TTS (ex: Chatterbox)
- O código do repositório pode ser MIT, mas cada modelo de voz / pesos de rede neural possui termos de uso específicos.
- O MOTION Studio adota **fallback silencioso com legendas** e nunca instala modelos de voz sem prévia auditoria de model card.

---

## 4. Integrações Externas da Comunidade

### Repositório Gabriel Greco (`gabrielgreco1/skills`)
- **Repositório:** `https://github.com/gabrielgreco1/skills`
- **Commit SHA Auditado:** `9cf15be76c960c94edddcc78fc5fa237e0778c44`
- **Skills Integradas:** `aula-interativa`, `motion-designer`, `ui-humanizer`.
- **Status de Licença Upstream:** Custom / Termos expressos no README do autor:
  > *"Use the skills, change them, ship videos with them. The vendored third-party code keeps its own license (Three.js is MIT)."*
- **Política de Distribuição no MOTION:**
  - O conteúdo externo dessas integrações **não é embutido nos pacotes npm** (`@technomanceer/motion-studio-skills`, `@technomanceer/motion-core`, `@technomanceer/motion-cli`). O pacote de Skills mantém apenas metadados e comandos para buscar cada integração diretamente na origem.
  - A integração é puramente arquitetural: o MOTION exporta o perfil `interactive`, documenta as rotas de despacho em seus diretores (`studio-director`, `motion-director`, `web-director`), fornece diagnóstico via `motion doctor`, suporte de scaffold via `motion create lesson`, e orienta os usuários a adicionarem as skills diretamente da fonte upstream:
    ```bash
    npx skills add gabrielgreco1/skills --skill aula-interativa
    npx skills add gabrielgreco1/skills --skill motion-designer
    npx skills add gabrielgreco1/skills --skill ui-humanizer
    ```
