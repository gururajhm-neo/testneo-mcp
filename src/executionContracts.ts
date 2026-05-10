import type { ExecutionListItem } from "./types.js";

export type CanonicalExecutionStatus =
  | "queued"
  | "running"
  | "passed"
  | "failed"
  | "cancelled"
  | "unknown";

const PASS_SET = new Set(["passed", "pass", "success", "successful", "completed", "complete"]);
const FAIL_SET = new Set(["failed", "fail", "error", "errored", "timed_out", "timeout"]);
const RUN_SET = new Set(["running", "in_progress", "processing", "executing", "started"]);
const QUEUED_SET = new Set(["queued", "pending", "created", "scheduled", "waiting"]);
const CANCEL_SET = new Set(["cancelled", "canceled", "aborted", "terminated"]);

export function normalizeRawStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function toCanonicalExecutionStatus(value: unknown): CanonicalExecutionStatus {
  const s = normalizeRawStatus(value);
  if (!s) return "unknown";
  if (PASS_SET.has(s)) return "passed";
  if (FAIL_SET.has(s)) return "failed";
  if (RUN_SET.has(s)) return "running";
  if (QUEUED_SET.has(s)) return "queued";
  if (CANCEL_SET.has(s)) return "cancelled";
  return "unknown";
}

export function isTerminalCanonicalStatus(value: CanonicalExecutionStatus): boolean {
  return value === "passed" || value === "failed" || value === "cancelled";
}

export function normalizeExecutionItem(
  item: ExecutionListItem
): ExecutionListItem & { canonical_status: CanonicalExecutionStatus; raw_status: string } {
  const raw = normalizeRawStatus(item.status);
  return {
    ...item,
    canonical_status: toCanonicalExecutionStatus(raw),
    raw_status: raw || "unknown",
    status: item.status ?? "unknown",
  };
}

export function normalizeExecutionSummary(summary: Record<string, unknown>): Record<string, unknown> {
  const raw = normalizeRawStatus(summary.status);
  return {
    ...summary,
    status: summary.status ?? "unknown",
    canonical_status: toCanonicalExecutionStatus(raw),
    raw_status: raw || "unknown",
  };
}

