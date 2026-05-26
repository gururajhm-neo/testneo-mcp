import { type AffectedTestCandidate, type ClaudeAnalysis, type ExecutionArtifactRef, type ImpactAnalysisResult, type StageRun, type ValidatePrRequest, type ValidatePrResponse, type VerificationFinding, type WorkflowContext } from "./contracts.js";
import { type WorkflowStore } from "./store.js";
export interface ImpactAnalysisAdapter {
    analyze(request: ValidatePrRequest): Promise<ImpactAnalysisResult>;
}
export interface ClaudeAnalysisAdapter {
    analyze(input: {
        request: ValidatePrRequest;
        context: WorkflowContext;
        impact: ImpactAnalysisResult;
    }): Promise<ClaudeAnalysis | undefined>;
}
export interface TestExecutionAdapterResult {
    stageRun: StageRun;
    findings: VerificationFinding[];
    artifacts?: ExecutionArtifactRef[];
    metadata?: Record<string, unknown>;
    suggestedFixes?: string[];
}
export interface TestExecutionAdapter {
    execute(input: {
        request: ValidatePrRequest;
        context: WorkflowContext;
        affectedTests: AffectedTestCandidate[];
    }): Promise<TestExecutionAdapterResult>;
}
export interface PrValidationOrchestratorDeps {
    store: WorkflowStore;
    impactAnalyzer: ImpactAnalysisAdapter;
    claudeAnalyzer?: ClaudeAnalysisAdapter;
    testExecutor?: TestExecutionAdapter;
    enableTestExecution?: boolean;
    now?: () => Date;
}
export declare class PrValidationOrchestrator {
    private readonly deps;
    private readonly now;
    constructor(deps: PrValidationOrchestratorDeps);
    validatePr(rawRequest: ValidatePrRequest): Promise<ValidatePrResponse>;
    private createInitialContext;
    private buildIdempotencyKey;
    private inferImpactedFlows;
    private buildStagePlan;
    private normalizeFindings;
    private normalizeSeverity;
    private buildDefaultClaudeAnalysis;
    private finalizeContextStatus;
    private buildResponse;
    private buildCommentDraft;
    private findHighestSeverity;
    private buildExecutionFailureFinding;
    private errorMessage;
    private executionModeForContext;
    private appendEvent;
    private nowIso;
}
