/**
 * MOTION Core Bridge — prototype-to-storyboard.mjs
 * Converts editor prototypeFlows & data-doop-* attributes in MotionDesignIR@1
 * into Motion Studio STORYBOARD.md, scene beats, UI states, transitions,
 * navigation graphs, and temporal sequences — strictly preserving real design flows
 * without inventing interactions.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ERROR_CODES, MotionError } from "../lib/errors.mjs";
import { validateDesignIR } from "./contracts.mjs";
import { decodeHtmlEntities, tokenizeHtml, wrapUntrustedText } from "./security.mjs";

const DEFAULT_SCENE_SEC = 3.0;
const TRANSITION_DEFAULT_MS = 350;

function extractInlineStatesAndAttrs(html, frameId) {
  const tokens = tokenizeHtml(String(html ?? ""));
  const elements = [];
  const states = [];
  const navigation = [];

  for (const tok of tokens) {
    if (tok.type !== "startTag") continue;
    const attrMap = {};
    for (const a of tok.attrs) {
      attrMap[a.name.toLowerCase()] = a.value ?? "";
    }
    const doopId = attrMap["data-doop-id"] || attrMap.id || null;
    const hasDoopAttr = Object.keys(attrMap).some((k) => k.startsWith("data-doop-"));
    if (!hasDoopAttr) continue;

    if (attrMap["data-doop-state"] || attrMap["data-doop-variant"]) {
      states.push({
        frameId,
        elementId: doopId,
        tag: tok.tagName,
        state: attrMap["data-doop-state"] || attrMap["data-doop-variant"],
        trigger: attrMap["data-doop-on"] || "static",
        source: "imported-design",
      });
    }

    if (attrMap["data-doop-on"] || attrMap["data-doop-action"] || attrMap["data-doop-interactions"]) {
      elements.push({
        frameId,
        elementId: doopId,
        tag: tok.tagName,
        on: attrMap["data-doop-on"] || null,
        action: attrMap["data-doop-action"] || null,
        transition: attrMap["data-doop-transition"] || null,
        durationMs: attrMap["data-doop-duration"] ? Number(attrMap["data-doop-duration"]) : null,
        interactionsRaw: attrMap["data-doop-interactions"] ? decodeHtmlEntities(attrMap["data-doop-interactions"]) : null,
      });
    }

    if (attrMap["data-doop-action"]) {
      const action = attrMap["data-doop-action"];
      const navMatch = action.match(/^(navigate|overlay|scroll-to):([a-zA-Z0-9_-]+)$/);
      if (navMatch) {
        navigation.push({
          fromFrameId: frameId,
          triggerElementId: doopId,
          kind: navMatch[1],
          target: navMatch[2],
          event: attrMap["data-doop-on"] || "click",
          transition: attrMap["data-doop-transition"] || "instant",
          durationMs: Number.isFinite(Number(attrMap["data-doop-duration"])) ? Number(attrMap["data-doop-duration"]) : null,
          origin: "imported-prototype",
        });
      }
    }
  }

  return { elements, states, navigation };
}

function padFrame(n) {
  return `F${String(n).padStart(4, "0")}`;
}

function fmtSec(s) {
  return `${s.toFixed(1).padStart(4, "0")}s`;
}

/**
 * Converts one or more MotionDesignIR@1 frames into a deterministic temporal storyboard structure
 * and formats `STORYBOARD.md` using Motion Studio conventions.
 */
