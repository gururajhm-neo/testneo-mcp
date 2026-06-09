import { z } from "zod";
import { type ImpactAnalysisAdapter, type TestExecutionAdapter } from "./orchestration/index.js";
import { HttpClient } from "./httpClient.js";
import { ToolTextResult } from "./types.js";
import type { WorkflowStore } from "./orchestration/store.js";
import type { IncidentContextAdapter } from "./orchestration/incidentContextAdapter.js";
export declare const DeveloperReleaseWorkflowInputSchema: z.ZodObject<{
    project_id: z.ZodNumber;
    repository: z.ZodObject<{
        owner: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        owner: string;
    }, {
        name: string;
        owner: string;
    }>;
    pull_request: z.ZodObject<{
        number: z.ZodNumber;
        url: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        number: number;
        url?: string | undefined;
    }, {
        number: number;
        url?: string | undefined;
    }>;
    git: z.ZodObject<{
        base_sha: z.ZodString;
        head_sha: z.ZodString;
        diff_content: z.ZodOptional<z.ZodString>;
        changed_files: z.ZodOptional<z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            status: z.ZodDefault<z.ZodEnum<["added", "modified", "deleted", "renamed"]>>;
            additions: z.ZodOptional<z.ZodNumber>;
            deletions: z.ZodOptional<z.ZodNumber>;
            language: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "modified" | "added" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
        }, {
            path: string;
            status?: "modified" | "added" | "deleted" | "renamed" | undefined;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        base_sha: string;
        head_sha: string;
        changed_files?: {
            status: "modified" | "added" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
        }[] | undefined;
        diff_content?: string | undefined;
    }, {
        base_sha: string;
        head_sha: string;
        changed_files?: {
            path: string;
            status?: "modified" | "added" | "deleted" | "renamed" | undefined;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
        }[] | undefined;
        diff_content?: string | undefined;
    }>;
    execution: z.ZodDefault<z.ZodObject<{
        run_impacted_tests: z.ZodDefault<z.ZodBoolean>;
        mode: z.ZodOptional<z.ZodEnum<["local", "cloud"]>>;
        platform: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        run_impacted_tests: boolean;
        mode?: "local" | "cloud" | undefined;
        platform?: string | undefined;
    }, {
        run_impacted_tests?: boolean | undefined;
        mode?: "local" | "cloud" | undefined;
        platform?: string | undefined;
    }>>;
    confirm: z.ZodDefault<z.ZodBoolean>;
    generate_if_unmapped: z.ZodDefault<z.ZodBoolean>;
    generate_engine: z.ZodOptional<z.ZodDefault<z.ZodEnum<["heuristic", "langgraph"]>>>;
    generate_max_tests: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    auto_sync_structure: z.ZodDefault<z.ZodBoolean>;
    workspace_root: z.ZodOptional<z.ZodString>;
    include_paths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    auto_release_bundle: z.ZodDefault<z.ZodBoolean>;
    release_name: z.ZodOptional<z.ZodString>;
    target_env: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    gate_policy: z.ZodOptional<z.ZodDefault<z.ZodEnum<["both", "no_block", "min_confidence", "warn_only"]>>>;
    gate_threshold: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    engineering_memory_csv_path: z.ZodOptional<z.ZodString>;
    engineering_memory_csv_base64: z.ZodOptional<z.ZodString>;
    engineering_memory_csv_filename: z.ZodOptional<z.ZodString>;
    sync_jira_before_validate: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    jira_sync_max_issues: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    jira_sync_lookback_days: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    idempotency_key: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    project_id: number;
    confirm: boolean;
    repository: {
        name: string;
        owner: string;
    };
    pull_request: {
        number: number;
        url?: string | undefined;
    };
    git: {
        base_sha: string;
        head_sha: string;
        changed_files?: {
            status: "modified" | "added" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
        }[] | undefined;
        diff_content?: string | undefined;
    };
    execution: {
        run_impacted_tests: boolean;
        mode?: "local" | "cloud" | undefined;
        platform?: string | undefined;
    };
    generate_if_unmapped: boolean;
    auto_sync_structure: boolean;
    auto_release_bundle: boolean;
    workspace_root?: string | undefined;
    include_paths?: string[] | undefined;
    idempotency_key?: string | undefined;
    generate_engine?: "heuristic" | "langgraph" | undefined;
    generate_max_tests?: number | undefined;
    release_name?: string | undefined;
    target_env?: string | undefined;
    gate_policy?: "both" | "no_block" | "min_confidence" | "warn_only" | undefined;
    gate_threshold?: number | undefined;
    engineering_memory_csv_path?: string | undefined;
    engineering_memory_csv_base64?: string | undefined;
    engineering_memory_csv_filename?: string | undefined;
    sync_jira_before_validate?: boolean | undefined;
    jira_sync_max_issues?: number | undefined;
    jira_sync_lookback_days?: number | undefined;
}, {
    project_id: number;
    repository: {
        name: string;
        owner: string;
    };
    pull_request: {
        number: number;
        url?: string | undefined;
    };
    git: {
        base_sha: string;
        head_sha: string;
        changed_files?: {
            path: string;
            status?: "modified" | "added" | "deleted" | "renamed" | undefined;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
        }[] | undefined;
        diff_content?: string | undefined;
    };
    workspace_root?: string | undefined;
    include_paths?: string[] | undefined;
    confirm?: boolean | undefined;
    execution?: {
        run_impacted_tests?: boolean | undefined;
        mode?: "local" | "cloud" | undefined;
        platform?: string | undefined;
    } | undefined;
    idempotency_key?: string | undefined;
    generate_if_unmapped?: boolean | undefined;
    generate_engine?: "heuristic" | "langgraph" | undefined;
    generate_max_tests?: number | undefined;
    auto_sync_structure?: boolean | undefined;
    auto_release_bundle?: boolean | undefined;
    release_name?: string | undefined;
    target_env?: string | undefined;
    gate_policy?: "both" | "no_block" | "min_confidence" | "warn_only" | undefined;
    gate_threshold?: number | undefined;
    engineering_memory_csv_path?: string | undefined;
    engineering_memory_csv_base64?: string | undefined;
    engineering_memory_csv_filename?: string | undefined;
    sync_jira_before_validate?: boolean | undefined;
    jira_sync_max_issues?: number | undefined;
    jira_sync_lookback_days?: number | undefined;
}>;
export type DeveloperReleaseWorkflowInput = z.infer<typeof DeveloperReleaseWorkflowInputSchema>;
export type ExecutionRoutingInfo = {
    resolved_mode: "local" | "cloud";
    resolved_platform: string;
    use_local_agent: boolean;
    write_tools_enabled: boolean;
    confirm_requested: boolean;
};
export type DeveloperReleaseWorkflowDeps = {
    client: HttpClient;
    store: WorkflowStore;
    impactAnalyzer: ImpactAnalysisAdapter;
    testExecutor: TestExecutionAdapter;
    incidentContextAdapter: IncidentContextAdapter;
    allowWriteTools: boolean;
    executionRouting: ExecutionRoutingInfo;
    asText: (value: unknown) => string;
    result: (text: string) => ToolTextResult;
};
export declare function runDeveloperReleaseWorkflow(params: DeveloperReleaseWorkflowInput, deps: DeveloperReleaseWorkflowDeps): Promise<ToolTextResult>;
