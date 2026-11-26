/** Local Motion MCP server. stdio is the sole MCP transport; stdout is protocol-only. */
import { createInterface } from "node:readline";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { VERSION } from "./version.mjs";
import { createMcpRuntime, invokeTool, TOOLS } from "./mcp-tools.mjs";

export const PROTOCOL_VERSION = "2025-06-18";
export { TOOLS };

const defaultRuntime = createMcpRuntime();

function errorData(error) {
  return {
    code: error?.code === "ABORT_ERR" || error?.name === "AbortError" ? "MOTION_CANCELLED" : (error?.code ?? "MOTION_UNEXPECTED"),
    message: error?.message ?? String(error),
    hint: error?.hint ?? null,
    ...(error?.details == null ? {} : { details: error.details }),
  };
}
/** Handles one JSON-RPC message; notification requests return null. */
export async function handleMessage(msg, runtime = defaultRuntime) {
  const reply = (result) => ({ jsonrpc: "2.0", id: msg.id, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return msg?.id !== undefined ? fail(-32600, "Invalid Request") : null;
  const notification = msg.id === undefined || msg.id === null;
  switch (msg.method) {
    case "initialize":
      return reply({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "motion-studio", title: "MOTION Studio Local Engines", version: VERSION },
        instructions: "Servidor local Motion Core via stdio. Todos os caminhos são limitados ao workspace de inicialização. Renderizações usam modo offline. O Bridge valida, transforma e prepara payloads; operações no Doop precisam ser executadas pelo agente via Doop MCP oficial, após conferir os schemas disponíveis. Nenhuma operação externa é executada por este servidor.",
      });
    case "notifications/initialized":
      return null;
    case "notifications/cancelled": {
      const requestId = msg.params?.requestId;
      runtime.pending.get(requestId)?.abort(Object.assign(new Error("Cancelado pelo cliente MCP."), { code: "MOTION_CANCELLED" }));
      return null;
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const { name, arguments: args = {} } = msg.params ?? {};
      if (!TOOLS.some((entry) => entry.name === name)) return fail(-32602, `Unknown tool: ${name}`);
      try {
        const result = await invokeTool(name, args, runtime);
        const structured = result && typeof result === "object" && !Array.isArray(result) ? result : { value: result };
        return reply({ content: [{ type: "text", text: JSON.stringify(structured, null, 2) }], structuredContent: structured, isError: false });
      } catch (error) {
        const reason = runtime.signal?.aborted && runtime.signal.reason ? runtime.signal.reason : error;
        const structured = { status: "FAIL", error: errorData(reason) };
        return reply({ content: [{ type: "text", text: JSON.stringify(structured, null, 2) }], structuredContent: structured, isError: true });
      }
    }
    default:
      return notification ? null : fail(-32601, `Method not found: ${msg.method}`);
  }
}

function writeProtocol(message) {
  if (message) process.stdout.write(`${JSON.stringify(message)}\n`);
}

export async function runMcpServer(options = {}) {
  const workspaceRoot = await realpath(path.resolve(options.workspace ?? process.cwd()));
  const runtime = createMcpRuntime({
    workspaceRoot,
    maxConcurrency: options["max-concurrency"] ?? options.maxConcurrency ?? 2,
    maxExecutionMs: options["max-execution-ms"] ?? options.maxExecutionMs ?? 600_000,
  });
  const originalLog = console.log;
  // Third-party/core diagnostics must never corrupt the line-oriented protocol stream.
  console.log = (...values) => process.stderr.write(`${values.map(String).join(" ")}\n`);
  process.stderr.write(`motion mcp v${VERSION} pronto (stdio; workspace=${workspaceRoot}; concorrência=${runtime.maxConcurrency}; timeout=${runtime.maxExecutionMs}ms)\n`);
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const pending = new Set();
  const requestControllers = new Map();
  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      let msg;
      try { msg = JSON.parse(line); }
      catch {
        writeProtocol({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
        continue;
      }
      if (msg.method === "notifications/cancelled") {
        const id = msg.params?.requestId;
        requestControllers.get(id)?.abort(Object.assign(new Error("Cancelado pelo cliente MCP."), { code: "MOTION_CANCELLED" }));
        await handleMessage(msg, runtime);
        continue;
      }
      const controller = msg.id === undefined || msg.id === null ? null : new AbortController();
      if (controller) {
        if (requestControllers.has(msg.id)) {
          writeProtocol({ jsonrpc: "2.0", id: msg.id, error: { code: -32600, message: "Duplicate request id" } });
          continue;
        }
        requestControllers.set(msg.id, controller);
      }
      const context = controller ? Object.assign(Object.create(runtime), { signal: controller.signal, pending: runtime.pending, runtime }) : runtime;
      if (controller) runtime.pending.set(msg.id, controller);
      const timer = controller && msg.method === "tools/call"
        ? setTimeout(() => controller.abort(Object.assign(new Error(`Operação excedeu o limite de ${runtime.maxExecutionMs} ms.`), { code: "MOTION_TIMEOUT" })), runtime.maxExecutionMs)
        : null;
      const operation = handleMessage(msg, context).then(writeProtocol).catch((error) => {
        process.stderr.write(`motion mcp internal error: ${error.message}\n`);
        if (msg.id !== undefined && msg.id !== null) writeProtocol({ jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: "Internal error" } });
      }).finally(() => {
        if (controller) {
          if (timer) clearTimeout(timer);
          requestControllers.delete(msg.id);
          runtime.pending.delete(msg.id);
        }
        pending.delete(operation);
      });
      pending.add(operation);
    }
    await Promise.all(pending);
    while ([...runtime.jobs.values()].some((job) => job.status === "running")) await new Promise((resolve) => setTimeout(resolve, 100));
  } finally {
    console.log = originalLog;
  }
}
