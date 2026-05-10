"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRawStatus = normalizeRawStatus;
exports.toCanonicalExecutionStatus = toCanonicalExecutionStatus;
exports.isTerminalCanonicalStatus = isTerminalCanonicalStatus;
exports.normalizeExecutionItem = normalizeExecutionItem;
exports.normalizeExecutionSummary = normalizeExecutionSummary;
const PASS_SET = new Set(["passed", "pass", "success", "successful", "completed", "complete"]);
const FAIL_SET = new Set(["failed", "fail", "error", "errored", "timed_out", "timeout"]);
const RUN_SET = new Set(["running", "in_progress", "processing", "executing", "started"]);
const QUEUED_SET = new Set(["queued", "pending", "created", "scheduled", "waiting"]);
const CANCEL_SET = new Set(["cancelled", "canceled", "aborted", "terminated"]);
function normalizeRawStatus(value) {
    return String(value ?? "").trim().toLowerCase();
}
function toCanonicalExecutionStatus(value) {
    const s = normalizeRawStatus(value);
    if (!s)
        return "unknown";
    if (PASS_SET.has(s))
        return "passed";
    if (FAIL_SET.has(s))
        return "failed";
    if (RUN_SET.has(s))
        return "running";
    if (QUEUED_SET.has(s))
        return "queued";
    if (CANCEL_SET.has(s))
        return "cancelled";
    return "unknown";
}
function isTerminalCanonicalStatus(value) {
    return value === "passed" || value === "failed" || value === "cancelled";
}
function normalizeExecutionItem(item) {
    const raw = normalizeRawStatus(item.status);
    return {
        ...item,
        canonical_status: toCanonicalExecutionStatus(raw),
        raw_status: raw || "unknown",
        status: item.status ?? "unknown",
    };
}
function normalizeExecutionSummary(summary) {
    const raw = normalizeRawStatus(summary.status);
    return {
        ...summary,
        status: summary.status ?? "unknown",
        canonical_status: toCanonicalExecutionStatus(raw),
        raw_status: raw || "unknown",
    };
}
