/**
 * MOTION Core — errors.mjs
 * Structured errors shared by renderers, QA and CLI.
 * Each error carries a stable machine code (for agents/automation), a plain-language
 * message (for non-technical users) and an actionable hint.
 */
export const ERROR_CODES = Object.freeze({
  BROWSER_MISSING: "MOTION_BROWSER_MISSING",
  BROWSER_VERSION_MISMATCH: "MOTION_BROWSER_VERSION_MISMATCH",
  BROWSER_SYSTEM_DEPS: "MOTION_BROWSER_SYSTEM_DEPS",
  BROWSER_LAUNCH_FAILED: "MOTION_BROWSER_LAUNCH_FAILED",
  BROWSER_UNSUPPORTED: "MOTION_BROWSER_UNSUPPORTED",
  INVALID_SAMPLE_FRAMES: "MOTION_INVALID_SAMPLE_FRAMES",
  INVALID_ARGUMENT: "MOTION_INVALID_ARGUMENT",
  RENDER_PAGE_ERROR: "MOTION_RENDER_PAGE_ERROR",
  RENDER_MODULE_IMPORT: "MOTION_RENDER_MODULE_IMPORT",
  RENDER_CONTROLLER_MISSING: "MOTION_RENDER_CONTROLLER_MISSING",
  RENDER_ASSET_FAILED: "MOTION_RENDER_ASSET_FAILED",
  SVG_INVALID: "MOTION_SVG_INVALID",
  SVG_UNSAFE: "MOTION_SVG_UNSAFE",
  ICON_NOT_FOUND: "MOTION_ICON_NOT_FOUND",
  BRIDGE_SCHEMA_INVALID: "MOTION_BRIDGE_SCHEMA_INVALID",
  BRIDGE_SECURITY_VIOLATION: "MOTION_BRIDGE_SECURITY_VIOLATION",
  BRIDGE_UNSAFE_URL: "MOTION_BRIDGE_UNSAFE_URL",
  BRIDGE_PATH_TRAVERSAL: "MOTION_BRIDGE_PATH_TRAVERSAL",
  BRIDGE_TOKEN_CYCLE: "MOTION_BRIDGE_TOKEN_CYCLE",
  BRIDGE_ADAPTER_INVALID: "MOTION_BRIDGE_ADAPTER_INVALID",
  BRIDGE_ASSET_FAILED: "MOTION_BRIDGE_ASSET_FAILED",
  BRIDGE_MIME_MISMATCH: "MOTION_BRIDGE_MIME_MISMATCH",
  BRIDGE_SIZE_LIMIT: "MOTION_BRIDGE_SIZE_LIMIT",
  BRIDGE_NORMALIZE_BLOCKED: "MOTION_BRIDGE_NORMALIZE_BLOCKED",
  BRIDGE_EXPORT_CONFLICT: "MOTION_BRIDGE_EXPORT_CONFLICT",
  BRIDGE_EXPORT_PROTECTED: "MOTION_BRIDGE_EXPORT_PROTECTED",
  BRIDGE_EXPORT_BLOCKED: "MOTION_BRIDGE_EXPORT_BLOCKED",
  BRIDGE_RATE_LIMITED: "MOTION_BRIDGE_RATE_LIMITED",
});

export class MotionError extends Error {
  constructor(code, message, { hint, details, exitCode = 1, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "MotionError";
    this.code = code;
    this.hint = hint ?? null;
    this.details = details ?? null;
    this.exitCode = exitCode;
  }
  toJSON() {
    return { code: this.code, message: this.message, hint: this.hint, details: this.details };
  }
}

/** Prints a MotionError (or any error) on stderr as one JSON line plus a human line. */
export function reportError(error, { json = false } = {}) {
  const payload = error instanceof MotionError
    ? error.toJSON()
    : { code: "MOTION_UNEXPECTED", message: error?.message ?? String(error), hint: null, details: null };
  if (json) {
    console.error(JSON.stringify({ status: "FAIL", error: payload }));
  } else {
    console.error(`❌ [${payload.code}] ${payload.message}`);
    if (payload.hint) console.error(`   → ${payload.hint}`);
  }
  return error instanceof MotionError ? error.exitCode : 1;
}
