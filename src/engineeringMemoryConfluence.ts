import type { HttpClient } from "./httpClient.js";

export const ENGINEERING_MEMORY_CONFLUENCE_CONTRACT = "engineering_memory_confluence.v1" as const;

export function wrapEngineeringMemoryConfluence(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    contract_version: ENGINEERING_MEMORY_CONFLUENCE_CONTRACT,
    ...payload,
  };
}

export async function ingestConfluencePage(
  client: HttpClient,
  project_id: number,
  page_id: string,
  title?: string,
): Promise<Record<string, unknown>> {
  return client.request<Record<string, unknown>>("/api/web/v1/engineering-memory/ingest/confluence", {
    method: "POST",
    body: {
      project_id,
      page_id,
      ...(title ? { title } : {}),
    },
    timeoutMs: client.longRequestTimeoutMs,
  });
}
