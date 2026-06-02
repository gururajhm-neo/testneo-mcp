"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiWorkflowStore = void 0;
const store_js_1 = require("./store.js");
class ApiWorkflowStore {
    client;
    fallback = new store_js_1.InMemoryWorkflowStore();
    constructor(client) {
        this.client = client;
    }
    async create(context) {
        this.fallback.create(context).catch(() => undefined);
        try {
            await this.client.request("/api/web/v1/workflow-contexts", {
                method: "POST",
                body: { context, event_type: "create" },
                timeoutMs: 5000,
            });
        }
        catch {
            // Fallback already has the data; log silently
        }
    }
    async saveSnapshot(context) {
        this.fallback.saveSnapshot(context).catch(() => undefined);
        try {
            await this.client.request(`/api/web/v1/workflow-contexts/${encodeURIComponent(context.id)}`, {
                method: "PUT",
                body: { context },
                timeoutMs: 5000,
            });
        }
        catch {
            // Silently degraded — in-memory fallback still holds the state
        }
    }
    async appendEvent(event) {
        this.fallback.appendEvent(event).catch(() => undefined);
        try {
            await this.client.request("/api/web/v1/workflow-events", {
                method: "POST",
                body: { event },
                timeoutMs: 3000,
            });
        }
        catch {
            // Non-critical; events are for audit only
        }
    }
    async getById(id) {
        try {
            const resp = await this.client.request(`/api/web/v1/workflow-contexts/${encodeURIComponent(id)}`, { timeoutMs: 5000 });
            if (resp && typeof resp === "object" && "context" in resp) {
                return resp.context;
            }
            return null;
        }
        catch {
            return this.fallback.getById(id);
        }
    }
    async getByIdempotencyKey(key) {
        try {
            const resp = await this.client.request("/api/web/v1/workflow-contexts", {
                query: { idempotency_key: key },
                timeoutMs: 5000,
            });
            if (resp && typeof resp === "object" && "context" in resp) {
                return resp.context;
            }
            return null;
        }
        catch {
            return this.fallback.getByIdempotencyKey(key);
        }
    }
    async getEvents(workflowId) {
        try {
            const resp = await this.client.request(`/api/web/v1/workflow-events/${encodeURIComponent(workflowId)}`, { timeoutMs: 5000 });
            if (resp && Array.isArray(resp.events)) {
                return resp.events;
            }
            return [];
        }
        catch {
            return this.fallback.getEvents(workflowId);
        }
    }
}
exports.ApiWorkflowStore = ApiWorkflowStore;
