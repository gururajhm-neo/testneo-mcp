/**
 * Human-readable summaries for TestNeo HTTP errors in MCP tool output (Cursor chat).
 * FastAPI often returns { "detail": { ... } }; some routes return top-level trial / limit fields.
 */
/**
 * Build a short markdown-friendly summary for 403/429 responses so MCP users see
 * upgrade / limit context without digging through raw JSON.
 */
export declare function summarizeTestNeoHttpError(status: number, bodyText: string): string | null;
export type AgentFacingHttpError = {
    contract_version: "testneo_mcp_http_error.v1";
    http_status: number;
    path: string;
    category: "unauthorized" | "forbidden" | "not_found" | "rate_limit" | "conflict" | "validation" | "server" | "unknown";
    message: string;
    detail_excerpt: string;
    retryable: boolean;
    next_steps: string[];
};
/**
 * Structured JSON error for MCP tools so agents can branch without scraping stack traces.
 */
export declare function buildAgentFacingHttpEnvelope(status: number, path: string, bodyText: string, opts?: {
    agentSetupUrl?: string;
}): AgentFacingHttpError;
