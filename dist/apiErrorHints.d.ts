/**
 * Human-readable summaries for TestNeo HTTP errors in MCP tool output (Cursor chat).
 * FastAPI often returns { "detail": { ... } }; some routes return top-level trial / limit fields.
 */
/**
 * Build a short markdown-friendly summary for 403/429 responses so MCP users see
 * upgrade / limit context without digging through raw JSON.
 */
export declare function summarizeTestNeoHttpError(status: number, bodyText: string): string | null;
