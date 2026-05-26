import { z } from "zod";
export declare const SeveritySchema: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
export type Severity = z.infer<typeof SeveritySchema>;
export declare const WorkflowStatusSchema: z.ZodEnum<["initialized", "planning", "executing", "aggregating", "publishing", "analyzing", "commenting", "completed", "partial_failed", "failed", "cancelled"]>;
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;
export declare const StageSchema: z.ZodEnum<["tests", "visual", "lighthouse", "replay"]>;
export type Stage = z.infer<typeof StageSchema>;
export declare const StageRunStatusSchema: z.ZodEnum<["queued", "running", "passed", "failed", "partial"]>;
export type StageRunStatus = z.infer<typeof StageRunStatusSchema>;
export declare const ChangedFileSchema: z.ZodObject<{
    path: z.ZodString;
    status: z.ZodEnum<["added", "modified", "deleted", "renamed"]>;
    additions: z.ZodOptional<z.ZodNumber>;
    deletions: z.ZodOptional<z.ZodNumber>;
    language: z.ZodOptional<z.ZodString>;
    patch: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "added" | "modified" | "deleted" | "renamed";
    path: string;
    additions?: number | undefined;
    deletions?: number | undefined;
    language?: string | undefined;
    patch?: string | undefined;
}, {
    status: "added" | "modified" | "deleted" | "renamed";
    path: string;
    additions?: number | undefined;
    deletions?: number | undefined;
    language?: string | undefined;
    patch?: string | undefined;
}>;
export type ChangedFile = z.infer<typeof ChangedFileSchema>;
export declare const ImpactedFlowSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    confidence: z.ZodNumber;
    reason: z.ZodString;
    relatedFiles: z.ZodArray<z.ZodString, "many">;
    relatedTestIds: z.ZodArray<z.ZodNumber, "many">;
}, "strip", z.ZodTypeAny, {
    reason: string;
    id: string;
    name: string;
    confidence: number;
    relatedFiles: string[];
    relatedTestIds: number[];
}, {
    reason: string;
    id: string;
    name: string;
    confidence: number;
    relatedFiles: string[];
    relatedTestIds: number[];
}>;
export type ImpactedFlow = z.infer<typeof ImpactedFlowSchema>;
export declare const ExecutionArtifactRefSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["screenshot", "visual_diff", "replay", "lighthouse", "console", "trace"]>;
    name: z.ZodString;
    url: z.ZodString;
    contentType: z.ZodOptional<z.ZodString>;
    flow: z.ZodOptional<z.ZodString>;
    testId: z.ZodOptional<z.ZodNumber>;
    viewport: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    url: string;
    id: string;
    name: string;
    kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
    contentType?: string | undefined;
    flow?: string | undefined;
    testId?: number | undefined;
    viewport?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    url: string;
    id: string;
    name: string;
    kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
    contentType?: string | undefined;
    flow?: string | undefined;
    testId?: number | undefined;
    viewport?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
