#!/usr/bin/env python3
"""Gera site/index.html (pt-BR) e site/en/index.html (en) a partir de page.template.html com foco 100% open-source e avatares do GitHub."""
import re, pathlib, html

ROOT = pathlib.Path(__file__).parent
SITE = ROOT / "site"
URL = "https://motion.mateusarce.dev"
GH = "https://github.com/mateusarcedev/motion-studio"

WAVE = (ROOT / "wave.txt").read_text().strip()

# Catálogo completo do ecossistema e repositórios open-source
ECOSYSTEM = [
    {
        "owner": "mateusarcedev",
        "who": "mateusarcedev",
        "repo": "mateusarcedev/motion-studio",
        "lic": "Apache-2.0",
        "type": "native",
        "initials": "MA",
        "featured": True,
        "desc_pt": "Diretores de estúdio, motores de render determinístico e orquestração criativa multi-formato.",
        "desc_en": "Studio directors, deterministic rendering engines, and multiformat creative orchestration.",
        "skills": ["motion-director", "studio-director", "web-director", "carousel-studio", "story-studio", "feed-studio", "shorts-director", "3d-scene-director"]
    },
    {
        "owner": "emilkowalski",
        "who": "Emil Kowalski",
        "repo": "emilkowalski/skills",
        "lic": "MIT",
        "type": "community",
        "initials": "EK",
        "desc_pt": "Design engineering, física de springs, curvas de easing, interrupções e vocabulário de motion.",
        "desc_en": "Design engineering, spring physics, easing curves, interruptible transitions, and motion vocabulary.",
        "skills": ["animate", "animation-performance", "animation-vocabulary", "apple-design", "emil-design-eng", "find-animation-opportunities", "improve-animations", "prototype", "review-animations"]
    },
    {
        "owner": "heygen-com",
        "who": "HeyGen",
        "repo": "heygen-com/hyperframes",
        "lic": "Apache-2.0",
        "type": "community",
        "initials": "HG",
        "desc_pt": "Motor de render HTML para vídeo, catálogo de ~450 blocos cinematográficos e mixagem de áudio.",
        "desc_en": "HTML-to-video render engine, ~450 cinematic block catalog, and audio mixing pipeline.",
        "skills": ["hyperframes", "hyperframes-cli", "hyperframes-registry", "media-use"]
    },
    {
        "owner": "remotion-dev",
        "who": "Remotion",
        "repo": "remotion-dev/skills",
        "lic": "MIT",
        "type": "community",
        "initials": "RD",
        "desc_pt": "Boas práticas oficiais de vídeo programático em React: timing, legendas, render e mapas.",
        "desc_en": "Official React programmatic video practices: timing, captions, render, and maps.",
        "skills": ["remotion-best-practices", "remotion-captions", "remotion-create", "remotion-docs", "remotion-interactivity", "remotion-render", "remotion-studio", "+5"]
    },
    {
        "owner": "Vincentwei1021",
        "who": "Vincent Wei",
        "repo": "Vincentwei1021/video-shotcraft",
        "lic": "Apache-2.0",
        "type": "community",
        "initials": "VW",
        "desc_pt": "Receitas cinematográficas de câmera 2.5D, cortes no beat e captura de produtos reais.",
        "desc_en": "2.5D cinematic shot recipes, beat-synced cuts, and real product screen capture.",
        "skills": ["video-shotcraft"]
    },
    {
        "owner": "lemomo-ai",
        "who": "LemoLab",
        "repo": "lemomo-ai/lemo-opuscar",
        "lic": "MIT",
        "type": "community",
        "initials": "LM",
        "desc_pt": "59 estilos visuais autorais gerados inteiramente em código (ukiyo-e, aquarela, data storytelling).",
        "desc_en": "59 code-driven film styles (ukiyo-e, watercolor, data storytelling).",
        "skills": ["lemo-opuscar"]
    },
    {
        "owner": "nextlevelbuilder",
        "who": "NextLevelBuilder",
        "repo": "nextlevelbuilder/ui-ux-pro-max-skill",
        "lic": "MIT",
        "type": "community",
        "initials": "NL",
        "desc_pt": "Inteligência de UI/UX: 79 estilos visuais, 192 paletas com contraste e tokens de design.",
        "desc_en": "UI/UX design intelligence: 79 styles, 192 contrast palettes, and design tokens.",
        "skills": ["ui-ux-pro-max", "brand", "design", "design-system", "banner-design", "slides", "ui-styling"]
    },
    {
        "owner": "wheresryan22",
        "who": "Ryan",
        "repo": "wheresryan22/anatomy",
        "lic": "MIT",
        "type": "community",
        "initials": "WR",
        "desc_pt": "Ilustrações técnicas isométricas SVG/WebGL com sombreamento preciso e calma visual.",
        "desc_en": "Crafted isometric SVG/WebGL technical figures with physical shaders and calm motion.",
        "skills": ["anatomy"]
    },
    {
        "owner": "cathrynlavery",
        "who": "Cathryn Lavery",
        "repo": "cathrynlavery/diagram-design",
        "lic": "MIT",
        "type": "community",
        "initials": "CL",
        "desc_pt": "45 tipos de diagramas editoriais em HTML/SVG (arquitetura, sequências, fluxos).",
        "desc_en": "45 editorial diagram styles in HTML/SVG (architecture, sequence, flowcharts).",
        "skills": ["diagram-design"]
    },
    {
        "owner": "latent-spaces",
        "who": "Latent Spaces",
        "repo": "latent-spaces/brag",
        "lic": "MIT",
        "type": "community",
        "initials": "LS",
        "desc_pt": "Filmes de lançamento curtos gerados diretamente da análise do código do projeto.",
        "desc_en": "Short launch films generated directly from analyzing project code.",
        "skills": ["brag"]
    },
    {
        "owner": "heliocosta-dev",
        "who": "Hélio Costa",
        "repo": "heliocosta-dev/revenue-centric-design",
        "lic": "MIT",
        "type": "community",
        "initials": "HC",
        "desc_pt": "Playbook de princípios de UX e psicologia comportamental para interfaces digitais.",
        "desc_en": "Playbook of UX and behavioral psychology principles for digital interfaces.",
        "skills": ["revenue-centric-design"]
    },
    {
        "owner": "mattpocock",
        "who": "Matt Pocock",
        "repo": "mattpocock/skills",
        "lic": "MIT",
        "type": "community",
        "initials": "MP",
        "desc_pt": "Entrevista técnica e refinamento implacável de briefing para alinhamento de escopo.",
        "desc_en": "Technical interview and relentless briefing refinement for scope alignment.",
        "skills": ["grill-me"]
    },
    {
        "owner": "microsoft",
        "who": "Playwright",
        "repo": "microsoft/playwright",
        "lic": "Apache-2.0",
        "type": "engine",
        "initials": "MS",
        "desc_pt": "Automação de navegador headless para captura de frames, render 2x e QA 5-viewport.",
        "desc_en": "Headless browser automation for frame capture, 2x static render, and 5-viewport QA.",
        "skills": ["render_static", "render_frames", "qa_viewports"]
    },
    {
        "owner": "FFmpeg",
        "who": "FFmpeg",
        "repo": "FFmpeg/FFmpeg",
        "lic": "LGPL-2.1+",
        "type": "engine",
        "initials": "FF",
        "desc_pt": "Codificação determinística de vídeo CFR 30fps, multiplexação de áudio e transcodificação.",
        "desc_en": "Deterministic CFR 30fps video encoding, audio multiplexing, and transcoding.",
        "skills": ["assemble_video"]
    }
]

