import { z } from "zod";
declare const ConfigSchema: z.ZodObject<{
    baseUrl: z.ZodString;
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
}, "strip", z.ZodTypeAny, {
    baseUrl: string;
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
}, {
    baseUrl: string;
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
}>;
export type ServerConfig = z.infer<typeof ConfigSchema>;
export declare function loadConfig(env?: NodeJS.ProcessEnv): ServerConfig;
export {};
