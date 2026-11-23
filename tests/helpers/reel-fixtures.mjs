/**
 * Short synthetic fixtures for the reel engine (no model downloads, no private footage).
 * Every signal is seeded or closed-form, so the same FFmpeg build produces the same samples.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export const ff = (args) => spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8" });
const must = (args, what) => { const r = ff(args); if (r.status !== 0) throw new Error(`fixture ${what}: ${r.stderr}`); };

/** Speech-like bursts with known bounds (s): the reference for every timing assertion. */
export const BURSTS = Object.freeze([[0.5, 1.7], [2.6, 3.6], [3.8, 5.2], [6.2, 7.4]]);
export const DURATION = 8;

/** Voiced harmonics gated by BURSTS plus seeded pink noise at a controlled level. */
export async function noisySpeechWav(dir, { noiseDb = -45, name = "speech", bursts = BURSTS, duration = DURATION, seed = 7 } = {}) {
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, `${name}-${noiseDb}.wav`);
  if (existsSync(out)) return out;
  const gate = bursts.map(([a, b]) => `between(t,${a},${b})`).join("+");
  const voice = `(0.25*sin(2*PI*180*t)+0.12*sin(2*PI*360*t)+0.06*sin(2*PI*1200*t)+0.03*sin(2*PI*2600*t))*(0.6+0.4*sin(2*PI*4*t))*(${gate})`;
  must(["-f", "lavfi", "-i", `aevalsrc=exprs='${voice}':s=48000:d=${duration}`, "-f", "lavfi", "-i", `anoisesrc=color=pink:seed=${seed}:sample_rate=48000:duration=${duration}:amplitude=1`,
    // breath: aperiodic energy inside the bursts (pure harmonics make latency correlation ambiguous)
    "-f", "lavfi", "-i", `anoisesrc=color=pink:seed=${seed + 1}:sample_rate=48000:duration=${duration}:amplitude=1`,
    "-filter_complex", `[1:a]volume=${noiseDb + 13}dB[n];[2:a]volume='0.3*(0.6+0.4*sin(2*PI*5.3*t))*(${gate})':eval=frame,asetnsamples=48[b];[0:a][n][b]amix=inputs=3:normalize=0[out]`, "-map", "[out]", "-c:a", "pcm_s24le", out], "fala com ruído");
  return out;
}

/** Vertical video carrying an audio file (stereo AAC, 30 fps). */
export async function verticalVideo(dir, wav, { name = "talk", duration = DURATION, size = "1080x1920" } = {}) {
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, `${name}.mp4`);
  if (existsSync(out)) return out;
  must(["-f", "lavfi", "-i", `testsrc2=s=${size}:r=30:d=${duration}`, "-i", wav, "-filter_complex", "[1:a]pan=stereo|c0=c0|c1=c0[a]", "-map", "0:v", "-map", "[a]",
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-t", String(duration), out], "vídeo vertical");
  return out;
}

/** Transcript whose words sit inside BURSTS (3 words per burst), bound to one media hash. */
export function burstTranscript(sha256, file, bursts = BURSTS, vocabulary = null) {
  const pool = vocabulary ?? ["teste", "de", "corte", "com", "fala", "real", "legenda", "no", "tempo", "fim", "do", "vídeo"];
  const words = [];
  bursts.forEach(([a, b], k) => { const step = (b - a) / 3; for (let i = 0; i < 3; i++) words.push({ id: `w${String(words.length + 1).padStart(4, "0")}`, text: pool[(k * 3 + i) % pool.length], start: +(a + i * step).toFixed(3), end: +(a + (i + 1) * step - 0.02).toFixed(3), confidence: 0.95, timing: "word" }); });
  return { schema: "motion.transcript", schemaVersion: 1, scope: "full-media", provider: { id: "fixture" }, language: "pt", languageProbability: 1, source: { path: file, sha256 }, words,
    segments: bursts.map(([a, b], k) => ({ id: `t${k}`, start: a, end: b, wordIds: words.slice(k * 3, k * 3 + 3).map((w) => w.id) })), review: [], corrections: [], warnings: [] };
}
