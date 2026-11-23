/**
 * MOTION Core — reel/overlays.mjs
 * Contextual cards, titles, lists and CTAs as HTML → transparent PNG through the studio's
 * Chromium renderer (render_static.mjs). Content comes only from the timeline (written by
 * the operator from the transcript); the engine never invents text, UI or metrics.
 */
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mapLimit, reelError, REEL_ERRORS, run, sha256Text, lastJsonObject } from "./util.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const RENDER_STATIC = path.join(here, "..", "renderers", "render_static.mjs");

export const DEFAULT_OVERLAY_STYLE = Object.freeze({
  bg: "rgba(18,22,20,0.94)", border: "rgba(46,230,166,0.35)", text: "#FFFFFF", muted: "#9FB3AA", accent: "#2EE6A6",
  accentInk: "#06140E", radius: 26, fontFamily: "Inter", monoFamily: "JetBrains Mono",
  fonts: [], // [{family, weight, file}] relative to fontsDir
  topY: 0.15, maxWidth: 0.78, shadow: "0 18px 50px rgba(0,0,0,.45)",
});

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function cardBody(o, step, st) {
  // progressive states reserve the final layout (hidden items keep their space), so a
  // cross-fade between states never shows two card outlines of different sizes
  const chip = (t, on, hidden) => `<span class="chip${on ? " on" : ""}"${hidden ? ' style="visibility:hidden"' : ""}>${esc(t)}</span>`;
  const shown = (i) => step === null || i <= step;
  switch (o.kind) {
    case "title":
      return `<div class="title">${(o.lines ?? []).map((l) => `<div class="tl${l.accent ? " acc" : ""}">${esc(l.text)}</div>`).join("")}</div>`;
    case "label": {
      // before the first reveal a titled card shows only its title (no reserved blank area)
      const chips = step === -1 && o.title ? [] : o.chips ?? [];
      return `${o.eyebrow ? `<div class="eyebrow"><i></i>${esc(o.eyebrow)}</div>` : ""}${o.title ? `<div class="ct">${o.strike ? `<s>${esc(o.strike)}</s>` : ""}${esc(o.title)}</div>` : ""}${chips.length ? `<div class="chips">${chips.map((c, i) => chip(c, step !== null && i === step, !shown(i))).join("")}</div>` : ""}`;
    }
    case "list": {
      const items = o.items ?? [];
      const active = step === null ? items.length - 1 : step;
      return `${o.eyebrow ? `<div class="eyebrow"><i></i>${esc(o.eyebrow)}</div>` : ""}<div class="list">${items.map((t, i) => `<div class="li${i === active ? " on" : ""}"${shown(i) ? "" : ' style="visibility:hidden"'}><b>${i + 1}</b>${esc(t)}</div>`).join("")}</div>`;
    }
    case "cta":
      return `<div class="cta"><div class="ct big acc">${esc(o.title)}</div>${o.subtitle ? `<div class="sub">${esc(o.subtitle)}</div>` : ""}${o.footer ? `<div class="foot">${esc(o.footer)}</div>` : ""}</div>`;
    default:
      throw reelError(REEL_ERRORS.OVERLAY_FAILED, `Tipo de overlay desconhecido: ${o.kind}`, { hint: "Use title, label, list ou cta." });
  }
}

/** Full-frame transparent HTML for one overlay state. */
export function overlayHtml(o, { width, height, style: styleIn = {}, step = null, fontCss = "" }) {
  const s = { ...DEFAULT_OVERLAY_STYLE, ...styleIn };
  const y = Math.round((o.position?.y ?? s.topY) * height);
  const scale = width / 1080;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss}
html,body{margin:0;width:${width}px;height:${height}px;background:transparent;overflow:hidden}
.card{position:absolute;left:0;right:0;margin:0 auto;width:max-content;top:${y}px;max-width:${Math.round(s.maxWidth * width)}px;box-sizing:border-box;
  background:${s.bg};border:${2 * scale}px solid ${s.border};border-radius:${s.radius * scale}px;padding:${26 * scale}px ${34 * scale}px;box-shadow:${s.shadow};
  font-family:'${s.fontFamily}',system-ui,sans-serif;color:${s.text};-webkit-font-smoothing:antialiased}
