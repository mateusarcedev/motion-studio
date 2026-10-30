import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { stat, readFile, mkdir, rm } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  renderStatic,
  renderFrames,
  assembleVideo,
  validateStatic,
  generateManifest,
  exportZip,
  createMotionDriver
} from "../packages/motion-core/index.js";
import { listSkills, SKILL_PROFILES, resolveSkillsForProfile } from "../packages/motion-skills/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = path.join(__dirname, "tmp");

describe("MOTION Studio — Suite de QA e Regressão", () => {
  test("1. Descoberta de Skills", async () => {
    const skills = await listSkills();
    assert.ok(skills.length >= 50, `Esperado pelo menos 50 skills, encontrado ${skills.length}`);
    const names = skills.map((s) => s.name);
    assert.ok(names.includes("studio-director"), "studio-director ausente");
    assert.ok(names.includes("motion-director"), "motion-director ausente");
    assert.ok(names.includes("web-director"), "web-director ausente");
    assert.ok(names.includes("carousel-studio"), "carousel-studio ausente");
    assert.ok(names.includes("shorts-director"), "shorts-director ausente");
    assert.ok(names.includes("3d-scene-director"), "3d-scene-director ausente");
  });

  test("2. CLI Doctor (Diagnóstico de Dependências)", () => {
    const out = execSync("node packages/motion-cli/bin/motion.mjs doctor", { encoding: "utf-8" });
    assert.ok(out.includes("PASS"), "Doctor não passou nos testes obrigatórios");
    assert.ok(out.includes("Chromium (Playwright)"), "Playwright Chromium não detectado");
    assert.ok(out.includes("FFmpeg"), "FFmpeg não detectado");
  });

  test("3. Renderização Estática e QA de Overflow", async () => {
    await mkdir(tmpDir, { recursive: true });
    const testHtml = path.join(tmpDir, "test-static.html");
    const testPng = path.join(tmpDir, "test-static.png");
    
    await readFile(path.join(__dirname, "..", "projects", "example-story-static", "stories", "01.html"));
    const htmlContent = `<!doctype html><html><head><style>*{box-sizing:border-box;margin:0;padding:0;}body{width:1080px;height:1350px;background:#080B10;color:#F0F6FC;font-family:sans-serif;padding:60px;overflow:hidden;}</style></head><body>
      <h1>QA Test Static Render</h1>
      <p>Validando engine estática do motion-core.</p>
    </body></html>`;
    await (await import("node:fs/promises")).writeFile(testHtml, htmlContent, "utf-8");

    const res = await renderStatic(testHtml, testPng, { width: 1080, height: 1350, scale: 1 });
    assert.ok(res.stdout.includes('"status": "OK"'), "Status do render estático não foi OK");

    const pngStat = await stat(testPng);
    assert.ok(pngStat.size > 1000, "Arquivo PNG gerado está vazio ou truncado");
  });

  test("4. Determinismo Bit-a-Bit por Frame (Hash MD5)", async () => {
    const testHtml = path.join(tmpDir, "test-deterministic.html");
    const htmlContent = `<!doctype html><html><body style="width:1920px;height:1080px;background:#080B10;color:#00D2FF;margin:0;">
      <div id="box" style="position:absolute;width:200px;height:200px;background:#00F5A0;top:200px;left:200px;"></div>
      <script>
        window.__onFrame__ = (M) => {
          const deg = (M.frame || 0) * 10;
          document.getElementById('box').style.transform = 'rotate(' + deg + 'deg)';
        };
      </script>
    </body></html>`;
    await (await import("node:fs/promises")).writeFile(testHtml, htmlContent, "utf-8");

    const run1Dir = path.join(tmpDir, "frames-run1");
    const run2Dir = path.join(tmpDir, "frames-run2");
    await mkdir(run1Dir, { recursive: true });
    await mkdir(run2Dir, { recursive: true });

    // Render 3 frames in Run 1
    await renderFrames(testHtml, run1Dir, { frames: 3, fps: 30, width: 1920, height: 1080, seed: 42 });
    // Render 3 frames in Run 2
    await renderFrames(testHtml, run2Dir, { frames: 3, fps: 30, width: 1920, height: 1080, seed: 42 });

    for (let f = 0; f < 3; f++) {
      const fn = `${String(f).padStart(4, "0")}.png`;
      const buf1 = await readFile(path.join(run1Dir, fn));
      const buf2 = await readFile(path.join(run2Dir, fn));
      const h1 = crypto.createHash("md5").update(buf1).digest("hex");
      const h2 = crypto.createHash("md5").update(buf2).digest("hex");
      assert.equal(h1, h2, `MD5 mismatch no frame ${f}: run1=${h1} vs run2=${h2}`);
    }
  });

  test("5. Montagem de Vídeo CFR 30 FPS", async () => {
    const framesDir = path.join(tmpDir, "frames-run1");
    const outMp4 = path.join(tmpDir, "test-video.mp4");
    const res = await assembleVideo(framesDir, outMp4, { fps: 30 });
    assert.ok(res.stdout.includes('"fps": 30'), "Vídeo não reportou fps=30");

    const mp4Stat = await stat(outMp4);
    assert.ok(mp4Stat.size > 1000, "MP4 gerado está vazio");
  });

  test("6. Validador Dimensional de Carrossel (validate_static.py)", async () => {
    const testPng = path.join(tmpDir, "test-static.png");
    const res = await validateStatic(testPng, "1080x1350", 1);
    assert.ok(res.stdout.includes('"valid": true'), "Validador dimensional rejeitou PNG válido");
  });

  test("7. Manifesto Criptográfico SHA-256 e Exportação ZIP", async () => {
    const manifestPath = path.join(tmpDir, "assets.manifest.json");
    await generateManifest(tmpDir, manifestPath);
    const manData = JSON.parse(await readFile(manifestPath, "utf-8"));
    assert.ok(manData.files.length > 0, "Manifesto não incluiu arquivos");
    assert.ok(manData.files[0].sha256.length >= 16, "Hash SHA-256 truncado ou inválido");

    const zipPath = path.join(tmpDir, "test-export.zip");
    await exportZip(tmpDir, zipPath);
    const zipStat = await stat(zipPath);
    assert.ok(zipStat.size > 500, "Arquivo ZIP gerado está vazio");
  });

  test("8. Isolamento de Marcas e Galeria Base", async () => {
    const baseGallery = JSON.parse(await readFile(path.join(__dirname, "..", "creative-core", "gallery", "gallery.json"), "utf-8"));
    const originalIds = [
      "example-3d-product",
      "motion-landing",
      "carousel-nova-identidade",
      "example-carousel-7",
      "example-post-reflow",
      "example-story-static",
      "example-teaser",
      "example-story-animated",
      "example-short-original"
    ];
    for (const id of originalIds) {
      const found = baseGallery.items.find((i) => i.id === id);
      assert.ok(found, `Item original ${id} ausente da galeria!`);
      assert.equal(found.status, "draft", `Item original ${id} teve status draft alterado sem autorização!`);
    }
    // Todas as produções cadastradas devem estar em draft
    for (const item of baseGallery.items) {
      assert.equal(item.status, "draft", `Item ${item.id} não está em draft!`);
    }
  });

  test("9. Auditoria dos Pacotes Distribuíveis (Tarballs em dist/packages/)", async () => {
    const pkgJson = JSON.parse(await readFile(path.join(__dirname, "..", "packages", "motion-core", "package.json"), "utf-8"));
    const ver = pkgJson.version;
    const coreTar = path.join(__dirname, "..", "dist", "packages", `motion-core-${ver}.tgz`);
    const skillsTar = path.join(__dirname, "..", "dist", "packages", `motion-studio-skills-${ver}.tgz`);
    const cliTar = path.join(__dirname, "..", "dist", "packages", `motion-cli-${ver}.tgz`);

    const cStat = await stat(coreTar);
    const sStat = await stat(skillsTar);
    const clStat = await stat(cliTar);

    assert.ok(cStat.size > 5000, "motion-core tarball corrompido");
    assert.ok(sStat.size > 50000, "motion-studio-skills tarball corrompido");
    assert.ok(clStat.size > 5000, "motion-cli tarball corrompido");
  });

  test("10. Distribuição Seletiva de Skills por Perfil (core, web, motion, social, 3d, blender, all)", () => {
    const requiredProfiles = ["core", "web", "motion", "social", "3d", "blender", "all"];
    for (const p of requiredProfiles) {
      assert.ok(p in SKILL_PROFILES, `Perfil '${p}' não registrado`);
    }

    const coreSkills = resolveSkillsForProfile("core");
    assert.ok(coreSkills.length >= 6, "Perfil core deve ter ao menos 6 diretores");
    assert.ok(coreSkills.includes("studio-director"), "studio-director deve estar em core");
    assert.ok(coreSkills.includes("web-director"), "web-director deve estar em core");
    assert.ok(coreSkills.includes("motion-director"), "motion-director deve estar em core");

    const socialSkills = resolveSkillsForProfile("social");
    assert.ok(socialSkills.includes("carousel-studio"), "carousel-studio deve estar em social");
    assert.ok(socialSkills.includes("story-studio"), "story-studio deve estar em social");
    assert.ok(!socialSkills.includes("3d-scene-director"), "3d-scene-director não deve estar em social");

    const allSkills = resolveSkillsForProfile("all");
    assert.equal(allSkills, null, "Perfil all deve resolver para null (todas as skills)");

    assert.throws(() => {
      resolveSkillsForProfile("perfil_inexistente");
    }, /Perfil desconhecido/);
  });
});
