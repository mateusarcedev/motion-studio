let listSkills;
try {
  const mod = await import("motion-studio-skills");
  listSkills = mod.listSkills;
} catch {
  const mod = await import("../../motion-skills/index.js");
  listSkills = mod.listSkills;
}

export async function runList() {
  console.log("==================================================================");
  console.log("             MOTION Studio — Especialidades & Capacidades         ");
  console.log("==================================================================\n");

  const specialties = [
    {
      name: "studio-director",
      title: "Diretor Geral do Estúdio",
      formats: "Campanhas completas, roteamento inteligente",
      desc: "Porta de entrada do estúdio. Interpreta briefing em linguagem natural, seleciona formatos (vídeo, site, carrossel, story) e orquestra departamentos.",
    },
    {
      name: "web-director",
      title: "Diretor de Web Experiences",
      formats: "Landing pages, heros 3D, componentes interativos",
      desc: "Direção técnica de páginas Next.js/Vite, layouts responsivos, micro-interações, acessibilidade e QA automatizado em 5 viewports.",
    },
    {
      name: "motion-director",
      title: "Diretor Cinematográfico de Vídeo",
      formats: "Vídeos 16:9, 9:16, 1:1 (CFR 30fps MP4)",
      desc: "Pipeline de 5 departamentos (Brief → Estilo → Storyboard → Animação determinística → Render → Crítico independente → Reparo).",
    },
    {
      name: "carousel-studio",
      title: "Estúdio de Carrosséis",
      formats: "Instagram / LinkedIn (1080×1350 & 2160×2700)",
      desc: "Design editorial baseado em código HTML/CSS, 5 a 10 slides, exportação PNG de alta resolução e entrega em pacote ZIP.",
    },
    {
      name: "story-studio",
      title: "Estúdio de Stories",
      formats: "Stories estáticos e animados (1080×1920)",
      desc: "Composições verticais respeitando safe-zones nativas de Instagram e WhatsApp com reflow composicional real.",
    },
    {
      name: "feed-studio",
      title: "Estúdio de Feed Social",
      formats: "Cards promocionais, tipográficos e infográficos (1:1 e 4:5)",
      desc: "Composição estática de alta fidelidade visual para anúncios e postagens com grade tipográfica rigorosa.",
    },
    {
      name: "shorts-director",
      title: "Diretor de Shorts Narrados",
      formats: "Vídeos verticais 9:16 com legendas por palavra/beat",
      desc: "Shorts ilustrados com grade CFR 30fps, suporte a narração com timestamps e legenda animada ASS/SRT.",
    },
    {
      name: "3d-scene-director",
      title: "Diretor de Cenas 3D",
      formats: "Modelos GLB otimizados, WebGL, R3F, renders blender",
      desc: "Produção de assets procedurais em Three.js ou Blender (opcional), exportação GLB e integração em heros web interativos.",
    },
  ];

  console.log("### Especialistas de Produção Criativa\n");
  for (const s of specialties) {
    console.log(`- **\`${s.name}\`** (${s.title})`);
    console.log(`  - *Formatos:* ${s.formats}`);
    console.log(`  - *Escopo:* ${s.desc}\n`);
  }

  console.log("### Motores de Execução (Core Engines)\n");
  console.log("- **Renderizador Estático**: `motion render static <html_file> <png_out>`");
  console.log("- **Renderizador de Frames**: `motion render frames <comp_file> <out_dir>`");
  console.log("- **Montador CFR 30fps**: `motion render video <frames_dir> <mp4_out>`");
  console.log("- **QA Multi-Viewport**: `motion qa <url> <out_dir>`");
  console.log("- **Empacotador & Manifesto**: `motion export <target_dir> <out_zip>`");
  console.log("- **Servidor de Preview**: `motion preview <path>`");

  try {
    const all = await listSkills();
    console.log(`\n### Perfis de Instalação de Skills (\`motion init --profile=<perfil>\`)\n`);
    console.log("- **`core`**: Diretores essenciais (`studio-director`, `motion-director`, `web-director`, `brand`, `design`, `design-system`).");
    console.log("- **`web`**: Criação de websites e experiências (`core` + `ui-styling`, `ui-ux-pro-max`, `impeccable`, `animate`, `emil-design-eng`, etc.).");
    console.log("- **`motion`**: Vídeos e animações cinematográficas (`core` + `shorts-director`, `video-shotcraft`, `brag`, `remotion-*`, etc.).");
    console.log("- **`social`**: Carrosséis e posts sociais (`core` + `carousel-studio`, `story-studio`, `feed-studio`, `banner-design`, `slides`).");
    console.log("- **`3d`**: Criação de cenas 3D procedurais (`core` + `3d-scene-director`, `anatomy`, `diagram-design`).");
    console.log("- **`blender`**: Especialistas de modelagem e renderização Blender.");
    console.log("- **`all`**: Instalação completa de todas as 50 skills do ecossistema.\n");
    console.log(`Total de Agent Skills no catálogo: ${all.length} disponíveis.`);
  } catch {}
}
