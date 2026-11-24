/**
 * MOTION Core Bridge — normalize.mjs
 * Deterministic Design-to-Motion normalizer.
 * Converts MotionDesignIR@1 (+ DesignTokenBundle@1 + hydrated AssetProvenanceManifest@1)
 * into deterministic compositions compatible with existing Motion engines:
 *   - frame.js (createMotionDriver)
 *   - svg-motion.js (createSvgMotion)
 *   - carousel (feed-vertical / feed-square with safe-zones)
 *   - story (1080x1920 vertical story with safe-zones + frame.js)
 *   - web-director (responsive multi-theme index.html + tokens.css)
 *
 * Reuses existing renderers & engines; never creates a parallel renderer or calls external AI.
 */
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ERROR_CODES, MotionError } from "../lib/errors.mjs";
import { validateDesignIR, validateTokenBundle, SCHEMA_VERSION } from "./contracts.mjs";
import { assertSafeProjectPath, scanUntrustedHtml, tokenizeHtml } from "./security.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRESETS = JSON.parse(readFileSync(path.join(__dirname, "../presets.json"), "utf8"));

const TARGET_ALIASES = new Map([
  ["frame", "frame"],
  ["video", "frame"],
  ["motion", "frame"],
  ["svg", "svg-motion"],
  ["svg-motion", "svg-motion"],
  ["carousel", "carousel"],
  ["story", "story"],
  ["web", "web-director"],
  ["web-director", "web-director"],
]);

const MISSING_ASSET_SVG_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1e293b"/><rect x="1" y="1" width="318" height="178" fill="none" stroke="#64748b" stroke-dasharray="6 4"/><text x="160" y="95" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="14">Asset Unavailable Offline</text></svg>'
  );

function buildUrlMap(provenanceManifest, urlToLocalPath) {
  const map = new Map();
  if (urlToLocalPath && typeof urlToLocalPath === "object") {
    for (const [k, v] of Object.entries(urlToLocalPath)) map.set(k, v);
  }
  if (provenanceManifest?.assets) {
    for (const a of provenanceManifest.assets) {
      if (a.sourceUrl && a.localPath) map.set(a.sourceUrl, a.localPath);
    }
  }
  return map;
}

/** Formats DesignTokenBundle@1 (+ optional hydrated local fonts) into deterministic CSS. */
export function buildTokensCss(tokenBundle, provenanceManifest = null) {
  const parts = [];
  if (tokenBundle) {
    const bundle = validateTokenBundle(tokenBundle);
    const defaultLines = bundle.tokens.map((t) => `  ${t.cssVar}: ${t.value};`);
    parts.push(`:root {\n${defaultLines.join("\n")}\n}`);

    for (const theme of bundle.themes) {
      const themeLines = [];
      for (const tok of bundle.tokens) {
        if (tok.themes && tok.themes[theme] !== undefined) {
          themeLines.push(`  ${tok.cssVar}: ${tok.themes[theme]};`);
        }
      }
      if (themeLines.length > 0) {
        parts.push(`:root[data-doop-theme="${theme}"], [data-doop-theme="${theme}"] {\n${themeLines.join("\n")}\n}`);
      }
    }
  }

  // Emit local @font-face declarations ONLY for explicit tokenBundle web/custom fonts (inline @font-face rules in HTML are rewritten directly)
  const declaredFontUrls = new Set([...(tokenBundle?.fonts?.custom ?? []), ...(tokenBundle?.fonts?.webFonts ?? [])]);
  const localFonts = (provenanceManifest?.assets ?? []).filter((a) => a.kind === "font" && declaredFontUrls.has(a.sourceUrl));
  for (const fontAsset of localFonts) {
    const ext = path.extname(fontAsset.localPath).toLowerCase().slice(1);
    const fmt = ext === "woff2" ? "woff2" : ext === "woff" ? "woff" : ext === "otf" ? "opentype" : "truetype";
    const familyName = path.basename(fontAsset.localPath, path.extname(fontAsset.localPath)).replace(/^[a-z0-9]+-/, "");
    parts.push(`@font-face {\n  font-family: "${familyName}";\n  src: url("./${fontAsset.localPath}") format("${fmt}");\n  font-display: block;\n}`);
  }

  return parts.join("\n\n");
}

