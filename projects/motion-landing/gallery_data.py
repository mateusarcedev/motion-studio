#!/usr/bin/env python3
"""Definição de dados estruturados e renderizador da Galeria de Criações (Estilo Carrossel Instagram) para o MOTION Studio."""
import html

GALLERY_COLLECTIONS = [
    {
        "id": "travessia-carousel",
        "category_tag": "carousels 3d-web",
        "cat_pt": "Carrossel / 3D Web",
        "cat_en": "Carousel / 3D Web",
        "format_badge": "4:5 · 5 LÂMINAS",
        "format_badge_en": "4:5 · 5 SLIDES",
        "ratio_class": "ratio-4-5",
        "title_pt": "TRAVESSIA — Carrossel Social",
        "title_en": "TRAVESSIA — Social Carousel",
        "desc_pt": "Narrativa visual em 5 lâminas verticais acompanhando a rota do contêiner sob iluminação industrial.",
        "desc_en": "Visual narrative in 5 vertical slides following the container route under industrial lighting.",
        "link_url": "/projects/travessia/",
        "link_url_en": "/en/projects/travessia/",
        "link_label_pt": "Explorar case ↗",
        "link_label_en": "Explore case ↗",
        "slides": [
            {
                "src": "/assets/carga-01/carousel-01.png",
                "width": 1080,
                "height": 1350,
                "caption_pt": "Lâmina 01 / 05 — O Porto e a Chegada",
                "caption_en": "Slide 01 / 05 — The Port and Arrival",
                "alt_pt": "TRAVESSIA carrossel slide 01: O Porto",
                "alt_en": "TRAVESSIA carousel slide 01: The Port"
            },
            {
                "src": "/assets/carga-01/carousel-02.png",
                "width": 1080,
                "height": 1350,
                "caption_pt": "Lâmina 02 / 05 — O Contêiner TRV-01-A",
                "caption_en": "Slide 02 / 05 — The Container TRV-01-A",
                "alt_pt": "TRAVESSIA carrossel slide 02: O Contêiner",
                "alt_en": "TRAVESSIA carousel slide 02: The Container"
            },
            {
                "src": "/assets/carga-01/carousel-03.png",
                "width": 1080,
                "height": 1350,
                "caption_pt": "Lâmina 03 / 05 — A Movimentação Portuária",
                "caption_en": "Slide 03 / 05 — Port Movement",
                "alt_pt": "TRAVESSIA carrossel slide 03: A Movimentação",
                "alt_en": "TRAVESSIA carousel slide 03: Port Movement"
            },
            {
                "src": "/assets/carga-01/carousel-04.png",
                "width": 1080,
                "height": 1350,
                "caption_pt": "Lâmina 04 / 05 — A Estrada e o Transporte",
                "caption_en": "Slide 04 / 05 — The Road and Transit",
                "alt_pt": "TRAVESSIA carrossel slide 04: A Estrada",
                "alt_en": "TRAVESSIA carousel slide 04: The Road"
            },
            {
                "src": "/assets/carga-01/carousel-05.png",
                "width": 1080,
                "height": 1350,
                "caption_pt": "Lâmina 05 / 05 — O Destino e a Entrega",
                "caption_en": "Slide 05 / 05 — Destination and Delivery",
                "alt_pt": "TRAVESSIA carrossel slide 05: O Destino",
                "alt_en": "TRAVESSIA carousel slide 05: Destination"
            }
        ]
    },
    {
        "id": "design-system-carousel",
        "category_tag": "carousels",
        "cat_pt": "Carrossel / Design System",
        "cat_en": "Carousel / Design System",
        "format_badge": "4:5 · 7 LÂMINAS",
        "format_badge_en": "4:5 · 7 SLIDES",
        "ratio_class": "ratio-4-5",
        "title_pt": "Identidade Visual — Design System",
        "title_en": "Visual Identity — Design System",
        "desc_pt": "Deck editorial completo com tokens semânticos, tipografia Geist e hierarquia visual.",
        "desc_en": "Complete editorial slide deck with semantic tokens, Geist typography, and visual hierarchy.",
        "link_url": None,
        "slides": [
            {
                "src": "/assets/carousel-7/01.png",
                "width": 2160,
                "height": 2700,
                "caption_pt": "Lâmina 01 / 07 — Capa da Identidade",
                "caption_en": "Slide 01 / 07 — Identity Cover",
                "alt_pt": "Identidade Visual slide 01: Capa",
                "alt_en": "Visual Identity slide 01: Cover"
            },
            {
                "src": "/assets/carousel-7/02.png",
                "width": 2160,
                "height": 2700,
                "caption_pt": "Lâmina 02 / 07 — Princípios Fundamentais",
                "caption_en": "Slide 02 / 07 — Core Principles",
                "alt_pt": "Identidade Visual slide 02: Princípios",
                "alt_en": "Visual Identity slide 02: Principles"
            },
            {
                "src": "/assets/carousel-7/03.png",
                "width": 2160,
                "height": 2700,
                "caption_pt": "Lâmina 03 / 07 — Tipografia e Escala",
                "caption_en": "Slide 03 / 07 — Typography & Scale",
                "alt_pt": "Identidade Visual slide 03: Tipografia",
                "alt_en": "Visual Identity slide 03: Typography"
            },
            {
                "src": "/assets/carousel-7/04.png",
                "width": 2160,
                "height": 2700,
                "caption_pt": "Lâmina 04 / 07 — Mesmo Sistema, Outro Ritmo",
                "caption_en": "Slide 04 / 07 — Same System, New Rhythm",
                "alt_pt": "Identidade Visual slide 04: Ritmo",
                "alt_en": "Visual Identity slide 04: Rhythm"
            },
            {
                "src": "/assets/carousel-7/05.png",
                "width": 2160,
                "height": 2700,
                "caption_pt": "Lâmina 05 / 07 — Paleta e Contraste",
                "caption_en": "Slide 05 / 07 — Palette & Contrast",
                "alt_pt": "Identidade Visual slide 05: Paleta",
                "alt_en": "Visual Identity slide 05: Palette"
            },
            {
                "src": "/assets/carousel-7/06.png",
                "width": 2160,
                "height": 2700,
                "caption_pt": "Lâmina 06 / 07 — Elementos Gráficos",
                "caption_en": "Slide 06 / 07 — Graphic Elements",
                "alt_pt": "Identidade Visual slide 06: Elementos",
                "alt_en": "Visual Identity slide 06: Elements"
            },
            {
                "src": "/assets/carousel-7/07.png",
                "width": 2160,
                "height": 2700,
                "caption_pt": "Lâmina 07 / 07 — Fechamento do Sistema",
                "caption_en": "Slide 07 / 07 — System Closing",
                "alt_pt": "Identidade Visual slide 07: Fechamento",
                "alt_en": "Visual Identity slide 07: Closing"
            }
        ]
    },
    {
        "id": "brand-details-carousel",
        "category_tag": "carousels",
        "cat_pt": "Carrossel / Brand Story",
        "cat_en": "Carousel / Brand Story",
        "format_badge": "4:5 · 3 LÂMINAS",
        "format_badge_en": "4:5 · 3 SLIDES",
        "ratio_class": "ratio-4-5",
        "title_pt": "Pequenos Detalhes — Nova Identidade",
        "title_en": "Small Details — Brand Identity",
        "desc_pt": "Composição em 3 lâminas explorando ritmo visual, contrastes e design editorial.",
        "desc_en": "3-slide composition exploring visual rhythm, contrasts, and editorial design.",
        "link_url": None,
        "slides": [
            {
                "src": "/assets/nova-identidade/01.png",
                "width": 2160,
                "height": 2700,
                "caption_pt": "Lâmina 01 / 03 — Abertura Editorial",
                "caption_en": "Slide 01 / 03 — Editorial Opening",
                "alt_pt": "Pequenos Detalhes slide 01: Abertura",
                "alt_en": "Small Details slide 01: Opening"
            },
            {
                "src": "/assets/nova-identidade/02.png",
                "width": 2160,
                "height": 2700,
                "caption_pt": "Lâmina 02 / 03 — Detalhes de Composição",
                "caption_en": "Slide 02 / 03 — Composition Details",
                "alt_pt": "Pequenos Detalhes slide 02: Detalhes",
                "alt_en": "Small Details slide 02: Details"
            },
            {
                "src": "/assets/nova-identidade/03.png",
                "width": 2160,
                "height": 2700,
                "caption_pt": "Lâmina 03 / 03 — Conclusão de Marca",
                "caption_en": "Slide 03 / 03 — Brand Conclusion",
                "alt_pt": "Pequenos Detalhes slide 03: Conclusão",
                "alt_en": "Small Details slide 03: Conclusion"
            }
        ]
    },
    {
        "id": "post-reflow-multiratio",
        "category_tag": "posts",
        "cat_pt": "Posts & Feed / Multi-Proporção",
        "cat_en": "Posts & Feed / Multi-Ratio",
        "format_badge": "4 FORMATOS · REFLOW",
        "format_badge_en": "4 RATIOS · REFLOW",
        "ratio_class": "ratio-1-1",
        "title_pt": "Post em 4 Proporções — Reflow Reativo",
        "title_en": "Post in 4 Ratios — Responsive Reflow",
        "desc_pt": "Mesmo sistema gráfico recomposto para 16:9, 4:5, 1:1 e 9:16 sem crop destrutivo.",
        "desc_en": "Same graphic system recomposed for 16:9, 4:5, 1:1, and 9:16 without destructive cropping.",
        "link_url": None,
        "slides": [
            {
                "src": "/assets/post-reflow/reconf-16x9.png",
                "width": 3840,
                "height": 2160,
                "caption_pt": "Formato 16:9 — Horizontal (YouTube / Web)",
                "caption_en": "Ratio 16:9 — Landscape (YouTube / Web)",
                "alt_pt": "Post reflow 16:9 horizontal",
                "alt_en": "Post reflow 16:9 landscape"
            },
            {
                "src": "/assets/post-reflow/reconf-4x5.png",
                "width": 2160,
                "height": 2700,
                "caption_pt": "Formato 4:5 — Vertical (Instagram Feed)",
                "caption_en": "Ratio 4:5 — Portrait (Instagram Feed)",
                "alt_pt": "Post reflow 4:5 vertical",
                "alt_en": "Post reflow 4:5 portrait"
            },
            {
                "src": "/assets/post-reflow/reconf-1x1.png",
                "width": 2160,
                "height": 2160,
                "caption_pt": "Formato 1:1 — Quadrado (Feed Clássico)",
                "caption_en": "Ratio 1:1 — Square (Classic Feed)",
                "alt_pt": "Post reflow 1:1 quadrado",
                "alt_en": "Post reflow 1:1 square"
            },
            {
                "src": "/assets/post-reflow/reconf-9x16.png",
                "width": 2160,
                "height": 3840,
                "caption_pt": "Formato 9:16 — Vertical (Stories & Reels)",
                "caption_en": "Ratio 9:16 — Vertical (Stories & Reels)",
                "alt_pt": "Post reflow 9:16 vertical",
                "alt_en": "Post reflow 9:16 vertical"
            }
        ]
    },
    {
        "id": "state-machines-acts",
        "category_tag": "motion",
        "cat_pt": "Motion Graphics / Explainer Acts",
        "cat_en": "Motion Graphics / Explainer Acts",
        "format_badge": "9:16 · 7 ATOS",
        "format_badge_en": "9:16 · 7 ACTS",
        "ratio_class": "ratio-9-16",
        "title_pt": "Máquinas de Estados — 7 Atos Narrativos",
        "title_en": "State Machines — 7 Narrative Acts",
        "desc_pt": "Sequência visual dos 7 atos conceituais da produção explicativa programática.",
        "desc_en": "Visual sequence of the 7 conceptual acts of the programmatic explainer film.",
        "link_url": "/projects/state-machines/",
        "link_url_en": "/en/projects/state-machines/",
        "link_label_pt": "Explorar case ↗",
        "link_label_en": "Explore case ↗",
        "slides": [
            {
                "src": "/assets/state-machines/act-01-sopa-booleanos.png",
                "width": 1080,
                "height": 1920,
                "caption_pt": "Ato 01 / 07 — Sopa de Booleanos",
                "caption_en": "Act 01 / 07 — Boolean Soup",
                "alt_pt": "Máquinas de Estados Ato 01: Sopa de Booleanos",
                "alt_en": "State Machines Act 01: Boolean Soup"
            },
            {
                "src": "/assets/state-machines/act-02-estados-finitos.png",
                "width": 1080,
                "height": 1920,
                "caption_pt": "Ato 02 / 07 — Estados Finitos",
                "caption_en": "Act 02 / 07 — Finite States",
                "alt_pt": "Máquinas de Estados Ato 02: Estados Finitos",
                "alt_en": "State Machines Act 02: Finite States"
            },
            {
                "src": "/assets/state-machines/act-03-a-transicao.png",
                "width": 1080,
                "height": 1920,
                "caption_pt": "Ato 03 / 07 — A Transição Causal",
                "caption_en": "Act 03 / 07 — The Causal Transition",
                "alt_pt": "Máquinas de Estados Ato 03: A Transição",
                "alt_en": "State Machines Act 03: The Transition"
            },
            {
                "src": "/assets/state-machines/act-04-guardas-logicas.png",
                "width": 1080,
                "height": 1920,
                "caption_pt": "Ato 04 / 07 — Guardas Lógicas",
                "caption_en": "Act 04 / 07 — Logical Guards",
                "alt_pt": "Máquinas de Estados Ato 04: Guardas Lógicas",
                "alt_en": "State Machines Act 04: Logical Guards"
            },
            {
                "src": "/assets/state-machines/act-05-evento-invalido.png",
                "width": 1080,
                "height": 1920,
                "caption_pt": "Ato 05 / 07 — Evento Inválido Repelido",
                "caption_en": "Act 05 / 07 — Illegal Event Deflected",
                "alt_pt": "Máquinas de Estados Ato 05: Evento Inválido",
                "alt_en": "State Machines Act 05: Illegal Event"
            },
            {
                "src": "/assets/state-machines/act-06-ciclo-completo.png",
                "width": 1080,
                "height": 1920,
                "caption_pt": "Ato 06 / 07 — Ciclo Completo (Retry & Success)",
                "caption_en": "Act 06 / 07 — Full Cycle (Retry & Success)",
                "alt_pt": "Máquinas de Estados Ato 06: Ciclo Completo",
                "alt_en": "State Machines Act 06: Full Cycle"
            },
            {
                "src": "/assets/state-machines/act-07-sintese-fsm.png",
                "width": 1080,
                "height": 1920,
                "caption_pt": "Ato 07 / 07 — Síntese e Convergência FSM",
                "caption_en": "Act 07 / 07 — FSM Synthesis & Convergence",
                "alt_pt": "Máquinas de Estados Ato 07: Síntese",
                "alt_en": "State Machines Act 07: Synthesis"
            }
        ]
    },
    {
        "id": "teaser-frames",
        "category_tag": "motion",
        "cat_pt": "Motion Graphics / 16:9 Teaser",
        "cat_en": "Motion Graphics / 16:9 Teaser",
        "format_badge": "16:9 · 2 QUADROS",
        "format_badge_en": "16:9 · 2 FRAMES",
        "ratio_class": "ratio-16-9",
        "title_pt": "Teaser Cinematográfico — Quadros Chave",
        "title_en": "Cinematic Teaser — Keyframes",
        "desc_pt": "Quadros e contact sheet de animação 16:9 sincronizada a 30 FPS CFR com áudio.",
        "desc_en": "Frames and contact sheet of frame-by-frame 30 FPS CFR animation with audio.",
        "link_url": None,
        "slides": [
            {
                "src": "/assets/teaser/teaser-121.jpg",
                "width": 1400,
                "height": 788,
                "caption_pt": "Quadro 121 — Tipografia Cinética em Movimento",
                "caption_en": "Frame 121 — Kinetic Typography in Motion",
                "alt_pt": "Teaser cinematográfico quadro 121",
                "alt_en": "Cinematic teaser frame 121"
            },
            {
                "src": "/assets/teaser/contact-sheet.png",
                "width": 2600,
                "height": 1460,
                "caption_pt": "Contact Sheet — Sequência Completa da Linha do Tempo",
                "caption_en": "Contact Sheet — Complete Timeline Sequence",
                "alt_pt": "Teaser cinematográfico contact sheet",
                "alt_en": "Cinematic teaser contact sheet"
            }
        ]
    },
    {
        "id": "story-safe-zones",
        "category_tag": "posts",
        "cat_pt": "Posts & Stories / 9:16",
        "cat_en": "Posts & Stories / 9:16",
        "format_badge": "9:16 · STORY ESTÁTICO",
        "format_badge_en": "9:16 · STATIC STORY",
        "ratio_class": "ratio-9-16",
        "title_pt": "Story Vertical — Safe Zones",
        "title_en": "Vertical Story — Safe Zones",
        "desc_pt": "Arte vertical 2160×3840 com calibração estrita para interface do Instagram e WhatsApp.",
        "desc_en": "Vertical 2160×3840 artwork calibrated for Instagram and WhatsApp UI safe zones.",
        "link_url": None,
        "slides": [
            {
                "src": "/assets/story-01.jpg",
                "width": 700,
                "height": 1244,
                "caption_pt": "Story Estático 9:16 — Safe Zones Calibradas",
                "caption_en": "Static Story 9:16 — Calibrated Safe Zones",
                "alt_pt": "Story vertical 9:16",
                "alt_en": "Vertical story 9:16"
            }
        ]
    }
]

