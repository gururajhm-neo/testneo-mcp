"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidatePrResponseSchema = exports.ValidatePrRequestSchema = exports.ImpactAnalysisResultSchema = exports.IncidentContextSchema = exports.IncidentMatchSchema = exports.DependencyBlastSchema = exports.DependencyNodeSchema = exports.ComponentHealthEntrySchema = exports.AffectedTestCandidateSchema = exports.WorkflowEventSchema = exports.WorkflowContextSchema = exports.ClaudeAnalysisSchema = exports.VerificationFindingSchema = exports.StageRunSchema = exports.ExecutionArtifactRefSchema = exports.ImpactedFlowSchema = exports.ChangedFileSchema = exports.StageRunStatusSchema = exports.StageSchema = exports.WorkflowStatusSchema = exports.SeveritySchema = void 0;
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
    // Engineering Memory risk factor — injected by DataDrivenClaudeAnalyzer when incident context present
    riskFactors: zod_1.z.array(zod_1.z.object({
        factor: zod_1.z.string(),
        score: zod_1.z.number().min(0).max(100),
        weight: zod_1.z.number().min(0).max(1),
        explanation: zod_1.z.string(),
    })).optional(),
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
    // Historical risk signals enriched from TestRiskScore (Sprint 1)
    failure_rate_7d: zod_1.z.number().min(0).max(1).optional(),
    failure_rate_30d: zod_1.z.number().min(0).max(1).optional(),
    flakiness_score: zod_1.z.number().min(0).max(1).optional(),
    recent_failure_count: zod_1.z.number().int().min(0).optional(),
    // Component-level context enriched from TestFunctionMapping (Sprint 2)
    component_label: zod_1.z.string().optional(),
    component_failure_rate_7d: zod_1.z.number().min(0).max(1).optional(),
    // Sprint 3: blast radius provenance — how this test was discovered
    blast_source: zod_1.z.enum(["direct", "changed_file", "transitive_d1", "transitive_d2", "transitive_d3", "transitive_d4"]).optional(),
    blast_depth: zod_1.z.number().int().min(0).optional(), // 0 = changed file, 1 = direct importer, etc.
    blast_file_path: zod_1.z.string().optional(), // which expanded file this test covers
});
// Sprint 2: Component health entry — aggregated from TestRiskScore per component
// .nullish() = accepts null | undefined | value — API returns null for missing numerics
exports.ComponentHealthEntrySchema = zod_1.z.object({
    component: zod_1.z.string(),
    failure_rate_7d: zod_1.z.number().min(0).max(1).nullish(),
    failure_rate_30d: zod_1.z.number().min(0).max(1).nullish(),
    flakiness_score: zod_1.z.number().min(0).max(1).nullish(),
    total_tests: zod_1.z.number().int().min(0).nullish(),
    tests_with_risk_data: zod_1.z.number().int().min(0).nullish(),
    high_risk_tests: zod_1.z.number().int().min(0).nullish(),
    risk_level: zod_1.z.string().nullish(), // "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN"
    trend: zod_1.z.string().nullish(), // "worsening" | "improving" | "stable" | "insufficient_data"
});
// Sprint 3: A single file node in the transitive dependency blast radius
exports.DependencyNodeSchema = zod_1.z.object({
    file_path: zod_1.z.string(),
    depth: zod_1.z.number().int().min(1), // 1 = direct importer, 2 = transitive, …
    imported_by: zod_1.z.string(), // immediate parent in BFS chain
    component_label: zod_1.z.string().optional(),
    chain: zod_1.z.array(zod_1.z.string()), // [changed_file, hop1, …, this_file]
});
// Sprint 3: Full dependency blast radius result attached to ImpactAnalysisResult
exports.DependencyBlastSchema = zod_1.z.object({
    changed_files: zod_1.z.array(zod_1.z.string()),
    expanded_files: zod_1.z.array(zod_1.z.string()), // all transitively dependent files
    nodes: zod_1.z.array(exports.DependencyNodeSchema),
    direct_dependents: zod_1.z.number().int().min(0),
    transitive_dependents: zod_1.z.number().int().min(0),
    total_expanded: zod_1.z.number().int().min(0),
    max_depth: zod_1.z.number().int().min(0),
    affected_components: zod_1.z.record(zod_1.z.number()).optional(), // {ComponentName: file_count}
    has_structure: zod_1.z.boolean().optional(),
});
// ─── Incident Context (Engineering Memory / Release Memory) ─────────────────
exports.IncidentMatchSchema = zod_1.z.object({
    match_id: zod_1.z.string(),
    match_type: zod_1.z.enum(["prior_validation", "failure_pattern", "resolution", "test_history"]),
    title: zod_1.z.string(),
    description: zod_1.z.string(),
    match_score: zod_1.z.number().min(0).max(100),
    match_tier: zod_1.z.enum(["none", "low", "medium", "high"]),
    component: zod_1.z.string().optional(),
    workflow_id: zod_1.z.string().optional(),
    pr_number: zod_1.z.number().int().optional(),
    risk_level: zod_1.z.string().optional(),
    risk_score: zod_1.z.number().int().optional(),
    pattern_label: zod_1.z.string().optional(),
    pattern_occurrences: zod_1.z.number().int().optional(),
    resolution_action: zod_1.z.string().optional(),
    root_cause: zod_1.z.string().optional(),
    success_rate: zod_1.z.number().min(0).max(1).optional(),
    cases_count: zod_1.z.number().int().optional(),
    avg_resolve_minutes: zod_1.z.number().int().optional(),
    occurred_at: zod_1.z.string().optional(),
    related_test_ids: zod_1.z.array(zod_1.z.number().int()).optional(),
    overlapping_files: zod_1.z.array(zod_1.z.string()).optional(),
    resolved_by_name: zod_1.z.string().optional(),
});
exports.IncidentContextSchema = zod_1.z.object({
    contract_version: zod_1.z.literal("incident_context.v1"),
    project_id: zod_1.z.number().int().positive(),
    match_count: zod_1.z.number().int().min(0),
    incident_match_score: zod_1.z.number().min(0).max(100),
    match_tier: zod_1.z.enum(["none", "low", "medium", "high"]),
    matches: zod_1.z.array(exports.IncidentMatchSchema),
    top_resolution: zod_1.z
        .object({
        action: zod_1.z.string(),
        root_cause: zod_1.z.string().optional(),
        success_rate: zod_1.z.number().min(0).max(1).optional(),
        cases_count: zod_1.z.number().int().min(1),
        avg_resolve_minutes: zod_1.z.number().int().optional(),
    })
        .optional(),
    insight: zod_1.z.string(),
});
exports.ImpactAnalysisResultSchema = zod_1.z.object({
    affectedTests: zod_1.z.array(exports.AffectedTestCandidateSchema),
    summary: zod_1.z.record(zod_1.z.unknown()).optional(),
    recommendations: zod_1.z.union([zod_1.z.array(zod_1.z.string()), zod_1.z.record(zod_1.z.unknown())]).optional(),
    source: zod_1.z.enum(["git_refs", "manual_diff", "none"]).default("none"),
    // Sprint 2: project-level component health, fetched alongside risk signals
    componentHealth: zod_1.z.array(exports.ComponentHealthEntrySchema).optional(),
    // Sprint 3: transitive dependency blast radius
    dependencyBlast: exports.DependencyBlastSchema.optional(),
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
        mode: zod_1.z
            .enum(["local", "cloud"])
            .optional()
            .describe("Execution mode override. Falls back to TESTNEO_MCP_DEFAULT_EXECUTION_MODE."),
        platform: zod_1.z
            .string()
            .optional()
            .describe("Cloud/local platform override (e.g. saucelabs, browserstack, local). " +
            "Falls back to TESTNEO_MCP_DEFAULT_EXECUTION_PLATFORM."),
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
        risk_score: zod_1.z.number().min(0).max(100),
        risk_level: zod_1.z.enum(["PASS", "WARN", "BLOCK"]),
        risk_factors: zod_1.z.array(zod_1.z.object({
            factor: zod_1.z.string(),
            score: zod_1.z.number().min(0).max(100),
            weight: zod_1.z.number().min(0).max(1),
            explanation: zod_1.z.string(),
        })),
        // Sprint 2: component health snapshot at time of validation
        component_health: zod_1.z.array(exports.ComponentHealthEntrySchema).optional(),
        // Sprint 3: dependency blast radius snapshot at time of validation
        dependency_blast: exports.DependencyBlastSchema.optional(),
        // Sprint 3: blast→test bridge summary (gap metric)
        blast_test_summary: zod_1.z.object({
            total_blast_tests: zod_1.z.number().int().min(0),
            tests_from_changed_files: zod_1.z.number().int().min(0),
            tests_from_transitive: zod_1.z.number().int().min(0),
            high_risk_transitive: zod_1.z.number().int().min(0).optional(),
            unique_components: zod_1.z.number().int().min(0).optional(),
        }).optional(),
        // Engineering Memory: prior incidents, patterns, resolutions
        incident_context: exports.IncidentContextSchema.optional(),
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
