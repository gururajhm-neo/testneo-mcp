"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveComponentFromPath = deriveComponentFromPath;
exports.computeRiskScore = computeRiskScore;
exports.severityFromRiskLevel = severityFromRiskLevel;
// Paths that carry higher blast radius risk
const CRITICAL_PATH_PATTERNS = [
    /payment/i, /checkout/i, /auth/i, /login/i, /signup/i, /register/i,
    /pricing/i, /billing/i, /subscription/i, /order/i, /cart/i,
    /token/i, /session/i, /password/i, /credential/i, /secret/i,
];
// impact_level → numeric weight for blast radius scoring
const IMPACT_LEVEL_WEIGHT = {
    critical: 1.0,
    high: 0.75,
    medium: 0.4,
    low: 0.15,
    info: 0.05,
};
// Directories to skip when deriving a component from a file path.
// Mirrors app/services/component_extractor.py GENERIC_DIRS.
const GENERIC_DIRS = new Set([
    "src", "lib", "libs", "dist", "build", "out", "output", "bin",
    "node_modules", "vendor",
    "app", "apps", "frontend", "backend", "server", "client",
    "packages", "modules", "services", "internal", "core",
    "platform", "infra", "infrastructure",
    "test", "tests", "__tests__", "spec", "specs",
    "__mocks__", "mocks", "fixtures", "e2e", "integration", "unit",
    "utils", "util", "helpers", "helper", "common", "shared",
    "types", "interfaces", "constants", "config", "configs", "configuration",
    "scripts", "tools", "migrations", "seeds", "database",
    "pages", "views", "layouts", "containers", "components", "hooks",
    "store", "stores", "context", "contexts", "reducers", "actions",
    "assets", "static", "public", "styles", "css", "scss",
    "models", "schemas", "serializers", "validators", "middleware",
    "endpoints", "routes", "routers", "controllers",
    "repositories", "dao", "dto",
    "v1", "v2", "v3", "api", "web", "main",
]);
function clamp(v, min = 0, max = 100) {
    return Math.max(min, Math.min(max, v));
}
/**
 * Derive a component label from a file path.
 * Mirrors ComponentExtractor.extract_component_from_path() in Python.
 *
 * Examples:
 *   "src/checkout/CheckoutService.ts"    → "Checkout"
 *   "packages/payments/src/gateway.ts"  → "Payments"
 *   "src/utils/string.ts"               → null
 */
function deriveComponentFromPath(filePath) {
    if (!filePath)
        return null;
    const normalized = filePath.replace(/\\/g, "/").replace(/^[./]+/, "");
    const parts = normalized.split("/").filter(Boolean);
    const dirs = parts.slice(0, -1); // drop filename
    for (const segment of dirs) {
        if (!GENERIC_DIRS.has(segment.toLowerCase()) && segment.length >= 2) {
            return _prettifySegment(segment);
        }
    }
    // fallback: deepest directory
    if (dirs.length > 0) {
        const candidate = _prettifySegment(dirs[dirs.length - 1]);
        if (candidate.length >= 2)
            return candidate;
    }
    return null;
}
function _prettifySegment(segment) {
    // Split camelCase: "checkoutService" → "checkout Service"
    const withSpaces = segment.replace(/([a-z])([A-Z])/g, "$1 $2");
    // Split on separators
    const words = withSpaces.split(/[-_.\s]+/).filter(Boolean);
    if (!words.length)
        return segment;
    // Take first word, title-case it
    const first = words[0];
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}
function criticalPathScore(changedFiles) {
    if (!changedFiles.length)
        return 0;
    const hits = changedFiles.filter((f) => CRITICAL_PATH_PATTERNS.some((p) => p.test(f.path))).length;
    const ratio = hits / changedFiles.length;
    return clamp(ratio * 100);
}
function blastRadiusScore(affectedTests, changedFiles) {
    if (!affectedTests.length)
        return 0;
    const highOrCritical = affectedTests.filter((t) => t.impact_level === "critical" || t.impact_level === "high").length;
    const weightedImpact = affectedTests.reduce((acc, t) => {
        const w = IMPACT_LEVEL_WEIGHT[t.impact_level?.toLowerCase() ?? ""] ?? 0.1;
        const conf = t.confidence ?? t.confidence_score ?? 0.5;
        return acc + w * conf;
    }, 0);
    const changeSize = changedFiles.reduce((acc, f) => acc + (f.additions ?? 0) + (f.deletions ?? 0), 0);
    const changeDensity = clamp(Math.log1p(changeSize) / Math.log1p(1000) * 100);
    const highImpactRatio = affectedTests.length > 0 ? highOrCritical / affectedTests.length : 0;
    return clamp(weightedImpact * 25 +
        highImpactRatio * 40 +
        changeDensity * 0.35);
}
function historicalRiskScore(affectedTests) {
    const withHistory = affectedTests.filter((t) => t.failure_rate_7d !== undefined || t.failure_rate_30d !== undefined || t.flakiness_score !== undefined);
    if (!withHistory.length)
        return 0;
    const avgFailureRate7d = withHistory.reduce((acc, t) => acc + (t.failure_rate_7d ?? 0), 0) / withHistory.length;
    const avgFlakiness = withHistory.reduce((acc, t) => acc + (t.flakiness_score ?? 0), 0) / withHistory.length;
    const recentFailures = affectedTests.reduce((acc, t) => acc + (t.recent_failure_count ?? 0), 0);
    return clamp(avgFailureRate7d * 60 +
        avgFlakiness * 25 +
        Math.min(recentFailures * 3, 15));
}
/**
 * Sprint 2: Component-level historical risk.
 *
 * Cross-references the affected test components + changed file components
 * against the project-wide component health summary.  If a changed component
 * has a high historical failure rate, this amplifies the risk score even when
 * individual test risk signals are missing.
 *
 * This is the "why" that Sprint 1 lacked: "Checkout has failed 42% of the time
 * in the last week — not just test tc_002, but the whole component."
 */
