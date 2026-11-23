import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { stat, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  classifyCreativeIntent,
  resolveRoute,
  calculateAdaptiveDuration,
  renderFrames,
  SUBJECT_DOMAINS,
  INTENT_TYPES,
  AUDIENCE_PROFILES,
  CHANNELS,
  VISUAL_LANGUAGES
} from "../packages/motion-core/index.js";
import { EXTERNAL_INTEGRATIONS } from "../packages/motion-skills/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

describe("MOTION Studio — Intent-Driven Creative Router & Homologação", () => {
  test("1. Exportação de Constantes e Vocabulário Dimensional", () => {
    assert.ok(SUBJECT_DOMAINS.includes("technology"), "technology ausente em SUBJECT_DOMAINS");
    assert.ok(SUBJECT_DOMAINS.includes("science"), "science ausente em SUBJECT_DOMAINS");
    assert.ok(SUBJECT_DOMAINS.includes("industry"), "industry ausente em SUBJECT_DOMAINS");
    assert.ok(SUBJECT_DOMAINS.includes("culinary"), "culinary ausente em SUBJECT_DOMAINS");
    assert.ok(SUBJECT_DOMAINS.includes("software"), "software ausente em SUBJECT_DOMAINS");

    assert.ok(INTENT_TYPES.includes("explain"), "explain ausente em INTENT_TYPES");
    assert.ok(INTENT_TYPES.includes("promote"), "promote ausente em INTENT_TYPES");
    assert.ok(INTENT_TYPES.includes("demonstrate"), "demonstrate ausente em INTENT_TYPES");

    assert.ok(AUDIENCE_PROFILES.includes("developers"), "developers ausente");
    assert.ok(AUDIENCE_PROFILES.includes("general_public"), "general_public ausente");

    assert.ok(VISUAL_LANGUAGES.includes("diagram_motion"), "diagram_motion ausente");
    assert.ok(VISUAL_LANGUAGES.includes("scientific_visualization"), "scientific_visualization ausente");
    assert.ok(VISUAL_LANGUAGES.includes("commercial_motion"), "commercial_motion ausente");
    assert.ok(VISUAL_LANGUAGES.includes("ui_motion"), "ui_motion ausente");
  });

  test("2. Classificação de Intenção Multidomínio (5 Casos de Teste)", () => {
    // Caso A: Tecnologia Educacional
    const intentA = classifyCreativeIntent({
      prompt: "Como funcionam as APIs? Explicação passo a passo da requisição HTTP até o banco de dados",
      targetDuration: 35
    });
    assert.equal(intentA.subject, "technology");
    assert.ok(intentA.intents.includes("explain"));
    assert.equal(intentA.visualLanguage, "diagram_motion");
    assert.equal(intentA.durationSeconds, 35);

    // Caso B: Ciência e Natureza (Deep Ocean Squid Eyes)
    const intentB = classifyCreativeIntent({
      prompt: "Por que certas lulas de profundidade possuem olhos tão grandes? Architeuthis dux na zona mesopelágica",
      channel: "vertical_social"
    });
    assert.equal(intentB.subject, "science");
    assert.ok(intentB.intents.includes("explain") || intentB.intents.includes("educate"));
    assert.equal(intentB.visualLanguage, "scientific_visualization");
    assert.equal(intentB.requiresCommercialCTA, false);

    // Caso C: Processo Produtivo Industrial (Liofilização)
    const intentC = classifyCreativeIntent({
      prompt: "Como funciona uma fábrica de alimentos? Processo industrial de liofilização e ponto triplo da água",
      targetDuration: 45
    });
    assert.equal(intentC.subject, "industry");
    assert.ok(intentC.intents.includes("explain_process") || intentC.intents.includes("demonstrate"));
    assert.equal(intentC.durationSeconds, 45);

    // Caso D: Publicidade de Alta Gastronomia (Atelier Aurora)
    const intentD = classifyCreativeIntent({
      prompt: "Vídeo publicitário de 15 segundos para Atelier Aurora doces finos e casamentos de luxo",
      targetDuration: 15
    });
    assert.equal(intentD.subject, "culinary");
    assert.ok(intentD.intents.includes("promote") || intentD.intents.includes("sell"));
    assert.equal(intentD.visualLanguage, "commercial_motion");
    assert.equal(intentD.durationSeconds, 15);
    assert.equal(intentD.requiresCommercialCTA, true);

    // Caso E: Software / Ferramental de Desenvolvedor (DevMetrics / Stageshow)
    const intentE = classifyCreativeIntent({
      prompt: "Showcase da plataforma DevMetrics Engine com telemetria bento grid e interação de cursor",
      targetDuration: 30
    });
    assert.equal(intentE.subject, "software");
    assert.ok(intentE.intents.includes("demonstrate") || intentE.intents.includes("showcase_app"));
    assert.equal(intentE.visualLanguage, "ui_motion");
    assert.equal(intentE.durationSeconds, 30);
  });

  const ROUTES = [
    ["cinematic-product-director", ["vídeo de lançamento da feature X", "teaser do app", "filme do produto", "logo 3D abrindo o vídeo", "vídeo estilo Apple para o meu app", "Faz um reel de lançamento do nosso aplicativo"]],
    ["reel-editor", ["edita meu vídeo gravado", "tira as pausas e legenda meu reel", "edita o vídeo de lançamento que eu gravei", "transforma essa gravação em Reels e corta as pausas", "edita minha filmagem do site"]],
    ["shorts-director", ["short narrado deste texto", "short narrado sobre o lançamento do produto", "short ilustrado deste versículo"]],
    ["carousel-studio", ["carrossel de lançamento do app"]],
    ["story-studio", ["stories para o lançamento"]],
    ["feed-studio", ["post de lançamento do produto"]],
    ["web-director", ["landing page de lançamento"]],
    [null, ["como funciona uma API", "vídeo explicativo sobre o lançamento de foguetes", "showcase da plataforma com cursor e bento", "Vídeo publicitário de 15 segundos para Atelier Aurora", "cena 3D de um relógio girando"]],
  ];
  for (const [route, prompts] of ROUTES) for (const p of prompts) {
    test(`2b. Rota ${route ?? "por dimensões"}: ${p}`, () => {
      assert.equal(resolveRoute(p), route);
      const c = classifyCreativeIntent(p);
      assert.equal(c.route, route);
      if (route) assert.deepEqual(c.specialists, [route]);
      else assert.ok(!c.specialists.includes("cinematic-product-director"));
    });
  }

  test("3. Cálculo de Duração Adaptativa (Sem dogmas rígidos)", () => {
    // Usuário especifica duração exata
    const explicitDuration = calculateAdaptiveDuration({
      requestedSeconds: 15,
      actCount: 4,
      complexity: "high"
    });
    assert.equal(explicitDuration.seconds, 15);
    assert.equal(explicitDuration.negotiated, false);

    // Duração não especificada: calculada por densidade narrativa e pausas cognitivas
    const autoDurationShort = calculateAdaptiveDuration({
      actCount: 4,
      complexity: "low",
      intent: "promote"
    });
    assert.ok(autoDurationShort.seconds >= 10 && autoDurationShort.seconds <= 20);

    const autoDurationDeep = calculateAdaptiveDuration({
      actCount: 4,
      complexity: "high",
      intent: "explain_process"
    });
    assert.ok(autoDurationDeep.seconds >= 40 && autoDurationDeep.seconds <= 60);
    assert.ok(autoDurationDeep.minCognitivePausePerAct >= 1.5, "Pausa cognitiva insuficiente");
  });

  test("4. Integração Externa Stageshow", () => {
    assert.ok(EXTERNAL_INTEGRATIONS.stageshow, "Stageshow não registrado em EXTERNAL_INTEGRATIONS");
    assert.ok(EXTERNAL_INTEGRATIONS.stageshow.repo.includes("benjitaylor/skills"));
    assert.ok(EXTERNAL_INTEGRATIONS.stageshow.license.startsWith("MIT"));
    assert.ok(EXTERNAL_INTEGRATIONS.stageshow.role.includes("cursores animados"));
    assert.ok(EXTERNAL_INTEGRATIONS.stageshow.role.includes("bento grids"));
  });

  test("5. Homologação — Integridade dos 5 Projetos Reais", async () => {
    const projects = [
      { id: "homolog-a-api-explainer", acts: 4, hasResearch: false },
      { id: "homolog-b-squid-eyes", acts: 4, hasResearch: true },
      { id: "homolog-c-food-factory", acts: 4, hasProcess: true },
      { id: "homolog-d-service-commercial", acts: 4, hasResearch: false },
      { id: "homolog-e-software-showcase", acts: 4, hasResearch: false }
    ];

    for (const proj of projects) {
      const projDir = path.join(rootDir, "projects", proj.id);

      // 1. Arquivos mandatórios
      const briefStat = await stat(path.join(projDir, "BRIEF.md"));
      assert.ok(briefStat.size > 200, `${proj.id}: BRIEF.md muito pequeno`);

      const styleStat = await stat(path.join(projDir, "STYLE.md"));
      assert.ok(styleStat.size > 200, `${proj.id}: STYLE.md muito pequeno`);

      const sbStat = await stat(path.join(projDir, "STORYBOARD.md"));
      assert.ok(sbStat.size > 200, `${proj.id}: STORYBOARD.md muito pequeno`);

      const compStat = await stat(path.join(projDir, "composition.html"));
      assert.ok(compStat.size > 1000, `${proj.id}: composition.html muito pequeno`);

      // 2. Factual grounding
      if (proj.hasResearch) {
        const resStat = await stat(path.join(projDir, "RESEARCH.md"));
        assert.ok(resStat.size > 500, `${proj.id}: RESEARCH.md ausente ou truncado`);
      }
      if (proj.hasProcess) {
        const procStat = await stat(path.join(projDir, "PROCESS.md"));
        assert.ok(procStat.size > 500, `${proj.id}: PROCESS.md ausente ou truncado`);
      }

      const manifest = JSON.parse(await readFile(path.join(projDir, "assets.manifest.json"), "utf-8"));
      assert.equal(manifest.renditions.length, 4, `${proj.id}: esperado 4 renditions em manifest`);
    }
  });

  // Stills are never versioned (out/ is ignored), so they are rendered here from the versioned
  // composition. c/d/e use the storyboard's keyframes; a/b declare none: scene midpoints.
  const KEYFRAMES = {
    "homolog-a-api-explainer": [120, 390, 675, 930],
    "homolog-b-squid-eyes": [105, 330, 585, 810],
    "homolog-c-food-factory": [160, 500, 870, 1200],
    "homolog-d-service-commercial": [60, 170, 280, 400],
    "homolog-e-software-showcase": [120, 340, 580, 800],
  };
  for (const [id, frames] of Object.entries(KEYFRAMES)) {
    test(`6. Homologação — stills regenerados de ${id}`, { timeout: 120000 }, async () => {
      const outDir = path.join(rootDir, "tests", "tmp", "homolog", id);
      await rm(outDir, { recursive: true, force: true });
      await renderFrames(path.join(rootDir, "projects", id, "composition.html"), outDir, { frames: 1350, sampleFrames: frames.join(","), width: 1080, height: 1920, fps: 30 });
      const pngs = (await readdir(outDir)).filter((f) => f.endsWith(".png")).sort();
      assert.equal(pngs.length, frames.length, `${id}: ${pngs.length} stills`);
      const hashes = new Set();
      for (const f of pngs) {
        const bytes = await readFile(path.join(outDir, f));
        assert.ok(bytes.length > 50000, `${id}: still ${f} inválido (${bytes.length} bytes)`);
        hashes.add(createHash("sha256").update(bytes).digest("hex"));
      }
      assert.equal(hashes.size, frames.length, `${id}: stills repetidos (a composição não anima)`);
    });
  }
});
