import { mkdir, writeFile, stat, readFile } from "node:fs/promises";
import path from "node:path";

export async function runCreate(type, name, options = {}) {
  if (!type || !name) {
    console.error("Uso: motion create <website|video|carousel|story|post> <nome_do_projeto>");
    process.exit(1);
  }

  const validTypes = ["website", "video", "carousel", "story", "post"];
  if (!validTypes.includes(type.toLowerCase())) {
    console.error(`Tipo inválido '${type}'. Tipos suportados: ${validTypes.join(", ")}`);
    process.exit(1);
  }

  const cwd = process.cwd();
  let baseProjectsDir = path.join(cwd, "motion", "projects");
  try {
    await stat(baseProjectsDir);
  } catch {
    baseProjectsDir = cwd;
  }

  const projectDir = path.join(baseProjectsDir, name);
  try {
    await stat(projectDir);
    if (!options.force) {
      console.error(`❌ O diretório '${projectDir}' já existe. Use --force para sobrescrever.`);
      process.exit(1);
    }
  } catch {}

  await mkdir(projectDir, { recursive: true });

  // Read brand tokens if available
  let brandTokens = {
    color: { primary: "#0F172A", secondary: "#3B82F6", accent: "#10B981", background: "#090D16", surface: "#1E293B", text: "#F8FAFC", muted: "#94A3B8" },
    typography: { headline: { family: "Geist, system-ui, sans-serif" }, body: { family: "Geist, system-ui, sans-serif" } },
  };
  try {
    const rawTokens = await readFile(path.join(cwd, "motion", "brand", "tokens.json"), "utf-8");
    brandTokens = JSON.parse(rawTokens);
  } catch {}

  console.log(`🎨 Criando scaffold de '${type}' em: ${projectDir}`);

  if (type === "website") {
    await scaffoldWebsite(projectDir, name, brandTokens);
  } else if (type === "video") {
    await scaffoldVideo(projectDir, name, brandTokens);
  } else if (type === "carousel") {
    await scaffoldCarousel(projectDir, name, brandTokens);
  } else if (type === "story") {
    await scaffoldStory(projectDir, name, brandTokens);
  } else if (type === "post") {
    await scaffoldPost(projectDir, name, brandTokens);
  }

  console.log(`✅ Projeto '${name}' criado com sucesso em ${projectDir}`);
}