function componentHistoryScore(changedFiles, affectedTests, componentHealth) {
    if (!componentHealth.length)
        return 0;
    // Collect component names from affected tests (enriched by risk-signals endpoint)
    const affectedComponents = new Set(affectedTests
        .map((t) => t.component_label?.toLowerCase())
        .filter((c) => Boolean(c)));
    // Also derive components from changed file paths (may not yet be in tests)
    for (const f of changedFiles) {
        const derived = deriveComponentFromPath(f.path);
        if (derived)
            affectedComponents.add(derived.toLowerCase());
    }
    if (!affectedComponents.size)
        return 0;
    // Match component health entries against our affected component set
    const relevant = componentHealth.filter((c) => {
        const name = c.component.toLowerCase();
        return (affectedComponents.has(name) ||
            // partial match: "Checkout" matches "checkoutservice", etc.
            Array.from(affectedComponents).some((ac) => name.includes(ac) || ac.includes(name)));
    });
    if (!relevant.length)
        return 0;
    // Use worst-case component for the score
    const maxRate7d = Math.max(...relevant.map((c) => c.failure_rate_7d ?? 0));
    const worseningCount = relevant.filter((c) => c.trend === "worsening").length;
    const highRiskCount = relevant.filter((c) => c.risk_level === "HIGH").length;
    return clamp(maxRate7d * 70 +
        worseningCount * 8 +
        highRiskCount * 5);
}
/**
 * Sprint 3: Dependency blast radius score.
 *
 * Quantifies HOW WIDELY a change propagates through the codebase via import
 * chains — not just "2 tests affected" but "2 files changed → 14 files
 * transitively import them → Checkout, Pricing, and Order components all
 * affected".
 *
 * Factors:
 *   file_count_contribution  — number of transitively affected files (max 35 pts)
 *   depth_contribution       — how many hops the blast reaches (max 25 pts)
 *   component_spread         — distinct components in blast radius (max 25 pts)
 *   critical_path_in_blast   — any critical path component in blast? (max 15 pts)
 *
 * Score range: 0–100.
 *
 * 0   = no transitive dependents found (either no structure_json or no imports)
 * 25  = 3 files, depth 1, 1 component
 * 50  = 8 files, depth 2, 2 components
 * 75  = 15 files, depth 2+, 3+ components
 * 100 = 20+ files, depth 3, 5+ components, critical path hit
 */
