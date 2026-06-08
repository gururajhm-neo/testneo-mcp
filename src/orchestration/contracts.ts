import { z } from "zod";

export const SeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const WorkflowStatusSchema = z.enum([
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
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

export const StageSchema = z.enum(["tests", "visual", "lighthouse", "replay"]);
export type Stage = z.infer<typeof StageSchema>;

export const StageRunStatusSchema = z.enum(["queued", "running", "passed", "failed", "partial"]);
export type StageRunStatus = z.infer<typeof StageRunStatusSchema>;

export const ChangedFileSchema = z.object({
  path: z.string().min(1),
  status: z.enum(["added", "modified", "deleted", "renamed"]),
  additions: z.number().int().optional(),
  deletions: z.number().int().optional(),
  language: z.string().optional(),
  patch: z.string().optional(),
});
export type ChangedFile = z.infer<typeof ChangedFileSchema>;

export const ImpactedFlowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  relatedFiles: z.array(z.string()),
  relatedTestIds: z.array(z.number().int().positive()),
});
export type ImpactedFlow = z.infer<typeof ImpactedFlowSchema>;

export const ExecutionArtifactRefSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["screenshot", "visual_diff", "replay", "lighthouse", "console", "trace"]),
  name: z.string().min(1),
  url: z.string().min(1),
  contentType: z.string().optional(),
  flow: z.string().optional(),
  testId: z.number().int().positive().optional(),
  viewport: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type ExecutionArtifactRef = z.infer<typeof ExecutionArtifactRefSchema>;

export const StageRunSchema = z.object({
  stage: StageSchema,
  status: StageRunStatusSchema,
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  runId: z.string().optional(),
  executionIds: z.array(z.string()).optional(),
  dashboardUrl: z.string().optional(),
  rawResultRef: z.string().optional(),
});
export type StageRun = z.infer<typeof StageRunSchema>;

export const VerificationFindingSchema = z.object({
  id: z.string().min(1),
  source: z.enum(["test", "visual", "lighthouse", "replay", "console"]),
  status: z.enum(["passed", "warning", "failed"]),
  severity: SeveritySchema,
  blocking: z.boolean(),
  flow: z.string().min(1),
  title: z.string().min(1),
  issue: z.string().min(1),
  rootCauseHint: z.string().optional(),
  changedFileHints: z.array(z.string()),
  relatedTestIds: z.array(z.number().int().positive()),
  evidence: z.array(ExecutionArtifactRefSchema),
  replayUrl: z.string().optional(),
  visualRegression: z.boolean().optional(),
  lighthouseMetric: z.string().optional(),
  lighthouseScore: z.number().optional(),
  consoleErrors: z.array(z.string()).optional(),
  suggestedFixes: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
export type VerificationFinding = z.infer<typeof VerificationFindingSchema>;

export const ClaudeAnalysisSchema = z.object({
  summary: z.string().min(1),
  mergeRecommendation: z.enum(["merge", "merge_with_followup", "hold", "request_changes"]),
  confidence: z.number().min(0).max(1),
  rootCauses: z.array(
    z.object({
      findingId: z.string().min(1),
      probableCause: z.string().min(1),
      relatedFiles: z.array(z.string()),
      rationale: z.string().min(1),
      confidence: z.number().min(0).max(1),
    }),
  ),
  suggestedFixes: z.array(
    z.object({
      findingId: z.string().min(1),
      fix: z.string().min(1),
      files: z.array(z.string()),
      priority: z.enum(["now", "next"]),
    }),
  ),
  reviewComments: z.array(
    z.object({
      path: z.string().optional(),
      body: z.string().min(1),
      severity: SeveritySchema,
    }),
  ),
  // Engineering Memory risk factor — injected by DataDrivenClaudeAnalyzer when incident context present
  riskFactors: z.array(z.object({
    factor: z.string(),
    score: z.number().min(0).max(100),
    weight: z.number().min(0).max(1),
    explanation: z.string(),
  })).optional(),
});
export type ClaudeAnalysis = z.infer<typeof ClaudeAnalysisSchema>;

export const WorkflowContextSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("pr_validation"),
  status: WorkflowStatusSchema,
  correlationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  source: z.enum(["mcp", "github_action", "cli", "ide", "dashboard"]),
  projectId: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
  repository: z.object({
    provider: z.literal("github"),
    owner: z.string().min(1),
    name: z.string().min(1),
    prNumber: z.number().int().positive(),
    prUrl: z.string().optional(),
    baseSha: z.string().min(1),
    headSha: z.string().min(1),
  }),
  changes: z.object({
    changedFiles: z.array(ChangedFileSchema),
    impactedFlows: z.array(ImpactedFlowSchema),
  }),
  runs: z.object({
    tests: StageRunSchema.optional(),
    visual: StageRunSchema.optional(),
    lighthouse: StageRunSchema.optional(),
    replay: StageRunSchema.optional(),
  }),
  artifacts: z.array(ExecutionArtifactRefSchema),
  findings: z.array(VerificationFindingSchema),
  ai: ClaudeAnalysisSchema.optional(),
  suggestedFixes: z.array(z.string()),
  metadata: z.record(z.unknown()),
});
export type WorkflowContext = z.infer<typeof WorkflowContextSchema>;

