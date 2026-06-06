import type { HttpClient } from "./httpClient.js";
export declare const ENGINEERING_MEMORY_POSTMORTEM_CONTRACT: "engineering_memory_postmortem.v1";
export declare const MAX_POSTMORTEM_BYTES: number;
export type PostmortemPayload = {
    ok: true;
    title: string;
    body: string;
    filename?: string;
} | {
    ok: false;
    error: string;
};
export declare function wrapEngineeringMemoryPostmortem(payload: Record<string, unknown>): Record<string, unknown>;
export declare function readPostmortemFromPath(md_path: string): Promise<PostmortemPayload>;
export declare function ingestPostmortem(client: HttpClient, project_id: number, title: string, body: string, external_id?: string): Promise<Record<string, unknown>>;
