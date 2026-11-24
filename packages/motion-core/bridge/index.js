/**
 * MOTION Core Bridge — index.js
 * Editor-agnostic contracts, zero-trust validation, Asset Hydrator,
 * Design-to-Motion Normalizer, Prototype-to-Storyboard, and registered EditorAdapters.
 */
export {
  REQUIRED_ADAPTER_METHODS,
  OPTIONAL_EXPORT_METHODS,
  assertEditorAdapter,
  createAdapterRegistry,
  supportsExportOperations,
} from "./adapter.mjs";
export {
  EXPORT_POLICIES,
  SCHEMA_VERSION,
  TOKEN_TYPES,
  computeDesignIRHash,
  computeExportPlanHash,
  extractAliasTarget,
  validateAssetProvenance,
  validateDesignIR,
  validateExportCompatibilityReport,
  validateExportOperation,
  validateExportPlan,
  validateExportResult,
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
export {
  executeExportPlan,
  exportToEditor,
  inspectExportSource,
  planExportToEditor,
  prepareOutgoingFrameHtml,
  stripImageMetadata,
  stripPngMetadata,
  validateExportPlanAndPreconditions,
} from "./export-to-editor.mjs";
export { createDoopAdapter, DOOP_MCP_TOOL_NAMES, splitHtmlChunks, toMotionBrandTokens } from "./adapters/doop.mjs";
