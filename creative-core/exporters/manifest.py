#!/usr/bin/env python3
"""MOTION — manifest.py: manifesto de entrega (produto 6: fontes, manifesto de
assets, versões aprovadas) + proveniência mínima estilo SBOM.

Uso: python3 creative-core/exporters/manifest.py <pasta_producao> -o assets.manifest.json

Gera JSON com: arquivos somados (hash sha256, tamanho, papel inferido pela pasta),
renditions e referências a marca/renderer. Registre attribution de assets de
terceiros no campo `attribution` do BRIEF/STYLE — este manifesto não substitui
INTEGRATIONS.md/THIRD_PARTY.md.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

ROLES = {
    "slides": "source-html", "stories": "source-html", "frames": "still",
    "out": "render", "public": "asset-real", "references": "reference",
    "audio": "audio-asset", "fonts": "font",
}

def hash_file(p: Path):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", type=Path)
    ap.add_argument("-o", "--out", type=Path, default=None)
    a = ap.parse_args()

    files = []
    for p in sorted(a.folder.rglob("*")):
        if not p.is_file() or ".git" in p.parts or p.name.endswith(".zip"):
            continue
        role = next((v for k, v in ROLES.items() if k in p.parts), "other")
        files.append({
            "path": str(p.relative_to(a.folder)),
            "sha256": hash_file(p)[:16],
            "bytes": p.stat().st_size,
            "role": role,
        })
    mp4s = [f for f in files if f["path"].endswith(".mp4")]
    pngs = [f for f in files if f["path"].endswith(".png")]
    manifest = {
        "generated_by": "creative-core/exporters/manifest.py",
        "root": str(a.folder),
        "counts": {"files": len(files), "png": len(pngs), "mp4": len(mp4s),
                   "html": sum(1 for f in files if f["path"].endswith(".html"))},
        "renditions": [f["path"] for f in files
                       if f["role"] == "render" and f["path"].endswith((".png", ".mp4"))],
        "files": files,
    }
    out = a.out or (a.folder / "assets.manifest.json")
    out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"manifest: {out} ({len(files)} arquivos)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
