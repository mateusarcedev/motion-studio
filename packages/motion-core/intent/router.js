/**
 * MOTION Core — Intent-Driven Creative Router
 * Classifies unstructured natural language requests into multi-dimensional creative briefs
 * and routes to the optimal specialist skills and technical parameters.
 */

export const SUBJECT_DOMAINS = [
  "technology",
  "software",
  "biology",
  "science",
  "history",
  "manufacturing",
  "industry",
  "business",
  "culinary",
  "fashion",
  "education",
  "entertainment",
  "finance",
  "health",
  "general",
];

export const INTENT_TYPES = [
  "explain",
  "teach",
  "educate",
  "promote",
  "sell",
  "entertain",
  "storytell",
  "demonstrate",
  "demonstrate_process",
  "showcase_software",
  "compare",
  "visualize_data",
  "document",
  "artistic",
];

export const AUDIENCE_PROFILES = [
  "children",
  "students",
  "developers",
  "consumers",
  "enterprise_b2b",
  "general_public",
  "specialists",
];

export const CHANNELS = [
  "instagram_feed",
  "instagram_stories",
  "instagram_reels",
  "tiktok",
  "youtube_shorts",
  "youtube_longform",
  "linkedin",
  "website_hero",
  "presentation_slide",
  "local_display",
  "general_video",
];

export const VISUAL_LANGUAGES = [
  "motion_graphics_2d",
  "animated_infographic",
  "scientific_visualization",
  "educational_animation",
  "animated_photography",
  "commercial_motion",
  "ui_motion",
  "3d_scene",
  "cinematic_film",
  "diagram_motion",
  "editorial_storytelling",
  "hybrid",
];

/**
 * Calculates adaptive duration based on narrative acts, complexity, and cognitive pauses.
 * @param {Object} options Calculation options
 * @returns {Object} Calculated duration details
 */
export function calculateAdaptiveDuration({
  requestedSeconds = null,
  actCount = 4,
  complexity = "medium",
  intent = "explain",
  readingWordsPerMinute = 130,
} = {}) {
  if (requestedSeconds != null && requestedSeconds > 0) {
    return {
      seconds: requestedSeconds,
      negotiated: false,
      fps: 30,
      totalFrames: requestedSeconds * 30,
      actDurationSec: requestedSeconds / Math.max(1, actCount),
      minCognitivePausePerAct: Math.max(1.0, (requestedSeconds / Math.max(1, actCount)) * 0.25),
      rationale: "Respeita duração estritamente solicitada pelo usuário.",
    };
  }

  // Base time per act depending on complexity and intent
  let secondsPerAct = 7.5;
  if (complexity === "high" || intent === "explain_process" || intent === "teach") {
    secondsPerAct = 11.25; // 4 acts -> 45s
  } else if (complexity === "low" || intent === "promote" || intent === "sell") {
    secondsPerAct = 3.75; // 4 acts -> 15s
  }

  const calculated = Math.round(actCount * secondsPerAct);
  const minPause = Math.max(1.5, secondsPerAct * 0.2);

  return {
    seconds: calculated,
    negotiated: true,
    fps: 30,
    totalFrames: calculated * 30,
    actDurationSec: secondsPerAct,
    minCognitivePausePerAct: minPause,
    rationale: `Proposta adaptativa baseada em ${actCount} atos narrativos com complexidade ${complexity} e pausa cognitiva mínima de ${minPause.toFixed(1)}s.`,
  };
}

/**
 * Single-owner routes, in order of precedence: static pieces and sites, existing footage, narrated shorts,
 * product films. Returns null when the multi-dimensional classification decides.
 */