function dependencyBlastScore(blast) {
    if (!blast || !blast.has_structure)
        return 0;
    const totalExpanded = blast.total_expanded ?? 0;
    if (totalExpanded === 0)
        return 0;
    // File count: logarithmic scale so 20 files ≈ max 35 pts
    const fileCount = clamp(Math.log1p(totalExpanded) / Math.log1p(20) * 35, 0, 35);
    // Depth: 1 hop → 0, 2 hops → 15, 3 hops → 22, 4 hops → 25
    const maxDepth = blast.max_depth ?? 0;
    const depthScore = maxDepth >= 4 ? 25 : maxDepth >= 3 ? 22 : maxDepth >= 2 ? 15 : 0;
    // Component spread: distinct components in blast
    const componentCount = Object.keys(blast.affected_components ?? {}).length;
    const componentSpread = clamp(Math.min(componentCount, 5) / 5 * 25, 0, 25);
    // Critical path bonus: any critical-path component name in blast?
    const blastComponentNames = Object.keys(blast.affected_components ?? {})
        .map((c) => c.toLowerCase());
    const criticalHit = CRITICAL_PATH_PATTERNS.some((p) => blastComponentNames.some((c) => p.test(c)) ||
        (blast.expanded_files ?? []).some((f) => p.test(f)));
    const criticalBonus = criticalHit ? 15 : 0;
    return clamp(fileCount + depthScore + componentSpread + criticalBonus);
}
function verificationCoverageScore(affectedTests) {
    if (!affectedTests.length)
        return 50; // unknown — neutral
    const withTestId = affectedTests.filter((t) => t.test_id !== undefined).length;
    const coverage = withTestId / affectedTests.length;
    // Low coverage means we CAN'T verify → higher risk
    return clamp((1 - coverage) * 100);
}
/**
 * Sprint 3 updated weights (sum = 1.0):
 *   blast_radius:       0.25  (reduced — dependency_blast now captures file-spread)
 *   historical:         0.22  (reduced slightly)
 *   critical_path:      0.18  (reduced slightly)
 *   component_history:  0.13  (reduced slightly)
 *   dependency_blast:   0.12  (NEW Sprint 3 — transitive import depth & spread)
 *   coverage_gap:       0.10  (unchanged)
 */
