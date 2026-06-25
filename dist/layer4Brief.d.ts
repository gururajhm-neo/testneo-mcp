/**
 * Layer 4 release intelligence — shared brief formatting for MCP PR validation.
 * Mirrors app/services/release_intelligence_brief.py (keep in sync).
 */
export interface RiskFactorRow {
    factor: string;
    score: number;
    weight: number;
    explanation: string;
}
export interface ReleaseConfidenceFactor {
    factor: string;
    label?: string;
    score: number;
    weight: number;
    detail?: string;
}
import type { AffectedTestCandidate } from "./orchestration/contracts.js";
export interface TestGapFunction {
    file_path: string;
    function_name: string;
    function_key: string;
}
export interface TestGaps {
    total_changed_functions: number;
    mapped_count: number;
    unmapped_count: number;
    coverage_pct: number;
    unmapped_functions: TestGapFunction[];
    has_gaps: boolean;
    generate_hint?: string | null;
}
export declare const GENERATE_IF_UNMAPPED_HINT: string;
export declare function sortRiskFactors(factors: RiskFactorRow[]): RiskFactorRow[];
export declare function sortReleaseBreakdown(rows: ReleaseConfidenceFactor[]): ReleaseConfidenceFactor[];
export declare function computeTestGaps(input: {
    changedFunctions?: Record<string, string[]>;
    affectedTests?: AffectedTestCandidate[];
    previewLimit?: number;
}): TestGaps;
export declare function formatRiskFactorLines(factors: RiskFactorRow[], limit?: number): string[];
export declare function formatTestGapLines(testGaps: TestGaps | null | undefined): string[];
export declare function formatReleaseConfidenceLines(breakdown: ReleaseConfidenceFactor[] | null | undefined, releaseConfidence?: number, limit?: number): string[];
export declare function appendLayer4Sections(lines: string[], opts: {
    riskFactors?: RiskFactorRow[];
    testGaps?: TestGaps | null;
    releaseConfidence?: number;
    releaseConfidenceBreakdown?: ReleaseConfidenceFactor[];
    riskFactorLimit?: number;
    releaseFactorLimit?: number;
}): string[];
