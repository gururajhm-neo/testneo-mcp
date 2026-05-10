import type { HttpClient } from "./httpClient.js";
export type PolicyMode = "strict" | "warn";
export type PolicySeverity = "blocker" | "warning";
export type PolicyCode = "missing_executable_base_url" | "project_fetch_failed" | "missing_auth_credentials" | "weak_assertion_coverage" | "missing_route_map_coverage" | "missing_checkout_data_prerequisite";
export type PolicyFinding = {
    code: PolicyCode;
    severity: PolicySeverity;
    message: string;
    remediation: string[];
    detail?: string;
};
export type PolicyContext = {
    tool_name: string;
    project_id: number;
    nlp_commands?: string[];
    auth_expectation?: "required" | "optional";
    route_map?: Record<string, string>;
    skip_base_url_check?: boolean;
    mode: PolicyMode;
};
export type PolicyResult = {
    ok: boolean;
    mode: PolicyMode;
    tool_name: string;
    project_id: number;
    findings: PolicyFinding[];
};
export declare function inferRequiresAuthFromNlp(commands: string[] | undefined): boolean;
export declare function evaluatePreconditionPolicies(client: HttpClient, ctx: PolicyContext): Promise<PolicyResult>;
export declare function formatPolicyFailure(result: PolicyResult): Record<string, unknown>;
