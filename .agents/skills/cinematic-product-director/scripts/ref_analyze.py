#!/usr/bin/env python3
"""ref_analyze.py — decupagem objetiva de um vídeo de referência.

Uso:
  python3 ref_analyze.py <video> [--out ref/analysis] [--fps 4] [--floor 0.08] [--ratio 8] [--min-changed 0.7] [--cols 8]

Gera em --out:
  frames/f_0001.jpg ...   quadros na taxa --fps (largura 320)
  contact.jpg             folha de contato com o tempo de cada miniatura
  ref-analysis.json       metadados, cortes detectados, planos e estatísticas

Dependências: ffmpeg/ffprobe no PATH. Pillow opcional (só para o rótulo de tempo na folha).
Cortes = score de cena por quadro acima de um piso absoluto E várias vezes acima da mediana local
(jump cuts de rosto falando têm score baixo, 0,1–0,25; um limiar fixo de 0,3 não os vê).
Um corte muda o quadro inteiro. Pico forte que deixa parte do quadro idêntica (card grande, caixa de texto)
vai para "reviewCandidates", nunca para "cuts": confira na folha de contato. Picos fracos vão para
"overlayChanges".
LIMITAÇÃO: corte entre planos com fundo idêntico (tela gravada, rosto sobre fundo chapado) também vira
candidato; card que cobre quase tudo pode virar corte; transição por movimento pode não gerar nada.
"""
import argparse
import json
import math
import os
import re
import statistics
import subprocess


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(path):
    r = run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path])
    if r.returncode != 0:
        raise SystemExit(f"ffprobe falhou: {r.stderr.strip()}")
    d = json.loads(r.stdout)
    v = next((s for s in d["streams"] if s.get("codec_type") == "video"), None)
    a = next((s for s in d["streams"] if s.get("codec_type") == "audio"), None)
    if v is None:
        raise SystemExit("sem stream de vídeo")
    num, den = (v.get("avg_frame_rate") or "0/1").split("/")
    rot = 0
    for sd in v.get("side_data_list", []) or []:
        if "rotation" in sd:
            rot = int(sd["rotation"])
    w, h = int(v["width"]), int(v["height"])
    if abs(rot) in (90, 270):
        w, h = h, w
    return {
        "durationSec": round(float(d["format"]["duration"]), 3),
        "width": w, "height": h, "rotation": rot,
        "fps": round(float(num) / float(den or 1), 3) if float(den or 1) else None,
        "videoCodec": v.get("codec_name"), "hasAudio": a is not None,
    }


def scene_scores(path):
    """Score de mudança de cena por quadro (0–1), em resolução reduzida."""
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        f = os.path.join(td, "scores.txt")
        r = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-an", "-vf",
             f"scale=320:-2,select='gte(scene,0)',metadata=print:key=lavfi.scene_score:file={f}",
             "-f", "null", "-"])
        if r.returncode != 0:
            raise SystemExit(f"detecção de cortes falhou: {r.stderr.strip()[-300:]}")
        txt = open(f).read() if os.path.exists(f) else ""
    t = [float(x) for x in re.findall(r"pts_time:([0-9.]+)", txt)]
    sc = [float(x) for x in re.findall(r"scene_score=([0-9.]+)", txt)]
    if not t or len(t) != len(sc):
        raise SystemExit("detecção de cortes falhou: nenhum score legível")
    return list(zip(t, sc))


GRID = 24  # o quadro é reduzido a GRID×GRID médias de luma


def changed_fraction(path, times, fps):
    """Fração do quadro que muda em cada tempo, descontado o que já mudava entre os quadros anteriores."""
    if not times:
        return []
    dt = 1.0 / (fps or 30.0)
    out = []
    for t in times:
        start = max(0.0, t - 2.5 * dt)
        r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{start:.6f}", "-i", path, "-an", "-frames:v", "3",
                            "-vf", f"scale={GRID}:{GRID}:flags=area,format=gray", "-f", "rawvideo", "-"],
                           capture_output=True)
        n = GRID * GRID
        if r.returncode != 0 or len(r.stdout) < 3 * n:
            out.append(None)
            continue
        fr = [r.stdout[i * n:(i + 1) * n] for i in range(3)]
        before = [abs(x - y) for x, y in zip(fr[0], fr[1])]
        after = [abs(x - y) for x, y in zip(fr[1], fr[2])]
        noise = statistics.median(before)
        out.append(round(sum(d > max(1, 2 * noise) for d in after) / n, 3))
    return out


def detect_cuts(scores, floor, ratio, min_gap=0.2, win=15):
    """Corte = score acima do piso E muito acima da mediana local.
    Picos que passam na razão mas não no piso viram 'weak' (texto/overlay entrando, mudança parcial)."""
    vals = [s for _, s in scores]
    strong, weak = [], []
    for i, (t, s) in enumerate(scores):
        lo, hi = max(0, i - win), min(len(vals), i + win + 1)
        med = statistics.median(vals[lo:hi])
        if s <= ratio * max(med, 0.002):
            continue
        target = strong if s >= floor else weak if s >= 0.02 else None
        if target is None:
            continue
        if target and t - target[-1]["t"] < min_gap:
            if s > target[-1]["score"]:
                target[-1] = {"t": round(t, 3), "score": round(s, 4)}
            continue
        target.append({"t": round(t, 3), "score": round(s, 4)})
    return strong, weak


