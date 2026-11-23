#!/usr/bin/env python3
"""MOTION STT worker — faster-whisper backend (local, CPU/INT8 by default).

Runs inside an isolated virtualenv (see docs/SPEECH_TO_TEXT.md). Audio is decoded by FFmpeg
into float32 PCM and handed to faster-whisper as an array, so PyAV is never required.

Usage:
  python faster_whisper_worker.py <media> --model small --compute-type int8 --device cpu \
      [--language pt] [--beam-size 5] [--models-dir DIR] [--hotwords "IA, Claude Code"] \
      [--initial-prompt TEXT] [--threads 4] [--probe]

Prints exactly one JSON document on stdout. Errors -> {"status":"FAIL","error":{...}} and exit 2.
"""
import argparse
import json
import os
import subprocess
import sys
import time


def fail(code, message, hint=None, exit_code=2):
    print(json.dumps({"status": "FAIL", "error": {"code": code, "message": message, "hint": hint}}))
    sys.exit(exit_code)


def model_revision(models_dir, name):
    """Best-effort: resolve the Hugging Face snapshot revision of a cached CTranslate2 model."""
    if os.path.isdir(name):
        return {"path": os.path.abspath(name), "revision": None, "repo": None}
    repo = name if "/" in name else f"Systran/faster-whisper-{name}"
    cache = os.path.join(models_dir or "", "models--" + repo.replace("/", "--"))
    ref = os.path.join(cache, "refs", "main")
    rev = None
    if os.path.isfile(ref):
        with open(ref, encoding="utf8") as f:
            rev = f.read().strip()
    path = os.path.join(cache, "snapshots", rev) if rev else None
    return {"repo": repo, "revision": rev, "path": path if path and os.path.isdir(path) else None}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("media", nargs="?")
    ap.add_argument("--model", default="small")
    ap.add_argument("--compute-type", default="int8")
    ap.add_argument("--device", default="cpu")
    ap.add_argument("--language", default=None)
    ap.add_argument("--beam-size", type=int, default=5)
    ap.add_argument("--models-dir", default=None)
    ap.add_argument("--hotwords", default=None)
    ap.add_argument("--initial-prompt", default=None)
    ap.add_argument("--threads", type=int, default=0)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--start", type=float, default=None)
    ap.add_argument("--duration", type=float, default=None)
    ap.add_argument("--probe", action="store_true", help="only report versions/availability")
    ap.add_argument("--download", action="store_true", help="with --probe: fetch the model into --models-dir first")
    a = ap.parse_args()

    try:
        import numpy as np
        import ctranslate2
        import faster_whisper
        from faster_whisper import WhisperModel
    except Exception as exc:  # noqa: BLE001 — report any import problem as unavailable
        fail("MOTION_STT_UNAVAILABLE", f"faster-whisper indisponível neste Python: {exc}",
             "Crie o ambiente isolado: motion stt setup (veja docs/SPEECH_TO_TEXT.md)", 3)

    versions = {"faster_whisper": faster_whisper.__version__, "ctranslate2": ctranslate2.__version__,
                "numpy": np.__version__, "python": sys.version.split()[0]}
    if a.probe and a.download:
        try:
            WhisperModel(a.model, device=a.device, compute_type=a.compute_type, download_root=a.models_dir)
        except Exception as exc:  # noqa: BLE001
            fail("MOTION_STT_UNAVAILABLE", f"download do modelo '{a.model}' falhou: {exc}", "Verifique a rede/permissões.", 3)
    if a.probe:
        info = model_revision(a.models_dir, a.model)
        print(json.dumps({"status": "OK", "versions": versions, "model": {"name": a.model, **info},
                          "modelCached": bool(info.get("path"))}))
        return
    if not a.media:
        fail("MOTION_STT_FAILED", "informe o arquivo de mídia")

    cmd = ["ffmpeg", "-v", "error"]
    if a.start is not None:
        cmd += ["-ss", str(a.start)]
    cmd += ["-i", a.media]
    if a.duration is not None:
        cmd += ["-t", str(a.duration)]
    cmd += ["-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"]
    try:
        pcm = subprocess.run(cmd, capture_output=True, check=True).stdout
    except FileNotFoundError:
        fail("MOTION_FFMPEG_MISSING", "ffmpeg não encontrado no PATH", "Instale FFmpeg", 3)
    except subprocess.CalledProcessError as exc:
        fail("MOTION_STT_FAILED", "ffmpeg não conseguiu decodificar o áudio",
             exc.stderr.decode("utf8", "replace").strip()[-300:])
    audio = np.frombuffer(pcm, dtype=np.float32)
    if audio.size < 1600:
        fail("MOTION_STT_FAILED", "áudio vazio ou curto demais para transcrever (< 0,1 s)")

    t0 = time.time()
    try:
        model = WhisperModel(a.model, device=a.device, compute_type=a.compute_type,
                             download_root=a.models_dir, cpu_threads=a.threads or 0)
    except Exception as exc:  # noqa: BLE001
        fail("MOTION_STT_UNAVAILABLE", f"não foi possível carregar o modelo '{a.model}': {exc}",
             "Baixe o modelo com: motion stt setup --model " + a.model, 3)
    load_sec = time.time() - t0
    t1 = time.time()
    # Temperature fallback (re-decode when a segment looks like a repetition loop or has very
    # low log-probability). Sampling is made reproducible with a fixed CTranslate2 seed.
    ctranslate2.set_random_seed(a.seed)
    temperatures = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
    segments, info = model.transcribe(
        audio, language=a.language, beam_size=a.beam_size, word_timestamps=True,
        vad_filter=False, condition_on_previous_text=False, temperature=temperatures,
        compression_ratio_threshold=2.4, log_prob_threshold=-1.0, no_speech_threshold=0.6,
        hotwords=a.hotwords or None, initial_prompt=a.initial_prompt or None)
    out_segments = []
    for s in segments:
        words = [{"text": w.word, "start": round(w.start, 3), "end": round(w.end, 3),
                  "probability": round(w.probability, 4)} for w in (s.words or [])]
        out_segments.append({"start": round(s.start, 3), "end": round(s.end, 3), "text": s.text.strip(),
                             "avgLogprob": round(s.avg_logprob, 4), "noSpeechProb": round(s.no_speech_prob, 4),
                             "compressionRatio": round(s.compression_ratio, 3), "words": words})
    offset = a.start or 0.0
    if offset:
        for s in out_segments:
            s["start"] = round(s["start"] + offset, 3); s["end"] = round(s["end"] + offset, 3)
            for w in s["words"]:
                w["start"] = round(w["start"] + offset, 3); w["end"] = round(w["end"] + offset, 3)
    print(json.dumps({
        "status": "OK", "versions": versions,
        "model": {"name": a.model, "computeType": a.compute_type, "device": a.device, **model_revision(a.models_dir, a.model)},
        "decoding": {"beamSize": a.beam_size, "temperature": temperatures, "seed": a.seed,
                     "compressionRatioThreshold": 2.4, "logProbThreshold": -1.0, "wordTimestamps": True, "vadFilter": False,
                     "conditionOnPreviousText": False, "hotwords": a.hotwords, "initialPrompt": a.initial_prompt},
        "language": info.language, "languageProbability": round(info.language_probability, 4),
        "durationSec": round(info.duration, 3), "loadSec": round(load_sec, 2), "transcribeSec": round(time.time() - t1, 2),
        "segments": out_segments,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
