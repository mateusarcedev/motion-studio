/**
 * MOTION Core Bridge — index.js
 * Editor-agnostic contracts, zero-trust validation, and registered EditorAdapters.
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
  assertSafeRelativePath,
  assertSafeRemoteUrl,
  canonicalJson,
  detectPromptInjection,
  sanitizeCssValue,
  scanUntrustedHtml,
  sha256Json,
  wrapUntrustedText,
} from "./security.mjs";
export { createDoopAdapter, toMotionBrandTokens } from "./adapters/doop.mjs";
