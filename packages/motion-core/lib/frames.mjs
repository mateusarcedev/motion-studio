/**
 * MOTION Core — frames.mjs
 * Parsing/validation of frame selections shared by the renderer, the Core API and the CLI.
 *
 * Accepted syntax (comma separated):  0,120,240-250,899
 *   - single index:  N
 *   - inclusive range: A-B  (A <= B)
 * Order is preserved. Duplicates and out-of-range indexes are rejected with a precise message.
 */
import { ERROR_CODES, MotionError } from "./errors.mjs";

const MAX_SELECTION = 100000;

/**
 * @param {string|number[]|undefined|null} spec
 * @param {number} totalFrames
 * @returns {number[]|null} null when no selection was requested
 */
export function parseFrameSelection(spec, totalFrames) {
  if (spec === undefined || spec === null || spec === false) return null;
  if (!Number.isInteger(totalFrames) || totalFrames < 1) {
    throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, "O total de quadros (--frames) deve ser um inteiro positivo.", { exitCode: 2 });
  }
  const fail = (message, details) => new MotionError(ERROR_CODES.INVALID_SAMPLE_FRAMES, message, {
    hint: `Use índices entre 0 e ${totalFrames - 1}, ex.: --sample-frames=0,${Math.floor(totalFrames / 2)},${totalFrames - 1}`, details, exitCode: 2,
  });
  if (spec === true || (typeof spec === "string" && spec.trim() === "")) throw fail("--sample-frames precisa de uma lista de quadros.");

  const tokens = Array.isArray(spec) ? spec.map(String) : String(spec).split(",").map((s) => s.trim());
  const out = [];
  for (const token of tokens) {
    if (/^\d+$/.test(token)) { out.push(Number(token)); continue; }
    const range = token.match(/^(\d+)-(\d+)$/);
    if (range) {
      const a = Number(range[1]), b = Number(range[2]);
      if (a > b) throw fail(`Intervalo inválido "${token}": o início é maior que o fim.`, { token });
      if (b - a + 1 > MAX_SELECTION) throw fail(`Intervalo "${token}" é grande demais.`, { token });
      for (let i = a; i <= b; i++) out.push(i);
      continue;
    }
    throw fail(`Valor inválido em --sample-frames: "${token}". Use inteiros não negativos ou intervalos A-B.`, { token });
  }
  if (!out.length) throw fail("--sample-frames não contém nenhum quadro.");
  const outOfRange = out.filter((f) => f >= totalFrames);
  if (outOfRange.length) throw fail(`Quadros fora do intervalo 0–${totalFrames - 1}: ${[...new Set(outOfRange)].join(", ")}.`, { outOfRange });
  const counts = new Map();
  for (const f of out) counts.set(f, (counts.get(f) ?? 0) + 1);
  const duplicates = [...counts].filter(([, n]) => n > 1).map(([f]) => f);
  if (duplicates.length) throw fail(`Quadros duplicados em --sample-frames: ${duplicates.join(", ")}.`, { duplicates });
  return out;
}

export function frameFileName(frame) {
  return `${String(frame).padStart(4, "0")}.png`;
}
