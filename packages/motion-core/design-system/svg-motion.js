/**
 * MOTION — design-system/svg-motion.js
 * SVG Motion Engine: deterministic, seekable vector animation.
 *
 * Contract (same as frame.js): state is a PURE function of time. `seek(M)` writes absolute values
 * from `M.time` (or frame/fps) — never reads the wall clock, never uses requestAnimationFrame,
 * CSS keyframes, SMIL or Math.random. Seeking frame 240 before frame 12 gives the same pixels.
 *
 *   import { createSvgMotion } from "@technomanceer/motion-core/svg-motion";
 *   const motion = createSvgMotion(document.querySelector("svg"), [
 *     { target: "[data-motion-path]", effect: "draw",  start: 0,   duration: 1.2, stagger: 0.08, easing: "outCubic" },
 *     { target: '[data-layer="node"]', effect: "pop",   start: 0.5, duration: 0.5, stagger: 0.05 },
 *   ]);
 *   window.__onFrame__ = (M) => motion.seek(M);
 *
 * Effects: draw, fade, translate, scale, rotate, pop, wobble, pulse, reveal, orbit, parallax, morph, gradient-shift, color.
 * Target ":scope" is the root element itself; ":scope > *" its direct children.
 * Numbers written to the DOM are rounded (4 decimals) so output is bit-stable across runs.
 */

const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;
const round = (n) => Math.round(n * 10000) / 10000;

export const easings = {
  linear: (p) => p,
  inQuad: (p) => p * p,
  outQuad: (p) => 1 - (1 - p) * (1 - p),
  inOutQuad: (p) => (p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2),
  outCubic: (p) => 1 - (1 - p) ** 3,
  inOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - ((-2 * p + 2) ** 3) / 2),
  outQuart: (p) => 1 - (1 - p) ** 4,
  outExpo: (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p)),
  inOutSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  /** Gentle overshoot (≈4%), for pops. Deliberately restrained — see CLAUDE.md "excessive bouncing". */
  outBack: (p) => { const c1 = 0.9, c3 = c1 + 1; return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2; },
  /** Critically-damped-ish analytic spring (no simulation, so fully deterministic). */
  spring: (p) => (p >= 1 ? 1 : 1 - Math.exp(-6 * p) * Math.cos(8 * p)),
};
export function resolveEasing(e) {
  if (typeof e === "function") return e;
  if (e === undefined) return easings.outCubic;
  if (!easings[e]) throw new Error(`svg-motion: easing desconhecido "${e}". Disponíveis: ${Object.keys(easings).join(", ")}`);
  return easings[e];
}

/** Progress of a window [start, start+duration] at time t, eased. */
export function progressAt(t, { start = 0, duration = 1, easing } = {}, delay = 0) {
  if (!(duration > 0)) return t >= start + delay ? 1 : 0;
  return resolveEasing(easing)(clamp01((t - start - delay) / duration));
}

// ---------- path morph ----------
const CMD = /([a-zA-Z])([^a-zA-Z]*)/g;
const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
export function parsePath(d) {
  const segs = [];
  for (const m of String(d).matchAll(CMD)) segs.push({ cmd: m[1], args: (m[2].match(NUM) ?? []).map(Number) });
  return segs;
}
/** Two paths can morph when they have identical command structure (same commands, same arg counts). */
export function canMorph(a, b) {
  const A = parsePath(a), B = parsePath(b);
  return A.length === B.length && A.every((s, i) => s.cmd === B[i].cmd && s.args.length === B[i].args.length);
}
export function interpolatePath(a, b, t) {
  if (!canMorph(a, b)) throw new Error("svg-motion: morph exige caminhos com a mesma estrutura de comandos (mesmos comandos e nº de coordenadas).");
  const A = parsePath(a), B = parsePath(b);
  return A.map((s, i) => `${s.cmd}${s.args.map((v, k) => round(lerp(v, B[i].args[k], t))).join(" ")}`).join("");
}

// ---------- color ----------
const hex = (c) => { const m = String(c).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i); if (!m) throw new Error(`svg-motion: cor inválida "${c}" (use #RGB ou #RRGGBB)`); const h = m[1].length === 3 ? [...m[1]].map((x) => x + x).join("") : m[1]; return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
export function lerpColor(a, b, t) { const A = hex(a), B = hex(b); return `#${A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, "0")).join("")}`; }

/**
 * Pure evaluation of one effect at eased progress p. Returns a plain style description;
 * the DOM layer only writes it. ctx = { length?, index?, count?, bbox? }
 */
