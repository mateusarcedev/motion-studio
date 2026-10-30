import { stat, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
let renderStatic, renderFrames, assembleVideo, buildContactSheet, validateStatic;
try {
  const mod = await import("motion-core");
  renderStatic = mod.renderStatic;
  renderFrames = mod.renderFrames;
  assembleVideo = mod.assembleVideo;
  buildContactSheet = mod.buildContactSheet;
  validateStatic = mod.validateStatic;
} catch {
  const mod = await import("../../motion-core/index.js");
  renderStatic = mod.renderStatic;
  renderFrames = mod.renderFrames;
  assembleVideo = mod.assembleVideo;
  buildContactSheet = mod.buildContactSheet;
  validateStatic = mod.validateStatic;
}

export async function runRender(subcommand, target, out, options = {}) {
  if (!subcommand) {
    console.error("Uso: motion render <static|frames|video|carousel|project> [argumentos...]");
    process.exit(1);
  }

  const sub = subcommand.toLowerCase();

  if (sub === "static") {
    if (!target || !out) {
      console.error("Uso: motion render static <input.html> <output.png> [--width=W] [--height=H] [--scale=N]");
      process.exit(1);
    }
    console.log(`📸 Renderizando HTML estático: ${target} → ${out}`);
    const res = await renderStatic(target, out, {
      width: options.width,
      height: options.height,
      scale: options.scale,
      wait: options.wait,
      frame: options.frame,
      seed: options.seed,
    });
    console.log(res.stdout || "Render estático concluído com sucesso.");
  } else if (sub === "frames") {
    if (!target || !out) {
      console.error("Uso: motion render frames <composition.html> <outdir> [--frames=N] [--fps=30]");
      process.exit(1);
    }
    console.log(`🎬 Renderizando frames determinísticos em lote: ${target} → ${out}`);
    const res = await renderFrames(target, out, {
      frames: options.frames,
      fps: options.fps,
      width: options.width,
      height: options.height,
      scale: options.scale,
      seed: options.seed,
      start: options.start,
      end: options.end,
    });
    console.log(res.stdout || "Frames renderizados com sucesso.");
  } else if (sub === "video") {
    if (!target || !out) {
      console.error("Uso: motion render video <pasta_de_frames> <output.mp4> [--fps=30] [--audio=track]");
      process.exit(1);
    }
    console.log(`🎥 Montando vídeo MP4 CFR 30fps: ${target} → ${out}`);
    const res = await assembleVideo(target, out, {
      fps: options.fps,
      audio: options.audio,
      crf: options.crf,
    });
    console.log(res.stdout || "Vídeo montado com sucesso.");
  } else if (sub === "carousel") {
    if (!target || !out) {
      console.error("Uso: motion render carousel <pasta_de_slides> <outdir>");
      process.exit(1);
    }
    await renderCarousel(target, out, options);
  } else if (sub === "project") {
    await renderProject(target, options);
  } else {
    console.error(`Subcomando de renderização desconhecido: '${subcommand}'. Opções: static, frames, video, carousel, project.`);
    process.exit(1);
  }
}

async function renderCarousel(slidesDir, outDir, options = {}) {
  const absSlides = path.resolve(slidesDir);
  const absOut = path.resolve(outDir);
  await mkdir(absOut, { recursive: true });

  const entries = (await readdir(absSlides)).filter((f) => f.endsWith(".html")).sort();
  if (entries.length === 0) {
    console.error(`Nenhum slide HTML encontrado em ${absSlides}`);
    process.exit(1);
  }

  console.log(`🎠 Renderizando ${entries.length} slides em escala padrão (1080×1350) e retina (2160×2700)...`);

  for (const file of entries) {
    const base = path.parse(file).name;
    const inputHtml = path.join(absSlides, file);
    
    // Scale 1: 1080x1350
    const outPng1x = path.join(absOut, `${base}-1080x1350.png`);
    await renderStatic(inputHtml, outPng1x, { width: 1080, height: 1350, scale: 1 });
    await validateStatic(outPng1x, "1080x1350", 1);

    // Scale 2: 2160x2700
    const outPng2x = path.join(absOut, `${base}-2160x2700.png`);
    await renderStatic(inputHtml, outPng2x, { width: 1080, height: 1350, scale: 2 });
    await validateStatic(outPng2x, "2160x2700", 2);

    console.log(`  ✓ Slide ${base} renderizado e validado.`);
  }

  console.log(`✅ Carrossel completo renderizado em ${absOut}`);
}

async function renderProject(projectDir, options = {}) {
  const absDir = path.resolve(projectDir);
  console.log(`📦 Processando pipeline de projeto em: ${absDir}`);

  // Check if it's a video project (composition.html)
  try {
    await stat(path.join(absDir, "composition.html"));
    console.log("→ Detectado projeto de Vídeo (composition.html). Executando pipeline completo...");
    const framesDir = path.join(absDir, "frames");
    const outDir = path.join(absDir, "out");
    await mkdir(framesDir, { recursive: true });
    await mkdir(outDir, { recursive: true });

    const frames = options.frames || 450;
    const fps = options.fps || 30;

    console.log(`1. Renderizando ${frames} frames...`);
    await renderFrames(path.join(absDir, "composition.html"), framesDir, {
      frames, fps, width: options.width || 1920, height: options.height || 1080, scale: 1
    });

    console.log("2. Gerando contact sheet para revisão...");
    const contactSheetPath = path.join(absDir, "contact-sheet.png");
    try {
      await buildContactSheet(framesDir, contactSheetPath);
    } catch (e) {
      console.warn("Aviso ao gerar contact sheet:", e.message);
    }

    console.log("3. Montando arquivo MP4...");
    const mp4Out = path.join(outDir, `${path.basename(absDir)}.mp4`);
    await assembleVideo(framesDir, mp4Out, { fps, audio: options.audio });

    console.log(`✅ Vídeo do projeto finalizado com sucesso: ${mp4Out}`);
    return;
  } catch {}

  // Check if it's a carousel project (slides/)
  try {
    await stat(path.join(absDir, "slides"));
    console.log("→ Detectado projeto de Carrossel (slides/). Executando pipeline completo...");
    const outDir = path.join(absDir, "out");
    await renderCarousel(path.join(absDir, "slides"), outDir, options);
    return;
  } catch {}

  console.error("Não foi possível inferir o tipo de projeto (nem composition.html nem slides/ encontrados).");
  process.exit(1);
}
