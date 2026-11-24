/**
 * MOTION Core Bridge — adapters/doop.mjs
 * EditorAdapter implementation for Doop Design (https://doop.design).
 * Purely deterministic, offline-capable, zero network calls or AI dependencies.
 */
import { ERROR_CODES, MotionError } from "../../lib/errors.mjs";
import { assertEditorAdapter } from "../adapter.mjs";
import {
  extractAliasTarget,
  SCHEMA_VERSION,
  TOKEN_TYPES,
  validateDesignIR,
  validateTokenBundle,
} from "../contracts.mjs";
import {
  assertSafeRemoteUrl,
  scanUntrustedHtml,
} from "../security.mjs";

const TOKEN_TYPE_SET = new Set(TOKEN_TYPES);

function normalizeDoopTokenName(rawName) {
  const cleaned = String(rawName ?? "").trim().replace(/\s+/g, "-");
  if (!cleaned) return "";
  return cleaned.startsWith("--") ? cleaned : `--${cleaned}`;
}

function inferTokenType(cssVar, value) {
  const v = cssVar.toLowerCase();
  if (v.startsWith("--color-") || v.includes("-color-")) return "color";
  if (v.startsWith("--opacity-")) return "opacity";
  if (v.startsWith("--radius-")) return "radius";
  if (v.startsWith("--spacing-") || v.startsWith("--space-")) return "spacing";
  if (v.startsWith("--container-")) return "container";
  if (v.startsWith("--breakpoint-")) return "breakpoint";
  if (v.startsWith("--font-weight-")) return "fontWeight";
  if (v.startsWith("--font-")) return "fontFamily";
  if (v.startsWith("--text-") || v.startsWith("--font-size-")) return "fontSize";
  if (v.startsWith("--leading-") || v.startsWith("--line-height-")) return "lineHeight";
  if (v.startsWith("--tracking-") || v.startsWith("--letter-spacing-")) return "letterSpacing";
  const val = String(value ?? "").trim();
  if (/^#([0-9a-f]{3,8})$|^(?:rgb|hsl|oklch|oklab|color)\(/i.test(val)) return "color";
  return "spacing";
}

function inferMotionMapping(cssVar, type) {
  const key = cssVar.replace(/^--/, "").toLowerCase();
  if (type === "color") {
    if (/(?:^|-)(?:ground|bg|background)$/.test(key)) return { motionGroup: "color", motionKey: "background" };
    if (/(?:^|-)(?:ink|fg|foreground|text)$/.test(key)) return { motionGroup: "color", motionKey: "text" };
    if (/(?:^|-)surface$/.test(key)) return { motionGroup: "color", motionKey: "surface" };
    if (/(?:^|-)primary$/.test(key)) return { motionGroup: "color", motionKey: "primary" };
    if (/(?:^|-)secondary$/.test(key)) return { motionGroup: "color", motionKey: "secondary" };
    if (/(?:^|-)accent$/.test(key)) return { motionGroup: "color", motionKey: "accent" };
    if (/(?:^|-)muted$/.test(key)) return { motionGroup: "color", motionKey: "muted" };
    return { motionGroup: "color", motionKey: key.replace(/^color-/, "") };
  }
  if (type === "fontFamily") {
    if (/display|heading|headline|serif/.test(key)) return { motionGroup: "typography", motionKey: "headline.family" };
    if (/body|sans|ui|text/.test(key)) return { motionGroup: "typography", motionKey: "body.family" };
    if (/mono|code/.test(key)) return { motionGroup: "typography", motionKey: "mono.family" };
  }
  return { motionGroup: type, motionKey: key };
}

function parseCssTokenBlocks(cssText) {
  const byVar = new Map();
  const themes = new Set();

  const parseDecls = (body, themeName) => {
    for (const m of body.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;{}]+)\s*;/g)) {
      const cssVar = m[1].trim();
      const value = m[2].trim();
      const existing = byVar.get(cssVar) ?? { name: cssVar, type: inferTokenType(cssVar, value), value: null, themes: {} };
      if (themeName === "default") {
        existing.value = value;
      } else {
        themes.add(themeName);
        existing.themes[themeName] = value;
      }
      byVar.set(cssVar, existing);
    }
  };

  for (const m of cssText.matchAll(/(?::root\s*\[data-doop-theme=["']([a-z0-9-]+)["']\]|\[data-doop-theme=["']([a-z0-9-]+)["']\])\s*\{([^}]*)\}/gi)) {
    const themeName = (m[1] ?? m[2]).toLowerCase();
    parseDecls(m[3], themeName);
  }
  for (const m of cssText.matchAll(/(?:^|[}\s]):root\s*\{([^}]*)\}/gi)) {
    parseDecls(m[1], "default");
  }

  return {
    themes: [...themes],
    tokens: [...byVar.values()].filter((t) => t.value !== null),
  };
}

function parseAttributes(attrText) {
  const attrs = {};
  for (const m of attrText.matchAll(/([a-zA-Z0-9_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attrs[m[1]] = m[2] ?? m[3] ?? "";
  }
  return attrs;
}

function resolveTokenValue(cssVar, byVar, theme = "default", visited = new Set()) {
  if (visited.has(cssVar)) return null;
  const tok = byVar.get(cssVar);
  if (!tok) return null;
  visited.add(cssVar);
  const raw = theme !== "default" && tok.themes?.[theme] !== undefined ? tok.themes[theme] : tok.value;
  const target = extractAliasTarget(raw);
  return target ? resolveTokenValue(target, byVar, theme, visited) : raw;
}

/** Converts a validated DesignTokenBundle@1 into Motion's brand tokens.json shape (compatible with paletteFromTokens). */
export function toMotionBrandTokens(tokenBundle) {
  const bundle = validateTokenBundle(tokenBundle);
  const byVar = new Map(bundle.tokens.map((t) => [t.cssVar, t]));
  const color = {};
  const roles = {};
  const typography = {};
  const scale = {};
  const cssVars = {};

  for (const tok of bundle.tokens) {
    const resolved = resolveTokenValue(tok.cssVar, byVar, "default") ?? tok.value;
    cssVars[tok.cssVar] = resolved;

    if (tok.type === "color") {
      const k = tok.motionKey || tok.cssVar.replace(/^--color-/, "").replace(/^--/, "");
      color[k] = resolved;
      if (k === "background" || k === "ground" || k === "bg") roles.bg = k;
      if (k === "text" || k === "ink" || k === "fg" || k === "foreground") roles.fg = k;
      if (k === "primary") roles.primary = k;
      if (k === "accent") roles.accent = k;
    } else if (tok.type === "fontFamily") {
      const mk = tok.motionKey ?? "";
      if (mk === "headline.family") typography.headline = { family: resolved };
      else if (mk === "body.family") typography.body = { family: resolved };
      else if (mk === "mono.family") typography.mono = { family: resolved };
    } else {
      scale[tok.type] ??= {};
      scale[tok.type][tok.cssVar.replace(/^--/, "")] = resolved;
    }
  }

  const themes = {};
  for (const th of bundle.themes) {
    themes[th] = {};
    for (const tok of bundle.tokens) {
      themes[th][tok.cssVar] = resolveTokenValue(tok.cssVar, byVar, th) ?? tok.value;
    }
  }

  return {
    $schemaVersion: SCHEMA_VERSION,
    brandSlug: bundle.brandSlug,
    sourceEditor: bundle.sourceEditor,
    color,
    roles,
    typography,
    scale,
    themes,
    cssVars,
    fonts: bundle.fonts,
  };
}

function tokenPriorityRank(tok) {
  const name = tok.cssVar.toLowerCase();
  const isSemantic = /(?:ground|bg|background|surface|ink|fg|foreground|text|primary|secondary|accent|muted|border)$/.test(name);
  const isNeutral = /neutral|slate|gray|zinc|stone/.test(name);
  if (tok.type === "color") {
    if (isSemantic) return 0;
    if (isNeutral) return 1;
    return 2;
  }
  return 3 + TOKEN_TYPES.indexOf(tok.type);
}

/** Topological + semantic ordering required by Doop create_tokens. */
function orderTokensForDoop(tokens) {
  const remaining = new Map(tokens.map((t) => [t.cssVar, t]));
  const placed = new Set();
  const ordered = [];

  while (remaining.size > 0) {
    const ready = [...remaining.values()]
      .filter((t) => {
        const target = extractAliasTarget(t.value);
        return !target || !remaining.has(target) || placed.has(target);
      })
      .sort((a, b) => tokenPriorityRank(a) - tokenPriorityRank(b) || a.cssVar.localeCompare(b.cssVar));

    if (ready.length === 0) {
      throw new MotionError(ERROR_CODES.BRIDGE_TOKEN_CYCLE, "Não foi possível ordenar tokens devido a ciclo de alias.");
    }
    const next = ready[0];
    placed.add(next.cssVar);
    remaining.delete(next.cssVar);
    ordered.push(next);
  }
  return ordered;
}

function extractComponentsUsed(html, rawInstances = []) {
  const found = [];
  for (const m of html.matchAll(/<doop-use\b([^>]*)>/gi)) {
    const attrs = parseAttributes(m[1]);
    const component = attrs.component;
    if (!component) continue;
    const id = attrs.id ?? null;
    const props = {};
    for (const k of Object.keys(attrs).sort()) {
      if (k !== "component" && k !== "id") props[k] = attrs[k];
    }
    found.push({ id, component, props });
  }
  if (found.length === 0 && Array.isArray(rawInstances)) {
    for (const inst of rawInstances) {
      if (!inst?.component) continue;
      const props = {};
      for (const k of Object.keys(inst.props ?? {}).sort()) props[k] = inst.props[k];
      found.push({ id: inst.id ?? null, component: String(inst.component), props });
    }
  }
  return found;
}

function extractPrototypeFlows(html, fromFrameId) {
  const flows = [];
  for (const m of html.matchAll(/<([a-zA-Z0-9-]+)\b([^>]*\bdata-doop-(?:on|interactions)\b[^>]*)>/gi)) {
    const attrs = parseAttributes(m[2]);
    const triggerElementId = attrs["data-doop-id"] ?? attrs.id ?? null;

    if (attrs["data-doop-on"] && attrs["data-doop-action"]) {
      const action = attrs["data-doop-action"];
      const targetMatch = action.match(/^(?:navigate|overlay):([a-zA-Z0-9_-]+)$/);
      const dur = attrs["data-doop-duration"] !== undefined ? Number(attrs["data-doop-duration"]) : null;
      flows.push({
        fromFrameId,
        triggerElementId,
        on: attrs["data-doop-on"],
        action,
        targetFrameId: targetMatch ? targetMatch[1] : null,
        transition: attrs["data-doop-transition"] ?? "instant",
        durationMs: Number.isFinite(dur) ? dur : null,
      });
    } else if (attrs["data-doop-interactions"]) {
      try {
        const list = JSON.parse(attrs["data-doop-interactions"]);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (!item?.on || !item?.action) continue;
            const targetMatch = String(item.action).match(/^(?:navigate|overlay):([a-zA-Z0-9_-]+)$/);
            const dur = item.duration !== undefined ? Number(item.duration) : null;
            flows.push({
              fromFrameId,
              triggerElementId,
              on: String(item.on),
              action: String(item.action),
              targetFrameId: targetMatch ? targetMatch[1] : null,
              transition: item.transition ? String(item.transition) : "instant",
              durationMs: Number.isFinite(dur) ? dur : null,
            });
          }
        }
      } catch {
        // Invalid JSON in untrusted HTML attribute is ignored safely
      }
    }
  }
  return flows;
}

function inferUrlKind(url, tagOrContext) {
  const lower = url.toLowerCase();
  if (/\.(?:woff2?|ttf|otf)(\?|$)/.test(lower)) return "font";
  if (/\.svg(\?|$)|api\.iconify\.design/i.test(lower)) return "svg";
  if (tagOrContext === "img" || /\.(?:png|jpe?g|webp|gif|avif)(\?|$)/.test(lower)) return "image";
  if (tagOrContext === "css") return "background";
  return "unknown";
}

function extractReferencedAssets(html, { allowLoopback = false } = {}) {
  const candidates = [];
  for (const m of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const u = (m[1] ?? m[2] ?? "").trim();
    if (u && !u.startsWith("data:") && !u.startsWith("#")) candidates.push({ url: u, ctx: "img" });
  }
  for (const m of html.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]+))\s*\)/gi)) {
    const u = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (u && !u.startsWith("data:") && !u.startsWith("#")) candidates.push({ url: u, ctx: "css" });
  }

  const seen = new Set();
  const assets = [];
  const securityFindings = [];

  for (const c of candidates) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    const kind = inferUrlKind(c.url, c.ctx);
    try {
      const normalizedUrl = assertSafeRemoteUrl(c.url, { allowLoopback });
      assets.push({ url: normalizedUrl, kind, safe: true, blockedReason: null });
    } catch (err) {
      assets.push({ url: c.url, kind, safe: false, blockedReason: err.message });
      securityFindings.push({
        severity: "blocked",
        code: err.code ?? ERROR_CODES.BRIDGE_UNSAFE_URL,
        message: `URL de asset bloqueada na importação: ${c.url}`,
        detail: err.message,
      });
    }
  }

  return { assets, securityFindings };
}

