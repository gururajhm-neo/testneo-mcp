import type { HttpClient } from "./httpClient.js";
export declare const ENGINEERING_MEMORY_CONFLUENCE_CONTRACT: "engineering_memory_confluence.v1";
export declare function wrapEngineeringMemoryConfluence(payload: Record<string, unknown>): Record<string, unknown>;
export declare function ingestConfluencePage(client: HttpClient, project_id: number, page_id: string, title?: string): Promise<Record<string, unknown>>;
