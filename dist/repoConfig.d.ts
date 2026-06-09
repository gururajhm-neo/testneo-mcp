export type RepoConfigDefaults = {
    project_id?: number;
    generate_engine?: "heuristic" | "langgraph";
    generate_if_unmapped?: boolean;
    auto_sync_structure?: boolean;
    auto_release_bundle?: boolean;
    confirm?: boolean;
    sync_jira_before_validate?: boolean;
    gate_policy?: "both" | "no_block" | "min_confidence" | "warn_only";
    gate_threshold?: number;
    target_env?: string;
};
export declare function loadRepoConfigDefaults(workspaceRoot?: string): RepoConfigDefaults;
/** Tool params override repo defaults; repo defaults override schema defaults. */
export declare function mergeRepoConfigIntoWorkflowParams<T extends Record<string, unknown>>(params: T, workspaceRoot?: string): T;
