# motion-core

Motores de produção, QA determinístico e exportação do **MOTION Studio**.

## Motores Inclusos

- **`render_static.mjs`**: Renderizador estático HTML/CSS → PNG via Playwright/Chromium com verificação de overflow e detecção de fontes não carregadas.
- **`render_frames.mjs`**: Renderizador batch de frames determinísticos (`0000.png` ... `NNNN.png`) em grade temporal CFR (30fps padrão).
- **`assemble_video.py`**: Montagem de vídeo MP4 YUV420p CFR via FFmpeg com validação estrita de grade temporal contínua e alinhamento de áudio.
- **`qa_viewports.mjs`**: Verificação multi-viewport (mobile-s, mobile, tablet, desktop, wide) com detecção de tela em branco, touch targets pequenos (<44px) e overflow horizontal.
- **`validate_static.py`**: Validador de dimensões e fator de escala PNG.
- **`build_contact_sheet.py`**: Montagem de folha de contato para portão de crítica pré-render.
- **`exporters/delivery.py`**: Contrato v1, manifesto completo, empacotamento ZIP64 e verificação do conteúdo real do pacote.
- **`frame.js`**: Driver matemático determinístico para animações por frame (sem `Math.random` ou CSS keyframes soltos).

## Visual Asset Intelligence, SVG e QA (Missão 20)

- **`visual-assets/`** — resolver semântico PT/EN: `createAssetSession()` escolhe ícones por intenção, trava um estilo, evita repetição e registra proveniência/licença.
- **`icons/`** — Icon Library Manager: Lucide (ISC) offline em `assets/icons/`, pacotes Iconify do usuário (`.motion/icon-packs/`, `$MOTION_ICON_PACKS`), fetcher remoto opcional com cache.
- **`svg/`** — `validateSvg` (sanitiza SVG não confiável), `optimizeSvg` (SVGO, prefixo de IDs), `rasterizeSvg`, componentes com tokens da marca.
- **`design-system/svg-motion.js`** (`@technomanceer/motion-core/svg-motion`) — animação vetorial pura e seekable.
- **`quality/`** — `createQaReport` (`PASS/WARN/FAIL/BLOCKED/NOT_TESTED`), `qaMedia` (FFprobe/FFmpeg), `qaFrames`, `qaProject`.
- **Delivery Integrity** — `exportDelivery`/`verifyDelivery` e `motion qa delivery` validam arquivos obrigatórios, manifesto, CRC, caminhos e SHA-256. Veja [`DELIVERY_INTEGRITY.md`](../../docs/DELIVERY_INTEGRITY.md).
- **Fonts** — fontes ficam no projeto consumidor, com arquivo, origem, licença e redistribuição declarados no contrato; nenhuma fonte cresce os tarballs do Core. Veja [`FONTS.md`](../../docs/FONTS.md).
- **`lib/`** — `MotionError`/`ERROR_CODES`, `diagnoseBrowser`, `parseFrameSelection`.

Os renderers falham (`status: "FAIL"`) em erro de JS, import quebrado, controlador ausente ou imagem essencial quebrada. Veja `docs/QA.md` e `docs/VISUAL_INTELLIGENCE.md` no repositório.

## Uso

```js
import { renderFrames, assembleVideo, renderStatic } from "@technomanceer/motion-core";

await renderFrames("composition.html", "./frames", { frames: 450, fps: 30 });
await assembleVideo("./frames", "./out/video.mp4", { fps: 30 });
```

Reusable components, VP9 transparency, FFmpeg transitions, determinism verification, and safe-zone QA are documented in [`docs/REUSABLE_MOTION_COMPONENTS.md`](../../docs/REUSABLE_MOTION_COMPONENTS.md). Their programmatic APIs are exported from `motion-core` and the `./components`, `./transitions`, `./safe-zones`, and `./quality/determinism` subpaths.
