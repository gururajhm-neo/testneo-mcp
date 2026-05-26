import { WorkflowContext, type WorkflowEvent } from "./contracts.js";
export interface WorkflowStore {
    create(context: WorkflowContext): Promise<void>;
    saveSnapshot(context: WorkflowContext): Promise<void>;
    appendEvent(event: WorkflowEvent): Promise<void>;
    getById(id: string): Promise<WorkflowContext | null>;
    getByIdempotencyKey(key: string): Promise<WorkflowContext | null>;
    getEvents(workflowId: string): Promise<WorkflowEvent[]>;
}
export declare class InMemoryWorkflowStore implements WorkflowStore {
    private readonly contexts;
    private readonly idempotency;
    private readonly events;
    create(context: WorkflowContext): Promise<void>;
    saveSnapshot(context: WorkflowContext): Promise<void>;
    appendEvent(event: WorkflowEvent): Promise<void>;
    getById(id: string): Promise<WorkflowContext | null>;
    getByIdempotencyKey(key: string): Promise<WorkflowContext | null>;
    getEvents(workflowId: string): Promise<WorkflowEvent[]>;
}