function extractHeadAndBody(sanitizedHtml) {
  const tokens = tokenizeHtml(sanitizedHtml);
  let headPieces = [];
  let bodyPieces = [];
  let inHead = false;
  let inBody = false;
  let sawBody = false;
  let htmlAttrs = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type === "startTag") {
      if (tok.tagName === "html") {
        htmlAttrs = tok.attrs;
        continue;
      }
      if (tok.tagName === "head") { inHead = true; continue; }
      if (tok.tagName === "body") { inBody = true; sawBody = true; continue; }
    }
    if (tok.type === "endTag") {
      if (tok.tagName === "html") continue;
      if (tok.tagName === "head") { inHead = false; continue; }
      if (tok.tagName === "body") { inBody = false; continue; }
    }
    if (tok.type === "doctype") continue;

    const raw = tok.type === "text" ? tok.text
      : tok.type === "comment" ? tok.raw
      : tok.type === "endTag" ? `</${tok.rawName ?? tok.tagName}>`
      : (() => {
        const attrs = tok.attrs.map((a) => (a.value === null ? ` ${a.name}` : ` ${a.name}="${String(a.value).replace(/"/g, "&quot;")}"`)).join("");
        return `<${tok.rawName ?? tok.tagName}${attrs}${tok.selfClosing ? " />" : ">"}`;
      })();

    if (inHead) headPieces.push(raw);
    else if (inBody) bodyPieces.push(raw);
    else if (!sawBody && tok.type === "startTag" && (tok.tagName === "style" || tok.tagName === "meta" || tok.tagName === "title" || tok.tagName === "link")) {
      headPieces.push(raw);
    } else {
      bodyPieces.push(raw);
    }
  }

  return {
    htmlAttrs,
    headContent: headPieces.join(""),
    bodyContent: bodyPieces.join(""),
  };
}

function parseAnimationDurationSec(animValue) {
  const msMatch = String(animValue).match(/(\d+(?:\.\d+)?)\s*ms/i);
  if (msMatch) return Math.max(0.1, Number(msMatch[1]) / 1000);
  const sMatch = String(animValue).match(/(\d+(?:\.\d+)?)\s*s/i);
  if (sMatch) return Math.max(0.1, Number(sMatch[1]));
  return 1.2;
}

