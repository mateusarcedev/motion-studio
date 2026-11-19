/**
 * MOTION Core — svg/builder.mjs
 * SVG Design Studio: original, parameterized, token-aware vector components.
 *
 * Every component:
 *   - returns a complete, validated SVG string (viewBox preserved, ids namespaced by `idPrefix`)
 *   - is deterministic (seeded PRNG; same params + seed → byte-identical output)
 *   - tags animatable parts with data-layer / data-motion-path so the SVG Motion Engine can drive them
 *   - takes colors from a palette derived from the brand tokens (never hard-coded)
 */
import { ERROR_CODES, MotionError } from "../lib/errors.mjs";
import { hashString } from "./shapes.mjs";
import { validateSvg } from "./svg-tools.mjs";

// ---------- palette ----------
const hex = (c) => { const m = String(c).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i); if (!m) return null; const h = m[1].length === 3 ? [...m[1]].map((x) => x + x).join("") : m[1]; return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const sat = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
export const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
export function contrastRatio(a, b) {
  const f = (c) => { const v = hex(c).map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const [l1, l2] = [f(a), f(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * Derives { bg, fg, primary, accent, muted, surface } from brand tokens.
 * Uses tokens.roles (role → color key or hex) when present; otherwise infers from the color set.
 */
export function paletteFromTokens(tokens = {}, { mode = "dark" } = {}) {
  const colors = tokens.color ?? tokens.colors ?? {};
  const entries = Object.entries(colors).map(([k, v]) => [k, typeof v === "string" ? v : v?.value]).filter(([, v]) => hex(v));
  const pick = (ref) => (ref && (colors[ref]?.value ?? colors[ref])) || (hex(ref) ? ref : null);
  const roles = tokens.roles ?? {};
  const byLum = [...entries].sort((a, b) => lum(hex(a[1])) - lum(hex(b[1])));
  const bySat = [...entries].sort((a, b) => sat(hex(b[1])) - sat(hex(a[1])));
  const dark = byLum[0]?.[1] ?? "#0B0F14", light = byLum.at(-1)?.[1] ?? "#F5F7FA";
  const bg = pick(roles.bg) ?? (mode === "dark" ? dark : light);
  const fg = pick(roles.fg) ?? (mode === "dark" ? light : dark);
  const primary = pick(roles.primary) ?? bySat.find(([, v]) => v !== bg && v !== fg)?.[1] ?? "#4F8CFF";
  const accent = pick(roles.accent) ?? bySat.find(([, v]) => v !== bg && v !== fg && v !== primary)?.[1] ?? mix(primary, fg, 0.45);
  const palette = { bg, fg, primary, accent, muted: mix(bg, fg, 0.45), surface: mix(bg, fg, 0.08) };
  palette.readable = contrastRatio(palette.fg, palette.bg) >= 4.5;
  return palette;
}

/** Replaces {{color.primary}}-style placeholders; unknown tokens are an error (no silent fallbacks). */
export function applyTokens(svg, tokens = {}) {
  const flat = {};
  const walk = (obj, prefix) => { for (const [k, v] of Object.entries(obj ?? {})) { const key = prefix ? `${prefix}.${k}` : k; if (v && typeof v === "object" && !("value" in v)) walk(v, key); else flat[key] = typeof v === "object" ? v.value : v; } };
  walk(tokens, "");
  return svg.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => {
    if (!(key in flat)) throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, `Token de design não encontrado: ${key}`, { hint: `Tokens disponíveis: ${Object.keys(flat).slice(0, 12).join(", ")}` });
    return String(flat[key]).replace(/["<>&]/g, "");
  });
}

// ---------- deterministic PRNG ----------
export function prng(seed) {
  let a = (typeof seed === "string" ? hashString(seed) : seed >>> 0) || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const zones = (avoid) => (!avoid ? [] : Array.isArray(avoid[0]) ? avoid : [avoid]);
const inRect = (p, avoid) => zones(avoid).some(([x, y, w, h]) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h);
function segmentHitsRect(a, b, avoid) { for (let t = 0; t <= 1; t += 0.02) if (inRect({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, avoid)) return true; return false; }
const r2 = (n) => Math.round(n * 100) / 100;

function doc({ viewBox, body, defs = "", title, idPrefix }) {
  const [x, y, w, h] = viewBox;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}" ${title ? 'role="img"' : 'aria-hidden="true"'} data-prefix="${idPrefix}">${title ? `<title>${title.replace(/[<>&"]/g, "")}</title>` : ""}${defs ? `<defs>${defs}</defs>` : ""}${body}</svg>`;
  const checked = validateSvg(svg, { trusted: true });
  if (!checked.ok) throw new MotionError(ERROR_CODES.SVG_INVALID, `Componente gerou SVG inválido: ${checked.findings[0]?.message}`, { details: checked.findings });
  return svg;
}
const base = (opts) => ({ palette: paletteFromTokens(opts.tokens, { mode: opts.mode ?? "dark" }), idPrefix: opts.idPrefix ?? "svg", seed: opts.seed ?? 1 });

export const components = {
  /** Multi-layer depth landscape: far→near vector waves, ONE hue ramped by depth (mixing complementary hues turns muddy). */
  waveLayers({ width = 1200, height = 675, layers = 5, amplitude = 0.12, hue = "accent", tokens, idPrefix, seed, mode } = {}) {
    const { palette, idPrefix: p, seed: s } = base({ tokens, idPrefix, seed, mode });
    const rnd = prng(s);
    let body = `<rect data-layer="sky" width="${width}" height="${height}" fill="url(#${p}__sky)"/>`;
    for (let i = 0; i < layers; i++) {
      const t = layers === 1 ? 1 : i / (layers - 1); // 0 far → 1 near
      const baseY = height * (0.45 + 0.4 * t), amp = height * amplitude * (0.5 + t * 0.9), freq = 1.2 + rnd() * 1.6 - t * 0.4, phase = rnd() * Math.PI * 2;
      let d = `M0 ${height}`;
      for (let x = 0; x <= width; x += width / 48) d += ` L${r2(x)} ${r2(baseY + Math.sin((x / width) * Math.PI * 2 * freq + phase) * amp + Math.sin((x / width) * 9 + phase) * amp * 0.18)}`;
      d += ` L${width} ${height} Z`;
      body += `<path data-layer="depth-${i}" data-depth="${r2(t)}" d="${d}" fill="${mix(palette.bg, palette[hue] ?? palette.accent, 0.12 + t * 0.6)}" opacity="${r2(0.55 + t * 0.45)}"/>`;
    }
    const defs = `<linearGradient id="${p}__sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(palette.bg, palette.primary, 0.18)}"/><stop offset="1" stop-color="${palette.bg}"/></linearGradient>`;
    return doc({ viewBox: [0, 0, width, height], body, defs, idPrefix: p });
  },

  /** Seeded node graph with edges that can be stroke-drawn (data-motion-path). `avoid: [x,y,w,h]` (or a list of them) keeps quiet zones (e.g. where text sits) free of nodes and edges. */
  networkGraph({ width = 1200, height = 675, nodes = 14, links = 2, avoid, tokens, idPrefix, seed, mode } = {}) {
    const { palette, idPrefix: p, seed: s } = base({ tokens, idPrefix, seed, mode });
    const rnd = prng(s), pts = [];
    const margin = Math.min(width, height) * 0.1;
    // Poisson-ish placement: reject points too close to existing ones (avoids clumps)
    for (let tries = 0; pts.length < nodes && tries < nodes * 60; tries++) {
      const pt = { x: margin + rnd() * (width - 2 * margin), y: margin + rnd() * (height - 2 * margin) };
      if (avoid && inRect(pt, avoid)) continue;
      if (pts.every((q) => Math.hypot(q.x - pt.x, q.y - pt.y) > Math.min(width, height) * 0.16)) pts.push(pt);
    }
    const edges = new Set();
    pts.forEach((a, i) => pts.map((b, j) => [j, Math.hypot(a.x - b.x, a.y - b.y)]).filter(([j]) => j !== i).sort((x, y) => x[1] - y[1]).slice(0, links).forEach(([j]) => edges.add(i < j ? `${i}-${j}` : `${j}-${i}`)));
    let body = "";
    [...edges].filter((e) => { if (!avoid) return true; const [i, j] = e.split("-").map(Number); return !segmentHitsRect(pts[i], pts[j], avoid); }).forEach((e, k) => { const [i, j] = e.split("-").map(Number); body += `<path data-layer="edge" data-motion-path="edge-${k}" d="M${r2(pts[i].x)} ${r2(pts[i].y)} L${r2(pts[j].x)} ${r2(pts[j].y)}" stroke="${palette.muted}" stroke-width="2" fill="none" stroke-linecap="round"/>`; });
    pts.forEach((pt, i) => { body += `<g data-layer="node" data-node="${i}"><circle cx="${r2(pt.x)}" cy="${r2(pt.y)}" r="${i % 5 === 0 ? 14 : 9}" fill="${i % 5 === 0 ? palette.primary : palette.accent}"/><circle cx="${r2(pt.x)}" cy="${r2(pt.y)}" r="${i % 5 === 0 ? 24 : 16}" fill="none" stroke="${i % 5 === 0 ? palette.primary : palette.accent}" stroke-opacity=".35" stroke-width="2"/></g>`; });
    return doc({ viewBox: [0, 0, width, height], body, idPrefix: p });
  },

  /** Progress ring (value 0–1) with a drawable arc. */
  ringProgress({ size = 256, value = 0.72, thickness = 18, tokens, idPrefix, seed, mode } = {}) {
    const { palette, idPrefix: p } = base({ tokens, idPrefix, seed, mode });
    const v = Math.max(0, Math.min(1, value)), r = (size - thickness) / 2, c = size / 2, circ = 2 * Math.PI * r;
    const body = `<circle data-layer="track" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${palette.surface}" stroke-width="${thickness}"/>` +
      `<circle data-layer="arc" data-motion-path="arc" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="url(#${p}__g)" stroke-width="${thickness}" stroke-linecap="round" stroke-dasharray="${r2(circ * v)} ${r2(circ)}" transform="rotate(-90 ${c} ${c})"/>`;
    const defs = `<linearGradient id="${p}__g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.primary}"/><stop offset="1" stop-color="${palette.accent}"/></linearGradient>`;
    return doc({ viewBox: [0, 0, size, size], body, defs, idPrefix: p });
  },

  /** Curved flow arrow (from→to) with an arrowhead; the shaft is drawable. */
  flowArrow({ width = 400, height = 160, curve = 0.35, tokens, idPrefix, seed, mode } = {}) {
    const { palette, idPrefix: p } = base({ tokens, idPrefix, seed, mode });
    const y0 = height * 0.7, y1 = height * 0.3, x0 = 16, x1 = width - 28, cx = (x0 + x1) / 2, cy = height * (0.5 - curve);
    const body = `<path data-layer="shaft" data-motion-path="shaft" d="M${x0} ${y0} Q${cx} ${r2(cy)} ${x1} ${y1}" fill="none" stroke="${palette.primary}" stroke-width="6" stroke-linecap="round"/>` +
      `<path data-layer="head" d="M${x1 - 18} ${y1 - 4} L${x1 + 8} ${y1} L${x1 - 10} ${y1 + 18}" fill="none" stroke="${palette.primary}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
    return doc({ viewBox: [0, 0, width, height], body, idPrefix: p });
  },

  /** Orbit rings with satellites (concentric, evenly eased by data-orbit radius). */
  orbitRings({ size = 600, rings = 4, tokens, idPrefix, seed, mode } = {}) {
    const { palette, idPrefix: p, seed: s } = base({ tokens, idPrefix, seed, mode });
    const rnd = prng(s), c = size / 2;
    let body = `<circle data-layer="core" cx="${c}" cy="${c}" r="${size * 0.06}" fill="${palette.primary}"/>`;
    for (let i = 1; i <= rings; i++) {
      const r = (size * 0.46 * i) / rings, a = rnd() * Math.PI * 2;
      body += `<circle data-layer="ring" data-motion-path="ring-${i}" cx="${c}" cy="${c}" r="${r2(r)}" fill="none" stroke="${palette.muted}" stroke-opacity="${r2(0.8 - i * 0.12)}" stroke-width="2"/>` +
        `<circle data-layer="satellite" data-orbit="${r2(r)}" data-phase="${r2(a)}" cx="${r2(c + Math.cos(a) * r)}" cy="${r2(c + Math.sin(a) * r)}" r="${r2(6 + (rings - i) * 1.5)}" fill="${i % 2 ? palette.accent : palette.primary}"/>`;
    }
    return doc({ viewBox: [0, 0, size, size], body, idPrefix: p });
  },

  /** Subtle grid/dot field for background texture (not a gradient fill). */
  gridPattern({ width = 1200, height = 675, step = 60, tokens, idPrefix, seed, mode } = {}) {
    const { palette, idPrefix: p } = base({ tokens, idPrefix, seed, mode });
    const defs = `<pattern id="${p}__grid" width="${step}" height="${step}" patternUnits="userSpaceOnUse"><path d="M${step} 0H0V${step}" fill="none" stroke="${palette.muted}" stroke-opacity=".25" stroke-width="1"/></pattern>`;
    return doc({ viewBox: [0, 0, width, height], body: `<rect data-layer="grid" width="${width}" height="${height}" fill="url(#${p}__grid)"/>`, defs, idPrefix: p });
  },
};

export function listComponents() { return Object.keys(components); }
export function buildComponent(name, params = {}) {
  if (!components[name]) throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, `Componente SVG desconhecido: ${name}`, { hint: `Disponíveis: ${listComponents().join(", ")}` });
  return components[name](params);
}
