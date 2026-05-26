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
});
export type AffectedTestCandidate = z.infer<typeof AffectedTestCandidateSchema>;

export const ImpactAnalysisResultSchema = z.object({
  affectedTests: z.array(AffectedTestCandidateSchema),
  summary: z.record(z.unknown()).optional(),
  recommendations: z.union([z.array(z.string()), z.record(z.unknown())]).optional(),
  source: z.enum(["git_refs", "manual_diff", "none"]).default("none"),
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
