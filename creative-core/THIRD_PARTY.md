# THIRD_PARTY.md — dependências presentes no runtime do MOTION (SBOM leve)

O que **efetivamente roda** neste repositório hoje. Tudo o mais está no catálogo
(`INTEGRATIONS.md`) como verificado/candidato — não é runtime.

| Componente | Versão | Licença | Papel | Nota |
|---|---|---|---|---|
| `playwright-core` (npm) | 1.64.1 | Apache-2.0 | motor de captura HTML→PNG/MP4 (Chromium) | `package.json` |
| Chromium headless | build 1243 (playwright cache) | BSD-family (Chromium) | navegador de render | `~/.cache/ms-playwright/` |
| FFmpeg | 8.0.1-3ubuntu2 | LGPL/GPL mix por build | montagem MP4, áudio | PATH do sistema — ao *distribuir* um MP4/lib embutida, citar a licença da build usada |
| Node.js | 24.x (asdf) | MIT | runtime dos renderers | sistema |
| `svgo` (npm) | 4.x | MIT | parser/otimizador e base do sanitizador de SVG | dependência de `motion-core` |
| `lottie-web` (light, vendorizado) | 5.13.0 | MIT | runtime Lottie determinístico (sem expressões) | `assets/vendor/` + `LICENSE-lottie-web.md` |
| Developer Icons (pacote `assets/packs/developer-icons.pack.json`) | 7.1.0 | MIT (código) · marcas dos titulares | logos de tecnologias | gerado de `developer-icons` (devDependency); uso nominativo |
| Humaaans (subconjunto) | espelho 2019 | CC0 (site) / CC-BY-4.0 (espelho) → atribuição | personagens | `assets/packs/humaaans.pack.json`; crédito: Pablo Stanley |
| Lucide Icons (pacote `assets/icons/lucide.pack.json`) | 1.76.0 | ISC | ícones offline do Visual Asset Resolver | gerado de `lucide-static` (devDependency); aviso em `assets/icons/LICENSE-lucide.txt` |
| libass (via FFmpeg) | 0.17.4 | ISC | legendas ASS cinéticas do Smart Reel Editor | parte da build do FFmpeg do sistema |
| faster-whisper (PyPI, **opcional**, venv isolado fora do repo) | 1.2.1 | MIT | STT local (`motion edit transcribe`) | `~/.local/share/motion/stt/venv`; não é dependência npm |
| CTranslate2 (PyPI, opcional) | 4.9.1 | MIT | inferência INT8/CPU do faster-whisper | idem |
| numpy / tokenizers / huggingface-hub (PyPI, opcional) | 2.5.5 / 0.23.3 / 2.4.0 | BSD-3 / Apache-2.0 / Apache-2.0 | dependências do faster-whisper | idem (onnxruntime e PyAV vêm junto, não são usados pelo worker) |
| Modelo `Systran/faster-whisper-small` (opcional) | rev `536b0662742c02347bc0e980a01041f333bce120` | MIT (conversão do Whisper small, OpenAI, MIT) | pesos do STT | cache local, nunca versionado nem empacotado |

Suspensos (verificados, não runtime): ver matriz em `INTEGRATIONS.md`. Regras de
copywright aplicáveis nesse estado: GPL (blender, pedalboard) = ferramenta isolada;
Remotion Free- vs Company-License = gate antes de operar como serviço; GSAP = ok em
peças, nunca em ferramenta de criação concorrente; ReactDrops/transitions.dev =
não-redistribuição como kit/registry.

Attribution de assets de terceiros (fotos, ícones, fontes) fica no `BRIEF.md`/`STYLE.md`
da peça + campo `attribution` — nunca implicitamente coberta por este arquivo.
