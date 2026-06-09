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
    status: "modified" | "added" | "deleted" | "renamed";
    path: string;
    additions?: number | undefined;
    deletions?: number | undefined;
    language?: string | undefined;
    patch?: string | undefined;
}, {
    status: "modified" | "added" | "deleted" | "renamed";
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
    id: string;
    name: string;
    confidence: number;
    reason: string;
    relatedFiles: string[];
    relatedTestIds: number[];
}, {
    id: string;
    name: string;
    confidence: number;
    reason: string;
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
    kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
    id: string;
    name: string;
    contentType?: string | undefined;
    flow?: string | undefined;
    testId?: number | undefined;
    viewport?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    url: string;
    kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
    id: string;
    name: string;
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
    status: "failed" | "queued" | "running" | "passed" | "partial";
    stage: "tests" | "visual" | "lighthouse" | "replay";
    startedAt?: string | undefined;
    completedAt?: string | undefined;
    runId?: string | undefined;
    executionIds?: string[] | undefined;
    dashboardUrl?: string | undefined;
    rawResultRef?: string | undefined;
}, {
    status: "failed" | "queued" | "running" | "passed" | "partial";
    stage: "tests" | "visual" | "lighthouse" | "replay";
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
        kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
        id: string;
        name: string;
        contentType?: string | undefined;
        flow?: string | undefined;
        testId?: number | undefined;
        viewport?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }, {
        url: string;
        kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
        id: string;
        name: string;
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
    status: "failed" | "passed" | "warning";
    id: string;
    confidence: number;
    relatedTestIds: number[];
    flow: string;
    source: "visual" | "lighthouse" | "replay" | "console" | "test";
    severity: "critical" | "high" | "medium" | "low" | "info";
    blocking: boolean;
    title: string;
    issue: string;
    changedFileHints: string[];
    evidence: {
        url: string;
        kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
        id: string;
        name: string;
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
    status: "failed" | "passed" | "warning";
    id: string;
    confidence: number;
    relatedTestIds: number[];
    flow: string;
    source: "visual" | "lighthouse" | "replay" | "console" | "test";
    severity: "critical" | "high" | "medium" | "low" | "info";
    blocking: boolean;
    title: string;
    issue: string;
    changedFileHints: string[];
    evidence: {
        url: string;
        kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
        id: string;
        name: string;
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
        severity: "critical" | "high" | "medium" | "low" | "info";
        path?: string | undefined;
    }, {
        body: string;
        severity: "critical" | "high" | "medium" | "low" | "info";
        path?: string | undefined;
    }>, "many">;
    riskFactors: z.ZodOptional<z.ZodArray<z.ZodObject<{
        factor: z.ZodString;
        score: z.ZodNumber;
        weight: z.ZodNumber;
        explanation: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        factor: string;
        score: number;
        weight: number;
        explanation: string;
    }, {
        factor: string;
        score: number;
        weight: number;
        explanation: string;
    }>, "many">>;
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
        severity: "critical" | "high" | "medium" | "low" | "info";
        path?: string | undefined;
    }[];
    riskFactors?: {
        factor: string;
        score: number;
        weight: number;
        explanation: string;
    }[] | undefined;
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
        severity: "critical" | "high" | "medium" | "low" | "info";
        path?: string | undefined;
    }[];
    riskFactors?: {
        factor: string;
        score: number;
        weight: number;
        explanation: string;
    }[] | undefined;
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
            status: "modified" | "added" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }, {
            status: "modified" | "added" | "deleted" | "renamed";
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
            id: string;
            name: string;
            confidence: number;
            reason: string;
            relatedFiles: string[];
            relatedTestIds: number[];
        }, {
            id: string;
            name: string;
            confidence: number;
            reason: string;
            relatedFiles: string[];
            relatedTestIds: number[];
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        changedFiles: {
            status: "modified" | "added" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }[];
        impactedFlows: {
            id: string;
            name: string;
            confidence: number;
            reason: string;
            relatedFiles: string[];
            relatedTestIds: number[];
        }[];
    }, {
        changedFiles: {
            status: "modified" | "added" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }[];
        impactedFlows: {
            id: string;
            name: string;
            confidence: number;
            reason: string;
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
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }, {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
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
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }, {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
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
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }, {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
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
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }, {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        tests?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        visual?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        lighthouse?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        replay?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
    }, {
        tests?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        visual?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        lighthouse?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        replay?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
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
        kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
        id: string;
        name: string;
        contentType?: string | undefined;
        flow?: string | undefined;
        testId?: number | undefined;
        viewport?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }, {
        url: string;
        kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
        id: string;
        name: string;
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
            kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
            id: string;
            name: string;
            contentType?: string | undefined;
            flow?: string | undefined;
            testId?: number | undefined;
            viewport?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
        }, {
            url: string;
            kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
            id: string;
            name: string;
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
        status: "failed" | "passed" | "warning";
        id: string;
        confidence: number;
        relatedTestIds: number[];
        flow: string;
        source: "visual" | "lighthouse" | "replay" | "console" | "test";
        severity: "critical" | "high" | "medium" | "low" | "info";
        blocking: boolean;
        title: string;
        issue: string;
        changedFileHints: string[];
        evidence: {
            url: string;
            kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
            id: string;
            name: string;
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
        status: "failed" | "passed" | "warning";
        id: string;
        confidence: number;
        relatedTestIds: number[];
        flow: string;
        source: "visual" | "lighthouse" | "replay" | "console" | "test";
        severity: "critical" | "high" | "medium" | "low" | "info";
        blocking: boolean;
        title: string;
        issue: string;
        changedFileHints: string[];
        evidence: {
            url: string;
            kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
            id: string;
            name: string;
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
            severity: "critical" | "high" | "medium" | "low" | "info";
            path?: string | undefined;
        }, {
            body: string;
            severity: "critical" | "high" | "medium" | "low" | "info";
            path?: string | undefined;
        }>, "many">;
        riskFactors: z.ZodOptional<z.ZodArray<z.ZodObject<{
            factor: z.ZodString;
            score: z.ZodNumber;
            weight: z.ZodNumber;
            explanation: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            factor: string;
            score: number;
            weight: number;
            explanation: string;
        }, {
            factor: string;
            score: number;
            weight: number;
            explanation: string;
        }>, "many">>;
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
            severity: "critical" | "high" | "medium" | "low" | "info";
            path?: string | undefined;
        }[];
        riskFactors?: {
            factor: string;
            score: number;
            weight: number;
            explanation: string;
        }[] | undefined;
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
            severity: "critical" | "high" | "medium" | "low" | "info";
            path?: string | undefined;
        }[];
        riskFactors?: {
            factor: string;
            score: number;
            weight: number;
            explanation: string;
        }[] | undefined;
    }>>;
    suggestedFixes: z.ZodArray<z.ZodString, "many">;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    status: "completed" | "failed" | "initialized" | "planning" | "executing" | "aggregating" | "publishing" | "analyzing" | "commenting" | "partial_failed" | "cancelled";
    kind: "pr_validation";
    id: string;
    metadata: Record<string, unknown>;
    source: "mcp" | "github_action" | "cli" | "ide" | "dashboard";
    suggestedFixes: string[];
    correlationId: string;
    idempotencyKey: string;
    projectId: number;
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
            status: "modified" | "added" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }[];
        impactedFlows: {
            id: string;
            name: string;
            confidence: number;
            reason: string;
            relatedFiles: string[];
            relatedTestIds: number[];
        }[];
    };
    runs: {
        tests?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        visual?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        lighthouse?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        replay?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
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
        kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
        id: string;
        name: string;
        contentType?: string | undefined;
        flow?: string | undefined;
        testId?: number | undefined;
        viewport?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }[];
    findings: {
        status: "failed" | "passed" | "warning";
        id: string;
        confidence: number;
        relatedTestIds: number[];
        flow: string;
        source: "visual" | "lighthouse" | "replay" | "console" | "test";
        severity: "critical" | "high" | "medium" | "low" | "info";
        blocking: boolean;
        title: string;
        issue: string;
        changedFileHints: string[];
        evidence: {
            url: string;
            kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
            id: string;
            name: string;
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
            severity: "critical" | "high" | "medium" | "low" | "info";
            path?: string | undefined;
        }[];
        riskFactors?: {
            factor: string;
            score: number;
            weight: number;
            explanation: string;
        }[] | undefined;
    } | undefined;
}, {
    status: "completed" | "failed" | "initialized" | "planning" | "executing" | "aggregating" | "publishing" | "analyzing" | "commenting" | "partial_failed" | "cancelled";
    kind: "pr_validation";
    id: string;
    metadata: Record<string, unknown>;
    source: "mcp" | "github_action" | "cli" | "ide" | "dashboard";
    suggestedFixes: string[];
    correlationId: string;
    idempotencyKey: string;
    projectId: number;
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
            status: "modified" | "added" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }[];
        impactedFlows: {
            id: string;
            name: string;
            confidence: number;
            reason: string;
            relatedFiles: string[];
            relatedTestIds: number[];
        }[];
    };
    runs: {
        tests?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        visual?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        lighthouse?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        replay?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
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
        kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
        id: string;
        name: string;
        contentType?: string | undefined;
        flow?: string | undefined;
        testId?: number | undefined;
        viewport?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }[];
    findings: {
        status: "failed" | "passed" | "warning";
        id: string;
        confidence: number;
        relatedTestIds: number[];
        flow: string;
        source: "visual" | "lighthouse" | "replay" | "console" | "test";
        severity: "critical" | "high" | "medium" | "low" | "info";
        blocking: boolean;
        title: string;
        issue: string;
        changedFileHints: string[];
        evidence: {
            url: string;
            kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
            id: string;
            name: string;
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
            severity: "critical" | "high" | "medium" | "low" | "info";
            path?: string | undefined;
        }[];
        riskFactors?: {
            factor: string;
            score: number;
            weight: number;
            explanation: string;
        }[] | undefined;
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
    stage?: "tests" | "visual" | "lighthouse" | "replay" | undefined;
    payload?: unknown;
}, {
    type: string;
    workflowId: string;
    timestamp: string;
    stage?: "tests" | "visual" | "lighthouse" | "replay" | undefined;
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
    failure_rate_7d: z.ZodOptional<z.ZodNumber>;
    failure_rate_30d: z.ZodOptional<z.ZodNumber>;
    flakiness_score: z.ZodOptional<z.ZodNumber>;
    recent_failure_count: z.ZodOptional<z.ZodNumber>;
    component_label: z.ZodOptional<z.ZodString>;
    component_failure_rate_7d: z.ZodOptional<z.ZodNumber>;
    blast_source: z.ZodOptional<z.ZodEnum<["direct", "changed_file", "transitive_d1", "transitive_d2", "transitive_d3", "transitive_d4"]>>;
    blast_depth: z.ZodOptional<z.ZodNumber>;
    blast_file_path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    confidence?: number | undefined;
    reason?: string | undefined;
    test_id?: number | undefined;
    test_name?: string | undefined;
    function_name?: string | undefined;
    confidence_score?: number | undefined;
    impact_level?: string | undefined;
    failure_rate_7d?: number | undefined;
    failure_rate_30d?: number | undefined;
    flakiness_score?: number | undefined;
    recent_failure_count?: number | undefined;
    component_label?: string | undefined;
    component_failure_rate_7d?: number | undefined;
    blast_source?: "direct" | "changed_file" | "transitive_d1" | "transitive_d2" | "transitive_d3" | "transitive_d4" | undefined;
    blast_depth?: number | undefined;
    blast_file_path?: string | undefined;
}, {
    confidence?: number | undefined;
    reason?: string | undefined;
    test_id?: number | undefined;
    test_name?: string | undefined;
    function_name?: string | undefined;
    confidence_score?: number | undefined;
    impact_level?: string | undefined;
    failure_rate_7d?: number | undefined;
    failure_rate_30d?: number | undefined;
    flakiness_score?: number | undefined;
    recent_failure_count?: number | undefined;
    component_label?: string | undefined;
    component_failure_rate_7d?: number | undefined;
    blast_source?: "direct" | "changed_file" | "transitive_d1" | "transitive_d2" | "transitive_d3" | "transitive_d4" | undefined;
    blast_depth?: number | undefined;
    blast_file_path?: string | undefined;
}>;
export type AffectedTestCandidate = z.infer<typeof AffectedTestCandidateSchema>;
export declare const ComponentHealthEntrySchema: z.ZodObject<{
    component: z.ZodString;
    failure_rate_7d: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    failure_rate_30d: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    flakiness_score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    total_tests: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    tests_with_risk_data: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    high_risk_tests: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    risk_level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    trend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    component: string;
    failure_rate_7d?: number | null | undefined;
    failure_rate_30d?: number | null | undefined;
    flakiness_score?: number | null | undefined;
    total_tests?: number | null | undefined;
    tests_with_risk_data?: number | null | undefined;
    high_risk_tests?: number | null | undefined;
    risk_level?: string | null | undefined;
    trend?: string | null | undefined;
}, {
    component: string;
    failure_rate_7d?: number | null | undefined;
    failure_rate_30d?: number | null | undefined;
    flakiness_score?: number | null | undefined;
    total_tests?: number | null | undefined;
    tests_with_risk_data?: number | null | undefined;
    high_risk_tests?: number | null | undefined;
    risk_level?: string | null | undefined;
    trend?: string | null | undefined;
}>;
export type ComponentHealthEntry = z.infer<typeof ComponentHealthEntrySchema>;
export declare const DependencyNodeSchema: z.ZodObject<{
    file_path: z.ZodString;
    depth: z.ZodNumber;
    imported_by: z.ZodString;
    component_label: z.ZodOptional<z.ZodString>;
    chain: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    file_path: string;
    depth: number;
    imported_by: string;
    chain: string[];
    component_label?: string | undefined;
}, {
    file_path: string;
    depth: number;
    imported_by: string;
    chain: string[];
    component_label?: string | undefined;
}>;
export type DependencyNode = z.infer<typeof DependencyNodeSchema>;
export declare const DependencyBlastSchema: z.ZodObject<{
    changed_files: z.ZodArray<z.ZodString, "many">;
    expanded_files: z.ZodArray<z.ZodString, "many">;
    nodes: z.ZodArray<z.ZodObject<{
        file_path: z.ZodString;
        depth: z.ZodNumber;
        imported_by: z.ZodString;
        component_label: z.ZodOptional<z.ZodString>;
        chain: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        file_path: string;
        depth: number;
        imported_by: string;
        chain: string[];
        component_label?: string | undefined;
    }, {
        file_path: string;
        depth: number;
        imported_by: string;
        chain: string[];
        component_label?: string | undefined;
    }>, "many">;
    direct_dependents: z.ZodNumber;
    transitive_dependents: z.ZodNumber;
    total_expanded: z.ZodNumber;
    max_depth: z.ZodNumber;
    affected_components: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    has_structure: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    changed_files: string[];
    expanded_files: string[];
    nodes: {
        file_path: string;
        depth: number;
        imported_by: string;
        chain: string[];
        component_label?: string | undefined;
    }[];
    direct_dependents: number;
    transitive_dependents: number;
    total_expanded: number;
    max_depth: number;
    affected_components?: Record<string, number> | undefined;
    has_structure?: boolean | undefined;
}, {
    changed_files: string[];
    expanded_files: string[];
    nodes: {
        file_path: string;
        depth: number;
        imported_by: string;
        chain: string[];
        component_label?: string | undefined;
    }[];
    direct_dependents: number;
    transitive_dependents: number;
    total_expanded: number;
    max_depth: number;
    affected_components?: Record<string, number> | undefined;
    has_structure?: boolean | undefined;
}>;
export type DependencyBlast = z.infer<typeof DependencyBlastSchema>;
export declare const IncidentMatchSchema: z.ZodObject<{
    match_id: z.ZodString;
    match_type: z.ZodEnum<["prior_validation", "failure_pattern", "resolution", "test_history"]>;
    title: z.ZodString;
    description: z.ZodString;
    match_score: z.ZodNumber;
    match_tier: z.ZodEnum<["none", "low", "medium", "high"]>;
    component: z.ZodOptional<z.ZodString>;
    workflow_id: z.ZodOptional<z.ZodString>;
    pr_number: z.ZodOptional<z.ZodNumber>;
    risk_level: z.ZodOptional<z.ZodString>;
    risk_score: z.ZodOptional<z.ZodNumber>;
    pattern_label: z.ZodOptional<z.ZodString>;
    pattern_occurrences: z.ZodOptional<z.ZodNumber>;
    resolution_action: z.ZodOptional<z.ZodString>;
    root_cause: z.ZodOptional<z.ZodString>;
    success_rate: z.ZodOptional<z.ZodNumber>;
    cases_count: z.ZodOptional<z.ZodNumber>;
    avg_resolve_minutes: z.ZodOptional<z.ZodNumber>;
    occurred_at: z.ZodOptional<z.ZodString>;
    related_test_ids: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    overlapping_files: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    resolved_by_name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    match_id: string;
    match_type: "prior_validation" | "failure_pattern" | "resolution" | "test_history";
    description: string;
    match_score: number;
    match_tier: "none" | "high" | "medium" | "low";
    component?: string | undefined;
    risk_level?: string | undefined;
    workflow_id?: string | undefined;
    pr_number?: number | undefined;
    risk_score?: number | undefined;
    pattern_label?: string | undefined;
    pattern_occurrences?: number | undefined;
    resolution_action?: string | undefined;
    root_cause?: string | undefined;
    success_rate?: number | undefined;
    cases_count?: number | undefined;
    avg_resolve_minutes?: number | undefined;
    occurred_at?: string | undefined;
    related_test_ids?: number[] | undefined;
    overlapping_files?: string[] | undefined;
    resolved_by_name?: string | undefined;
}, {
    title: string;
    match_id: string;
    match_type: "prior_validation" | "failure_pattern" | "resolution" | "test_history";
    description: string;
    match_score: number;
    match_tier: "none" | "high" | "medium" | "low";
    component?: string | undefined;
    risk_level?: string | undefined;
    workflow_id?: string | undefined;
    pr_number?: number | undefined;
    risk_score?: number | undefined;
    pattern_label?: string | undefined;
    pattern_occurrences?: number | undefined;
    resolution_action?: string | undefined;
    root_cause?: string | undefined;
    success_rate?: number | undefined;
    cases_count?: number | undefined;
    avg_resolve_minutes?: number | undefined;
    occurred_at?: string | undefined;
    related_test_ids?: number[] | undefined;
    overlapping_files?: string[] | undefined;
    resolved_by_name?: string | undefined;
}>;
export type IncidentMatch = z.infer<typeof IncidentMatchSchema>;
export declare const IncidentContextSchema: z.ZodObject<{
    contract_version: z.ZodLiteral<"incident_context.v1">;
    project_id: z.ZodNumber;
    match_count: z.ZodNumber;
    incident_match_score: z.ZodNumber;
    match_tier: z.ZodEnum<["none", "low", "medium", "high"]>;
    matches: z.ZodArray<z.ZodObject<{
        match_id: z.ZodString;
        match_type: z.ZodEnum<["prior_validation", "failure_pattern", "resolution", "test_history"]>;
        title: z.ZodString;
        description: z.ZodString;
        match_score: z.ZodNumber;
        match_tier: z.ZodEnum<["none", "low", "medium", "high"]>;
        component: z.ZodOptional<z.ZodString>;
        workflow_id: z.ZodOptional<z.ZodString>;
        pr_number: z.ZodOptional<z.ZodNumber>;
        risk_level: z.ZodOptional<z.ZodString>;
        risk_score: z.ZodOptional<z.ZodNumber>;
        pattern_label: z.ZodOptional<z.ZodString>;
        pattern_occurrences: z.ZodOptional<z.ZodNumber>;
        resolution_action: z.ZodOptional<z.ZodString>;
        root_cause: z.ZodOptional<z.ZodString>;
        success_rate: z.ZodOptional<z.ZodNumber>;
        cases_count: z.ZodOptional<z.ZodNumber>;
        avg_resolve_minutes: z.ZodOptional<z.ZodNumber>;
        occurred_at: z.ZodOptional<z.ZodString>;
        related_test_ids: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
        overlapping_files: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        resolved_by_name: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        match_id: string;
        match_type: "prior_validation" | "failure_pattern" | "resolution" | "test_history";
        description: string;
        match_score: number;
        match_tier: "none" | "high" | "medium" | "low";
        component?: string | undefined;
        risk_level?: string | undefined;
        workflow_id?: string | undefined;
        pr_number?: number | undefined;
        risk_score?: number | undefined;
        pattern_label?: string | undefined;
        pattern_occurrences?: number | undefined;
        resolution_action?: string | undefined;
        root_cause?: string | undefined;
        success_rate?: number | undefined;
        cases_count?: number | undefined;
        avg_resolve_minutes?: number | undefined;
        occurred_at?: string | undefined;
        related_test_ids?: number[] | undefined;
        overlapping_files?: string[] | undefined;
        resolved_by_name?: string | undefined;
    }, {
        title: string;
        match_id: string;
        match_type: "prior_validation" | "failure_pattern" | "resolution" | "test_history";
        description: string;
        match_score: number;
        match_tier: "none" | "high" | "medium" | "low";
        component?: string | undefined;
        risk_level?: string | undefined;
        workflow_id?: string | undefined;
        pr_number?: number | undefined;
        risk_score?: number | undefined;
        pattern_label?: string | undefined;
        pattern_occurrences?: number | undefined;
        resolution_action?: string | undefined;
        root_cause?: string | undefined;
        success_rate?: number | undefined;
        cases_count?: number | undefined;
        avg_resolve_minutes?: number | undefined;
        occurred_at?: string | undefined;
        related_test_ids?: number[] | undefined;
        overlapping_files?: string[] | undefined;
        resolved_by_name?: string | undefined;
    }>, "many">;
    top_resolution: z.ZodOptional<z.ZodObject<{
        action: z.ZodString;
        root_cause: z.ZodOptional<z.ZodString>;
        success_rate: z.ZodOptional<z.ZodNumber>;
        cases_count: z.ZodNumber;
        avg_resolve_minutes: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        cases_count: number;
        action: string;
        root_cause?: string | undefined;
        success_rate?: number | undefined;
        avg_resolve_minutes?: number | undefined;
    }, {
        cases_count: number;
        action: string;
        root_cause?: string | undefined;
        success_rate?: number | undefined;
        avg_resolve_minutes?: number | undefined;
    }>>;
    insight: z.ZodString;
}, "strip", z.ZodTypeAny, {
    contract_version: "incident_context.v1";
    project_id: number;
    match_tier: "none" | "high" | "medium" | "low";
    match_count: number;
    incident_match_score: number;
    matches: {
        title: string;
        match_id: string;
        match_type: "prior_validation" | "failure_pattern" | "resolution" | "test_history";
        description: string;
        match_score: number;
        match_tier: "none" | "high" | "medium" | "low";
        component?: string | undefined;
        risk_level?: string | undefined;
        workflow_id?: string | undefined;
        pr_number?: number | undefined;
        risk_score?: number | undefined;
        pattern_label?: string | undefined;
        pattern_occurrences?: number | undefined;
        resolution_action?: string | undefined;
        root_cause?: string | undefined;
        success_rate?: number | undefined;
        cases_count?: number | undefined;
        avg_resolve_minutes?: number | undefined;
        occurred_at?: string | undefined;
        related_test_ids?: number[] | undefined;
        overlapping_files?: string[] | undefined;
        resolved_by_name?: string | undefined;
    }[];
    insight: string;
    top_resolution?: {
        cases_count: number;
        action: string;
        root_cause?: string | undefined;
        success_rate?: number | undefined;
        avg_resolve_minutes?: number | undefined;
    } | undefined;
}, {
    contract_version: "incident_context.v1";
    project_id: number;
    match_tier: "none" | "high" | "medium" | "low";
    match_count: number;
    incident_match_score: number;
    matches: {
        title: string;
        match_id: string;
        match_type: "prior_validation" | "failure_pattern" | "resolution" | "test_history";
        description: string;
        match_score: number;
        match_tier: "none" | "high" | "medium" | "low";
        component?: string | undefined;
        risk_level?: string | undefined;
        workflow_id?: string | undefined;
        pr_number?: number | undefined;
        risk_score?: number | undefined;
        pattern_label?: string | undefined;
        pattern_occurrences?: number | undefined;
        resolution_action?: string | undefined;
        root_cause?: string | undefined;
        success_rate?: number | undefined;
        cases_count?: number | undefined;
        avg_resolve_minutes?: number | undefined;
        occurred_at?: string | undefined;
        related_test_ids?: number[] | undefined;
        overlapping_files?: string[] | undefined;
        resolved_by_name?: string | undefined;
    }[];
    insight: string;
    top_resolution?: {
        cases_count: number;
        action: string;
        root_cause?: string | undefined;
        success_rate?: number | undefined;
        avg_resolve_minutes?: number | undefined;
    } | undefined;
}>;
export type IncidentContext = z.infer<typeof IncidentContextSchema>;
export declare const ImpactAnalysisResultSchema: z.ZodObject<{
    affectedTests: z.ZodArray<z.ZodObject<{
        test_id: z.ZodOptional<z.ZodNumber>;
        test_name: z.ZodOptional<z.ZodString>;
        function_name: z.ZodOptional<z.ZodString>;
        confidence: z.ZodOptional<z.ZodNumber>;
        confidence_score: z.ZodOptional<z.ZodNumber>;
        impact_level: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
        failure_rate_7d: z.ZodOptional<z.ZodNumber>;
        failure_rate_30d: z.ZodOptional<z.ZodNumber>;
        flakiness_score: z.ZodOptional<z.ZodNumber>;
        recent_failure_count: z.ZodOptional<z.ZodNumber>;
        component_label: z.ZodOptional<z.ZodString>;
        component_failure_rate_7d: z.ZodOptional<z.ZodNumber>;
        blast_source: z.ZodOptional<z.ZodEnum<["direct", "changed_file", "transitive_d1", "transitive_d2", "transitive_d3", "transitive_d4"]>>;
        blast_depth: z.ZodOptional<z.ZodNumber>;
        blast_file_path: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        confidence?: number | undefined;
        reason?: string | undefined;
        test_id?: number | undefined;
        test_name?: string | undefined;
        function_name?: string | undefined;
        confidence_score?: number | undefined;
        impact_level?: string | undefined;
        failure_rate_7d?: number | undefined;
        failure_rate_30d?: number | undefined;
        flakiness_score?: number | undefined;
        recent_failure_count?: number | undefined;
        component_label?: string | undefined;
        component_failure_rate_7d?: number | undefined;
        blast_source?: "direct" | "changed_file" | "transitive_d1" | "transitive_d2" | "transitive_d3" | "transitive_d4" | undefined;
        blast_depth?: number | undefined;
        blast_file_path?: string | undefined;
    }, {
        confidence?: number | undefined;
        reason?: string | undefined;
        test_id?: number | undefined;
        test_name?: string | undefined;
        function_name?: string | undefined;
        confidence_score?: number | undefined;
        impact_level?: string | undefined;
        failure_rate_7d?: number | undefined;
        failure_rate_30d?: number | undefined;
        flakiness_score?: number | undefined;
        recent_failure_count?: number | undefined;
        component_label?: string | undefined;
        component_failure_rate_7d?: number | undefined;
        blast_source?: "direct" | "changed_file" | "transitive_d1" | "transitive_d2" | "transitive_d3" | "transitive_d4" | undefined;
        blast_depth?: number | undefined;
        blast_file_path?: string | undefined;
    }>, "many">;
    summary: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    recommendations: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodString, "many">, z.ZodRecord<z.ZodString, z.ZodUnknown>]>>;
    source: z.ZodDefault<z.ZodEnum<["git_refs", "manual_diff", "none"]>>;
    componentHealth: z.ZodOptional<z.ZodArray<z.ZodObject<{
        component: z.ZodString;
        failure_rate_7d: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        failure_rate_30d: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        flakiness_score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        total_tests: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        tests_with_risk_data: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        high_risk_tests: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        risk_level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        trend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        component: string;
        failure_rate_7d?: number | null | undefined;
        failure_rate_30d?: number | null | undefined;
        flakiness_score?: number | null | undefined;
        total_tests?: number | null | undefined;
        tests_with_risk_data?: number | null | undefined;
        high_risk_tests?: number | null | undefined;
        risk_level?: string | null | undefined;
        trend?: string | null | undefined;
    }, {
        component: string;
        failure_rate_7d?: number | null | undefined;
        failure_rate_30d?: number | null | undefined;
        flakiness_score?: number | null | undefined;
        total_tests?: number | null | undefined;
        tests_with_risk_data?: number | null | undefined;
        high_risk_tests?: number | null | undefined;
        risk_level?: string | null | undefined;
        trend?: string | null | undefined;
    }>, "many">>;
    dependencyBlast: z.ZodOptional<z.ZodObject<{
        changed_files: z.ZodArray<z.ZodString, "many">;
        expanded_files: z.ZodArray<z.ZodString, "many">;
        nodes: z.ZodArray<z.ZodObject<{
            file_path: z.ZodString;
            depth: z.ZodNumber;
            imported_by: z.ZodString;
            component_label: z.ZodOptional<z.ZodString>;
            chain: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            file_path: string;
            depth: number;
            imported_by: string;
            chain: string[];
            component_label?: string | undefined;
        }, {
            file_path: string;
            depth: number;
            imported_by: string;
            chain: string[];
            component_label?: string | undefined;
        }>, "many">;
        direct_dependents: z.ZodNumber;
        transitive_dependents: z.ZodNumber;
        total_expanded: z.ZodNumber;
        max_depth: z.ZodNumber;
        affected_components: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        has_structure: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        changed_files: string[];
        expanded_files: string[];
        nodes: {
            file_path: string;
            depth: number;
            imported_by: string;
            chain: string[];
            component_label?: string | undefined;
        }[];
        direct_dependents: number;
        transitive_dependents: number;
        total_expanded: number;
        max_depth: number;
        affected_components?: Record<string, number> | undefined;
        has_structure?: boolean | undefined;
    }, {
        changed_files: string[];
        expanded_files: string[];
        nodes: {
            file_path: string;
            depth: number;
            imported_by: string;
            chain: string[];
            component_label?: string | undefined;
        }[];
        direct_dependents: number;
        transitive_dependents: number;
        total_expanded: number;
        max_depth: number;
        affected_components?: Record<string, number> | undefined;
        has_structure?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    source: "none" | "git_refs" | "manual_diff";
    affectedTests: {
        confidence?: number | undefined;
        reason?: string | undefined;
        test_id?: number | undefined;
        test_name?: string | undefined;
        function_name?: string | undefined;
        confidence_score?: number | undefined;
        impact_level?: string | undefined;
        failure_rate_7d?: number | undefined;
        failure_rate_30d?: number | undefined;
        flakiness_score?: number | undefined;
        recent_failure_count?: number | undefined;
        component_label?: string | undefined;
        component_failure_rate_7d?: number | undefined;
        blast_source?: "direct" | "changed_file" | "transitive_d1" | "transitive_d2" | "transitive_d3" | "transitive_d4" | undefined;
        blast_depth?: number | undefined;
        blast_file_path?: string | undefined;
    }[];
    summary?: Record<string, unknown> | undefined;
    recommendations?: Record<string, unknown> | string[] | undefined;
    componentHealth?: {
        component: string;
        failure_rate_7d?: number | null | undefined;
        failure_rate_30d?: number | null | undefined;
        flakiness_score?: number | null | undefined;
        total_tests?: number | null | undefined;
        tests_with_risk_data?: number | null | undefined;
        high_risk_tests?: number | null | undefined;
        risk_level?: string | null | undefined;
        trend?: string | null | undefined;
    }[] | undefined;
    dependencyBlast?: {
        changed_files: string[];
        expanded_files: string[];
        nodes: {
            file_path: string;
            depth: number;
            imported_by: string;
            chain: string[];
            component_label?: string | undefined;
        }[];
        direct_dependents: number;
        transitive_dependents: number;
        total_expanded: number;
        max_depth: number;
        affected_components?: Record<string, number> | undefined;
        has_structure?: boolean | undefined;
    } | undefined;
}, {
    affectedTests: {
        confidence?: number | undefined;
        reason?: string | undefined;
        test_id?: number | undefined;
        test_name?: string | undefined;
        function_name?: string | undefined;
        confidence_score?: number | undefined;
        impact_level?: string | undefined;
        failure_rate_7d?: number | undefined;
        failure_rate_30d?: number | undefined;
        flakiness_score?: number | undefined;
        recent_failure_count?: number | undefined;
        component_label?: string | undefined;
        component_failure_rate_7d?: number | undefined;
        blast_source?: "direct" | "changed_file" | "transitive_d1" | "transitive_d2" | "transitive_d3" | "transitive_d4" | undefined;
        blast_depth?: number | undefined;
        blast_file_path?: string | undefined;
    }[];
    source?: "none" | "git_refs" | "manual_diff" | undefined;
    summary?: Record<string, unknown> | undefined;
    recommendations?: Record<string, unknown> | string[] | undefined;
    componentHealth?: {
        component: string;
        failure_rate_7d?: number | null | undefined;
        failure_rate_30d?: number | null | undefined;
        flakiness_score?: number | null | undefined;
        total_tests?: number | null | undefined;
        tests_with_risk_data?: number | null | undefined;
        high_risk_tests?: number | null | undefined;
        risk_level?: string | null | undefined;
        trend?: string | null | undefined;
    }[] | undefined;
    dependencyBlast?: {
        changed_files: string[];
        expanded_files: string[];
        nodes: {
            file_path: string;
            depth: number;
            imported_by: string;
            chain: string[];
            component_label?: string | undefined;
        }[];
        direct_dependents: number;
        transitive_dependents: number;
        total_expanded: number;
        max_depth: number;
        affected_components?: Record<string, number> | undefined;
        has_structure?: boolean | undefined;
    } | undefined;
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
            status: "modified" | "added" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }, {
            status: "modified" | "added" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        base_sha: string;
        head_sha: string;
        changed_files?: {
            status: "modified" | "added" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }[] | undefined;
        diff_content?: string | undefined;
    }, {
        base_sha: string;
        head_sha: string;
        changed_files?: {
            status: "modified" | "added" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }[] | undefined;
        diff_content?: string | undefined;
    }>;
    execution: z.ZodDefault<z.ZodObject<{
        run_impacted_tests: z.ZodDefault<z.ZodBoolean>;
        run_visual_regression: z.ZodDefault<z.ZodBoolean>;
        run_lighthouse: z.ZodDefault<z.ZodBoolean>;
        capture_replay: z.ZodDefault<z.ZodBoolean>;
        max_parallelism: z.ZodDefault<z.ZodNumber>;
        mode: z.ZodOptional<z.ZodEnum<["local", "cloud"]>>;
        platform: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        run_impacted_tests: boolean;
        run_visual_regression: boolean;
        run_lighthouse: boolean;
        capture_replay: boolean;
        max_parallelism: number;
        mode?: "local" | "cloud" | undefined;
        platform?: string | undefined;
    }, {
        run_impacted_tests?: boolean | undefined;
        run_visual_regression?: boolean | undefined;
        run_lighthouse?: boolean | undefined;
        capture_replay?: boolean | undefined;
        max_parallelism?: number | undefined;
        mode?: "local" | "cloud" | undefined;
        platform?: string | undefined;
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
    project_id: number;
    confirm: boolean;
    repository: {
        name: string;
        owner: string;
    };
    pull_request: {
        number: number;
        url?: string | undefined;
    };
    git: {
        base_sha: string;
        head_sha: string;
        changed_files?: {
            status: "modified" | "added" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }[] | undefined;
        diff_content?: string | undefined;
    };
    execution: {
        run_impacted_tests: boolean;
        run_visual_regression: boolean;
        run_lighthouse: boolean;
        capture_replay: boolean;
        max_parallelism: number;
        mode?: "local" | "cloud" | undefined;
        platform?: string | undefined;
    };
    output: {
        include_comment_draft: boolean;
        publish_comment: boolean;
    };
    idempotency_key?: string | undefined;
}, {
    project_id: number;
    repository: {
        name: string;
        owner: string;
    };
    pull_request: {
        number: number;
        url?: string | undefined;
    };
    git: {
        base_sha: string;
        head_sha: string;
        changed_files?: {
            status: "modified" | "added" | "deleted" | "renamed";
            path: string;
            additions?: number | undefined;
            deletions?: number | undefined;
            language?: string | undefined;
            patch?: string | undefined;
        }[] | undefined;
        diff_content?: string | undefined;
    };
    confirm?: boolean | undefined;
    execution?: {
        run_impacted_tests?: boolean | undefined;
        run_visual_regression?: boolean | undefined;
        run_lighthouse?: boolean | undefined;
        capture_replay?: boolean | undefined;
        max_parallelism?: number | undefined;
        mode?: "local" | "cloud" | undefined;
        platform?: string | undefined;
    } | undefined;
    output?: {
        include_comment_draft?: boolean | undefined;
        publish_comment?: boolean | undefined;
    } | undefined;
    idempotency_key?: string | undefined;
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
        pr_number: number;
        base_sha: string;
        head_sha: string;
    }, {
        name: string;
        owner: string;
        pr_number: number;
        base_sha: string;
        head_sha: string;
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
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }, {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
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
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }, {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
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
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }, {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
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
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }, {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        tests?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        visual?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        lighthouse?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        replay?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
    }, {
        tests?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        visual?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        lighthouse?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        replay?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
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
            kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
            id: string;
            name: string;
            contentType?: string | undefined;
            flow?: string | undefined;
            testId?: number | undefined;
            viewport?: string | undefined;
            metadata?: Record<string, unknown> | undefined;
        }, {
            url: string;
            kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
            id: string;
            name: string;
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
        status: "failed" | "passed" | "warning";
        id: string;
        confidence: number;
        relatedTestIds: number[];
        flow: string;
        source: "visual" | "lighthouse" | "replay" | "console" | "test";
        severity: "critical" | "high" | "medium" | "low" | "info";
        blocking: boolean;
        title: string;
        issue: string;
        changedFileHints: string[];
        evidence: {
            url: string;
            kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
            id: string;
            name: string;
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
        status: "failed" | "passed" | "warning";
        id: string;
        confidence: number;
        relatedTestIds: number[];
        flow: string;
        source: "visual" | "lighthouse" | "replay" | "console" | "test";
        severity: "critical" | "high" | "medium" | "low" | "info";
        blocking: boolean;
        title: string;
        issue: string;
        changedFileHints: string[];
        evidence: {
            url: string;
            kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
            id: string;
            name: string;
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
        risk_score: z.ZodNumber;
        risk_level: z.ZodEnum<["PASS", "WARN", "BLOCK"]>;
        risk_factors: z.ZodArray<z.ZodObject<{
            factor: z.ZodString;
            score: z.ZodNumber;
            weight: z.ZodNumber;
            explanation: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            factor: string;
            score: number;
            weight: number;
            explanation: string;
        }, {
            factor: string;
            score: number;
            weight: number;
            explanation: string;
        }>, "many">;
        component_health: z.ZodOptional<z.ZodArray<z.ZodObject<{
            component: z.ZodString;
            failure_rate_7d: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            failure_rate_30d: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            flakiness_score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            total_tests: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            tests_with_risk_data: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            high_risk_tests: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            risk_level: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            trend: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            component: string;
            failure_rate_7d?: number | null | undefined;
            failure_rate_30d?: number | null | undefined;
            flakiness_score?: number | null | undefined;
            total_tests?: number | null | undefined;
            tests_with_risk_data?: number | null | undefined;
            high_risk_tests?: number | null | undefined;
            risk_level?: string | null | undefined;
            trend?: string | null | undefined;
        }, {
            component: string;
            failure_rate_7d?: number | null | undefined;
            failure_rate_30d?: number | null | undefined;
            flakiness_score?: number | null | undefined;
            total_tests?: number | null | undefined;
            tests_with_risk_data?: number | null | undefined;
            high_risk_tests?: number | null | undefined;
            risk_level?: string | null | undefined;
            trend?: string | null | undefined;
        }>, "many">>;
        dependency_blast: z.ZodOptional<z.ZodObject<{
            changed_files: z.ZodArray<z.ZodString, "many">;
            expanded_files: z.ZodArray<z.ZodString, "many">;
            nodes: z.ZodArray<z.ZodObject<{
                file_path: z.ZodString;
                depth: z.ZodNumber;
                imported_by: z.ZodString;
                component_label: z.ZodOptional<z.ZodString>;
                chain: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                file_path: string;
                depth: number;
                imported_by: string;
                chain: string[];
                component_label?: string | undefined;
            }, {
                file_path: string;
                depth: number;
                imported_by: string;
                chain: string[];
                component_label?: string | undefined;
            }>, "many">;
            direct_dependents: z.ZodNumber;
            transitive_dependents: z.ZodNumber;
            total_expanded: z.ZodNumber;
            max_depth: z.ZodNumber;
            affected_components: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
            has_structure: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            changed_files: string[];
            expanded_files: string[];
            nodes: {
                file_path: string;
                depth: number;
                imported_by: string;
                chain: string[];
                component_label?: string | undefined;
            }[];
            direct_dependents: number;
            transitive_dependents: number;
            total_expanded: number;
            max_depth: number;
            affected_components?: Record<string, number> | undefined;
            has_structure?: boolean | undefined;
        }, {
            changed_files: string[];
            expanded_files: string[];
            nodes: {
                file_path: string;
                depth: number;
                imported_by: string;
                chain: string[];
                component_label?: string | undefined;
            }[];
            direct_dependents: number;
            transitive_dependents: number;
            total_expanded: number;
            max_depth: number;
            affected_components?: Record<string, number> | undefined;
            has_structure?: boolean | undefined;
        }>>;
        blast_test_summary: z.ZodOptional<z.ZodObject<{
            total_blast_tests: z.ZodNumber;
            tests_from_changed_files: z.ZodNumber;
            tests_from_transitive: z.ZodNumber;
            high_risk_transitive: z.ZodOptional<z.ZodNumber>;
            unique_components: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            total_blast_tests: number;
            tests_from_changed_files: number;
            tests_from_transitive: number;
            high_risk_transitive?: number | undefined;
            unique_components?: number | undefined;
        }, {
            total_blast_tests: number;
            tests_from_changed_files: number;
            tests_from_transitive: number;
            high_risk_transitive?: number | undefined;
            unique_components?: number | undefined;
        }>>;
        incident_context: z.ZodOptional<z.ZodObject<{
            contract_version: z.ZodLiteral<"incident_context.v1">;
            project_id: z.ZodNumber;
            match_count: z.ZodNumber;
            incident_match_score: z.ZodNumber;
            match_tier: z.ZodEnum<["none", "low", "medium", "high"]>;
            matches: z.ZodArray<z.ZodObject<{
                match_id: z.ZodString;
                match_type: z.ZodEnum<["prior_validation", "failure_pattern", "resolution", "test_history"]>;
                title: z.ZodString;
                description: z.ZodString;
                match_score: z.ZodNumber;
                match_tier: z.ZodEnum<["none", "low", "medium", "high"]>;
                component: z.ZodOptional<z.ZodString>;
                workflow_id: z.ZodOptional<z.ZodString>;
                pr_number: z.ZodOptional<z.ZodNumber>;
                risk_level: z.ZodOptional<z.ZodString>;
                risk_score: z.ZodOptional<z.ZodNumber>;
                pattern_label: z.ZodOptional<z.ZodString>;
                pattern_occurrences: z.ZodOptional<z.ZodNumber>;
                resolution_action: z.ZodOptional<z.ZodString>;
                root_cause: z.ZodOptional<z.ZodString>;
                success_rate: z.ZodOptional<z.ZodNumber>;
                cases_count: z.ZodOptional<z.ZodNumber>;
                avg_resolve_minutes: z.ZodOptional<z.ZodNumber>;
                occurred_at: z.ZodOptional<z.ZodString>;
                related_test_ids: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
                overlapping_files: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                resolved_by_name: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                title: string;
                match_id: string;
                match_type: "prior_validation" | "failure_pattern" | "resolution" | "test_history";
                description: string;
                match_score: number;
                match_tier: "none" | "high" | "medium" | "low";
                component?: string | undefined;
                risk_level?: string | undefined;
                workflow_id?: string | undefined;
                pr_number?: number | undefined;
                risk_score?: number | undefined;
                pattern_label?: string | undefined;
                pattern_occurrences?: number | undefined;
                resolution_action?: string | undefined;
                root_cause?: string | undefined;
                success_rate?: number | undefined;
                cases_count?: number | undefined;
                avg_resolve_minutes?: number | undefined;
                occurred_at?: string | undefined;
                related_test_ids?: number[] | undefined;
                overlapping_files?: string[] | undefined;
                resolved_by_name?: string | undefined;
            }, {
                title: string;
                match_id: string;
                match_type: "prior_validation" | "failure_pattern" | "resolution" | "test_history";
                description: string;
                match_score: number;
                match_tier: "none" | "high" | "medium" | "low";
                component?: string | undefined;
                risk_level?: string | undefined;
                workflow_id?: string | undefined;
                pr_number?: number | undefined;
                risk_score?: number | undefined;
                pattern_label?: string | undefined;
                pattern_occurrences?: number | undefined;
                resolution_action?: string | undefined;
                root_cause?: string | undefined;
                success_rate?: number | undefined;
                cases_count?: number | undefined;
                avg_resolve_minutes?: number | undefined;
                occurred_at?: string | undefined;
                related_test_ids?: number[] | undefined;
                overlapping_files?: string[] | undefined;
                resolved_by_name?: string | undefined;
            }>, "many">;
            top_resolution: z.ZodOptional<z.ZodObject<{
                action: z.ZodString;
                root_cause: z.ZodOptional<z.ZodString>;
                success_rate: z.ZodOptional<z.ZodNumber>;
                cases_count: z.ZodNumber;
                avg_resolve_minutes: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                cases_count: number;
                action: string;
                root_cause?: string | undefined;
                success_rate?: number | undefined;
                avg_resolve_minutes?: number | undefined;
            }, {
                cases_count: number;
                action: string;
                root_cause?: string | undefined;
                success_rate?: number | undefined;
                avg_resolve_minutes?: number | undefined;
            }>>;
            insight: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            contract_version: "incident_context.v1";
            project_id: number;
            match_tier: "none" | "high" | "medium" | "low";
            match_count: number;
            incident_match_score: number;
            matches: {
                title: string;
                match_id: string;
                match_type: "prior_validation" | "failure_pattern" | "resolution" | "test_history";
                description: string;
                match_score: number;
                match_tier: "none" | "high" | "medium" | "low";
                component?: string | undefined;
                risk_level?: string | undefined;
                workflow_id?: string | undefined;
                pr_number?: number | undefined;
                risk_score?: number | undefined;
                pattern_label?: string | undefined;
                pattern_occurrences?: number | undefined;
                resolution_action?: string | undefined;
                root_cause?: string | undefined;
                success_rate?: number | undefined;
                cases_count?: number | undefined;
                avg_resolve_minutes?: number | undefined;
                occurred_at?: string | undefined;
                related_test_ids?: number[] | undefined;
                overlapping_files?: string[] | undefined;
                resolved_by_name?: string | undefined;
            }[];
            insight: string;
            top_resolution?: {
                cases_count: number;
                action: string;
                root_cause?: string | undefined;
                success_rate?: number | undefined;
                avg_resolve_minutes?: number | undefined;
            } | undefined;
        }, {
            contract_version: "incident_context.v1";
            project_id: number;
            match_tier: "none" | "high" | "medium" | "low";
            match_count: number;
            incident_match_score: number;
            matches: {
                title: string;
                match_id: string;
                match_type: "prior_validation" | "failure_pattern" | "resolution" | "test_history";
                description: string;
                match_score: number;
                match_tier: "none" | "high" | "medium" | "low";
                component?: string | undefined;
                risk_level?: string | undefined;
                workflow_id?: string | undefined;
                pr_number?: number | undefined;
                risk_score?: number | undefined;
                pattern_label?: string | undefined;
                pattern_occurrences?: number | undefined;
                resolution_action?: string | undefined;
                root_cause?: string | undefined;
                success_rate?: number | undefined;
                cases_count?: number | undefined;
                avg_resolve_minutes?: number | undefined;
                occurred_at?: string | undefined;
                related_test_ids?: number[] | undefined;
                overlapping_files?: string[] | undefined;
                resolved_by_name?: string | undefined;
            }[];
            insight: string;
            top_resolution?: {
                cases_count: number;
                action: string;
                root_cause?: string | undefined;
                success_rate?: number | undefined;
                avg_resolve_minutes?: number | undefined;
            } | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        risk_level: "PASS" | "WARN" | "BLOCK";
        risk_score: number;
        blocking_count: number;
        warning_count: number;
        passed_count: number;
        highest_severity: "critical" | "high" | "medium" | "low" | "info";
        merge_signal: "clean" | "review" | "block";
        risk_factors: {
            factor: string;
            score: number;
            weight: number;
            explanation: string;
        }[];
        component_health?: {
            component: string;
            failure_rate_7d?: number | null | undefined;
            failure_rate_30d?: number | null | undefined;
            flakiness_score?: number | null | undefined;
            total_tests?: number | null | undefined;
            tests_with_risk_data?: number | null | undefined;
            high_risk_tests?: number | null | undefined;
            risk_level?: string | null | undefined;
            trend?: string | null | undefined;
        }[] | undefined;
        dependency_blast?: {
            changed_files: string[];
            expanded_files: string[];
            nodes: {
                file_path: string;
                depth: number;
                imported_by: string;
                chain: string[];
                component_label?: string | undefined;
            }[];
            direct_dependents: number;
            transitive_dependents: number;
            total_expanded: number;
            max_depth: number;
            affected_components?: Record<string, number> | undefined;
            has_structure?: boolean | undefined;
        } | undefined;
        blast_test_summary?: {
            total_blast_tests: number;
            tests_from_changed_files: number;
            tests_from_transitive: number;
            high_risk_transitive?: number | undefined;
            unique_components?: number | undefined;
        } | undefined;
        incident_context?: {
            contract_version: "incident_context.v1";
            project_id: number;
            match_tier: "none" | "high" | "medium" | "low";
            match_count: number;
            incident_match_score: number;
            matches: {
                title: string;
                match_id: string;
                match_type: "prior_validation" | "failure_pattern" | "resolution" | "test_history";
                description: string;
                match_score: number;
                match_tier: "none" | "high" | "medium" | "low";
                component?: string | undefined;
                risk_level?: string | undefined;
                workflow_id?: string | undefined;
                pr_number?: number | undefined;
                risk_score?: number | undefined;
                pattern_label?: string | undefined;
                pattern_occurrences?: number | undefined;
                resolution_action?: string | undefined;
                root_cause?: string | undefined;
                success_rate?: number | undefined;
                cases_count?: number | undefined;
                avg_resolve_minutes?: number | undefined;
                occurred_at?: string | undefined;
                related_test_ids?: number[] | undefined;
                overlapping_files?: string[] | undefined;
                resolved_by_name?: string | undefined;
            }[];
            insight: string;
            top_resolution?: {
                cases_count: number;
                action: string;
                root_cause?: string | undefined;
                success_rate?: number | undefined;
                avg_resolve_minutes?: number | undefined;
            } | undefined;
        } | undefined;
    }, {
        risk_level: "PASS" | "WARN" | "BLOCK";
        risk_score: number;
        blocking_count: number;
        warning_count: number;
        passed_count: number;
        highest_severity: "critical" | "high" | "medium" | "low" | "info";
        merge_signal: "clean" | "review" | "block";
        risk_factors: {
            factor: string;
            score: number;
            weight: number;
            explanation: string;
        }[];
        component_health?: {
            component: string;
            failure_rate_7d?: number | null | undefined;
            failure_rate_30d?: number | null | undefined;
            flakiness_score?: number | null | undefined;
            total_tests?: number | null | undefined;
            tests_with_risk_data?: number | null | undefined;
            high_risk_tests?: number | null | undefined;
            risk_level?: string | null | undefined;
            trend?: string | null | undefined;
        }[] | undefined;
        dependency_blast?: {
            changed_files: string[];
            expanded_files: string[];
            nodes: {
                file_path: string;
                depth: number;
                imported_by: string;
                chain: string[];
                component_label?: string | undefined;
            }[];
            direct_dependents: number;
            transitive_dependents: number;
            total_expanded: number;
            max_depth: number;
            affected_components?: Record<string, number> | undefined;
            has_structure?: boolean | undefined;
        } | undefined;
        blast_test_summary?: {
            total_blast_tests: number;
            tests_from_changed_files: number;
            tests_from_transitive: number;
            high_risk_transitive?: number | undefined;
            unique_components?: number | undefined;
        } | undefined;
        incident_context?: {
            contract_version: "incident_context.v1";
            project_id: number;
            match_tier: "none" | "high" | "medium" | "low";
            match_count: number;
            incident_match_score: number;
            matches: {
                title: string;
                match_id: string;
                match_type: "prior_validation" | "failure_pattern" | "resolution" | "test_history";
                description: string;
                match_score: number;
                match_tier: "none" | "high" | "medium" | "low";
                component?: string | undefined;
                risk_level?: string | undefined;
                workflow_id?: string | undefined;
                pr_number?: number | undefined;
                risk_score?: number | undefined;
                pattern_label?: string | undefined;
                pattern_occurrences?: number | undefined;
                resolution_action?: string | undefined;
                root_cause?: string | undefined;
                success_rate?: number | undefined;
                cases_count?: number | undefined;
                avg_resolve_minutes?: number | undefined;
                occurred_at?: string | undefined;
                related_test_ids?: number[] | undefined;
                overlapping_files?: string[] | undefined;
                resolved_by_name?: string | undefined;
            }[];
            insight: string;
            top_resolution?: {
                cases_count: number;
                action: string;
                root_cause?: string | undefined;
                success_rate?: number | undefined;
                avg_resolve_minutes?: number | undefined;
            } | undefined;
        } | undefined;
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
            severity: "critical" | "high" | "medium" | "low" | "info";
            path?: string | undefined;
        }, {
            body: string;
            severity: "critical" | "high" | "medium" | "low" | "info";
            path?: string | undefined;
        }>, "many">;
        riskFactors: z.ZodOptional<z.ZodArray<z.ZodObject<{
            factor: z.ZodString;
            score: z.ZodNumber;
            weight: z.ZodNumber;
            explanation: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            factor: string;
            score: number;
            weight: number;
            explanation: string;
        }, {
            factor: string;
            score: number;
            weight: number;
            explanation: string;
        }>, "many">>;
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
            severity: "critical" | "high" | "medium" | "low" | "info";
            path?: string | undefined;
        }[];
        riskFactors?: {
            factor: string;
            score: number;
            weight: number;
            explanation: string;
        }[] | undefined;
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
            severity: "critical" | "high" | "medium" | "low" | "info";
            path?: string | undefined;
        }[];
        riskFactors?: {
            factor: string;
            score: number;
            weight: number;
            explanation: string;
        }[] | undefined;
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
    status: "failed" | "passed" | "partial";
    contract_version: "pr_validation.v1";
    project_id: number;
    metadata: {
        execution_mode: "planned_only" | "executed";
        replayed: boolean;
        impact_source: "none" | "git_refs" | "manual_diff";
    };
    repository: {
        name: string;
        owner: string;
        pr_number: number;
        base_sha: string;
        head_sha: string;
    };
    findings: {
        status: "failed" | "passed" | "warning";
        id: string;
        confidence: number;
        relatedTestIds: number[];
        flow: string;
        source: "visual" | "lighthouse" | "replay" | "console" | "test";
        severity: "critical" | "high" | "medium" | "low" | "info";
        blocking: boolean;
        title: string;
        issue: string;
        changedFileHints: string[];
        evidence: {
            url: string;
            kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
            id: string;
            name: string;
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
    workflow_id: string;
    impact_summary: {
        changed_files: number;
        impacted_flows: number;
        impacted_tests: number;
    };
    execution_summary: {
        tests?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        visual?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        lighthouse?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        replay?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
    };
    ai_ready_summary: {
        risk_level: "PASS" | "WARN" | "BLOCK";
        risk_score: number;
        blocking_count: number;
        warning_count: number;
        passed_count: number;
        highest_severity: "critical" | "high" | "medium" | "low" | "info";
        merge_signal: "clean" | "review" | "block";
        risk_factors: {
            factor: string;
            score: number;
            weight: number;
            explanation: string;
        }[];
        component_health?: {
            component: string;
            failure_rate_7d?: number | null | undefined;
            failure_rate_30d?: number | null | undefined;
            flakiness_score?: number | null | undefined;
            total_tests?: number | null | undefined;
            tests_with_risk_data?: number | null | undefined;
            high_risk_tests?: number | null | undefined;
            risk_level?: string | null | undefined;
            trend?: string | null | undefined;
        }[] | undefined;
        dependency_blast?: {
            changed_files: string[];
            expanded_files: string[];
            nodes: {
                file_path: string;
                depth: number;
                imported_by: string;
                chain: string[];
                component_label?: string | undefined;
            }[];
            direct_dependents: number;
            transitive_dependents: number;
            total_expanded: number;
            max_depth: number;
            affected_components?: Record<string, number> | undefined;
            has_structure?: boolean | undefined;
        } | undefined;
        blast_test_summary?: {
            total_blast_tests: number;
            tests_from_changed_files: number;
            tests_from_transitive: number;
            high_risk_transitive?: number | undefined;
            unique_components?: number | undefined;
        } | undefined;
        incident_context?: {
            contract_version: "incident_context.v1";
            project_id: number;
            match_tier: "none" | "high" | "medium" | "low";
            match_count: number;
            incident_match_score: number;
            matches: {
                title: string;
                match_id: string;
                match_type: "prior_validation" | "failure_pattern" | "resolution" | "test_history";
                description: string;
                match_score: number;
                match_tier: "none" | "high" | "medium" | "low";
                component?: string | undefined;
                risk_level?: string | undefined;
                workflow_id?: string | undefined;
                pr_number?: number | undefined;
                risk_score?: number | undefined;
                pattern_label?: string | undefined;
                pattern_occurrences?: number | undefined;
                resolution_action?: string | undefined;
                root_cause?: string | undefined;
                success_rate?: number | undefined;
                cases_count?: number | undefined;
                avg_resolve_minutes?: number | undefined;
                occurred_at?: string | undefined;
                related_test_ids?: number[] | undefined;
                overlapping_files?: string[] | undefined;
                resolved_by_name?: string | undefined;
            }[];
            insight: string;
            top_resolution?: {
                cases_count: number;
                action: string;
                root_cause?: string | undefined;
                success_rate?: number | undefined;
                avg_resolve_minutes?: number | undefined;
            } | undefined;
        } | undefined;
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
            severity: "critical" | "high" | "medium" | "low" | "info";
            path?: string | undefined;
        }[];
        riskFactors?: {
            factor: string;
            score: number;
            weight: number;
            explanation: string;
        }[] | undefined;
    } | undefined;
    comment_draft?: string | undefined;
}, {
    status: "failed" | "passed" | "partial";
    contract_version: "pr_validation.v1";
    project_id: number;
    repository: {
        name: string;
        owner: string;
        pr_number: number;
        base_sha: string;
        head_sha: string;
    };
    findings: {
        status: "failed" | "passed" | "warning";
        id: string;
        confidence: number;
        relatedTestIds: number[];
        flow: string;
        source: "visual" | "lighthouse" | "replay" | "console" | "test";
        severity: "critical" | "high" | "medium" | "low" | "info";
        blocking: boolean;
        title: string;
        issue: string;
        changedFileHints: string[];
        evidence: {
            url: string;
            kind: "lighthouse" | "replay" | "screenshot" | "visual_diff" | "console" | "trace";
            id: string;
            name: string;
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
    workflow_id: string;
    impact_summary: {
        changed_files: number;
        impacted_flows: number;
        impacted_tests: number;
    };
    execution_summary: {
        tests?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        visual?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        lighthouse?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
        replay?: {
            status: "failed" | "queued" | "running" | "passed" | "partial";
            stage: "tests" | "visual" | "lighthouse" | "replay";
            startedAt?: string | undefined;
            completedAt?: string | undefined;
            runId?: string | undefined;
            executionIds?: string[] | undefined;
            dashboardUrl?: string | undefined;
            rawResultRef?: string | undefined;
        } | undefined;
    };
    ai_ready_summary: {
        risk_level: "PASS" | "WARN" | "BLOCK";
        risk_score: number;
        blocking_count: number;
        warning_count: number;
        passed_count: number;
        highest_severity: "critical" | "high" | "medium" | "low" | "info";
        merge_signal: "clean" | "review" | "block";
        risk_factors: {
            factor: string;
            score: number;
            weight: number;
            explanation: string;
        }[];
        component_health?: {
            component: string;
            failure_rate_7d?: number | null | undefined;
            failure_rate_30d?: number | null | undefined;
            flakiness_score?: number | null | undefined;
            total_tests?: number | null | undefined;
            tests_with_risk_data?: number | null | undefined;
            high_risk_tests?: number | null | undefined;
            risk_level?: string | null | undefined;
            trend?: string | null | undefined;
        }[] | undefined;
        dependency_blast?: {
            changed_files: string[];
            expanded_files: string[];
            nodes: {
                file_path: string;
                depth: number;
                imported_by: string;
                chain: string[];
                component_label?: string | undefined;
            }[];
            direct_dependents: number;
            transitive_dependents: number;
            total_expanded: number;
            max_depth: number;
            affected_components?: Record<string, number> | undefined;
            has_structure?: boolean | undefined;
        } | undefined;
        blast_test_summary?: {
            total_blast_tests: number;
            tests_from_changed_files: number;
            tests_from_transitive: number;
            high_risk_transitive?: number | undefined;
            unique_components?: number | undefined;
        } | undefined;
        incident_context?: {
            contract_version: "incident_context.v1";
            project_id: number;
            match_tier: "none" | "high" | "medium" | "low";
            match_count: number;
            incident_match_score: number;
            matches: {
                title: string;
                match_id: string;
                match_type: "prior_validation" | "failure_pattern" | "resolution" | "test_history";
                description: string;
                match_score: number;
                match_tier: "none" | "high" | "medium" | "low";
                component?: string | undefined;
                risk_level?: string | undefined;
                workflow_id?: string | undefined;
                pr_number?: number | undefined;
                risk_score?: number | undefined;
                pattern_label?: string | undefined;
                pattern_occurrences?: number | undefined;
                resolution_action?: string | undefined;
                root_cause?: string | undefined;
                success_rate?: number | undefined;
                cases_count?: number | undefined;
                avg_resolve_minutes?: number | undefined;
                occurred_at?: string | undefined;
                related_test_ids?: number[] | undefined;
                overlapping_files?: string[] | undefined;
                resolved_by_name?: string | undefined;
            }[];
            insight: string;
            top_resolution?: {
                cases_count: number;
                action: string;
                root_cause?: string | undefined;
                success_rate?: number | undefined;
                avg_resolve_minutes?: number | undefined;
            } | undefined;
        } | undefined;
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
            severity: "critical" | "high" | "medium" | "low" | "info";
            path?: string | undefined;
        }[];
        riskFactors?: {
            factor: string;
            score: number;
            weight: number;
            explanation: string;
        }[] | undefined;
    } | undefined;
    comment_draft?: string | undefined;
}>;
export type ValidatePrResponse = z.infer<typeof ValidatePrResponseSchema>;