def render_gallery_html(lang="pt-BR"):
    is_pt = (lang == "pt-BR")
    e = html.escape
    out = []

    for col in GALLERY_COLLECTIONS:
        cid = col["id"]
        cat_tag = col["category_tag"]
        cat_text = col["cat_pt"] if is_pt else col["cat_en"]
        badge_text = col["format_badge"] if is_pt else col["format_badge_en"]
        title_text = col["title_pt"] if is_pt else col["title_en"]
        desc_text = col["desc_pt"] if is_pt else col["desc_en"]
        ratio_cls = col["ratio_class"]
        slides = col["slides"]
        n_slides = len(slides)
        has_multiple = (n_slides > 1)

        link_markup = ""
        if col.get("link_url"):
            url = col["link_url"] if is_pt else col.get("link_url_en", col["link_url"])
            label = col.get("link_label_pt", "Explorar case ↗") if is_pt else col.get("link_label_en", "Explore case ↗")
            link_markup = f'<a href="{e(url)}" class="gcard-link">{e(label)}</a>'

        counter_markup = f'<span class="gcard-counter" aria-live="polite">1 / {n_slides}</span>' if has_multiple else ''

        slides_html = []
        dots_html = []
        for idx, s in enumerate(slides):
            active_cls = " active" if idx == 0 else ""
            caption = s["caption_pt"] if is_pt else s["caption_en"]
            alt = s["alt_pt"] if is_pt else s["alt_en"]
            btn_label = f"Ampliar imagem {idx+1} de {n_slides}" if is_pt else f"Enlarge image {idx+1} of {n_slides}"

            slides_html.append(f'''<div class="gcard-slide{active_cls}" data-slide-index="{idx}">
  <button type="button" class="slide-zoom-btn" aria-label="{e(btn_label)}" data-col-id="{e(cid)}" data-slide-idx="{idx}" data-src="{e(s["src"])}" data-caption="{e(caption)}" data-alt="{e(alt)}">
    <img src="{e(s["src"])}" alt="{e(alt)}" width="{s["width"]}" height="{s["height"]}" loading="lazy" class="slide-img">
    <span class="zoom-indicator" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
    </span>
  </button>
</div>''')

            if has_multiple:
                dot_sel = "true" if idx == 0 else "false"
                dot_act = " active" if idx == 0 else ""
                dot_label = f"Lâmina {idx+1} de {n_slides}" if is_pt else f"Slide {idx+1} of {n_slides}"
                dots_html.append(f'<button type="button" class="gcard-dot{dot_act}" role="tab" aria-selected="{dot_sel}" aria-label="{e(dot_label)}" data-slide-idx="{idx}"></button>')

        nav_markup = ""
        dots_markup = ""
        if has_multiple:
            prev_label = "Imagem anterior" if is_pt else "Previous image"
            next_label = "Próxima imagem" if is_pt else "Next image"
            nav_markup = f'''<button type="button" class="gcard-nav prev" aria-label="{prev_label}" disabled>
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
</button>
<button type="button" class="gcard-nav next" aria-label="{next_label}">
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
</button>'''
            dots_label = "Indicadores de lâminas" if is_pt else "Slide indicators"
            dots_markup = f'<div class="gcard-dots" role="tablist" aria-label="{dots_label}">{"".join(dots_html)}</div>'

        card_label = f"Produção: {title_text}" if is_pt else f"Production: {title_text}"

        out.append(f'''<article class="gallery-card rv" data-category="{e(cat_tag)}" data-prod-id="{e(cid)}" tabindex="0" role="region" aria-roledescription="carousel" aria-label="{e(card_label)}">
  <div class="gcard-header">
    <div class="gcard-meta-row">
      <span class="gcard-cat">{e(cat_text)}</span>
      <span class="gcard-format-pill">{e(badge_text)}</span>
    </div>
    <div class="gcard-title-row">
      <h3 class="gcard-title">{e(title_text)}</h3>
      {counter_markup}
    </div>
  </div>

  <div class="gcard-viewport-wrap {ratio_cls}">
    <div class="gcard-viewport" aria-live="polite">
      <div class="gcard-track">
        {"".join(slides_html)}
      </div>
      {nav_markup}
      {dots_markup}
    </div>
  </div>

  <div class="gcard-footer">
    <p class="gcard-desc">{e(desc_text)}</p>
    {link_markup}
  </div>
</article>''')

    return "\n".join(out)