def extract_frames(path, out, fps):
    fdir = os.path.join(out, "frames")
    os.makedirs(fdir, exist_ok=True)
    for f in os.listdir(fdir):
        if f.endswith(".jpg"):
            os.remove(os.path.join(fdir, f))
    r = run(["ffmpeg", "-v", "error", "-y", "-i", path, "-vf", f"fps={fps},scale=320:-2",
             "-q:v", "4", os.path.join(fdir, "f_%04d.jpg")])
    if r.returncode != 0:
        raise SystemExit(f"extração falhou: {r.stderr.strip()}")
    return sorted(f for f in os.listdir(fdir) if f.endswith(".jpg"))


def contact_sheet(out, files, fps, cols):
    fdir = os.path.join(out, "frames")
    dest = os.path.join(out, "contact.jpg")
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        rows = math.ceil(len(files) / cols)
        run(["ffmpeg", "-v", "error", "-y", "-framerate", "1", "-i", os.path.join(fdir, "f_%04d.jpg"),
             "-vf", f"tile={cols}x{rows}:padding=4:color=0x111111", "-frames:v", "1", dest])
        return dest, False
    thumbs = [Image.open(os.path.join(fdir, f)).convert("RGB") for f in files]
    tw, th = thumbs[0].size
    pad, label_h = 4, 18
    rows = math.ceil(len(thumbs) / cols)
    sheet = Image.new("RGB", (cols * (tw + pad) + pad, rows * (th + label_h + pad) + pad), (17, 17, 17))
    draw = ImageDraw.Draw(sheet)
    for i, im in enumerate(thumbs):
        x = pad + (i % cols) * (tw + pad)
        y = pad + (i // cols) * (th + label_h + pad)
        sheet.paste(im, (x, y + label_h))
        draw.text((x + 2, y + 2), f"{i / fps:.2f}s", fill=(230, 230, 230))
    sheet.save(dest, quality=85)
    return dest, True


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("video")
    ap.add_argument("--out", default="ref/analysis")
    ap.add_argument("--fps", type=float, default=4.0)
    ap.add_argument("--floor", type=float, default=0.08, help="score mínimo para corte (0–1)")
    ap.add_argument("--ratio", type=float, default=8.0, help="quantas vezes acima da mediana local")
    ap.add_argument("--min-changed", type=float, default=0.7,
                    help="fração mínima do quadro que muda para ser corte (abaixo: candidato para revisão)")
    ap.add_argument("--cols", type=int, default=8)
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    meta = probe(args.video)
    strong, weak = detect_cuts(scene_scores(args.video), args.floor, args.ratio)
    strong = [c for c in strong if 0.05 < c["t"] < meta["durationSec"] - 0.05]
    for c, frac in zip(strong, changed_fraction(args.video, [c["t"] for c in strong], meta["fps"])):
        c["changedFraction"] = frac
    review = [c for c in strong if c["changedFraction"] is None or c["changedFraction"] < args.min_changed]
    strong = [c for c in strong if c not in review]
    cuts = [c["t"] for c in strong]
    near = [0.0] + [c["t"] for c in strong + review]
    weak = [w for w in weak if all(abs(w["t"] - n) > 0.1 for n in near)]
    bounds = [0.0] + cuts + [meta["durationSec"]]
    shots = [{"index": i, "start": round(bounds[i], 3), "end": round(bounds[i + 1], 3),
              "dur": round(bounds[i + 1] - bounds[i], 3)} for i in range(len(bounds) - 1)]
    durs = [s["dur"] for s in shots]
    stats = {
        "shots": len(shots),
        "meanSec": round(statistics.mean(durs), 3),
        "medianSec": round(statistics.median(durs), 3),
        "minSec": round(min(durs), 3), "maxSec": round(max(durs), 3),
        "stdevSec": round(statistics.pstdev(durs), 3),
        "cutsPerMin": round(len(cuts) / (meta["durationSec"] / 60), 2),
        "under0_5s": sum(d < 0.5 for d in durs),
        "over3s": sum(d > 3.0 for d in durs),
    }
    # planos de duração quase igual sugerem montagem mecânica
    stats["uniformityWarning"] = bool(len(durs) >= 4 and stats["stdevSec"] < 0.15 * stats["meanSec"])

    files = extract_frames(args.video, args.out, args.fps)
    sheet, labeled = contact_sheet(args.out, files, args.fps, args.cols)

    result = {"source": args.video, "meta": meta,
              "detection": {"floor": args.floor, "ratio": args.ratio, "minChanged": args.min_changed,
                            "method": "scene_score vs local median + changed fraction of the frame"},
              "cuts": cuts, "cutScores": strong, "reviewCandidates": review, "overlayChanges": weak,
              "shots": shots, "stats": stats,
              "frames": {"dir": os.path.join(args.out, "frames"), "fps": args.fps, "count": len(files)},
              "contactSheet": sheet, "contactSheetLabeled": labeled,
              "note": "reviewCandidates exige conferência na folha de contato: overlay grande ou corte com fundo idêntico; "
                      "transições por movimento podem não gerar corte"}
    path = os.path.join(args.out, "ref-analysis.json")
    with open(path, "w") as f:
        json.dump(result, f, indent=1, ensure_ascii=False)
    print(json.dumps({"out": path, "durationSec": meta["durationSec"],
                      "reviewCandidates": len(review), **stats}, ensure_ascii=False))


if __name__ == "__main__":
    main()
