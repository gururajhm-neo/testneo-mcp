"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidatePrResponseSchema = exports.ValidatePrRequestSchema = exports.ImpactAnalysisResultSchema = exports.AffectedTestCandidateSchema = exports.WorkflowEventSchema = exports.WorkflowContextSchema = exports.ClaudeAnalysisSchema = exports.VerificationFindingSchema = exports.StageRunSchema = exports.ExecutionArtifactRefSchema = exports.ImpactedFlowSchema = exports.ChangedFileSchema = exports.StageRunStatusSchema = exports.StageSchema = exports.WorkflowStatusSchema = exports.SeveritySchema = void 0;
const zod_1 = require("zod");
exports.SeveritySchema = zod_1.z.enum(["critical", "high", "medium", "low", "info"]);
exports.WorkflowStatusSchema = zod_1.z.enum([
    "initialized",
    "planning",
    "executing",
    "aggregating",
    "publishing",
    "analyzing",
    "commenting",
    "completed",
    "partial_failed",
    "failed",
    "cancelled",
]);
exports.StageSchema = zod_1.z.enum(["tests", "visual", "lighthouse", "replay"]);
exports.StageRunStatusSchema = zod_1.z.enum(["queued", "running", "passed", "failed", "partial"]);
exports.ChangedFileSchema = zod_1.z.object({
    path: zod_1.z.string().min(1),
    status: zod_1.z.enum(["added", "modified", "deleted", "renamed"]),
    additions: zod_1.z.number().int().optional(),
    deletions: zod_1.z.number().int().optional(),
    language: zod_1.z.string().optional(),
    patch: zod_1.z.string().optional(),
});
exports.ImpactedFlowSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    confidence: zod_1.z.number().min(0).max(1),
    reason: zod_1.z.string().min(1),
    relatedFiles: zod_1.z.array(zod_1.z.string()),
    relatedTestIds: zod_1.z.array(zod_1.z.number().int().positive()),
});
exports.ExecutionArtifactRefSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    kind: zod_1.z.enum(["screenshot", "visual_diff", "replay", "lighthouse", "console", "trace"]),
    name: zod_1.z.string().min(1),
    url: zod_1.z.string().min(1),
    contentType: zod_1.z.string().optional(),
    flow: zod_1.z.string().optional(),
    testId: zod_1.z.number().int().positive().optional(),
    viewport: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.StageRunSchema = zod_1.z.object({
    stage: exports.StageSchema,
    status: exports.StageRunStatusSchema,
    startedAt: zod_1.z.string().optional(),
    completedAt: zod_1.z.string().optional(),
    runId: zod_1.z.string().optional(),
    executionIds: zod_1.z.array(zod_1.z.string()).optional(),
    dashboardUrl: zod_1.z.string().optional(),
    rawResultRef: zod_1.z.string().optional(),
});
exports.VerificationFindingSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    source: zod_1.z.enum(["test", "visual", "lighthouse", "replay", "console"]),
    status: zod_1.z.enum(["passed", "warning", "failed"]),
    severity: exports.SeveritySchema,
    blocking: zod_1.z.boolean(),
    flow: zod_1.z.string().min(1),
    title: zod_1.z.string().min(1),
    issue: zod_1.z.string().min(1),
    rootCauseHint: zod_1.z.string().optional(),
    changedFileHints: zod_1.z.array(zod_1.z.string()),
    relatedTestIds: zod_1.z.array(zod_1.z.number().int().positive()),
    evidence: zod_1.z.array(exports.ExecutionArtifactRefSchema),
    replayUrl: zod_1.z.string().optional(),
    visualRegression: zod_1.z.boolean().optional(),
    lighthouseMetric: zod_1.z.string().optional(),
    lighthouseScore: zod_1.z.number().optional(),
    consoleErrors: zod_1.z.array(zod_1.z.string()).optional(),
    suggestedFixes: zod_1.z.array(zod_1.z.string()),
    confidence: zod_1.z.number().min(0).max(1),
});
exports.ClaudeAnalysisSchema = zod_1.z.object({
    summary: zod_1.z.string().min(1),
    mergeRecommendation: zod_1.z.enum(["merge", "merge_with_followup", "hold", "request_changes"]),
    confidence: zod_1.z.number().min(0).max(1),
    rootCauses: zod_1.z.array(zod_1.z.object({
        findingId: zod_1.z.string().min(1),
        probableCause: zod_1.z.string().min(1),
        relatedFiles: zod_1.z.array(zod_1.z.string()),
        rationale: zod_1.z.string().min(1),
        confidence: zod_1.z.number().min(0).max(1),
    })),
    suggestedFixes: zod_1.z.array(zod_1.z.object({
        findingId: zod_1.z.string().min(1),
        fix: zod_1.z.string().min(1),
        files: zod_1.z.array(zod_1.z.string()),
        priority: zod_1.z.enum(["now", "next"]),
    })),
    reviewComments: zod_1.z.array(zod_1.z.object({
        path: zod_1.z.string().optional(),
        body: zod_1.z.string().min(1),
        severity: exports.SeveritySchema,
    })),
});
exports.WorkflowContextSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    kind: zod_1.z.literal("pr_validation"),
    status: exports.WorkflowStatusSchema,
    correlationId: zod_1.z.string().min(1),
    idempotencyKey: zod_1.z.string().min(1),
    source: zod_1.z.enum(["mcp", "github_action", "cli", "ide", "dashboard"]),
    projectId: zod_1.z.number().int().positive(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
    repository: zod_1.z.object({
        provider: zod_1.z.literal("github"),
        owner: zod_1.z.string().min(1),
        name: zod_1.z.string().min(1),
        prNumber: zod_1.z.number().int().positive(),
        prUrl: zod_1.z.string().optional(),
        baseSha: zod_1.z.string().min(1),
        headSha: zod_1.z.string().min(1),
    }),
    changes: zod_1.z.object({
        changedFiles: zod_1.z.array(exports.ChangedFileSchema),
        impactedFlows: zod_1.z.array(exports.ImpactedFlowSchema),
    }),
    runs: zod_1.z.object({
        tests: exports.StageRunSchema.optional(),
        visual: exports.StageRunSchema.optional(),
        lighthouse: exports.StageRunSchema.optional(),
        replay: exports.StageRunSchema.optional(),
    }),
    artifacts: zod_1.z.array(exports.ExecutionArtifactRefSchema),
    findings: zod_1.z.array(exports.VerificationFindingSchema),
    ai: exports.ClaudeAnalysisSchema.optional(),
    suggestedFixes: zod_1.z.array(zod_1.z.string()),
    metadata: zod_1.z.record(zod_1.z.unknown()),
});
exports.WorkflowEventSchema = zod_1.z.object({
    workflowId: zod_1.z.string().min(1),
    type: zod_1.z.string().min(1),
    stage: exports.StageSchema.optional(),
    timestamp: zod_1.z.string(),
    payload: zod_1.z.unknown(),
});
exports.AffectedTestCandidateSchema = zod_1.z.object({
    test_id: zod_1.z.number().int().positive().optional(),
    test_name: zod_1.z.string().optional(),
    function_name: zod_1.z.string().optional(),
    confidence: zod_1.z.number().min(0).max(1).optional(),
    confidence_score: zod_1.z.number().min(0).max(1).optional(),
    impact_level: zod_1.z.string().optional(),
    reason: zod_1.z.string().optional(),
});
exports.ImpactAnalysisResultSchema = zod_1.z.object({
    affectedTests: zod_1.z.array(exports.AffectedTestCandidateSchema),
    summary: zod_1.z.record(zod_1.z.unknown()).optional(),
    recommendations: zod_1.z.union([zod_1.z.array(zod_1.z.string()), zod_1.z.record(zod_1.z.unknown())]).optional(),
    source: zod_1.z.enum(["git_refs", "manual_diff", "none"]).default("none"),
});
exports.ValidatePrRequestSchema = zod_1.z.object({
    project_id: zod_1.z.number().int().positive(),
    repository: zod_1.z.object({
        owner: zod_1.z.string().min(1),
        name: zod_1.z.string().min(1),
    }),
    pull_request: zod_1.z.object({
        number: zod_1.z.number().int().positive(),
        url: zod_1.z.string().url().optional(),
    }),
    git: zod_1.z.object({
        base_sha: zod_1.z.string().min(7),
        head_sha: zod_1.z.string().min(7),
        diff_content: zod_1.z.string().optional(),
        changed_files: zod_1.z.array(exports.ChangedFileSchema).optional(),
    }),
    execution: zod_1.z
        .object({
        run_impacted_tests: zod_1.z.boolean().default(true),
        run_visual_regression: zod_1.z.boolean().default(true),
        run_lighthouse: zod_1.z.boolean().default(true),
        capture_replay: zod_1.z.boolean().default(true),
        max_parallelism: zod_1.z.number().int().min(1).max(8).default(4),
    })
        .default({}),
    output: zod_1.z
        .object({
        include_comment_draft: zod_1.z.boolean().default(true),
        publish_comment: zod_1.z.boolean().default(false),
    })
        .default({}),
    idempotency_key: zod_1.z.string().min(8).max(128).optional(),
    confirm: zod_1.z.boolean().default(false),
});
exports.ValidatePrResponseSchema = zod_1.z.object({
    contract_version: zod_1.z.literal("pr_validation.v1"),
    workflow_id: zod_1.z.string().min(1),
    status: zod_1.z.enum(["passed", "failed", "partial"]),
    project_id: zod_1.z.number().int().positive(),
    repository: zod_1.z.object({
        owner: zod_1.z.string().min(1),
        name: zod_1.z.string().min(1),
        pr_number: zod_1.z.number().int().positive(),
        base_sha: zod_1.z.string().min(1),
        head_sha: zod_1.z.string().min(1),
    }),
    impact_summary: zod_1.z.object({
        changed_files: zod_1.z.number().int().min(0),
        impacted_flows: zod_1.z.number().int().min(0),
        impacted_tests: zod_1.z.number().int().min(0),
    }),
    execution_summary: zod_1.z.object({
        tests: exports.StageRunSchema.optional(),
        visual: exports.StageRunSchema.optional(),
        lighthouse: exports.StageRunSchema.optional(),
        replay: exports.StageRunSchema.optional(),
    }),
    findings: zod_1.z.array(exports.VerificationFindingSchema),
    ai_ready_summary: zod_1.z.object({
        blocking_count: zod_1.z.number().int().min(0),
        warning_count: zod_1.z.number().int().min(0),
        passed_count: zod_1.z.number().int().min(0),
        highest_severity: exports.SeveritySchema,
        merge_signal: zod_1.z.enum(["clean", "review", "block"]),
    }),
    claude_analysis: exports.ClaudeAnalysisSchema.optional(),
    comment_draft: zod_1.z.string().optional(),
    metadata: zod_1.z
        .object({
        execution_mode: zod_1.z.enum(["planned_only", "executed"]),
        replayed: zod_1.z.boolean().default(false),
        impact_source: zod_1.z.enum(["git_refs", "manual_diff", "none"]).default("none"),
    })
        .default({
        execution_mode: "planned_only",
        replayed: false,
        impact_source: "none",
    }),
});
