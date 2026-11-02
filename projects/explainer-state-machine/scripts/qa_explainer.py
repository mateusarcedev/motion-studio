#!/usr/bin/env python3
"""Extrai frames decodificados do MP4 final da Máquina de Estados, calcula métricas e valida especificações."""
import subprocess, os, json, pathlib

ROOT = pathlib.Path(__file__).parent.parent
MP4 = ROOT / "out" / "state-machine-9x16.mp4"
REVIEWS = ROOT / "reviews"
DECODED_DIR = REVIEWS / "decoded"

TIMESTAMPS = [
    ("01_0s", 1.0, "Ato 01 · Abertura: Flags Booleanas"),
    ("04_0s", 4.0, "Ato 01 · Matriz Combinatória 2⁴ = 16"),
    ("06_0s", 6.0, "Ato 01 · Conflito Booleano / Colisão"),
    ("10_0s", 10.0, "Ato 02 · Estados Finitos (IDLE Ativo)"),
    ("14_0s", 14.0, "Ato 02 · Callout e Domínio Finito"),
    ("18_0s", 18.0, "Ato 03 · Disparo EVENT: FETCH (Partícula)"),
    ("22_0s", 22.0, "Ato 03 · FETCHING Absorvido com Spring"),
    ("28_0s", 28.0, "Ato 04 · Guarda Rejeitada (isValid: false)"),
    ("32_0s", 32.0, "Ato 04 · Guarda Aprovada (Flash Menta)"),
    ("38_0s", 38.0, "Ato 05 · Evento Ilegal Repelido (Mola)"),
    ("42_0s", 42.0, "Ato 05 · Integridade e Estado Intacto"),
    ("46_0s", 46.0, "Ato 06 · Ciclo Completo (Passo 2/4)"),
    ("50_0s", 50.0, "Ato 06 · Ciclo Completo (Passo 4/4)"),
    ("55_0s", 55.0, "Ato 07 · Síntese e 3 Preceitos FSM"),
    ("59_5s", 59.5, "Ato 07 · Encerramento de Engenharia")
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
    return json.loads(res.stdout)["streams"][0]

def extract_frames(mp4_path, dest_dir):
    dest_dir.mkdir(parents=True, exist_ok=True)
    extracted = []
    for label, ts, scene_desc in TIMESTAMPS:
        out_png = dest_dir / f"frame_{label}.png"
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

def main():
    print(f"🎥 Extraindo frames decodificados de {MP4}...")
    meta = ffprobe_info(MP4)
    extracted = extract_frames(MP4, DECODED_DIR)

    qa_report = {
        "project": "explainer-state-machine",
        "file": str(MP4),
        "resolution": f"{meta.get('width')}x{meta.get('height')}",
        "fps": meta.get("r_frame_rate"),
        "duration": meta.get("duration"),
        "codec": meta.get("codec_name"),
        "pix_fmt": meta.get("pix_fmt"),
        "frames_count": meta.get("nb_frames"),
        "bit_rate": meta.get("bit_rate"),
        "extracted_frames": extracted
    }

    out_json = REVIEWS / "qa_explainer.json"
    out_json.write_text(json.dumps(qa_report, indent=2))
    print(f"✓ Metadados de QA e frames decodificados salvos em {out_json}!")

if __name__ == "__main__":
    main()
