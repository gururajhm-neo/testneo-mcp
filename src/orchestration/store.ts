import { WorkflowContext, type WorkflowEvent } from "./contracts.js";

export interface WorkflowStore {
  create(context: WorkflowContext): Promise<void>;
  saveSnapshot(context: WorkflowContext): Promise<void>;
  appendEvent(event: WorkflowEvent): Promise<void>;
  getById(id: string): Promise<WorkflowContext | null>;
  getByIdempotencyKey(key: string): Promise<WorkflowContext | null>;
  getEvents(workflowId: string): Promise<WorkflowEvent[]>;
}

export class InMemoryWorkflowStore implements WorkflowStore {
  private readonly contexts = new Map<string, WorkflowContext>();
  private readonly idempotency = new Map<string, string>();
  private readonly events = new Map<string, WorkflowEvent[]>();

  async create(context: WorkflowContext): Promise<void> {
    this.contexts.set(context.id, structuredClone(context));
    this.idempotency.set(context.idempotencyKey, context.id);
    this.events.set(context.id, []);
  }

  async saveSnapshot(context: WorkflowContext): Promise<void> {
    this.contexts.set(context.id, structuredClone(context));
    this.idempotency.set(context.idempotencyKey, context.id);
  }

  async appendEvent(event: WorkflowEvent): Promise<void> {
    const events = this.events.get(event.workflowId) ?? [];
    events.push(structuredClone(event));
    this.events.set(event.workflowId, events);
  }

  async getById(id: string): Promise<WorkflowContext | null> {
    const context = this.contexts.get(id);
    return context ? structuredClone(context) : null;
  }

  async getByIdempotencyKey(key: string): Promise<WorkflowContext | null> {
    const workflowId = this.idempotency.get(key);
    if (!workflowId) return null;
    return this.getById(workflowId);
  }

  async getEvents(workflowId: string): Promise<WorkflowEvent[]> {
    return structuredClone(this.events.get(workflowId) ?? []);
  }
}
