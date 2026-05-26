"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryWorkflowStore = void 0;
class InMemoryWorkflowStore {
    contexts = new Map();
    idempotency = new Map();
    events = new Map();
    async create(context) {
        this.contexts.set(context.id, structuredClone(context));
        this.idempotency.set(context.idempotencyKey, context.id);
        this.events.set(context.id, []);
    }
    async saveSnapshot(context) {
        this.contexts.set(context.id, structuredClone(context));
        this.idempotency.set(context.idempotencyKey, context.id);
    }
    async appendEvent(event) {
        const events = this.events.get(event.workflowId) ?? [];
        events.push(structuredClone(event));
        this.events.set(event.workflowId, events);
    }
    async getById(id) {
        const context = this.contexts.get(id);
        return context ? structuredClone(context) : null;
    }
    async getByIdempotencyKey(key) {
        const workflowId = this.idempotency.get(key);
        if (!workflowId)
            return null;
        return this.getById(workflowId);
    }
    async getEvents(workflowId) {
        return structuredClone(this.events.get(workflowId) ?? []);
    }
}
exports.InMemoryWorkflowStore = InMemoryWorkflowStore;
