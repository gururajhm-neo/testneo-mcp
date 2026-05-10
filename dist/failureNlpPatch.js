"use strict";
/**
 * Produce a concrete testneo_update_test_case_nlp–style suggestion from a failure bundle.
 * Conservative heuristics: route hardening, light wait insertion for timeouts — not full selector rewrites.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractExecutionSummaryTestCaseId = extractExecutionSummaryTestCaseId;
exports.buildSuggestedNlpPatch = buildSuggestedNlpPatch;
const routeHardening_js_1 = require("./routeHardening.js");
function corpusText(bundle) {
    const chunks = [JSON.stringify(bundle.summary)];
    for (const e of bundle.failed_event_sample || [])
        chunks.push(JSON.stringify(e));
    for (const l of bundle.log_sample || [])
        chunks.push(JSON.stringify(l));
    return chunks.join("\n").toLowerCase();
}
function extractExecutionSummaryTestCaseId(summary) {
    const id = summary.test_case_id;
    if (typeof id === "number" && id > 0)
        return id;
    if (typeof id === "string") {
        const n = Number(id);
        if (Number.isFinite(n) && n > 0)
            return n;
    }
    return null;
}
const NAVIGATE_RE = /^\s*navigate\s+to\s+/i;
/** Insert a short wait before the first high-churn action after navigation if theme is timeout. */
function maybeInsertStabilityWait(commands, theme) {
    if (theme !== "timeout_or_wait_condition")
        return commands;
    const out = [...commands];
    let navIdx = -1;
    for (let i = 0; i < out.length; i += 1) {
        if (NAVIGATE_RE.test(out[i] || "")) {
            navIdx = i;
            break;
        }
    }
    if (navIdx < 0)
        return out;
    const waitLine = "Wait for 2 seconds";
    for (let j = navIdx + 1; j < out.length && j < navIdx + 5; j += 1) {
        const line = (out[j] || "").trim();
        if (line.toLowerCase() === waitLine.toLowerCase())
            return out;
        if (/^click\s+/i.test(line) || /^fill\s+/i.test(line)) {
            out.splice(j, 0, waitLine);
            return out;
        }
    }
    if (navIdx + 1 < out.length) {
        out.splice(navIdx + 1, 0, waitLine);
    }
    return out;
}
function buildUnifiedDiff(before, after) {
    const max = Math.max(before.length, after.length);
    const lines = [];
    for (let i = 0; i < max; i += 1) {
        const b = before[i];
        const a = after[i];
        if (b === a) {
            lines.push(` ${b ?? ""}`);
        }
        else {
            if (b !== undefined)
                lines.push(`-${b}`);
            if (a !== undefined)
                lines.push(`+${a}`);
        }
    }
    return lines.join("\n");
}
/** Route map when auto-applying Sauce-style navigations — merge env custom map atop preset when profile allows. */
function resolvePhraseMapForPatch(profile, customEnvMap) {
    const preset = profile === "saucedemo" ? { ...routeHardening_js_1.SAUCEDEMO_PHRASE_TO_PATH } : {};
    return (0, routeHardening_js_1.mergeCustomIntoPhraseMap)(preset, customEnvMap);
}
/**
 * Builds a conservative NLP patch suggestion. Always returns `proposed_nlp_commands`; `testneo_update_test_case_nlp`
 * is null when `test_case_id` cannot be inferred from bundle summary (still useful as a template diff).
 */
function buildSuggestedNlpPatch(bundle, baselineNlp, opts) {
    const testCaseId = extractExecutionSummaryTestCaseId(bundle.summary);
    const corpus = corpusText(bundle);
    const theme = bundle.inferred_root_cause.theme;
    const rationale = [];
    let proposed = [...(baselineNlp && baselineNlp.length ? baselineNlp : [])];
    let confidence = baselineNlp?.length ? "medium" : "low";
    if (!proposed.length) {
        rationale.push("No baseline NLP loaded for this execution; proposing route/wait deltas only against an empty baseline.");
        confidence = "low";
    }
    if (opts.suggestRouteHardenNav) {
        const map = resolvePhraseMapForPatch(opts.routeProfile === "none" ? "saucedemo" : opts.routeProfile, opts.routeEnvCustomMap ?? {});
        const hardened = (0, routeHardening_js_1.hardenNavigationCommands)(proposed, map);
        if (JSON.stringify(hardened.commands) !== JSON.stringify(proposed)) {
            proposed = hardened.commands;
            rationale.push(`Rewrote Navigate-to lines using route phrase map (${hardened.replacements.length} replacement(s)); typical fix for vague checkout/inventory URLs.`);
            confidence = hardened.replacements.length > 0 ? "high" : confidence;
        }
        else if (/(checkout overview|invalid url)/i.test(corpus)) {
            rationale.push("Failure text hints at vague navigation — enable TESTNEO_ROUTE_PROFILE=saucedemo or TESTNEO_ROUTE_MAP_JSON, or rerun testneo_generate_tests_from_context with auto_align_saucedemo_route_map.");
            confidence = "medium";
        }
    }
    if (theme === "timeout_or_wait_condition") {
        const beforeWait = [...proposed];
        proposed = maybeInsertStabilityWait(proposed, theme);
        if (JSON.stringify(proposed) !== JSON.stringify(beforeWait)) {
            rationale.push('Inserted stability wait (`Wait for 2 seconds`) after navigation / before next action.');
            confidence = proposed.length >= (baselineNlp?.length ?? 0) ? "medium" : confidence;
        }
    }
    const baselineEffective = baselineNlp && baselineNlp.length ? baselineNlp : Array(proposed.length).fill("");
    const unified_diff = baselineNlp && baselineNlp.length ? buildUnifiedDiff(baselineNlp, proposed) : buildUnifiedDiff([], proposed);
    const updatePayload = testCaseId !== null
        ? {
            test_case_id: testCaseId,
            nlp_commands: proposed,
            apply_route_hardening: true,
        }
        : null;
    return {
        test_case_id: testCaseId,
        confidence,
        baseline_nlp_commands: baselineNlp && baselineNlp.length ? [...baselineNlp] : null,
        proposed_nlp_commands: [...proposed],
        unified_diff,
        testneo_update_test_case_nlp: updatePayload,
        rationale,
    };
}
