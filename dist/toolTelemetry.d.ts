import type { ToolTextResult } from "./types.js";
export type TelemetryState = {
    toolName: string;
    requestId: string;
    startedAtMs: number;
    backendPaths: string[];
    projectId: number | null;
    tenantId: string | null;
};
export declare function configureToolTelemetry(opts: {
    emitJsonl: boolean;
}): void;
export declare function recordToolDimensions(input: {
    projectId?: number | null;
    tenantId?: string | null;
}): void;
/** Record backend path from HttpClient.request (no-op outside a tool invocation). */
export declare function recordBackendPath(method: string, path: string): void;
export declare function runWithToolTelemetry<T extends ToolTextResult>(toolName: string, fn: () => Promise<T>): Promise<T>;
