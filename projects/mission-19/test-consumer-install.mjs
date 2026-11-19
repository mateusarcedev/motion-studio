import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const packagesDir = path.join(root, "dist", "packages");
const consumer = await mkdtemp(path.join(os.tmpdir(), "motion-mission19-consumer-"));
const packagePaths = ["technomanceer-motion-core", "technomanceer-motion-cli"].map((name) => path.join(packagesDir, `${name}-1.0.0-rc.4.tgz`));
const skillsTar = path.join(packagesDir, "technomanceer-motion-studio-skills-1.0.0-rc.4.tgz");
const capture = (command, args, cwd) => execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

try {
  await writeFile(path.join(consumer, "package.json"), JSON.stringify({ name: "motion-mission19-consumer", private: true, type: "module" }, null, 2));
  capture("npm", ["install", "--offline", "--ignore-scripts", ...packagePaths], consumer);
  const requiredTree = JSON.parse(capture("npm", ["ls", "--json", "--depth=0"], consumer));
  assert.ok(!requiredTree.dependencies["@technomanceer/motion-studio-skills"], "Skills must remain optional during CLI installation");
  const smokeSource = `
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { listMotionComponents, renderMotionComponent, generateComponentHtml, listTransitions, getSafeZonePreset, verifyDeterminism, qaSafeZones, PATHS } from '@technomanceer/motion-core';
const work = path.resolve('outputs'); await mkdir(work,{recursive:true});
const components=listMotionComponents(); assert.equal(components.length,8);
const transitions=await listTransitions(); assert.equal(transitions.length,8);
assert.equal(getSafeZonePreset('instagram-reels').aspectRatio,'9:16');
assert.equal(typeof verifyDeterminism,'function'); assert.equal(typeof qaSafeZones,'function');
for (const key of ['components','transitionRenderer','verifyDeterminism','safeZoneQA']) assert.ok(existsSync(PATHS[key]),'missing packaged path '+key);
const config={component:'animated-counter',instanceId:'consumer-smoke',label:'API',from:0,value:42,duration:1,fps:6,aspectRatio:'16:9',theme:{primary:'#2563EB',background:'#101827',text:'#FFFFFF'}};
const html=generateComponentHtml(config); await writeFile(path.join(work,'composition.html'),html);
await writeFile(path.join(work,'component.json'),JSON.stringify(config,null,2));
const overlayConfig={...config,transparent:true,theme:{...config.theme,background:'transparent'}};
await writeFile(path.join(work,'overlay.json'),JSON.stringify(overlayConfig,null,2));
await writeFile(path.join(work,'overlay-composition.html'),generateComponentHtml(overlayConfig));
const moduleSmoke={componentIds:components.map(({id})=>id),transitionIds:transitions.map(({id})=>id),safeZonePreset:getSafeZonePreset('instagram-reels').id,packageEntry:import.meta.resolve('@technomanceer/motion-core'),corePaths:Object.fromEntries(Object.entries(PATHS).map(([k,v])=>[k,v]))};
await writeFile(path.join(work,'module-smoke.json'),JSON.stringify(moduleSmoke,null,2));
`;
  const smokePath = path.join(consumer, "smoke.mjs");
  await writeFile(smokePath, smokeSource);
  capture(process.execPath, [smokePath], consumer);
  const cli = path.join(consumer, "node_modules", "@technomanceer", "motion-cli", "bin", "motion.mjs");
  const version = capture(process.execPath, [cli, "--version"], consumer);
  assert.match(version, /1\.0\.0-rc\.4/);
  const listWithoutSkills = capture(process.execPath, [cli, "list"], consumer);
  assert.match(listWithoutSkills, /Catálogo público opcional não instalado/);
  assert.match(listWithoutSkills, /Core Engines/);

  const initOutput = capture(process.execPath, [cli, "init", "--brand=Clean Room"], consumer);
  assert.match(initOutput, /Catálogo de Skills opcional não instalado/);
  assert.ok(existsSync(path.join(consumer, "motion.config.json")));
  assert.ok(!existsSync(path.join(consumer, ".agents", "skills")));

  const doctorResult = spawnSync(process.execPath, [cli, "doctor"], { cwd: consumer, encoding: "utf8" });
  const doctorOutput = `${doctorResult.stdout || ""}\n${doctorResult.stderr || ""}`;
  assert.match(doctorOutput, /MOTION Studio — Doctor Check/);
  assert.match(doctorOutput, /MOTION Skills Catalog/);

  capture(process.execPath, [cli, "create", "website", "consumer-site"], consumer);
  assert.ok(existsSync(path.join(consumer, "motion", "projects", "consumer-site", "index.html")));

  const staticHtml = path.join(consumer, "outputs", "static.html");
  const staticPng = path.join(consumer, "outputs", "static.png");
  await writeFile(staticHtml, "<!doctype html><html><body><main>RC4 clean room</main></body></html>");
  capture(process.execPath, [cli, "render", "static", staticHtml, staticPng, "--width=320", "--height=180"], consumer);
  assert.ok(existsSync(staticPng));

  const exportZip = path.join(consumer, "outputs", "consumer-site.zip");
  capture(process.execPath, [cli, "export", "motion/projects/consumer-site", exportZip], consumer);
  assert.ok(existsSync(exportZip));

  capture("npm", ["install", "--offline", "--ignore-scripts", skillsTar], consumer);
  const withSkills = path.join(consumer, "with-skills");
  await mkdir(withSkills, { recursive: true });
  const initWithSkills = capture(process.execPath, [cli, "init", "--profile=all"], withSkills);
  assert.match(initWithSkills, /skills autorizadas configuradas/i);
  const installedSkillNames = await readdir(path.join(withSkills, ".agents", "skills"));
  assert.equal(installedSkillNames.length, 11);
  assert.ok(installedSkillNames.includes("studio-director"));
  assert.ok(installedSkillNames.includes("anatomy"));
  assert.ok(!installedSkillNames.some((name) => name.startsWith("remotion-")));

  const componentList = JSON.parse(capture(process.execPath, [cli, "components", "list"], consumer));
  const transitionList = JSON.parse(capture(process.execPath, [cli, "transition", "list"], consumer));
  assert.equal(componentList.length, 8);
  assert.equal(transitionList.length, 8);
  const pngVideo = path.join(consumer, "outputs", "component.mp4");
  capture(process.execPath, [cli, "components", "render", "animated-counter", "--config=outputs/component.json", `--output=${pngVideo}`, "--width=320", "--height=180"], consumer);
  const webm = path.join(consumer, "outputs", "overlay.webm");
  capture(process.execPath, [cli, "components", "render", "animated-counter", "--config=outputs/overlay.json", `--output=${webm}`, "--width=320", "--height=180"], consumer);
  const webmProbe = JSON.parse(capture("ffprobe", ["-v", "error", "-show_streams", "-of", "json", webm], consumer));
  assert.equal(webmProbe.streams[0].codec_name, "vp9");
  assert.equal(String(webmProbe.streams[0].tags.ALPHA_MODE ?? webmProbe.streams[0].tags.alpha_mode), "1");
  const overlayCommandWebm = path.join(consumer, "outputs", "overlay-command.webm");
  capture(process.execPath, [cli, "render", "overlay", "outputs/overlay-composition.html", `--output=${overlayCommandWebm}`, "--duration=1", "--fps=6", "--width=320", "--height=180"], consumer);
  const overlayCommandProbe = JSON.parse(capture("ffprobe", ["-v", "error", "-show_streams", "-of", "json", overlayCommandWebm], consumer));
  assert.equal(overlayCommandProbe.streams[0].codec_name, "vp9");
  assert.equal(String(overlayCommandProbe.streams[0].tags.ALPHA_MODE ?? overlayCommandProbe.streams[0].tags.alpha_mode), "1");
  const sceneA = path.join(consumer, "outputs", "scene-a.mp4"), sceneB = path.join(consumer, "outputs", "scene-b.mp4");
  capture("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=0x15324F:s=320x180:r=12:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", sceneA], consumer);
  capture("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=0x79421A:s=320x180:r=12:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", sceneB], consumer);
  const transitionMp4 = path.join(consumer, "outputs", "transition.mp4");
  capture(process.execPath, [cli, "transition", "render", sceneA, sceneB, `--output=${transitionMp4}`, "--kind=push", "--direction=left", "--easing=ease-in-out", "--duration=0.25", "--fps=12", "--width=320", "--height=180"], consumer);
  const transitionProbe = JSON.parse(capture("ffprobe", ["-v", "error", "-show_streams", "-of", "json", transitionMp4], consumer));
  assert.equal(transitionProbe.streams[0].codec_name, "h264");
  capture(process.execPath, [cli, "qa", "determinism", "outputs/composition.html", "--duration=1", "--fps=6", "--width=320", "--height=180", "--output=outputs/qa-determinism"], consumer);
  capture(process.execPath, [cli, "qa", "safe-zones", "outputs/composition.html", "--platform=youtube-horizontal", "--duration=1", "--fps=6", "--width=320", "--height=180", "--output=outputs/qa-safe-zones"], consumer);
  const npmTree = JSON.parse(capture("npm", ["ls", "--json", "--depth=0"], consumer));
  const report = {
    status: "passed", method: "Core+CLI first installed without Skills, then optional curated Skills installed explicitly from local npm tarball; no monorepo node_modules resolution",
    consumerDir: consumer, packageVersions: Object.fromEntries(Object.entries(npmTree.dependencies).map(([name, entry]) => [name, entry.version])),
    cliWithoutSkills: { version, init: "passed", list: "passed", doctorOutput: doctorOutput.split("\n").filter((line) => line.includes("MOTION Skills Catalog"))[0], create: "passed", renderStatic: "passed", export: "passed" },
    installedPublicSkills: installedSkillNames.sort(),
    componentCount: componentList.length, transitionCount: transitionList.length,
    importedCoreFrom: JSON.parse(await readFile(path.join(consumer, "outputs", "module-smoke.json"), "utf8")).packageEntry,
    artifacts: { mp4: pngVideo, webm, webmCodec: webmProbe.streams[0].codec_name, alphaMode: webmProbe.streams[0].tags.ALPHA_MODE ?? webmProbe.streams[0].tags.alpha_mode, overlayCommandWebm, overlayCommandAlphaMode: overlayCommandProbe.streams[0].tags.ALPHA_MODE ?? overlayCommandProbe.streams[0].tags.alpha_mode, transitionMp4, transitionCodec: transitionProbe.streams[0].codec_name, determinismReport: "outputs/qa-determinism/*/determinism-report.json", safeZoneReport: "outputs/qa-safe-zones/*/safe-zone-report.json" },
    npmTree,
  };
  await writeFile(path.join(here, "consumer-compatibility.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, consumerDir: consumer, packages: report.packageVersions, mp4: pngVideo, webm }, null, 2));
} catch (error) {
  throw new Error(`Independent consumer installation failed at ${consumer}: ${error.stderr?.toString() || error.message}`);
}
