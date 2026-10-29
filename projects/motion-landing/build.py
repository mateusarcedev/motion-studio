#!/usr/bin/env python3
"""Gera site/index.html (pt-BR) e site/en/index.html (en) a partir de page.template.html."""
import re, pathlib, html

ROOT = pathlib.Path(__file__).parent
SITE = ROOT / "site"
URL = "https://motion.mateusarce.dev"
GH = "https://github.com/mateusarcedev/motion-studio"

WAVE = (ROOT / "wave.txt").read_text().strip()

# (autor, repo, licença, skills)
CREDITS = [
    ("Emil Kowalski", "emilkowalski/skills", "MIT", ["animate", "animation-performance", "animation-vocabulary", "apple-design", "emil-design-eng", "find-animation-opportunities", "improve-animations", "prototype", "review-animations"]),
    ("HeyGen", "heygen-com/hyperframes", "Apache-2.0", ["hyperframes", "hyperframes-cli", "hyperframes-registry", "media-use"]),
    ("Remotion", "remotion-dev/skills", None, ["remotion-best-practices", "remotion-create", "remotion-render", "remotion-studio", "remotion-captions", "remotion-docs", "+6"]),
    ("Matt Pocock", "mattpocock/skills", "MIT", ["tdd", "triage", "to-spec", "implement", "handoff", "grill-me", "+31"]),
    ("lemomo-ai", "lemomo-ai/lemo-opuscar", "MIT", ["lemo-opuscar"]),
    ("Vincentwei1021", "Vincentwei1021/video-shotcraft", "Apache-2.0", ["video-shotcraft"]),
    ("cathrynlavery", "cathrynlavery/diagram-design", "MIT", ["diagram-design"]),
    ("wheresryan22", "wheresryan22/anatomy", "MIT", ["anatomy"]),
    ("latent-spaces", "latent-spaces/brag", "MIT", ["brag"]),
    ("heliocosta-dev", "heliocosta-dev/revenue-centric-design", None, ["revenue-centric-design"]),
]
OWN = ["motion-director", "studio-director", "carousel-studio", "story-studio", "feed-studio", "shorts-director", "3d-scene-director"]
TOOLS = [("Playwright", "https://github.com/microsoft/playwright", "Apache-2.0"), ("FFmpeg", "https://ffmpeg.org", None)]

def chips(items):
    return "".join(f'<span class="chip">{html.escape(i)}</span>' for i in items)

def credits_html(lang):
    out = []
    own_t = "skills do próprio MOTION" if lang == "pt-BR" else "MOTION's own skills"
    out.append(f'    <div class="card cred featured rv"><span class="who">mateusarcedev</span><a class="repo" href="{GH}" rel="noopener">github.com/mateusarcedev/motion-studio ↗</a><span class="lic">{own_t}</span><div class="chips">{chips(OWN)}</div></div>')
    for who, repo, lic, skills in CREDITS:
        l = f'<span class="lic">{lic}</span>' if lic else ""
        out.append(f'    <div class="card cred rv"><span class="who">{html.escape(who)}</span><a class="repo" href="https://github.com/{repo}" rel="noopener">github.com/{repo} ↗</a>{l}<div class="chips">{chips(skills)}</div></div>')
    t = "motores de render" if lang == "pt-BR" else "render engines"
    tl = "".join(f'<a class="chip" href="{u}" rel="noopener">{n}{" · "+li if li else ""} ↗</a>' for n, u, li in TOOLS)
    out.append(f'    <div class="card cred rv"><span class="who">{t}</span><span class="lic">Chromium · Node</span><div class="chips">{tl}</div></div>')
    return "\n".join(out), len(CREDITS) + 2

HEAD = {
    "pt-BR": dict(
        title="MOTION — Estúdio criativo open source com IA",
        desc="Estúdio criativo multiformato open source, operado por agentes: vídeo, carrosséis, stories, posts e shorts em código — determinístico, editável, auditável.",
        og="/assets/og-pt.png", path="/", loc="pt_BR"),
    "en": dict(
        title="MOTION — Open-source AI creative studio",
        desc="Open-source multiformat creative studio operated by agents: video, carousels, stories, posts and shorts as code — deterministic, editable, auditable.",
        og="/assets/og-en.png", path="/en/", loc="en_US"),
}

def head(lang):
    h = HEAD[lang]; e = html.escape
    return f'''<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(h["title"])}</title>
<meta name="description" content="{e(h["desc"])}">
<link rel="canonical" href="{URL}{h["path"]}">
<link rel="alternate" hreflang="pt-BR" href="{URL}/">
<link rel="alternate" hreflang="en" href="{URL}/en/">
<link rel="alternate" hreflang="x-default" href="{URL}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="MOTION">
<meta property="og:title" content="{e(h["title"])}">
<meta property="og:description" content="{e(h["desc"])}">
<meta property="og:url" content="{URL}{h["path"]}">
<meta property="og:image" content="{URL}{h["og"]}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="{h["loc"]}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(h["title"])}">
<meta name="twitter:description" content="{e(h["desc"])}">
<meta name="twitter:image" content="{URL}{h["og"]}">
<meta name="theme-color" content="#0e0e0e">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/Geist.woff" as="font" type="font/woff" crossorigin>
<link rel="preload" href="/fonts/GeistMono.woff" as="font" type="font/woff" crossorigin>'''

def build(lang):
    s = (ROOT / "page.template.html").read_text()
    drop = "en" if lang == "pt-BR" else "pt-BR"
    cred, n = credits_html(lang)
    s = s.replace("{{CREDITS}}", cred).replace("{{NCRED}}", f"{n:02d}")
    s = re.sub(rf'<span lang="{drop}">.*?</span>', "", s, flags=re.S)
    s = re.sub(r"@@(.*?)::(.*?)@@", lambda m: m.group(1 if lang == "pt-BR" else 2), s)
    s = s.replace("{{HEAD}}", head(lang)).replace("{{LANG}}", lang).replace("{{GH}}", GH).replace("{{WAVE}}", WAVE)
    assert "{{" not in s and "@@" not in s
    return s

(SITE).mkdir(exist_ok=True); (SITE / "en").mkdir(exist_ok=True)
(SITE / "index.html").write_text(build("pt-BR"))
(SITE / "en" / "index.html").write_text(build("en"))
(SITE / "sitemap.xml").write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url><loc>{URL}/</loc><xhtml:link rel="alternate" hreflang="pt-BR" href="{URL}/"/><xhtml:link rel="alternate" hreflang="en" href="{URL}/en/"/><xhtml:link rel="alternate" hreflang="x-default" href="{URL}/"/></url>
  <url><loc>{URL}/en/</loc><xhtml:link rel="alternate" hreflang="pt-BR" href="{URL}/"/><xhtml:link rel="alternate" hreflang="en" href="{URL}/en/"/><xhtml:link rel="alternate" hreflang="x-default" href="{URL}/"/></url>
</urlset>
''')
(SITE / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {URL}/sitemap.xml\n")
print("built", len(build("pt-BR")), len(build("en")))
