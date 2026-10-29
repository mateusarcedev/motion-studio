---
name: shorts-director
description: Produces narrated illustrated shorts (9:16, 1:1, 16:9) from a story/verse/text. Frame-driven composition via creative-core, deterministic render, optional TTS via chatterbox (if installed + model card cleared), per-word captions, licensed music/ambience, contact-sheet gate, Critic review, MP4 + SRT/ASS + ZIP/manifest. Does not replicate the proprietary Shorts Animator package (license pending). Use when user asks for "short narrado", "short ilustrado", "vídeo vertical com narração e legendas". Part of MOTION multiformat studio — routed by studio-director.
---

# Shorts Director — shorts narrados ilustrados

Pipeline: **Texto → Beats/Cenas → Storyboard → Composição frame-driven → TTS (opcional, opt-in) → Timecodes por palavra → Trilha licenciada/gerada → Stills → Crítica → MP4 + Legenda + ZIP/Manifest**.

NÃO replica o pacote proprietário *Shorts Animator* (ZIP por email, licença não auditada). Este módulo é **original do MOTION**, usando apenas motores já estáveis: `render_frames.mjs`, `assemble_video.py`, `frame.js`, FFmpeg/Chromium.

## 1 · Entrada (BRIEF)

| Campo | Obrigatório | Padrão |
|---|---|---|
| `source_text` | sim | — (versículo, história, roteiro) |
| `style` | não | `oil|watercolour|crayon|ink|gouache|flat|line` (direção visual) |
| `aspect` | não | `9:16` (também `1:1`, `16:9`) |
| `duration_sec` | não | `30–60` (shorts); calcula frames = duration × fps |
| `fps` | não | `30` |
| `seed` | não | `1` (determinismo) |
| `tts_engine` | não | `chatterbox|none` — **somente se instalado + model card auditado** |
| `voice_id` | não | — (se TTS) |
| `music` | não | `licensed|generated|none` — trilha com direitos claros |
| `captions` | não | `word|line|none` — por palavra exige TTS com timestamps |
| `safe_zones` | não | preset `story` (topo 22%, base 16%, lados 7%) |

## 2 · Beats → Storyboard (S1)

- Divide `source_text` em **beats narrativos** (1 ideia = 1 cena; ~3–5s/cena).
- Para cada beat: `id`, `text`, `visual_prompt` (direção), `duration_est`, `transition`.
- Gera `projects/<short>/STORYBOARD.md` (tabela) — **gate de aprovação humana ✋** antes de compor.

## 3 · Composição frame-driven (S2–S3)

Uma única `composition.html` por short (fonte editável), lê `window.__MOTION__` injetado pelo `render_frames.mjs`:

```html
<script type="module">
import createMotionDriver from '/creative-core/design-system/frame.js';
window.__onFrame__ = (M) => {
  const d = createMotionDriver(M);
  // estado puro por frame: d.t, d.progress, d.window010, d.ease, d.lerp, d.rand
  // NUNCA Math.random()/CSS keyframes em vídeo — seed-determinístico
};
</script>
```

- `render_frames.mjs` roda **1 browser, N frames** (batch), injeta `--frame --fps --seed --var_*`.
- Saída: `frames/0000.png`…`frames/NNNN.png` (CFR, sem grade furada).
- Validação intermédia: `validate_static.py` (dimensões, escala nativa, overflow).

## 4 · Áudio (S4 — opcional, opt-in)

| Caminho | Requisito |
|---|---|
| **TTS (chatterbox)** | Engine instalada (`pip install chatterbox-tts` em venv), **model card auditado** (termos de uso/voz), PT-BR validado. Gera `audio/narration.wav` + `audio/word_timestamps.json` (início/fim por palavra). |
| **Trilha** | Arquivo com licença comprovada (CC0, royalty-free comprada, gerada local). Alinhada à **mesma grade temporal** (`t=0` = frame 0) via `assemble_video.py --audio`. |
| **Fallback** | Se TTS/música indisponíveis → exporta **silencioso** + `caption.srt` vazio; relatório explicita ausência. |

## 5 · Legendas (S5)

- `word` timestamps → `caption.srt` / `caption.ass` (ASS para styling: safe-zone, outline, shadow).
- `line` timestamps → SRT por frase.
- Validação: `ffprobe` duração áudio ≈ frames/fps; sincronia ±1 frame.

## 6 · Portão do Crítico (S6 — produto 5)

**ANTES do render final**:
- `build_contact_sheet.py` com beats-chave (entrada, viradas, clímax, saída) → `reviews/contact-sheet.png`.
- Crítico (contexto novo) recebe: contact sheet + STORYBOARD.md + BRIEF.md.
- Defeitos com **frame/timestamp exato**, evidência visual, menor correção útil.
- Máx. **2 rodadas por defeito** (regra do estúdio).

## 7 · Montagem final (S7)

