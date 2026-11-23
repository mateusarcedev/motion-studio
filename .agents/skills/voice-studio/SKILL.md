---
name: voice-studio
description: Treats recorded speech with the MOTION Voice Studio — measured analysis (EBU R128 loudness, true peak, dynamics, noise between phrases, mains hum), high-pass, hum notches, local noise reduction (FFmpeg afftdn or DeepFilterNet when installed), gentle EQ, adaptive compression, optional de-esser, linear gain in the delivery layout, downward expander last, limiter for remaining peaks only, music ducking, latency compensation and A/B export with a loudness-matched original. Use when the user asks to "limpar o áudio", "tirar o ruído", "melhorar a voz", "normalizar o volume", "deixar a voz profissional" for a video or audio file. Presets natural, clean, studio, noisy-room. Agent-agnostic via `motion edit audio` or the MCP tool motion_edit_audio.
---

# Voice Studio — tratamento de voz

Objetivo: voz **inteligível e natural**. Preservar timbre e fonemas vale mais que remover todo o
ruído. Nunca criar fala sintética, nunca "consertar" palavras, nunca declarar "qualidade de
estúdio" sem escuta humana.

## 1 · Uso

```bash
motion edit analyze gravacao.mp4                 # loudness, TP, LRA, fala/pausas, ruído, zumbido → preset sugerido
motion edit audio gravacao.mp4 --preset=clean --output=out/voice.wav \
  --ab=out/audio-ab --report=out/voice.report.json [--denoiser=auto|ffmpeg|deepfilternet|none] [--music=trilha.wav]
```

Dentro do Reel Editor, a voz é tratada automaticamente no render (`audio.preset` da timeline),
com a cadeia aplicada à fonte inteira **antes** dos cortes e a loudness medida **depois** deles.

## 2 · Presets (dados, todos sobrescrevíveis em `audio.overrides`)

| Preset | Quando |
|---|---|
| `natural` | gravação boa; só passa-altas, ruído leve, compressão suave |
| `clean` | padrão para Reels; tira embolado (250 Hz), dá presença, expansor leve |
| `studio` | voz mais próxima; EQ/compressão mais firmes, de-esser |
| `noisy-room` | ventilador/sala; passa-altas mais alto e redução mais forte, ainda limitada |

Parâmetros adaptativos e registrados: piso de ruído medido → `afftdn nf`; SNR alto → metade da
redução; limiar do compressor relativo ao nível de fala medido; fonte já comprimida (típico de
celular) → compressor desligado com LRA < 3 LU, ratio 1,6 com LRA < 4 LU; zumbido de 50/60 Hz medido → notches estreitos.

## 3 · O que o QA mede (`report.qa`)

True peak ≤ alvo (no render, medido depois do AAC), pico de amostra < 0 dBFS, loudness alvo ±0,5 LU, fração de quadros
de fala suprimidos > 10 dB (comer fonema), `audio.speech-to-pause` (mesmas regiões antes × depois; `FAIL` acima do limite do preset),
latência residual da cadeia (o afftdn atrasa ~25 ms; o motor mede e compensa), duração.
`voice.listening` fica **NOT_TESTED** até alguém ouvir o A/B (3 a 5 pares `clip-NN-before/after.wav`,
volume igualado por ganho linear) e gravar `reviews/listening.json` com o SHA-256 do arquivo.

## 4 · Cuidados

- Ruído não estacionário (respiração, sala) não sai com denoise espectral — e não deve sair à força.
- Ordem fixa: denoise → EQ → compressor → ganho no layout de entrega → expansor → 1 reajuste → limitador
  só para o pico restante. LUFS fora de ±0,5 é `WARN`; não itere.
- DeepFilterNet é opcional e só roda com SHA-256 conferido (`motion audio doctor`). Pedido explícito sem
  binário utilizável é erro; em `auto` cai no FFmpeg e o relatório registra a troca.
- Música só com licença; ducking por sidechain chaveado pela voz.
