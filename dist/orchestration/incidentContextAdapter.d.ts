/**
 * IncidentContextAdapter — HTTP bridge to Python IncidentContextService.
 *
 * Called by PrValidationOrchestrator after findings are normalized to enrich
 * validate_pr with Release Memory (prior validations + patterns + resolutions).
 */
import type { AffectedTestCandidate, IncidentContext, ValidatePrRequest, VerificationFinding, WorkflowContext } from "./contracts.js";
export interface IncidentContextLookupClient {
    request<T = unknown>(path: string, opts?: {
        method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        body?: unknown;
        query?: Record<string, string | number | boolean>;
        timeoutMs?: number;
    }): Promise<T>;
}
export interface IncidentContextAdapter {
    lookup(input: {
        request: ValidatePrRequest;
        context: WorkflowContext;
        findings: VerificationFinding[];
        affectedTests: AffectedTestCandidate[];
    }): Promise<IncidentContext | undefined>;
}
export declare function createHttpIncidentContextAdapter(client: IncidentContextLookupClient): IncidentContextAdapter;
export declare function incidentContextFromMetadata(metadata: Record<string, unknown>): IncidentContext | undefined;
