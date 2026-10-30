import path from "node:path";
let qaViewports;
try {
  const mod = await import("motion-core");
  qaViewports = mod.qaViewports;
} catch {
  const mod = await import("../../motion-core/index.js");
  qaViewports = mod.qaViewports;
}

export async function runQA(urlOrHtml, outdir, options = {}) {
  if (!urlOrHtml || !outdir) {
    console.error("Uso: motion qa <url_ou_html> <diretorio_de_saida> [--wait=ms]");
    process.exit(1);
  }

  console.log(`🔍 Executando QA multi-viewport em 5 telas para: ${urlOrHtml}`);
  console.log(`Saída de relatórios e capturas: ${outdir}`);

  const res = await qaViewports(urlOrHtml, outdir, {
    wait: options.wait,
    canvas: options.canvas,
    ignore: options.ignore,
  });

  console.log(res.stdout || "QA multi-viewport concluído.");
}
