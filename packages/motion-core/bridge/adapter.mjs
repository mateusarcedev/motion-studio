/**
 * MOTION Core Bridge — adapter.mjs
 * Minimal editor-agnostic EditorAdapter contract & registry.
 * Enables Doop first and future adapters (Figma, Pencil, Paper) without core coupling.
 */
import { ERROR_CODES, MotionError } from "../lib/errors.mjs";

export const REQUIRED_ADAPTER_METHODS = Object.freeze([
  "importTokens",
  "exportTokens",
  "importFrame",
  "validateTargetReadiness",
]);

export const OPTIONAL_EXPORT_METHODS = Object.freeze([
  "inspectRemoteState",
  "planExport",
  "executeExportOperation",
  "verifyExportedState",
]);

const EDITOR_ID_RE = /^[a-z0-9-]+$/;

/** Asserts that an adapter satisfies the EditorAdapter contract (backward compatible with M1 adapters). */
export function assertEditorAdapter(adapter) {
  if (!adapter || typeof adapter !== "object") {
    throw new MotionError(ERROR_CODES.BRIDGE_ADAPTER_INVALID, "EditorAdapter deve ser um objeto.");
  }
  if (typeof adapter.editor !== "string" || !EDITOR_ID_RE.test(adapter.editor)) {
    throw new MotionError(ERROR_CODES.BRIDGE_ADAPTER_INVALID, `Identificador de editor inválido: ${adapter.editor}`);
  }
  if (!adapter.capabilities || typeof adapter.capabilities !== "object") {
    throw new MotionError(ERROR_CODES.BRIDGE_ADAPTER_INVALID, `Adapter '${adapter.editor}' deve declarar capabilities.`);
  }
  for (const method of REQUIRED_ADAPTER_METHODS) {
    if (typeof adapter[method] !== "function") {
      throw new MotionError(
        ERROR_CODES.BRIDGE_ADAPTER_INVALID,
        `Adapter '${adapter.editor}' não implementa o método obrigatório '${method}()'.`
      );
    }
  }
  if (adapter.capabilities.export === true) {
    for (const method of OPTIONAL_EXPORT_METHODS) {
      if (typeof adapter[method] !== "function") {
        throw new MotionError(
          ERROR_CODES.BRIDGE_ADAPTER_INVALID,
          `Adapter '${adapter.editor}' declara capabilities.export=true mas não implementa '${method}()'.`
        );
      }
    }
  }
  return adapter;
}

/** Checks whether an adapter supports optional Motion-to-Design export operations. */
export function supportsExportOperations(adapter) {
  return Boolean(
    adapter?.capabilities?.export === true &&
    OPTIONAL_EXPORT_METHODS.every((m) => typeof adapter[m] === "function")
  );
}

/** Creates an isolated registry of EditorAdapter instances (no global mutable state required). */
export function createAdapterRegistry(initialAdapters = []) {
  const adapters = new Map();
  const registry = {
    register(adapter) {
      assertEditorAdapter(adapter);
      if (adapters.has(adapter.editor)) {
        throw new MotionError(ERROR_CODES.BRIDGE_ADAPTER_INVALID, `Adapter '${adapter.editor}' já registrado.`);
      }
      adapters.set(adapter.editor, adapter);
      return registry;
    },
    has(editor) {
      return adapters.has(editor);
    },
    get(editor) {
      const adapter = adapters.get(editor);
      if (!adapter) {
        throw new MotionError(
          ERROR_CODES.BRIDGE_ADAPTER_INVALID,
          `Nenhum EditorAdapter registrado para '${editor}'.`,
          { hint: `Disponíveis: ${[...adapters.keys()].join(", ") || "nenhum"}` }
        );
      }
      return adapter;
    },
    list() {
      return [...adapters.values()].map((a) => ({ editor: a.editor, capabilities: { ...a.capabilities } }));
    },
  };
  for (const a of initialAdapters) registry.register(a);
  return registry;
}
