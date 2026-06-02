"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataDrivenClaudeAnalyzer = void 0;
const incidentContextAdapter_js_1 = require("./incidentContextAdapter.js");
// ─── internal helpers ────────────────────────────────────────────────────────
const CRITICAL_PATH_PATTERNS = [
    /payment/i, /checkout/i, /auth/i, /login/i, /signup/i, /register/i,
    /pricing/i, /billing/i, /subscription/i, /order/i, /cart/i,
    /token/i, /session/i, /password/i, /credential/i, /secret/i,
];
function isCriticalPath(path) {
    return CRITICAL_PATH_PATTERNS.some((p) => p.test(path));
}
function pct(rate) {
    return `${Math.round(rate * 100)}%`;
}
function capitalize(s) {
    if (!s)
        return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}
function fileBasename(path) {
    return path.split("/").pop() ?? path;
}
// ─── per-finding root cause synthesis ────────────────────────────────────────
function buildProbableCause(finding, impact) {
    const parts = [];
    if (finding.rootCauseHint) {
        parts.push(finding.rootCauseHint);
    }
    // Locate the matching candidate for deeper signal enrichment
    const candidate = impact.affectedTests.find((t) => finding.relatedTestIds.includes(t.test_id ?? -1) ||
        (t.function_name && t.function_name === finding.flow) ||
        (t.test_name && t.test_name === finding.flow));
    if (candidate) {
        const rate7d = candidate.failure_rate_7d;
        const flakiness = candidate.flakiness_score;
        const recentFailures = candidate.recent_failure_count;
        if (rate7d !== undefined && rate7d > 0.1) {
            const flakinessNote = flakiness !== undefined && flakiness > 0.15
                ? ` with ${pct(flakiness)} flakiness`
                : "";
            parts.push(`This test has failed ${pct(rate7d)} of the time in the last 7 days${flakinessNote}.`);
        }
        if (recentFailures !== undefined && recentFailures > 2 && rate7d === undefined) {
            parts.push(`${recentFailures} recent failure(s) recorded.`);
        }
        // Component-level amplification
        const compLabel = candidate.component_label;
        if (compLabel) {
            const compHealth = impact.componentHealth?.find((c) => c.component.toLowerCase().includes(compLabel.toLowerCase()) ||
                compLabel.toLowerCase().includes(c.component.toLowerCase()));
            if (compHealth && (compHealth.failure_rate_7d ?? 0) > 0.15) {
                const trendNote = compHealth.trend === "worsening" ? " and is trending worse" :
                    compHealth.trend === "improving" ? " (trending better)" : "";
                parts.push(`The ${compHealth.component} component has a ${pct(compHealth.failure_rate_7d ?? 0)} ` +
                    `7-day failure rate${trendNote}.`);
            }
        }
        // Transitive discovery context
        if (candidate.blast_source &&
            candidate.blast_source !== "direct" &&
            candidate.blast_source !== "changed_file") {
            parts.push(`Discovered via transitive import analysis (depth ${candidate.blast_depth ?? "?"})` +
                (candidate.blast_file_path
                    ? `: this test covers \`${fileBasename(candidate.blast_file_path)}\` which imports the changed code`
                    : "") +
                ".");
        }
    }
    // Critical-path files in the change set
    const criticalFiles = finding.changedFileHints.filter(isCriticalPath);
    if (criticalFiles.length > 0) {
        parts.push(`Changed files touch critical paths: ${criticalFiles.slice(0, 3).map((f) => `\`${fileBasename(f)}\``).join(", ")}.`);
    }
    return parts.length > 0
        ? parts.join(" ")
        : `Code impact analysis identified "${finding.flow}" as potentially affected by this change.`;
}
// ─── merge recommendation ────────────────────────────────────────────────────
function buildMergeRecommendation(context, riskLevel) {
    const stage = context.runs.tests;
    const blockingCount = context.findings.filter((f) => f.blocking).length;
    if (blockingCount > 0 || stage?.status === "failed")
        return "request_changes";
    if (stage?.status === "passed" && riskLevel === "BLOCK")
        return "merge_with_followup";
    if (stage?.status === "passed")
        return "merge";
    if (riskLevel === "BLOCK")
        return "request_changes";
    if (riskLevel === "WARN")
        return "hold";
    return "merge";
}
// ─── confidence scoring ──────────────────────────────────────────────────────
function buildConfidence(context, impact) {
    let score = 0.55;
    if (context.runs.tests?.status !== undefined)
        score += 0.25; // execution signal
    if (impact.affectedTests.some((t) => t.failure_rate_7d !== undefined))
        score += 0.10;
    if ((impact.componentHealth?.length ?? 0) > 0)
        score += 0.06;
    if (impact.dependencyBlast?.has_structure)
        score += 0.04;
    return Math.min(score, 0.96);
}
// ─── summary paragraph ───────────────────────────────────────────────────────
const RECOMMENDATION_LABEL = {
    merge: "Safe to merge.",
    merge_with_followup: "Merge with follow-up items noted.",
    hold: "Hold — run impacted validation stages before merging.",
    request_changes: "Request changes — blocking findings must be resolved.",
};
function buildSummary(context, impact, riskScore, riskLevel, recommendation, incident) {
    const prRef = `PR #${context.repository.prNumber} in ${context.repository.owner}/${context.repository.name}`;
    const signal = riskLevel === "BLOCK" ? "🔴 BLOCK" : riskLevel === "WARN" ? "🟡 WARN" : "🟢 PASS";
    const parts = [
        `${signal} · Risk score ${riskScore}/100 for ${prRef}.`,
    ];
    const stage = context.runs.tests;
    if (stage?.status === "passed") {
        parts.push(`${context.findings.length} impacted test(s) passed execution.`);
    }
    else if (stage?.status === "failed") {
        const blocking = context.findings.filter((f) => f.blocking).length;
        parts.push(`Test execution found failures in ${blocking} impacted flow(s).`);
    }
    else {
        parts.push(`${impact.affectedTests.length} test(s) identified across ` +
            `${context.changes.changedFiles.length} changed file(s).`);
    }
    const criticalFiles = context.changes.changedFiles.filter((f) => isCriticalPath(f.path));
    if (criticalFiles.length > 0) {
        parts.push(`Changes touch critical paths: ${criticalFiles.slice(0, 2).map((f) => fileBasename(f.path)).join(", ")}.`);
    }
    const highRiskComponents = (impact.componentHealth ?? []).filter((c) => (c.failure_rate_7d ?? 0) >= 0.25 || c.risk_level === "HIGH");
    if (highRiskComponents.length > 0) {
        parts.push(`High-risk component(s): ${highRiskComponents
            .slice(0, 2)
            .map((c) => `${c.component} (${pct(c.failure_rate_7d ?? 0)} 7d failure rate)`)
            .join(", ")}.`);
    }
    const blast = impact.dependencyBlast;
    if (blast?.has_structure && (blast.total_expanded ?? 0) > 0) {
        parts.push(`Blast radius: ${blast.total_expanded} file(s) transitively affected ` +
            `(${blast.direct_dependents} direct · depth ${blast.max_depth}).`);
    }
    if (incident && incident.match_count > 0) {
        parts.push(`Engineering memory: ${incident.match_count} similar incident(s) ` +
            `(match score ${incident.incident_match_score}/100).`);
        if (incident.top_resolution?.action) {
            parts.push(`Prior fix: "${incident.top_resolution.action.slice(0, 80)}".`);
        }
    }
    parts.push(RECOMMENDATION_LABEL[recommendation]);
    return parts.join(" ");
}
// ─── review comment generation ───────────────────────────────────────────────
function buildReviewComments(context, impact) {
    const comments = [];
    // Risk factor comments from stored metadata
    const storedFactors = Array.isArray(context.metadata.risk_factors)
        ? context.metadata.risk_factors
        : [];
    for (const f of storedFactors
        .filter((f) => f.score > 30)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)) {
        const severity = f.score >= 70 ? "high" : f.score >= 45 ? "medium" : "low";
        comments.push({
            body: `**${capitalize(f.factor.replace(/_/g, " "))}** (${f.score}/100): ${f.explanation}`,
            severity,
        });
    }
    // Component risk context
    const highRiskComponents = (impact.componentHealth ?? []).filter((c) => (c.failure_rate_7d ?? 0) >= 0.30 || c.risk_level === "HIGH");
    if (highRiskComponents.length > 0) {
        comments.push({
            body: `**Component risk context:** ` +
                highRiskComponents
                    .slice(0, 3)
                    .map((c) => `${c.component} has ${pct(c.failure_rate_7d ?? 0)} 7d failure rate` +
                    (c.trend === "worsening" ? " (trending worse)" : ""))
                    .join("; ") +
                ".",
            severity: "medium",
        });
    }
    // Blast radius note when significant
    const blast = impact.dependencyBlast;
    if (blast?.has_structure && (blast.total_expanded ?? 0) >= 5) {
        const compList = Object.keys(blast.affected_components ?? {}).slice(0, 3).join(", ");
        comments.push({
            body: `**Dependency blast radius:** ${blast.total_expanded} file(s) transitively import changed code ` +
                `(max depth ${blast.max_depth})` +
                (compList ? `. Affected components: ${compList}.` : "."),
            severity: (blast.total_expanded ?? 0) >= 15 ? "high" : "medium",
        });
    }
    return comments;
}
// ─── main exported class ─────────────────────────────────────────────────────
class DataDrivenClaudeAnalyzer {
    async analyze(input) {
        const { context, impact } = input;
        const incident = (0, incidentContextAdapter_js_1.incidentContextFromMetadata)(context.metadata);
        const riskScore = typeof context.metadata.risk_score === "number"
            ? context.metadata.risk_score
            : 0;
        const riskLevel = typeof context.metadata.risk_level === "string"
            ? context.metadata.risk_level
            : "PASS";
        const recommendation = buildMergeRecommendation(context, riskLevel);
        const confidence = buildConfidence(context, impact);
        const summary = buildSummary(context, impact, riskScore, riskLevel, recommendation, incident);
        const rootCauses = context.findings.map((finding) => {
            const base = buildProbableCause(finding, impact);
            const memoryMatch = incident?.matches.find((m) => m.match_type === "resolution" &&
                (m.related_test_ids?.some((id) => finding.relatedTestIds.includes(id)) ||
                    m.match_score >= 60));
            const memoryNote = memoryMatch
                ? ` Prior incident: ${memoryMatch.title}. ${memoryMatch.description}`
                : incident?.top_resolution
                    ? ` Known fix from history: "${incident.top_resolution.action}".`
                    : "";
            return {
                findingId: finding.id,
                probableCause: base + memoryNote,
                relatedFiles: finding.changedFileHints,
                rationale: `Severity: ${finding.severity} · Source: ${finding.source} · ` +
                    `Confidence: ${Math.round(finding.confidence * 100)}%. ` +
                    `Flow "${capitalize(finding.flow)}" is ` +
                    (finding.blocking ? "blocking this merge." : "flagged for review."),
                confidence: finding.confidence,
            };
        });
        const blockingFindings = context.findings.filter((f) => f.blocking);
        const warningFindings = context.findings.filter((f) => !f.blocking && f.status === "warning");
        const suggestedFixes = [
            ...blockingFindings.map((f) => {
                const historicalFix = incident?.top_resolution?.action ??
                    incident?.matches.find((m) => m.resolution_action)?.resolution_action;
                return {
                    findingId: f.id,
                    fix: historicalFix ??
                        f.suggestedFixes[0] ??
                        `Resolve the issue in "${f.flow}" before merge — ${f.issue.split(".")[0]}.`,
                    files: f.changedFileHints.slice(0, 3),
                    priority: "now",
                };
            }),
            ...warningFindings.slice(0, 4).map((f) => ({
                findingId: f.id,
                fix: f.suggestedFixes[0] ??
                    `Review "${f.flow}" coverage and validate behaviour after merge.`,
                files: f.changedFileHints.slice(0, 3),
                priority: "next",
            })),
        ];
        const reviewComments = buildReviewComments(context, impact);
        // ── Engineering Memory risk factor ────────────────────────────────────────
        // Inject incident_match_score as an explicit risk factor so the UI's
        // Risk Factor Breakdown bar includes "Engineering Memory +N".
        const riskFactors = [];
        const storedFactors = Array.isArray(context.metadata.risk_factors)
            ? context.metadata.risk_factors
            : [];
        riskFactors.push(...storedFactors);
        if (incident && (incident.incident_match_score ?? 0) > 0) {
            const memScore = incident.incident_match_score;
            const alreadyHas = riskFactors.some((f) => f.factor === "engineering_memory");
            if (!alreadyHas) {
                riskFactors.push({
                    factor: "engineering_memory",
                    score: memScore,
                    weight: 0.15,
                    explanation: `Engineering Memory matched ${incident.match_count} historical signal(s) ` +
                        `(${incident.match_tier.toUpperCase()}, ${memScore}/100). ` +
                        (incident.top_resolution
                            ? `Top fix: "${incident.top_resolution.action.slice(0, 80)}".`
                            : ""),
                });
            }
        }
        return {
            summary,
            mergeRecommendation: recommendation,
            confidence,
            rootCauses,
            suggestedFixes,
            reviewComments,
            ...(riskFactors.length > 0 ? { riskFactors } : {}),
        };
    }
}
exports.DataDrivenClaudeAnalyzer = DataDrivenClaudeAnalyzer;
