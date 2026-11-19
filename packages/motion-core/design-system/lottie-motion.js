/**
 * MOTION — design-system/lottie-motion.js
 * Deterministic Lottie playback for frame renders: the animation state is a pure function of time.
 * Uses the bundled lottie-web "light" SVG player (no expression engine) and `goToAndStop(frame, true)`,
 * never autoplay/requestAnimationFrame, so frame N always shows the same Lottie frame.
 *
 *   import { createLottieMotion } from "@technomanceer/motion-core/lottie";
 *   const lm = await createLottieMotion(document.getElementById("box"), animationData, { loop: true });
 *   window.__onFrame__ = (M) => lm.seek(M);
 */
let loading = null;
export function loadLottieRuntime(src = "/@motion/assets/vendor/lottie_light.min.js") {
  if (globalThis.lottie) return Promise.resolve(globalThis.lottie);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.onload = () => resolve(globalThis.lottie); s.onerror = () => reject(new Error(`lottie-motion: runtime não carregou (${src})`));
    document.head.appendChild(s);
  });
  return loading;
}

/** Maps composition time to a Lottie frame (pure). */
export function lottieFrameAt(t, { ip, op, fr }, { start = 0, loop = false, speed = 1, hold = true } = {}) {
  const frames = op - ip;
  const local = (t - start) * fr * speed;
  if (local <= 0) return ip;
  if (loop) return ip + (local % frames);
  return hold ? ip + Math.min(local, frames - 0.001) : ip + local;
}

export async function createLottieMotion(container, animationData, opts = {}) {
  if (animationData?.layers === undefined) throw new Error("lottie-motion: animationData inválido");
  const lottie = await loadLottieRuntime(opts.runtimeSrc);
  const meta = { ip: animationData.ip, op: animationData.op, fr: animationData.fr };
  let anim = null, lastFrame = null;
  const build = () => {
    anim?.destroy(); container.replaceChildren();
    anim = lottie.loadAnimation({ container, renderer: "svg", loop: false, autoplay: false, animationData: structuredClone(animationData), rendererSettings: { preserveAspectRatio: opts.preserveAspectRatio ?? "xMidYMid meet", progressiveLoad: false } });
  };
  build();
  await new Promise((resolve, reject) => { if (anim.isLoaded) return resolve(); anim.addEventListener("DOMLoaded", resolve); anim.addEventListener("data_failed", () => reject(new Error("lottie-motion: falha ao carregar dados"))); });
  return {
    meta, duration: (meta.op - meta.ip) / meta.fr,
    seek(M) {
      const t = M.time ?? ((M.frame ?? 0) / (M.fps ?? 30));
      const f = Math.round(lottieFrameAt(t, meta, opts) * 1000) / 1000;
      if (f === lastFrame) return f;
      // lottie-web keeps per-property keyframe caches: the pixels at frame N depend on which frames were visited before
      // (verified: visiting the last frame first changes frame 12). To make the result a pure function of N, the player
      // is rebuilt on every distinct seek (cheap for typical UI animations).
      if (lastFrame !== null) build();
      anim.goToAndStop(f, true);
      lastFrame = f;
      return f;
    },
    destroy() { anim?.destroy(); },
  };
}