export const WorkflowEventSchema = z.object({
  workflowId: z.string().min(1),
  type: z.string().min(1),
  stage: StageSchema.optional(),
  timestamp: z.string(),
  payload: z.unknown(),
});
export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>;

export const AffectedTestCandidateSchema = z.object({
  test_id: z.number().int().positive().optional(),
  test_name: z.string().optional(),
  function_name: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  impact_level: z.string().optional(),
  reason: z.string().optional(),
  // Historical risk signals enriched from TestRiskScore (Sprint 1)
  failure_rate_7d: z.number().min(0).max(1).optional(),
  failure_rate_30d: z.number().min(0).max(1).optional(),
  flakiness_score: z.number().min(0).max(1).optional(),
  recent_failure_count: z.number().int().min(0).optional(),
  // Component-level context enriched from TestFunctionMapping (Sprint 2)
  component_label: z.string().optional(),
  component_failure_rate_7d: z.number().min(0).max(1).optional(),
  // Sprint 3: blast radius provenance — how this test was discovered
  blast_source: z.enum(["direct", "changed_file", "transitive_d1", "transitive_d2", "transitive_d3", "transitive_d4"]).optional(),
  blast_depth: z.number().int().min(0).optional(),  // 0 = changed file, 1 = direct importer, etc.
  blast_file_path: z.string().optional(),           // which expanded file this test covers
});
export type AffectedTestCandidate = z.infer<typeof AffectedTestCandidateSchema>;

// Sprint 2: Component health entry — aggregated from TestRiskScore per component
// .nullish() = accepts null | undefined | value — API returns null for missing numerics
export const ComponentHealthEntrySchema = z.object({
  component: z.string(),
  failure_rate_7d: z.number().min(0).max(1).nullish(),
  failure_rate_30d: z.number().min(0).max(1).nullish(),
  flakiness_score: z.number().min(0).max(1).nullish(),
  total_tests: z.number().int().min(0).nullish(),
  tests_with_risk_data: z.number().int().min(0).nullish(),
  high_risk_tests: z.number().int().min(0).nullish(),
  risk_level: z.string().nullish(),  // "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN"
  trend: z.string().nullish(),        // "worsening" | "improving" | "stable" | "insufficient_data"
});
export type ComponentHealthEntry = z.infer<typeof ComponentHealthEntrySchema>;

// Sprint 3: A single file node in the transitive dependency blast radius
export const DependencyNodeSchema = z.object({
  file_path: z.string(),
  depth: z.number().int().min(1),        // 1 = direct importer, 2 = transitive, …
  imported_by: z.string(),               // immediate parent in BFS chain
  component_label: z.string().optional(),
  chain: z.array(z.string()),            // [changed_file, hop1, …, this_file]
});
export type DependencyNode = z.infer<typeof DependencyNodeSchema>;

