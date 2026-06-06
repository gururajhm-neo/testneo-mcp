import type { HttpClient } from "./httpClient.js";

export const ENGINEERING_MEMORY_JIRA_CONTRACT = "engineering_memory_jira_sync.v1" as const;

export function wrapEngineeringMemoryJira(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    contract_version: ENGINEERING_MEMORY_JIRA_CONTRACT,
    ...payload,
  };
}

export async function syncJiraEngineeringMemory(
  client: HttpClient,
  project_id: number,
  opts?: {
    max_issues?: number;
    lookback_days?: number;
    jira_project_key?: string;
  },
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    project_id,
    max_issues: opts?.max_issues ?? 50,
    lookback_days: opts?.lookback_days ?? 90,
  };
  if (opts?.jira_project_key?.trim()) {
    body.jira_project_key = opts.jira_project_key.trim();
  }
  return client.request<Record<string, unknown>>(
    "/api/web/v1/engineering-memory/ingest/jira",
    {
      method: "POST",
      body,
      timeoutMs: client.longRequestTimeoutMs,
    },
  );
}
