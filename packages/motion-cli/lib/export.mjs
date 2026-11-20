import { stat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
let exportDelivery;
try {
  const mod = await import("@technomanceer/motion-core");
  exportDelivery = mod.exportDelivery;
} catch {
  const mod = await import("../../motion-core/index.js");
  exportDelivery = mod.exportDelivery;
}

export async function runExport(targetDir, outZip, options = {}) {
  if (!targetDir || !outZip) {
    console.error("Uso: motion export <pasta_do_projeto> <saida.zip> [--gallery]");
    process.exit(1);
  }

  const absTarget = path.resolve(targetDir);
  const absZip = path.resolve(outZip);

  console.log(`📦 Preparando pacote de entrega para: ${absTarget}`);

  // One delivery pipeline owns contract validation, manifest, ZIP creation and ZIP verification.
  console.log(`📦 Gerando manifesto, empacotando e verificando o ZIP real: ${absZip}...`);
  const result = await exportDelivery(absTarget, absZip);
  const report = result.report;
  if (report?.status !== "PASS") {
    console.error(JSON.stringify(report ?? { status: "FAIL", error: result.stderr || result.stdout }, null, 2));
    process.exitCode = report?.status === "BLOCKED" ? 3 : 2;
    return;
  }
  console.log(`✓ Entrega verificada: ${report.files} arquivos; SHA-256 e CRC conferidos.`);

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
