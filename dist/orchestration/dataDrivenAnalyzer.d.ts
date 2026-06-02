/**
 * DataDrivenClaudeAnalyzer
 *
 * Implements ClaudeAnalysisAdapter without any external LLM calls.
 * Produces rich, human-quality ClaudeAnalysis by synthesizing all signals
 * already available in WorkflowContext + ImpactAnalysisResult:
 *
 *   - Per-test historical failure rates + flakiness scores
 *   - Component failure history (project-wide, 7-day + trend)
 *   - Dependency blast radius (transitive import depth + affected components)
 *   - Actual execution results when tests ran
 *   - Risk score factors + weights from the RiskScorer
 *   - Critical-path pattern detection on changed files
 *
 * This is wired as the `claudeAnalyzer` for all MCP-triggered validations,
 * replacing the bare-minimum `buildRiskDrivenAnalysis` fallback in the
 * orchestrator.  The orchestrator's fallback remains intact for non-MCP paths.
 */
import type { ClaudeAnalysis, ImpactAnalysisResult, ValidatePrRequest, WorkflowContext } from "./contracts.js";
import type { ClaudeAnalysisAdapter } from "./orchestrator.js";
export declare class DataDrivenClaudeAnalyzer implements ClaudeAnalysisAdapter {
    analyze(input: {
        request: ValidatePrRequest;
        context: WorkflowContext;
        impact: ImpactAnalysisResult;
    }): Promise<ClaudeAnalysis | undefined>;
}