async function scaffoldWebsite(dir, name, tokens) {
  const brief = `# BRIEF — Website Landing Page: ${name}

## Objetivo
Apresentar o produto com hero cinematográfico, narrativa visual imersiva, componente 3D/interativo funcional e alta performance.

## Requisitos de Entrega
1. Layout responsivo auditado em 5 viewports (mobile-s 360, mobile 390, tablet 768, desktop 1280, wide 1920).
2. Elemento 3D / WebGL com fallback gracioso.
3. Touch targets >= 44px em todos os controles interativos.
4. Zero overflow horizontal.
5. Acessibilidade semântica (ARIA, contraste, navegação por teclado).
`;
  await writeFile(path.join(dir, "BRIEF.md"), brief, "utf-8");

  const style = `# STYLE — ${name}

## Paleta de Cores
- Fundo: ${tokens.color?.background || "#090D16"}
- Superfície: ${tokens.color?.surface || "#1E293B"}
- Primária: ${tokens.color?.primary || "#0F172A"}
- Destaque: ${tokens.color?.secondary || "#3B82F6"}
- Acento: ${tokens.color?.accent || "#10B981"}
- Texto: ${tokens.color?.text || "#F8FAFC"}
- Mudo: ${tokens.color?.muted || "#94A3B8"}

## Tipografia
- Títulos: ${tokens.typography?.headline?.family || "Geist, system-ui, sans-serif"}
- Corpo: ${tokens.typography?.body?.family || "Geist, system-ui, sans-serif"}
`;
  await writeFile(path.join(dir, "STYLE.md"), style, "utf-8");

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name} — MOTION Studio Landing</title>
  <meta name="description" content="Landing page de alto impacto criada com o MOTION Studio.">
  <style>
    :root {
      --bg: ${tokens.color?.background || "#090D16"};
      --surface: ${tokens.color?.surface || "#1E293B"};
      --primary: ${tokens.color?.secondary || "#3B82F6"};
      --accent: ${tokens.color?.accent || "#10B981"};
      --text: ${tokens.color?.text || "#F8FAFC"};
      --muted: ${tokens.color?.muted || "#94A3B8"};
      --font: ${tokens.typography?.body?.family || "system-ui, -apple-system, sans-serif"};
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      min-height: 100vh;
      overflow-x: hidden;
      line-height: 1.6;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 50;
      backdrop-filter: blur(16px);
      background: rgba(9, 13, 22, 0.85);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 44px;
      min-width: 44px;
    }
    .logo-badge {
      background: var(--primary);
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 900;
      color: #fff;
    }
    nav a {
      color: var(--muted);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      padding: 12px 16px;
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      min-width: 44px;
    }
    nav a:hover, nav a:focus {
      color: var(--text);
    }
    .hero {
      position: relative;
      padding: 96px 24px 64px;
      max-width: 1200px;
      margin: 0 auto;
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 6px 16px;
      background: rgba(59, 130, 246, 0.12);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 999px;
      color: var(--primary);
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 24px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    h1 {
      font-size: clamp(36px, 6vw, 68px);
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.1;
      margin-bottom: 24px;
    }
    h1 span {
      background: linear-gradient(135deg, var(--text) 30%, var(--primary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p.lead {
      font-size: clamp(16px, 2vw, 20px);
      color: var(--muted);
      max-width: 680px;
      margin: 0 auto 36px;
    }
    .actions {
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .btn {
      min-height: 48px;
      min-width: 48px;
      padding: 12px 28px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-primary {
      background: var(--primary);
      color: #fff;
    }
    .btn-secondary {
      background: var(--surface);
      color: var(--text);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .canvas-container {
      margin: 48px auto 0;
      max-width: 800px;
      height: 380px;
      background: radial-gradient(circle at center, rgba(30, 41, 59, 0.6) 0%, transparent 70%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    .features {
      max-width: 1200px;
      margin: 80px auto;
      padding: 0 24px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
    }
    .card {
      background: var(--surface);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 32px;
    }
    .card h3 {
      font-size: 20px;
      margin-bottom: 12px;
      color: var(--text);
    }
    .card p {
      color: var(--muted);
      font-size: 15px;
    }
  </style>
</head>
<body>
  <header>
    <a href="#" class="logo">
      <span class="logo-badge">M</span>
      <span>${name}</span>
    </a>
    <nav>
      <a href="#features">Recursos</a>
      <a href="#demo">Demonstração</a>
      <a href="#contact">Contato</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <span class="badge">MOTION Studio Experience</span>
      <h1>Criado para converter.<br><span>Dirigido por código.</span></h1>
      <p class="lead">Uma landing page cinematográfica com elemento interativo, design responsivo certificado em 5 viewports e acessibilidade nativa.</p>
      <div class="actions">
        <a href="#demo" class="btn btn-primary">Experimentar agora</a>
        <a href="#features" class="btn btn-secondary">Ver especificações</a>
      </div>

      <div class="canvas-container" id="demo">
        <canvas id="hero-canvas"></canvas>
      </div>
    </section>

    <section id="features" class="features">
      <article class="card">
        <h3>Design Cinematográfico</h3>
        <p>Direção de arte precisa com paleta harmonizada e tipografia escalonada.</p>
      </article>
      <article class="card">
        <h3>5 Viewports Verificados</h3>
        <p>Garantia de layout impecável de 360px a 1920px sem quebras ou scroll indesejado.</p>
      </article>
      <article class="card">
        <h3>Determinismo & Performance</h3>
        <p>Zero dependências supérfluas e execução suave em 60 frames por segundo.</p>
      </article>
    </section>
  </main>

  <script>
    // Canvas procedural de demonstração (Three.js ou 2D context leve)
    const canvas = document.getElementById('hero-canvas');
    const ctx = canvas.getContext('2d');
    function resize() {
      canvas.width = canvas.parentElement.clientWidth * window.devicePixelRatio;
      canvas.height = canvas.parentElement.clientHeight * window.devicePixelRatio;
    }
    resize();
    window.addEventListener('resize', resize);

    let angle = 0;
    function draw() {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      
      const cx = w / 2, cy = h / 2;
      const radius = Math.min(w, h) * 0.28;
      
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      
      // Anel externo
      ctx.strokeStyle = '${tokens.color?.secondary || "#3B82F6"}';
      ctx.lineWidth = 4 * window.devicePixelRatio;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Ponto de satélite
      ctx.fillStyle = '${tokens.color?.accent || "#10B981"}';
      ctx.beginPath();
      ctx.arc(radius * Math.cos(angle * 2), radius * Math.sin(angle * 2), 12 * window.devicePixelRatio, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      angle += 0.02;
      requestAnimationFrame(draw);
    }
    draw();
  </script>
</body>
</html>
`;
  await writeFile(path.join(dir, "index.html"), html, "utf-8");
}

async function scaffoldVideo(dir, name, tokens) {
  const brief = `# BRIEF — Vídeo Cinematográfico: ${name}

## Especificação
- Duração: 15 segundos (450 frames a 30 FPS).
- Resolução: 1920×1080 (Horizontal 16:9) ou 1080×1920 (Vertical 9:16).
- Determinismo: Frame-driven via \`frame.js\`, CFR 30fps sem desvio temporal.
- Pipeline: \`render_frames.mjs\` → Contact Sheet → Crítico → \`assemble_video.py\`.
`;
  await writeFile(path.join(dir, "BRIEF.md"), brief, "utf-8");

  const storyboard = `# STORYBOARD — ${name}

| Cena | Frames | Tempo | Ação Narrativa | Elementos Visuais |
|---|---|---|---|---|
| **1 · Abertura** | 0–90 | 0.0s–3.0s | Revelação do produto e kicker | Fade in com escala do logo, orbe de luz |
| **2 · Proposta** | 91–210 | 3.0s–7.0s | Apresentação dos pilares centrais | Headline escalando com bezier cúbico |
| **3 · Demonstração** | 211–330 | 7.0s–11.0s | Exibição de recursos técnicos | 3 métricas em cascata com atraso (stagger) |
| **4 · Desfecho & CTA** | 331–450 | 11.0s–15.0s | Assinatura e chamada de ação final | Card de fechamento e botão de ação pulsante |
`;
  await writeFile(path.join(dir, "STORYBOARD.md"), storyboard, "utf-8");

  const composition = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <style>
    :root {
      --bg: ${tokens.color?.background || "#090D16"};
      --surface: ${tokens.color?.surface || "#1E293B"};
      --primary: ${tokens.color?.secondary || "#3B82F6"};
      --accent: ${tokens.color?.accent || "#10B981"};
      --text: ${tokens.color?.text || "#F8FAFC"};
      --muted: ${tokens.color?.muted || "#94A3B8"};
      --font: ${tokens.typography?.headline?.family || "Geist, system-ui, sans-serif"};
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      width: 1920px;
      height: 1080px;
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      overflow: hidden;
      position: relative;
    }
    .background-grid {
      position: absolute;
      inset: 0;
      background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 60px 60px;
    }
    .orb {
      position: absolute;
      width: 700px;
      height: 700px;
      border-radius: 50%;
      background: radial-gradient(circle, var(--primary) 0%, transparent 70%);
      opacity: 0.25;
      top: -150px;
      right: 150px;
      pointer-events: none;
    }
    .container {
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 0 160px;
    }
    .kicker {
      font-size: 32px;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: var(--primary);
      font-weight: 700;
      margin-bottom: 24px;
      opacity: 0;
    }
    h1 {
      font-size: 96px;
      line-height: 1.05;
      font-weight: 800;
      max-width: 1200px;
      margin-bottom: 32px;
      opacity: 0;
    }
    .lead {
      font-size: 36px;
      color: var(--muted);
      max-width: 900px;
      opacity: 0;
      margin-bottom: 48px;
    }
    .cta-box {
      display: inline-flex;
      align-items: center;
      gap: 16px;
      background: var(--surface);
      border: 2px solid rgba(255,255,255,0.12);
      padding: 24px 48px;
      border-radius: 999px;
      font-size: 32px;
      font-weight: 700;
      opacity: 0;
      width: fit-content;
    }
  </style>
  <script type="module">
    // Frame driver determinístico embutido para portabilidade
    function createDriver(M) {
      const fps = M.fps || 30;
      const frame = M.frame || 0;
      const total = M.totalFrames || 450;
      const t = frame / fps;
      const ease = {
        outCubic: (p) => 1 - Math.pow(1 - p, 3),
        outBack: (p) => 1 + 2.7 * Math.pow(p - 1, 3) + 1.7 * Math.pow(p - 1, 2),
      };
      const window010 = (s, inDur, outDur = inDur, hold = 0) => {
        const inP = Math.min(1, Math.max(0, (t - s) / inDur));
        const outP = Math.min(1, Math.max(0, (t - (s + inDur + hold)) / outDur));
        return { in: ease.outCubic(inP), out: ease.outCubic(outP) };
      };
      return { t, frame, fps, total, ease, window010 };
    }

    const el = (s) => document.querySelector(s);
    const st = (node, css) => Object.assign(node.style, css);

    window.__onFrame__ = (M) => {
      const d = createDriver(M);

      // Cena 1 (0.2s - 3.5s)
      const k = d.window010(0.2, 0.8, 0.5, 2.5);
      st(el('.kicker'), { opacity: k.in, transform: \`translateY(\${(1 - k.in) * 20}px)\` });

      // Headline (0.6s - 10.0s)
      const h = d.window010(0.6, 1.0, 0.6, 9.0);
      st(el('h1'), { opacity: h.in, transform: \`translateY(\${(1 - h.in) * 40}px)\` });

      // Lead (1.4s - 10.0s)
      const l = d.window010(1.4, 0.8, 0.6, 8.0);
      st(el('.lead'), { opacity: l.in, transform: \`translateY(\${(1 - l.in) * 30}px)\` });

      // CTA Final (10.5s - 14.8s)
      const c = d.window010(10.5, 0.8, 0.5, 3.5);
      st(el('.cta-box'), {
        opacity: c.in,
        transform: \`scale(\${0.8 + 0.2 * d.ease.outBack(c.in)})\`
      });

      // Orbe sutil
      const orbX = Math.sin(d.t * 1.5) * 40;
      st(el('.orb'), { transform: \`translate(\${orbX}px, 0)\` });
    };

    if (!window.__MOTION_DRIVEN__) {
      window.__onFrame__({ frame: 0, fps: 30, totalFrames: 450 });
    }
  </script>
</head>
<body>
  <div class="background-grid"></div>
  <div class="orb"></div>
  <div class="container">
    <div class="kicker">Demonstração Exclusiva</div>
    <h1>${name} — Excelência Audiovisual por Código</h1>
    <p class="lead">15 segundos determinísticos a 30 FPS. Cada frame reproduzível com fidelidade absoluta de ponta a ponta.</p>
    <div class="cta-box">Acesse: motion.studio/demo</div>
  </div>
</body>
</html>
`;
  await writeFile(path.join(dir, "composition.html"), composition, "utf-8");
}

async function scaffoldCarousel(dir, name, tokens) {
  const slidesDir = path.join(dir, "slides");
  await mkdir(slidesDir, { recursive: true });

  const brief = `# BRIEF — Carrossel de 5 Slides: ${name}

## Especificação
- Formato: 1080×1350 (4:5 Retrato Instagram/LinkedIn) e 2160×2700 (Scale 2).
- Quantidade: 5 slides autônomos e integrados em narrativa progressiva.
- Fontes: HTML editável com design system compartilhado.
`;
  await writeFile(path.join(dir, "BRIEF.md"), brief, "utf-8");

  const caption = `🚀 Conheça ${name}: a nova fronteira em design e movimento dirigido por inteligência artificial.

Neste carrossel de 5 lâminas, desvendamos:
1. O manifesto do produto
2. A tecnologia sob o capô
3. Três pilares de diferenciação
4. Evidências de qualidade
5. Próximos passos para implementar

Salve este post e compartilhe com seu time de engenharia e produto! 📌
#motion #design #creativeengineering #typescript #automation
`;
  await writeFile(path.join(dir, "caption.md"), caption, "utf-8");

  const slideTitles = [
    { num: 1, kicker: "Manifesto 01", title: `${name}`, desc: "A revolução do design de produto operado por código determinístico." },
    { num: 2, kicker: "Arquitetura 02", title: "Portabilidade Real", desc: "Do monorepo ao projeto consumidor sem atalhos ou dependências ocultas." },
    { num: 3, kicker: "Determinismo 03", title: "Frame a Frame", desc: "Cada quadro é uma função pura do tempo. Zero variações aleatórias." },
    { num: 4, kicker: "Multi-Viewport 04", title: "5 Telas Verificadas", desc: "Do celular ultra-compacto (360px) à tela de 1920px com touch targets auditados." },
    { num: 5, kicker: "Próximo Passo 05", title: "Comece Hoje", desc: "Adicione o MOTION Studio ao seu workflow em segundos com npx motion init." },
  ];

  for (const s of slideTitles) {
    const slideHtml = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <style>
    :root {
      --bg: ${tokens.color?.background || "#090D16"};
      --surface: ${tokens.color?.surface || "#1E293B"};
      --primary: ${tokens.color?.secondary || "#3B82F6"};
      --accent: ${tokens.color?.accent || "#10B981"};
      --text: ${tokens.color?.text || "#F8FAFC"};
      --muted: ${tokens.color?.muted || "#94A3B8"};
      --font: ${tokens.typography?.headline?.family || "Geist, system-ui, sans-serif"};
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      width: 1080px;
      height: 1350px;
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      padding: 96px 80px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      position: relative;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid rgba(255,255,255,0.08);
      padding-bottom: 32px;
    }
    .brand-tag {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--primary);
    }
    .slide-num {
      font-size: 20px;
      font-weight: 600;
      color: var(--muted);
      background: var(--surface);
      padding: 8px 20px;
      border-radius: 999px;
    }
    .middle {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .kicker {
      font-size: 28px;
      color: var(--accent);
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 76px;
      line-height: 1.1;
      font-weight: 800;
      margin-bottom: 36px;
      letter-spacing: -0.02em;
    }
    p {
      font-size: 34px;
      line-height: 1.45;
      color: var(--muted);
      max-width: 880px;
    }
    .bottom {
      border-top: 2px solid rgba(255,255,255,0.08);
      padding-top: 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 22px;
      color: var(--muted);
    }
    .swipe {
      color: var(--text);
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 12px;
    }
  </style>
</head>
<body>
  <div class="top">
    <div class="brand-tag">${name}</div>
    <div class="slide-num">0${s.num} / 05</div>
  </div>
  <div class="middle">
    <div class="kicker">${s.kicker}</div>
    <h1>${s.title}</h1>
    <p>${s.desc}</p>
  </div>
  <div class="bottom">
    <div>MOTION Studio — Multiformat</div>
    <div class="swipe">${s.num === 5 ? "Concluir ✓" : "Deslize para o lado →"}</div>
  </div>
</body>
</html>
`;
    await writeFile(path.join(slidesDir, `0${s.num}.html`), slideHtml, "utf-8");
  }
}

async function scaffoldStory(dir, name, tokens) {
  // Simple vertical 1080x1920 layout
  await writeFile(path.join(dir, "BRIEF.md"), `# Story: ${name}`, "utf-8");
}

async function scaffoldPost(dir, name, tokens) {
  // Simple square 1080x1080 layout
  await writeFile(path.join(dir, "BRIEF.md"), `# Post: ${name}`, "utf-8");
}
