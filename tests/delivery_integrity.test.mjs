import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { main as motionMain } from "../packages/motion-cli/lib/main.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(root, "packages/motion-cli/bin/motion.mjs");
const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "motion-delivery-tests-"));
test.after(async () => rm(tmpRoot, { recursive: true, force: true }));

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function pngChunk(name, payload) {
  const type = Buffer.from(name), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(payload.length); crc.writeUInt32BE(crc32(Buffer.concat([type, payload])));
  return Buffer.concat([len, type, payload, crc]);
}
function tinyPng() {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(Buffer.from([0, 30, 120, 200, 255]))), pngChunk("IEND", Buffer.alloc(0))]);
}
async function cli(args) {
  const lines = [], originalLog = console.log, originalError = console.error;
  console.log = (...values) => lines.push(values.join(" "));
  console.error = (...values) => lines.push(values.join(" "));
  process.exitCode = undefined;
  try {
    const status = await motionMain(args, { bin: "motion" });
    return { status, stdout: lines.join("\n"), stderr: "" };
  } finally { console.log = originalLog; console.error = originalError; process.exitCode = undefined; }
}
async function fixture(t, { files = {}, artifacts, producedRoots = [], fonts = [], portable = true } = {}) {
  const dir = await mkdtemp(path.join(tmpRoot, "project-"));
  t.after(async () => rm(dir, { recursive: true, force: true }));
  for (const [rel, bytes] of Object.entries(files)) {
    const target = path.join(dir, rel); await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  const contract = { schemaVersion: 1, project: path.basename(dir), portable, producedRoots, artifacts, fonts };
  await writeFile(path.join(dir, "delivery.contract.json"), JSON.stringify(contract, null, 2) + "\n");
  return dir;
}
function imageArtifact(rel = "out/final/card.png", required = true) { return { path: rel, role: "render", mediaType: "image/png", required }; }
function exportProject(dir, zip = path.join(dir, "delivery.zip")) { return cli(["export", dir, zip]); }
function verifyProject(dir, zip = path.join(dir, "delivery.zip")) { return cli(["qa", "delivery", `--project=${dir}`, `--zip=${zip}`, "--json"]); }
function sha(data) { return createHash("sha256").update(data).digest("hex"); }
function allOutput(result) { return `${result.stdout ?? ""}\n${result.stderr ?? ""}`; }
function python(code, args) { return spawnSync("python3", ["-c", code, ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }); }
function ffmpeg(args) { return spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8" }); }
const haveFfmpeg = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" }).status === 0;
function zipEntries(zip) {
  const r = python("import sys,zipfile; print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))", [zip]);
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim().split("\n");
}
function extractZip(zip, destination) {
  const r = python("import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])", [zip, destination]);
  assert.equal(r.status, 0, r.stderr);
}

test("project with only required images exports and hashes survive actual ZIP extraction", async (t) => {
  const img = tinyPng();
  const dir = await fixture(t, { files: { "out/final/card.png": img }, producedRoots: ["out/final"], artifacts: [imageArtifact()] });
  const zip = path.join(tmpRoot, "image-only.zip"), out = await exportProject(dir, zip);
  assert.equal(out.status, 0, out.stderr || out.stdout);
  const extracted = path.join(tmpRoot, "image-only-extracted");
  extractZip(zip, extracted);
  const copied = await readFile(path.join(extracted, "out/final/card.png"));
  assert.equal(sha(copied), sha(img));
  const manifest = JSON.parse(await readFile(path.join(extracted, "assets.manifest.json"), "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.match(manifest.files[0].sha256, /^[0-9a-f]{64}$/);
  assert.equal(manifest.files[0].width, 1);
  assert.equal((await verifyProject(dir, zip)).status, 0);
});

test("missing required output fails export and is not declared as a delivered file", async (t) => {
  const dir = await fixture(t, { producedRoots: ["out/final"], artifacts: [imageArtifact()] });
  await mkdir(path.join(dir, "out/final"), { recursive: true });
  const zip = path.join(tmpRoot, "missing-required.zip"), out = await exportProject(dir, zip);
  assert.equal(out.status, 2, out.stdout);
  const manifest = JSON.parse(await readFile(path.join(dir, "assets.manifest.json"), "utf8"));
  assert.equal(manifest.validation.status, "FAIL");
  assert.deepEqual(manifest.files, []);
  assert.match(allOutput(out), /required\.missing/);
  await assert.rejects(stat(zip));
});

test("a declared production directory with no files fails instead of looking complete", async (t) => {
  const dir = await fixture(t, { producedRoots: ["out/final"], artifacts: [] });
  await mkdir(path.join(dir, "out/final"), { recursive: true });
  const out = await exportProject(dir, path.join(tmpRoot, "empty-output.zip"));
  assert.equal(out.status, 2);
  assert.match(allOutput(out), /producedRoot\.empty/);
});

test("legacy extension filters cannot hide produced media from an auto-generated contract", async (t) => {
  const dir = await mkdtemp(path.join(tmpRoot, "legacy-filter-")); t.after(async () => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, "out/final"), { recursive: true });
  await writeFile(path.join(dir, "out/final/card.png"), tinyPng());
  await writeFile(path.join(dir, "out/final/film.mp4"), Buffer.concat([Buffer.alloc(4), Buffer.from("ftypisom"), Buffer.alloc(16)]));
  const zip = path.join(tmpRoot, "legacy-filter.zip");
  const r = spawnSync("python3", [path.join(root, "packages/motion-core/exporters/delivery.py"), "export", dir, zip, "--ext", "png"], { encoding: "utf8" });
  assert.equal(r.status, 2, r.stdout || r.stderr);
  assert.match(r.stdout, /produced\.omitted/);
  assert.equal(JSON.parse(await readFile(path.join(dir, "assets.manifest.json"), "utf8")).validation.status, "FAIL");
});

test("auto-generated delivery excludes credential-like files and fails closed with a specific finding", async (t) => {
  const dir = await mkdtemp(path.join(tmpRoot, "sensitive-auto-")); t.after(async () => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, "out/final"), { recursive: true });
  await mkdir(path.join(dir, "config"), { recursive: true });
  await writeFile(path.join(dir, "out/final/card.png"), tinyPng());
  await writeFile(path.join(dir, "config/service-account.json"), JSON.stringify({ private_key: "fixture-only" }));
  const zip = path.join(tmpRoot, "sensitive-auto.zip"), out = await exportProject(dir, zip);
  assert.equal(out.status, 2, allOutput(out));
  const contract = JSON.parse(await readFile(path.join(dir, "delivery.contract.json"), "utf8"));
  assert.deepEqual(contract.artifacts.map((item) => item.path), ["out/final/card.png"]);
  assert.ok(contract.filteredOut.includes("config/service-account.json"));
  const manifest = JSON.parse(await readFile(path.join(dir, "assets.manifest.json"), "utf8"));
  assert.ok(manifest.validation.findings.some((item) => item.id === "delivery.sensitive_file"));
  assert.ok(!manifest.files.some((item) => item.path === "config/service-account.json"));
  await assert.rejects(stat(zip));
});

test("an explicit delivery contract cannot package credential-like files", async (t) => {
  const dir = await fixture(t, {
    files: { "credentials/service-account.json": JSON.stringify({ private_key: "fixture-only" }) },
    artifacts: [{ path: "credentials/service-account.json", role: "support", required: true }],
  });
  const zip = path.join(tmpRoot, "sensitive-explicit.zip"), out = await exportProject(dir, zip);
  assert.equal(out.status, 2, allOutput(out));
  assert.match(allOutput(out), /delivery\.sensitive_file/);
  await assert.rejects(stat(zip));
});

test("missing optional artifact is allowed and omitted from the manifest/ZIP", async (t) => {
  const dir = await fixture(t, { files: { "out/final/card.png": tinyPng() }, producedRoots: ["out/final"], artifacts: [imageArtifact(), imageArtifact("out/final/optional.png", false)] });
  const zip = path.join(tmpRoot, "optional.zip"), out = await exportProject(dir, zip);
  assert.equal(out.status, 0, out.stderr || out.stdout);
  const manifest = JSON.parse(await readFile(path.join(dir, "assets.manifest.json"), "utf8"));
  assert.deepEqual(manifest.files.map((f) => f.path), ["out/final/card.png"]);
  const entries = zipEntries(zip);
  assert.ok(!entries.includes("out/final/optional.png"));
});

test("produced but undeclared files and duplicate/unsafe contract paths fail", async (t) => {
  const dir = await fixture(t, { files: { "out/final/card.png": tinyPng(), "out/final/extra.png": tinyPng() }, producedRoots: ["out/final"], artifacts: [imageArtifact()] });
  const out = await exportProject(dir, path.join(tmpRoot, "omitted.zip"));
  assert.equal(out.status, 2);
  assert.match(allOutput(out), /produced\.omitted/);
  const contractPath = path.join(dir, "delivery.contract.json");
  await writeFile(contractPath, JSON.stringify({ schemaVersion: 1, producedRoots: [], artifacts: [{ ...imageArtifact(), path: "../escape.png" }] }));
  assert.equal((await exportProject(dir, path.join(tmpRoot, "traversal-contract.zip"))).status, 2);
  await writeFile(contractPath, JSON.stringify({ schemaVersion: 1, producedRoots: [], artifacts: [imageArtifact(), imageArtifact()] }));
  assert.match(allOutput(await exportProject(dir, path.join(tmpRoot, "duplicate-contract.zip"))), /contract\.duplicate/);
});

test("source symlinks are rejected as nonportable delivery paths", async (t) => {
  const dir = await fixture(t, { files: { "out/final/source.png": tinyPng() }, producedRoots: ["out/final"], artifacts: [imageArtifact("out/final/alias.png")] });
  await symlink("source.png", path.join(dir, "out/final/alias.png"));
  const out = await exportProject(dir, path.join(tmpRoot, "symlink-source.zip"));
  assert.equal(out.status, 2);
  assert.match(allOutput(out), /file\.symlink/);
});

test("video with landing page packages local resources and stays portable", async (t) => {
  const mp4 = Buffer.alloc(96, 0x41); Buffer.from("ftypisom", "ascii").copy(mp4, 4);
  const html = '<!doctype html><link rel="stylesheet" href="site.css"><img src="assets/poster.png"><video poster="assets/poster.png" src="assets/trailer.mp4"></video>';
  const files = { "site/index.html": html, "site/site.css": "body{color:#fff}", "site/assets/poster.png": tinyPng(), "site/assets/trailer.mp4": mp4 };
  const artifacts = Object.keys(files).map((p) => ({ path: p, role: p.endsWith("index.html") ? "landing-page" : "support", required: true }));
  const dir = await fixture(t, { files, producedRoots: ["site"], artifacts });
  const zip = path.join(tmpRoot, "site-and-video.zip"), out = await exportProject(dir, zip);
  assert.equal(out.status, 0, out.stdout || out.stderr);
  assert.equal((await verifyProject(dir, zip)).status, 0);
});

test("missing local poster or imported stylesheet resource fails portability validation", async (t) => {
  const html = '<!doctype html><video poster="assets/missing.png"></video><style>@import "missing.css";</style>';
  const dir = await fixture(t, { files: { "site/index.html": html }, producedRoots: ["site"], artifacts: [{ path: "site/index.html", role: "landing-page", required: true }] });
  const out = await exportProject(dir, path.join(tmpRoot, "missing-site-resource.zip"));
  assert.equal(out.status, 2);
  assert.match(allOutput(out), /resource\.reference\.missing/);
});

test("real video metadata and audio codec must match the declared delivery spec", { skip: !haveFfmpeg && "NOT_TESTED: FFmpeg indisponível" }, async (t) => {
  const dir = await mkdtemp(path.join(tmpRoot, "real-video-")); t.after(async () => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, "site/assets"), { recursive: true });
  const video = path.join(dir, "site/assets/trailer.mp4");
  const made = ffmpeg(["-f", "lavfi", "-i", "testsrc=size=64x64:rate=10:duration=1", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ac", "1", "-shortest", video]);
  assert.equal(made.status, 0, made.stderr);
  const rel = "site/assets/trailer.mp4";
  const artifacts = [{ path: rel, role: "primary-video", mediaType: "video/mp4", required: true, spec: { width: 64, height: 64, fps: 10, codec: "h264", durationSec: 1, audioCodec: "aac", sampleRate: 48000, channels: 1 } }];
  const project = await fixture(t, { producedRoots: ["site"], artifacts });
  await mkdir(path.dirname(path.join(project, rel)), { recursive: true });
  await writeFile(path.join(project, rel), await readFile(video));
  const zip = path.join(tmpRoot, "real-video.zip");
  assert.equal((await exportProject(project, zip)).status, 0);
  const manifest = JSON.parse(await readFile(path.join(project, "assets.manifest.json"), "utf8"));
  const record = manifest.files.find((item) => item.path === rel);
  assert.equal(record.codec, "h264"); assert.equal(record.audioCodec, "aac");
  assert.equal(record.sampleRate, 48000); assert.equal(record.channels, 1);
});

test("large media uses ZIP64-compatible packaging and preserves bytes", async (t) => {
  const data = Buffer.alloc(3 * 1024 * 1024, 0x5a); Buffer.from("ftypisom", "ascii").copy(data, 4);
  const rel = "out/final/large.mp4";
  const dir = await fixture(t, { files: { [rel]: data }, producedRoots: ["out/final"], artifacts: [{ path: rel, role: "primary-video", mediaType: "video/mp4", required: true }] });
  const zip = path.join(tmpRoot, "large-media.zip"), out = await exportProject(dir, zip);
  assert.equal(out.status, 0, out.stdout || out.stderr);
  const extracted = path.join(tmpRoot, "large-extracted"); extractZip(zip, extracted);
  assert.equal(sha(await readFile(path.join(extracted, rel))), sha(data));
});

test("missing local fonts or license text fail before export; font provenance is mandatory", async (t) => {
  const html = '<!doctype html><style>@font-face{font-family:Test;src:url("assets/missing.woff2")}</style><p>test</p>';
  const dir = await fixture(t, { files: { "site/index.html": html }, producedRoots: ["site"], artifacts: [{ path: "site/index.html", role: "landing-page", required: true }], fonts: [{ family: "Test", path: "site/assets/missing.woff2", license: "OFL", licenseFile: "site/assets/OFL.txt", origin: "fixture", redistributable: true }] });
  const out = await exportProject(dir, path.join(tmpRoot, "font-missing.zip"));
  assert.equal(out.status, 2);
  assert.match(allOutput(out), /font\.missing|font\.reference\.missing/);
  assert.match(allOutput(out), /font\.license\.missing/);
});

test("manifest drift, ZIP hash mismatch, CRC corruption and traversal all fail verification", async (t) => {
  const dir = await fixture(t, { files: { "out/final/card.png": tinyPng() }, producedRoots: ["out/final"], artifacts: [imageArtifact()] });
  const zip = path.join(tmpRoot, "integrity.zip"); assert.equal((await exportProject(dir, zip)).status, 0);
  const manifestPath = path.join(dir, "assets.manifest.json"), originalManifest = await readFile(manifestPath);
  await writeFile(manifestPath, originalManifest.toString().replace('"schemaVersion": 1', '"schemaVersion": 2'));
  assert.equal((await verifyProject(dir, zip)).status, 2);
  await writeFile(manifestPath, originalManifest);

  const altered = path.join(tmpRoot, "hash-mismatch.zip");
  const rewrite = `import sys,zipfile\nsrc,dst,target=sys.argv[1:]\nwith zipfile.ZipFile(src) as a, zipfile.ZipFile(dst,'w',zipfile.ZIP_DEFLATED,allowZip64=True) as b:\n  for n in a.namelist():\n    d=a.read(n)\n    if n==target: d=d[:-1]+bytes([d[-1]^1])\n    b.writestr(n,d)\n`;
  const rewriteResult = spawnSync("python3", ["-c", rewrite, zip, altered, "out/final/card.png"], { encoding: "utf8" });
  assert.equal(rewriteResult.status, 0, rewriteResult.stderr);
  const hashResult = await verifyProject(dir, altered); assert.equal(hashResult.status, 2);
  assert.match(allOutput(hashResult), /zip\.sha256/);

  const corrupt = path.join(tmpRoot, "crc-corrupt.zip");
  const stored = python("import sys,zipfile\nsrc,dst=sys.argv[1:]\nwith zipfile.ZipFile(src) as a, zipfile.ZipFile(dst,'w',zipfile.ZIP_STORED,allowZip64=True) as b:\n  for n in a.namelist(): b.writestr(n,a.read(n),compress_type=zipfile.ZIP_STORED)\n", [zip, corrupt]);
  assert.equal(stored.status, 0, stored.stderr);
  const mutate = `import sys,struct,zipfile\np,n=sys.argv[1:]\nwith zipfile.ZipFile(p) as z: i=z.getinfo(n); off=i.header_offset\nb=bytearray(open(p,'rb').read()); nl,el=struct.unpack_from('<HH',b,off+26); b[off+30+nl+el]^=1; open(p,'wb').write(b)\n`;
  const corruptResult = spawnSync("python3", ["-c", mutate, corrupt, "out/final/card.png"], { encoding: "utf8" });
  assert.equal(corruptResult.status, 0, corruptResult.stderr);
  assert.equal((await verifyProject(dir, corrupt)).status, 2);

  const traversal = path.join(tmpRoot, "traversal.zip");
  const addTraversal = `import sys,zipfile\nsrc,dst=sys.argv[1:]\nwith zipfile.ZipFile(src) as a, zipfile.ZipFile(dst,'w',zipfile.ZIP_DEFLATED,allowZip64=True) as b:\n  for n in a.namelist(): b.writestr(n,a.read(n))\n  b.writestr('../escape.txt','no')\n`;
  const traversalResult = spawnSync("python3", ["-c", addTraversal, zip, traversal], { encoding: "utf8" });
  assert.equal(traversalResult.status, 0, traversalResult.stderr);
  const unsafe = await verifyProject(dir, traversal); assert.equal(unsafe.status, 2);
  assert.match(allOutput(unsafe), /zip\.path/);

  const duplicated = path.join(tmpRoot, "duplicate-entry.zip");
  const addDuplicate = `import sys,zipfile\nsrc,dst=sys.argv[1:]\nwith zipfile.ZipFile(src) as a, zipfile.ZipFile(dst,'w',zipfile.ZIP_DEFLATED,allowZip64=True) as b:\n  for n in a.namelist(): b.writestr(n,a.read(n))\n  b.writestr('out/final/card.png',a.read('out/final/card.png'))\n  b.writestr('/absolute.txt','no')\n`;
  const duplicateResult = spawnSync("python3", ["-c", addDuplicate, zip, duplicated], { encoding: "utf8" });
  assert.equal(duplicateResult.status, 0, duplicateResult.stderr);
  const duplicateReport = await verifyProject(dir, duplicated); assert.equal(duplicateReport.status, 2);
  assert.match(allOutput(duplicateReport), /zip\.duplicate/);
  assert.match(allOutput(duplicateReport), /zip\.path/);
});

test("metadata symlinks cannot overwrite outside files and malformed metadata returns FAIL JSON", async (t) => {
  const dir = await fixture(t, { files: { "out/final/card.png": tinyPng() }, producedRoots: ["out/final"], artifacts: [imageArtifact()] });
  const sentinel = path.join(tmpRoot, "outside-manifest-sentinel.txt");
  await writeFile(sentinel, "sentinel must remain intact");
  await symlink(sentinel, path.join(dir, "assets.manifest.json"));
  const unsafeWrite = await exportProject(dir, path.join(tmpRoot, "symlink-manifest.zip"));
  assert.equal(unsafeWrite.status, 2);
  assert.match(allOutput(unsafeWrite), /link simbólico/);
  assert.equal(await readFile(sentinel, "utf8"), "sentinel must remain intact");

  const manifestPath = path.join(dir, "assets.manifest.json");
  await rm(manifestPath);
  const zip = path.join(tmpRoot, "malformed-manifest.zip");
  assert.equal((await exportProject(dir, zip)).status, 0);
  await writeFile(manifestPath, "[]\n");
  const invalidManifest = await verifyProject(dir, zip);
  assert.equal(invalidManifest.status, 2);
  assert.match(allOutput(invalidManifest), /manifest\.schema/);

  await writeFile(path.join(dir, "delivery.contract.json"), "[]\n");
  const invalidContract = await exportProject(dir, path.join(tmpRoot, "malformed-contract.zip"));
  assert.equal(invalidContract.status, 2);
  assert.match(allOutput(invalidContract), /contrato inválido/);
  assert.doesNotMatch(allOutput(invalidContract), /Traceback/);
});

test("all packages declare Node 20+ and exact internal release versions", async () => {
  const dirs = ["motion-core", "motion-skills", "motion-cli", "motion-studio"];
  const packages = await Promise.all(dirs.map(async (name) => JSON.parse(await readFile(path.join(root, "packages", name, "package.json"), "utf8"))));
  const version = packages[0].version;
  assert.match(version, /^1\.1\.1$/);
  for (const pkg of packages) assert.ok(Number(pkg.engines.node.match(/\d+/)[0]) >= 20, `${pkg.name} Node engine`);
  for (const pkg of packages) for (const [name, v] of Object.entries(pkg.dependencies ?? {})) if (name.startsWith("@technomanceer/")) assert.equal(v, version, `${pkg.name} -> ${name}`);
});
