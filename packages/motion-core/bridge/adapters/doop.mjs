/**
 * MOTION Core Bridge — adapters/doop.mjs
 * EditorAdapter implementation for Doop Design (https://doop.design).
 * Purely deterministic, offline-capable, zero network calls or AI dependencies.
 */
import { ERROR_CODES, MotionError } from "../../lib/errors.mjs";
import { createHash } from "node:crypto";
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

/** Tool names verified against the connected Doop MCP schemas on 2026-11-24. */
export const DOOP_MCP_TOOL_NAMES = Object.freeze({
  getCanvas: "get_canvas",
  getFrame: "get_frame",
  createFrame: "create_frame",
  setFrameHtml: "set_frame_html",
  appendFrameHtml: "append_frame_html",
  editFrameHtml: "edit_frame_html",
  uploadAsset: "upload_asset",
  getFrameScreenshot: "get_frame_screenshot",
  getPrototype: "get_prototype",
  saveDecision: "save_decision",
});

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

/** Topological + semantic ordering for deterministic token handoff. */
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
  if (tagOrContext === "font" || /\.(?:woff2?|ttf|otf)(\?|$)/.test(lower)) return "font";
  if (tagOrContext === "svg" || /\.svg(\?|$)|api\.iconify\.design/i.test(lower)) return "svg";
  if (tagOrContext === "img" || tagOrContext === "image" || tagOrContext === "svg-image" || /\.(?:png|jpe?g|webp|gif|avif)(\?|$)/.test(lower)) return "image";
  if (tagOrContext === "css" || tagOrContext === "background") return "background";
  return "unknown";
}

function buildReferencedAssets(extractedAssets, { allowLoopback = false } = {}) {
  const seen = new Set();
  const assets = [];

  for (const entry of extractedAssets) {
    if (!entry?.url || seen.has(entry.url)) continue;
    seen.add(entry.url);
    const kind = inferUrlKind(entry.url, entry.ctx);
    if (!entry.safe) {
      assets.push({ url: entry.url, kind, safe: false, blockedReason: entry.blockedReason ?? "Blocked URL" });
      continue;
    }
    try {
      const normalizedUrl = assertSafeRemoteUrl(entry.url, { allowLoopback });
      assets.push({ url: normalizedUrl, kind, safe: true, blockedReason: null });
    } catch (err) {
      assets.push({ url: entry.url, kind, safe: false, blockedReason: err.message });
    }
  }

  return assets;
}

export function splitHtmlChunks(html, chunkBytes = 3072) {
  const source = Buffer.from(String(html ?? ""), "utf8");
  if (source.length <= chunkBytes) return [source.toString("utf8")];
  const chunks = [];
  let offset = 0;
  while (offset < source.length) {
    let end = Math.min(source.length, offset + chunkBytes);
    while (end < source.length && (source[end] & 0xc0) === 0x80) end--;
    if (end < source.length) {
      const boundary = source.lastIndexOf(0x3e, end - 1);
      if (boundary > offset + 256) end = boundary + 1;
    }
    chunks.push(source.subarray(offset, end).toString("utf8"));
    offset = end;
  }
  return chunks;
}

