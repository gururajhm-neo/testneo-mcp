/**
 * Fail-fast checks before generate/execute surfaces: project must have a real HTTP(S) base URL
 * so {{base_url}} expansions and runners do not silently hit placeholder targets.
 */
import type { HttpClient } from "./httpClient.js";
export type ProjectPreconditionCode = "missing_executable_base_url" | "placeholder_base_url" | "invalid_base_url" | "project_fetch_failed";
export type ProjectExecutableBaseOk = {
    ok: true;
    project_id: number;
    resolved_base_url: string;
    source: "project_website_url" | "environment_base_url" | "environment_variable_base_url";
};
export type ProjectExecutableBaseFail = {
    ok: false;
    project_id: number;
    code: ProjectPreconditionCode;
    message: string;
    remediation: string[];
    /** Best-effort diagnostic (API error body, etc.). */
    detail?: string;
};
export type ProjectExecutableBaseResult = ProjectExecutableBaseOk | ProjectExecutableBaseFail;
export type ClassifiedHttpBase = {
    resolved_base_url: string;
} | null;
/**
 * Classify a single candidate string. Exported for regression checks (see scripts/project-preconditions-check.mjs).
 */
export declare function classifyExecutableBaseUrl(rawInput: unknown): ClassifiedHttpBase;
/**
 * Load project + environments (when needed) and resolve a single executable base URL.
 */
export declare function evaluateProjectExecutableBase(client: HttpClient, projectId: number): Promise<ProjectExecutableBaseResult>;
export declare function formatPreconditionBlock(result: ProjectExecutableBaseFail): Record<string, unknown>;
