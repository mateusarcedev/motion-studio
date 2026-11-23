# Speech-to-Text no MOTION

Transcrição local e agnóstica de agente. O MOTION nunca depende da capacidade multimodal do
Claude ou de outro agente para transcrever: o motor roda por CLI (`motion edit transcribe`), pela
API (`reel.transcribeMedia`) ou pelo MCP (`motion_edit_transcribe`).

## Ambiente isolado

As dependências Python ficam **fora do repositório** e fora do Python do sistema:

| Item | Padrão | Variável |
|---|---|---|
| venv | `~/.local/share/motion/stt/venv` | `MOTION_STT_HOME` / `MOTION_STT_PYTHON` |
| modelos | `~/.local/share/motion/stt/models` (cache Hugging Face) | `MOTION_STT_MODELS` |
| download | desligado na transcrição (`HF_HUB_OFFLINE=1`) | `MOTION_STT_ALLOW_DOWNLOAD=1` |

```bash
motion stt setup            # mostra os comandos (nada é instalado)
motion stt setup --yes      # cria o venv, instala faster-whisper==1.2.1 e baixa o modelo small
motion stt doctor           # versões, modelo e revisão em cache
```

Testado neste repositório: Python 3.14.4 (build com GIL) + `uv` 0.13.9, faster-whisper 1.2.1,
CTranslate2 4.9.1, modelo `Systran/faster-whisper-small` revisão
`536b0662742c02347bc0e980a01041f333bce120`, CPU INT8 (4 threads): ~36 s para 66 s de áudio.

## Provedores

| id | tipo | estado |
|---|---|---|
| `faster-whisper` | local | **implementado** (padrão: `small`, CPU, INT8; outros modelos via `--model`) |
| `srt-import` | importação | implementado (`motion edit import-srt`), escopo restrito à mídia da legenda |
| `whisper-cpp` | local | interface declarada, não implementado |
| `openai` | nuvem | interface declarada, não implementado (exigirá chave e consentimento de envio) |
| `gemini` | nuvem | interface declarada, não implementado (idem) |

Novo provedor: `registerSttProvider({ id, kind, implemented, describe, available, transcribe })`
devolvendo os segmentos/palavras; `normalize…` converte para `motion.transcript@1`. Provedores não
implementados falham com `MOTION_STT_PROVIDER_NOT_IMPLEMENTED` — nunca há troca silenciosa.

## Decodificação

O worker decodifica com FFmpeg para PCM float 16 kHz (sem PyAV), usa `word_timestamps`, feixe 5,
fallback de temperatura (0 → 1,0) com `compression_ratio_threshold=2.4` e semente fixa do
CTranslate2 (resultado reproduzível), `--hotwords` para glossário de nomes próprios e
`--initial-prompt` opcional. Segmentos com repetição em loop (> 6 tokens iguais) ou compressão
> 2,4 são marcados `hallucinationSuspected`; essas palavras nunca viram legenda.

## `motion.transcript@1`

`provider` (id, modelo, revisão, versões, parâmetros de decodificação, tempos), `source`
(caminho + SHA-256), `scope` (`full-media` ou `imported-subtitle`), `language`,
`languageProbability`, `words[]` (`id`, `text`, `start`, `end`, `confidence`, `timing`),
`segments[]`, `silences[]`, `coverage`, `review[]` (baixa confiança, loops), `corrections[]`
(antes/depois, motivo, autor, evidência), `warnings[]`.

## Regras

1. Uma legenda importada vale para a mídia a que pertence; o plano descarta transcrições cujo
   SHA-256 não é o da fonte (uma legenda da versão editada não é transcrição do bruto).
2. Correções preservam os tempos reconhecidos e exigem `reason`, `by` e `evidence`.
3. Sincronização após cortes: palavras refinadas pela energia da fala e remapeadas pela timeline;
   removidas por decisão nunca reaparecem; `motion qa reel` confere legenda × fala no áudio final.
