#!/usr/bin/env python3
"""MOTION — zip_export.py  (exportador ZIP puro stdlib)

Uso: python3 creative-core/exporters/zip_export.py <pasta_fonte> <saida.zip> [--ext png,html,json,...]
Empacota a entrega final (PNGs exportados, HTML fonte editável, legenda, metadados).
"""
import argparse, zipfile, sys
from pathlib import Path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source", type=Path)
    ap.add_argument("outzip", type=Path)
    ap.add_argument("--ext", default="")
    a = ap.parse_args()

    exts = {e.strip().lower().lstrip(".") for e in a.ext.split(",") if e.strip()} \
        if a.ext else {"png", "html", "css", "json", "md", "jpg", "jpeg", "webp", "svg"}
    files = sorted(p for p in a.source.rglob("*")
                   if p.is_file() and p.suffix.lstrip(".").lower() in exts and ".git" not in p.parts)
    with zipfile.ZipFile(a.outzip, "w", zipfile.ZIP_DEFLATED) as z:
        for f in files:
            z.write(f, f.relative_to(a.source))
    print(f"ZIP: {a.outzip} ({len(files)} arquivos)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