export function evaluateEffect(effect, p, spec = {}, ctx = {}) {
  switch (effect) {
    case "draw": {
      const len = ctx.length ?? 1;
      return { attrs: { "stroke-dasharray": `${round(len)} ${round(len)}`, "stroke-dashoffset": round(len * (1 - p)) }, opacity: p > 0 ? 1 : 0 };
    }
    case "fade": return { opacity: round(lerp(spec.from ?? 0, spec.to ?? 1, p)) };
    case "translate": {
      const [fx, fy] = spec.from ?? [0, 0], [tx, ty] = spec.to ?? [0, 0];
      return { transform: `translate(${round(lerp(fx, tx, p))} ${round(lerp(fy, ty, p))})`, opacity: spec.fade === false ? undefined : round(clamp01(p * 4)) };
    }
    case "scale": return { transform: `scale(${round(lerp(spec.from ?? 0, spec.to ?? 1, p))})`, origin: "center" };
    case "rotate": return { transform: `rotate(${round(lerp(spec.from ?? 0, spec.to ?? 360, p))})`, origin: "center" };
    case "wobble": { // damped oscillation, settles at 0
      const a = (spec.amplitude ?? 12) * Math.sin(2 * Math.PI * (spec.cycles ?? 3) * p) * (1 - p);
      return { transform: `rotate(${round(a)})`, origin: spec.origin ?? "center" };
    }
    case "pulse": return { transform: `scale(${round(1 + (spec.amplitude ?? 0.12) * (0.5 - 0.5 * Math.cos(2 * Math.PI * (spec.cycles ?? 2) * p)))})`, origin: "center" };
    case "pop": return { transform: `scale(${round(lerp(spec.from ?? 0.6, 1, p))})`, opacity: round(clamp01(p * 3)), origin: "center" };
    case "reveal": {
      const dir = spec.direction ?? "left"; const rest = round((1 - p) * 100);
      const inset = { left: `0 ${rest}% 0 0`, right: `0 0 0 ${rest}%`, up: `0 0 ${rest}% 0`, down: `${rest}% 0 0 0` }[dir];
      if (!inset) throw new Error(`svg-motion: direction inválida "${dir}"`);
      return { style: { "clip-path": `inset(${inset})` }, opacity: p > 0 ? 1 : 0 };
    }
    case "orbit": {
      const r = ctx.orbit ?? spec.radius ?? 0, rev = spec.revolutions ?? 1, a = (ctx.phase ?? 0) + p * rev * Math.PI * 2;
      return { attrs: { cx: round((ctx.cx ?? 0) + Math.cos(a) * r), cy: round((ctx.cy ?? 0) + Math.sin(a) * r) } };
    }
    case "parallax": {
      const depth = ctx.depth ?? 0.5, [dx, dy] = spec.distance ?? [60, 0];
      return { transform: `translate(${round(dx * depth * (p - 0.5) * 2)} ${round(dy * depth * (p - 0.5) * 2)})` };
    }
    case "morph": return { attrs: { d: interpolatePath(spec.from, spec.to, p) } };
    case "gradient-shift": return { attrs: { gradientTransform: `translate(${round(lerp(spec.from ?? -1, spec.to ?? 1, p))} 0)` } };
    case "color": return { attrs: { [spec.attr ?? "fill"]: lerpColor(spec.from, spec.to, p) } };
    default: throw new Error(`svg-motion: efeito desconhecido "${effect}"`);
  }
}

// ---------- DOM layer ----------
function timeOf(M) { return M.time ?? ((M.frame ?? 0) / (M.fps ?? 30)); }
function resolveTargets(root, target) {
  if (typeof target !== "string") return [].concat(target);
  return target === ":scope" ? [root] : Array.from(root.querySelectorAll(target));
}
const ORIGINS = { center: "50% 50%", top: "50% 0%", bottom: "50% 100%", left: "0% 50%", right: "100% 50%" };

/**
 * @param {SVGElement} root
 * @param {object[]} timeline entries: { target, effect, start, duration, easing, stagger, ...effect params }
 */
export function createSvgMotion(root, timeline) {
  if (!root || typeof root.querySelectorAll !== "function") throw new Error("svg-motion: elemento raiz inválido");
  const steps = timeline.map((step, i) => {
    resolveEasing(step.easing); // fail early on typos
    const elements = resolveTargets(root, step.target);
    if (!elements.length) throw new Error(`svg-motion: nenhum elemento encontrado para "${step.target}" (passo ${i})`);
    const info = elements.map((el, k) => {
      const ctx = { index: k, count: elements.length };
      if (step.effect === "draw") ctx.length = typeof el.getTotalLength === "function" ? el.getTotalLength() : 1;
      if (step.effect === "orbit") {
        ctx.orbit = Number(el.dataset?.orbit ?? el.getAttribute("data-orbit") ?? step.radius ?? 0); ctx.phase = Number(el.getAttribute("data-phase") ?? 0);
        const c = el.ownerSVGElement?.viewBox?.baseVal; ctx.cx = step.cx ?? (c ? c.x + c.width / 2 : 0); ctx.cy = step.cy ?? (c ? c.y + c.height / 2 : 0);
      }
      if (step.effect === "parallax") ctx.depth = Number(el.getAttribute("data-depth") ?? 0.5);
      return { el, ctx };
    });
    return { step, info };
  });

  return {
    steps: steps.length,
    /** Total duration (s) of the timeline: useful to size --frames. */
    duration: Math.max(0, ...timeline.map((s) => (s.start ?? 0) + (s.duration ?? 1) + (s.stagger ?? 0) * Math.max(0, resolveTargets(root, s.target).length - 1))),
    seek(M) {
      const t = timeOf(M);
      for (const { step, info } of steps) {
        for (const { el, ctx } of info) {
          const p = progressAt(t, step, (step.stagger ?? 0) * ctx.index);
          const out = evaluateEffect(step.effect, p, step, ctx);
          if (out.attrs) for (const [k, v] of Object.entries(out.attrs)) el.setAttribute(k, v);
          if (out.transform !== undefined) {
            if (el === root) { // outer <svg>: CSS transform (the transform attribute is not reliable on the root element)
              el.style.transform = out.transform.replace(/rotate\(([-\d.e]+)\)/, "rotate($1deg)");
              el.style.transformOrigin = ORIGINS[out.origin ?? "center"];
            } else {
              el.setAttribute("transform", `${el.dataset?.baseTransform ?? el.getAttribute("data-base-transform") ?? ""} ${out.transform}`.trim());
              if (out.origin) { el.style.transformBox = "fill-box"; el.style.transformOrigin = ORIGINS[out.origin] ?? "center"; }
            }
          }
          if (out.style) for (const [k, v] of Object.entries(out.style)) el.style.setProperty(k, v);
          if (out.opacity !== undefined) el.style.opacity = String(out.opacity);
        }
      }
      return t;
    },
  };
}
