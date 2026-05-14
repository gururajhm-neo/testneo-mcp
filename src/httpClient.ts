import { ServerConfig } from "./config.js";
import { recordBackendPath } from "./toolTelemetry.js";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Override default `requestTimeoutMs` / swagger timeouts for long operations. */
  timeoutMs?: number;
};

export class TestNeoApiError extends Error {
  public readonly status: number;
  public readonly path: string;
  public readonly body: string;

  constructor(status: number, path: string, body: string) {
    super(`TestNeo API ${status} on ${path}: ${body.slice(0, 400)}`);
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

export class HttpClient {
  private readonly normalizedBaseUrl: string;
  private readonly normalizedWebAppBaseUrl: string;

  constructor(private readonly config: ServerConfig) {
    this.normalizedBaseUrl = this.config.baseUrl.replace(/\/+$/, "");
    this.normalizedWebAppBaseUrl = this.config.webAppBaseUrl.replace(/\/+$/, "");
  }

  /** API origin (e.g. https://app.testneo.ai) — same host as `/web/agent` when app and API are co-deployed. */
  getBaseUrl(): string {
    return this.normalizedBaseUrl;
  }

  /** SPA origin for dashboard deep links (may be Vite :5173 while API is :8001). */
  getWebAppBaseUrl(): string {
    return this.normalizedWebAppBaseUrl;
  }

  /** Optional prefix before `/test-runner/...` (e.g. `/web`). */
  getWebAppPathPrefix(): string {
    return this.config.webAppPathPrefix;
  }

  /** Same as `TESTNEO_MCP_SWAGGER_TIMEOUT_MS` — use for JSON endpoints that run impact / LLM work. */
  get longRequestTimeoutMs(): number {
    return this.config.swaggerTimeoutMs;
  }

  private resolveTimeout(override?: number): number {
    return override ?? this.config.requestTimeoutMs;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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
      recordBackendPath(options.method ?? "GET", path);
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
      return (text ? JSON.parse(text) : {}) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * multipart/form-data (multipart boundaries set by fetch; do not set Content-Type).
   */
  async requestMultipart<T>(path: string, form: FormData, timeoutMsOverride?: number): Promise<T> {
    const url = `${this.normalizedBaseUrl}${path}`;
    const controller = new AbortController();
    const timeoutMs =
      timeoutMsOverride !== undefined ? timeoutMsOverride : this.config.swaggerTimeoutMs ?? this.config.requestTimeoutMs;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      recordBackendPath("POST", path);
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
      return (text ? JSON.parse(text) : {}) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
