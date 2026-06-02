/**
 * ApiWorkflowStore — persists workflow contexts via the TestNeo backend API.
 *
 * The MCP server doesn't have direct DB access; it calls the Python backend
 * which owns the database. This store uses two endpoints:
 *
 *   POST /api/web/v1/workflow-contexts           → create / upsert
 *   GET  /api/web/v1/workflow-contexts/:id       → getById
 *   GET  /api/web/v1/workflow-contexts?key=...   → getByIdempotencyKey
 *   POST /api/web/v1/workflow-events             → appendEvent
 *   GET  /api/web/v1/workflow-events/:workflowId → getEvents
 *
 * Falls back to in-memory on any network error so validate_pr never fails
 * due to persistence issues. Failure is logged only.
 */
import type { WorkflowContext, WorkflowEvent } from "./contracts.js";
import { type WorkflowStore } from "./store.js";
export interface ApiWorkflowStoreClient {
    request<T = unknown>(path: string, opts?: {
        method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        body?: unknown;
        query?: Record<string, string | number | boolean>;
        timeoutMs?: number;
    }): Promise<T>;
}
export declare class ApiWorkflowStore implements WorkflowStore {
    private readonly client;
    private readonly fallback;
    constructor(client: ApiWorkflowStoreClient);
    create(context: WorkflowContext): Promise<void>;
    saveSnapshot(context: WorkflowContext): Promise<void>;
    appendEvent(event: WorkflowEvent): Promise<void>;
    getById(id: string): Promise<WorkflowContext | null>;
    getByIdempotencyKey(key: string): Promise<WorkflowContext | null>;
    getEvents(workflowId: string): Promise<WorkflowEvent[]>;
}
