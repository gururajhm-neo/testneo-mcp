import assert from "node:assert/strict";
import {
  isTerminalCanonicalStatus,
  normalizeExecutionItem,
  normalizeExecutionSummary,
  toCanonicalExecutionStatus,
} from "../dist/executionContracts.js";

assert.equal(toCanonicalExecutionStatus("completed"), "passed");
assert.equal(toCanonicalExecutionStatus("success"), "passed");
assert.equal(toCanonicalExecutionStatus("error"), "failed");
assert.equal(toCanonicalExecutionStatus("queued"), "queued");
assert.equal(toCanonicalExecutionStatus("in_progress"), "running");
assert.equal(toCanonicalExecutionStatus("canceled"), "cancelled");
assert.equal(toCanonicalExecutionStatus("mystery"), "unknown");

assert.equal(isTerminalCanonicalStatus("passed"), true);
assert.equal(isTerminalCanonicalStatus("failed"), true);
assert.equal(isTerminalCanonicalStatus("cancelled"), true);
assert.equal(isTerminalCanonicalStatus("running"), false);

const item = normalizeExecutionItem({ execution_id: "abc123", status: "completed" });
assert.equal(item.canonical_status, "passed");
assert.equal(item.raw_status, "completed");

const summary = normalizeExecutionSummary({ status: "in_progress", foo: 1 });
assert.equal(summary.canonical_status, "running");
assert.equal(summary.raw_status, "in_progress");
assert.equal(summary.foo, 1);

process.stdout.write("execution-contracts-check: OK\n");