export function createDoopAdapter() {
  return assertEditorAdapter({
    editor: "doop",
    capabilities: {
      tokens: true,
      frames: true,
      components: true,
      prototypes: true,
    },

    importTokens(rawInput, { brandSlug = "doop-brand", webFonts = [], customFonts = [] } = {}) {
      let rawTokens = [];
      let declaredThemes = [];

      if (typeof rawInput === "string") {
        const parsed = parseCssTokenBlocks(rawInput);
        rawTokens = parsed.tokens;
        declaredThemes = parsed.themes;
      } else if (Array.isArray(rawInput)) {
        rawTokens = rawInput;
      } else if (rawInput && typeof rawInput === "object" && Array.isArray(rawInput.tokens)) {
        rawTokens = rawInput.tokens;
        declaredThemes = Array.isArray(rawInput.themes) ? rawInput.themes : [];
      } else {
        throw new MotionError(ERROR_CODES.BRIDGE_SCHEMA_INVALID, "Formato de tokens Doop inválido (esperado array, {tokens} ou CSS).");
      }

      const themeSet = new Set(declaredThemes.filter((t) => t && t !== "default"));
      const normalized = rawTokens.map((t) => {
        const cssVar = normalizeDoopTokenName(t.name ?? t.cssVar);
        const value = String(t.value ?? "");
        const type = TOKEN_TYPE_SET.has(t.type) ? t.type : inferTokenType(cssVar, value);
        const themes = {};
        if (t.themes && typeof t.themes === "object") {
          for (const [k, v] of Object.entries(t.themes)) {
            if (k !== "default") {
              themeSet.add(k);
              themes[k] = String(v);
            }
          }
        }
        const mapping = inferMotionMapping(cssVar, type);
        return {
          cssVar,
          type,
          value,
          ...(Object.keys(themes).length ? { themes } : {}),
          aliasOf: extractAliasTarget(value),
          description: t.description ?? null,
          motionGroup: mapping.motionGroup,
          motionKey: mapping.motionKey,
        };
      });

      return validateTokenBundle({
        schemaVersion: SCHEMA_VERSION,
        sourceEditor: "doop",
        brandSlug,
        themes: [...themeSet].sort(),
        fonts: { custom: [...customFonts], webFonts: [...webFonts] },
        tokens: normalized,
      });
    },

    exportTokens(tokenBundle, { mode = "create" } = {}) {
      const bundle = validateTokenBundle(tokenBundle);
      const ordered = orderTokensForDoop(bundle.tokens);
      return {
        mode,
        themes: [...bundle.themes],
        tokens: ordered.map((t) => ({
          name: t.cssVar,
          type: t.type,
          value: t.value,
          ...(t.themes && Object.keys(t.themes).length ? { themes: { ...t.themes } } : {}),
          ...(t.description ? { description: t.description } : {}),
        })),
      };
    },

    importFrame(rawFrame, { documentId, pageId = null, allowLoopback = false, tokensRef = null, assetsRef = null } = {}) {
      if (!rawFrame || typeof rawFrame !== "object") {
        throw new MotionError(ERROR_CODES.BRIDGE_SCHEMA_INVALID, "Frame Doop inválido.");
      }
      const frameId = String(rawFrame.id ?? rawFrame.frameId ?? "");
      if (!frameId) {
        throw new MotionError(ERROR_CODES.BRIDGE_SCHEMA_INVALID, "Frame Doop exige id ou frameId.");
      }
      const docId = String(documentId ?? rawFrame.canvasId ?? "");
      if (!docId) {
        throw new MotionError(ERROR_CODES.BRIDGE_SCHEMA_INVALID, "importFrame exige documentId (canvasId).");
      }

      const rawHtml = String(rawFrame.html ?? "");
      const { sanitizedHtml, securityFindings, compatibilityDiagnostics } = scanUntrustedHtml(rawHtml);
      const { assets: referencedAssets, securityFindings: urlFindings } = extractReferencedAssets(sanitizedHtml, { allowLoopback });

      if (referencedAssets.some((a) => a.safe)) {
        compatibilityDiagnostics.push({
          severity: "warn",
          code: "EXTERNAL_NETWORK_ASSET",
          message: "Frame referencia assets externos por URL; renders determinísticos offline exigem hidratação local.",
          action: "Hidratar via AssetProvenanceManifest@1 na Missão M2.",
        });
      }

      const htmlThemeMatch = sanitizedHtml.match(/<html\b[^>]*\bdata-doop-theme=["']([a-z0-9-]+)["']/i);
      const theme = rawFrame.theme ?? htmlThemeMatch?.[1] ?? "default";
      const width = Number.isInteger(rawFrame.width) ? rawFrame.width : Math.round(Number(rawFrame.width) || 1280);
      const height = Number.isInteger(rawFrame.height) ? rawFrame.height : Math.round(Number(rawFrame.height) || 800);

      const componentsUsed = extractComponentsUsed(sanitizedHtml, rawFrame.instances);
      const prototypeFlows = extractPrototypeFlows(sanitizedHtml, frameId);

      return validateDesignIR({
        schemaVersion: SCHEMA_VERSION,
        source: {
          editor: "doop",
          workspaceId: rawFrame.workspaceId ?? null,
          documentId: docId,
          pageId: pageId ?? rawFrame.pageId ?? null,
          frameId,
          frameName: rawFrame.name ?? null,
          revision: rawFrame.updatedAt ?? rawFrame.revision ?? null,
          approvalStatus: rawFrame.approvalStatus ?? null,
          capturedAt: rawFrame.capturedAt ?? null,
        },
        viewport: {
          width,
          height,
          theme,
          deviceScaleFactor: 1,
        },
        tokensRef,
        assetsRef,
        componentsUsed,
        prototypeFlows,
        referencedAssets,
        sanitizedHtml,
        securityFindings: [...securityFindings, ...urlFindings],
        compatibilityDiagnostics,
      }, { verifyHash: false });
    },

    validateTargetReadiness(ir, { target = "video" } = {}) {
      const valid = validateDesignIR(ir);
      const hasSecurityQuarantine = valid.securityFindings.some((f) => f.severity === "blocked");
      const blockingDiagnostics = [];
      const warnings = [];

      for (const d of valid.compatibilityDiagnostics) {
        if (target === "video" && ["CSS_KEYFRAMES_DETECTED", "SMIL_ANIMATION_DETECTED", "CLOCK_OR_RANDOM_API_DETECTED", "RUNTIME_NETWORK_CALL_DETECTED", "EXTERNAL_NETWORK_ASSET"].includes(d.code)) {
          blockingDiagnostics.push(d);
        } else {
          warnings.push(d);
        }
      }

      return {
        ok: !hasSecurityQuarantine && blockingDiagnostics.length === 0,
        target,
        hasSecurityQuarantine,
        blockingDiagnostics,
        warnings,
      };
    },
  });
}

export default createDoopAdapter;