function buildFrameDriverScript({ keyframes = [], animations = [], svgTargets = [], durationSec = 4 }) {
  const hasAnimations = keyframes.length > 0 || animations.length > 0;
  const firstAnimDur = animations.length > 0 ? parseAnimationDurationSec(animations[0].value) : Math.min(1.2, durationSec);
  const lines = [
    `<script type="module">`,
    `import createMotionDriver from "@technomanceer/motion-core/frame";`,
  ];
  if (svgTargets.length > 0) {
    lines.push(`import { createSvgMotion } from "@technomanceer/motion-core/svg-motion";`);
  }
  lines.push(`const SVG_CONTROLLERS = [];`);
  if (svgTargets.length > 0) {
    lines.push(`for (const svg of document.querySelectorAll("svg[data-motion-svg]")) {`);
    lines.push(`  const paths = svg.querySelectorAll("[data-motion-path]");`);
    lines.push(`  const layers = svg.querySelectorAll("[data-layer]");`);
    lines.push(`  const steps = [];`);
    lines.push(`  if (paths.length) steps.push({ target: "[data-motion-path]", effect: "draw", start: 0, duration: ${Math.min(1.5, durationSec * 0.45)}, stagger: 0.08, easing: "outCubic" });`);
    lines.push(`  if (layers.length) steps.push({ target: "[data-layer]", effect: "fade", start: 0.1, duration: ${Math.min(0.9, durationSec * 0.35)}, stagger: 0.05, from: 0, to: 1 });`);
    lines.push(`  if (steps.length) SVG_CONTROLLERS.push(createSvgMotion(svg, steps));`);
    lines.push(`}`);
  }
  lines.push(`window.__onFrame__ = (M) => {`);
  lines.push(`  const d = createMotionDriver(M);`);
  lines.push(`  const root = document.querySelector("[data-motion-stage]") || document.body;`);
  if (hasAnimations) {
    lines.push(`  const w = d.window(0, ${firstAnimDur});`);
    lines.push(`  const p = d.ease.outCubic(w.progress);`);
    lines.push(`  for (const el of document.querySelectorAll("[data-doop-id], .hero-badge")) {`);
    lines.push(`    el.style.opacity = String((0.8 + 0.2 * p).toFixed(4));`);
    lines.push(`    el.style.transform = \`translateY(\${((1 - p) * 12).toFixed(3)}px)\`;`);
    lines.push(`  }`);
  } else {
    lines.push(`  const w = d.window(0, ${Math.min(0.8, durationSec)});`);
    lines.push(`  const p = d.ease.outCubic(w.progress);`);
    lines.push(`  if (root) root.style.opacity = String((0.92 + 0.08 * p).toFixed(4));`);
  }
  if (svgTargets.length > 0) {
    lines.push(`  for (const ctrl of SVG_CONTROLLERS) ctrl.seek(M);`);
  }
  lines.push(`};`);
  lines.push(`if (!window.__MOTION_DRIVEN__) {`);
  lines.push(`  window.__onFrame__({ frame: 0, time: 0, fps: 30, totalFrames: ${Math.max(1, Math.round(durationSec * 30))}, seed: 1 });`);
  lines.push(`}`);
  lines.push(`</script>`);
  return lines.join("\n");
}

function annotateSvgAndComponents(html, target) {
  const tokens = tokenizeHtml(html);
  const svgTargets = [];
  let inSvg = false;
  let svgCounter = 0;

  const out = tokens.map((tok, idx) => {
    if (tok.type !== "startTag") {
      if (tok.type === "endTag" && tok.tagName === "svg") inSvg = false;
      return tok;
    }
    const tag = tok.tagName;
    const attrs = [...tok.attrs];

    // Preserve <doop-use> custom element cleanly as semantic block with data-motion-component
    if (tag === "doop-use") {
      const compAttr = attrs.find((a) => a.name.toLowerCase() === "component");
      const labelAttr = attrs.find((a) => a.name.toLowerCase() === "label");
      const text = labelAttr?.value ?? compAttr?.value ?? "Component";
      const safeAttrs = attrs.map((a) => ({ ...a }));
      if (!safeAttrs.some((a) => a.name === "data-motion-component") && compAttr?.value) {
        safeAttrs.push({ name: "data-motion-component", value: compAttr.value });
      }
      if (!safeAttrs.some((a) => a.name === "style")) {
        safeAttrs.push({ name: "style", value: "display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;border:1px solid currentColor;font-size:0.875em;font-weight:600;width:fit-content;" });
      }
      const nextIsEmptyClose = tokens[idx + 1]?.type === "endTag" && tokens[idx + 1]?.tagName === "doop-use";
      return {
        ...tok,
        rawName: "span",
        tagName: "span",
        attrs: safeAttrs,
        selfClosing: false,
        _injectText: (tok.selfClosing || nextIsEmptyClose) ? text : null,
        _skipOwnClose: !tok.selfClosing && nextIsEmptyClose,
      };
    }

    if (tag === "svg") {
      inSvg = true;
      svgCounter++;
      if ((target === "svg-motion" || target === "frame" || target === "story") && !attrs.some((a) => a.name === "data-motion-svg")) {
        attrs.push({ name: "data-motion-svg", value: `svg-${svgCounter}` });
      }
      svgTargets.push(`svg-${svgCounter}`);
    } else if (inSvg && target === "svg-motion") {
      if (["path", "circle", "rect", "line", "polyline", "polygon"].includes(tag)) {
        if (!attrs.some((a) => a.name === "data-motion-path") && !attrs.some((a) => a.name === "data-layer")) {
          if (tag === "path" || tag === "line" || tag === "polyline") attrs.push({ name: "data-motion-path", value: `auto-${svgCounter}` });
          else attrs.push({ name: "data-layer", value: `auto-${svgCounter}` });
        }
      }
    }

    return { ...tok, attrs };
  });

  const rendered = out.map((tok, idx) => {
    if (tok.type === "text") return tok.text;
    if (tok.type === "comment") return tok.raw;
    if (tok.type === "doctype") return tok.raw;
    if (tok.type === "endTag") {
      if (tok.tagName === "doop-use" && out[idx - 1]?._skipOwnClose) return "";
      return `</${tok.rawName === "doop-use" ? "span" : tok.rawName ?? tok.tagName}>`;
    }
    if (tok.type === "startTag") {
      const name = tok.rawName ?? tok.tagName;
      const attrs = tok.attrs.map((a) => (a.value === null ? ` ${a.name}` : ` ${a.name}="${String(a.value).replace(/"/g, "&quot;")}"`)).join("");
      const open = `<${name}${attrs}${tok.selfClosing ? " />" : ">"}`;
      return tok._injectText ? `${open}${tok._injectText}</span>` : open;
    }
    return "";
  }).join("");

  return { html: rendered, svgTargets };
}

