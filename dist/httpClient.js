"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClient = exports.TestNeoApiError = void 0;
const toolTelemetry_js_1 = require("./toolTelemetry.js");
class TestNeoApiError extends Error {
    status;
    path;
    body;
    constructor(status, path, body) {
        super(`TestNeo API ${status} on ${path}: ${body.slice(0, 400)}`);
        this.status = status;
        this.path = path;
        this.body = body;
    }
}
exports.TestNeoApiError = TestNeoApiError;
class HttpClient {
    config;
    normalizedBaseUrl;
    constructor(config) {
        this.config = config;
        this.normalizedBaseUrl = this.config.baseUrl.replace(/\/+$/, "");
    }
    /** Same as `TESTNEO_MCP_SWAGGER_TIMEOUT_MS` — use for JSON endpoints that run impact / LLM work. */
    get longRequestTimeoutMs() {
        return this.config.swaggerTimeoutMs;
    }
    resolveTimeout(override) {
        return override ?? this.config.requestTimeoutMs;
    }
    async request(path, options = {}) {
        const query = options.query
            ? Object.entries(options.query)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
                .join("&")
            : "";
        const url = `${this.normalizedBaseUrl}${path}${query ? `?${query}` : ""}`;
        const controller = new AbortController();
        const timeoutMs = this.resolveTimeout(options.timeoutMs);
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            (0, toolTelemetry_js_1.recordBackendPath)(options.method ?? "GET", path);
            const res = await fetch(url, {
                method: options.method ?? "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.config.apiKey}`,
                    "User-Agent": this.config.userAgent,
                    "X-TestNeo-MCP": "true",
                },
                body: options.body === undefined ? undefined : JSON.stringify(options.body),
                signal: controller.signal,
            });
            const text = await res.text();
            if (!res.ok) {
                throw new TestNeoApiError(res.status, path, text);
            }
            return (text ? JSON.parse(text) : {});
        }
        finally {
            clearTimeout(timeout);
        }
    }
    /**
     * multipart/form-data (multipart boundaries set by fetch; do not set Content-Type).
     */
    async requestMultipart(path, form, timeoutMsOverride) {
        const url = `${this.normalizedBaseUrl}${path}`;
        const controller = new AbortController();
        const timeoutMs = timeoutMsOverride !== undefined ? timeoutMsOverride : this.config.swaggerTimeoutMs ?? this.config.requestTimeoutMs;
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            (0, toolTelemetry_js_1.recordBackendPath)("POST", path);
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.config.apiKey}`,
                    "User-Agent": this.config.userAgent,
                    "X-TestNeo-MCP": "true",
                },
                body: form,
                signal: controller.signal,
            });
            const text = await res.text();
            if (!res.ok) {
                throw new TestNeoApiError(res.status, path, text);
            }
            return (text ? JSON.parse(text) : {});
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
exports.HttpClient = HttpClient;
