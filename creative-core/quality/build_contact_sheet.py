#!/usr/bin/env python3
"""MOTION — build_contact_sheet.py: folha de contato dos stills de produção.

Produto 5 (portões e crítica): ANTES do render completo, o produtor registra
os beats (entrada/ação/virada/saída) e transições como PNGs numerados
(render_static.mjs --frame=N); este script monta a folha de contato HTML
e captura com o próprio Chromium (mesmo motor, zero dependência nova).

Uso: python3 creative-core/quality/build_contact_sheet.py \
        <frame_01.png> <frame_02.png> ... -o out/contact-sheet.png \
        [--title "teaser v2 — beats"] [--cols 4] [--labels "f01;f02;..."]

A sheet HTML nasce NA PASTA DO PRIMEIRO frame (rootDir do server local do
renderer resolve os PNGs por nome); Chromium bloqueia file:// de páginas http,
por isso caminhos relativos. O PNG final vai para `-o`.

Saída: PNG da folha + JSON do QA do render. Esta folha é o artefato que o
Crítico recebe (contexto novo, CLAUDE.md).
"""
import argparse
import html
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
CSS_W = 1280  # largura da folha em px CSS

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("frames", nargs="+", type=Path)
    ap.add_argument("-o", "--out", type=Path, required=True)
    ap.add_argument("--title", default="Contact sheet")
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--labels", default="", help="lista ; separada na ordem dos frames")
    a = ap.parse_args()

    for p in a.frames:
        if not p.is_file():
            raise SystemExit(f"frame inexistente: {p}")
    labels = [l for l in a.labels.split(";") if l] or [p.stem for p in a.frames]

    sheet_dir = a.frames[0].parent.resolve()
    cells = []
    for p, lab in zip(a.frames, labels):
        cells.append(f'<figure><img src="{html.escape(p.name)}">'
                     f'<figcaption>{html.escape(lab)}</figcaption></figure>')

    doc = f'''<!doctype html><meta charset="utf-8"><style>
body{{margin:0;padding:24px;background:#101014;color:#eee;font:14px/1.4 system-ui;width:{CSS_W - 48}px}}
h1{{font-size:1rem;margin:0 0 4px}} .sub{{color:#999;font-size:.8rem;margin-bottom:16px}}
.grid{{display:grid;grid-template-columns:repeat({a.cols},1fr);gap:14px}}
figure{{margin:0}} img{{width:100%;display:block;border-radius:6px;border:1px solid #333}}
figcaption{{color:#aaa;text-align:center;font-size:.8rem;padding:4px 0}}
.empty{{color:#999}}
</style><h1>{html.escape(a.title)}</h1>
<div class="sub">{len(a.frames)} stills · MOTION contact sheet · gerado para o Crítico</div>
<div class="grid">{"".join(cells) or '<p class="empty">sem frames</p>'}</div>'''

    sheet_html = sheet_dir / "contact-sheet.html"
    sheet_html.write_text(doc, encoding="utf-8")

    r = subprocess.run(["node", str(HERE / ".." / "renderers" / "render_static.mjs"),
                        str(sheet_html), str(a.out),
                        f"--width={CSS_W}", "--height=2000", "--scale=2",
                        "--full-page"], capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr, file=sys.stderr)
        return 1
    print(r.stdout)
    return 0

if __name__ == "__main__":
    sys.exit(main())
