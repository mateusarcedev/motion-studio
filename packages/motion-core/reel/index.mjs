/**
 * MOTION Core — reel/index.mjs
 * Smart Reel Editor & Voice Studio programmatic API (agent-agnostic, JSON in/out).
 */
export { REEL_ERRORS, probeMedia, sha256File, monoDownmix } from "./util.mjs";
export { analyzeMedia, energyEnvelope, detectSpeech, derivePauses, measureLoudness, measureStats, detectHum } from "./analyze.mjs";
export {
  transcribeMedia, importSubtitleFile, parseSubtitles, subtitlesToTranscript, transcriptToSrt, toSrt, srtTime,
  applyCorrections, deriveSilences, listSttProviders, getSttProvider, registerSttProvider, sttDoctor, setupCommands,
  sttPython, sttModelsDir, normalizeFasterWhisper, longestRepeatRun,
} from "./stt/index.mjs";
