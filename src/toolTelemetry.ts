import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { ToolTextResult } from "./types.js";

export type TelemetryState = {
  toolName: string;
  requestId: string;
  startedAtMs: number;
  backendPaths: string[];
  projectId: number | null;
  tenantId: string | null;
};

type TelemetryOutcome = "ok" | "error";

type TelemetryEvent = {
  telemetry_schema_version: "mcp_telemetry.v1";
  log_type: "mcp_tool_telemetry";
  ts: string;
  request_id: string;
  tool: string;
  duration_ms: number;
  backend_paths: string[];
  project_id: number | null;
  tenant_id: string | null;
  outcome: TelemetryOutcome;
  error_message?: string;
};

const telemetryAls = new AsyncLocalStorage<TelemetryState>();

const MAX_BACKEND_PATHS = 80;
let emitTelemetryJsonl = false;

export function configureToolTelemetry(opts: { emitJsonl: boolean }): void {
  emitTelemetryJsonl = opts.emitJsonl;
}

export function recordToolDimensions(input: { projectId?: number | null; tenantId?: string | null }): void {
  const s = telemetryAls.getStore();
  if (!s) return;
  if (input.projectId !== undefined) {
    s.projectId = typeof input.projectId === "number" && Number.isFinite(input.projectId) ? input.projectId : null;
  }
  if (input.tenantId !== undefined) {
    s.tenantId = typeof input.tenantId === "string" && input.tenantId.trim() ? input.tenantId.trim() : null;
  }
}

/** Record backend path from HttpClient.request (no-op outside a tool invocation). */
export function recordBackendPath(method: string, path: string): void {
  const s = telemetryAls.getStore();
  if (!s || s.backendPaths.length >= MAX_BACKEND_PATHS) return;
  s.backendPaths.push(`${method} ${path}`);
}

export async function runWithToolTelemetry<T extends ToolTextResult>(
  toolName: string,
  fn: () => Promise<T>
): Promise<T> {
  const startedAtMs = Date.now();
  const store: TelemetryState = {
    toolName,
    requestId: randomUUID(),
    startedAtMs,
    backendPaths: [],
    projectId: null,
    tenantId: null,
  };
  return telemetryAls.run(store, async () => {
    try {
      const out = await fn();
      const augmented = augmentWithTelemetry(out) as T;
      emitTelemetryEvent(toEvent(store, "ok"));
      return augmented;
    } catch (error) {
      emitTelemetryEvent(
        toEvent(store, "error", error instanceof Error ? error.message : String(error))
      );
      throw error;
    }
  });
}

function toEvent(store: TelemetryState, outcome: TelemetryOutcome, errorMessage?: string): TelemetryEvent {
  return {
    telemetry_schema_version: "mcp_telemetry.v1",
    log_type: "mcp_tool_telemetry",
    ts: new Date().toISOString(),
    request_id: store.requestId,
    tool: store.toolName,
    duration_ms: Date.now() - store.startedAtMs,
    backend_paths: [...store.backendPaths],
    project_id: store.projectId,
    tenant_id: store.tenantId,
    outcome,
    ...(errorMessage ? { error_message: errorMessage.slice(0, 500) } : {}),
  };
}

function emitTelemetryEvent(event: TelemetryEvent): void {
  if (!emitTelemetryJsonl) return;
  process.stderr.write(`${JSON.stringify(event)}\n`);
}

function augmentWithTelemetry(out: ToolTextResult): ToolTextResult {
  const chunk = out.content[0];
  if (!chunk || chunk.type !== "text") return out;
  const s = telemetryAls.getStore();
  if (!s) return out;
  const duration_ms = Date.now() - s.startedAtMs;
  const _telemetry = {
    telemetry_schema_version: "mcp_telemetry.v1",
    request_id: s.requestId,
    tool: s.toolName,
    duration_ms,
    backend_paths: [...s.backendPaths],
    project_id: s.projectId,
    tenant_id: s.tenantId,
  };
  const text = chunk.text.trim();
  if (text.startsWith("{") && text.endsWith("}")) {
    try {
      const raw = JSON.parse(text) as Record<string, unknown>;
      if (typeof raw === "object" && raw !== null) {
        const { _telemetry: _prior, ...rest } = raw;
        const merged = { _telemetry, ...rest };
        return { content: [{ type: "text", text: JSON.stringify(merged, null, 2) }] };
      }
    } catch {
      /* fall through */
    }
  }
  return {
    content: [{ type: "text", text: `${chunk.text}\n\n---\n_mcp.telemetry (JSON):\n${JSON.stringify(_telemetry, null, 2)}` }],
  };
}
