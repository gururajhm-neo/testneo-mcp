/**
 * Produce a concrete testneo_update_test_case_nlp–style suggestion from a failure bundle.
 * Conservative heuristics: route hardening, light wait insertion for timeouts — not full selector rewrites.
 */
import { type RouteProfile } from "./routeHardening.js";
export type FailureBundleLike = {
    execution_id: string;
    summary: Record<string, unknown>;
    inferred_root_cause: {
        theme: string;
        confidence: string;
        nextActions: string[];
    };
    failed_event_sample?: Array<Record<string, unknown>>;
    log_sample?: Array<Record<string, unknown>>;
};
export declare function extractExecutionSummaryTestCaseId(summary: Record<string, unknown>): number | null;
export type SuggestedNlpPatch = {
    test_case_id: number | null;
    confidence: "high" | "medium" | "low";
    baseline_nlp_commands: string[] | null;
    proposed_nlp_commands: string[];
    unified_diff: string;
    testneo_update_test_case_nlp: {
        test_case_id: number;
        nlp_commands: string[];
        apply_route_hardening: boolean;
    } | null;
    rationale: string[];
};
/**
 * Builds a conservative NLP patch suggestion. Always returns `proposed_nlp_commands`; `testneo_update_test_case_nlp`
 * is null when `test_case_id` cannot be inferred from bundle summary (still useful as a template diff).
 */
export declare function buildSuggestedNlpPatch(bundle: FailureBundleLike, baselineNlp: string[] | null, opts: {
    routeProfile: RouteProfile;
    routeEnvCustomMap?: Record<string, string>;
    suggestRouteHardenNav: boolean;
}): SuggestedNlpPatch;
