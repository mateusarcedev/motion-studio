import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "ffmpeg.py");

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [SCRIPT, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(JSON.parse(stdout));
      else reject(new Error(stderr.trim() || `transition renderer exited with code ${code}`));
    });
  });
}

export async function listTransitions() {
  return run(["list"]);
}

export async function renderTransition(inputs, output, transition = {}, options = {}) {
  if (!Array.isArray(inputs) || inputs.length < 2) throw new TypeError("inputs must contain at least two scene files");
  if (!output) throw new TypeError("output is required");
  const resolvedOutput = path.resolve(output);
  await mkdir(path.dirname(resolvedOutput), { recursive: true });
  const args = ["render", ...inputs.map((input) => path.resolve(input)), "--output", resolvedOutput, "--transition", JSON.stringify(transition)];
  if (options.fps) args.push("--fps", String(options.fps));
  if (options.width) args.push("--width", String(options.width));
  if (options.height) args.push("--height", String(options.height));
  if (options.crf !== undefined) args.push("--crf", String(options.crf));
  return run(args);
}
