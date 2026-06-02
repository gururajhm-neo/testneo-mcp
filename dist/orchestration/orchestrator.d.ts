import { type AffectedTestCandidate, type ClaudeAnalysis, type ExecutionArtifactRef, type ImpactAnalysisResult, type StageRun, type ValidatePrRequest, type ValidatePrResponse, type VerificationFinding, type WorkflowContext, type IncidentContext } from "./contracts.js";
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
export interface IncidentContextAdapter {
    lookup(input: {
        request: ValidatePrRequest;
        context: WorkflowContext;
        findings: VerificationFinding[];
        affectedTests: AffectedTestCandidate[];
    }): Promise<IncidentContext | undefined>;
}
export interface PrValidationOrchestratorDeps {
    store: WorkflowStore;
    impactAnalyzer: ImpactAnalysisAdapter;
    claudeAnalyzer?: ClaudeAnalysisAdapter;
    incidentContextAdapter?: IncidentContextAdapter;
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
    /**
     * Converts impact analysis candidates into structured VerificationFindings.
     * GAP 1 FIX: blocking is now driven by severity + historical risk signals.
     * A finding is blocking when:
     *   - severity is critical or high AND confidence ≥ 0.6, OR
     *   - historical failure_rate_7d ≥ 0.4 (failed 40%+ of the time recently), OR
     *   - risk_level is BLOCK (aggregate signal)
     */
    private normalizeFindings;
    private normalizeSeverity;
    /**
     * GAP 5: Risk-driven analysis replacing the hardcoded template strings.
     * Uses the RiskScoreResult to produce deterministic, accurate merge recommendations.
     */
    private buildRiskDrivenAnalysis;
    /**
     * GAP 7: Status is now correct for planned_only clean validations.
     * planned_only with no blocking findings → "completed" (not "partial_failed")
     */
    private finalizeContextStatus;
    private buildResponse;
    private recomputeRiskFromContext;
    /**
     * GAP 8: Structured comment draft matching the homepage board layout.
     * Sections: Changed → Affected → Verification Selected → Result → Evidence → Recommendation
     */
    private buildCommentDraft;
    private findHighestSeverity;
    private buildExecutionFailureFinding;
    private errorMessage;
    private executionModeForContext;
    private appendEvent;
    private nowIso;
}
