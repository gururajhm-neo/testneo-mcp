import type { AffectedTestCandidate, ChangedFile, ComponentHealthEntry, DependencyBlast, Severity } from "./contracts.js";
export type RiskLevel = "PASS" | "WARN" | "BLOCK";
export interface RiskFactor {
    factor: string;
    score: number;
    weight: number;
    explanation: string;
}
export interface RiskScoreResult {
    risk_score: number;
    risk_level: RiskLevel;
    risk_factors: RiskFactor[];
    merge_signal: "clean" | "review" | "block";
    merge_recommendation: "merge" | "merge_with_followup" | "hold" | "request_changes";
    confidence: number;
    summary: string;
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
export declare function deriveComponentFromPath(filePath: string): string | null;
/**
 * Sprint 3 updated weights (sum = 1.0):
 *   blast_radius:       0.25  (reduced — dependency_blast now captures file-spread)
 *   historical:         0.22  (reduced slightly)
 *   critical_path:      0.18  (reduced slightly)
 *   component_history:  0.13  (reduced slightly)
 *   dependency_blast:   0.12  (NEW Sprint 3 — transitive import depth & spread)
 *   coverage_gap:       0.10  (unchanged)
 */
export declare function computeRiskScore(changedFiles: ChangedFile[], affectedTests: AffectedTestCandidate[], componentHealth?: ComponentHealthEntry[], dependencyBlast?: DependencyBlast): RiskScoreResult;
export declare function severityFromRiskLevel(level: RiskLevel): Severity;
