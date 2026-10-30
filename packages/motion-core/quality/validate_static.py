#!/usr/bin/env python3
"""MOTION — validate_static.py
Validador de qualidade para peças estáticas. Agnóstico de agente; stdlib puro.

Uso: python3 creative-core/quality/validate_static.py <png> --expected WxH [--scale 2]
Saída: JSON {file, actual, expected, scaleOk, valid, problems[]}

Valida: dimensões (esperadas = preset CSS size × scale). Não avalia estética —
essa é a função do Crítico (revisão independente), conforme CLAUDE.md.
"""
import argparse, json, struct, sys

def png_size(path):
    with open(path, "rb") as f:
        sig = f.read(8)
        assert sig == b"\x89PNG\r\n\x1a\n", "não é PNG"
        assert f.read(4) == b"\x00\x00\x00\x0d", "IHDR ausente"
        assert f.read(4) == b"IHDR", "chunk inválido"
        w, h = struct.unpack(">II", f.read(8))
    return w, h

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("png")
    ap.add_argument("--expected", required=True, help="WxH em px de saída, ex: 2160x2700")
    ap.add_argument("--scale", type=int, default=2)
    a = ap.parse_args()
    problems = []
    try:
        w, h = png_size(a.png)
    except Exception as e:
        print(json.dumps({"file": a.png, "valid": False, "problems": [f"PNG ilegível: {e}"] }))
        return 1
    ew, eh = (int(x) for x in a.expected.lower().split("x"))
    if (w, h) != (ew, eh):
        problems.append(f"dimensões {w}x{h} ≠ esperado {ew}x{eh}")
    if w % a.scale != 0 or h % a.scale != 0:
        problems.append(f"resolução não resultou de deviceScaleFactor {a.scale} (não amplificar depois!)")
    ok = not problems
    print(json.dumps({"file": a.png, "actual": f"{w}x{h}", "expected": a.expected,
                      "scale": a.scale, "valid": ok, "problems": problems}))
    return 0 if ok else 1

if __name__ == "__main__":
    sys.exit(main())
