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
    constructor(config: ServerConfig);
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