```bash
python3 creative-core/renderers/assemble_video.py frames/ out/short.mp4 \
  --fps=30 --audio=audio/narration.wav --crf=18
```

- CFR 30fps, yuv420p, `-shortest` alinha áudio na grade.
- Gera `assets.manifest.json` (sha256, papéis, renditions) + `entrega-v1.zip` (frames, HTML, STORYBOARD, BRIEF, caption.srt, manifest, MP4).

## 8 · Galeria & Memória (S8)

- Registro em `creative-core/gallery/gallery.json` (status `draft` → `approved` após humano).
- Peça aprovada → decisões visuais copiadas para `brands/<slug>/approved/`.

## Compatibilidade & Fallback

| Dependência | Se ausente | Comportamento |
|---|---|---|
| `chatterbox` | não instalada / model card não auditado | **fallback textual**: exporta sem áudio, legenda `.srt` com timestamps estimados (duração total / palavras), relatório `AUDIO_FALLBACK=true` |
| `gl-transitions` / `animejs` / etc. | não instaladas | transições/código escritos **manual** no `composition.html` (sem vendor); drivers puros `frame.js` |
| Fontes Noto/emoji | não no Chromium | avisar no QA (contact sheet acusa); fallback `system-ui` |

## Exemplo de uso (agente)

```text
"Crie um short narrado de 45s (9:16) com este versículo: 'O Senhor é meu pastor...',
 estilo watercolour, narração PT-BR se TTS disponível, legenda por palavra,
 música ambiente suave. Entregue MP4 + SRT + ZIP."
```

O `studio-director` despacha para `shorts-director`; este executa o pipeline acima.

## Gates legais (não negociáveis)

- **Nenhuma voz/voz sintética** sem model card auditado (direitos de voz, uso comercial).
- **Nenhuma música** sem licença comprovada no `BRIEF.md` (`attribution` + URL + licença).
- **Nenhum asset visual** (imagem, vídeo, 3D) sem proveniência no manifesto.
- Se qualquer dependência falhar no gate → **fallback silencioso + relatório**, não erro oculto.

## Testes determinísticos obrigatórios

1. Mesmo `seed` + `composition.html` → **MD5 idêntico** frame-a-frame (batch vs replay).
2. `assemble_video.py` aborta se grade de frames furada.
3. Contact sheet gerado pelo **mesmo motor** (Chromium/Playwright) — zero dep extra.
4. MP4 `ffprobe`: `r_frame_rate=30/1`, `nb_frames = duration × fps`, duração exata.

## ✅ Capacidades VALIDADAS (produção real executada)

| Capacidade | Evidência |
|---|---|
| Composição frame-driven determinística | `example-short-original/composition.html` + `render_frames.mjs` → 600 frames |
| Render batch determinístico | 600 frames CFR 30fps, seed=42, MD5 frame 0 idêntico cross-path |
| Contact sheet (portão Crítico) | `build_contact_sheet.py` → 6 beats gerados em `reviews/contact-sheet.png` |
| Montagem MP4 CFR | `assemble_video.py` → `out/short-v1.mp4` 20.000s, 600 frames, h264 30/1 |
| Legenda SRT por beat (fallback textual) | `caption.srt` com timestamps estimados (duração/palavras) |
| Manifest + ZIP | `manifest.py` + `zip_export.py` → `entrega-v1.zip` (607 arquivos) |
| Galeria + memória | Item `example-short-original` registrado em `gallery.json` status `draft` |
| Reflow 9:16 (safe zones preset story) | Safe zones 22/16/7% aplicadas, decos com `data-bleed` |

## ⏳ Capacidades PENDENTES (exigem dependências externas licenciadas)

| Capacidade | Bloqueio | Plano |
|---|---|---|
| **Narração real (TTS)** | `chatterbox` não instalado; model cards não auditados (termos de voz/uso comercial) | Instalar em venv isolado só quando modelo PT-BR com licença comercial clara for selecionado |
| **Sincronização palavra-a-palavra real** | Exige TTS com timestamps por palavra (word-level alignment) | Usar `faster-whisper` forçado alignment ou TTS que exporta word timestamps |
| **Trilha sonora de produção** | Nenhuma música licenciada anexada ao projeto | Adicionar `audio/trilha.wav` com licença CC0/royalty-free no BRIEF |
| **Legenda por palavra com timestamps reais** | Depende de TTS com word timestamps ou forced alignment | Pipeline: TTS → word timestamps JSON → SRT/ASS generator |
| **Validação de modelos TTS** | Nenhum modelo PT-BR auditado para uso comercial | Checklist: licença do modelo, direitos de voz, uso comercial, atribuição |

> **Regra:** timestamps **estimados** (fallback textual) NÃO são alinhamento real por palavra. O relatório final deve explicitar `AUDIO_FALLBACK=true` e o tipo de timestamp usado.