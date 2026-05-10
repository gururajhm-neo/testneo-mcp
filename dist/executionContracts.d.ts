import type { ExecutionListItem } from "./types.js";
export type CanonicalExecutionStatus = "queued" | "running" | "passed" | "failed" | "cancelled" | "unknown";
export declare function normalizeRawStatus(value: unknown): string;
export declare function toCanonicalExecutionStatus(value: unknown): CanonicalExecutionStatus;
export declare function isTerminalCanonicalStatus(value: CanonicalExecutionStatus): boolean;
export declare function normalizeExecutionItem(item: ExecutionListItem): ExecutionListItem & {
    canonical_status: CanonicalExecutionStatus;
    raw_status: string;
};
export declare function normalizeExecutionSummary(summary: Record<string, unknown>): Record<string, unknown>;
