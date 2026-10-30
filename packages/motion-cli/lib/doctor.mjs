import { execSync } from "node:child_process";
import { stat, readdir } from "node:fs/promises";
import path from "node:path";

export async function runDoctor() {
  console.log("=========================================");
  console.log("       MOTION Studio — Doctor Check      ");
  console.log("=========================================\n");

  const results = [];

  // 1. Node.js
  const nodeVer = process.version;
  const nodeMajor = parseInt(nodeVer.replace("v", "").split(".")[0], 10);
  results.push({
    name: "Node.js",
    required: true,
    status: nodeMajor >= 18 ? "PASS" : "FAIL",
    version: nodeVer,
    details: nodeMajor >= 18 ? "Compatível (>= 18.0.0)" : "Versão mínima 18 exigida",
  });

  // 2. Python 3
  let pyVer = "Não encontrado";
  let pyStatus = "FAIL";
  try {
    pyVer = execSync("python3 --version", { encoding: "utf-8" }).trim();
    pyStatus = "PASS";
  } catch {}
  results.push({
    name: "Python 3",
    required: true,
    status: pyStatus,
    version: pyVer,
    details: pyStatus === "PASS" ? "Motor para manifestos, contact sheets e FFmpeg wrapper" : "Instale python3 no sistema",
  });

  // 3. FFmpeg
  let ffmpegVer = "Não encontrado";
  let ffmpegStatus = "FAIL";
  try {
    const raw = execSync("ffmpeg -version", { encoding: "utf-8" });
    ffmpegVer = raw.split("\n")[0].trim();
    ffmpegStatus = "PASS";
  } catch {}
  results.push({
    name: "FFmpeg",
    required: true,
    status: ffmpegStatus,
    version: ffmpegVer,
    details: ffmpegStatus === "PASS" ? "Montagem CFR 30fps, áudio e transcodificação" : "Instale ffmpeg via apt ou brew",
  });

  // 4. Playwright & Chromium
  let chromePath = null;
  let chromeStatus = "FAIL";
  if (process.env.CHROME_PATH) {
    try {
      await stat(process.env.CHROME_PATH);
      chromePath = process.env.CHROME_PATH;
      chromeStatus = "PASS";
    } catch {}
  }
  if (!chromePath) {
    try {
      const pw = await import("playwright-core");
      const ep = pw.chromium.executablePath();
      if (ep) {
        await stat(ep);
        chromePath = ep;
        chromeStatus = "PASS";
      }
    } catch {}
  }
  if (!chromePath) {
    const cacheBase = `${process.env.HOME}/.cache/ms-playwright`;
    try {
      const entries = await readdir(cacheBase);
      for (const ent of entries) {
        if (ent.startsWith("chromium-")) {
          const candidate = path.join(cacheBase, ent, "chrome-linux64", "chrome");
          try {
            await stat(candidate);
            chromePath = candidate;
            chromeStatus = "PASS";
            break;
          } catch {}
        }
      }
    } catch {}
  }
  if (!chromePath) {
    for (const sys of ["/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"]) {
      try {
        await stat(sys);
        chromePath = sys;
        chromeStatus = "PASS";
        break;
      } catch {}
    }
  }

  results.push({
    name: "Chromium (Playwright)",
    required: true,
    status: chromeStatus,
    version: chromePath ? path.basename(chromePath) : "Não detectado",
    details: chromePath ? `Executável: ${chromePath}` : "Execute `npx playwright install chromium`",
  });

  // 5. Three.js (Procedural / 3D)
  let threeStatus = "WARN";
  let threeVer = "Não instalado";
  try {
    const three = await import("three");
    threeVer = three.REVISION ? `r${three.REVISION}` : "Presente";
    threeStatus = "PASS";
  } catch {
    try {
      const p = await import(path.join(process.cwd(), "node_modules", "three", "package.json"), { assert: { type: "json" } });
      threeVer = p.default.version;
      threeStatus = "PASS";
    } catch {}
  }
  results.push({
    name: "Three.js (3D Procedural)",
    required: false,
    status: threeStatus,
    version: threeVer,
    details: threeStatus === "PASS" ? "Motor procedural 3D e exportação GLB disponível" : "Opcional (necessário para cenas 3D e WebGL)",
  });

  // 6. Blender (Optional External Tool)
  let blenderVer = "Não detectado";
  let blenderStatus = "INFO";
  try {
    const raw = execSync("blender --version", { encoding: "utf-8" });
    blenderVer = raw.split("\n")[0].trim();
    blenderStatus = "PASS";
  } catch {}
  results.push({
    name: "Blender (Opcional)",
    required: false,
    status: blenderStatus,
    version: blenderVer,
    details: blenderStatus === "PASS" ? "Ferramenta 3D externa disponível para exportação CLI/MCP" : "Opcional (Three.js cobre geração procedural sem Blender)",
  });

  // 7. Chatterbox TTS (Optional Audio Tool)
  let chatterboxStatus = "INFO";
  let chatterboxVer = "Não instalado";
  try {
    execSync("python3 -c 'import chatterbox'", { stdio: "ignore" });
    chatterboxVer = "Instalado";
    chatterboxStatus = "PASS";
  } catch {}
  results.push({
    name: "Chatterbox TTS (Opcional)",
    required: false,
    status: chatterboxStatus,
    version: chatterboxVer,
    details: chatterboxStatus === "PASS" ? "Síntese vocal disponível (com model card auditado)" : "Opcional (shorts utilizam fallback silencioso com legendas)",
  });

  // Display Table
  console.log("| Componente | Obrigatório | Status | Versão / Caminho | Observações |");
  console.log("|---|---|---|---|---|");
  for (const r of results) {
    const badge = r.status === "PASS" ? "✅ PASS" : r.status === "FAIL" ? "❌ FAIL" : r.status === "WARN" ? "⚠️ WARN" : "ℹ️ INFO";
    console.log(`| **${r.name}** | ${r.required ? "Sim" : "Não"} | ${badge} | ${r.version} | ${r.details} |`);
  }

  const hasFail = results.some((r) => r.required && r.status === "FAIL");
  console.log("\n-----------------------------------------");
  if (hasFail) {
    console.error("❌ O MOTION Studio encontrou dependências obrigatórias ausentes. Resolva os itens marcados com FAIL.");
    process.exit(1);
  } else {
    console.log("✅ Todas as dependências obrigatórias estão operacionais. O estúdio está pronto para produzir.");
  }
}
