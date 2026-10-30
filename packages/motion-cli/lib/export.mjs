import { stat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
let generateManifest, exportZip;
try {
  const mod = await import("motion-core");
  generateManifest = mod.generateManifest;
  exportZip = mod.exportZip;
} catch {
  const mod = await import("../../motion-core/index.js");
  generateManifest = mod.generateManifest;
  exportZip = mod.exportZip;
}

export async function runExport(targetDir, outZip, options = {}) {
  if (!targetDir || !outZip) {
    console.error("Uso: motion export <pasta_do_projeto> <saida.zip> [--gallery]");
    process.exit(1);
  }

  const absTarget = path.resolve(targetDir);
  const absZip = path.resolve(outZip);

  console.log(`📦 Preparando pacote de entrega para: ${absTarget}`);

  // 1. Generate Manifest
  const manifestPath = path.join(absTarget, "assets.manifest.json");
  console.log("1. Gerando manifesto com somas de verificação SHA-256...");
  await generateManifest(absTarget, manifestPath);
  console.log(`   ✓ Manifesto salvo em ${manifestPath}`);

  // 2. Generate ZIP
  console.log(`2. Empacotando arquivos no arquivo ZIP: ${absZip}...`);
  await exportZip(absTarget, absZip, options.ext || "");
  console.log(`   ✓ Pacote ZIP gerado com sucesso.`);

  // 3. Optional local gallery registration
  if (options.gallery) {
    console.log("3. Registrando item na galeria local (status: draft)...");
    let searchDir = process.cwd();
    let galleryFile = null;

    // Walk up looking for motion.config.json or motion/gallery.json
    for (let i = 0; i < 5; i++) {
      const candidate = path.join(searchDir, "motion", "gallery.json");
      try {
        await stat(candidate);
        galleryFile = candidate;
        break;
      } catch {}
      const parent = path.dirname(searchDir);
      if (parent === searchDir) break;
      searchDir = parent;
    }

    if (galleryFile) {
      try {
        const raw = await readFile(galleryFile, "utf-8");
        const gallery = JSON.parse(raw);
        const itemId = path.basename(absTarget);
        
        const existingIdx = gallery.items.findIndex((it) => it.id === itemId);
        const itemRecord = {
          id: itemId,
          title: options.title || itemId,
          date: new Date().toISOString().split("T")[0],
          status: "draft",
          source: path.relative(path.dirname(path.dirname(galleryFile)), absTarget),
          files: [{ name: path.basename(absZip), path: path.relative(path.dirname(path.dirname(galleryFile)), absZip) }],
        };

        if (existingIdx >= 0) {
          gallery.items[existingIdx] = { ...gallery.items[existingIdx], ...itemRecord };
        } else {
          gallery.items.push(itemRecord);
        }

        await writeFile(galleryFile, JSON.stringify(gallery, null, 2) + "\n", "utf-8");
        console.log(`   ✓ Item '${itemId}' registrado na galeria local (${path.relative(process.cwd(), galleryFile)}) como draft.`);
      } catch (e) {
        console.warn("Aviso ao atualizar galeria local:", e.message);
      }
    } else {
      console.warn("Aviso: galeria local (motion/gallery.json) não encontrada nos diretórios pai.");
    }
  }

  console.log(`\n🎉 Entrega exportada com sucesso: ${absZip}`);
}
