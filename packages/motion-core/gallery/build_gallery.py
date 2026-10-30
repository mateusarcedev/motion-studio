#!/usr/bin/env python3
"""MOTION — build_gallery.py  (galeria persistente de carrosséis/peças)

Uso: python3 creative-core/gallery/build_gallery.py
Lê gallery.json na mesma pasta e gera index.html autocontido:
navegação por slider (scroll horizontal com snap), comparação lado a lado
(escolha 2 peças) e download dos arquivos exportados.
Assets referenciados por caminho relativo — a galeria é movível/copiável e serve localmente.
"""
import json, html
from pathlib import Path

HERE = Path(__file__).parent

def main():
    reg = json.loads((HERE / "gallery.json").read_text(encoding="utf-8"))
    items = reg.get("items", [])
    cards = []

    def render_caption(v):
        """caption pode ser texto literal ou caminho p/ .md — se caminho existir, lê e linka."""
        p = HERE / v
        if v and (v.endswith(".md") or v.endswith(".txt")) and p.is_file():
            text = html.escape(p.read_text(encoding="utf-8").strip())
            return (f'<a href="{html.escape(v)}">{html.escape(v)}</a>'
                    f'<br><em style="white-space:pre-line">{text}</em>')
        return html.escape(v or "—")

    for i, it in enumerate(items):
        slides = "".join(
            f'<figure><img loading="lazy" src="{html.escape(s.get("thumb",""))}" alt="Slide {n}">'
            f'<figcaption>Slide {n}</figcaption></figure>'
            for n, s in enumerate(it.get("slides", []), 1))
        files = "".join(
            f'<li><a href="{html.escape(f["path"])}" download>⬇ {html.escape(f["name"])}</a></li>'
            for f in it.get("files", []))
        tags = "".join(f'<span class="tag">{html.escape(t)}</span>' for t in it.get("tags", []))
        cards.append(f'''
<article class="card" id="p{i}" data-i="{i}">
  <header><h2>{html.escape(it.get("title","?"))}</h2>
    <div class="meta">{html.escape(it.get("brand","—"))} · {html.escape(it.get("date","—"))} ·
      <span class="status {html.escape(it.get("status","draft"))}">{html.escape(it.get("status","draft"))}</span></div>
    <div class="tags">{tags}</div></header>
  <div class="strip">{slides or '<p class="empty">sem slides registrados</p>'}</div>
  <p class="caption"><strong>Legenda:</strong> {render_caption(it.get("caption",""))}</p>
  <ul class="files">{files or '<li>sem arquivos</li>'}</ul>
</article>''')

    jm = [
        {"i": i, "title": it.get("title", ""), "slides": [s.get("thumb", "") for s in it.get("slides", [])]}
        for i, it in enumerate(items)
    ]
    data = json.dumps(jm, ensure_ascii=False)

    # ---------- HTML head + styles (f-string: só interpolação Python aqui) ----------
    head = f'''<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<title>MOTION — Galeria de Peças</title>
<style>
:root {{ --bg:#0f1014; --panel:#17181d; --ink:#f2f2ee; --muted:#9a9aa4; --acc:#d5a94e; }}
body {{ background:var(--bg); color:var(--ink); font:15px/1.5 system-ui,sans-serif; margin:0 auto; max-width:1200px; padding:24px; }}
header.top h1 {{ font-size:1.4rem; }} header.top p {{ color:var(--muted); }}
.card {{ background:var(--panel); border-radius:14px; padding:18px; margin:22px 0; }}
.card h2 {{ margin:0; font-size:1.1rem; }} .meta {{ color:var(--muted); }}
.status {{ font-weight:700; }} .status.approved {{ color:#7bd88f; }} .status.draft {{ color:var(--acc); }}
.tag {{ border:1px solid #33343c; border-radius:999px; padding:1px 10px; font-size:.75rem; margin-right:6px; color:var(--muted); display:inline-block; }}
.strip {{ display:flex; gap:12px; overflow-x:auto; scroll-snap-type:x mandatory; padding:10px 0; }}
.strip figure {{ scroll-snap-align:start; margin:0; flex:0 0 auto; width:270px; }}
.strip img {{ width:100%; border-radius:8px; display:block; background:#000; }}
figcaption {{ color:var(--muted); font-size:.8rem; text-align:center; padding:4px 0; }}
.caption {{ color:var(--muted); }} .files {{ list-style:none; padding:0; }}
.files a {{ color:var(--acc); text-decoration:none; }}
.compare {{ position:fixed; inset:auto 0 0 0; background:var(--panel); border-top:1px solid #33343c; padding:12px; display:none; gap:16px; align-items:center; }}
.compare.on {{ display:flex; }}
.compare select {{ background:#000; color:var(--ink); border:1px solid #33343c; border-radius:8px; padding:6px; max-width:260px; }}
#cmp {{ display:flex; gap:10px; overflow-x:auto; }}
#cmp img {{ height:240px; border-radius:8px; }}
label {{ color:var(--muted); font-size:.8rem; }}
.empty {{ color:var(--muted); }}
</style>
<header class="top"><h1>🎬 Galeria MOTION</h1><p>{len(items)} peças registradas · comparação e download</p></header>
<main>{"".join(cards)}</main>
<div class="compare" id="bar">
  <strong>⚖️ Comparar:</strong>
  <label>Peça A <select id="selA" onchange="draw()"></select></label>
  <label>Peça B <select id="selB" onchange="draw()"></select></label>
  <div id="cmp"></div>
</div>'''

    # ---------- JavaScript: string PURA (sem f-string) — ${} do JS fica intacto ----------
    script = '''<script>
const D = __DATA__;
const bar = document.getElementById('bar'), cmp = document.getElementById('cmp');
const opts = D.map(p => `<option value="${p.i}">${p.title}</option>`).join('');
selA.innerHTML = opts; selB.innerHTML = opts;
if (D.length > 1) { selA.value = '0'; selB.value = '1'; bar.classList.add('on'); draw(); }
function draw() {
  const a = D[+selA.value], b = D[+selB.value];
  cmp.innerHTML = [...(a?.slides||[]).map(s=>['A',s]), ...(b?.slides||[]).map(s=>['B',s])]
    .map(([g,s]) => `<figure style="margin:0"><img src="${s}"><figcaption>${g} · ${s.split('/').pop()}</figcaption></figure>`).join('');
}
</script></html>'''

    doc = head + "\n" + script.replace("__DATA__", data)
    (HERE / "index.html").write_text(doc, encoding="utf-8")
    print(f"gallery: index.html com {len(items)} peças")

if __name__ == "__main__":
    main()
