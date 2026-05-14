import { z } from "zod";
declare const ConfigSchema: z.ZodObject<{
    baseUrl: z.ZodString;
    /**
     * Browser-facing SPA origin for deep links (often Vite `http://localhost:5173` while `baseUrl` is API `http://localhost:8001`).
     * When `TESTNEO_WEB_APP_URL` is unset and `baseUrl` is `localhost`/`127.0.0.1` on port 8001, defaults to the same host on port 5173.
     */
    webAppBaseUrl: z.ZodString;
    /** Optional path segment before `/test-runner/...` (e.g. `/web` → `…/web/test-runner/execution/…`). */
    webAppPathPrefix: z.ZodString;
    apiKey: z.ZodString;
    requestTimeoutMs: z.ZodNumber;
    /** Multipart Swagger LLM pipelines (upload-and-generate) may exceed default timeouts. */
    swaggerTimeoutMs: z.ZodNumber;
    allowWriteTools: z.ZodBoolean;
    userAgent: z.ZodString;
    routeHardeningEnabled: z.ZodBoolean;
    routeProfile: z.ZodEnum<["none", "saucedemo"]>;
    routeMapCustom: z.ZodRecord<z.ZodString, z.ZodString>;
    /** When false (default), blocks generate/execute-family tools if project has no real http(s) base URL. */
    relaxProjectPreconditions: z.ZodBoolean;
    /** Emit JSONL telemetry events to stderr for central log ingestion. */
    telemetryJsonl: z.ZodBoolean;
    policyMode: z.ZodEnum<["strict", "warn"]>;
    /** Default `execution_mode` for multi-test / batch runs (`local` = self-hosted agent or on-prem runner, not TestNeo cloud browsers). */
    defaultExecutionMode: z.ZodEnum<["local", "cloud"]>;
    /** Default `execution_platform` passed to multi-test execute (usually `local`). */
    defaultExecutionPlatform: z.ZodString;
    /** When true, batch tools set `use_agent: true` and prefer routing work to the user’s TestNeo local agent. */
    preferLocalAgent: z.ZodBoolean;
    /** When true with `preferLocalAgent`, batch-by-tags refuses to start if the local agent is not connected. */
    requireLocalAgentForBatch: z.ZodBoolean;
    /**
     * When > 0, `testneo_run_batch_by_tags` polls `GET /agents/my-agent` until `agent_connected` or this budget elapses.
     * Reduces races where the user starts the agent seconds after triggering the batch from chat.
     */
    waitForAgentMs: z.ZodNumber;
    /** If true, on hard agent failure (not registered / not connected after wait) MCP attempts to open `setup_url` in the default desktop browser once (best-effort). */
    openAgentSetupOnAgentFailure: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    baseUrl: string;
    webAppBaseUrl: string;
    webAppPathPrefix: string;
    apiKey: string;
    requestTimeoutMs: number;
    swaggerTimeoutMs: number;
    allowWriteTools: boolean;
    userAgent: string;
    routeHardeningEnabled: boolean;
    routeProfile: "none" | "saucedemo";
    routeMapCustom: Record<string, string>;
    relaxProjectPreconditions: boolean;
    telemetryJsonl: boolean;
    policyMode: "strict" | "warn";
    defaultExecutionMode: "local" | "cloud";
    defaultExecutionPlatform: string;
    preferLocalAgent: boolean;
    requireLocalAgentForBatch: boolean;
    waitForAgentMs: number;
    openAgentSetupOnAgentFailure: boolean;
}, {
    baseUrl: string;
    webAppBaseUrl: string;
    webAppPathPrefix: string;
    apiKey: string;
    requestTimeoutMs: number;
    swaggerTimeoutMs: number;
    allowWriteTools: boolean;
    userAgent: string;
    routeHardeningEnabled: boolean;
    routeProfile: "none" | "saucedemo";
    routeMapCustom: Record<string, string>;
    relaxProjectPreconditions: boolean;
    telemetryJsonl: boolean;
    policyMode: "strict" | "warn";
    defaultExecutionMode: "local" | "cloud";
    defaultExecutionPlatform: string;
    preferLocalAgent: boolean;
    requireLocalAgentForBatch: boolean;
    waitForAgentMs: number;
    openAgentSetupOnAgentFailure: boolean;
}>;
export type ServerConfig = z.infer<typeof ConfigSchema>;
export declare function loadConfig(env?: NodeJS.ProcessEnv): ServerConfig;
export {};
