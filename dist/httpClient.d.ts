import { ServerConfig } from "./config.js";
type RequestOptions = {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    /** Override default `requestTimeoutMs` / swagger timeouts for long operations. */
    timeoutMs?: number;
};
export declare class TestNeoApiError extends Error {
    readonly status: number;
    readonly path: string;
    readonly body: string;
    constructor(status: number, path: string, body: string);
}
export declare class HttpClient {
    private readonly config;
    private readonly normalizedBaseUrl;
    private readonly normalizedWebAppBaseUrl;
    constructor(config: ServerConfig);
    /** API origin (e.g. https://app.testneo.ai) — same host as `/web/agent` when app and API are co-deployed. */
    getBaseUrl(): string;
    /** SPA origin for dashboard deep links (may be Vite :5173 while API is :8001). */
    getWebAppBaseUrl(): string;
    /** Optional prefix before `/test-runner/...` (e.g. `/web`). */
    getWebAppPathPrefix(): string;
    /** Same as `TESTNEO_MCP_SWAGGER_TIMEOUT_MS` — use for JSON endpoints that run impact / LLM work. */
    get longRequestTimeoutMs(): number;
    private resolveTimeout;
    request<T>(path: string, options?: RequestOptions): Promise<T>;
    /**
     * multipart/form-data (multipart boundaries set by fetch; do not set Content-Type).
     */
    requestMultipart<T>(path: string, form: FormData, timeoutMsOverride?: number): Promise<T>;
}
export {};
