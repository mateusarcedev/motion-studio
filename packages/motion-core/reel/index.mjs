/**
 * MOTION Core — reel/index.mjs
 * Smart Reel Editor & Voice Studio programmatic API (agent-agnostic, JSON in/out).
 */
export { REEL_ERRORS, probeMedia, sha256File, monoDownmix } from "./util.mjs";
export { analyzeMedia, energyEnvelope, detectSpeech, derivePauses, measureLoudness, measureStats, detectHum, detectSourceCuts } from "./analyze.mjs";
export {
  transcribeMedia, importSubtitleFile, parseSubtitles, subtitlesToTranscript, transcriptToSrt, toSrt, srtTime,
  applyCorrections, deriveSilences, listSttProviders, getSttProvider, registerSttProvider, sttDoctor, setupCommands,
  sttPython, sttModelsDir, normalizeFasterWhisper, longestRepeatRun,
} from "./stt/index.mjs";
export { VOICE_PRESETS, listVoicePresets, resolveVoiceParams, buildVoiceChain, processVoice, measureLatency, speechSuppression, pauseNoiseRatio, deepFilterBinary } from "./voice.mjs";
export { TIMELINE_SCHEMA, TIMELINE_VERSION, computeDst, remapWords, refineWordTiming, srcToDst, validateTimeline, assertTimeline, timelineHash, loadTimeline, saveTimeline } from "./timeline.mjs";
export { DEFAULT_CAPTION_STYLE, buildPages, buildAss, placeCaptions, pagesToSrt, wordsToSrt, captionsJson, displayWord, balanceLines } from "./captions.mjs";
export { EDIT_PRESETS, listEditPresets, planEdit, findRepetitions, findRestarts, findPhrase } from "./plan.mjs";
export { DEFAULT_OVERLAY_STYLE, OVERLAY_KINDS, overlayHtml, overlayLayers, renderOverlayLayers } from "./overlays.mjs";
export { renderTimeline, readProgress, framingFilter, audioRanges } from "./render.mjs";
export { qaReel, compareRenders, measureCaptionBoxes, loadRenderReport } from "./qa_reel.mjs";
