import { execSync } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";

/** Collects engine diagnostics without printing or exiting. */
export async function collectDoctor() {
  const results = [];

  // 1. Node.js
  const nodeVer = process.version;
  const nodeMajor = parseInt(nodeVer.replace("v", "").split(".")[0], 10);
  results.push({
    name: "Node.js",
    required: true,
    status: nodeMajor >= 20 ? "PASS" : "FAIL",
    version: nodeVer,
    details: nodeMajor >= 20 ? "Compatível (>= 20.0.0)" : "Versão mínima 20 exigida (requisito do Playwright)",
  });

  let skillsCatalogStatus = "INFO";
  let skillsCatalogDetails = "Opcional; init, list e os comandos de produção funcionam sem este pacote";
  let skillsCatalogVersion = "Não instalado";
  try {
    const catalog = await import("@technomanceer/motion-studio-skills");
    const skills = await catalog.listSkills();
    skillsCatalogStatus = "PASS";
    skillsCatalogVersion = `${skills.length} Skills públicas`;
    skillsCatalogDetails = "Catálogo público verificado disponível; integrações externas permanecem separadas";
  } catch {}
  results.push({
    name: "MOTION Skills Catalog",
    required: false,
    status: skillsCatalogStatus,
    version: skillsCatalogVersion,
    details: skillsCatalogDetails,
  });

  // 2. Python 3
  let pyVer = "Não encontrado";
  let pyStatus = "FAIL";
  try {
    pyVer = execSync("python3 --version", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
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
    const raw = execSync("ffmpeg -version", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
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

  // 4. Playwright & Chromium — real check: pinned revision exists AND a smoke test launches it.
  let core;
  try { core = await import("@technomanceer/motion-core"); } catch { core = await import("../../motion-core/index.js"); }
  const browser = await core.diagnoseBrowser();
  const browserLine = browser.status === "PASS" || browser.status === "WARN"
    ? `Chromium ${browser.browserVersion} (Playwright ${browser.playwrightVersion}, revisão ${browser.revision})`
    : "Não utilizável";
  results.push({
    name: "Chromium (Playwright)",
    required: true,
    status: browser.status,
    code: browser.code ?? null,
    version: browserLine,
    details: [browser.message, browser.hint ? `Correção: ${browser.hint}` : null, browser.executablePath ? `Executável: ${browser.executablePath}` : null]
      .filter(Boolean).join(" | "),
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
    const raw = execSync("blender --version", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
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

  // 8. Edge-TTS (Optional Narration Tool)
  let edgeTtsStatus = "INFO";
  let edgeTtsVer = "Não instalado";
  try {
    const raw = execSync("edge-tts --version", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
    edgeTtsVer = raw.trim();
    edgeTtsStatus = "PASS";
  } catch {}
  results.push({
    name: "Edge-TTS (Opcional)",
    required: false,
    status: edgeTtsStatus,
    version: edgeTtsVer,
    details: edgeTtsStatus === "PASS" ? "Síntese vocal gratuita (motion-designer)" : "Opcional (pip3 install edge-tts)",
  });

  // 9. Sharp (Optional Image/Contact Sheet Tool)
  let sharpStatus = "INFO";
  let sharpVer = "Não instalado";
  try {
    const s = await import("sharp");
    sharpVer = "Instalado";
    sharpStatus = "PASS";
  } catch {}
  results.push({
    name: "Sharp (Opcional)",
    required: false,
    status: sharpStatus,
    version: sharpVer,
    details: sharpStatus === "PASS" ? "Processamento raster acelerado" : "Opcional (contact sheets utilizam Playwright/Pillow nativo)",
  });

  return results;
}

export async function runDoctor() {
  console.log("=========================================");
  console.log("       MOTION Studio — Doctor Check      ");
  console.log("=========================================\n");
  const results = await collectDoctor();

  // Display Table
  console.log("| Componente | Obrigatório | Status | Versão / Caminho | Observações |");
  console.log("|---|---|---|---|---|");
  for (const r of results) {
    const badge = r.status === "PASS" ? "✅ PASS" : r.status === "FAIL" ? "❌ FAIL" : r.status === "WARN" ? "⚠️ WARN" : "ℹ️ INFO";
    console.log(`| **${r.name}** | ${r.required ? "Sim" : "Não"} | ${badge} | ${r.version} | ${r.details} |`);
  }

  // Install integrity (only when this project was bootstrapped)
  let installFail = false;
  try {
    const { verifyInstall, MANIFEST_REL } = await import("./bootstrap/index.mjs");
    const { exists } = await import("./bootstrap/util.mjs");
    if (await exists(path.join(process.cwd(), MANIFEST_REL))) {
      const checks = await verifyInstall(process.cwd());
      const bad = checks.filter((c) => !c.ok);
      installFail = bad.length > 0;
      console.log(`\n### Instalação MOTION (${MANIFEST_REL})`);
      console.log(bad.length ? bad.map((c) => `❌ ${c.name}: ${c.detail}`).join("\n") : `✅ ${checks.length} verificações de Skills/integração OK`);
    }
  } catch {}

  // Community Integrations check
  const commSkills = [
    { name: "aula-interativa", desc: "Aulas interativas HTML determinísticas", profile: "interactive", repo: "gabrielgreco1/skills" },
    { name: "motion-designer", desc: "Teasers cinéticos e animações no beat", profile: "motion", repo: "gabrielgreco1/skills" },
    { name: "ui-humanizer", desc: "Auditoria visual contra clichês de IA", profile: "web", repo: "gabrielgreco1/skills" },
    { name: "stageshow", desc: "Showcases de produto, UI motion, cursores e bento grids", profile: "web", repo: "benjitaylor/skills" },
  ];
  console.log("\n### Integrações Externas da Comunidade (Gabriel Greco / Benji Taylor)");
  console.log("ℹ️ Habilidades externas mantidas no repositório upstream, instaladas sob demanda (sem inclusão no bundle npm):\n");
  for (const cs of commSkills) {
    let installed = false;
    for (const p of [
      path.join(process.cwd(), ".agents", "skills", cs.name),
      path.join(process.cwd(), ".claude", "skills", cs.name),
    ]) {
      try {
        await stat(p);
        installed = true;
        break;
      } catch {}
    }
    const badge = installed ? "✅ INSTALADA LOCALMENTE" : "⚪ DISPONÍVEL (NÃO INSTALADA)";
    console.log(`- **${cs.name}** [${badge}]`);
    console.log(`  - *Função:* ${cs.desc} (perfil: \`${cs.profile}\`)`);
    if (!installed) {
      console.log(`  - *Comando para adicionar:* \`npx skills add ${cs.repo} --skill ${cs.name}\``);
    }
  }

  const hasFail = installFail || results.some((r) => r.required && r.status === "FAIL");
  console.log("\n-----------------------------------------");
  if (hasFail) {
    console.error("❌ O MOTION Studio encontrou dependências obrigatórias ausentes. Resolva os itens marcados com FAIL.");
    process.exit(1);
  } else {
    console.log("✅ Todas as dependências obrigatórias estão operacionais. O estúdio está pronto para produzir.");
  }
}