export function prototypeToStoryboard(
  framesInput,
  {
    projectSlug = "doop-prototype",
    fps = 30,
    defaultHoldSec = DEFAULT_SCENE_SEC,
    creativeSuggestions = [],
  } = {}
) {
  const frames = (Array.isArray(framesInput) ? framesInput : [framesInput]).map((ir) => validateDesignIR(ir));
  if (frames.length === 0) {
    throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, "prototypeToStoryboard exige ao menos um MotionDesignIR@1.");
  }
  if (!Number.isInteger(fps) || fps < 1 || fps > 120) {
    throw new MotionError(ERROR_CODES.INVALID_ARGUMENT, `fps inválido: ${fps}`);
  }

  const byFrameId = new Map(frames.map((f) => [f.source.frameId, f]));
  const allFlows = [];
  const allStates = [];
  const allEvents = [];
  const allTransitions = [];
  const allNavigation = [];

  for (const ir of frames) {
    const fid = ir.source.frameId;
    const htmlExtracted = extractInlineStatesAndAttrs(ir.sanitizedHtml, fid);
    allStates.push(...htmlExtracted.states);

    const frameFlows = [...ir.prototypeFlows];
    // Merge any flow extracted from HTML not already represented in prototypeFlows
    for (const nav of htmlExtracted.navigation) {
      const dup = frameFlows.some(
        (f) => f.fromFrameId === nav.fromFrameId && f.triggerElementId === nav.triggerElementId && f.on === nav.event && f.action === `${nav.kind}:${nav.target}`
      );
      if (!dup) {
        frameFlows.push({
          fromFrameId: nav.fromFrameId,
          triggerElementId: nav.triggerElementId,
          on: nav.event,
          action: `${nav.kind}:${nav.target}`,
          targetFrameId: nav.kind === "navigate" || nav.kind === "overlay" ? nav.target : null,
          transition: nav.transition,
          durationMs: nav.durationMs,
        });
      }
    }

    for (const flow of frameFlows) {
      const normalizedFlow = {
        fromFrameId: flow.fromFrameId || fid,
        triggerElementId: flow.triggerElementId ?? null,
        on: flow.on,
        action: flow.action,
        targetFrameId: flow.targetFrameId ?? null,
        transition: flow.transition ?? "instant",
        durationMs: Number.isFinite(flow.durationMs) ? flow.durationMs : null,
        origin: "imported-prototype",
      };
      allFlows.push(normalizedFlow);
      allEvents.push({
        frameId: normalizedFlow.fromFrameId,
        elementId: normalizedFlow.triggerElementId,
        event: normalizedFlow.on,
        action: normalizedFlow.action,
        origin: "imported-prototype",
      });
      if (normalizedFlow.targetFrameId || normalizedFlow.transition !== "instant") {
        allTransitions.push({
          fromFrameId: normalizedFlow.fromFrameId,
          toFrameId: normalizedFlow.targetFrameId,
          kind: normalizedFlow.transition,
          durationMs: normalizedFlow.durationMs ?? (normalizedFlow.transition === "instant" ? 0 : TRANSITION_DEFAULT_MS),
          trigger: `${normalizedFlow.on}${normalizedFlow.triggerElementId ? ` @${normalizedFlow.triggerElementId}` : ""}`,
          origin: "imported-prototype",
        });
      }
      if (normalizedFlow.targetFrameId) {
        allNavigation.push({
          from: normalizedFlow.fromFrameId,
          to: normalizedFlow.targetFrameId,
          event: normalizedFlow.on,
          action: normalizedFlow.action,
          resolvedInBundle: byFrameId.has(normalizedFlow.targetFrameId),
          origin: "imported-prototype",
        });
      }
    }
  }

  // Order frames deterministically starting from the entry frame and following real prototype links (BFS),
  // appending any disconnected frames in original order without inventing links.
  const orderedFrames = [];
  const visitedIds = new Set();
  const queue = [frames[0].source.frameId];
  while (queue.length > 0) {
    const curId = queue.shift();
    if (visitedIds.has(curId) || !byFrameId.has(curId)) continue;
    visitedIds.add(curId);
    const frameIR = byFrameId.get(curId);
    orderedFrames.push(frameIR);
    for (const fl of allFlows) {
      if (fl.fromFrameId === curId && fl.targetFrameId && byFrameId.has(fl.targetFrameId) && !visitedIds.has(fl.targetFrameId)) {
        queue.push(fl.targetFrameId);
      }
    }
  }
  for (const ir of frames) {
    if (!visitedIds.has(ir.source.frameId)) orderedFrames.push(ir);
  }

  // Build deterministic temporal beats
  let cursorFrame = 0;
  const beats = [];
  for (let i = 0; i < orderedFrames.length; i++) {
    const ir = orderedFrames[i];
    const fid = ir.source.frameId;
    const frameFlows = allFlows.filter((f) => f.fromFrameId === fid);
    const frameStates = allStates.filter((s) => s.frameId === fid);
    const nextFrame = orderedFrames[i + 1] ?? null;
    const outgoingToNext = nextFrame ? frameFlows.find((f) => f.targetFrameId === nextFrame.source.frameId) ?? frameFlows[0] ?? null : null;

    // Delay trigger duration if explicitly authored; otherwise deterministic default hold
    const delayFlow = frameFlows.find((f) => f.on === "delay" && Number.isFinite(f.durationMs));
    const holdSec = delayFlow ? Math.max(0.5, delayFlow.durationMs / 1000) : defaultHoldSec;
    const transMs = outgoingToNext?.durationMs ?? (outgoingToNext && outgoingToNext.transition !== "instant" ? TRANSITION_DEFAULT_MS : 0);
    const transFrames = Math.round((transMs / 1000) * fps);
    const holdFrames = Math.max(1, Math.round(holdSec * fps));
    const totalBeatFrames = holdFrames + transFrames;

    const startFrame = cursorFrame;
    const endFrame = cursorFrame + totalBeatFrames - 1;
    const startSec = startFrame / fps;
    const endSec = (endFrame + 1) / fps;

    beats.push({
      sceneIndex: i + 1,
      frameId: fid,
      frameName: ir.source.frameName ?? fid,
      editor: ir.source.editor,
      approvalStatus: ir.source.approvalStatus,
      viewport: { width: ir.viewport.width, height: ir.viewport.height, theme: ir.viewport.theme },
      startSec: Number(startSec.toFixed(3)),
      endSec: Number(endSec.toFixed(3)),
      durationSec: Number((totalBeatFrames / fps).toFixed(3)),
      startFrame,
      endFrame,
      frameCount: totalBeatFrames,
      states: frameStates,
      events: frameFlows.map((f) => ({
        on: f.on,
        action: f.action,
        triggerElementId: f.triggerElementId,
        targetFrameId: f.targetFrameId,
      })),
      transitionOut: outgoingToNext
        ? {
            kind: outgoingToNext.transition,
            durationMs: transMs,
            targetFrameId: outgoingToNext.targetFrameId,
            trigger: `${outgoingToNext.on}:${outgoingToNext.triggerElementId ?? "frame"}`,
            origin: "imported-prototype",
          }
        : null,
      origin: "imported-prototype",
    });

    cursorFrame += totalBeatFrames;
  }

  const totalFrames = cursorFrame;
  const totalDurationSec = Number((totalFrames / fps).toFixed(3));
  const primaryVp = orderedFrames[0].viewport;

  // Format STORYBOARD.md following Motion Studio convention
  const mdLines = [
    `# STORYBOARD — ${projectSlug}`,
    "",
    `**Projeto:** \`${projectSlug}\` | **Origem:** \`${orderedFrames[0].source.editor}\` (${orderedFrames[0].source.documentId})`,
    `**Formato:** ${primaryVp.width} × ${primaryVp.height} | **Duração:** ${totalDurationSec.toFixed(1)}s (${totalFrames} quadros a ${fps} FPS CFR)`,
    `**Política:** Apenas fluxos, estados e transições declarados no protótipo (\`prototypeFlows\` / \`data-doop-*\`) foram convertidos.`,
    "",
    "---",
    "",
  ];

  for (const beat of beats) {
    const safeName = wrapUntrustedText(beat.frameName, `frame-${beat.frameId}`).replace(/\r?\n/g, " ");
    mdLines.push(`## Cena ${String(beat.sceneIndex).padStart(2, "0")} — ${beat.frameId} (${beat.viewport.theme})`);
    mdLines.push(`* **Tempo:** \`${fmtSec(beat.startSec)} – ${fmtSec(beat.endSec)}\` | **Quadros:** \`${padFrame(beat.startFrame)} – ${padFrame(beat.endFrame)}\` (${beat.frameCount} frames)`);
    mdLines.push(`* **Origem:** \`imported-prototype\` | **Frame:** \`${beat.frameId}\` (${safeName}) | **Status:** \`${beat.approvalStatus ?? "draft"}\``);

    if (beat.states.length > 0) {
      const stateSummary = beat.states.map((s) => `\`${s.elementId ?? s.tag}=${s.state}\` (${s.trigger})`).join(", ");
      mdLines.push(`* **Estados de interface:** ${stateSummary}`);
    } else {
      mdLines.push(`* **Estados de interface:** estado base do frame (\`theme=${beat.viewport.theme}\`)`);
    }

    if (beat.events.length > 0) {
      const evtSummary = beat.events.map((e) => `\`${e.on}\` em \`${e.triggerElementId ?? "frame"}\` → \`${e.action}\``).join("; ");
      mdLines.push(`* **Eventos e Navegação (importados):** ${evtSummary}`);
    } else {
      mdLines.push(`* **Eventos e Navegação (importados):** nenhum gatilho declarado neste frame`);
    }

    if (beat.transitionOut) {
      mdLines.push(`* **Transição de Saída (importada):** \`${beat.transitionOut.kind}\` (${beat.transitionOut.durationMs} ms) → \`${beat.transitionOut.targetFrameId ?? "estado"}\` via \`${beat.transitionOut.trigger}\``);
    } else {
      mdLines.push(`* **Transição de Saída:** hold final (fim da sequência importada)`);
    }
    mdLines.push("");
    mdLines.push("---");
    mdLines.push("");
  }

  // Strictly separate any posterior creative suggestions from imported prototype transitions
  const cleanSuggestions = Array.isArray(creativeSuggestions)
    ? creativeSuggestions.map((s) => ({ ...s, origin: "creative-suggestion-unverified" }))
    : [];
  if (cleanSuggestions.length > 0) {
    mdLines.push("## Sugestões Criativas Posteriores (Não presentes no protótipo original)");
    for (const s of cleanSuggestions) {
      mdLines.push(`* \`[creative-suggestion]\` ${String(s.description ?? s.summary ?? JSON.stringify(s))}`);
    }
    mdLines.push("");
  }

  const markdown = mdLines.join("\n");

  return {
    schemaVersion: "1.0.0",
    projectSlug,
    fps,
    totalFrames,
    totalDurationSec,
    importedFrom: orderedFrames.map((f) => ({
      editor: f.source.editor,
      documentId: f.source.documentId,
      frameId: f.source.frameId,
      approvalStatus: f.source.approvalStatus,
    })),
    beats,
    states: allStates,
    events: allEvents,
    transitions: allTransitions,
    navigationGraph: allNavigation,
    creativeSuggestions: cleanSuggestions,
    markdown,
  };
}

export async function writeStoryboardMarkdown(framesInput, outputPath, options = {}) {
  const result = prototypeToStoryboard(framesInput, options);
  const abs = path.resolve(outputPath);
  await writeFile(abs, result.markdown, "utf8");
  return { ...result, outputPath: abs };
}
