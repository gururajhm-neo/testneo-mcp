"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureToolTelemetry = configureToolTelemetry;
exports.recordToolDimensions = recordToolDimensions;
exports.recordBackendPath = recordBackendPath;
exports.runWithToolTelemetry = runWithToolTelemetry;
const node_async_hooks_1 = require("node:async_hooks");
const node_crypto_1 = require("node:crypto");
const telemetryAls = new node_async_hooks_1.AsyncLocalStorage();
const MAX_BACKEND_PATHS = 80;
let emitTelemetryJsonl = false;
function configureToolTelemetry(opts) {
    emitTelemetryJsonl = opts.emitJsonl;
}
function recordToolDimensions(input) {
    const s = telemetryAls.getStore();
    if (!s)
        return;
    if (input.projectId !== undefined) {
        s.projectId = typeof input.projectId === "number" && Number.isFinite(input.projectId) ? input.projectId : null;
    }
    if (input.tenantId !== undefined) {
        s.tenantId = typeof input.tenantId === "string" && input.tenantId.trim() ? input.tenantId.trim() : null;
    }
}
/** Record backend path from HttpClient.request (no-op outside a tool invocation). */
function recordBackendPath(method, path) {
    const s = telemetryAls.getStore();
    if (!s || s.backendPaths.length >= MAX_BACKEND_PATHS)
        return;
    s.backendPaths.push(`${method} ${path}`);
}
async function runWithToolTelemetry(toolName, fn) {
    const startedAtMs = Date.now();
    const store = {
        toolName,
        requestId: (0, node_crypto_1.randomUUID)(),
        startedAtMs,
        backendPaths: [],
        projectId: null,
        tenantId: null,
    };
    return telemetryAls.run(store, async () => {
        try {
            const out = await fn();
            const augmented = augmentWithTelemetry(out);
            emitTelemetryEvent(toEvent(store, "ok"));
            return augmented;
        }
        catch (error) {
            emitTelemetryEvent(toEvent(store, "error", error instanceof Error ? error.message : String(error)));
            throw error;
        }
    });
}
function toEvent(store, outcome, errorMessage) {
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
function emitTelemetryEvent(event) {
    if (!emitTelemetryJsonl)
        return;
    process.stderr.write(`${JSON.stringify(event)}\n`);
}
function augmentWithTelemetry(out) {
    const chunk = out.content[0];
    if (!chunk || chunk.type !== "text")
        return out;
    const s = telemetryAls.getStore();
    if (!s)
        return out;
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
            const raw = JSON.parse(text);
            if (typeof raw === "object" && raw !== null) {
                const { _telemetry: _prior, ...rest } = raw;
                const merged = { _telemetry, ...rest };
                return { content: [{ type: "text", text: JSON.stringify(merged, null, 2) }] };
            }
        }
        catch {
            /* fall through */
        }
    }
    return {
        content: [{ type: "text", text: `${chunk.text}\n\n---\n_mcp.telemetry (JSON):\n${JSON.stringify(_telemetry, null, 2)}` }],
    };
}