export function createDoopAdapter({
  mcpClient = null,
  agentName = "MotionStudio",
  assetUploadTransport = null,
  uploadRateLimitScope = mcpClient,
} = {}) {
  return assertEditorAdapter({
    editor: "doop",
    uploadRateLimitScope: uploadRateLimitScope ?? undefined,
    capabilities: {
      tokens: true,
      frames: true,
      components: true,
      prototypes: true,
      export: true,
      remoteTokenRead: false,
      remoteComponentRead: false,
      tokenWrite: false,
      componentWrite: false,
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
      const { sanitizedHtml, securityFindings, compatibilityDiagnostics, extractedAssets } = scanUntrustedHtml(rawHtml, { allowLoopback });
      const referencedAssets = buildReferencedAssets(extractedAssets, { allowLoopback });

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
        securityFindings,
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

    async inspectRemoteState({ documentId, frameIds = [] } = {}) {
      if (typeof mcpClient !== "function") {
        return { verified: false, documentId, pages: [], tokens: [], components: [], frames: {}, approvedFrameCount: 0 };
      }
      const canvas = await mcpClient(DOOP_MCP_TOOL_NAMES.getCanvas, { canvas_id: documentId, agent_name: agentName });
      const tokenSourceAvailable = Array.isArray(canvas?.tokens) || Array.isArray(canvas?.designTokens) || Array.isArray(canvas?.tokenBundle?.tokens);
      const rawTokens = canvas?.tokens ?? canvas?.designTokens ?? canvas?.tokenBundle?.tokens ?? [];
      const parsedTokens = Array.isArray(rawTokens) ? rawTokens : [];
      const componentSourceAvailable = Array.isArray(canvas?.components) || Array.isArray(canvas?.componentLibrary) || Array.isArray(canvas?.workspaceLibraries);
      const rawComponents = canvas?.components ?? canvas?.componentLibrary ?? canvas?.workspaceLibraries ?? [];
      const frames = {};
      const allFrameMeta = Array.isArray(canvas?.frames) ? canvas.frames : [];
      const approvedFrameCount = allFrameMeta.filter((f) => f?.approvalStatus === "ready_for_dev").length;
      for (const fm of allFrameMeta) {
        if (fm?.id) frames[fm.id] = { ...fm };
      }
      for (const fid of frameIds) {
        if (!fid) continue;
        const full = await mcpClient(DOOP_MCP_TOOL_NAMES.getFrame, { frame_id: fid, agent_name: agentName });
        if (full) {
          frames[fid] = { ...(frames[fid] ?? {}), ...full };
        }
      }
      return {
        verified: true,
        documentId,
        pages: Array.isArray(canvas?.pages) ? canvas.pages : [],
        tokens: parsedTokens,
        tokensVerified: tokenSourceAvailable,
        components: Array.isArray(rawComponents) ? rawComponents : [],
        componentsVerified: componentSourceAvailable,
        frames,
        approvedFrameCount,
      };
    },

    async planExport(inspected, options = {}) {
      const { planExportToEditor } = await import("../export-to-editor.mjs");
      return planExportToEditor(inspected, { ...options, adapter: this, agentName: options.agentName ?? agentName });
    },

    async executeExportOperation(op, { signal, assetBuffer = null } = {}) {
      if (signal?.aborted) {
        throw Object.assign(new MotionError(ERROR_CODES.BRIDGE_ASSET_FAILED, `Operação Doop cancelada: ${op.id}`), { preCommit: true });
      }
      if (typeof mcpClient !== "function") {
        throw Object.assign(new MotionError(
          ERROR_CODES.BRIDGE_ADAPTER_INVALID,
          `DoopAdapter exige mcpClient injetado para executar operação '${op.kind}' sem simulação dry-run.`
        ), { preCommit: true });
      }
      const p = op.payload ?? {};
      const actor = p.agent_name ?? agentName;
      switch (op.kind) {
        case "upload_asset": {
          if (typeof assetUploadTransport !== "function") {
            throw Object.assign(new MotionError(ERROR_CODES.BRIDGE_ADAPTER_INVALID, "Upload local requer assetUploadTransport injetado; o MCP do Doop só emite o grant local e comando de transferência."), { preCommit: true });
          }
          if (!Buffer.isBuffer(assetBuffer)) {
            throw Object.assign(new MotionError(ERROR_CODES.BRIDGE_ADAPTER_INVALID, `Bytes do asset '${op.source?.path ?? op.id}' não foram resolvidos para upload.`), { preCommit: true });
          }
          let grant;
          try {
            grant = await mcpClient(DOOP_MCP_TOOL_NAMES.uploadAsset, {
              canvas_id: p.canvas_id,
              local_file: true,
              agent_name: actor,
            });
          } catch (err) {
            if (err?.preCommit !== true && err?.status !== 429) err.ambiguousOutcome = true;
            throw err;
          }
          try {
            const uploaded = await assetUploadTransport({
              grant,
              buffer: assetBuffer,
              sha256: op.source?.sha256 ?? p.sha256,
              mime: p.mime,
              fileName: p.file_name ?? op.source?.path,
              signal,
            });
            if (typeof uploaded?.url !== "string" || !uploaded.url) {
              throw Object.assign(new MotionError(ERROR_CODES.BRIDGE_EXPORT_BLOCKED, "O transporte de upload não confirmou uma URL do asset."), { ambiguousOutcome: true });
            }
            return { assetId: uploaded?.id ?? grant?.id ?? null, url: uploaded?.url ?? null, raw: uploaded };
          } catch (err) {
            if (err?.preCommit !== true) err.ambiguousOutcome = true;
            throw err;
          }
        }
        case "create_frame": {
          const html = String(p.html ?? "");
          if (p.stream === true && Buffer.byteLength(html, "utf8") > 4096) {
            let created;
            try {
              created = await mcpClient(DOOP_MCP_TOOL_NAMES.createFrame, {
              canvas_id: p.canvas_id,
              name: p.name,
              width: p.width,
              height: p.height,
              ...(p.pageId ? { pageId: p.pageId } : {}),
              html: "<!doctype html><html><body></body></html>",
              agent_name: actor,
              });
            } catch (err) {
              if (err?.preCommit !== true && err?.status !== 429) err.ambiguousOutcome = true;
              throw err;
            }
            const frameId = created?.id ?? created?.frameId ?? null;
            if (!frameId) {
              throw Object.assign(new MotionError(ERROR_CODES.BRIDGE_EXPORT_BLOCKED, "create_frame não retornou um id para continuar o stream."), { ambiguousOutcome: true });
            }
            try {
              const chunks = splitHtmlChunks(html, 3072);
              for (let i = 0; i < chunks.length; i++) {
                await mcpClient(DOOP_MCP_TOOL_NAMES.appendFrameHtml, {
                  frame_id: frameId,
                  html_chunk: chunks[i],
                  start: i === 0,
                  done: i === chunks.length - 1,
                  agent_name: actor,
                });
              }
            } catch (err) {
              err.ambiguousOutcome = true;
              err.partialFrameId = frameId;
              throw err;
            }
            return { frameId, pageId: p.pageId ?? created?.pageId ?? null, image_url: created?.image_url ?? null, streamed: true };
          }
          let r;
          try {
            r = await mcpClient(DOOP_MCP_TOOL_NAMES.createFrame, {
              canvas_id: p.canvas_id,
              name: p.name,
              width: p.width,
              height: p.height,
              ...(p.pageId ? { pageId: p.pageId } : {}),
              html,
              agent_name: actor,
            });
          } catch (err) {
            if (err?.preCommit !== true && err?.status !== 429) err.ambiguousOutcome = true;
            throw err;
          }
          const frameId = r?.id ?? r?.frameId ?? null;
          if (!frameId) throw Object.assign(new MotionError(ERROR_CODES.BRIDGE_EXPORT_BLOCKED, "create_frame não retornou ID; estado remoto desconhecido."), { ambiguousOutcome: true });
          return { frameId, pageId: p.pageId ?? r?.pageId ?? null, image_url: r?.image_url ?? null, raw: r };
        }
        case "set_frame_html": {
          let r;
          try {
            r = await mcpClient(DOOP_MCP_TOOL_NAMES.setFrameHtml, { frame_id: p.frame_id, html: p.html, agent_name: actor });
          } catch (err) {
            if (err?.preCommit !== true && err?.status !== 429) err.ambiguousOutcome = true;
            throw err;
          }
          return { frameId: p.frame_id, image_url: r?.image_url ?? null, raw: r };
        }
        case "append_frame_html": {
        let r;
        try {
          r = await mcpClient(DOOP_MCP_TOOL_NAMES.appendFrameHtml, { frame_id: p.frame_id, html_chunk: p.html_chunk, start: Boolean(p.start), done: Boolean(p.done), agent_name: actor });
        } catch (err) {
          if (err?.preCommit !== true && err?.status !== 429) err.ambiguousOutcome = true;
          throw err;
        }
          return { frameId: p.frame_id, raw: r };
        }
        case "edit_frame_html": {
          let r;
          try {
            r = await mcpClient(DOOP_MCP_TOOL_NAMES.editFrameHtml, { frame_id: p.frame_id, old_str: p.old_str, new_str: p.new_str, agent_name: actor });
          } catch (err) {
            if (err?.preCommit !== true && err?.status !== 429) err.ambiguousOutcome = true;
            throw err;
          }
          return { frameId: p.frame_id, raw: r };
        }
        case "get_frame_screenshot": {
          const r = await mcpClient(DOOP_MCP_TOOL_NAMES.getFrameScreenshot, { frame_id: p.frame_id, scale: p.scale ?? 1, agent_name: actor });
          return { frameId: p.frame_id, url: r?.image_url ?? r?.url ?? null, raw: r };
        }
        case "get_frame": {
          const r = await mcpClient(DOOP_MCP_TOOL_NAMES.getFrame, { frame_id: p.frame_id, agent_name: actor });
          return { frameId: p.frame_id, frame: r, raw: r };
        }
        case "save_decision": {
          const r = await mcpClient(DOOP_MCP_TOOL_NAMES.saveDecision, { canvas_id: p.canvas_id, decision: String(p.decision ?? "").slice(0, 500), agent_name: actor });
          return { raw: r };
        }
        case "get_prototype": {
          const r = await mcpClient(DOOP_MCP_TOOL_NAMES.getPrototype, { canvas_id: p.canvas_id, agent_name: actor });
          return { raw: r };
        }
        default:
          throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, `Operação Doop não suportada: ${op.kind}`);
      }
    },

    async verifyExportedState(op, execResult) {
      if (typeof mcpClient !== "function") return { ok: true };
      const frameId = op?.target?.frameId ?? execResult?.frameId ?? null;
      if (!frameId) return { ok: true };
      try {
        if (typeof execResult?.url !== "string" || !execResult.url) return { ok: false, frameId, reason: "get_frame_screenshot não retornou uma URL de screenshot." };
        assertSafeRemoteUrl(execResult.url);
        const frame = await mcpClient(DOOP_MCP_TOOL_NAMES.getFrame, { frame_id: frameId, agent_name: agentName });
        if (!frame || typeof frame.html !== "string") return { ok: false, frameId, reason: "get_frame não retornou HTML." };
        const expectedHash = op?.preconditions?.expectedHtmlSha256;
        const actualHash = createHash("sha256").update(frame.html).digest("hex");
        if (expectedHash && actualHash !== expectedHash) return { ok: false, frameId, reason: "HTML remoto difere do payload planejado." };
        if (frame.approvalStatus === "ready_for_dev") return { ok: false, frameId, reason: "O frame permaneceu ready_for_dev após a escrita." };
        return { ok: true, frameId, actualHash, approvalStatus: frame.approvalStatus ?? null };
      } catch (err) {
        return { ok: false, frameId, reason: err.message };
      }
    },
  });
}

export default createDoopAdapter;
