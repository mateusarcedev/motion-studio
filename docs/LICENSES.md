# Documentação de Licenças & Proveniência — MOTION Studio

O MOTION Studio segue uma política estrita de segregação de licenças e auditoria de terceiros (baseada em `creative-core/THIRD_PARTY.md` e `creative-core/INTEGRATIONS.md`).

---

## 1. Licença do Código MOTION

Os pacotes do MOTION Studio (`motion-core`, `motion-cli`, `motion-studio-skills`) são distribuídos sob a licença **Apache-2.0**.

---

## 2. Dependências de Runtime

| Pacote / Ferramenta | Licença | Finalidade | Regra de Distribuição |
|---|---|---|---|
| **`playwright-core`** | Apache-2.0 | Motor headless Chromium | Permitido em código redistribuído. |
| **`three`** | MIT | Motor 3D procedural e WebGL | Totalmente permissiva. |
| **`FFmpeg`** | LGPL-2.1+ / GPL-2.0+ (build Ubuntu) | Montagem CFR e codificação YUV420p | Binário de sistema. Não é embutido diretamente nos pacotes npm do MOTION. |
| **`Python 3`** | PSF License | Runtime de scripts stdlib | Binário de sistema operacional. |

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
  - O código-fonte externo **NÃO é embutido diretamente nos pacotes de distribuição npm** (`motion-studio-skills`, `motion-core`, `motion-cli`), preservando a pureza da licença Apache-2.0 do MOTION e evitando qualquer ambiguidade redistributiva.
  - A integração é puramente arquitetural: o MOTION exporta o perfil `interactive`, documenta as rotas de despacho em seus diretores (`studio-director`, `motion-director`, `web-director`), fornece diagnóstico via `motion doctor`, suporte de scaffold via `motion create lesson`, e orienta os usuários a adicionarem as skills diretamente da fonte upstream:
    ```bash
    npx skills add gabrielgreco1/skills --skill aula-interativa
    npx skills add gabrielgreco1/skills --skill motion-designer
    npx skills add gabrielgreco1/skills --skill ui-humanizer
    ```
