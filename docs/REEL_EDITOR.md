# Smart Reel Editor & Voice Studio (Missão 21)

Edição headless e semiautomática de **vídeo real** (talking-head, entrevistas, tutoriais,
podcasts, Reels de celular). Agnóstica de agente: tudo roda por `motion edit …`, pela API
`import { reel } from "@technomanceer/motion-core"` ou pelo servidor MCP local (`motion mcp`).

## Arquitetura

```
fonte (MP4/MOV/… — só leitura, SHA-256)
  │
  ├─ analyze ── ffprobe (rotação/VFR) · loudnorm (EBU R128: I, TP, LRA) · astats
  │             envelope 10 ms → VAD com histerese (limiares adaptativos P10/P95)
  │             pausas · zumbido 50/60 Hz (bandas estreitas nas pausas) · preset de voz sugerido
  │
  ├─ stt ────── provedores: faster-whisper (local, venv isolado, small/INT8/CPU) · srt-import
  │             (whisper-cpp · openai · gemini: interface declarada, não implementados)
  │             → motion.transcript@1 (palavras + tempos + confiança + idioma + silêncios +
  │               revisão + correções com proveniência + revisão do modelo)
  │
  ├─ plan ───── proteção de fala (VAD + folga) · pausas · hesitações · repetições/gagueira ×
  │             ênfase · recomeços · decisões do operador (exclude/hook/emphasis/corrections)
  │             · grade de quadros · zoom cuts · punch-in · legendas · cards
  │             → motion.timeline@1 (edit.json, hash de conteúdo)
  │
  ├─ render ─── voz: cadeia Voice Studio na fonte inteira → corte por amostra → loudness linear
  │             vídeo: 1 intermediário por segmento (seek preciso, nº exato de quadros,
  │                    cover + crop/lanczos ou perspective subpixel, dips opcionais)
  │             cards: HTML → PNG transparente (render_static/Chromium, fontes do projeto)
  │             compose: concat + cards (ease-out) + ASS cinético (libass) + AAC
  │             → reel.mp4 + voice.wav + captions.{srt,words.srt,ass,json} + render.json
  │
  └─ qa reel ── formato · loudness/TP pós-AAC · fala em cortes · bordas · sincronia das legendas
                no áudio final · caixa medida de cada legenda × safe zone × rosto · cards ·
                A/V · original preservado · determinismo (hash de quadros/amostras)
```

Módulos: `packages/motion-core/reel/{util,analyze,voice,timeline,captions,plan,overlays,render,qa_reel}.mjs`
e `reel/stt/{index.mjs,faster_whisper_worker.py}`. Sem dependências npm novas.

## CLI

```bash
motion edit presets [--json]
motion edit analyze  video.mp4 [--output=analysis.json] [--stills=<dir>]
motion edit transcribe video.mp4 [--model=small] [--compute-type=int8] [--language=pt] \
                     [--hotwords="IA, Claude Code"] [--corrections=c.json] --output=t.json [--srt=asr.srt]
motion edit import-srt legenda.srt [--media=<vídeo da legenda>] --output=t.json
motion edit plan     video.mp4 --transcript=t.json [--analysis=a.json] [--config=edit.config.json] \
                     [--preset=talking-head] --output=edit.json
motion edit validate edit.json
motion edit audio    video.mp4 --preset=clean --output=voice.wav [--ab=<dir>] [--report=r.json] \
                     [--denoiser=auto|ffmpeg|deepfilternet|none] [--music=trilha.wav]
motion edit captions edit.json --output-dir=<dir>
motion edit preview  edit.json --output=preview.mp4
motion edit render   edit.json --output=reel.mp4 [--ab=<dir>] [--keep-work]
motion edit progress reel.mp4
motion qa reel reel.mp4 [--timeline=edit.json] [--compare=<2º render>] [--json] [--output=qa.json] [--markdown=qa.md]
motion stt doctor | providers | setup [--model=small] [--yes]
motion mcp
```

