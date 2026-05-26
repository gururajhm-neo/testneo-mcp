import { randomUUID } from "node:crypto";
import {
  type AffectedTestCandidate,
  type ClaudeAnalysis,
  type ExecutionArtifactRef,
  type ImpactAnalysisResult,
  type ImpactedFlow,
  type Severity,
  type Stage,
  type StageRun,
  type ValidatePrRequest,
  ValidatePrRequestSchema,
  type ValidatePrResponse,
  ValidatePrResponseSchema,
  type VerificationFinding,
  type WorkflowContext,
  type WorkflowEvent,
} from "./contracts.js";
import { type WorkflowStore } from "./store.js";

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

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

export class PrValidationOrchestrator {
  private readonly now: () => Date;

  constructor(private readonly deps: PrValidationOrchestratorDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async validatePr(rawRequest: ValidatePrRequest): Promise<ValidatePrResponse> {
    const request = ValidatePrRequestSchema.parse(rawRequest);
    const idempotencyKey = request.idempotency_key?.trim() || this.buildIdempotencyKey(request);
    const existing = await this.deps.store.getByIdempotencyKey(idempotencyKey);
    if (existing) {
      return this.buildResponse(existing, request.output.include_comment_draft, {
        replayed: true,
        executionMode: this.executionModeForContext(existing),
        impactSource: String(existing.metadata.impact_source ?? "none") as "git_refs" | "manual_diff" | "none",
      });
    }

    const context = this.createInitialContext(request, idempotencyKey);
    let executionMode: "planned_only" | "executed" = "planned_only";
    await this.deps.store.create(context);
    await this.appendEvent(context.id, "workflow.initialized", { source: context.source });

    context.status = "planning";
    context.updatedAt = this.nowIso();
    await this.deps.store.saveSnapshot(context);

    const impact = await this.deps.impactAnalyzer.analyze(request);
    context.metadata.impact_source = impact.source;
    context.metadata.impact_summary = impact.summary ?? null;
    context.metadata.impact_recommendations = impact.recommendations ?? null;
    context.changes.impactedFlows = this.inferImpactedFlows(impact.affectedTests);
    const stagePlan = this.buildStagePlan(request, impact.affectedTests.length, context.changes.impactedFlows.length);
    context.runs = stagePlan.runs;
    if (stagePlan.unavailableRequestedStages.length > 0) {
      context.metadata.requested_but_unavailable_stages = stagePlan.unavailableRequestedStages;
    }
    await this.appendEvent(context.id, "impact.analysis_completed", {
      source: impact.source,
      impacted_tests: impact.affectedTests.length,
      impacted_flows: context.changes.impactedFlows.length,
    });

    context.status = "aggregating";
    context.updatedAt = this.nowIso();
    context.findings = this.normalizeFindings(impact.affectedTests, request);
    context.suggestedFixes = [...new Set(context.findings.flatMap((finding) => finding.suggestedFixes))];
    await this.deps.store.saveSnapshot(context);
    await this.appendEvent(context.id, "results.aggregated", {
      findings: context.findings.length,
      suggested_fixes: context.suggestedFixes.length,
    });

    if (
      this.deps.testExecutor &&
      this.deps.enableTestExecution !== false &&
      request.confirm &&
      request.execution.run_impacted_tests &&
      impact.affectedTests.length > 0
    ) {
      executionMode = "executed";
      context.status = "executing";
      context.updatedAt = this.nowIso();
      context.runs.tests = {
        stage: "tests",
        status: "running",
        startedAt: this.nowIso(),
      };
      await this.deps.store.saveSnapshot(context);
      await this.appendEvent(
        context.id,
        "tests.execution_started",
        {
          impacted_tests: impact.affectedTests.length,
        },
        "tests",
      );

      try {
        const testExecution = await this.deps.testExecutor.execute({
          request,
          context,
          affectedTests: impact.affectedTests,
        });
        context.runs.tests = testExecution.stageRun;
        context.artifacts.push(...(testExecution.artifacts ?? []));
        context.metadata.test_execution = testExecution.metadata ?? null;
        context.findings = testExecution.findings;
        context.suggestedFixes = [
          ...new Set([
            ...testExecution.findings.flatMap((finding) => finding.suggestedFixes),
            ...(testExecution.suggestedFixes ?? []),
          ]),
        ];
        await this.appendEvent(
          context.id,
          "tests.execution_completed",
          {
            status: testExecution.stageRun.status,
            executions: testExecution.stageRun.executionIds?.length ?? 0,
            findings: testExecution.findings.length,
          },
          "tests",
        );
      } catch (error) {
        const stageFailure = this.buildExecutionFailureFinding(error, request);
        context.runs.tests = {
          stage: "tests",
          status: "failed",
          startedAt: context.runs.tests?.startedAt,
          completedAt: this.nowIso(),
        };
        context.findings = [stageFailure];
        context.suggestedFixes = stageFailure.suggestedFixes;
        context.metadata.test_execution_error = this.errorMessage(error);
        await this.appendEvent(
          context.id,
          "tests.execution_failed",
          { message: this.errorMessage(error) },
          "tests",
        );
      }

      context.updatedAt = this.nowIso();
      await this.deps.store.saveSnapshot(context);
    }

    context.status = "analyzing";
    context.updatedAt = this.nowIso();
    const claudeAnalysis =
      (await this.deps.claudeAnalyzer?.analyze({
        request,
        context,
        impact,
      })) ?? this.buildDefaultClaudeAnalysis(context);
    context.ai = claudeAnalysis;
    await this.deps.store.saveSnapshot(context);
    await this.appendEvent(context.id, "claude.analysis_completed", {
      merge_recommendation: claudeAnalysis.mergeRecommendation,
      confidence: claudeAnalysis.confidence,
    });

    context.status = this.finalizeContextStatus(context);
    context.updatedAt = this.nowIso();
    context.metadata.execution_mode = executionMode;
    await this.deps.store.saveSnapshot(context);
    await this.appendEvent(context.id, "workflow.completed", { status: context.status });

    return this.buildResponse(context, request.output.include_comment_draft, {
      replayed: false,
      executionMode,
      impactSource: impact.source,
    });
  }

  private createInitialContext(request: ValidatePrRequest, idempotencyKey: string): WorkflowContext {
    const now = this.nowIso();
    return {
      id: randomUUID(),
      kind: "pr_validation",
      status: "initialized",
      correlationId: randomUUID(),
      idempotencyKey,
      source: "mcp",
      projectId: request.project_id,
      createdAt: now,
      updatedAt: now,
      repository: {
        provider: "github",
        owner: request.repository.owner,
        name: request.repository.name,
        prNumber: request.pull_request.number,
        prUrl: request.pull_request.url,
        baseSha: request.git.base_sha,
        headSha: request.git.head_sha,
      },
      changes: {
        changedFiles: request.git.changed_files ?? [],
        impactedFlows: [],
      },
      runs: {},
      artifacts: [],
      findings: [],
      suggestedFixes: [],
      metadata: {
        requested_execution: request.execution,
        requested_output: request.output,
      },
    };
  }

  private buildIdempotencyKey(request: ValidatePrRequest): string {
    return `github:${request.repository.owner}/${request.repository.name}:pr:${request.pull_request.number}:head:${request.git.head_sha}`;
  }

  private inferImpactedFlows(affectedTests: AffectedTestCandidate[]): ImpactedFlow[] {
    const byName = new Map<string, ImpactedFlow>();
    for (const candidate of affectedTests) {
      const rawName = candidate.function_name?.trim() || candidate.test_name?.trim() || "general";
      const id = rawName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "general";
      const confidence = candidate.confidence ?? candidate.confidence_score ?? 0.5;
      const testId = candidate.test_id;
      const existing = byName.get(id);
      if (existing) {
        existing.confidence = Math.max(existing.confidence, confidence);
        if (typeof testId === "number" && !existing.relatedTestIds.includes(testId)) {
          existing.relatedTestIds.push(testId);
        }
        continue;
      }
      byName.set(id, {
        id,
        name: rawName,
        confidence,
        reason: candidate.reason?.trim() || "Impacted by code change analysis",
        relatedFiles: [],
        relatedTestIds: typeof testId === "number" ? [testId] : [],
      });
    }
    return [...byName.values()];
  }

  private buildStagePlan(
    request: ValidatePrRequest,
    impactedTestsCount: number,
    impactedFlowsCount: number,
  ): {
    runs: Partial<Record<Stage, StageRun>>;
    unavailableRequestedStages: Stage[];
  } {
    const runs: Partial<Record<Stage, StageRun>> = {};
    const unavailableRequestedStages: Stage[] = [];

    if (request.execution.run_impacted_tests && impactedTestsCount > 0 && this.deps.testExecutor) {
      runs.tests = { stage: "tests", status: "queued" };
    } else if (request.execution.run_impacted_tests && impactedTestsCount > 0) {
      unavailableRequestedStages.push("tests");
    }
    if (request.execution.run_visual_regression && impactedFlowsCount > 0) {
      unavailableRequestedStages.push("visual");
    }
    if (request.execution.run_lighthouse && impactedFlowsCount > 0) {
      unavailableRequestedStages.push("lighthouse");
    }
    if (request.execution.capture_replay && impactedFlowsCount > 0) {
      unavailableRequestedStages.push("replay");
    }

    return { runs, unavailableRequestedStages };
  }

  private normalizeFindings(
    affectedTests: AffectedTestCandidate[],
    request: ValidatePrRequest,
  ): VerificationFinding[] {
    const changedFileHints = (request.git.changed_files ?? []).map((file) => file.path);
    return affectedTests.map((candidate, index) => {
      const severity = this.normalizeSeverity(candidate.impact_level);
      const confidence = candidate.confidence ?? candidate.confidence_score ?? 0.5;
      const testName = candidate.test_name?.trim() || `Impacted Test ${index + 1}`;
      const flow = candidate.function_name?.trim() || testName;
      return {
        id: `finding-${index + 1}`,
        source: "test",
        status: "warning",
        severity,
        blocking: false,
        flow,
        title: `Review impacted coverage for ${testName}`,
        issue: candidate.reason?.trim() || "Code impact analysis identified this test as potentially affected.",
        rootCauseHint:
          candidate.function_name?.trim()
            ? `Recent changes touched ${candidate.function_name}.`
            : "Review the changed logic and its linked coverage.",
        changedFileHints,
        relatedTestIds: typeof candidate.test_id === "number" ? [candidate.test_id] : [],
        evidence: [],
        suggestedFixes: [
          `Review ${testName} before merge.`,
          "Run impacted validation stages to confirm runtime behavior.",
        ],
        confidence,
      };
    });
  }

  private normalizeSeverity(level?: string): Severity {
    switch ((level || "").trim().toLowerCase()) {
      case "critical":
        return "critical";
      case "high":
        return "high";
      case "medium":
        return "medium";
      case "low":
        return "low";
      default:
        return "info";
    }
  }

  private buildDefaultClaudeAnalysis(context: WorkflowContext): ClaudeAnalysis {
    const impactedTests = context.findings.length;
    const testStageStatus = context.runs.tests?.status;
    const queuedStages = Object.values(context.runs).filter((run) => run?.status === "queued").length;
    const hasWorkRemaining = queuedStages > 0;
    const summary =
      testStageStatus === "passed"
        ? `Executed impacted runtime validation for ${impactedTests} test${impactedTests === 1 ? "" : "s"} and all completed successfully.`
        : testStageStatus === "failed"
          ? "Executed impacted runtime validation and found failures that should block merge until reviewed."
          : impactedTests > 0
            ? `Impact analysis identified ${impactedTests} potentially affected test${impactedTests === 1 ? "" : "s"}. Validation stages are planned and should be run before merge.`
            : "No impacted tests were identified from the provided change set.";

    return {
      summary,
      mergeRecommendation:
        testStageStatus === "failed" ? "request_changes" : hasWorkRemaining ? "hold" : "merge",
      confidence: testStageStatus === "failed" ? 0.82 : hasWorkRemaining ? 0.63 : 0.72,
      rootCauses: context.findings.map((finding) => ({
        findingId: finding.id,
        probableCause: finding.rootCauseHint || finding.issue,
        relatedFiles: finding.changedFileHints,
        rationale: `Generated from code impact analysis for ${finding.flow}.`,
        confidence: finding.confidence,
      })),
      suggestedFixes: context.findings.map((finding) => ({
        findingId: finding.id,
        fix: finding.suggestedFixes[0] || "Run impacted validation and review linked files.",
        files: finding.changedFileHints,
        priority: "now",
      })),
      reviewComments: [],
    };
  }

  private finalizeContextStatus(context: WorkflowContext): WorkflowContext["status"] {
    const hasBlocking = context.findings.some((finding) => finding.blocking);
    if (hasBlocking) return "failed";
    const testStageStatus = context.runs.tests?.status;
    if (testStageStatus === "failed") return "failed";
    if (testStageStatus === "partial" || testStageStatus === "running") return "partial_failed";
    const hasQueuedStages = Object.values(context.runs).some((run) => run?.status === "queued");
    if (hasQueuedStages) return "partial_failed";
    return "completed";
  }

  private buildResponse(
    context: WorkflowContext,
    includeCommentDraft: boolean,
    opts: {
      replayed: boolean;
      executionMode: "planned_only" | "executed";
      impactSource: "git_refs" | "manual_diff" | "none";
    },
  ): ValidatePrResponse {
    const highestSeverity = this.findHighestSeverity(context.findings);
    const warningCount = context.findings.filter((finding) => finding.status === "warning").length;
    const blockingCount = context.findings.filter((finding) => finding.blocking).length;
    const passedCount = context.findings.filter((finding) => finding.status === "passed").length;
    const status: ValidatePrResponse["status"] =
      context.status === "completed" ? "passed" : context.status === "failed" ? "failed" : "partial";

    const response: ValidatePrResponse = {
      contract_version: "pr_validation.v1",
      workflow_id: context.id,
      status,
      project_id: context.projectId,
      repository: {
        owner: context.repository.owner,
        name: context.repository.name,
        pr_number: context.repository.prNumber,
        base_sha: context.repository.baseSha,
        head_sha: context.repository.headSha,
      },
      impact_summary: {
        changed_files: context.changes.changedFiles.length,
        impacted_flows: context.changes.impactedFlows.length,
        impacted_tests: context.findings.length,
      },
      execution_summary: {
        tests: context.runs.tests,
        visual: context.runs.visual,
        lighthouse: context.runs.lighthouse,
        replay: context.runs.replay,
      },
      findings: context.findings,
      ai_ready_summary: {
        blocking_count: blockingCount,
        warning_count: warningCount,
        passed_count: passedCount,
        highest_severity: highestSeverity,
        merge_signal: blockingCount > 0 ? "block" : warningCount > 0 ? "review" : "clean",
      },
      claude_analysis: context.ai,
      comment_draft: includeCommentDraft ? this.buildCommentDraft(context, status) : undefined,
      metadata: {
        execution_mode: opts.executionMode,
        replayed: opts.replayed,
        impact_source: opts.impactSource,
      },
    };
    return ValidatePrResponseSchema.parse(response);
  }

  private buildCommentDraft(context: WorkflowContext, status: ValidatePrResponse["status"]): string {
    const recommendation = context.ai?.mergeRecommendation ?? "hold";
    const topFindings = context.findings.slice(0, 5);
    const lines = [
      "## TestNeo PR Validation",
      "",
      `Status: **${status.toUpperCase()}**`,
      `Merge recommendation: **${recommendation}**`,
      "",
      context.ai?.summary || "Validation planning completed.",
    ];

    if (topFindings.length) {
      lines.push("", "### Impacted coverage to review");
      for (const finding of topFindings) {
        lines.push(`- **${finding.flow}**: ${finding.issue}`);
      }
    }

    if (context.suggestedFixes.length) {
      lines.push("", "### Suggested next steps");
      for (const fix of context.suggestedFixes.slice(0, 5)) {
        lines.push(`- ${fix}`);
      }
    }

    return lines.join("\n");
  }

  private findHighestSeverity(findings: VerificationFinding[]): Severity {
    let highest: Severity = "info";
    for (const finding of findings) {
      if (SEVERITY_ORDER[finding.severity] > SEVERITY_ORDER[highest]) {
        highest = finding.severity;
      }
    }
    return highest;
  }

  private buildExecutionFailureFinding(error: unknown, request: ValidatePrRequest): VerificationFinding {
    return {
      id: "finding-tests-execution-error",
      source: "test",
      status: "failed",
      severity: "high",
      blocking: true,
      flow: "impacted-test-execution",
      title: "Impacted test execution could not complete",
      issue: this.errorMessage(error),
      rootCauseHint: "The orchestration layer could not complete the impacted test execution stage.",
      changedFileHints: (request.git.changed_files ?? []).map((file) => file.path),
      relatedTestIds: [],
      evidence: [],
      suggestedFixes: [
        "Inspect the execution API response and local agent configuration.",
        "Retry validate_pr after resolving the execution failure.",
      ],
      confidence: 0.9,
    };
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private executionModeForContext(context: WorkflowContext): "planned_only" | "executed" {
    const mode = context.metadata.execution_mode;
    return mode === "executed" ? "executed" : "planned_only";
  }

  private async appendEvent(workflowId: string, type: string, payload: unknown, stage?: Stage): Promise<void> {
    const event: WorkflowEvent = {
      workflowId,
      type,
      stage,
      timestamp: this.nowIso(),
      payload,
    };
    await this.deps.store.appendEvent(event);
  }

  private nowIso(): string {
    return this.now().toISOString();
  }
}