export function resolveRoute(prompt = "") {
  const text = String(prompt).toLowerCase();
  const word = (re) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${re})(?![\\p{L}\\p{N}])`, "u").test(text);
  const footage = word("(?:que )?(?:eu |n[oó]s |a gente )?(?:gravei|gravamos|gravou|filmei|filmamos)") || word("gravad[oa]s?|gravaç(?:ão|ões)|filmagem|footage|talking.head");
  const editing = word("edit(?:a|e|ar|ando|em)|cort(?:a|e|ar)|legend(?:a|e|ar)|tir(?:a|e|ar) as pausas|melhor(?:a|e|ar) o áudio|transform(?:a|e|ar)");
  const ownVideo = word("(?:meu|minha|nosso|nossa|esse|este) (?:vídeo|video|reel|reels|podcast|entrevista|tutorial)");
  if ((footage && editing) || (editing && ownVideo) || word("tir(?:a|e|ar) as pausas")) return "reel-editor";
  if (word("carross[eé]l|carousel|lâminas")) return "carousel-studio";
  if (word("story|stories")) return "story-studio";
  if (word("landing page|landing|site|website")) return "web-director";
  if (word("post|posts") && !word("vídeo|video|filme|teaser")) return "feed-studio";
  if (footage) return null;
  if (word("shorts?|vídeo vertical") && word("narrad[oa]|narração|ilustrad[oa]|versículo") || word("shorts? (?:deste|desse|do|a partir d[eo]) (?:texto|versículo|história)")) return "shorts-director";
  const film = word("vídeo|video|filme|film|teaser|trailer|reel|reels");
  if (word("explica(?:r|tivo)?|explique|como funciona|aula|tutorial")) return null;
  if (word("filme (?:do|de|da|para o|para a) (?:nosso |nossa |meu |minha )?(?:produto|marca|app|aplicativo|feature)")) return "cinematic-product-director";
  if (film && word("lançamento|lançar|launch|estilo apple")) return "cinematic-product-director";
  if (word("teaser") && word("app|aplicativo|feature|produto|software|plataforma|saas|marca")) return "cinematic-product-director";
  if (film && word("logo(?:tipo)?") && word("3d")) return "cinematic-product-director";
  return null;
}

/**
 * Classifies a user request into independent creative dimensions.
 * @param {string|Object} input User's natural language request or options object
 * @param {Object} context Optional project and brand context
 * @returns {Object} Multi-dimensional classification
 */
export function classifyCreativeIntent(input = "", context = {}) {
  let prompt = "";
  let targetDuration = null;
  let targetChannel = null;

  if (typeof input === "object" && input !== null) {
    prompt = input.prompt || "";
    targetDuration = input.targetDuration || input.duration || null;
    targetChannel = input.channel || null;
    context = { ...input, ...context };
  } else {
    prompt = String(input || "");
  }

  const text = prompt.toLowerCase();

  // 1. DIMENSION: SUBJECT (Assunto)
  let subject = "general";
  if (text.match(/engine|plataforma|framework|software|devmetrics|sdk/)) {
    subject = "software";
  } else if (text.match(/api|código|algoritmo|computa|tecnologia|programação|backend|frontend|dev|git|docker/)) {
    subject = "technology";
  } else if (text.match(/lula|biolog|marinho|animal|espécie|natureza|oceano|ciência|profundidade/)) {
    subject = "science";
  } else if (text.match(/fábrica|alimento|produção|manufatura|indústria|processo|liofiliza|industrial/)) {
    subject = "industry";
  } else if (text.match(/festa|confeitaria|bolo|evento|doce|gastronomia|culinária|restaurante/)) {
    subject = "culinary";
  } else if (text.match(/história|guerra|civilização|século|passado/)) {
    subject = "history";
  } else if (text.match(/empresa|b2b|vendas|saas|marketing|conversão|negócio|cliente/)) {
    subject = "business";
  }

  // 2. DIMENSION: INTENT (Intenção)
  const intents = [];
  if (text.match(/como funciona|explicar|explique|entender|por que|o que é/)) {
    intents.push("explain");
  }
  if (text.match(/ensinar|aula|didático|aprenda|passo a passo|tutorial/)) {
    intents.push("teach");
  }
  if (text.match(/publicitário|propaganda|anúncio|comercial|vender|compre|promova|divulg/)) {
    intents.push("promote");
    intents.push("sell");
  }
  if (text.match(/processo|etapas|linha de produção|fluxo/)) {
    intents.push("demonstrate_process");
    intents.push("demonstrate");
  }
  if (text.match(/app|aplicativo|software|interface|ui|plataforma|dashboard|demo|showcase/)) {
    intents.push("showcase_software");
    intents.push("demonstrate");
  }
  if (text.match(/história|jornada|narrativa|conto/)) {
    intents.push("storytell");
  }
  if (text.match(/dados|gráfico|estatística|métrica/)) {
    intents.push("visualize_data");
  }
  if (intents.length === 0) {
    intents.push(text.includes("vídeo") || text.includes("post") ? "explain" : "artistic");
  }

  // 3. DIMENSION: AUDIENCE (Público)
  let audience = "general_public";
  if (text.match(/criança|infantil|escolar/)) audience = "children";
  else if (text.match(/estudante|aluno|iniciante|acadêmico/)) audience = "students";
  else if (text.match(/desenvolvedor|dev|programador|engenheiro/)) audience = "developers";
  else if (text.match(/empresa|b2b|executivo|investidor|diretor/)) audience = "enterprise_b2b";
  else if (text.match(/consumidor|cliente|público feminino|comprador/)) audience = "consumers";
  else if (text.match(/pesquisador|cientista|especialista|médico/)) audience = "specialists";

  // 4. DIMENSION: CHANNEL & RATIO (Canal & Proporção)
  let channel = targetChannel || "general_video";
  let targetRatio = "9:16";
  let isVertical = true;

  if (targetChannel === "vertical_social" || text.match(/vertical|9:16/)) {
    channel = "vertical_social";
    targetRatio = "9:16";
    isVertical = true;
  } else if (text.match(/story|stories/)) {
    channel = "instagram_stories";
    targetRatio = "9:16";
  } else if (text.match(/reels|tiktok|shorts/)) {
    channel = text.includes("tiktok") ? "tiktok" : text.includes("shorts") ? "youtube_shorts" : "instagram_reels";
    targetRatio = "9:16";
  } else if (text.match(/carrossel|carousel|lâminas/)) {
    channel = "instagram_feed";
    targetRatio = "4:5";
  } else if (text.match(/linkedin/)) {
    channel = "linkedin";
    targetRatio = text.includes("vídeo") ? "16:9" : "4:5";
    isVertical = targetRatio !== "16:9";
  } else if (text.match(/youtube(?! shorts)/) || text.match(/horizontal|16:9|widescreen/)) {
    channel = "youtube_longform";
    targetRatio = "16:9";
    isVertical = false;
  } else if (text.match(/site|landing|web/)) {
    channel = "website_hero";
    targetRatio = "16:9";
    isVertical = false;
  }

  // 5. DIMENSION: DURATION (Duração Adaptativa)
  let requestedDurationSec = targetDuration;
  const durMatch = text.match(/(\d+)\s*(segundos|seg|s\b|minutos|min\b)/);
  if (!requestedDurationSec && durMatch) {
    const val = parseInt(durMatch[1], 10);
    requestedDurationSec = durMatch[2].startsWith("min") ? val * 60 : val;
  }

  // Propose adaptive duration if not specified
  let proposedDurationSec = requestedDurationSec;
  let durationRationale = "Especificada explicitamente pelo usuário.";
  if (!proposedDurationSec) {
    if (intents.includes("sell") || intents.includes("promote")) {
      proposedDurationSec = 15;
      durationRationale = "Comercial de alto impacto: 15s permite retenção máxima em feeds e stories sem fadiga.";
    } else if (intents.includes("demonstrate_process") || subject === "industry") {
      proposedDurationSec = 45;
      durationRationale = "Demonstração de processo em 4 atos: 45s fornece ~11s por ato com pausas cognitivas.";
    } else if (intents.includes("explain") && (subject === "technology" || subject === "software")) {
      proposedDurationSec = 35;
      durationRationale = "Explicação técnica de APIs: 35s permite demonstrar requisição, roteamento e resposta JSON sem pressa.";
    } else if (subject === "science") {
      proposedDurationSec = 30;
      durationRationale = "Divulgação científica social: 30s é a janela ideal para apresentar o enigma biológico, o fato óptico e a conclusão evolutiva.";
    } else {
      proposedDurationSec = 30;
      durationRationale = "Duração equilibrada padrão para narrativa audiovisual concisa.";
    }
  }

  // 6. DIMENSION: VISUAL LANGUAGE & SPECIALIST ROUTING
  let visualLanguage = "motion_graphics_2d";
  const specialists = [];
  const requiredGates = ["briefing_approval", "art_direction_approval"];
  let researchRequired = false;
  let commercialCta = false;
  let useStageshow = false;

  if (subject === "science") {
    visualLanguage = "scientific_visualization";
    specialists.push("explainer-motion");
    researchRequired = true;
    commercialCta = false;
  } else if (subject === "industry") {
    visualLanguage = "diagram_motion";
    specialists.push("explainer-motion");
    specialists.push("diagram-design");
    researchRequired = true;
    commercialCta = false;
  } else if (intents.includes("showcase_software") || subject === "software" || text.includes("cursor") || text.includes("bento")) {
    if ((intents.includes("explain") || intents.includes("teach")) && !text.includes("showcase") && !text.includes("cursor")) {
      visualLanguage = "diagram_motion";
      specialists.push("explainer-motion");
      researchRequired = true;
    } else {
      visualLanguage = "ui_motion";
      specialists.push("motion-director");
      useStageshow = true;
      specialists.push("stageshow");
    }
  } else if (subject === "technology") {
    visualLanguage = "diagram_motion";
    specialists.push("explainer-motion");
    researchRequired = true;
  } else if (intents.includes("sell") || intents.includes("promote") || subject === "culinary") {
    visualLanguage = "commercial_motion";
    specialists.push("motion-director");
    specialists.push("motion-designer");
    commercialCta = true;
    researchRequired = false;
  } else if (intents.includes("storytell")) {
    visualLanguage = "cinematic_film";
    specialists.push("motion-director");
  }

  // A single-owner route replaces the generic specialists.
  const route = resolveRoute(prompt);
  if (route) {
    specialists.length = 0;
    specialists.push(route);
    useStageshow = false;
    if (route === "cinematic-product-director") visualLanguage = "cinematic_film";
  }

  // 7. BRANDING & PALETTE STRATEGY
  let brandMode = "bespoke_subject";
  let suggestedPalette = null;

  if (context.hasBrandSystem && context.brandTokens) {
    brandMode = "inherited_brand";
    suggestedPalette = context.brandTokens.color;
  } else {
    // Generate bespoke palette based strictly on SUBJECT, never imposing MOTION mint
    if (subject === "science") {
      suggestedPalette = {
        background: "#030712", // deep abyss
        surface: "#0A1128",
        primaryText: "#F0F4F8",
        accent: "#00E5FF",     // bioluminescent cyan
        secondaryAccent: "#3B82F6",
        muted: "#64748B",
      };
    } else if (subject === "culinary") {
      suggestedPalette = {
        background: "#16040A", // warm burgundy
        surface: "#2D0A14",
        primaryText: "#FDFBF7",
        accent: "#E5C378",     // champagne gold
        secondaryAccent: "#C48B4D",
        muted: "#A8838F",
      };
    } else if (subject === "industry") {
      suggestedPalette = {
        background: "#0B0F17", // industrial charcoal
        surface: "#151C28",
        primaryText: "#E2E8F0",
        accent: "#F59E0B",     // amber / thermal warning
        secondaryAccent: "#38BDF8", // cryogenic blue
        muted: "#94A3B8",
      };
    } else if (subject === "software" || subject === "technology") {
      suggestedPalette = {
        background: "#0D1117", // dark terminal
        surface: "#161B22",
        primaryText: "#F0F6FC",
        accent: "#58A6FF",     // code blueprint blue
        secondaryAccent: "#3FB950", // 200 OK green
        muted: "#8B949E",
      };
    } else {
      suggestedPalette = {
        background: "#0F172A",
        surface: "#1E293B",
        primaryText: "#F8FAFC",
        accent: "#6366F1",
        secondaryAccent: "#EC4899",
        muted: "#94A3B8",
      };
    }
  }

  // 8. AUDIO STRATEGY
  let audioStrategy = "music_with_sfx";
  if (intents.includes("teach") || intents.includes("explain")) {
    audioStrategy = "voiceover_or_caption_sync";
  } else if (intents.includes("sell")) {
    audioStrategy = "rhythm_beat_music";
  }

  const finalDurationSec = targetDuration || requestedDurationSec || proposedDurationSec;

  return {
    rawPrompt: prompt,
    subject,
    intents,
    audience,
    channel,
    aspectRatio: targetRatio,
    isVertical,
    durationSeconds: finalDurationSec,
    duration: {
      requestedSec: requestedDurationSec || targetDuration,
      proposedSec: finalDurationSec,
      fps: 30,
      totalFrames: finalDurationSec * 30,
      rationale: durationRationale,
    },
    visualLanguage,
    route,
    specialists,
    useStageshow,
    researchRequired,
    commercialCta,
    requiresCommercialCTA: commercialCta,
    audioStrategy,
    branding: {
      mode: brandMode,
      palette: suggestedPalette,
      rule: "Adaptação estrita ao assunto. Nunca forçar a identidade do MOTION Studio (mint/dark).",
    },
    qualityGates: requiredGates,
  };
}
