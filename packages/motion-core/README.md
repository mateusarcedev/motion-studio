# motion-core

Motores de produção, QA determinístico e exportação do **MOTION Studio**.

## Motores Inclusos

- **`render_static.mjs`**: Renderizador estático HTML/CSS → PNG via Playwright/Chromium com verificação de overflow e detecção de fontes não carregadas.
- **`render_frames.mjs`**: Renderizador batch de frames determinísticos (`0000.png` ... `NNNN.png`) em grade temporal CFR (30fps padrão).
- **`assemble_video.py`**: Montagem de vídeo MP4 YUV420p CFR via FFmpeg com validação estrita de grade temporal contínua e alinhamento de áudio.
- **`qa_viewports.mjs`**: Verificação multi-viewport (mobile-s, mobile, tablet, desktop, wide) com detecção de tela em branco, touch targets pequenos (<44px) e overflow horizontal.
- **`validate_static.py`**: Validador de dimensões e fator de escala PNG.
- **`build_contact_sheet.py`**: Montagem de folha de contato para portão de crítica pré-render.
- **`manifest.py`**: Manifesto de entrega com hashes SHA-256 e proveniência de assets.
- **`zip_export.py`**: Empacotamento de ZIP de entrega final com fontes editáveis.
- **`frame.js`**: Driver matemático determinístico para animações por frame (sem `Math.random` ou CSS keyframes soltos).

## Uso

```js
import { renderFrames, assembleVideo, renderStatic } from "motion-core";

await renderFrames("composition.html", "./frames", { frames: 450, fps: 30 });
await assembleVideo("./frames", "./out/video.mp4", { fps: 30 });
```
