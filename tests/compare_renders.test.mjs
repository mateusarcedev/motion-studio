/** compareRenders: locates a difference (video, audio, container) and never calls a read error a difference. */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reel as R } from "../packages/motion-core/index.js";
import { ff } from "./helpers/reel-fixtures.mjs";

const tmp = path.join(path.dirname(fileURLToPath(import.meta.url)), "tmp", "compare-renders");
const p = (n) => path.join(tmp, n);
const make = (name, { hz = 440, src = "testsrc2", extra = [] } = {}) => {
  const r = ff(["-f", "lavfi", "-i", `${src}=s=160x120:r=30:d=1`, "-f", "lavfi", "-i", `sine=f=${hz}:r=48000:d=1`, "-c:v", "libx264", "-threads", "1", "-pix_fmt", "yuv420p", "-c:a", "aac", "-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact", ...extra, p(name)]);
  assert.equal(r.status, 0, r.stderr);
};
before(async () => {
  await rm(tmp, { recursive: true, force: true }); await mkdir(tmp, { recursive: true });
  make("a.mp4"); make("same.mp4"); make("audio.mp4", { hz: 880 }); make("video.mp4", { src: "testsrc" });
  make("meta.mp4", { extra: ["-metadata", "title=other"] });
  const bytes = await readFile(p("a.mp4"));
  await writeFile(p("cut.mp4"), bytes.subarray(0, bytes.length >> 1));
});

test("arquivos iguais: identical, sem camada diferente", async () => {
  const c = await R.compareRenders(p("a.mp4"), p("same.mp4"));
  assert.equal(c.status, "identical"); assert.deepEqual(c.different, []);
});
test("diferença só no áudio e só no vídeo aparece no stream certo", async () => {
  const a = await R.compareRenders(p("a.mp4"), p("audio.mp4"));
  assert.equal(a.status, "different"); assert.deepEqual(a.different, ["audio.decoded", "audio.packets", "container"]);
  const v = await R.compareRenders(p("a.mp4"), p("video.mp4"));
  assert.deepEqual(v.different, ["video.decoded", "video.packets", "container"]);
});
test("só o contêiner muda: quadros e amostras continuam idênticos", async () => {
  const c = await R.compareRenders(p("a.mp4"), p("meta.mp4"));
  assert.equal(c.status, "identical"); assert.deepEqual(c.different, ["container"]);
});
test("arquivo ausente ou truncado é read-error com detalhe, nunca diferença", async () => {
  for (const f of ["missing.mp4", "cut.mp4"]) {
    const c = await R.compareRenders(p("a.mp4"), p(f));
    assert.equal(c.status, "read-error", f); assert.equal(c.identical, null, "an unreadable stream has no confirmed identity result"); assert.deepEqual(c.different, []);
    assert.ok(c.errors[0].file.endsWith(f)); assert.ok(c.errors[0].stderr);
  }
});