// Sprint 3: Full dependency blast radius result attached to ImpactAnalysisResult
export const DependencyBlastSchema = z.object({
  changed_files: z.array(z.string()),
  expanded_files: z.array(z.string()),      // all transitively dependent files
  nodes: z.array(DependencyNodeSchema),
  direct_dependents: z.number().int().min(0),
  transitive_dependents: z.number().int().min(0),
  total_expanded: z.number().int().min(0),
  max_depth: z.number().int().min(0),
  affected_components: z.record(z.number()).optional(),  // {ComponentName: file_count}
  has_structure: z.boolean().optional(),
});
export type DependencyBlast = z.infer<typeof DependencyBlastSchema>;

// ─── Incident Context (Engineering Memory / Release Memory) ─────────────────

export const IncidentMatchSchema = z.object({
  match_id: z.string(),
  match_type: z.enum(["prior_validation", "failure_pattern", "resolution", "test_history"]),
  title: z.string(),
  description: z.string(),
  match_score: z.number().min(0).max(100),
  match_tier: z.enum(["none", "low", "medium", "high"]),
  component: z.string().optional(),
  workflow_id: z.string().optional(),
  pr_number: z.number().int().optional(),
  risk_level: z.string().optional(),
  risk_score: z.number().int().optional(),
  pattern_label: z.string().optional(),
  pattern_occurrences: z.number().int().optional(),
  resolution_action: z.string().optional(),
  root_cause: z.string().optional(),
  success_rate: z.number().min(0).max(1).optional(),
  cases_count: z.number().int().optional(),
  avg_resolve_minutes: z.number().int().optional(),
  occurred_at: z.string().optional(),
  related_test_ids: z.array(z.number().int()).optional(),
  overlapping_files: z.array(z.string()).optional(),
  resolved_by_name: z.string().optional(),
});
export type IncidentMatch = z.infer<typeof IncidentMatchSchema>;

export const IncidentContextSchema = z.object({
  contract_version: z.literal("incident_context.v1"),
  project_id: z.number().int().positive(),
  match_count: z.number().int().min(0),
  incident_match_score: z.number().min(0).max(100),
  match_tier: z.enum(["none", "low", "medium", "high"]),
  matches: z.array(IncidentMatchSchema),
  top_resolution: z
    .object({
      action: z.string(),
      root_cause: z.string().optional(),
      success_rate: z.number().min(0).max(1).optional(),
      cases_count: z.number().int().min(1),
      avg_resolve_minutes: z.number().int().optional(),
    })
    .optional(),
  insight: z.string(),
});
export type IncidentContext = z.infer<typeof IncidentContextSchema>;

export const ImpactAnalysisResultSchema = z.object({
  affectedTests: z.array(AffectedTestCandidateSchema),
  summary: z.record(z.unknown()).optional(),
  recommendations: z.union([z.array(z.string()), z.record(z.unknown())]).optional(),
  source: z.enum(["git_refs", "manual_diff", "none"]).default("none"),
  // Sprint 2: project-level component health, fetched alongside risk signals
  componentHealth: z.array(ComponentHealthEntrySchema).optional(),
  // Sprint 3: transitive dependency blast radius
  dependencyBlast: DependencyBlastSchema.optional(),
});
export type ImpactAnalysisResult = z.infer<typeof ImpactAnalysisResultSchema>;