function computeRiskScore(changedFiles, affectedTests, componentHealth = [], dependencyBlast) {
    const cpRaw = criticalPathScore(changedFiles);
    const brRaw = blastRadiusScore(affectedTests, changedFiles);
    const histRaw = historicalRiskScore(affectedTests);
    const compRaw = componentHistoryScore(changedFiles, affectedTests, componentHealth);
    const covRaw = verificationCoverageScore(affectedTests);
    const depRaw = dependencyBlastScore(dependencyBlast);
    const WEIGHTS = {
        blast_radius: 0.25,
        historical: 0.22,
        critical_path: 0.18,
        component_history: 0.13,
        dependency_blast: 0.12,
        coverage_gap: 0.10,
    };
    // Build the component history explanation
    const relevantComponents = componentHealth.filter((c) => {
        const name = c.component.toLowerCase();
        const affectedNames = affectedTests
            .map((t) => t.component_label?.toLowerCase())
            .filter(Boolean);
        const fileComponents = changedFiles
            .map((f) => deriveComponentFromPath(f.path)?.toLowerCase())
            .filter(Boolean);
        const all = [...affectedNames, ...fileComponents];
        return all.some((ac) => name.includes(ac) || ac.includes(name));
    });
    const compExplanation = compRaw > 0 && relevantComponents.length > 0
        ? `${relevantComponents.length} affected component(s) have elevated historical failure rates: ${relevantComponents
            .slice(0, 3)
            .map((c) => `${c.component} (${c.failure_rate_7d != null ? Math.round(c.failure_rate_7d * 100) : "?"}% 7d)`)
            .join(", ")}.`
        : "No component-level historical failure signal for changed components.";
    // Sprint 3: Dependency blast explanation
    const blastExplanation = (() => {
        if (!dependencyBlast || !dependencyBlast.has_structure) {
            return "No code structure available — upload structure.json to enable dependency blast analysis.";
        }
        if (dependencyBlast.total_expanded === 0) {
            return "Changed files have no detected transitive dependents in the codebase.";
        }
        const affectedCompNames = Object.keys(dependencyBlast.affected_components ?? {});
        const compList = affectedCompNames.slice(0, 3).join(", ");
        return (`${dependencyBlast.total_expanded} file(s) transitively import changed files ` +
            `(${dependencyBlast.direct_dependents} direct, ${dependencyBlast.transitive_dependents} transitive, ` +
            `max depth ${dependencyBlast.max_depth})` +
            (affectedCompNames.length > 0 ? `. Blast reaches: ${compList}${affectedCompNames.length > 3 ? ` +${affectedCompNames.length - 3} more` : ""}.` : "."));
    })();
    const factors = [
        {
            factor: "blast_radius",
            score: Math.round(brRaw),
            weight: WEIGHTS.blast_radius,
            explanation: `${affectedTests.length} test(s) affected by ${changedFiles.length} changed file(s)${affectedTests.filter((t) => t.impact_level === "critical" || t.impact_level === "high").length > 0
                ? ` — ${affectedTests.filter((t) => t.impact_level === "critical" || t.impact_level === "high").length} high/critical impact`
                : ""}.`,
        },
        {
            factor: "historical_failure_rate",
            score: Math.round(histRaw),
            weight: WEIGHTS.historical,
            explanation: histRaw > 0
                ? `Historical failure rate signals detected across affected tests.`
                : "No per-test historical failure data available.",
        },
        {
            factor: "critical_path_coverage",
            score: Math.round(cpRaw),
            weight: WEIGHTS.critical_path,
            explanation: cpRaw > 0
                ? `Changed files touch critical paths (payment, auth, checkout, pricing, etc.).`
                : "No critical path files detected in change set.",
        },
        {
            factor: "component_history",
            score: Math.round(compRaw),
            weight: WEIGHTS.component_history,
            explanation: compExplanation,
        },
        {
            factor: "dependency_blast",
            score: Math.round(depRaw),
            weight: WEIGHTS.dependency_blast,
            explanation: blastExplanation,
        },
        {
            factor: "verification_coverage_gap",
            score: Math.round(covRaw),
            weight: WEIGHTS.coverage_gap,
            explanation: `${Math.round((1 - covRaw / 100) * 100)}% of affected tests have linked test case IDs for execution.`,
        },
    ];
    const risk_score = clamp(Math.round(brRaw * WEIGHTS.blast_radius +
        histRaw * WEIGHTS.historical +
        cpRaw * WEIGHTS.critical_path +
        compRaw * WEIGHTS.component_history +
        depRaw * WEIGHTS.dependency_blast +
        covRaw * WEIGHTS.coverage_gap));
    const risk_level = risk_score >= 70 ? "BLOCK" :
        risk_score >= 35 ? "WARN" :
            "PASS";
    const merge_signal = risk_level === "BLOCK" ? "block" :
        risk_level === "WARN" ? "review" :
            "clean";
    const merge_recommendation = risk_level === "BLOCK" ? "request_changes" :
        risk_level === "WARN" ? "hold" :
            "merge";
    const confidence = clamp(0.6 +
        Math.min(affectedTests.filter((t) => t.failure_rate_7d !== undefined).length / Math.max(affectedTests.length, 1), 1) * 0.20 +
        (componentHealth.length > 0 ? 0.10 : 0) +
        (dependencyBlast?.has_structure ? 0.05 : 0), 0, 1);
    const summary = buildSummary(risk_level, risk_score, factors, affectedTests, changedFiles, componentHealth, dependencyBlast);
    return { risk_score, risk_level, risk_factors: factors, merge_signal, merge_recommendation, confidence, summary };
}
function buildSummary(level, score, factors, affectedTests, changedFiles, componentHealth, dependencyBlast) {
    const topFactor = [...factors].sort((a, b) => b.score * b.weight - a.score * a.weight)[0];
    const criticalTests = affectedTests.filter((t) => t.impact_level === "critical" || t.impact_level === "high");
    const criticalFiles = changedFiles.filter((f) => CRITICAL_PATH_PATTERNS.some((p) => p.test(f.path)));
    const highRiskComponents = componentHealth.filter((c) => c.risk_level === "HIGH" || (c.failure_rate_7d ?? 0) >= 0.3);
    const componentContext = highRiskComponents.length > 0
        ? ` Component risk: ${highRiskComponents.slice(0, 2).map((c) => `${c.component} (${Math.round((c.failure_rate_7d ?? 0) * 100)}% 7d failure rate)`).join(", ")}.`
        : "";
    const blastContext = dependencyBlast?.has_structure && (dependencyBlast.total_expanded ?? 0) > 0
        ? ` Blast radius: ${dependencyBlast.total_expanded} file(s) transitively affected (depth ${dependencyBlast.max_depth}).`
        : "";
    if (level === "BLOCK") {
        return (`Risk score ${score}/100 — BLOCK.` +
            (criticalTests.length > 0
                ? ` ${criticalTests.length} high/critical impact test(s) identified.`
                : "") +
            (criticalFiles.length > 0
                ? ` Changes touch critical paths: ${criticalFiles.slice(0, 3).map((f) => f.path.split("/").pop()).join(", ")}.`
                : "") +
            componentContext +
            blastContext +
            ` Hold the release until impacted tests are verified and all failures cleared. Primary signal: ${topFactor.factor}.`);
    }
    if (level === "WARN") {
        return (`Risk score ${score}/100 — WARN.` +
            ` ${affectedTests.length} test(s) impacted across ${changedFiles.length} changed file(s).` +
            componentContext +
            blastContext +
            ` Run impacted validation stages before merge. Primary signal: ${topFactor.factor}.`);
    }
    return (`Risk score ${score}/100 — PASS.` +
        (affectedTests.length > 0
            ? ` ${affectedTests.length} test(s) identified as low-risk. No critical path changes detected.${componentContext}${blastContext} Safe to merge after standard review.`
            : ` No impacted tests identified.${blastContext} Change set carries low verification risk.`));
}
function severityFromRiskLevel(level) {
    return level === "BLOCK" ? "critical" : level === "WARN" ? "medium" : "low";
}
