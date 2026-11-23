---
name: reel-editor
description: Edits EXISTING real footage (talking-head, interviews, tutorials, podcasts, Reels/Shorts/TikTok recorded on a phone) into a finished vertical video with the MOTION Smart Reel Editor — analysis, local speech-to-text with word timestamps, smart cuts (pauses, repetitions, hesitations), punch-in/zoom cuts, Voice Studio audio treatment, kinetic captions, contextual cards, deterministic H.264/AAC render, reel QA and a verified delivery ZIP. Use when the user brings a recorded video and asks to "editar", "cortar", "legendar", "melhorar o áudio", "transformar em Reels", "tirar as pausas" — not for creating motion from scratch. Agent-agnostic: everything runs through the `motion` CLI or the local MCP server. Routed by studio-director.
---

# Reel Editor — edição de vídeo real (Smart Reel Editor)

O agente **dirige**; o motor **executa**. Não escreva comandos FFmpeg à mão: use `motion edit …`
(ou as ferramentas `motion_edit_*` do `motion mcp`). Toda saída tem `--json`. A edição inteira
fica em uma timeline versionada (`edit.json`, `motion.timeline@1`) que re-renderiza o mesmo vídeo.

## 0 · Regras que não se negociam

1. **Originais intocados.** O motor só lê a fonte; a timeline guarda o SHA-256 e o render recusa
   uma fonte alterada (`MOTION_SOURCE_CHANGED`).
2. **Nunca inventar fala.** Legendas mostram só palavras reconhecidas. Correções de reconhecimento
   exigem `reason`, `by` e `evidence` (ex.: legenda humana do mesmo take, glossário confirmado
   pelo usuário, escuta). Sem evidência → fica na lista de revisão.
3. **Legenda de referência ≠ transcrição.** Uma SRT de outra versão (ex.: vídeo já editado) só
   vale para a mídia a que pertence; o plano ignora transcrições de outro arquivo.
4. **Não depender de visão/multimodal do agente** para transcrever ou medir. Use o STT local e o QA.
5. **Corte não come fala:** o motor protege fala detectada por energia com folga; remoções de fala
   (repetição, hesitação, decisão do operador) viram `decisions` + `review`.
6. **Estados de QA honestos** (`PASS/WARN/FAIL/BLOCKED/NOT_TESTED`); escuta humana e Crítico
   independente nunca são automáticos.
7. Gates do `CLAUDE.md`: BRIEF e STYLE com aprovação humana; EDIT_PLAN (storyboard de edição)
   **antes** do config; stills antes do render final; Crítico em contexto novo.

## 1 · Pipeline

```bash
motion stt doctor                                   # faster-whisper local disponível? (senão: motion stt setup)
motion edit analyze bruto.mp4 --output=transcript/raw.analysis.json --stills=reviews/frames
motion edit transcribe bruto.mp4 --hotwords="nomes próprios, produtos" \
  --output=transcript/raw.transcript.json --srt=transcript/raw.asr.srt
#   → escreva BRIEF.md, STYLE.md e EDIT_PLAN.md (decisões + cards a partir da transcrição)
motion edit plan bruto.mp4 --transcript=transcript/raw.transcript.json \
  --analysis=transcript/raw.analysis.json --config=edit.config.json --brief=BRIEF.md --output=edit.json
motion edit preview edit.json --output=out/previews/preview.mp4      # stills + contact sheet → Crítico
motion edit render  edit.json --output=out/final/reel.mp4 --ab=out/final/audio-ab
motion qa reel out/final/reel.mp4 --timeline=edit.json [--compare=<2º render>] --json
motion export . entrega.zip && motion qa delivery --project . --zip entrega.zip
```

## 2 · `edit.config.json` (decisões do operador, versionadas)

| Campo | Para quê |
|---|---|
| `preset` | `talking-head` · `tutorial` · `podcast` · `interview` · `institucional` (`motion edit presets`) |
| `faceBox` + `faceBoxSource:"operator"` | caixa da cabeça (topo do cabelo → queixo), normalizada, lida nos stills; protege olhos→boca e centra o zoom |
| `exclude` + `excludeReasons` | trechos a remover (tomada recomeçada, final ruim). O motor ajusta às bordas das palavras |
| `hook` | trecho movido para o início (só se a história pedir) |
| `emphasis` | `[{match:"frase", zoom:1.2}]` punch-in na frase-chave |
| `corrections` | `[{wordIds, text, reason, by, evidence}]` correções do ASR com proveniência; com `start`/`end` corrige também o tempo (sem `text`, só o tempo de uma palavra, que continua na lista de revisão) |
| `captions.breakBefore` / `captions.noBreakBefore` | ids de palavras que abrem uma página / que ficam com a palavra anterior |
| `overlays` | cards `title` · `label` (chips) · `list` · `cta`, ancorados em `{match:"palavras ditas"}` com `steps` progressivos |
| `captions` / `overlayStyle` | fontes do projeto (`fontsDir`, licença no contrato), cores, palavras-chave |
| `audio` | `{preset, overrides, denoiser, music:{path, gainDb, duck}}` |

Cards só com texto que a pessoa **disse** (ou resumo fiel). Nunca métricas, telas ou CTAs inventados.

O `BRIEF.md` pode trazer um bloco `json motion-brief` (`opening`, `glossary`, `keywords`). `opening:
strongest-line` só propõe: mostre as frases ao usuário e só aplique com `openingApproval`. Gancho, loop e
CTA não são obrigatórios. Card não antecipa a fala nem fica vazio > 0,8 s (o plano adia e avisa).

## 3 · Leitura do plano

`motion edit plan --json` devolve `stats` (duração antes/depois, cortes, zoom cuts, palavras
perdidas sem decisão — deve ser **0**), `decisions`, `review` e `warnings`. Revise:
repetições removidas, recomeços detectados, palavras de baixa confiança, texto queimado na fonte
(o motor não faz OCR: olhe os stills), colisões de cards.

## 4 · QA e entrega

`motion qa reel` mede: H.264/AAC/yuv420p 9:16, quadros = timeline, −14 LUFS ±1, true peak,
fala perdida em cortes de silêncio (VAD na fonte), energia nas bordas de corte, sincronia das
legendas com a fala do **áudio final**, caixa real de cada legenda contra a safe zone da plataforma
e a faixa do rosto, cards (fontes/overflow/DOM), alinhamento A/V, original preservado e, com
`--compare`, reprodutibilidade por hash de quadros/amostras. Entregue: MP4, voz tratada (WAV),
A/B com loudness casado, SRT/ASS/JSON das legendas, `edit.json`, config, transcrição, relatórios
de QA e notas — via `delivery.contract.json`.

**Crítico:** rode em contexto novo, sem escrita, e peça só o JSON de `motion qa critic-schema` com o SHA-256
do MP4 visto. Grave com `motion qa critic-record parecer.json --reviews=reviews` sem editar; o QA confere.

`captions.cps` diz a causa provável: *timing do ASR* se corrige com tempo/escuta; *texto demais*, dividindo
a página ou aceitando o ritmo da fala.

## 5 · Limites honestos

Sem detecção automática de rosto nem OCR (rosto declarado pelo operador). Timestamps do Whisper
são refinados pela energia da fala, não por alinhamento forçado fonético. B-roll exige material
autorizado do usuário. Áudio "de estúdio" só após escuta humana. Detalhes: `docs/REEL_EDITOR.md`.
