import { z } from "zod";

const RouteProfileSchema = z.enum(["none", "saucedemo"]);
const PolicyModeSchema = z.enum(["strict", "warn"]);

const ExecutionModeSchema = z.enum(["local", "cloud"]);

const ConfigSchema = z.object({
  baseUrl: z.string().url(),
  /**
   * Browser-facing SPA origin for deep links (often Vite `http://localhost:5173` while `baseUrl` is API `http://localhost:8001`).
   * When `TESTNEO_WEB_APP_URL` is unset and `baseUrl` is `localhost`/`127.0.0.1` on port 8001, defaults to the same host on port 5173.
   */
  webAppBaseUrl: z.string().url(),
  /** Optional path segment before `/test-runner/...` (e.g. `/web` → `…/web/test-runner/execution/…`). */
  webAppPathPrefix: z.string(),
  apiKey: z.string().min(5),
  requestTimeoutMs: z.number().int().positive(),
  /** Multipart Swagger LLM pipelines (upload-and-generate) may exceed default timeouts. */
  swaggerTimeoutMs: z.number().int().positive(),
  allowWriteTools: z.boolean(),
  userAgent: z.string().min(3),
  routeHardeningEnabled: z.boolean(),
  routeProfile: RouteProfileSchema,
  routeMapCustom: z.record(z.string(), z.string()),
  /** When false (default), blocks generate/execute-family tools if project has no real http(s) base URL. */
  relaxProjectPreconditions: z.boolean(),
  /** Emit JSONL telemetry events to stderr for central log ingestion. */
  telemetryJsonl: z.boolean(),
  policyMode: PolicyModeSchema,
  /** Default `execution_mode` for multi-test / batch runs (`local` = self-hosted agent or on-prem runner, not TestNeo cloud browsers). */
  defaultExecutionMode: ExecutionModeSchema,
  /** Default `execution_platform` passed to multi-test execute (usually `local`). */
  defaultExecutionPlatform: z.string().min(1),
  /** When true, batch tools set `use_agent: true` and prefer routing work to the user’s TestNeo local agent. */
  preferLocalAgent: z.boolean(),
  /** When true with `preferLocalAgent`, batch-by-tags refuses to start if the local agent is not connected. */
  requireLocalAgentForBatch: z.boolean(),
  /**
   * When > 0, `testneo_run_batch_by_tags` polls `GET /agents/my-agent` until `agent_connected` or this budget elapses.
   * Reduces races where the user starts the agent seconds after triggering the batch from chat.
   */
  waitForAgentMs: z.number().int().min(0).max(300_000),
  /** If true, on hard agent failure (not registered / not connected after wait) MCP attempts to open `setup_url` in the default desktop browser once (best-effort). */
  openAgentSetupOnAgentFailure: z.boolean(),
});

export type ServerConfig = z.infer<typeof ConfigSchema>;

function parseRouteMapJson(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof k === "string" && typeof val === "string" && k.trim()) {
        out[k.trim()] = val;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function parseRouteProfile(value: string | undefined): z.infer<typeof RouteProfileSchema> {
  const n = (value || "").trim().toLowerCase();
  if (n === "saucedemo") return "saucedemo";
  return "none";
}

function parsePolicyMode(value: string | undefined): z.infer<typeof PolicyModeSchema> {
  const n = (value || "").trim().toLowerCase();
  if (n === "warn") return "warn";
  return "strict";
}

function parseExecutionMode(value: string | undefined): z.infer<typeof ExecutionModeSchema> {
  const n = (value || "").trim().toLowerCase();
  if (n === "cloud") return "cloud";
  return "local";
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function parseNonNegativeInt(value: string | undefined, defaultValue: number, max: number): number {
  if (!value?.trim()) return defaultValue;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return defaultValue;
  return Math.min(Math.floor(n), max);
}

function defaultWebAppBaseUrl(apiBaseNorm: string, explicitWebApp: string): string {
  const w = explicitWebApp.trim();
  if (w) return w.replace(/\/+$/, "");
  const isLocalWebApi =
    /:\/\/localhost:8001\/?$/i.test(apiBaseNorm) || /:\/\/127\.0\.0\.1:8001\/?$/i.test(apiBaseNorm);
  if (isLocalWebApi) {
    return apiBaseNorm.replace(/:8001(?=\/?$)/i, ":5173");
  }
  return apiBaseNorm;
}

function normalizeWebAppPathPrefix(raw: string | undefined): string {
  const t = (raw || "").trim();
  if (!t) return "";
  let p = t.startsWith("/") ? t : `/${t}`;
  p = p.replace(/\/+$/, "");
  return p === "/" ? "" : p;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const baseUrl = (env.TESTNEO_BASE_URL || "").trim();
  const apiKey = (env.TESTNEO_API_KEY || "").trim();
  const apiBaseNorm = (baseUrl || "http://localhost:8001").replace(/\/+$/, "");
  const webAppExplicit = (env.TESTNEO_WEB_APP_URL || "").trim();
  const webAppBaseUrl = defaultWebAppBaseUrl(apiBaseNorm, webAppExplicit);
  const webAppPathPrefix = normalizeWebAppPathPrefix(env.TESTNEO_WEB_APP_PATH_PREFIX);

  const cfg = {
    baseUrl: apiBaseNorm,
    webAppBaseUrl,
    webAppPathPrefix,
    apiKey,
    requestTimeoutMs: Number(env.TESTNEO_MCP_TIMEOUT_MS || 20000),
    swaggerTimeoutMs: Number(env.TESTNEO_MCP_SWAGGER_TIMEOUT_MS || 120000),
    allowWriteTools: parseBoolean(env.TESTNEO_MCP_ALLOW_WRITE, false),
    userAgent: (env.TESTNEO_MCP_USER_AGENT || "@testneo/mcp-server").trim(),
    routeHardeningEnabled: parseBoolean(env.TESTNEO_ROUTE_HARDENING, true),
    routeProfile: parseRouteProfile(env.TESTNEO_ROUTE_PROFILE),
    routeMapCustom: parseRouteMapJson(env.TESTNEO_ROUTE_MAP_JSON),
    relaxProjectPreconditions: parseBoolean(env.TESTNEO_MCP_RELAX_PROJECT_PRECONDITIONS, false),
    telemetryJsonl: parseBoolean(env.TESTNEO_MCP_TELEMETRY_JSONL, false),
    policyMode: parsePolicyMode(env.TESTNEO_MCP_POLICY_MODE),
    defaultExecutionMode: parseExecutionMode(env.TESTNEO_MCP_DEFAULT_EXECUTION_MODE),
    defaultExecutionPlatform: (env.TESTNEO_MCP_DEFAULT_EXECUTION_PLATFORM || "local").trim() || "local",
    preferLocalAgent: parseBoolean(env.TESTNEO_MCP_PREFER_LOCAL_AGENT, true),
    requireLocalAgentForBatch: parseBoolean(env.TESTNEO_MCP_REQUIRE_LOCAL_AGENT_FOR_BATCH, true),
    waitForAgentMs: parseNonNegativeInt(env.TESTNEO_MCP_WAIT_FOR_AGENT_MS, 0, 300_000),
    openAgentSetupOnAgentFailure: parseBoolean(env.TESTNEO_MCP_OPEN_AGENT_SETUP_ON_AGENT_FAILURE, false),
  };

  const parsed = ConfigSchema.safeParse(cfg);
  if (!parsed.success) {
    throw new Error(
      `Invalid MCP config: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
    );
  }
  if (!parsed.data.apiKey) {
    throw new Error("Missing TESTNEO_API_KEY for MCP server.");
  }
  return parsed.data;
}