.eyebrow{white-space:nowrap;font-family:'${s.monoFamily}',ui-monospace,monospace;font-size:${32 * scale}px;color:${s.muted};display:flex;align-items:center;gap:${12 * scale}px;margin-bottom:${14 * scale}px;letter-spacing:.01em}
.eyebrow i{width:${10 * scale}px;height:${10 * scale}px;border-radius:50%;background:${s.accent};display:inline-block}
.ct{font-weight:700;font-size:${46 * scale}px;line-height:1.12;letter-spacing:-.01em}
.ct s{color:${s.muted};text-decoration-color:${s.accent};text-decoration-thickness:${4 * scale}px;margin-right:${14 * scale}px}
.big{font-size:${58 * scale}px}.acc{color:${s.accent}}
.title{text-align:center}.tl{font-weight:800;font-size:${64 * scale}px;line-height:1.08;letter-spacing:-.015em;text-transform:uppercase}
.chips{display:flex;flex-wrap:wrap;gap:${12 * scale}px;margin-top:${4 * scale}px}
.chip{font-family:'${s.monoFamily}',ui-monospace,monospace;font-weight:700;font-size:${32 * scale}px;padding:${8 * scale}px ${16 * scale}px;border-radius:${10 * scale}px;background:rgba(255,255,255,.07);border:${2 * scale}px solid rgba(255,255,255,.12)}
.chip.on{background:${s.accent};color:${s.accentInk};border-color:${s.accent}}
.list{display:flex;flex-direction:column;gap:${12 * scale}px}
.li{display:flex;align-items:center;gap:${16 * scale}px;font-weight:700;font-size:${40 * scale}px;color:rgba(255,255,255,.62)}
.li b{font-family:'${s.monoFamily}',ui-monospace,monospace;font-size:${28 * scale}px;width:${42 * scale}px;height:${42 * scale}px;border-radius:${10 * scale}px;display:grid;place-items:center;background:rgba(255,255,255,.08);color:${s.muted}}
.li.on{color:${s.text}}.li.on b{background:${s.accent};color:${s.accentInk}}
.cta{text-align:center}.sub{font-weight:700;font-size:${36 * scale}px;margin-top:${8 * scale}px}.foot{font-family:'${s.monoFamily}',ui-monospace,monospace;font-size:${24 * scale}px;color:${s.muted};margin-top:${14 * scale}px}
</style></head><body><div class="card" data-kind="${esc(o.kind)}">${cardBody(o, step, s)}</div></body></html>`;
}

/**
 * Copies declared font files to the work dir and returns @font-face CSS pointing at them.
 * Fonts belong to the project (docs/FONTS.md); none are bundled with MOTION.
 */
export async function prepareFonts(fontsDir, fonts, workDir) {
  if (!fontsDir || !fonts?.length) return { css: "", files: [] };
  const dest = path.join(workDir, "fonts");
  await mkdir(dest, { recursive: true });
  const files = [];
  let css = "";
  for (const f of fonts) {
    const src = path.join(fontsDir, f.file);
    if (!existsSync(src)) throw reelError(REEL_ERRORS.OVERLAY_FAILED, `Fonte declarada não encontrada: ${src}`, { hint: "Declare apenas fontes presentes na pasta de fontes do projeto." });
    await copyFile(src, path.join(dest, path.basename(f.file)));
    const fmt = f.file.endsWith(".woff2") ? "woff2" : f.file.endsWith(".woff") ? "woff" : f.file.endsWith(".otf") ? "opentype" : "truetype";
    css += `@font-face{font-family:'${f.family}';font-weight:${f.weight ?? 400};font-style:normal;src:url('fonts/${path.basename(f.file)}') format('${fmt}');font-display:block}\n`;
    files.push(src);
  }
  return { css, files };
}

/** Expands overlays into timed PNG layers (one per state for progressive cards). */
export function overlayLayers(overlays) {
  const layers = [];
  for (const o of overlays) {
    const steps = (o.steps ?? []).filter((s) => s.dst !== null && s.dst !== undefined);
    if (!steps.length) { layers.push({ overlay: o, step: null, start: o.dst[0], end: o.dst[1], enter: true, exit: true }); continue; }
    steps.sort((a, b) => a.dst - b.dst);
    // first reveal comes later than the card: show the card's empty state until then
    if (steps[0].dst > o.dst[0] + 0.05) layers.push({ overlay: o, step: -1, start: o.dst[0], end: Math.min(o.dst[1], steps[0].dst + (o.title ? 0 : 0.2)), enter: true, exit: false, crossfade: false });
    const hasEmpty = steps[0].dst > o.dst[0] + 0.05;
    steps.forEach((st, k) => {
      const start = k === 0 && !hasEmpty ? o.dst[0] : st.dst;
      const next = steps[k + 1]?.dst;
      layers.push({ overlay: o, step: k, start, end: next !== undefined ? Math.min(o.dst[1], next + 0.2) : o.dst[1], enter: k === 0 && !hasEmpty, exit: next === undefined, crossfade: k > 0 || (hasEmpty && !o.title) });
    });
  }
  return layers;
}

/** Texts a layer shows on screen (what the viewer can read, not what is reserved). */
export function layerTexts({ overlay: o, step }) {
  const upTo = (list) => (list ?? []).slice(0, step === null ? undefined : step + 1);
  return [o.title, o.subtitle, ...(o.lines ?? []).map((l) => l.text), ...upTo(o.chips), ...upTo(o.items)].filter(Boolean).map(String);
}

/** Renders every overlay layer to a transparent full-frame PNG. Returns layers with png paths and QA. */
export async function renderOverlayLayers(overlays, { width, height, style = {}, fontsDir = null, workDir, concurrency = 2 }) {
  const layers = overlayLayers(overlays);
  if (!layers.length) return [];
  await mkdir(workDir, { recursive: true });
  const { css } = await prepareFonts(fontsDir, style.fonts ?? DEFAULT_OVERLAY_STYLE.fonts, workDir);
  return mapLimit(layers, concurrency, async (layer) => {
    const html = overlayHtml(layer.overlay, { width, height, style, step: layer.step, fontCss: css });
    const key = sha256Text(html).slice(0, 16);
    const htmlFile = path.join(workDir, `${layer.overlay.id}-${layer.step ?? 0}-${key}.html`);
    const png = htmlFile.replace(/\.html$/, ".png");
    await writeFile(htmlFile, html);
    if (!existsSync(png)) {
      const r = await run("node", [RENDER_STATIC, htmlFile, png, `--width=${width}`, `--height=${height}`, "--scale=1", "--transparent", "--wait=150", "--qa-visual", "--qa-context=video-vertical"], { timeoutMs: 120000 });
      const j = lastJsonObject(r.stdout);
      if (r.code !== 0 || !existsSync(png)) throw reelError(REEL_ERRORS.OVERLAY_FAILED, `Falha ao renderizar o overlay ${layer.overlay.id}.`, { details: j?.error ?? r.stderr.trim().split("\n").slice(-3).join(" | "), hint: "Rode motion doctor para verificar o Chromium.", exitCode: j?.error?.code?.startsWith("MOTION_BROWSER") ? 3 : 2 });
      await writeFile(png + ".qa.json", JSON.stringify({ status: j?.status, fonts: j?.fonts, overflow: j?.overflow, visual: j?.visual }, null, 2));
      layer.qa = { status: j?.status, fontsLoaded: j?.fonts?.status === "loaded", overflow: j?.overflow?.length ?? 0, visual: j?.visual ?? null };
    } else layer.qa = { status: "CACHED" };
    return { ...layer, png, html: htmlFile };
  });
}

export const OVERLAY_KINDS = Object.freeze(["title", "label", "list", "cta"]);
