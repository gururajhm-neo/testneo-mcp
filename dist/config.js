"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const zod_1 = require("zod");
const RouteProfileSchema = zod_1.z.enum(["none", "saucedemo"]);
const PolicyModeSchema = zod_1.z.enum(["strict", "warn"]);
const ConfigSchema = zod_1.z.object({
    baseUrl: zod_1.z.string().url(),
    apiKey: zod_1.z.string().min(5),
    requestTimeoutMs: zod_1.z.number().int().positive(),
    /** Multipart Swagger LLM pipelines (upload-and-generate) may exceed default timeouts. */
    swaggerTimeoutMs: zod_1.z.number().int().positive(),
    allowWriteTools: zod_1.z.boolean(),
    userAgent: zod_1.z.string().min(3),
    routeHardeningEnabled: zod_1.z.boolean(),
    routeProfile: RouteProfileSchema,
    routeMapCustom: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
    /** When false (default), blocks generate/execute-family tools if project has no real http(s) base URL. */
    relaxProjectPreconditions: zod_1.z.boolean(),
    /** Emit JSONL telemetry events to stderr for central log ingestion. */
    telemetryJsonl: zod_1.z.boolean(),
    policyMode: PolicyModeSchema,
});
function parseRouteMapJson(raw) {
    if (!raw?.trim())
        return {};
    try {
        const v = JSON.parse(raw);
        if (!v || typeof v !== "object" || Array.isArray(v))
            return {};
        const out = {};
        for (const [k, val] of Object.entries(v)) {
            if (typeof k === "string" && typeof val === "string" && k.trim()) {
                out[k.trim()] = val;
            }
        }
        return out;
    }
    catch {
        return {};
    }
}
function parseRouteProfile(value) {
    const n = (value || "").trim().toLowerCase();
    if (n === "saucedemo")
        return "saucedemo";
    return "none";
}
function parsePolicyMode(value) {
    const n = (value || "").trim().toLowerCase();
    if (n === "warn")
        return "warn";
    return "strict";
}
function parseBoolean(value, defaultValue) {
    if (!value)
        return defaultValue;
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized))
        return true;
    if (["0", "false", "no", "off"].includes(normalized))
        return false;
    return defaultValue;
}
function loadConfig(env = process.env) {
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
        throw new Error(`Invalid MCP config: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }
    if (!parsed.data.apiKey) {
        throw new Error("Missing TESTNEO_API_KEY for MCP server.");
    }
    return parsed.data;
}