def chips(items):
    return "".join(f'<span class="chip">{html.escape(i)}</span>' for i in items)

def credits_html(lang):
    out = []
    for item in ECOSYSTEM:
        owner = item["owner"]
        who = item["who"]
        repo = item["repo"]
        lic = item.get("lic")
        card_type = item.get("type", "community")
        desc = item["desc_pt"] if lang == "pt-BR" else item["desc_en"]
        initials = item.get("initials", who[:2].upper())
        skills = item.get("skills", [])
        featured = " featured" if item.get("featured") else ""
        url = f"https://github.com/{repo}"
        display_repo = repo

        if card_type == "native":
            type_label = "Skill Nativa (MOTION)" if lang == "pt-BR" else "Native MOTION Skill"
            type_class = "native"
        elif card_type == "engine":
            type_label = "Motor de Render (Core)" if lang == "pt-BR" else "Core Render Engine"
            type_class = "engine"
        else:
            type_label = "Skill da Comunidade" if lang == "pt-BR" else "Community Skill"
            type_class = "community"

        lic_badge = f'<span class="cred-lic">{html.escape(lic)}</span>' if lic else ''
        avatar_url = f"https://github.com/{owner}.png?size=96"
        chips_html = "".join(f'<span class="chip">{html.escape(s)}</span>' for s in skills)

        card_html = f'''    <article class="card cred-card{featured} rv">
      <div class="cred-header">
        <div class="cred-avatar-wrap">
          <img src="{avatar_url}" alt="Avatar de {html.escape(who)}" class="cred-avatar" width="50" height="50" loading="lazy" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';" />
          <div class="cred-fallback" aria-hidden="true">{html.escape(initials)}</div>
        </div>
        <div class="cred-meta">
          <div class="cred-owner-row">
            <span class="cred-who">{html.escape(who)}</span>
            <span class="cred-type-badge {type_class}">{type_label}</span>
          </div>
          <div class="cred-sub-row">
            <a class="cred-repo" href="{url}" target="_blank" rel="noopener">github.com/{html.escape(display_repo)} ↗</a>
            {lic_badge}
          </div>
        </div>
      </div>
      <p class="cred-desc">{html.escape(desc)}</p>
      <div class="cred-chips">{chips_html}</div>
    </article>'''
        out.append(card_html)
    return "\n".join(out), len(ECOSYSTEM)

HEAD = {
    "pt-BR": dict(
        title="MOTION — Framework criativo open source orientado a agentes",
        desc="Framework de desenvolvimento criativo open-source: websites cinematográficos, 3D, vídeo CFR, carrosséis e posts em código reproduzível.",
        og="/assets/og-pt.png", path="/", loc="pt_BR"),
    "en": dict(
        title="MOTION — Open-source agent-powered creative development framework",
        desc="Open-source creative development framework: build cinematic websites, 3D experiences, motion graphics, videos, and social content from code.",
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
    s = re.sub(rf'<span lang="{drop}"[^>]*>.*?</span>', "", s, flags=re.S)
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
print(f"✓ Landing page gerada com sucesso: pt-BR ({len(build('pt-BR'))} bytes), en ({len(build('en'))} bytes)")
