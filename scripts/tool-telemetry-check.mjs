/**
 * Regression checks for tool telemetry JSONL emitter (no TestNeo API).
 * Run from package root after build: `npm test` (see package.json).
 */
import assert from "node:assert/strict";
import { configureToolTelemetry, recordBackendPath, recordToolDimensions, runWithToolTelemetry } from "../dist/toolTelemetry.js";

const writes = [];
const savedWrite = process.stderr.write.bind(process.stderr);

function captureWrite(chunk, encoding, cb) {
  const text = typeof chunk === "string" ? chunk : String(chunk);
  writes.push(text);
  if (typeof encoding === "function") encoding();
  if (typeof cb === "function") cb();
  return true;
}

try {
  process.stderr.write = captureWrite;

  configureToolTelemetry({ emitJsonl: true });
  await runWithToolTelemetry("check_ok", async () => {
    recordToolDimensions({ projectId: 47, tenantId: "user:1" });
    recordBackendPath("GET", "/api/web/v1/projects");
    return { content: [{ type: "text", text: "{\"ok\":true}" }] };
  });
  await assert.rejects(async () =>
    runWithToolTelemetry("check_error", async () => {
      recordBackendPath("POST", "/api/web/v1/playwright-sdk/execute");
      throw new Error("boom");
    })
  );
  configureToolTelemetry({ emitJsonl: false });
} finally {
  process.stderr.write = savedWrite;
}

const jsonLines = writes
  .map((x) => x.trim())
  .filter(Boolean)
  .filter((x) => x.startsWith("{") && x.endsWith("}"));

const events = jsonLines.map((line) => JSON.parse(line));
assert.ok(events.length >= 2);
const okEvent = events.find((e) => e.tool === "check_ok");
const errEvent = events.find((e) => e.tool === "check_error");
assert.ok(okEvent);
assert.ok(errEvent);
assert.equal(okEvent.log_type, "mcp_tool_telemetry");
assert.equal(okEvent.outcome, "ok");
assert.equal(errEvent.outcome, "error");
assert.ok(Array.isArray(okEvent.backend_paths) && okEvent.backend_paths.length >= 1);
assert.ok(Array.isArray(errEvent.backend_paths) && errEvent.backend_paths.length >= 1);
assert.ok(typeof okEvent.request_id === "string" && okEvent.request_id.length > 8);
assert.ok(typeof okEvent.duration_ms === "number");
assert.equal(okEvent.telemetry_schema_version, "mcp_telemetry.v1");
assert.equal(okEvent.project_id, 47);
assert.equal(okEvent.tenant_id, "user:1");

process.stdout.write("tool-telemetry-check: OK\n");
