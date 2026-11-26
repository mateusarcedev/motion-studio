import { stat } from "node:fs/promises";
import path from "node:path";

let skillsCatalog;
try {
  skillsCatalog = await import("@technomanceer/motion-studio-skills");
} catch {
  try {
    skillsCatalog = await import("../../motion-skills/index.js");
  } catch {
    skillsCatalog = undefined;
  }
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

  console.log("### Especialistas de Produção Criativa (Nativos)\n");
  for (const s of specialties) {
    console.log(`- **\`${s.name}\`** (${s.title})`);
    console.log(`  - *Formatos:* ${s.formats}`);
    console.log(`  - *Escopo:* ${s.desc}\n`);
  }

  console.log("### Motores de Execução (Core Engines)\n");
  console.log("- **Renderizador Estático**: `motion render static <html_file> <png_out>`");
  console.log("- **Renderizador de Frames**: `motion render frames <comp_file> <out_dir>`");
  console.log("- **Montador CFR 30fps**: `motion render video <frames_dir> <mp4_out>`");
  console.log("- **Componentes Reutilizáveis**: `motion components list|render|preview`");
  console.log("- **Overlays Transparentes**: `motion render overlay <html> --output=<overlay.webm>` (VP9 + alpha validado)");
  console.log("- **Transições FFmpeg**: `motion transition list|render|preview` (xfade com easing)");
  console.log("- **QA de Determinismo**: `motion qa determinism <html>` (hashes em duas sessões)");
  console.log("- **QA de Safe Zones**: `motion qa safe-zones <html> --platform=<preset>` (amostrado na timeline)");
  console.log("- **QA Multi-Viewport**: `motion qa <url> <out_dir>`");
  console.log("- **Empacotador & Manifesto**: `motion export <target_dir> <out_zip>`");
  console.log("- **Servidor de Preview**: `motion preview <path>`");

  if (skillsCatalog) {
    const all = await skillsCatalog.listSkills();
    console.log(`\n### Perfis de Instalação de Skills (\`motion init --profile=<perfil>\`)\n`);
    console.log(`Catálogo de distribuição: ${all.length} Skills com licença e proveniência registradas.`);
    console.log("O perfil 'all' instala todas as Skills presentes no pacote público autorizado.\n");

    const integrations = Object.values(skillsCatalog.EXTERNAL_INTEGRATIONS ?? {});
    if (integrations.length) console.log("### Integrações externas opcionais (metadados)\n");
    for (const ci of integrations) {
      if (ci.kind === "mcp-server") {
        console.log(`- **\`${ci.name}\`** — OPCIONAL (servidor MCP externo; descoberta em tempo de execução)`);
        console.log(`  - *Origem:* ${ci.repo}`);
        console.log(`  - *Especialidade:* ${ci.description} (perfil: \`${ci.profile}\`)`);
        console.log(`  - *Acesso/licença:* ${ci.license}\n`);
        continue;
      }
      let isInstalled = false;
      for (const p of [
        path.join(process.cwd(), ".agents", "skills", ci.name),
        path.join(process.cwd(), ".claude", "skills", ci.name),
      ]) {
        try {
          await stat(p);
          isInstalled = true;
          break;
        } catch {}
      }
      const statusBadge = isInstalled ? "✅ INSTALADA LOCALMENTE" : "⚪ DISPONÍVEL (NÃO INSTALADA)";
      console.log(`- **\`${ci.name}\`** — [${statusBadge}]`);
      console.log(`  - *Origem:* ${ci.repo}`);
      console.log(`  - *Especialidade:* ${ci.description} (perfil: \`${ci.profile}\`)`);
      console.log(`  - *Licença/redistribuição:* ${ci.license}`);
      if (ci.installCommand) console.log(`  - *Comando:* \`${ci.installCommand}\`\n`);
    }
  } else {
    console.log("\nCatálogo público opcional não instalado. Os comandos de produção continuam disponíveis.");
    console.log("Instale @technomanceer/motion-studio-skills para consultar e adicionar as Skills liberadas.");
  }
}
