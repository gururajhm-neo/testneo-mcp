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
import { InMemoryWorkflowStore, type WorkflowStore } from "./store.js";

export interface ApiWorkflowStoreClient {
  request<T = unknown>(path: string, opts?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    query?: Record<string, string | number | boolean>;
    timeoutMs?: number;
  }): Promise<T>;
}

export class ApiWorkflowStore implements WorkflowStore {
  private readonly fallback = new InMemoryWorkflowStore();

  constructor(private readonly client: ApiWorkflowStoreClient) {}

  async create(context: WorkflowContext): Promise<void> {
    this.fallback.create(context).catch(() => undefined);
    try {
      await this.client.request("/api/web/v1/workflow-contexts", {
        method: "POST" as const,
        body: { context, event_type: "create" },
        timeoutMs: 5000,
      });
    } catch {
      // Fallback already has the data; log silently
    }
  }

  async saveSnapshot(context: WorkflowContext): Promise<void> {
    this.fallback.saveSnapshot(context).catch(() => undefined);
    try {
      await this.client.request(`/api/web/v1/workflow-contexts/${encodeURIComponent(context.id)}`, {
        method: "PUT" as const,
        body: { context },
        timeoutMs: 5000,
      });
    } catch {
      // Silently degraded — in-memory fallback still holds the state
    }
  }

  async appendEvent(event: WorkflowEvent): Promise<void> {
    this.fallback.appendEvent(event).catch(() => undefined);
    try {
      await this.client.request("/api/web/v1/workflow-events", {
        method: "POST" as const,
        body: { event },
        timeoutMs: 3000,
      });
    } catch {
      // Non-critical; events are for audit only
    }
  }

  async getById(id: string): Promise<WorkflowContext | null> {
    try {
      const resp = await this.client.request<Record<string, unknown>>(
        `/api/web/v1/workflow-contexts/${encodeURIComponent(id)}`,
        { timeoutMs: 5000 },
      );
      if (resp && typeof resp === "object" && "context" in resp) {
        return resp.context as WorkflowContext;
      }
      return null;
    } catch {
      return this.fallback.getById(id);
    }
  }

  async getByIdempotencyKey(key: string): Promise<WorkflowContext | null> {
    try {
      const resp = await this.client.request<Record<string, unknown>>(
        "/api/web/v1/workflow-contexts",
        {
          query: { idempotency_key: key },
          timeoutMs: 5000,
        },
      );
      if (resp && typeof resp === "object" && "context" in resp) {
        return resp.context as WorkflowContext;
      }
      return null;
    } catch {
      return this.fallback.getByIdempotencyKey(key);
    }
  }

  async getEvents(workflowId: string): Promise<WorkflowEvent[]> {
    try {
      const resp = await this.client.request<Record<string, unknown>>(
        `/api/web/v1/workflow-events/${encodeURIComponent(workflowId)}`,
        { timeoutMs: 5000 },
      );
      if (resp && Array.isArray(resp.events)) {
        return resp.events as WorkflowEvent[];
      }
      return [];
    } catch {
      return this.fallback.getEvents(workflowId);
    }
  }
}
