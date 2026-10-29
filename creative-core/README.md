# creative-core — fundação compartilhada do MOTION

Fundação **agnóstica de agente** do estúdio: roda via CLI (node/python3/ffmpeg).
Skills em `.agents/skills/` orientam o COMO; este núcleo executa o QUÊ.

## Instalação mínima (o que já deve existir)

```bash
# runtime (npm, instalado no root do repo — não global)
npm install          # instala apenas playwright-core (Apache-2.0)

# binários de sistema
ffmpeg -version      # LGPL/GPL build do sistema (8.x+)
node --version       # 22+ (24 testado)
python3 --version    # 3.12+ testado (stdlib puro — sem pip)

# Chromium: cache do playwright OU export CHROME_PATH=/caminho/chrome
ls ~/.cache/ms-playwright/ | grep chromium
```

Nada mais é exigido para produção: o núcleo visual comum usa só os 4 acima.
Dependências opcionais (three.js, faster-whisper, pedalboard, blender…) entram
**sob demanda**, sempre com registro em `INTEGRATIONS.md` — o SBOM do que
efetivamente roda está em `THIRD_PARTY.md`.

## Comandos por módulo

| Módulo | Comando | Garante |
|---|---|---|
| render estático | `node creative-core/renderers/render_static.mjs in.html out.png --width=W --height=H --scale=2` | fonts.ready + assets + QA JSON (overflow/fontIssues); `data-bleed` isenta sangria |
| render frame `N` | `… --frame=N --fps=30 --seed=S --var_key=val` | injeta `window.__MOTION__` — composição determinística (frame N reproducível) |
| montar MP4 | `python3 creative-core/renderers/assemble_video.py frames/ out.mp4 --fps=30 [--audio trilha.m4a]` | CFR x264 yuv420p; aborta se grade de frames furada; áudio na MESMA grade (0 = frame 0) |
| validar PNG | `python3 creative-core/quality/validate_static.py out.png --expected 2160x2700 [--scale 2]` | dimensões esperadas + native-scale |
| contact sheet | `python3 creative-core/quality/build_contact_sheet.py f1.png f2.png… -o sheet.png --title "beats v1"` | folha HTML→PNG pelo próprio motor (portão do Crítico) |
| manifest | `python3 creative-core/exporters/manifest.py projects/<p>/ ` | assets.manifest.json: sha256, papel, renditions |
| ZIP | `python3 creative-core/exporters/zip_export.py projects/<p>/ entrega.zip` | entrega empacotada (fonte incluído) |
| galeria | `python3 creative-core/gallery/build_gallery.py` | index.html: slider + lado a lado + download |

## Núcleo visual comum

- `design-system/frame.js` — driver determinístico (`createMotionDriver(window.__MOTION__)`):
  `t`, `progress`, `window010(s, in, out, hold)`, `ease.outCubic|outBack|…`, `lerp`,
  `rand(seed)`. Nada de `Math.random()`/CSS-keyframes em vídeo — estado puro por frame.
- `brands/<slug>/` — tokens (`tokens.json`), PROFILE, `approved/` (memória visual).
  Consulte `approved/` ANTES de criar; marque `approved` na galeria depois de aprovado.
- `presets.json` — dimensões/safe-zones por formato; reflow por proporção na ORIGEM,
  nunca crop cego.

## Portões (produto 5)

1. brief ✋ → 2. direção de arte ✋ → 3. **stills de beats + contact sheet** → Crítico
   (contexto novo, defeitos com frame/timestamp + prova + menor correção útil) →
   máx. 2 rodadas → export. FFmpeg/Chromium terminar **não** é QA; o Crítico indica
   a entrega.

## Retenção e aprovação (regra de galeria)

Toda peça aprovada é registrada em `gallery/gallery.json` (status `approved`) e tem
decisões de arte copiadas para `brands/<slug>/approved/<data>-<peça>/`.
