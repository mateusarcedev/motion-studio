# reel-ia-programacao — homologação real do Smart Reel Editor (Missão 21)

Edição do vídeo de celular `reels-motion.mp4` (66,4 s) com o motor `motion edit`, usando
`reel-ia-programacao.mp4` apenas como referência de qualidade. Todos os passos são CLI e
reexecutáveis a partir destes arquivos.

## Reproduzir

```bash
cd projects/reel-ia-programacao
M="node ../../packages/motion-cli/bin/motion.mjs"
SRC=out/source/reels-motion.mp4   # cópia do bruto (não versionada); SHA-256 no BRIEF
$M stt doctor
$M edit analyze "$SRC" --output=transcript/raw.analysis.json
$M edit transcribe "$SRC" --hotwords="IA, ChatGPT, Claude Code, Anthropic, Codex, Antigravity, dev, programação" \
   --output=transcript/raw.transcript.json --srt=transcript/raw.asr.srt
$M edit plan "$SRC" --transcript=transcript/raw.transcript.json --analysis=transcript/raw.analysis.json \
   --config=edit.config.json --brief=BRIEF.md --output=edit.json
$M edit preview edit.json --output=out/previews/preview.mp4
$M edit render  edit.json --output=out/final/reel.mp4 --ab=out/final/audio-ab
$M edit render  edit.json --output=out/determinism/reel-run2.mp4
$M qa reel out/final/reel.mp4 --timeline=edit.json --compare=out/determinism/reel-run2.mp4 \
   --output=reviews/qa-reel.json --markdown=reviews/qa-reel.md
node benchmark.mjs
$M export . out/entrega-reel-ia-programacao.zip
$M qa delivery --project . --zip out/entrega-reel-ia-programacao.zip
```

## Arquivos

| Arquivo | Papel |
|---|---|
| `BRIEF.md`, `STYLE.md`, `EDIT_PLAN.md` | direção (gates humanos pendentes) e storyboard de edição |
| `edit.config.json` | decisões do operador (exclusões, ênfase, correções com evidência, cards, rosto) |
| `edit.json` | timeline `motion.timeline@1` gerada (reexecutável) |
| `transcript/` | transcrição faster-whisper (bruto e referência), análise |
| `fonts/` | Inter 700 e JetBrains Mono 700 (OFL) |
| `out/` | renders (não versionado) |
| `reviews/` | QA, benchmark, inspeção visual, parecer do Crítico |
