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
    ap.add_argument("--format", choices=("mp4", "webm"), default="mp4",
                    help="mp4 mantém H.264 yuv420p; webm exporta VP9 com alpha decodificável")
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
    if a.format == "webm":
        cmd += ["-vf", f"fps={a.fps},format=yuva420p", "-c:v", "libvpx-vp9", "-lossless", "1",
                "-auto-alt-ref", "0", "-metadata:s:v:0", "alpha_mode=1", "-an"]
        if a.audio:
            cmd += ["-c:a", "libopus", "-shortest"]
    else:
        # Preserve the existing MP4 path and encoding defaults.
        cmd += ["-vf", f"fps={a.fps}", "-c:v", "libx264", "-crf", str(a.crf), "-pix_fmt", "yuv420p",
                "-c:a", "aac" if a.audio else "anull"]
        if a.audio:
            cmd += ["-b:a", "192k", "-shortest"]
        cmd += ["-movflags", "+faststart"]
    cmd += [str(a.out)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-2000:], file=sys.stderr)
        raise SystemExit("ffmpeg falhou")
    dur = len(frames) / a.fps
    result = {
        "frames": len(frames), "fps": a.fps,
        "seconds": round(dur, 2), "size": f"{w}x{h}",
        "audio": str(a.audio) if a.audio else None,
        "note": "CFR: frame N = N/fps s; contact sheet antes disso = portão do Crítico",
    }
    if a.format == "webm":
        result.update(validate_webm_alpha(a.out, len(frames), a.fps))
        result["webm"] = str(a.out)
    else:
        result["mp4"] = str(a.out)
    print(json.dumps(result, ensure_ascii=False))

def validate_webm_alpha(output: Path, frame_count: int, fps: int):
    """Prove VP9 alpha signaling and inspect decoded alpha in beginning/middle/end frames."""
    probe = subprocess.run([
        "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(output),
    ], capture_output=True, text=True)
    if probe.returncode:
        raise SystemExit("ffprobe não conseguiu ler o WebM: " + probe.stderr[-1000:])
    data = json.loads(probe.stdout)
    video = next((stream for stream in data.get("streams", []) if stream.get("codec_type") == "video"), None)
    if not video or video.get("codec_name") != "vp9":
        raise SystemExit("WebM não contém uma stream de vídeo VP9")
    tags = {str(k).lower(): str(v) for k, v in video.get("tags", {}).items()}
    if tags.get("alpha_mode") != "1":
        raise SystemExit("VP9 WebM não sinalizou alpha_mode=1 nos metadados")

    sample_frames = sorted(set([0, frame_count // 2, max(0, frame_count - 1)]))
    alpha_samples = []
    partial_pixels = 0
    for frame in sample_frames:
        decoded = subprocess.run([
            "ffmpeg", "-v", "error", "-c:v", "libvpx-vp9", "-ss", f"{frame / fps:.6f}", "-i", str(output),
            "-frames:v", "1", "-vf", "alphaextract", "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1",
        ], capture_output=True)
        if decoded.returncode or not decoded.stdout:
            raise SystemExit("não foi possível decodificar o canal alfa do WebM no frame %d: %s" % (frame, decoded.stderr[-500:].decode(errors="replace")))
        alpha = decoded.stdout
        partial = sum(0 < pixel < 255 for pixel in alpha)
        partial_pixels += partial
        alpha_samples.append({"frame": frame, "min": min(alpha), "max": max(alpha), "partialPixels": partial})
    if not any(sample["min"] == 0 for sample in alpha_samples):
        raise SystemExit("os quadros amostrados não contêm pixels totalmente transparentes")
    if partial_pixels == 0:
        raise SystemExit("os quadros amostrados não preservam bordas com alpha parcial")
    return {"format": "webm", "codec": "vp9", "alphaMode": tags["alpha_mode"], "alphaSamples": alpha_samples}

if __name__ == "__main__":
    main()
