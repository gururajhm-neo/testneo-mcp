import type { HttpClient } from "./httpClient.js";
export declare const ENGINEERING_MEMORY_JIRA_CONTRACT: "engineering_memory_jira_sync.v1";
export declare function wrapEngineeringMemoryJira(payload: Record<string, unknown>): Record<string, unknown>;
export declare function syncJiraEngineeringMemory(client: HttpClient, project_id: number, opts?: {
    max_issues?: number;
    lookback_days?: number;
    jira_project_key?: string;
}): Promise<Record<string, unknown>>;