export type ExecutionArtifactRef = z.infer<typeof ExecutionArtifactRefSchema>;
export declare const StageRunSchema: z.ZodObject<{
    stage: z.ZodEnum<["tests", "visual", "lighthouse", "replay"]>;
    status: z.ZodEnum<["queued", "running", "passed", "failed", "partial"]>;
    startedAt: z.ZodOptional<z.ZodString>;
    completedAt: z.ZodOptional<z.ZodString>;
    runId: z.ZodOptional<z.ZodString>;
    executionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    dashboardUrl: z.ZodOptional<z.ZodString>;
    rawResultRef: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "queued" | "running" | "passed" | "failed" | "partial";
    stage: "replay" | "tests" | "visual" | "lighthouse";
    startedAt?: string | undefined;
    completedAt?: string | undefined;
    runId?: string | undefined;
    executionIds?: string[] | undefined;
    dashboardUrl?: string | undefined;
    rawResultRef?: string | undefined;
}, {
    status: "queued" | "running" | "passed" | "failed" | "partial";
    stage: "replay" | "tests" | "visual" | "lighthouse";
    startedAt?: string | undefined;
    completedAt?: string | undefined;
    runId?: string | undefined;
    executionIds?: string[] | undefined;
    dashboardUrl?: string | undefined;
    rawResultRef?: string | undefined;
}>;
export type StageRun = z.infer<typeof StageRunSchema>;
export declare const VerificationFindingSchema: z.ZodObject<{
    id: z.ZodString;
    source: z.ZodEnum<["test", "visual", "lighthouse", "replay", "console"]>;
    status: z.ZodEnum<["passed", "warning", "failed"]>;
    severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
    blocking: z.ZodBoolean;
    flow: z.ZodString;
    title: z.ZodString;
    issue: z.ZodString;
    rootCauseHint: z.ZodOptional<z.ZodString>;
    changedFileHints: z.ZodArray<z.ZodString, "many">;
    relatedTestIds: z.ZodArray<z.ZodNumber, "many">;
    evidence: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["screenshot", "visual_diff", "replay", "lighthouse", "console", "trace"]>;
        name: z.ZodString;
        url: z.ZodString;
        contentType: z.ZodOptional<z.ZodString>;
        flow: z.ZodOptional<z.ZodString>;
        testId: z.ZodOptional<z.ZodNumber>;
        viewport: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        id: string;
        name: string;
        kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
        contentType?: string | undefined;
        flow?: string | undefined;
        testId?: number | undefined;
        viewport?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }, {
        url: string;
        id: string;
        name: string;
        kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
        contentType?: string | undefined;
        flow?: string | undefined;
        testId?: number | undefined;
        viewport?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }>, "many">;
    replayUrl: z.ZodOptional<z.ZodString>;
    visualRegression: z.ZodOptional<z.ZodBoolean>;
    lighthouseMetric: z.ZodOptional<z.ZodString>;
    lighthouseScore: z.ZodOptional<z.ZodNumber>;
    consoleErrors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    suggestedFixes: z.ZodArray<z.ZodString, "many">;
    confidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "passed" | "failed" | "warning";
    id: string;
    confidence: number;
    relatedTestIds: number[];
    flow: string;
    source: "replay" | "visual" | "lighthouse" | "console" | "test";
    severity: "high" | "medium" | "low" | "critical" | "info";
    blocking: boolean;
    title: string;
    issue: string;
    changedFileHints: string[];
    evidence: {
        url: string;
        id: string;
        name: string;
        kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
        contentType?: string | undefined;
        flow?: string | undefined;
        testId?: number | undefined;
        viewport?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }[];
    suggestedFixes: string[];
    rootCauseHint?: string | undefined;
    replayUrl?: string | undefined;
    visualRegression?: boolean | undefined;
    lighthouseMetric?: string | undefined;
    lighthouseScore?: number | undefined;
    consoleErrors?: string[] | undefined;
}, {
    status: "passed" | "failed" | "warning";
    id: string;
    confidence: number;
    relatedTestIds: number[];
    flow: string;
    source: "replay" | "visual" | "lighthouse" | "console" | "test";
    severity: "high" | "medium" | "low" | "critical" | "info";
    blocking: boolean;
    title: string;
    issue: string;
    changedFileHints: string[];
    evidence: {
        url: string;
        id: string;
        name: string;
        kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
        contentType?: string | undefined;
        flow?: string | undefined;
        testId?: number | undefined;
        viewport?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }[];
    suggestedFixes: string[];
    rootCauseHint?: string | undefined;
    replayUrl?: string | undefined;
    visualRegression?: boolean | undefined;
    lighthouseMetric?: string | undefined;
    lighthouseScore?: number | undefined;
    consoleErrors?: string[] | undefined;
}>;
export type VerificationFinding = z.infer<typeof VerificationFindingSchema>;
export declare const ClaudeAnalysisSchema: z.ZodObject<{
    summary: z.ZodString;
    mergeRecommendation: z.ZodEnum<["merge", "merge_with_followup", "hold", "request_changes"]>;
    confidence: z.ZodNumber;
    rootCauses: z.ZodArray<z.ZodObject<{
        findingId: z.ZodString;
        probableCause: z.ZodString;
        relatedFiles: z.ZodArray<z.ZodString, "many">;
        rationale: z.ZodString;
        confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        relatedFiles: string[];
        findingId: string;
        probableCause: string;
        rationale: string;
    }, {
        confidence: number;
        relatedFiles: string[];
        findingId: string;
        probableCause: string;
        rationale: string;
    }>, "many">;
    suggestedFixes: z.ZodArray<z.ZodObject<{
        findingId: z.ZodString;
        fix: z.ZodString;
        files: z.ZodArray<z.ZodString, "many">;
        priority: z.ZodEnum<["now", "next"]>;
    }, "strip", z.ZodTypeAny, {
        findingId: string;
        fix: string;
        files: string[];
        priority: "now" | "next";
    }, {
        findingId: string;
        fix: string;
        files: string[];
        priority: "now" | "next";
    }>, "many">;
    reviewComments: z.ZodArray<z.ZodObject<{
        path: z.ZodOptional<z.ZodString>;
        body: z.ZodString;
        severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
    }, "strip", z.ZodTypeAny, {
        body: string;
        severity: "high" | "medium" | "low" | "critical" | "info";
        path?: string | undefined;
    }, {
        body: string;
        severity: "high" | "medium" | "low" | "critical" | "info";
        path?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    suggestedFixes: {
        findingId: string;
        fix: string;
        files: string[];
        priority: "now" | "next";
    }[];
    summary: string;
    mergeRecommendation: "merge" | "merge_with_followup" | "hold" | "request_changes";
    rootCauses: {
        confidence: number;
        relatedFiles: string[];
        findingId: string;
        probableCause: string;
        rationale: string;
    }[];
    reviewComments: {
        body: string;
        severity: "high" | "medium" | "low" | "critical" | "info";
        path?: string | undefined;
    }[];
}, {
    confidence: number;
    suggestedFixes: {
        findingId: string;
        fix: string;
        files: string[];
        priority: "now" | "next";
    }[];
    summary: string;
    mergeRecommendation: "merge" | "merge_with_followup" | "hold" | "request_changes";
    rootCauses: {
        confidence: number;
        relatedFiles: string[];
        findingId: string;
        probableCause: string;
        rationale: string;
    }[];
    reviewComments: {
        body: string;
        severity: "high" | "medium" | "low" | "critical" | "info";
        path?: string | undefined;
    }[];
}>;
export type ClaudeAnalysis = z.infer<typeof ClaudeAnalysisSchema>;
export declare const WorkflowContextSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodLiteral<"pr_validation">;
    status: z.ZodEnum<["initialized", "planning", "executing", "aggregating", "publishing", "analyzing", "commenting", "completed", "partial_failed", "failed", "cancelled"]>;
    correlationId: z.ZodString;
    idempotencyKey: z.ZodString;
    source: z.ZodEnum<["mcp", "github_action", "cli", "ide", "dashboard"]>;
    projectId: z.ZodNumber;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    repository: z.ZodObject<{
        provider: z.ZodLiteral<"github">;
        owner: z.ZodString;
        name: z.ZodString;
        prNumber: z.ZodNumber;
        prUrl: z.ZodOptional<z.ZodString>;
        baseSha: z.ZodString;
        headSha: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        provider: "github";
        owner: string;
        prNumber: number;
        baseSha: string;
        headSha: string;
        prUrl?: string | undefined;
    }, {
        name: string;
        provider: "github";
        owner: string;
        prNumber: number;
        baseSha: string;
        headSha: string;
        prUrl?: string | undefined;
    }>;
    changes: z.ZodObject<{
        changedFiles: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            status: z.ZodEnum<["added", "modified", "deleted", "renamed"]>;
            additions: z.ZodOptional<z.ZodNumber>;
            deletions: z.ZodOptional<z.ZodNumber>;
            language: z.ZodOptional<z.ZodString>;
            patch: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "added" | "modified" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }, {
            status: "added" | "modified" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }>, "many">;
        impactedFlows: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            confidence: z.ZodNumber;
            reason: z.ZodString;
            relatedFiles: z.ZodArray<z.ZodString, "many">;
            relatedTestIds: z.ZodArray<z.ZodNumber, "many">;
        }, "strip", z.ZodTypeAny, {
            reason: string;
            id: string;
            name: string;
            confidence: number;
            relatedFiles: string[];
            relatedTestIds: number[];
        }, {
            reason: string;
            id: string;
            name: string;
            confidence: number;
            relatedFiles: string[];
            relatedTestIds: number[];
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        changedFiles: {
            status: "added" | "modified" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }[];
        impactedFlows: {
            reason: string;
            id: string;
            name: string;
            confidence: number;
            relatedFiles: string[];
            relatedTestIds: number[];
        }[];
    }, {
        changedFiles: {
            status: "added" | "modified" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }[];
        impactedFlows: {
            reason: string;
            id: string;
            name: string;
            confidence: number;
            relatedFiles: string[];
            relatedTestIds: number[];
        }[];
    }>;
    runs: z.ZodObject<{
        tests: z.ZodOptional<z.ZodObject<{
            stage: z.ZodEnum<["tests", "visual", "lighthouse", "replay"]>;
            status: z.ZodEnum<["queued", "running", "passed", "failed", "partial"]>;
            startedAt: z.ZodOptional<z.ZodString>;
            completedAt: z.ZodOptional<z.ZodString>;
            runId: z.ZodOptional<z.ZodString>;
            executionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            dashboardUrl: z.ZodOptional<z.ZodString>;
            rawResultRef: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }, {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }>>;
        visual: z.ZodOptional<z.ZodObject<{
            stage: z.ZodEnum<["tests", "visual", "lighthouse", "replay"]>;
            status: z.ZodEnum<["queued", "running", "passed", "failed", "partial"]>;
            startedAt: z.ZodOptional<z.ZodString>;
            completedAt: z.ZodOptional<z.ZodString>;
            runId: z.ZodOptional<z.ZodString>;
            executionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            dashboardUrl: z.ZodOptional<z.ZodString>;
            rawResultRef: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }, {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }>>;
        lighthouse: z.ZodOptional<z.ZodObject<{
            stage: z.ZodEnum<["tests", "visual", "lighthouse", "replay"]>;
            status: z.ZodEnum<["queued", "running", "passed", "failed", "partial"]>;
            startedAt: z.ZodOptional<z.ZodString>;
            completedAt: z.ZodOptional<z.ZodString>;
            runId: z.ZodOptional<z.ZodString>;
            executionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            dashboardUrl: z.ZodOptional<z.ZodString>;
            rawResultRef: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }, {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }>>;
        replay: z.ZodOptional<z.ZodObject<{
            stage: z.ZodEnum<["tests", "visual", "lighthouse", "replay"]>;
            status: z.ZodEnum<["queued", "running", "passed", "failed", "partial"]>;
            startedAt: z.ZodOptional<z.ZodString>;
            completedAt: z.ZodOptional<z.ZodString>;
            runId: z.ZodOptional<z.ZodString>;
            executionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            dashboardUrl: z.ZodOptional<z.ZodString>;
            rawResultRef: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }, {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        replay?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        tests?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        visual?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        lighthouse?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
    }, {
        replay?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        tests?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        visual?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        lighthouse?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
    }>;
    artifacts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["screenshot", "visual_diff", "replay", "lighthouse", "console", "trace"]>;
        name: z.ZodString;
        url: z.ZodString;
        contentType: z.ZodOptional<z.ZodString>;
        flow: z.ZodOptional<z.ZodString>;
        testId: z.ZodOptional<z.ZodNumber>;
        viewport: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        id: string;
        name: string;
        kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
        contentType?: string | undefined;
        flow?: string | undefined;
        testId?: number | undefined;
        viewport?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }, {
        url: string;
        id: string;
        name: string;
        kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
        contentType?: string | undefined;
        flow?: string | undefined;
        testId?: number | undefined;
        viewport?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }>, "many">;
    findings: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        source: z.ZodEnum<["test", "visual", "lighthouse", "replay", "console"]>;
        status: z.ZodEnum<["passed", "warning", "failed"]>;
        severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
        blocking: z.ZodBoolean;
        flow: z.ZodString;
        title: z.ZodString;
        issue: z.ZodString;
        rootCauseHint: z.ZodOptional<z.ZodString>;
        changedFileHints: z.ZodArray<z.ZodString, "many">;
        relatedTestIds: z.ZodArray<z.ZodNumber, "many">;
        evidence: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["screenshot", "visual_diff", "replay", "lighthouse", "console", "trace"]>;
            name: z.ZodString;
            url: z.ZodString;
            contentType: z.ZodOptional<z.ZodString>;
            flow: z.ZodOptional<z.ZodString>;
            testId: z.ZodOptional<z.ZodNumber>;
            viewport: z.ZodOptional<z.ZodString>;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            id: string;
            name: string;
            kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
            contentType?: string | undefined;
            flow?: string | undefined;
            testId?: number | undefined;
            viewport?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
        }, {
            url: string;
            id: string;
            name: string;
            kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
            contentType?: string | undefined;
            flow?: string | undefined;
            testId?: number | undefined;
            viewport?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
        }>, "many">;
        replayUrl: z.ZodOptional<z.ZodString>;
        visualRegression: z.ZodOptional<z.ZodBoolean>;
        lighthouseMetric: z.ZodOptional<z.ZodString>;
        lighthouseScore: z.ZodOptional<z.ZodNumber>;
        consoleErrors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        suggestedFixes: z.ZodArray<z.ZodString, "many">;
        confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "passed" | "failed" | "warning";
        id: string;
        confidence: number;
        relatedTestIds: number[];
        flow: string;
        source: "replay" | "visual" | "lighthouse" | "console" | "test";
        severity: "high" | "medium" | "low" | "critical" | "info";
        blocking: boolean;
        title: string;
        issue: string;
        changedFileHints: string[];
        evidence: {
            url: string;
            id: string;
            name: string;
            kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
            contentType?: string | undefined;
            flow?: string | undefined;
            testId?: number | undefined;
            viewport?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
        }[];
        suggestedFixes: string[];
        rootCauseHint?: string | undefined;
        replayUrl?: string | undefined;
        visualRegression?: boolean | undefined;
        lighthouseMetric?: string | undefined;
        lighthouseScore?: number | undefined;
        consoleErrors?: string[] | undefined;
    }, {
        status: "passed" | "failed" | "warning";
        id: string;
        confidence: number;
        relatedTestIds: number[];
        flow: string;
        source: "replay" | "visual" | "lighthouse" | "console" | "test";
        severity: "high" | "medium" | "low" | "critical" | "info";
        blocking: boolean;
        title: string;
        issue: string;
        changedFileHints: string[];
        evidence: {
            url: string;
            id: string;
            name: string;
            kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
            contentType?: string | undefined;
            flow?: string | undefined;
            testId?: number | undefined;
            viewport?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
        }[];
        suggestedFixes: string[];
        rootCauseHint?: string | undefined;
        replayUrl?: string | undefined;
        visualRegression?: boolean | undefined;
        lighthouseMetric?: string | undefined;
        lighthouseScore?: number | undefined;
        consoleErrors?: string[] | undefined;
    }>, "many">;
    ai: z.ZodOptional<z.ZodObject<{
        summary: z.ZodString;
        mergeRecommendation: z.ZodEnum<["merge", "merge_with_followup", "hold", "request_changes"]>;
        confidence: z.ZodNumber;
        rootCauses: z.ZodArray<z.ZodObject<{
            findingId: z.ZodString;
            probableCause: z.ZodString;
            relatedFiles: z.ZodArray<z.ZodString, "many">;
            rationale: z.ZodString;
            confidence: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            confidence: number;
            relatedFiles: string[];
            findingId: string;
            probableCause: string;
            rationale: string;
        }, {
            confidence: number;
            relatedFiles: string[];
            findingId: string;
            probableCause: string;
            rationale: string;
        }>, "many">;
        suggestedFixes: z.ZodArray<z.ZodObject<{
            findingId: z.ZodString;
            fix: z.ZodString;
            files: z.ZodArray<z.ZodString, "many">;
            priority: z.ZodEnum<["now", "next"]>;
        }, "strip", z.ZodTypeAny, {
            findingId: string;
            fix: string;
            files: string[];
            priority: "now" | "next";
        }, {
            findingId: string;
            fix: string;
            files: string[];
            priority: "now" | "next";
        }>, "many">;
        reviewComments: z.ZodArray<z.ZodObject<{
            path: z.ZodOptional<z.ZodString>;
            body: z.ZodString;
            severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
        }, "strip", z.ZodTypeAny, {
            body: string;
            severity: "high" | "medium" | "low" | "critical" | "info";
            path?: string | undefined;
        }, {
            body: string;
            severity: "high" | "medium" | "low" | "critical" | "info";
            path?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        suggestedFixes: {
            findingId: string;
            fix: string;
            files: string[];
            priority: "now" | "next";
        }[];
        summary: string;
        mergeRecommendation: "merge" | "merge_with_followup" | "hold" | "request_changes";
        rootCauses: {
            confidence: number;
            relatedFiles: string[];
            findingId: string;
            probableCause: string;
            rationale: string;
        }[];
        reviewComments: {
            body: string;
            severity: "high" | "medium" | "low" | "critical" | "info";
            path?: string | undefined;
        }[];
    }, {
        confidence: number;
        suggestedFixes: {
            findingId: string;
            fix: string;
            files: string[];
            priority: "now" | "next";
        }[];
        summary: string;
        mergeRecommendation: "merge" | "merge_with_followup" | "hold" | "request_changes";
        rootCauses: {
            confidence: number;
            relatedFiles: string[];
            findingId: string;
            probableCause: string;
            rationale: string;
        }[];
        reviewComments: {
            body: string;
            severity: "high" | "medium" | "low" | "critical" | "info";
            path?: string | undefined;
        }[];
    }>>;
    suggestedFixes: z.ZodArray<z.ZodString, "many">;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    status: "failed" | "cancelled" | "completed" | "executing" | "initialized" | "planning" | "aggregating" | "publishing" | "analyzing" | "commenting" | "partial_failed";
    projectId: number;
    id: string;
    kind: "pr_validation";
    metadata: Record<string, unknown>;
    source: "mcp" | "github_action" | "cli" | "ide" | "dashboard";
    suggestedFixes: string[];
    correlationId: string;
    idempotencyKey: string;
    createdAt: string;
    updatedAt: string;
    repository: {
        name: string;
        provider: "github";
        owner: string;
        prNumber: number;
        baseSha: string;
        headSha: string;
        prUrl?: string | undefined;
    };
    changes: {
        changedFiles: {
            status: "added" | "modified" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }[];
        impactedFlows: {
            reason: string;
            id: string;
            name: string;
            confidence: number;
            relatedFiles: string[];
            relatedTestIds: number[];
        }[];
    };
    runs: {
        replay?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        tests?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        visual?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        lighthouse?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
    };
    artifacts: {
        url: string;
        id: string;
        name: string;
        kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
        contentType?: string | undefined;
        flow?: string | undefined;
        testId?: number | undefined;
        viewport?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }[];
    findings: {
        status: "passed" | "failed" | "warning";
        id: string;
        confidence: number;
        relatedTestIds: number[];
        flow: string;
        source: "replay" | "visual" | "lighthouse" | "console" | "test";
        severity: "high" | "medium" | "low" | "critical" | "info";
        blocking: boolean;
        title: string;
        issue: string;
        changedFileHints: string[];
        evidence: {
            url: string;
            id: string;
            name: string;
            kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
            contentType?: string | undefined;
            flow?: string | undefined;
            testId?: number | undefined;
            viewport?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
        }[];
        suggestedFixes: string[];
        rootCauseHint?: string | undefined;
        replayUrl?: string | undefined;
        visualRegression?: boolean | undefined;
        lighthouseMetric?: string | undefined;
        lighthouseScore?: number | undefined;
        consoleErrors?: string[] | undefined;
    }[];
    ai?: {
        confidence: number;
        suggestedFixes: {
            findingId: string;
            fix: string;
            files: string[];
            priority: "now" | "next";
        }[];
        summary: string;
        mergeRecommendation: "merge" | "merge_with_followup" | "hold" | "request_changes";
        rootCauses: {
            confidence: number;
            relatedFiles: string[];
            findingId: string;
            probableCause: string;
            rationale: string;
        }[];
        reviewComments: {
            body: string;
            severity: "high" | "medium" | "low" | "critical" | "info";
            path?: string | undefined;
        }[];
    } | undefined;
}, {
    status: "failed" | "cancelled" | "completed" | "executing" | "initialized" | "planning" | "aggregating" | "publishing" | "analyzing" | "commenting" | "partial_failed";
    projectId: number;
    id: string;
    kind: "pr_validation";
    metadata: Record<string, unknown>;
    source: "mcp" | "github_action" | "cli" | "ide" | "dashboard";
    suggestedFixes: string[];
    correlationId: string;
    idempotencyKey: string;
    createdAt: string;
    updatedAt: string;
    repository: {
        name: string;
        provider: "github";
        owner: string;
        prNumber: number;
        baseSha: string;
        headSha: string;
        prUrl?: string | undefined;
    };
    changes: {
        changedFiles: {
            status: "added" | "modified" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }[];
        impactedFlows: {
            reason: string;
            id: string;
            name: string;
            confidence: number;
            relatedFiles: string[];
            relatedTestIds: number[];
        }[];
    };
    runs: {
        replay?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        tests?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        visual?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        lighthouse?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
    };
    artifacts: {
        url: string;
        id: string;
        name: string;
        kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
        contentType?: string | undefined;
        flow?: string | undefined;
        testId?: number | undefined;
        viewport?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }[];
    findings: {
        status: "passed" | "failed" | "warning";
        id: string;
        confidence: number;
        relatedTestIds: number[];
        flow: string;
        source: "replay" | "visual" | "lighthouse" | "console" | "test";
        severity: "high" | "medium" | "low" | "critical" | "info";
        blocking: boolean;
        title: string;
        issue: string;
        changedFileHints: string[];
        evidence: {
            url: string;
            id: string;
            name: string;
            kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
            contentType?: string | undefined;
            flow?: string | undefined;
            testId?: number | undefined;
            viewport?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
        }[];
        suggestedFixes: string[];
        rootCauseHint?: string | undefined;
        replayUrl?: string | undefined;
        visualRegression?: boolean | undefined;
        lighthouseMetric?: string | undefined;
        lighthouseScore?: number | undefined;
        consoleErrors?: string[] | undefined;
    }[];
    ai?: {
        confidence: number;
        suggestedFixes: {
            findingId: string;
            fix: string;
            files: string[];
            priority: "now" | "next";
        }[];
        summary: string;
        mergeRecommendation: "merge" | "merge_with_followup" | "hold" | "request_changes";
        rootCauses: {
            confidence: number;
            relatedFiles: string[];
            findingId: string;
            probableCause: string;
            rationale: string;
        }[];
        reviewComments: {
            body: string;
            severity: "high" | "medium" | "low" | "critical" | "info";
            path?: string | undefined;
        }[];
    } | undefined;
}>;
export type WorkflowContext = z.infer<typeof WorkflowContextSchema>;
export declare const WorkflowEventSchema: z.ZodObject<{
    workflowId: z.ZodString;
    type: z.ZodString;
    stage: z.ZodOptional<z.ZodEnum<["tests", "visual", "lighthouse", "replay"]>>;
    timestamp: z.ZodString;
    payload: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    type: string;
    workflowId: string;
    timestamp: string;
    stage?: "replay" | "tests" | "visual" | "lighthouse" | undefined;
    payload?: unknown;
}, {
    type: string;
    workflowId: string;
    timestamp: string;
    stage?: "replay" | "tests" | "visual" | "lighthouse" | undefined;
    payload?: unknown;
}>;
export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>;
export declare const AffectedTestCandidateSchema: z.ZodObject<{
    test_id: z.ZodOptional<z.ZodNumber>;
    test_name: z.ZodOptional<z.ZodString>;
    function_name: z.ZodOptional<z.ZodString>;
    confidence: z.ZodOptional<z.ZodNumber>;
    confidence_score: z.ZodOptional<z.ZodNumber>;
    impact_level: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
    confidence?: number | undefined;
    test_id?: number | undefined;
    test_name?: string | undefined;
    function_name?: string | undefined;
    confidence_score?: number | undefined;
    impact_level?: string | undefined;
}, {
    reason?: string | undefined;
    confidence?: number | undefined;
    test_id?: number | undefined;
    test_name?: string | undefined;
    function_name?: string | undefined;
    confidence_score?: number | undefined;
    impact_level?: string | undefined;
}>;
export type AffectedTestCandidate = z.infer<typeof AffectedTestCandidateSchema>;
export declare const ImpactAnalysisResultSchema: z.ZodObject<{
    affectedTests: z.ZodArray<z.ZodObject<{
        test_id: z.ZodOptional<z.ZodNumber>;
        test_name: z.ZodOptional<z.ZodString>;
        function_name: z.ZodOptional<z.ZodString>;
        confidence: z.ZodOptional<z.ZodNumber>;
        confidence_score: z.ZodOptional<z.ZodNumber>;
        impact_level: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        reason?: string | undefined;
        confidence?: number | undefined;
        test_id?: number | undefined;
        test_name?: string | undefined;
        function_name?: string | undefined;
        confidence_score?: number | undefined;
        impact_level?: string | undefined;
    }, {
        reason?: string | undefined;
        confidence?: number | undefined;
        test_id?: number | undefined;
        test_name?: string | undefined;
        function_name?: string | undefined;
        confidence_score?: number | undefined;
        impact_level?: string | undefined;
    }>, "many">;
    summary: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    recommendations: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodString, "many">, z.ZodRecord<z.ZodString, z.ZodUnknown>]>>;
    source: z.ZodDefault<z.ZodEnum<["git_refs", "manual_diff", "none"]>>;
}, "strip", z.ZodTypeAny, {
    source: "none" | "git_refs" | "manual_diff";
    affectedTests: {
        reason?: string | undefined;
        confidence?: number | undefined;
        test_id?: number | undefined;
        test_name?: string | undefined;
        function_name?: string | undefined;
        confidence_score?: number | undefined;
        impact_level?: string | undefined;
    }[];
    summary?: Record<string, unknown> | undefined;
    recommendations?: Record<string, unknown> | string[] | undefined;
}, {
    affectedTests: {
        reason?: string | undefined;
        confidence?: number | undefined;
        test_id?: number | undefined;
        test_name?: string | undefined;
        function_name?: string | undefined;
        confidence_score?: number | undefined;
        impact_level?: string | undefined;
    }[];
    source?: "none" | "git_refs" | "manual_diff" | undefined;
    summary?: Record<string, unknown> | undefined;
    recommendations?: Record<string, unknown> | string[] | undefined;
}>;
export type ImpactAnalysisResult = z.infer<typeof ImpactAnalysisResultSchema>;
export declare const ValidatePrRequestSchema: z.ZodObject<{
    project_id: z.ZodNumber;
    repository: z.ZodObject<{
        owner: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        owner: string;
    }, {
        name: string;
        owner: string;
    }>;
    pull_request: z.ZodObject<{
        number: z.ZodNumber;
        url: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        number: number;
        url?: string | undefined;
    }, {
        number: number;
        url?: string | undefined;
    }>;
    git: z.ZodObject<{
        base_sha: z.ZodString;
        head_sha: z.ZodString;
        diff_content: z.ZodOptional<z.ZodString>;
        changed_files: z.ZodOptional<z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            status: z.ZodEnum<["added", "modified", "deleted", "renamed"]>;
            additions: z.ZodOptional<z.ZodNumber>;
            deletions: z.ZodOptional<z.ZodNumber>;
            language: z.ZodOptional<z.ZodString>;
            patch: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "added" | "modified" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }, {
            status: "added" | "modified" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        base_sha: string;
        head_sha: string;
        diff_content?: string | undefined;
        changed_files?: {
            status: "added" | "modified" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }[] | undefined;
    }, {
        base_sha: string;
        head_sha: string;
        diff_content?: string | undefined;
        changed_files?: {
            status: "added" | "modified" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }[] | undefined;
    }>;
    execution: z.ZodDefault<z.ZodObject<{
        run_impacted_tests: z.ZodDefault<z.ZodBoolean>;
        run_visual_regression: z.ZodDefault<z.ZodBoolean>;
        run_lighthouse: z.ZodDefault<z.ZodBoolean>;
        capture_replay: z.ZodDefault<z.ZodBoolean>;
        max_parallelism: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        run_impacted_tests: boolean;
        run_visual_regression: boolean;
        run_lighthouse: boolean;
        capture_replay: boolean;
        max_parallelism: number;
    }, {
        run_impacted_tests?: boolean | undefined;
        run_visual_regression?: boolean | undefined;
        run_lighthouse?: boolean | undefined;
        capture_replay?: boolean | undefined;
        max_parallelism?: number | undefined;
    }>>;
    output: z.ZodDefault<z.ZodObject<{
        include_comment_draft: z.ZodDefault<z.ZodBoolean>;
        publish_comment: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        include_comment_draft: boolean;
        publish_comment: boolean;
    }, {
        include_comment_draft?: boolean | undefined;
        publish_comment?: boolean | undefined;
    }>>;
    idempotency_key: z.ZodOptional<z.ZodString>;
    confirm: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    repository: {
        name: string;
        owner: string;
    };
    project_id: number;
    pull_request: {
        number: number;
        url?: string | undefined;
    };
    git: {
        base_sha: string;
        head_sha: string;
        diff_content?: string | undefined;
        changed_files?: {
            status: "added" | "modified" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }[] | undefined;
    };
    execution: {
        run_impacted_tests: boolean;
        run_visual_regression: boolean;
        run_lighthouse: boolean;
        capture_replay: boolean;
        max_parallelism: number;
    };
    output: {
        include_comment_draft: boolean;
        publish_comment: boolean;
    };
    confirm: boolean;
    idempotency_key?: string | undefined;
}, {
    repository: {
        name: string;
        owner: string;
    };
    project_id: number;
    pull_request: {
        number: number;
        url?: string | undefined;
    };
    git: {
        base_sha: string;
        head_sha: string;
        diff_content?: string | undefined;
        changed_files?: {
            status: "added" | "modified" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }[] | undefined;
    };
    execution?: {
        run_impacted_tests?: boolean | undefined;
        run_visual_regression?: boolean | undefined;
        run_lighthouse?: boolean | undefined;
        capture_replay?: boolean | undefined;
        max_parallelism?: number | undefined;
    } | undefined;
    output?: {
        include_comment_draft?: boolean | undefined;
        publish_comment?: boolean | undefined;
    } | undefined;
    idempotency_key?: string | undefined;
    confirm?: boolean | undefined;
}>;
export type ValidatePrRequest = z.infer<typeof ValidatePrRequestSchema>;
export declare const ValidatePrResponseSchema: z.ZodObject<{
    contract_version: z.ZodLiteral<"pr_validation.v1">;
    workflow_id: z.ZodString;
    status: z.ZodEnum<["passed", "failed", "partial"]>;
    project_id: z.ZodNumber;
    repository: z.ZodObject<{
        owner: z.ZodString;
        name: z.ZodString;
        pr_number: z.ZodNumber;
        base_sha: z.ZodString;
        head_sha: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        owner: string;
        base_sha: string;
        head_sha: string;
        pr_number: number;
    }, {
        name: string;
        owner: string;
        base_sha: string;
        head_sha: string;
        pr_number: number;
    }>;
    impact_summary: z.ZodObject<{
        changed_files: z.ZodNumber;
        impacted_flows: z.ZodNumber;
        impacted_tests: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        changed_files: number;
        impacted_flows: number;
        impacted_tests: number;
    }, {
        changed_files: number;
        impacted_flows: number;
        impacted_tests: number;
    }>;
    execution_summary: z.ZodObject<{
        tests: z.ZodOptional<z.ZodObject<{
            stage: z.ZodEnum<["tests", "visual", "lighthouse", "replay"]>;
            status: z.ZodEnum<["queued", "running", "passed", "failed", "partial"]>;
            startedAt: z.ZodOptional<z.ZodString>;
            completedAt: z.ZodOptional<z.ZodString>;
            runId: z.ZodOptional<z.ZodString>;
            executionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            dashboardUrl: z.ZodOptional<z.ZodString>;
            rawResultRef: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }, {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }>>;
        visual: z.ZodOptional<z.ZodObject<{
            stage: z.ZodEnum<["tests", "visual", "lighthouse", "replay"]>;
            status: z.ZodEnum<["queued", "running", "passed", "failed", "partial"]>;
            startedAt: z.ZodOptional<z.ZodString>;
            completedAt: z.ZodOptional<z.ZodString>;
            runId: z.ZodOptional<z.ZodString>;
            executionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            dashboardUrl: z.ZodOptional<z.ZodString>;
            rawResultRef: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }, {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }>>;
        lighthouse: z.ZodOptional<z.ZodObject<{
            stage: z.ZodEnum<["tests", "visual", "lighthouse", "replay"]>;
            status: z.ZodEnum<["queued", "running", "passed", "failed", "partial"]>;
            startedAt: z.ZodOptional<z.ZodString>;
            completedAt: z.ZodOptional<z.ZodString>;
            runId: z.ZodOptional<z.ZodString>;
            executionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            dashboardUrl: z.ZodOptional<z.ZodString>;
            rawResultRef: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }, {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }>>;
        replay: z.ZodOptional<z.ZodObject<{
            stage: z.ZodEnum<["tests", "visual", "lighthouse", "replay"]>;
            status: z.ZodEnum<["queued", "running", "passed", "failed", "partial"]>;
            startedAt: z.ZodOptional<z.ZodString>;
            completedAt: z.ZodOptional<z.ZodString>;
            runId: z.ZodOptional<z.ZodString>;
            executionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            dashboardUrl: z.ZodOptional<z.ZodString>;
            rawResultRef: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }, {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        replay?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        tests?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        visual?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        lighthouse?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
    }, {
        replay?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        tests?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        visual?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        lighthouse?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
    }>;
    findings: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        source: z.ZodEnum<["test", "visual", "lighthouse", "replay", "console"]>;
        status: z.ZodEnum<["passed", "warning", "failed"]>;
        severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
        blocking: z.ZodBoolean;
        flow: z.ZodString;
        title: z.ZodString;
        issue: z.ZodString;
        rootCauseHint: z.ZodOptional<z.ZodString>;
        changedFileHints: z.ZodArray<z.ZodString, "many">;
        relatedTestIds: z.ZodArray<z.ZodNumber, "many">;
        evidence: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["screenshot", "visual_diff", "replay", "lighthouse", "console", "trace"]>;
            name: z.ZodString;
            url: z.ZodString;
            contentType: z.ZodOptional<z.ZodString>;
            flow: z.ZodOptional<z.ZodString>;
            testId: z.ZodOptional<z.ZodNumber>;
            viewport: z.ZodOptional<z.ZodString>;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            id: string;
            name: string;
            kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
            contentType?: string | undefined;
            flow?: string | undefined;
            testId?: number | undefined;
            viewport?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
        }, {
            url: string;
            id: string;
            name: string;
            kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
            contentType?: string | undefined;
            flow?: string | undefined;
            testId?: number | undefined;
            viewport?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
        }>, "many">;
        replayUrl: z.ZodOptional<z.ZodString>;
        visualRegression: z.ZodOptional<z.ZodBoolean>;
        lighthouseMetric: z.ZodOptional<z.ZodString>;
        lighthouseScore: z.ZodOptional<z.ZodNumber>;
        consoleErrors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        suggestedFixes: z.ZodArray<z.ZodString, "many">;
        confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "passed" | "failed" | "warning";
        id: string;
        confidence: number;
        relatedTestIds: number[];
        flow: string;
        source: "replay" | "visual" | "lighthouse" | "console" | "test";
        severity: "high" | "medium" | "low" | "critical" | "info";
        blocking: boolean;
        title: string;
        issue: string;
        changedFileHints: string[];
        evidence: {
            url: string;
            id: string;
            name: string;
            kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
            contentType?: string | undefined;
            flow?: string | undefined;
            testId?: number | undefined;
            viewport?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
        }[];
        suggestedFixes: string[];
        rootCauseHint?: string | undefined;
        replayUrl?: string | undefined;
        visualRegression?: boolean | undefined;
        lighthouseMetric?: string | undefined;
        lighthouseScore?: number | undefined;
        consoleErrors?: string[] | undefined;
    }, {
        status: "passed" | "failed" | "warning";
        id: string;
        confidence: number;
        relatedTestIds: number[];
        flow: string;
        source: "replay" | "visual" | "lighthouse" | "console" | "test";
        severity: "high" | "medium" | "low" | "critical" | "info";
        blocking: boolean;
        title: string;
        issue: string;
        changedFileHints: string[];
        evidence: {
            url: string;
            id: string;
            name: string;
            kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
            contentType?: string | undefined;
            flow?: string | undefined;
            testId?: number | undefined;
            viewport?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
        }[];
        suggestedFixes: string[];
        rootCauseHint?: string | undefined;
        replayUrl?: string | undefined;
        visualRegression?: boolean | undefined;
        lighthouseMetric?: string | undefined;
        lighthouseScore?: number | undefined;
        consoleErrors?: string[] | undefined;
    }>, "many">;
    ai_ready_summary: z.ZodObject<{
        blocking_count: z.ZodNumber;
        warning_count: z.ZodNumber;
        passed_count: z.ZodNumber;
        highest_severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
        merge_signal: z.ZodEnum<["clean", "review", "block"]>;
    }, "strip", z.ZodTypeAny, {
        blocking_count: number;
        warning_count: number;
        passed_count: number;
        highest_severity: "high" | "medium" | "low" | "critical" | "info";
        merge_signal: "clean" | "review" | "block";
    }, {
        blocking_count: number;
        warning_count: number;
        passed_count: number;
        highest_severity: "high" | "medium" | "low" | "critical" | "info";
        merge_signal: "clean" | "review" | "block";
    }>;
    claude_analysis: z.ZodOptional<z.ZodObject<{
        summary: z.ZodString;
        mergeRecommendation: z.ZodEnum<["merge", "merge_with_followup", "hold", "request_changes"]>;
        confidence: z.ZodNumber;
        rootCauses: z.ZodArray<z.ZodObject<{
            findingId: z.ZodString;
            probableCause: z.ZodString;
            relatedFiles: z.ZodArray<z.ZodString, "many">;
            rationale: z.ZodString;
            confidence: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            confidence: number;
            relatedFiles: string[];
            findingId: string;
            probableCause: string;
            rationale: string;
        }, {
            confidence: number;
            relatedFiles: string[];
            findingId: string;
            probableCause: string;
            rationale: string;
        }>, "many">;
        suggestedFixes: z.ZodArray<z.ZodObject<{
            findingId: z.ZodString;
            fix: z.ZodString;
            files: z.ZodArray<z.ZodString, "many">;
            priority: z.ZodEnum<["now", "next"]>;
        }, "strip", z.ZodTypeAny, {
            findingId: string;
            fix: string;
            files: string[];
            priority: "now" | "next";
        }, {
            findingId: string;
            fix: string;
            files: string[];
            priority: "now" | "next";
        }>, "many">;
        reviewComments: z.ZodArray<z.ZodObject<{
            path: z.ZodOptional<z.ZodString>;
            body: z.ZodString;
            severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
        }, "strip", z.ZodTypeAny, {
            body: string;
            severity: "high" | "medium" | "low" | "critical" | "info";
            path?: string | undefined;
        }, {
            body: string;
            severity: "high" | "medium" | "low" | "critical" | "info";
            path?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        suggestedFixes: {
            findingId: string;
            fix: string;
            files: string[];
            priority: "now" | "next";
        }[];
        summary: string;
        mergeRecommendation: "merge" | "merge_with_followup" | "hold" | "request_changes";
        rootCauses: {
            confidence: number;
            relatedFiles: string[];
            findingId: string;
            probableCause: string;
            rationale: string;
        }[];
        reviewComments: {
            body: string;
            severity: "high" | "medium" | "low" | "critical" | "info";
            path?: string | undefined;
        }[];
    }, {
        confidence: number;
        suggestedFixes: {
            findingId: string;
            fix: string;
            files: string[];
            priority: "now" | "next";
        }[];
        summary: string;
        mergeRecommendation: "merge" | "merge_with_followup" | "hold" | "request_changes";
        rootCauses: {
            confidence: number;
            relatedFiles: string[];
            findingId: string;
            probableCause: string;
            rationale: string;
        }[];
        reviewComments: {
            body: string;
            severity: "high" | "medium" | "low" | "critical" | "info";
            path?: string | undefined;
        }[];
    }>>;
    comment_draft: z.ZodOptional<z.ZodString>;
    metadata: z.ZodDefault<z.ZodObject<{
        execution_mode: z.ZodEnum<["planned_only", "executed"]>;
        replayed: z.ZodDefault<z.ZodBoolean>;
        impact_source: z.ZodDefault<z.ZodEnum<["git_refs", "manual_diff", "none"]>>;
    }, "strip", z.ZodTypeAny, {
        execution_mode: "planned_only" | "executed";
        replayed: boolean;
        impact_source: "none" | "git_refs" | "manual_diff";
    }, {
        execution_mode: "planned_only" | "executed";
        replayed?: boolean | undefined;
        impact_source?: "none" | "git_refs" | "manual_diff" | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "passed" | "failed" | "partial";
    metadata: {
        execution_mode: "planned_only" | "executed";
        replayed: boolean;
        impact_source: "none" | "git_refs" | "manual_diff";
    };
    repository: {
        name: string;
        owner: string;
        base_sha: string;
        head_sha: string;
        pr_number: number;
    };
    findings: {
        status: "passed" | "failed" | "warning";
        id: string;
        confidence: number;
        relatedTestIds: number[];
        flow: string;
        source: "replay" | "visual" | "lighthouse" | "console" | "test";
        severity: "high" | "medium" | "low" | "critical" | "info";
        blocking: boolean;
        title: string;
        issue: string;
        changedFileHints: string[];
        evidence: {
            url: string;
            id: string;
            name: string;
            kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
            contentType?: string | undefined;
            flow?: string | undefined;
            testId?: number | undefined;
            viewport?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
        }[];
        suggestedFixes: string[];
        rootCauseHint?: string | undefined;
        replayUrl?: string | undefined;
        visualRegression?: boolean | undefined;
        lighthouseMetric?: string | undefined;
        lighthouseScore?: number | undefined;
        consoleErrors?: string[] | undefined;
    }[];
    project_id: number;
    contract_version: "pr_validation.v1";
    workflow_id: string;
    impact_summary: {
        changed_files: number;
        impacted_flows: number;
        impacted_tests: number;
    };
    execution_summary: {
        replay?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        tests?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        visual?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        lighthouse?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
    };
    ai_ready_summary: {
        blocking_count: number;
        warning_count: number;
        passed_count: number;
        highest_severity: "high" | "medium" | "low" | "critical" | "info";
        merge_signal: "clean" | "review" | "block";
    };
    claude_analysis?: {
        confidence: number;
        suggestedFixes: {
            findingId: string;
            fix: string;
            files: string[];
            priority: "now" | "next";
        }[];
        summary: string;
        mergeRecommendation: "merge" | "merge_with_followup" | "hold" | "request_changes";
        rootCauses: {
            confidence: number;
            relatedFiles: string[];
            findingId: string;
            probableCause: string;
            rationale: string;
        }[];
        reviewComments: {
            body: string;
            severity: "high" | "medium" | "low" | "critical" | "info";
            path?: string | undefined;
        }[];
    } | undefined;
    comment_draft?: string | undefined;
}, {
    status: "passed" | "failed" | "partial";
    repository: {
        name: string;
        owner: string;
        base_sha: string;
        head_sha: string;
        pr_number: number;
    };
    findings: {
        status: "passed" | "failed" | "warning";
        id: string;
        confidence: number;
        relatedTestIds: number[];
        flow: string;
        source: "replay" | "visual" | "lighthouse" | "console" | "test";
        severity: "high" | "medium" | "low" | "critical" | "info";
        blocking: boolean;
        title: string;
        issue: string;
        changedFileHints: string[];
        evidence: {
            url: string;
            id: string;
            name: string;
            kind: "replay" | "lighthouse" | "screenshot" | "visual_diff" | "console" | "trace";
            contentType?: string | undefined;
            flow?: string | undefined;
            testId?: number | undefined;
            viewport?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
        }[];
        suggestedFixes: string[];
        rootCauseHint?: string | undefined;
        replayUrl?: string | undefined;
        visualRegression?: boolean | undefined;
        lighthouseMetric?: string | undefined;
        lighthouseScore?: number | undefined;
        consoleErrors?: string[] | undefined;
    }[];
    project_id: number;
    contract_version: "pr_validation.v1";
    workflow_id: string;
    impact_summary: {
        changed_files: number;
        impacted_flows: number;
        impacted_tests: number;
    };
    execution_summary: {
        replay?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        tests?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        visual?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        lighthouse?: {
            status: "queued" | "running" | "passed" | "failed" | "partial";
            stage: "replay" | "tests" | "visual" | "lighthouse";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
    };
    ai_ready_summary: {
        blocking_count: number;
        warning_count: number;
        passed_count: number;
        highest_severity: "high" | "medium" | "low" | "critical" | "info";
        merge_signal: "clean" | "review" | "block";
    };
    metadata?: {
        execution_mode: "planned_only" | "executed";
        replayed?: boolean | undefined;
        impact_source?: "none" | "git_refs" | "manual_diff" | undefined;
    } | undefined;
    claude_analysis?: {
        confidence: number;
        suggestedFixes: {
            findingId: string;
            fix: string;
            files: string[];
            priority: "now" | "next";
        }[];
        summary: string;
        mergeRecommendation: "merge" | "merge_with_followup" | "hold" | "request_changes";
        rootCauses: {
            confidence: number;
            relatedFiles: string[];
            findingId: string;
            probableCause: string;
            rationale: string;
        }[];
        reviewComments: {
            body: string;
            severity: "high" | "medium" | "low" | "critical" | "info";
            path?: string | undefined;
        }[];
    } | undefined;
    comment_draft?: string | undefined;
}>;
export type ValidatePrResponse = z.infer<typeof ValidatePrResponseSchema>;
