#!/usr/bin/env python3
"""MOTION — assemble_video.py: frames → MP4 determinístico via FFmpeg (stdlib puro).

Produção dirigida por código (produto 4): cada frame é uma captura numerada
(batch do render_static.mjs --frame=N); a grade temporal é 30fps CFR e o áudio,
quando fornecido, é alinhado a essa MESMA grade (offsets em segundos = frames/fps).

Uso:
  python3 creative-core/renderers/assemble_video.py <pasta_frames> <saida.mp4> \
      [--fps 30] [--audio track.m4a] [--crf 18]

Regras:
  - Codificação CFR (constant frame rate) — timeline reproduzível e seekable.
  - yuv420p (compatibilidade de players/redes).
  - Valida: contagem de frames antecipada e aborta se a grade estiver furada.
  - NÃO considera qualidade assegurada: passar daqui é entrada para o Crítico.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

def natural_key(p: Path):
    m = re.search(r"(\d+)", p.stem)
    return int(m.group(1)) if m else -1

def expect_frames(folder: Path, fps: int):
    frames = sorted([p for p in folder.rglob("*.png")], key=natural_key)
    if not frames:
        raise SystemExit(f"nenhum PNG em {folder}")
    indexes = sorted(natural_key(p) for p in frames)
    expected = list(range(len(frames)))
    if indexes != expected:
        missing = sorted(set(expected) - set(indexes))[:10]
        raise SystemExit(f"grade temporal furada: faltam frames {missing} (regenere o trecho)")
    w, h = None, None
    # dimensoes via chunk IHDR (stdlib)
    import struct
    with open(frames[0], "rb") as f:
        f.read(16)
        w, h = struct.unpack(">II", f.read(8))
    return frames, (w, h)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("frames_dir", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--audio", type=Path)
    ap.add_argument("--crf", type=int, default=18)
    ap.add_argument("--even-dims", action="store_true", default=True,
                    help="força dimensões pares (yuv420p exige; 1080/1920 já são)")
    a = ap.parse_args()

    frames, (w, h) = expect_frames(a.frames_dir, a.fps)
    if a.even_dims:
        w -= w % 2
        h -= h % 2
    vf = f"scale={w}:{h}:flags=lanczos,fps={a.fps}" if (w, h) != frames[0] else f"fps={a.fps}"

    cmd = ["ffmpeg", "-y", "-framerate", str(a.fps), "-i", str(a.frames_dir / "%04d.png")]
    if a.audio:
        cmd += ["-i", str(a.audio)]
        # grade temporal do áudio: começa em t=0 do frame 0; trunca no final do vídeo
        cmd += ["-shortest"]
    cmd += [
        "-vf", f"fps={a.fps}",
        "-c:v", "libx264", "-crf", str(a.crf), "-pix_fmt", "yuv420p",
        "-c:a", "aac" if a.audio else "anull",
    ] + (["-b:a", "192k", "-shortest"] if a.audio else []) + [
        "-movflags", "+faststart",
        str(a.out),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-2000:], file=sys.stderr)
        raise SystemExit("ffmpeg falhou")
    dur = len(frames) / a.fps
    print(json.dumps({
        "mp4": str(a.out), "frames": len(frames), "fps": a.fps,
        "seconds": round(dur, 2), "size": f"{w}x{h}",
        "audio": str(a.audio) if a.audio else None,
        "note": "CFR: frame N = N/fps s; contact sheet antes disso = portão do Crítico",
    }, ensure_ascii=False))

if __name__ == "__main__":
    main()
