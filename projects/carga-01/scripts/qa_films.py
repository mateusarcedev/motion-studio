#!/usr/bin/env python3
"""Decodifica frames representativos dos MP4s finais, calcula métricas e monta contact sheets e posters."""
import subprocess, os, json, math, pathlib

ROOT = pathlib.Path(__file__).parent.parent
OUT_16x9 = ROOT / "out" / "carga-01-16x9.mp4"
OUT_9x16 = ROOT / "out" / "carga-01-9x16.mp4"
REVIEWS = ROOT / "reviews"

TIMESTAMPS = [
    ("0s", 0.0, "Cena 01 · Estabelecimento"),
    ("2s", 2.0, "Cena 01 · Cais & Navio"),
    ("4s", 4.0, "Cena 02 · Transição"),
    ("6s", 6.0, "Cena 02 · Contêiner TRV-01-A"),
    ("8s", 8.0, "Cena 03 · Spreader & Trava"),
    ("10s", 10.0, "Cena 03 · Içamento Vertical"),
    ("12s", 12.0, "Cena 04 · Acoplamento Carreta"),
    ("14s", 14.0, "Cena 04 · Estrada Noturna"),
    ("16s", 16.0, "Cena 05 · Desaceleração Hub"),
    ("18s", 18.0, "Cena 05 · Destino Final"),
    ("19.9s", 19.9, "Cena 05 · Encerramento Poético")
]

def ffprobe_info(mp4_path):
    cmd = [
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,duration,codec_name,pix_fmt,bit_rate,nb_frames",
        "-of", "json",
        str(mp4_path)
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    data = json.loads(res.stdout)["streams"][0]
    return data

def extract_frames(mp4_path, dest_dir):
    dest_dir.mkdir(parents=True, exist_ok=True)
    extracted = []
    for label, ts, scene_desc in TIMESTAMPS:
        out_png = dest_dir / f"frame_{label.replace('.', '_')}.png"
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(ts),
            "-i", str(mp4_path),
            "-vframes", "1",
            "-q:v", "2",
            str(out_png)
        ]
        subprocess.run(cmd, capture_output=True, check=True)
        size_kb = out_png.stat().st_size / 1024
        extracted.append({
            "label": label,
            "timestamp": ts,
            "scene": scene_desc,
            "path": str(out_png),
            "size_kb": round(size_kb, 1)
        })
        print(f"  ✓ {mp4_path.name} @ {label} ({ts}s): {out_png.name} ({round(size_kb, 1)} KB)")
    return extracted

print("🎥 1. Extraindo frames decodificados dos MP4s finais...")
dir_16x9 = REVIEWS / "decoded-16x9"
dir_9x16 = REVIEWS / "decoded-9x16"
frames_16 = extract_frames(OUT_16x9, dir_16x9)
frames_9 = extract_frames(OUT_9x16, dir_9x16)

meta_16 = ffprobe_info(OUT_16x9)
meta_9 = ffprobe_info(OUT_9x16)

qa_summary = {
    "horizontal_16x9": {
        "file": str(OUT_16x9),
        "resolution": f"{meta_16.get('width')}x{meta_16.get('height')}",
        "fps": meta_16.get("r_frame_rate"),
        "codec": meta_16.get("codec_name"),
        "pix_fmt": meta_16.get("pix_fmt"),
        "frames_count": meta_16.get("nb_frames"),
        "extracted_frames": frames_16
    },
    "vertical_9x16": {
        "file": str(OUT_9x16),
        "resolution": f"{meta_9.get('width')}x{meta_9.get('height')}",
        "fps": meta_9.get("r_frame_rate"),
        "codec": meta_9.get("codec_name"),
        "pix_fmt": meta_9.get("pix_fmt"),
        "frames_count": meta_9.get("nb_frames"),
        "extracted_frames": frames_9
    }
}

(REVIEWS / "qa_films.json").write_text(json.dumps(qa_summary, indent=2))
print("✓ Metadados e frames decodificados salvos com sucesso!")