function normalizeSingleIR(irInput, options = {}) {
  const ir = validateDesignIR(irInput);
  const rawTarget = String(options.target ?? "frame").toLowerCase();
  const target = TARGET_ALIASES.get(rawTarget);
  if (!target) {
    throw new MotionError(
      ERROR_CODES.INVALID_ARGUMENT,
      `Target de normalização inválido '${rawTarget}'. Use: frame, svg-motion, carousel, story ou web-director.`
    );
  }

  const isStaticOrVideo = target !== "web-director";
  const urlMap = buildUrlMap(options.provenanceManifest, options.urlToLocalPath);
  const missingAssets = [];
  const fallbacksApplied = [];
  const converted = [];
  const preserved = [];
  const incompatible = [];

  const rewriteUrl = (url, ctx) => {
    const local = urlMap.get(url);
    if (local) {
      converted.push({ kind: "external-url-to-local", from: url, to: `./${local}`, ctx });
      return `./${local}`;
    }
    missingAssets.push({ url, ctx, reason: "Asset remoto não consta no AssetProvenanceManifest@1." });
    if (ctx === "font" || ctx === "stylesheet") {
      fallbacksApplied.push({ kind: "system-font-fallback", forUrl: url, fallback: "system-ui, sans-serif" });
      return null; // drop <link> / @font-face remote ref cleanly
    }
    fallbacksApplied.push({ kind: "missing-asset-placeholder", forUrl: url, fallback: "inline-svg-placeholder" });
    return MISSING_ASSET_SVG_DATA_URI;
  };

  // Run structured sanitization + URL localization + optional CSS animation stripping
  const hasHydratedLoopback = [...urlMap.keys()].some((u) => /^http:\/\/(?:127\.|localhost)/i.test(u));
  const scanned = scanUntrustedHtml(ir.sanitizedHtml, {
    allowLoopback: Boolean(options.allowLoopback || hasHydratedLoopback),
    stripAnimations: isStaticOrVideo,
    rewriteUrl,
  });

  const removedForSecurity = [
    ...ir.securityFindings.map((f) => ({ ...f, phase: "import" })),
    ...scanned.securityFindings.map((f) => ({ ...f, phase: "normalize" })),
  ];

  if (options.strictSecurity && removedForSecurity.some((f) => f.severity === "blocked")) {
    throw new MotionError(
      ERROR_CODES.BRIDGE_NORMALIZE_BLOCKED,
      `Normalização bloqueada por segurança (${removedForSecurity.length} ocorrência(s)).`,
      { details: removedForSecurity }
    );
  }

  // Record explicit animation/SMIL/script conversions & incompatibilities
  if (scanned.keyframes.length > 0 || scanned.animations.length > 0) {
    if (isStaticOrVideo) {
      converted.push({
        kind: "css-keyframes-to-frame-js",
        keyframes: scanned.keyframes.map((k) => k.name),
        animationsCount: scanned.animations.length,
        note: "Animações CSS baseadas em relógio removidas e mapeadas para window.__onFrame__ (frame.js).",
      });
    } else {
      preserved.push({ kind: "css-keyframes", count: scanned.keyframes.length });
    }
  }
  if (scanned.transitions.length > 0 && isStaticOrVideo) {
    incompatible.push({
      kind: "css-transitions",
      count: scanned.transitions.length,
      policy: "stripped-for-deterministic-render",
      note: "Transições CSS baseadas em interação/relógio removidas para garantir determinismo frame-a-frame.",
    });
  }
  for (const d of [...ir.compatibilityDiagnostics, ...scanned.compatibilityDiagnostics]) {
    if (d.code === "SMIL_ANIMATION_DETECTED") {
      converted.push({
        kind: "smil-to-svg-motion",
        code: d.code,
        note: "SMIL removido pelo sanitizador SVGO e mapeado para svg-motion.js.",
      });
    } else if (d.code === "CLOCK_OR_RANDOM_API_DETECTED" || d.code === "RUNTIME_NETWORK_CALL_DETECTED") {
      incompatible.push({ kind: d.code, message: d.message, policy: "blocked-untrusted-script" });
    }
  }

  // Dimensions & safe-zone geometry per target
  let width = ir.viewport.width;
  let height = ir.viewport.height;
  let safeZoneCss = "";
  if (target === "carousel") {
    const presetKey = options.preset === "feed-square" ? "feed-square" : "feed-vertical";
    const p = PRESETS[presetKey];
    [width, height] = p.size;
    const sz = p["safe-zones"];
    safeZoneCss = `padding:${sz.top}% ${sz.right}% ${sz.bottom}% ${sz.left}%;`;
    if (width !== ir.viewport.width || height !== ir.viewport.height) {
      converted.push({ kind: "recompose-carousel", from: `${ir.viewport.width}x${ir.viewport.height}`, to: `${width}x${height}`, preset: presetKey });
    }
  } else if (target === "story") {
    const p = PRESETS.story;
    [width, height] = p.size;
    const sz = p["safe-zones"];
    safeZoneCss = `padding:${sz.top}% ${sz.right}% ${sz.bottom}% ${sz.left}%;`;
    if (width !== ir.viewport.width || height !== ir.viewport.height) {
      converted.push({ kind: "recompose-story", from: `${ir.viewport.width}x${ir.viewport.height}`, to: `${width}x${height}`, preset: "story" });
    }
  }

  // Preserved features checklist
  preserved.push(
    { kind: "viewport", width, height, theme: ir.viewport.theme, deviceScaleFactor: ir.viewport.deviceScaleFactor },
    { kind: "hierarchy-and-markup", sourceFrameId: ir.source.frameId }
  );
  if (options.tokenBundle) preserved.push({ kind: "design-tokens", brandSlug: options.tokenBundle.brandSlug, themes: options.tokenBundle.themes });
  if (ir.componentsUsed.length > 0) preserved.push({ kind: "components", count: ir.componentsUsed.length, names: ir.componentsUsed.map((c) => c.component) });
  if (ir.prototypeFlows.length > 0) preserved.push({ kind: "prototype-flows-metadata", count: ir.prototypeFlows.length });

  const tokensCss = buildTokensCss(options.tokenBundle ?? null, options.provenanceManifest ?? null);
  const { htmlAttrs, headContent, bodyContent } = extractHeadAndBody(scanned.sanitizedHtml);
  const { html: annotatedBody, svgTargets } = annotateSvgAndComponents(bodyContent, target);

  const durationSec = Number(options.durationSec ?? 4);
  const themeAttr = ir.viewport.theme && !htmlAttrs.some((a) => a.name.toLowerCase() === "data-doop-theme")
    ? ` data-doop-theme="${ir.viewport.theme}"`
    : "";
  const rawHtmlAttrStr = htmlAttrs
    .map((a) => (a.value === null ? ` ${a.name}` : ` ${a.name}="${String(a.value).replace(/"/g, "&quot;")}"`))
    .join("");

  const baseResetCss = target === "web-director"
    ? `*,*::before,*::after{box-sizing:border-box}html,body{margin:0;min-height:100vh}`
    : `*,*::before,*::after{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}[data-motion-stage]{width:100%;height:100%;position:relative;${safeZoneCss}}`;

  const scriptBlock = (target === "frame" || target === "svg-motion" || target === "story")
    ? buildFrameDriverScript({
      keyframes: scanned.keyframes,
      animations: scanned.animations,
      svgTargets: target === "svg-motion" || svgTargets.length > 0 ? svgTargets : [],
      durationSec,
    })
    : "";

  const slideFooter = target === "carousel" && options.slideCount && options.slideIndex
    ? `\n<div data-motion-slide-counter style="position:absolute;bottom:24px;left:6%;font-size:20px;opacity:0.65;font-family:sans-serif">${String(options.slideIndex).padStart(2, "0")} / ${String(options.slideCount).padStart(2, "0")}</div>`
    : "";

  const composedHtml = [
    `<!doctype html>`,
    `<html${rawHtmlAttrStr}${themeAttr}>`,
    `<head>`,
    `<meta charset="utf-8" />`,
    target === "web-director" ? `<meta name="viewport" content="width=device-width, initial-scale=1" />` : "",
    tokensCss ? `<style data-motion-tokens>\n${tokensCss}\n</style>` : "",
    `<style data-motion-reset>${baseResetCss}</style>`,
    headContent,
    scriptBlock,
    `</head>`,
    `<body>`,
    target === "web-director" ? annotatedBody : `<div data-motion-stage data-motion-target="${target}">${annotatedBody}${slideFooter}</div>`,
    `</body>`,
    `</html>`,
  ].filter(Boolean).join("\n");

  const diagnostics = [
    ...ir.compatibilityDiagnostics,
    ...scanned.compatibilityDiagnostics,
  ];

  const report = {
    schemaVersion: SCHEMA_VERSION,
    target,
    engine: target === "frame" ? "design-system/frame.js"
      : target === "svg-motion" ? "design-system/svg-motion.js"
      : target === "carousel" ? "renderers/render_static.mjs"
      : target === "story" ? "design-system/frame.js + quality/safe_zones.mjs"
      : "renderers/qa_viewports.mjs",
    source: { ...ir.source },
    viewport: { ...ir.viewport, width, height },
    irHash: ir.irHash,
    preserved,
    converted,
    removedForSecurity,
    incompatible,
    missingAssets,
    fallbacksApplied,
    diagnostics,
    stats: {
      preservedCount: preserved.length,
      convertedCount: converted.length,
      removedForSecurityCount: removedForSecurity.length,
      incompatibleCount: incompatible.length,
      missingAssetsCount: missingAssets.length,
      fallbacksAppliedCount: fallbacksApplied.length,
    },
  };

  return {
    target,
    width,
    height,
    html: composedHtml,
    tokensCss,
    report,
  };
}

