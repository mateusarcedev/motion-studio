import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../../..");
const campaign = path.join(root, "projects/m6-herbario-de-nevoa");
const outDir = path.join(campaign, "evidence/doop-lab/motion-to-design");
const rel = (p) => path.relative(root, p).split(path.sep).join("/");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const frames = [
  { index: "0000", time: "00:00.00", caption: "A página abre como um caderno de campo." },
  { index: "0060", time: "00:02.50", caption: "A primeira espécie surge entre linhas e margens." },
  { index: "0120", time: "00:05.00", caption: "A composição aproxima o desenho original." },
  { index: "0180", time: "00:07.50", caption: "O atlas atravessa uma mudança de escala." },
  { index: "0239", time: "00:09.96", caption: "A página final fecha o filme." },
];

const htmlForVideoFrame = ({ index, time, caption }) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Herbário de Névoa · quadro ${time}</title><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#26352e;color:#f4f0e6}
body{font-family:Ubuntu,'DejaVu Sans',sans-serif;display:grid;grid-template-rows:1fr auto;padding:20px 28px 16px;gap:10px}
img{width:100%;height:100%;min-height:0;object-fit:contain;background:#26352e}
footer{display:flex;justify-content:space-between;align-items:baseline;gap:20px;font-size:13px;line-height:1.35}
time{font-family:'Ubuntu Mono','DejaVu Sans Mono',monospace;color:#d2b17b;white-space:nowrap}
</style></head><body><img src="projects/m6-herbario-de-nevoa/out/m6-final/video/frames/${index}.png" alt="Quadro do vídeo promocional em ${time}">
<footer><span>${caption}</span><time>${time} · quadro ${index} / 239</time></footer></body></html>`;

const frameHtmlPaths = [];
for (const frame of frames) {
  const output = path.join(outDir, `video-frame-${frame.index}.html`);
  await writeFile(output, htmlForVideoFrame(frame), { encoding: "utf8" });
  frameHtmlPaths.push(output);
}

const tokenBundle = {
  schemaVersion: "1.0.0",
  sourceEditor: "motion-studio",
  brandSlug: "herbario-de-nevoa",
  themes: [],
  tokens: [
    ...Object.entries({ paper: "#EAE6DA", "paper-light": "#F4F0E6", ink: "#26352E", moss: "#56694F", clay: "#91503D", berry: "#754652", line: "#C7C1B1" }).map(([name, value]) => ({ cssVar: `--${name}`, type: "color", value })),
    { cssVar: "--font-display", type: "fontFamily", value: "Georgia, 'DejaVu Serif', serif" },
    { cssVar: "--font-interface", type: "fontFamily", value: "Ubuntu, 'DejaVu Sans', sans-serif" },
    { cssVar: "--font-mono", type: "fontFamily", value: "'Ubuntu Mono', 'DejaVu Sans Mono', monospace" },
    { cssVar: "--space-unit", type: "spacing", value: "8px" },
    { cssVar: "--space-page", type: "spacing", value: "72px" },
    { cssVar: "--space-card", type: "spacing", value: "28px" },
    { cssVar: "--space-gutter", type: "spacing", value: "20px" },
  ],
};

const htmlArtifacts = [
  { id: "landing", name: "07-landing-herbario", path: rel(path.join(campaign, "web/index.html")), width: 1280, height: 800 },
  ...[
    ["01-capa", "08-carousel-01-capa"], ["02-indice", "09-carousel-02-indice"],
    ["03-lunaria", "10-carousel-03-lunaria"], ["04-intervalo", "11-carousel-04-intervalo"],
    ["05-paisagem", "12-carousel-05-paisagem"], ["06-colofao", "13-carousel-06-colofao"],
  ].map(([source, name]) => ({ id: name.toLowerCase().replaceAll("-", "_"), name, path: rel(path.join(campaign, `carousel/${source}.html`)), width: 1080, height: 1350 })),
  { id: "story_vertical", name: "14-story-vertical", path: rel(path.join(campaign, "story/story.html")), width: 720, height: 1280 },
  ...frameHtmlPaths.map((p, i) => ({ id: `video_frame_${frames[i].index}`, name: `${15 + i}-video-${frames[i].time.replaceAll(":", "-")}`, path: rel(p), width: 1280, height: 720 })),
  { id: "storyboard", name: "20-storyboard-video", path: rel(path.join(outDir, "storyboard.html")), width: 1280, height: 800 },
  { id: "svg_elements", name: "21-svg-compatible-elements", path: rel(path.join(outDir, "svg-elements.html")), width: 1280, height: 800 },
];

const imageArtifacts = [];
for (const frame of frames) {
  const source = path.join(campaign, `out/m6-final/video/frames/${frame.index}.png`);
  const bytes = await readFile(source);
  imageArtifacts.push({
    id: `promo_frame_${frame.index}`,
    kind: "image",
    path: rel(source),
    mime: "image/png",
    origin: "Motion Studio · campanha fictícia Herbário de Névoa · render M6",
    license: { grant: "user-licensed", commercialUse: true },
    bytes: bytes.length,
    sha256: sha256(bytes),
  });
}

const provenanceManifest = {
  schemaVersion: "1.0.0",
  assets: imageArtifacts.map(({ id, path: localPath, origin, license, sha256: digest }) => ({
    id,
    localPath,
    sha256: digest,
    kind: "image",
    origin,
    license,
    sanitized: false,
  })),
};

const client = new Client({ name: "motion-studio-m6-doop-dry-run", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(root, "packages/motion-cli/bin/motion.mjs"), "mcp", `--workspace=${root}`, "--max-concurrency=1"],
  cwd: root,
  stderr: "pipe",
});
transport.stderr?.on("data", () => {});

try {
  await client.connect(transport);
  const catalog = await client.listTools();
  if (catalog.tools.length !== 30) throw new Error(`expected 30 Motion MCP tools, got ${catalog.tools.length}`);
  const call = async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) throw new Error(`${name} failed: ${JSON.stringify(result.structuredContent ?? result.content)}`);
    return result.structuredContent;
  };

  const plan = await call("bridge_export_plan", {
    documentId: "Gz620okdHY",
    tokenBundle,
    provenanceManifest,
    artifacts: [
      ...htmlArtifacts.map(({ id, name, path: artifactPath, width, height }) => ({ id, kind: "html", name, path: artifactPath, width, height })),
      ...imageArtifacts.map(({ id, kind, path: artifactPath, mime, license, origin }) => ({ id, kind, path: artifactPath, mime, license, origin })),
    ],
    storyboard: { schemaVersion: "1.0.0", markdown: "Herbário de Névoa · vídeo original 10 s, 24 fps, 1280×720. Cinco quadros representativos: 00:00.00, 00:02.50, 00:05.00, 00:07.50 e 00:09.96. Exportação de MP4 não é tratada como vídeo editável no canvas." },
  });
  const validation = await call("bridge_export_validate", { plan: plan.plan });
  const payload = await call("bridge_doop_payload", { plan: plan.plan });
  const fileManifest = [];
  for (const artifact of [...htmlArtifacts, ...imageArtifacts.map((x) => ({ id: x.id, path: x.path }))]) {
    const bytes = await readFile(path.join(root, artifact.path));
    fileManifest.push({ id: artifact.id, path: artifact.path, bytes: bytes.length, sha256: sha256(bytes) });
  }
  const operations = plan.plan.operations.map((op) => ({ id: op.id, kind: op.kind, target: op.target, dependsOn: op.dependsOn, payload: op.payload }));
  const summary = {
    generatedAt: new Date().toISOString(),
    canvas: { id: "Gz620okdHY", url: "https://doop.design/c/Gz620okdHY", expectedExistingFrameCount: 6 },
    status: plan.status,
    executed: plan.executed,
    discoveredMotionTools: catalog.tools.length,
    outputs: {
      editableHtmlFrames: plan.inspected.items.filter((item) => item.category === "editable").map((item) => item.id),
      rasterArtifacts: plan.inspected.items.filter((item) => item.category === "rasterized").map((item) => item.id),
      blocked: plan.inspected.items.filter((item) => item.category === "blocked"),
      warnings: plan.inspected.items.flatMap((item) => (item.warnings ?? []).map((warning) => ({ id: item.id, warning }))),
    },
    validation: { ok: validation.ok, findings: validation.findings, executed: validation.executed },
    doopOperations: payload.operations.map((operation) => ({
      operationId: operation.operationId,
      tool: operation.tool ?? null,
      dependsOn: operation.dependsOn ?? [],
      requiresAuthorization: operation.requiresAuthorization ?? false,
      requiresLocalAssetTransfer: operation.requiresLocalAssetTransfer ?? false,
      appendChunks: operation.appendChunks?.length ?? 0,
    })),
    explicitSafety: {
      dryRun: plan.plan.dryRun,
      allowPublicUpload: false,
      allowUpdateExisting: false,
      allowTokenMutation: false,
      allowComponentMutation: false,
      externalCallsExecuted: false,
      newFramesAuthorizationRequired: true,
      publicRasterUploadsAuthorizationRequired: true,
    },
    campaignVideo: { path: "projects/m6-herbario-de-nevoa/out/m6-final/video/herbario-de-nevoa.mp4", durationSec: 10, fps: 24, width: 1280, height: 720 },
    sourceFiles: fileManifest,
    plan: { ...plan.plan, operations },
  };
  await writeFile(path.join(outDir, "export-plan.dry-run.json"), `${JSON.stringify(summary, null, 2)}\n`, { encoding: "utf8", flag: "w" });
  console.log(JSON.stringify({
    status: summary.status,
    executed: summary.executed,
    tools: summary.discoveredMotionTools,
    htmlFrames: summary.outputs.editableHtmlFrames.length,
    rasterArtifacts: summary.outputs.rasterArtifacts.length,
    blocked: summary.outputs.blocked.length,
    opKinds: [...new Set(operations.map((op) => op.kind))],
    validation: summary.validation.status ?? summary.validation.valid ?? null,
    payloadOps: payload.operations?.length ?? null,
    output: rel(path.join(outDir, "export-plan.dry-run.json")),
  }, null, 2));
} finally {
  await client.close();
}
