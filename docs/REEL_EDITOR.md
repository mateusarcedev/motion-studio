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
  ├─ render ─── voz: cadeia Voice Studio na fonte inteira → corte por amostra → ganho no layout
  │             de entrega → expansor → 1 reajuste → limitador só para picos
  │             vídeo: 1 intermediário por segmento (seek preciso, nº exato de quadros,
  │                    cover + crop/lanczos ou perspective subpixel, dips opcionais)
  │             cards: HTML → PNG transparente (render_static/Chromium, fontes do projeto)
  │             compose: concat + cards (ease-out) + ASS cinético (libass) + AAC; true peak medido no
  │                      MP4 e áudio recodificado com menos ganho se passar do teto
  │             → reel.mp4 + voice.wav + captions.{srt,words.srt,ass,json} + render.json
  │
  └─ qa reel ── formato · loudness/TP pós-AAC · fala em cortes · bordas · sincronia das legendas
                no áudio final · caixa medida de cada legenda × safe zone × rosto · cards ·
                A/V · original preservado · determinismo (hash de quadros/amostras)
```

Módulos: `packages/motion-core/reel/{util,analyze,sibilants,voice,denoisers,timeline,captions,caption_qa,brief,plan,overlays,render,qa_reel}.mjs`,
limiares em `presets.json` (sobrescrevíveis no config: `cut`, `zoom`, `captions`, `overlayTiming`, `qa`, `audio.overrides`) e `reel/stt/{index.mjs,faster_whisper_worker.py}`. Sem dependências npm novas.

## CLI

```bash
motion edit presets [--json]
motion edit analyze  video.mp4 [--output=analysis.json] [--stills=<dir>]
motion edit transcribe video.mp4 [--model=small] [--compute-type=int8] [--language=pt] \
                     [--hotwords="IA, Claude Code"] [--corrections=c.json] --output=t.json [--srt=asr.srt]
motion edit import-srt legenda.srt [--media=<vídeo da legenda>] --output=t.json
motion edit plan     video.mp4 --transcript=t.json [--analysis=a.json] [--config=edit.config.json] \
                     [--brief=BRIEF.md] [--preset=talking-head] --output=edit.json
motion edit validate edit.json
motion edit audio    video.mp4 --preset=clean --output=voice.wav [--ab=<dir>] [--report=r.json] \
                     [--denoiser=auto|ffmpeg|deepfilternet|none] [--music=trilha.wav]
motion edit captions edit.json --output-dir=<dir>
motion edit preview  edit.json --output=preview.mp4
motion edit render   edit.json --output=reel.mp4 [--ab=<dir>] [--keep-work]
motion edit progress reel.mp4
motion qa reel reel.mp4 [--timeline=edit.json] [--compare=<2º render>] [--json] [--output=qa.json] [--markdown=qa.md]
motion qa critic-schema | critic-record <parecer.json> --reviews=<pasta> | critic-verify --reviews=<pasta>
motion audio doctor
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
| `institucional` | 0,80 s | 140 / 300 ms | nenhum | 6 palavras |

| Voz | Passa-altas | Denoise | Expansor | Compressão | De-esser | Piora máx. fala − pausa |
|---|---|---|---|---|---|---|
| `natural` | 70 Hz | 6 dB | — | 2:1, limiar = fala − 6 dB | — | 1,5 dB |
| `clean` | 80 Hz | 10 dB | 6 dB | 2,5:1, fala − 8 dB | — | 2,0 dB |
| `studio` | 90 Hz | 12 dB | 8 dB | 3:1, fala − 10 dB | sim | 3,0 dB |
| `noisy-room` | 100 Hz | 18 dB | 10 dB | 2,5:1, fala − 8 dB | leve | 2,0 dB |

Todos com notch de zumbido quando medido, compressor desligado com LRA < 3 LU e ratio limitado a
1,6 com LRA < 4 LU, −14 LUFS (±0,5; fora disso `WARN`, sem nova iteração) e true peak ≤ −1,5 dBTP
medido no AAC entregue.

## BRIEF legível por máquina (opcional)

Um bloco cercado no `BRIEF.md`, lido por `--brief`. Sem bloco, nada muda. Gancho, loop e CTA não são
obrigatórios.

````
```json motion-brief
{ "opening": "original", "glossary": ["Codex", { "term": "Claude Code", "aliases": ["cloud code"] }] }
```
````

- `opening`: `original` · `strongest-line` (o plano **propõe** até 3 frases; só aplica com
  `openingApproval: {by, at, src}`) · `custom` (com `openingText`, frase dita na gravação).
- `glossary`: corrige grafia, variantes declaradas e palavras parecidas em que o ASR estava inseguro;
  cada correção registra motivo e hash do BRIEF. O resto vira sugestão em `review`.

## Correções e paginação do operador (`edit.config.json`)

- `corrections`: `{wordIds, text, reason, by, evidence}`. Com `start`/`end` (segundos da fonte), corrige também o
  tempo. Sem `text`, só o tempo de uma palavra: ela mantém a confiança e continua na revisão. Tempo fora da
  ordem da fala é recusado.
- `exclude`: `[início, fim]` encaixa em palavras e no mínimo de energia; `[início, fim, "exact"]` usa o tempo medido
  pelo operador (um /s/ fraco tem pouca energia de banda larga).
- `overlays[].style`: estilo só daquele card, por exemplo `{ "bg": "rgb(18,22,20)" }` para cobrir texto queimado.
- `captions.breakBefore`: ids de palavras que abrem uma página. `captions.noBreakBefore`: ids que ficam com a
  palavra anterior. A abertura movida nunca divide página com a sequência.
- `qa`: sobrescreve limites só no projeto, por exemplo `{ "captions": { "cps": { "fail": 32 } } }`.

## Checks de legenda e card

| Check | Regra |
|---|---|
| `captions.overlap` | caixas reais das palavras (contorno, pico da animação) não se cruzam |
| `captions.page-overlap` | páginas não se sobrepõem no tempo (antes chamava `captions.overlap`) |
| `captions.cps` | caracteres/s por preset, com causa provável: timing do ASR × texto demais |
| `captions.contrast` | cor × filmagem real sem legenda; só o contorno salva = `WARN` |
| `captions.card-duplicate` | `WARN` quando o card visível repete a legenda ativa |
| `overlays.anticipation` / `overlays.empty` | card não antecipa a âncora nem fica vazio > 0,8 s |
| `audio.speech-to-pause` | piora fala − pausa no MP4 × corte sem tratamento, regiões de VAD fixas |
| `cuts.sibilants` | energia > 4 kHz dos dois lados do corte |
| `critic.integrity` | parecer do Crítico não foi editado depois de gravado |

Palavra é remapeada pela energia que sobrou do corte e nunca muda de trecho; se a energia dela foi
cortada, a legenda sai e a decisão é registrada.

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