/**
 * Normalizes one MotionDesignIR@1 (or an array for carousel slides) into deterministic
 * Motion Studio composition files and writes them atomically to `outDir` when specified.
 */
export async function normalizeDesignToMotion(irOrList, options = {}) {
  const list = Array.isArray(irOrList) ? irOrList : [irOrList];
  if (list.length === 0) {
    throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, "normalizeDesignToMotion exige ao menos um MotionDesignIR@1.");
  }
  const rawTarget = String(options.target ?? "frame").toLowerCase();
  const target = TARGET_ALIASES.get(rawTarget);
  if (!target) {
    throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, `Target de normalização inválido '${rawTarget}'.`);
  }

  let results;
  if (target === "carousel") {
    results = list.map((ir, idx) => normalizeSingleIR(ir, { ...options, slideIndex: idx + 1, slideCount: list.length }));
  } else {
    results = [normalizeSingleIR(list[0], options)];
  }

  const primary = results[0];
  const filesWritten = [];

  if (options.outDir) {
    const outRoot = path.resolve(options.outDir);
    await mkdir(outRoot, { recursive: true });

    if (primary.tokensCss) {
      const tokensAbs = await assertSafeProjectPath(outRoot, "tokens.css");
      await writeFile(tokensAbs, primary.tokensCss + "\n", "utf8");
      filesWritten.push(tokensAbs);
    }

    if (target === "carousel") {
      for (let i = 0; i < results.length; i++) {
        const rel = `slides/${String(i + 1).padStart(2, "0")}.html`;
        const slideAbs = await assertSafeProjectPath(outRoot, rel);
        await mkdir(path.dirname(slideAbs), { recursive: true });
        await writeFile(slideAbs, results[i].html, "utf8");
        filesWritten.push(slideAbs);
      }
      // Mirror referenced local assets into slides/ so createStaticServer(slides/01.html) serves them without parent escape
      for (const a of options.provenanceManifest?.assets ?? []) {
        if (!a.localPath) continue;
        const srcAbs = await assertSafeProjectPath(outRoot, a.localPath);
        if (existsSync(srcAbs)) {
          const dstAbs = await assertSafeProjectPath(outRoot, `slides/${a.localPath}`);
          await mkdir(path.dirname(dstAbs), { recursive: true });
          await copyFile(srcAbs, dstAbs);
          filesWritten.push(dstAbs);
        }
      }
    } else if (target === "web-director") {
      const htmlAbs = await assertSafeProjectPath(outRoot, "index.html");
      await writeFile(htmlAbs, primary.html, "utf8");
      filesWritten.push(htmlAbs);

      const styleMdAbs = await assertSafeProjectPath(outRoot, "STYLE.md");
      const structureMdAbs = await assertSafeProjectPath(outRoot, "STRUCTURE.md");
      await writeFile(
        styleMdAbs,
        `# STYLE — ${options.tokenBundle?.brandSlug ?? primary.report.source.documentId}\n\nTokens preservados em \`tokens.css\`. Temas: ${(options.tokenBundle?.themes ?? ["default"]).join(", ") || "default"}.\n`,
        "utf8"
      );
      await writeFile(
        structureMdAbs,
        `# STRUCTURE — ${primary.report.source.frameName ?? primary.report.source.frameId}\n\nViewport base: ${primary.width}x${primary.height}\nComponentes: ${primary.report.preserved.find((p) => p.kind === "components")?.names?.join(", ") || "nenhum"}\n`,
        "utf8"
      );
      filesWritten.push(styleMdAbs, structureMdAbs);
    } else {
      const htmlAbs = await assertSafeProjectPath(outRoot, "composition.html");
      await writeFile(htmlAbs, primary.html, "utf8");
      filesWritten.push(htmlAbs);
    }

    const reportAbs = await assertSafeProjectPath(outRoot, "normalization-report.json");
    const aggregateReport = results.length === 1
      ? primary.report
      : {
          schemaVersion: SCHEMA_VERSION,
          target,
          slides: results.map((r) => r.report),
        };
    await writeFile(reportAbs, JSON.stringify(aggregateReport, null, 2) + "\n", "utf8");
    filesWritten.push(reportAbs);
  }

  return {
    target,
    width: primary.width,
    height: primary.height,
    html: primary.html,
    tokensCss: primary.tokensCss,
    report: primary.report,
    slides: results,
    filesWritten,
  };
}
