import { execSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist", "packages");

await mkdir(distDir, { recursive: true });

const pkgs = ["motion-core", "motion-skills", "motion-cli"];

console.log("📦 Empacotando pacotes distribuíveis do MOTION Studio...\n");

for (const pkg of pkgs) {
  const pkgDir = path.join(rootDir, "packages", pkg);
  const manifest = JSON.parse(await readFile(path.join(pkgDir, "package.json"), "utf8"));
  if (!manifest.name.startsWith("@technomanceer/") || manifest.version !== "1.0.0-rc.4") {
    throw new Error(`${pkg} precisa usar @technomanceer/* e 1.0.0-rc.4 antes do empacotamento`);
  }
  console.log(`Empacotando ${manifest.name}@${manifest.version}...`);
  const out = execSync("npm pack --pack-destination " + distDir, {
    cwd: pkgDir,
    encoding: "utf-8",
  }).trim();
  console.log(`  ✓ Gerado: dist/packages/${out}`);
}

console.log("\n🎉 Todos os pacotes foram empacotados com sucesso em dist/packages/");
