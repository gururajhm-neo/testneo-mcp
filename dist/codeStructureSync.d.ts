import { z } from "zod";
import type { HttpClient } from "./httpClient.js";
import type { ToolTextResult } from "./types.js";
export declare const CODE_STRUCTURE_SYNC_CONTRACT: "code_structure_sync.v1";
/** Keep MCP uploads conservative; API allows up to 200MB. */
export declare const DEFAULT_MAX_ZIP_MB = 50;
export declare const CodeStructureSyncInputSchema: z.ZodObject<{
    project_id: z.ZodNumber;
    workspace_root: z.ZodOptional<z.ZodString>;
    include_paths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    zip_base64: z.ZodOptional<z.ZodString>;
    zip_filename: z.ZodOptional<z.ZodString>;
    auto_detect: z.ZodDefault<z.ZodBoolean>;
    folders: z.ZodOptional<z.ZodString>;
    max_size_mb: z.ZodDefault<z.ZodNumber>;
    wait_timeout_seconds: z.ZodDefault<z.ZodNumber>;
    confirm: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    project_id: number;
    auto_detect: boolean;
    max_size_mb: number;
    wait_timeout_seconds: number;
    confirm: boolean;
    workspace_root?: string | undefined;
    include_paths?: string[] | undefined;
    zip_base64?: string | undefined;
    zip_filename?: string | undefined;
    folders?: string | undefined;
}, {
    project_id: number;
    workspace_root?: string | undefined;
    include_paths?: string[] | undefined;
    zip_base64?: string | undefined;
    zip_filename?: string | undefined;
    auto_detect?: boolean | undefined;
    folders?: string | undefined;
    max_size_mb?: number | undefined;
    wait_timeout_seconds?: number | undefined;
    confirm?: boolean | undefined;
}>;
export type CodeStructureSyncInput = z.infer<typeof CodeStructureSyncInputSchema>;
export declare function wrapCodeStructureSync(payload: Record<string, unknown>): Record<string, unknown>;
export declare function syncCodeStructure(params: CodeStructureSyncInput, deps: {
    client: HttpClient;
    allowWriteTools: boolean;
    asText: (value: unknown) => string;
    result: (text: string) => ToolTextResult;
}): Promise<ToolTextResult>;
/** Preflight: returns false when analyze would fail due to missing structure. */
export declare function projectHasCodeStructure(client: HttpClient, projectId: number): Promise<boolean>;
