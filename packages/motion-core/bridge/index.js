/**
 * MOTION Core Bridge — index.js
 * Editor-agnostic contracts, zero-trust validation, Asset Hydrator,
 * Design-to-Motion Normalizer, Prototype-to-Storyboard, and registered EditorAdapters.
 */
export {
  REQUIRED_ADAPTER_METHODS,
  assertEditorAdapter,
  createAdapterRegistry,
} from "./adapter.mjs";
export {
  SCHEMA_VERSION,
  TOKEN_TYPES,
  computeDesignIRHash,
  extractAliasTarget,
  validateAssetProvenance,
  validateDesignIR,
  validateTokenBundle,
} from "./contracts.mjs";
export {
  assertSafeHostResolution,
  assertSafeProjectPath,
  assertSafeRelativePath,
  assertSafeRemoteUrl,
  canonicalJson,
  decodeHtmlEntities,
  detectPromptInjection,
  inspectAndSanitizeCss,
  isPrivateOrReservedIp,
  parseSrcset,
  sanitizeCssValue,
  scanUntrustedHtml,
  serializeHtmlTokens,
  sha256Json,
  tokenizeHtml,
  wrapUntrustedText,
} from "./security.mjs";
export {
  discoverAssetsFromIR,
  hydrateAssets,
  inspectAndSanitizeAssetBinary,
  secureFetchAsset,
} from "./assets.mjs";
export {
  buildTokensCss,
  normalizeDesignToMotion,
} from "./normalize.mjs";
export {
  prototypeToStoryboard,
  writeStoryboardMarkdown,
} from "./prototype-to-storyboard.mjs";
export { compareVisualFidelity } from "./fidelity.mjs";
export { createDoopAdapter, toMotionBrandTokens } from "./adapters/doop.mjs";