export const ValidatePrRequestSchema = z.object({
  project_id: z.number().int().positive(),
  repository: z.object({
    owner: z.string().min(1),
    name: z.string().min(1),
  }),
  pull_request: z.object({
    number: z.number().int().positive(),
    url: z.string().url().optional(),
  }),
  git: z.object({
    base_sha: z.string().min(7),
    head_sha: z.string().min(7),
    diff_content: z.string().optional(),
    changed_files: z.array(ChangedFileSchema).optional(),
  }),
  execution: z
    .object({
      run_impacted_tests: z.boolean().default(true),
      run_visual_regression: z.boolean().default(true),
      run_lighthouse: z.boolean().default(true),
      capture_replay: z.boolean().default(true),
      max_parallelism: z.number().int().min(1).max(8).default(4),
      mode: z
        .enum(["local", "cloud"])
        .optional()
        .describe("Execution mode override. Falls back to TESTNEO_MCP_DEFAULT_EXECUTION_MODE."),
      platform: z
        .string()
        .optional()
        .describe(
          "Cloud/local platform override (e.g. saucelabs, browserstack, local). " +
            "Falls back to TESTNEO_MCP_DEFAULT_EXECUTION_PLATFORM.",
        ),
    })
    .default({}),
  output: z
    .object({
      include_comment_draft: z.boolean().default(true),
      publish_comment: z.boolean().default(false),
    })
    .default({}),
  idempotency_key: z.string().min(8).max(128).optional(),
  confirm: z.boolean().default(false),
});
export type ValidatePrRequest = z.infer<typeof ValidatePrRequestSchema>;

export const ValidatePrResponseSchema = z.object({
  contract_version: z.literal("pr_validation.v1"),
  workflow_id: z.string().min(1),
  status: z.enum(["passed", "failed", "partial"]),
  project_id: z.number().int().positive(),
  repository: z.object({
    owner: z.string().min(1),
    name: z.string().min(1),
    pr_number: z.number().int().positive(),
    base_sha: z.string().min(1),
    head_sha: z.string().min(1),
  }),
  impact_summary: z.object({
    changed_files: z.number().int().min(0),
    impacted_flows: z.number().int().min(0),
    impacted_tests: z.number().int().min(0),
  }),
  execution_summary: z.object({
    tests: StageRunSchema.optional(),
    visual: StageRunSchema.optional(),
    lighthouse: StageRunSchema.optional(),
    replay: StageRunSchema.optional(),
  }),
  findings: z.array(VerificationFindingSchema),
  ai_ready_summary: z.object({
    blocking_count: z.number().int().min(0),
    warning_count: z.number().int().min(0),
    passed_count: z.number().int().min(0),
    highest_severity: SeveritySchema,
    merge_signal: z.enum(["clean", "review", "block"]),
    risk_score: z.number().min(0).max(100),
    risk_level: z.enum(["PASS", "WARN", "BLOCK"]),
    risk_factors: z.array(z.object({
      factor: z.string(),
      score: z.number().min(0).max(100),
      weight: z.number().min(0).max(1),
      explanation: z.string(),
    })),
    // Sprint 2: component health snapshot at time of validation
    component_health: z.array(ComponentHealthEntrySchema).optional(),
    // Sprint 3: dependency blast radius snapshot at time of validation
    dependency_blast: DependencyBlastSchema.optional(),
    // Sprint 3: blast→test bridge summary (gap metric)
    blast_test_summary: z.object({
      total_blast_tests: z.number().int().min(0),
      tests_from_changed_files: z.number().int().min(0),
      tests_from_transitive: z.number().int().min(0),
      high_risk_transitive: z.number().int().min(0).optional(),
      unique_components: z.number().int().min(0).optional(),
    }).optional(),
    // Engineering Memory: prior incidents, patterns, resolutions
    incident_context: IncidentContextSchema.optional(),
  }),
  claude_analysis: ClaudeAnalysisSchema.optional(),
  comment_draft: z.string().optional(),
  metadata: z
    .object({
      execution_mode: z.enum(["planned_only", "executed"]),
      replayed: z.boolean().default(false),
      impact_source: z.enum(["git_refs", "manual_diff", "none"]).default("none"),
    })
    .default({
      execution_mode: "planned_only",
      replayed: false,
      impact_source: "none",
    }),
});
export type ValidatePrResponse = z.infer<typeof ValidatePrResponseSchema>;
