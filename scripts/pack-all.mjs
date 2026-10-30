import { execSync } from "node:child_process";
import { mkdir, readdir, copyFile } from "node:fs/promises";
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
  console.log(`Empacotando ${pkg}...`);
  const out = execSync("npm pack --pack-destination " + distDir, {
    cwd: pkgDir,
    encoding: "utf-8",
  }).trim();
  console.log(`  ✓ Gerado: dist/packages/${out}`);
}

console.log("\n🎉 Todos os pacotes foram empacotados com sucesso em dist/packages/");
