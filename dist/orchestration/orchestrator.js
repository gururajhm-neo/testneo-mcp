"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrValidationOrchestrator = void 0;
const node_crypto_1 = require("node:crypto");
const contracts_js_1 = require("./contracts.js");
const riskScorer_js_1 = require("./riskScorer.js");
const SEVERITY_ORDER = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
};
class PrValidationOrchestrator {
    deps;
    now;
    constructor(deps) {
        this.deps = deps;
        this.now = deps.now ?? (() => new Date());
    }
    async validatePr(rawRequest) {
        const request = contracts_js_1.ValidatePrRequestSchema.parse(rawRequest);
        const idempotencyKey = request.idempotency_key?.trim() || this.buildIdempotencyKey(request);
        const existing = await this.deps.store.getByIdempotencyKey(idempotencyKey);
        if (existing) {
            return this.buildResponse(existing, request.output.include_comment_draft, {
                replayed: true,
                executionMode: this.executionModeForContext(existing),
                impactSource: String(existing.metadata.impact_source ?? "none"),
                incidentContext: existing.metadata.incident_context,
            });
        }
        const context = this.createInitialContext(request, idempotencyKey);
        let executionMode = "planned_only";
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
        // Compute risk score early so findings can reference it.
        // Sprint 2: component history factor; Sprint 3: dependency blast factor.
        let riskResult = (0, riskScorer_js_1.computeRiskScore)(context.changes.changedFiles, impact.affectedTests, impact.componentHealth ?? [], impact.dependencyBlast);
        // Persist component health snapshot in context metadata for UI retrieval
        if (impact.componentHealth?.length) {
            context.metadata.component_health = impact.componentHealth;
        }
        // Sprint 3: Persist dependency blast snapshot + blast test summary in metadata
        if (impact.dependencyBlast?.has_structure) {
            context.metadata.dependency_blast = impact.dependencyBlast;
        }
        // Sprint 3 complete flow: blast→test bridge summary (gap metric)
        const blastTestSummary = impact.blastTestSummary;
        if (blastTestSummary) {
            context.metadata.blast_test_summary = blastTestSummary;
        }
        // Sprint 3: count direct vs transitive tests for logging
        const directTestCount = impact.affectedTests.filter((t) => !t.blast_source || t.blast_source === "direct" || t.blast_source === "changed_file").length;
        const transitiveTestCount = impact.affectedTests.filter((t) => t.blast_source && t.blast_source !== "direct" && t.blast_source !== "changed_file").length;
        if (transitiveTestCount > 0) {
            context.metadata.transitive_test_count = transitiveTestCount;
            context.metadata.direct_test_count = directTestCount;
        }
        context.metadata.risk_score = riskResult.risk_score;
        context.metadata.risk_level = riskResult.risk_level;
        context.status = "aggregating";
        context.updatedAt = this.nowIso();
        context.findings = this.normalizeFindings(impact.affectedTests, request, riskResult);
        context.suggestedFixes = [...new Set(context.findings.flatMap((finding) => finding.suggestedFixes))];
        await this.deps.store.saveSnapshot(context);
        await this.appendEvent(context.id, "results.aggregated", {
            findings: context.findings.length,
            suggested_fixes: context.suggestedFixes.length,
            risk_score: riskResult.risk_score,
            risk_level: riskResult.risk_level,
        });
        if (this.deps.testExecutor &&
            this.deps.enableTestExecution !== false &&
            request.confirm &&
            request.execution.run_impacted_tests &&
            impact.affectedTests.length > 0) {
            executionMode = "executed";
            context.status = "executing";
            context.updatedAt = this.nowIso();
            context.runs.tests = {
                stage: "tests",
                status: "running",
                startedAt: this.nowIso(),
            };
            await this.deps.store.saveSnapshot(context);
            await this.appendEvent(context.id, "tests.execution_started", { impacted_tests: impact.affectedTests.length }, "tests");
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
                await this.appendEvent(context.id, "tests.execution_completed", {
                    status: testExecution.stageRun.status,
                    executions: testExecution.stageRun.executionIds?.length ?? 0,
                    findings: testExecution.findings.length,
                }, "tests");
            }
            catch (error) {
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
                await this.appendEvent(context.id, "tests.execution_failed", { message: this.errorMessage(error) }, "tests");
            }
            context.updatedAt = this.nowIso();
            await this.deps.store.saveSnapshot(context);
        }
        // Engineering Memory — prior validations, failure patterns, resolutions
        let incidentContext;
        if (this.deps.incidentContextAdapter) {
            try {
                incidentContext = await this.deps.incidentContextAdapter.lookup({
                    request,
                    context,
                    findings: context.findings,
                    affectedTests: impact.affectedTests,
                });
                if (incidentContext) {
                    context.metadata.incident_context = incidentContext;
                    // ── Blend Engineering Memory into the risk score (15% weight) ───────
                    // Base score is deterministic (blast radius, historical rate, etc).
                    // Engineering Memory amplifies it when prior incidents signal the same risk.
                    const memScore = incidentContext.incident_match_score ?? 0;
                    if (memScore > 0) {
                        const baseScore = riskResult.risk_score;
                        const blendedScore = Math.round(Math.min(100, baseScore * 0.85 + memScore * 0.15));
                        const blendedLevel = blendedScore >= 70 ? "BLOCK" : blendedScore >= 40 ? "WARN" : "PASS";
                        // Update riskResult in-place so buildResponse + comment draft use the final number
                        riskResult = {
                            ...riskResult,
                            risk_score: blendedScore,
                            risk_level: blendedLevel,
                            merge_signal: blendedLevel === "BLOCK" ? "block" : blendedLevel === "WARN" ? "review" : "clean",
                            merge_recommendation: blendedLevel === "BLOCK" ? "request_changes" : blendedLevel === "WARN" ? "hold" : "merge",
                            risk_factors: [
                                ...(riskResult.risk_factors ?? []),
                                {
                                    factor: "engineering_memory",
                                    score: memScore,
                                    weight: 0.15,
                                    explanation: `Engineering Memory matched ${incidentContext.match_count} historical signal(s) ` +
                                        `(${incidentContext.match_tier.toUpperCase()}, ${memScore}/100). ` +
                                        (incidentContext.top_resolution
                                            ? `Top fix: "${incidentContext.top_resolution.action.slice(0, 80)}".`
                                            : ""),
                                },
                            ],
                        };
                        context.metadata.risk_score = blendedScore;
                        context.metadata.risk_level = blendedLevel;
                    }
                    await this.appendEvent(context.id, "incident.context_resolved", {
                        match_count: incidentContext.match_count,
                        incident_match_score: incidentContext.incident_match_score,
                        match_tier: incidentContext.match_tier,
                    });
                    await this.deps.store.saveSnapshot(context);
                }
            }
            catch {
                // Non-blocking — validation continues without memory enrichment
            }
        }
        context.status = "analyzing";
        context.updatedAt = this.nowIso();
        const claudeAnalysis = (await this.deps.claudeAnalyzer?.analyze({ request, context, impact })) ??
            this.buildRiskDrivenAnalysis(context, riskResult);
        context.ai = claudeAnalysis;
        await this.deps.store.saveSnapshot(context);
        await this.appendEvent(context.id, "claude.analysis_completed", {
            merge_recommendation: claudeAnalysis.mergeRecommendation,
            confidence: claudeAnalysis.confidence,
            risk_score: riskResult.risk_score,
            risk_level: riskResult.risk_level,
        });
        context.status = this.finalizeContextStatus(context, executionMode);
        context.updatedAt = this.nowIso();
        context.metadata.execution_mode = executionMode;
        await this.deps.store.saveSnapshot(context);
        await this.appendEvent(context.id, "workflow.completed", { status: context.status });
        return this.buildResponse(context, request.output.include_comment_draft, {
            replayed: false,
            executionMode,
            impactSource: impact.source,
            riskResult,
            incidentContext,
        });
    }
    createInitialContext(request, idempotencyKey) {
        const now = this.nowIso();
        return {
            id: (0, node_crypto_1.randomUUID)(),
            kind: "pr_validation",
            status: "initialized",
            correlationId: (0, node_crypto_1.randomUUID)(),
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
    buildIdempotencyKey(request) {
        return `github:${request.repository.owner}/${request.repository.name}:pr:${request.pull_request.number}:head:${request.git.head_sha}`;
    }
    inferImpactedFlows(affectedTests) {
        const byName = new Map();
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
    buildStagePlan(request, impactedTestsCount, impactedFlowsCount) {
        const runs = {};
        const unavailableRequestedStages = [];
        if (request.execution.run_impacted_tests && impactedTestsCount > 0 && this.deps.testExecutor) {
            runs.tests = { stage: "tests", status: "queued" };
        }
        else if (request.execution.run_impacted_tests && impactedTestsCount > 0) {
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
    /**
     * Converts impact analysis candidates into structured VerificationFindings.
     * GAP 1 FIX: blocking is now driven by severity + historical risk signals.
     * A finding is blocking when:
     *   - severity is critical or high AND confidence ≥ 0.6, OR
     *   - historical failure_rate_7d ≥ 0.4 (failed 40%+ of the time recently), OR
     *   - risk_level is BLOCK (aggregate signal)
     */
    normalizeFindings(affectedTests, request, riskResult) {
        const changedFileHints = (request.git.changed_files ?? []).map((file) => file.path);
        const isBlockingRisk = riskResult.risk_level === "BLOCK";
        return affectedTests.map((candidate, index) => {
            const severity = this.normalizeSeverity(candidate.impact_level);
            const confidence = candidate.confidence ?? candidate.confidence_score ?? 0.5;
            const testName = candidate.test_name?.trim() || `Impacted Test ${index + 1}`;
            const flow = candidate.function_name?.trim() || testName;
            // GAP 1: Determine blocking status — no longer hardcoded false
            const isCriticalOrHigh = severity === "critical" || severity === "high";
            const hasHighHistoricalFailure = (candidate.failure_rate_7d ?? 0) >= 0.4;
            const blocking = (isCriticalOrHigh && confidence >= 0.6) ||
                hasHighHistoricalFailure ||
                (isBlockingRisk && isCriticalOrHigh);
            // Status: "failed" for blocking findings, "warning" for review-worthy, "passed" only after execution
            const status = blocking ? "failed" : "warning";
            // Build rich issue description including historical signals
            const historyNote = candidate.failure_rate_7d !== undefined
                ? ` Historical failure rate: ${Math.round(candidate.failure_rate_7d * 100)}% (7d)${candidate.flakiness_score !== undefined
                    ? `, flakiness: ${Math.round(candidate.flakiness_score * 100)}%`
                    : ""}.`
                : "";
            const issue = (candidate.reason?.trim() || "Code impact analysis identified this test as potentially affected.") +
                historyNote;
            const suggestedFixes = [
                `Review ${testName} before merge.`,
                "Run impacted validation stages to confirm runtime behavior.",
            ];
            if (hasHighHistoricalFailure) {
                suggestedFixes.push(`This test has a high historical failure rate (${Math.round((candidate.failure_rate_7d ?? 0) * 100)}%). Investigate root cause before merging.`);
            }
            if (blocking) {
                suggestedFixes.push("This finding is blocking. Resolve before merging.");
            }
            return {
                id: `finding-${index + 1}`,
                source: "test",
                status,
                severity,
                blocking,
                flow,
                title: blocking
                    ? `Blocking: ${testName} requires verification`
                    : `Review impacted coverage for ${testName}`,
                issue,
                rootCauseHint: candidate.function_name?.trim()
                    ? `Recent changes touched ${candidate.function_name}.`
                    : "Review the changed logic and its linked coverage.",
                changedFileHints,
                relatedTestIds: typeof candidate.test_id === "number" ? [candidate.test_id] : [],
                evidence: [],
                suggestedFixes,
                confidence,
            };
        });
    }
    normalizeSeverity(level) {
        switch ((level || "").trim().toLowerCase()) {
            case "critical": return "critical";
            case "high": return "high";
            case "medium": return "medium";
            case "low": return "low";
            default: return "info";
        }
    }
    /**
     * GAP 5: Risk-driven analysis replacing the hardcoded template strings.
     * Uses the RiskScoreResult to produce deterministic, accurate merge recommendations.
     */
    buildRiskDrivenAnalysis(context, riskResult) {
        const testStageStatus = context.runs.tests?.status;
        const hasExecutionResults = testStageStatus !== undefined;
        const executionFailed = testStageStatus === "failed";
        const executionPassed = testStageStatus === "passed";
        // If we have real execution results, they override risk score for recommendation
        let mergeRecommendation;
        let confidence;
        let summary;
        if (executionFailed) {
            mergeRecommendation = "request_changes";
            confidence = 0.92;
            summary = `Executed impacted validation for ${context.findings.length} test(s). Failures detected. ` + riskResult.summary;
        }
        else if (executionPassed) {
            mergeRecommendation = riskResult.risk_level === "BLOCK" ? "merge_with_followup" : "merge";
            confidence = 0.88;
            summary = `All ${context.findings.length} impacted test(s) passed execution. Risk score: ${riskResult.risk_score}/100. ` + riskResult.summary;
        }
        else {
            // planned_only mode — use risk score
            mergeRecommendation = riskResult.merge_recommendation;
            confidence = riskResult.confidence;
            summary = riskResult.summary;
        }
        const blockingFindings = context.findings.filter((f) => f.blocking);
        const warningFindings = context.findings.filter((f) => !f.blocking && f.status === "warning");
        return {
            summary,
            mergeRecommendation,
            confidence,
            rootCauses: context.findings.map((finding) => ({
                findingId: finding.id,
                probableCause: finding.rootCauseHint || finding.issue,
                relatedFiles: finding.changedFileHints,
                rationale: `Risk-scored from code impact analysis for ${finding.flow}. Severity: ${finding.severity}.`,
                confidence: finding.confidence,
            })),
            suggestedFixes: [
                ...blockingFindings.map((finding) => ({
                    findingId: finding.id,
                    fix: finding.suggestedFixes[0] || `Resolve blocking issue in ${finding.flow} before merge.`,
                    files: finding.changedFileHints,
                    priority: "now",
                })),
                ...warningFindings.slice(0, 3).map((finding) => ({
                    findingId: finding.id,
                    fix: finding.suggestedFixes[0] || `Review ${finding.flow} coverage after merge.`,
                    files: finding.changedFileHints,
                    priority: "next",
                })),
            ],
            reviewComments: riskResult.risk_factors
                .filter((f) => f.score > 40)
                .map((f) => ({
                body: `**Risk Factor — ${f.factor.replace(/_/g, " ")}** (score: ${f.score}/100): ${f.explanation}`,
                severity: f.score >= 70 ? "high" : "medium",
            })),
        };
    }
    /**
     * GAP 7: Status is now correct for planned_only clean validations.
     * planned_only with no blocking findings → "completed" (not "partial_failed")
     */
    finalizeContextStatus(context, executionMode) {
        const hasBlocking = context.findings.some((finding) => finding.blocking);
        if (hasBlocking)
            return "failed";
        const testStageStatus = context.runs.tests?.status;
        if (testStageStatus === "failed")
            return "failed";
        if (testStageStatus === "partial" || testStageStatus === "running")
            return "partial_failed";
        // GAP 7: In planned_only mode, queued stages are expected — not a failure
        if (executionMode === "planned_only") {
            return "completed";
        }
        const hasQueuedStages = Object.values(context.runs).some((run) => run?.status === "queued");
        if (hasQueuedStages)
            return "partial_failed";
        return "completed";
    }
    buildResponse(context, includeCommentDraft, opts) {
        const highestSeverity = this.findHighestSeverity(context.findings);
        const warningCount = context.findings.filter((finding) => finding.status === "warning").length;
        const blockingCount = context.findings.filter((finding) => finding.blocking).length;
        const passedCount = context.findings.filter((finding) => finding.status === "passed").length;
        const status = context.status === "completed" ? "passed" :
            context.status === "failed" ? "failed" :
                "partial";
        // GAP 2: merge_signal now incorporates severity and risk score, not just blocking count
        const riskResult = opts.riskResult ?? this.recomputeRiskFromContext(context);
        const merge_signal = blockingCount > 0 ? "block" :
            riskResult.merge_signal === "block" ? "block" :
                riskResult.merge_signal === "review" || warningCount > 0 ? "review" :
                    "clean";
        const response = {
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
                merge_signal,
                risk_score: riskResult.risk_score,
                risk_level: riskResult.risk_level,
                risk_factors: riskResult.risk_factors,
                // Sprint 2: include component health snapshot (from context metadata)
                component_health: Array.isArray(context.metadata.component_health)
                    ? context.metadata.component_health
                    : undefined,
                // Sprint 3: include dependency blast snapshot (from context metadata)
                dependency_blast: context.metadata.dependency_blast,
                // Sprint 3 complete: blast→test bridge summary (gap metric for UI)
                blast_test_summary: context.metadata.blast_test_summary,
                incident_context: opts.incidentContext ??
                    context.metadata.incident_context,
            },
            claude_analysis: context.ai,
            comment_draft: includeCommentDraft ? this.buildCommentDraft(context, status, riskResult) : undefined,
            metadata: {
                execution_mode: opts.executionMode,
                replayed: opts.replayed,
                impact_source: opts.impactSource,
            },
        };
        return contracts_js_1.ValidatePrResponseSchema.parse(response);
    }
    recomputeRiskFromContext(context) {
        const storedScore = typeof context.metadata.risk_score === "number" ? context.metadata.risk_score : undefined;
        const storedLevel = context.metadata.risk_level;
        if (storedScore !== undefined && storedLevel) {
            const level = (storedLevel === "BLOCK" || storedLevel === "WARN" || storedLevel === "PASS")
                ? storedLevel
                : "WARN";
            return {
                risk_score: storedScore,
                risk_level: level,
                merge_signal: level === "BLOCK" ? "block" : level === "WARN" ? "review" : "clean",
                merge_recommendation: level === "BLOCK" ? "request_changes" : level === "WARN" ? "hold" : "merge",
                confidence: 0.7,
                risk_factors: [],
                summary: "",
            };
        }
        return (0, riskScorer_js_1.computeRiskScore)(context.changes.changedFiles, []);
    }
    /**
     * GAP 8: Structured comment draft matching the homepage board layout.
     * Sections: Changed → Affected → Verification Selected → Result → Evidence → Recommendation
     */
    buildCommentDraft(context, status, riskResult) {
        const recommendation = context.ai?.mergeRecommendation ?? riskResult.merge_recommendation;
        const signal = riskResult.merge_signal.toUpperCase();
        const signalEmoji = signal === "BLOCK" ? "🔴" : signal === "REVIEW" ? "🟡" : "🟢";
        const prRef = `${context.repository.owner}/${context.repository.name} #${context.repository.prNumber}`;
        const lines = [
            `## ${signalEmoji} TestNeo PR Validation — ${signal}`,
            `**${prRef}** · Risk Score: **${riskResult.risk_score}/100** · ${riskResult.risk_level}`,
            "",
        ];
        // Changed
        if (context.changes.changedFiles.length > 0) {
            lines.push("### Changed");
            for (const f of context.changes.changedFiles.slice(0, 8)) {
                lines.push(`- \`${f.path}\` (${f.status}${f.additions ? ` +${f.additions}` : ""}${f.deletions ? ` -${f.deletions}` : ""})`);
            }
            if (context.changes.changedFiles.length > 8) {
                lines.push(`- _…and ${context.changes.changedFiles.length - 8} more_`);
            }
            lines.push("");
        }
        // Affected
        if (context.changes.impactedFlows.length > 0) {
            lines.push("### Affected");
            for (const flow of context.changes.impactedFlows.slice(0, 6)) {
                lines.push(`- ✓ ${flow.name} _(confidence: ${Math.round(flow.confidence * 100)}%)_`);
            }
            lines.push("");
        }
        // Verification Selected
        const blockingFindings = context.findings.filter((f) => f.blocking);
        const warningFindings = context.findings.filter((f) => !f.blocking && f.status === "warning");
        const passedFindings = context.findings.filter((f) => f.status === "passed");
        const topFindings = [...blockingFindings, ...warningFindings, ...passedFindings].slice(0, 6);
        if (topFindings.length > 0) {
            lines.push("### Verification Selected");
            for (const finding of topFindings) {
                const icon = finding.status === "passed" ? "✅" : finding.blocking ? "🚫" : "⚠️";
                lines.push(`- ${icon} ${finding.flow}`);
            }
            lines.push("");
        }
        // Result
        lines.push("### Result");
        lines.push(`**${signal}** — ${riskResult.risk_score}/100`);
        lines.push("");
        lines.push(context.ai?.summary || riskResult.summary);
        lines.push("");
        // Evidence
        const testRun = context.runs.tests;
        if (testRun) {
            lines.push("### Evidence");
            const passed = passedFindings.length;
            const failed = blockingFindings.length;
            const warned = warningFindings.length;
            lines.push(`${passed} passed · ${failed} failed · ${warned} warnings`);
            if (testRun.dashboardUrl) {
                lines.push(`[View execution dashboard](${testRun.dashboardUrl})`);
            }
            lines.push("");
        }
        else if (riskResult.risk_factors.length > 0) {
            lines.push("### Evidence");
            for (const factor of riskResult.risk_factors) {
                const factorLabel = factor.factor.replace(/_/g, " ");
                lines.push(`- **${factorLabel}**: ${factor.explanation} _(${factor.score}/100)_`);
            }
            lines.push("");
        }
        // Component Risk Context (Sprint 2) — only included when we have component data
        const storedComponentHealth = Array.isArray(context.metadata.component_health)
            ? context.metadata.component_health
            : [];
        if (storedComponentHealth.length > 0) {
            lines.push("### Component Risk Context");
            lines.push("| Component | 7d Failure Rate | Trend | Risk |");
            lines.push("|-----------|----------------|-------|------|");
            const TREND_ARROW = {
                worsening: "↑ worse",
                improving: "↓ better",
                stable: "→ stable",
                insufficient_data: "—",
            };
            const RISK_EMOJI = {
                HIGH: "🔴 HIGH",
                MEDIUM: "🟡 MEDIUM",
                LOW: "🟢 LOW",
                UNKNOWN: "⬜ UNKNOWN",
            };
            for (const c of storedComponentHealth.slice(0, 6)) {
                const rate = c.failure_rate_7d != null ? `${Math.round(c.failure_rate_7d * 100)}%` : "—";
                const trend = TREND_ARROW[c.trend ?? ""] ?? "—";
                const risk = RISK_EMOJI[c.risk_level ?? ""] ?? "⬜";
                lines.push(`| ${c.component} | ${rate} | ${trend} | ${risk} |`);
            }
            lines.push("");
        }
        // Dependency Blast Radius (Sprint 3) — only included when structure_json is available
        const storedBlast = context.metadata.dependency_blast;
        if (storedBlast?.has_structure && (storedBlast.total_expanded ?? 0) > 0) {
            lines.push("### Dependency Blast Radius");
            lines.push(`**${storedBlast.total_expanded} file(s)** transitively depend on the changed code ` +
                `(${storedBlast.direct_dependents} direct · ${storedBlast.transitive_dependents} transitive · max depth ${storedBlast.max_depth}).`);
            const compEntries = Object.entries(storedBlast.affected_components ?? {});
            if (compEntries.length > 0) {
                lines.push(`Affected components: ${compEntries.map(([c, n]) => `**${c}** (${n})`).join(", ")}`);
            }
            if (storedBlast.nodes && storedBlast.nodes.length > 0) {
                lines.push("");
                lines.push("| File | Depth | Imported By | Component |");
                lines.push("|------|-------|-------------|-----------|");
                for (const node of storedBlast.nodes.slice(0, 8)) {
                    const file = node.file_path.split("/").pop() ?? node.file_path;
                    const importedBy = node.imported_by.split("/").pop() ?? node.imported_by;
                    lines.push(`| \`${file}\` | ${node.depth} | \`${importedBy}\` | ${node.component_label ?? "—"} |`);
                }
                if (storedBlast.nodes.length > 8) {
                    lines.push(`_…and ${storedBlast.nodes.length - 8} more files_`);
                }
            }
            lines.push("");
        }
        // Recommendation
        lines.push("### Recommendation");
        const recLabel = {
            merge: "Safe to merge",
            merge_with_followup: "Merge with follow-up",
            hold: "Hold — run validation stages before merging",
            request_changes: "Request changes — blocking issues must be resolved",
        };
        lines.push(`**${recLabel[recommendation] ?? recommendation}**`);
        lines.push("");
        if (context.suggestedFixes.length > 0) {
            for (const fix of context.suggestedFixes.slice(0, 4)) {
                lines.push(`- ${fix}`);
            }
            lines.push("");
        }
        // Risk factor breakdown (collapsible)
        if (riskResult.risk_factors.some((f) => f.score > 20)) {
            lines.push("<details>");
            lines.push("<summary>Risk factor breakdown</summary>");
            lines.push("");
            for (const f of riskResult.risk_factors) {
                const bar = "█".repeat(Math.round(f.score / 10)) + "░".repeat(10 - Math.round(f.score / 10));
                lines.push(`**${f.factor.replace(/_/g, " ")}** \`${bar}\` ${f.score}/100 — ${f.explanation}`);
            }
            lines.push("");
            lines.push("</details>");
        }
        lines.push("---");
        lines.push("_Powered by [TestNeo](https://testneo.ai) · AI-Native Release Assurance_");
        return lines.join("\n");
    }
    findHighestSeverity(findings) {
        let highest = "info";
        for (const finding of findings) {
            if (SEVERITY_ORDER[finding.severity] > SEVERITY_ORDER[highest]) {
                highest = finding.severity;
            }
        }
        return highest;
    }
    buildExecutionFailureFinding(error, request) {
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
    errorMessage(error) {
        if (error instanceof Error)
            return error.message;
        return String(error);
    }
    executionModeForContext(context) {
        const mode = context.metadata.execution_mode;
        return mode === "executed" ? "executed" : "planned_only";
    }
    async appendEvent(workflowId, type, payload, stage) {
        const event = {
            workflowId,
            type,
            stage,
            timestamp: this.nowIso(),
            payload,
        };
        await this.deps.store.appendEvent(event);
    }
    nowIso() {
        return this.now().toISOString();
    }
}
exports.PrValidationOrchestrator = PrValidationOrchestrator;
