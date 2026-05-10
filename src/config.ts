import { z } from "zod";

const RouteProfileSchema = z.enum(["none", "saucedemo"]);
const PolicyModeSchema = z.enum(["strict", "warn"]);

const ConfigSchema = z.object({
  baseUrl: z.string().url(),
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

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const baseUrl = (env.TESTNEO_BASE_URL || "").trim();
  const apiKey = (env.TESTNEO_API_KEY || "").trim();

  const cfg = {
    baseUrl: baseUrl || "http://localhost:8001",
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
