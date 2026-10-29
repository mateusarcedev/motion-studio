/**
 * MOTION — design-system/frame.js
 * Driver determinístico de composição por frame (compartilhado por
 * motion-director, story-studio e qualquer peça animada do estúdio).
 *
 * Contrato: o renderer injeta `window.__MOTION__` = { frame, time, seed, fps,
 * totalFrames, vars }. A composição NUNCA usa setInterval/CSS-keyframes para
 * animação de vídeo — calcula estado puro a partir do frame. Assim o frame N
 * reproduz bit a bit (seekable, QA por stills, retry barato).
 *
 * Uso: <script src="../../creative-core/design-system/frame.js"></script>
 *      const { at, ease, lerp } = motion.frame;
 */
export function createMotionDriver(M) {
  const fps = M.fps ?? 30;
  const frame = M.frame ?? 0;
  const total = M.totalFrames ?? 0;
  const t = frame / fps;            // segundos — grade temporal única (áudio idem)

  const seeded = (n) => {
    // hash determinístico (mulberry-ish) — nada de Math.random() em vídeo
    let h = (frame * 374761393 + n * 668265263 + (M.seed ?? 0) * 2147483647) >>> 0;
    h = (h ^ (h >>> 13)) * 1274126177 >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };

  const window_ = (s, dur, fps = 30) => ({
    start: s, end: s + dur,
    progress: Math.min(1, Math.max(0, (t - s) / dur)),
  });

  const ease = {
    linear: (p) => p,
    outCubic: (p) => 1 - Math.pow(1 - p, 3),
    inOutCubic: (p) => p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2,
    outBack: (p) => 1 + 2.7 * Math.pow(p - 1, 3) + 1.7 * Math.pow(p - 1, 2),
    outExpo: (p) => p === 1 ? 1 : 1 - Math.pow(2, -10 * p),
  };

  const lerp = (a, b, p) => a + (b - a) * p;

  const window_010 = (s, inDur, outDur = inDur, hold = 0) => {
    const inP = Math.min(1, Math.max(0, (t - s) / inDur));
    const outP = Math.min(1, Math.max(0, (t - (s + inDur + hold)) / outDur));
    return { in: ease.outCubic(inP), out: ease.outCubic(outP) };
  };

  return {
    t, frame, fps, total, progress: total ? frame / total : null,
    vars: M.vars ?? {},
    rand: seeded, window: window_, window010: window_010, ease, lerp,
    on: (beatSec, tol = 0) => Math.abs(t - beatSec) <= tol,
  };
}

export default createMotionDriver;
