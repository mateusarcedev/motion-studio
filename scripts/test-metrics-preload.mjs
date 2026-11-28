import childProcess from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { syncBuiltinESMExports } from "node:module";

const target = process.env.MOTION_TEST_METRICS_FILE;
const root = process.env.MOTION_TEST_ROOT ?? process.cwd();
if (target) {
  const relative = (value) => {
    if (!value) return null;
    const resolved = path.resolve(value);
    return resolved.startsWith(`${root}${path.sep}`) ? path.relative(root, resolved).split(path.sep).join("/") : path.basename(resolved);
  };
  const record = (event) => {
    try { fs.appendFileSync(target, `${JSON.stringify({ pid: process.pid, source: relative(process.argv[1]), ...event })}\n`); }
    catch { /* diagnostics must never interrupt the test under observation */ }
  };
  const commandText = (command, args) => ({
    command: String(command ?? "").toLowerCase(),
    args: Array.isArray(args) ? args.map(String).join(" ").toLowerCase() : "",
  });
  const kindFor = ({ command, args }) => {
    const base = path.basename(command.split(/\s+/)[0] ?? "");
    if (/^ffprobe(?:\.exe)?$/.test(base) || /^\s*ffprobe\s/.test(command)) return "ffprobe";
    if (/^ffmpeg(?:\.exe)?$/.test(base) || /^\s*ffmpeg\s/.test(command)) return /\.(?:mp4|mov|webm|mkv|avi)\b/.test(args) || /-filter_complex|-frames:v|-vf\s/.test(args) ? "ffmpeg-render" : "ffmpeg";
    if (/^(?:chrome|chromium|google-chrome)(?:\.exe)?$/.test(base)) return "chromium";
    if (/^(?:python|python3)(?:\.exe)?$/.test(base)) return "python";
    if (/^node(?:\.exe)?$/.test(base) && /motion\.mjs.*\bmcp\b|\bmcp\b.*stdio/.test(args)) return "mcp";
    if (/remotion|drive\.mjs|capture\.mjs|render_static\.mjs/.test(args) || (/^node(?:\.exe)?$/.test(base) && /motion\.mjs.*\brender\b/.test(args))) return "render";
    return "process";
  };

  for (const name of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]) {
    const original = childProcess[name];
    if (typeof original !== "function") continue;
    childProcess[name] = function instrumentedProcess(command, args, ...rest) {
      const parts = commandText(command, args);
      record({ type: "process-start", kind: kindFor(parts), command: path.basename(parts.command.split(/\s+/)[0] ?? "") });
      return original.call(this, command, args, ...rest);
    };
  }
  for (const [object, name] of [[fs, "mkdtempSync"], [fsPromises, "mkdtemp"]]) {
    const original = object[name];
    object[name] = function instrumentedFixture(...args) {
      record({ type: "fixture" });
      return original.apply(this, args);
    };
  }
  syncBuiltinESMExports();
  process.once("exit", () => {
    const usage = process.resourceUsage();
    record({ type: "resource", maxRssKB: usage.maxRSS, userCpuMs: usage.userCPUTime / 1000, systemCpuMs: usage.systemCPUTime / 1000 });
  });
}