Saída `--json`: `{ "ok": true, "command": "...", ... }`; erro: `{ "ok": false, "error": { "code", "message", "hint" } }`
com códigos estáveis (`MOTION_REEL_INPUT_INVALID`, `MOTION_SOURCE_CHANGED`, `MOTION_STT_UNAVAILABLE`,
`MOTION_STT_PROVIDER_NOT_IMPLEMENTED`, `MOTION_TIMELINE_INVALID`, `MOTION_REEL_RENDER_FAILED`…).
Exit 2 = falha, 3 = ambiente bloqueado.

## Presets

| Edição | Pausa removida acima de | Folga antes/depois | Zoom | Legenda |
|---|---|---|---|---|
| `talking-head` | 0,32 s | 90 / 130 ms | punch 1,00↔1,12, zoom cut a cada ≤ 5,5 s | 3 palavras, 14 car./linha |
| `tutorial` | 0,70 s | 120 / 250 ms | 1,00↔1,06 com ease | 5 palavras |
| `podcast` | 1,00 s | 150 / 350 ms | nenhum | 6 palavras |
| `interview` | 0,60 s | 120 / 220 ms | 1,00↔1,08 | 4 palavras |

| Voz | Passa-altas | Denoise | Expansor | Compressão | De-esser |
|---|---|---|---|---|---|
| `natural` | 70 Hz | 6 dB | — | 2:1, limiar = fala − 6 dB | — |
| `clean` | 80 Hz | 10 dB | 6 dB | 2,5:1, fala − 8 dB | — |
| `studio` | 90 Hz | 12 dB | 8 dB | 3:1, fala − 10 dB | sim |
| `noisy-room` | 100 Hz | 18 dB | 10 dB | 2,5:1, fala − 8 dB | leve |

Todos com notch de zumbido quando medido, ratio limitado a 1,6 em fonte já comprimida
(LRA < 4 LU), −14 LUFS e true peak ≤ −1,5 dBTP (ganho linear + limitador 4× oversampled).

## Timeline `motion.timeline@1` (campos principais)

| Campo | Conteúdo |
|---|---|
| `source` | caminho, SHA-256, bytes, duração, probe |
| `output` | width/height/fps, frames, durationSec |
| `framing` | `faceBox` (caixa da cabeça normalizada), origem (`operator` / `preset-default`) |
| `segments[]` | `id`, `src` e `dst` na grade de quadros, `frames`, `zoom{from,to,cx,cy,easeInFrames}`, `cutBefore`, `zoomCut`, `emphasis` |
| `removed[]` | `src`, `reason` (`pause`, `leading-silence`, `trailing-silence`, `filler`, `repeated-phrase`, `stutter`, `operator`), confiança, `needsReview` |
| `transcript` | provedor, modelo/revisão, idioma, cobertura, palavras (tempos da fonte), correções |
| `audio` | preset, overrides, denoiser, música/ducking |
| `captions` | estilo, posição (com motivo), páginas e palavras no tempo final, `fontsDir` |
| `overlays[]` / `overlayStyle` | cards ancorados (`at`, `until`, `steps`) e fontes |
| `transitions[]` | `cut` (padrão) · `dip-black` · `flash` |
| `export` | H.264 high/yuv420p/CRF, AAC 192k 48 kHz estéreo, prévia, alvo de loudness |
| `review[]`, `decisions[]`, `warnings[]` | trechos a revisar, decisões (motor/operador) e avisos |
| `provenance`, `hash` | versões e hash do conteúdo (sem timestamps: o plano é reproduzível) |

## Determinismo

Mesma timeline + mesmos arquivos → mesmo vídeo: cortes na grade de quadros, áudio cortado por
contagem exata de amostras, encoder com `+bitexact`, sem metadados de data, cards por conteúdo
(hash) e fontes do projeto. `motion qa reel --compare` compara hashes de quadros/amostras
decodificados de dois renders. A transcrição usa semente fixa do CTranslate2.

## Limitações conhecidas

- Sem detecção automática de rosto e sem OCR: o operador declara `faceBox` a partir dos stills
  e verifica texto já queimado na fonte.
- Timestamps por palavra do Whisper são aproximados (centenas de ms); o motor os refina pela
  energia da fala, sem alinhamento forçado fonético.
- Zoom progressivo (`drift`) e punch com ease usam `perspective` (mais lento que crop estático).
- B-roll/inserts dependem de material autorizado (não há biblioteca de stock).
- Revisão auditiva e Crítico independente continuam humanos/externos.
