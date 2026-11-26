/**
 * Composition-aware QA guidance shared by normalization reports and clients.
 * The route selects existing Motion Core gates; it does not implement renderers.
 */
const ROUTES = Object.freeze({
  "responsive-website": {
    tools: ["qa_viewports", "render_static"],
    conditionalTools: [{ tool: "render_frames", when: "animated page" }, { tool: "qa_determinism", when: "animated page" }],
    coreChecks: [],
    manualReview: ["visual hierarchy", "responsive behavior", "motion accessibility"],
    notes: ["Check all five supported viewport sizes.", "Do not use fixed-artboard dimensions as a substitute for responsive QA."],
  },
  "fixed-artboard": {
    tools: ["render_static"],
    conditionalTools: [],
    coreChecks: [],
    manualReview: ["composition and legibility at declared artboard dimensions"],
    notes: ["Render at the declared artboard dimensions.", "Do not run responsive overflow checks on a deliberately fixed composition."],
  },
  carousel: {
    tools: ["render_carousel", "qa_safe_zones"],
    conditionalTools: [{ tool: "render_frames", when: "animated slides" }, { tool: "qa_determinism", when: "animated slides" }],
    coreChecks: ["qaFrames"],
    manualReview: ["narrative continuity", "slide-to-slide visual rhythm"],
    notes: ["Check safe zones on every slide.", "Run qa_determinism only when the carousel contains animation."],
  },
  story: {
    tools: ["render_frames", "qa_determinism", "qa_safe_zones"],
    conditionalTools: [],
    coreChecks: ["qaFrames"],
    manualReview: ["story arc", "legibility within platform controls"],
    notes: ["Use the vertical story preset and review every sampled frame.", "If assembled as video, run motion.mjs qa media on the MP4."],
  },
  video: {
    tools: ["render_frames", "qa_determinism", "render_video"],
    conditionalTools: [{ tool: "qa_safe_zones", when: "vertical or social delivery" }],
    coreChecks: ["qaFrames", "qaMedia"],
    manualReview: ["pacing", "transitions", "typographic timing", "sound-image relationship"],
    notes: ["Validate the numbered frames before assembly and the final media after assembly.", "Run qa_safe_zones only for social or vertical delivery."],
  },
  "animated-composition": {
    tools: ["render_frames", "qa_determinism"],
    conditionalTools: [{ tool: "qa_safe_zones", when: "social delivery" }],
    coreChecks: ["qaFrames"],
    manualReview: ["motion intent", "temporal continuity", "reduced-motion behavior where applicable"],
    notes: ["Sample temporal frames and compare independent renders.", "Add qa_safe_zones only when the composition has a social delivery target."],
  },
});

/**
 * Return the existing MCP tools and Motion Core checks for a creative surface.
 * sourceTarget preserves aliases that collapse to the same renderer target.
 */
export function resolveQualityRouting({ target = "frame", sourceTarget = target, animated = false } = {}) {
  const raw = String(sourceTarget ?? target).toLowerCase();
  const normalized = String(target ?? "frame").toLowerCase();
  let category;
  if (raw === "video") category = "video";
  else if (normalized === "web-director" || raw === "web" || raw === "web-director") category = "responsive-website";
  else if (normalized === "carousel") category = "carousel";
  else if (normalized === "story") category = "story";
  else if (normalized === "svg-motion" || raw === "motion" || animated) category = "animated-composition";
  else category = "fixed-artboard";
  const route = ROUTES[category];
  return {
    category,
    tools: [...route.tools],
    conditionalTools: route.conditionalTools.map((item) => ({ ...item })),
    coreChecks: [...route.coreChecks],
    manualReview: [...route.manualReview],
    notes: [...route.notes],
  };
}

export const QA_COMPOSITION_CATEGORIES = Object.freeze(Object.keys(ROUTES));
