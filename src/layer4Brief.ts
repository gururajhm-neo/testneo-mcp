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

const RISK_FACTOR_LABELS: Record<string, string> = {
  blast_radius: "Blast radius",
  historical: "Historical failure rate",
  critical_path: "Critical path touch",
  component_history: "Component history",
  dependency_blast: "Dependency blast",
  verification_coverage_gap: "Verification coverage gap",
  engineering_memory: "Engineering Memory",
};

const RELEASE_FACTOR_LABELS: Record<string, string> = {
  verification_coverage: "Verification coverage",
  avg_risk_score: "Average PR risk",
  component_health: "Component health",
  engineering_memory: "Engineering Memory",
  incident_density: "Incident density",
  execution_evidence: "Execution evidence",
};

export const GENERATE_IF_UNMAPPED_HINT =
  "Re-run with `generate_if_unmapped: true` in testneo_developer_release_workflow " +
  "or use testneo_generate_tests_from_code.";

function riskFactorLabel(factor: string): string {
  return RISK_FACTOR_LABELS[factor] ?? factor.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function releaseFactorLabel(factor: string): string {
  return RELEASE_FACTOR_LABELS[factor] ?? factor.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function factorContribution(row: { score?: number; weight?: number }): number {
  return (row.score ?? 0) * (row.weight ?? 0);
}

export function sortRiskFactors(factors: RiskFactorRow[]): RiskFactorRow[] {
  return [...factors].sort((a, b) => factorContribution(b) - factorContribution(a));
}

export function sortReleaseBreakdown(rows: ReleaseConfidenceFactor[]): ReleaseConfidenceFactor[] {
  return [...rows].sort((a, b) => factorContribution(b) - factorContribution(a));
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function computeTestGaps(input: {
  changedFunctions?: Record<string, string[]>;
  affectedTests?: AffectedTestCandidate[];
  previewLimit?: number;
}): TestGaps {
  const covered = new Set<string>();
  for (const row of input.affectedTests ?? []) {
    if (row.matched_function) covered.add(row.matched_function);
  }

  let totalChanged = 0;
  const unmapped: TestGapFunction[] = [];

  for (const [filePath, functions] of Object.entries(input.changedFunctions ?? {})) {
    const fp = normalizePath(filePath);
    for (const func of functions ?? []) {
      const name = (func ?? "").trim();
      if (!name) continue;
      totalChanged += 1;
      const funcKey = `${fp}::${name}`;
      if (covered.has(funcKey)) continue;
      unmapped.push({ file_path: fp, function_name: name, function_key: funcKey });
    }
  }

  const mappedCount = Math.max(0, totalChanged - unmapped.length);
  const coveragePct = totalChanged > 0 ? Math.round((mappedCount / totalChanged) * 1000) / 10 : 100;
  const previewLimit = input.previewLimit ?? 10;

  return {
    total_changed_functions: totalChanged,
    mapped_count: mappedCount,
    unmapped_count: unmapped.length,
    coverage_pct: coveragePct,
    unmapped_functions: unmapped.slice(0, previewLimit),
    has_gaps: unmapped.length > 0,
    generate_hint: unmapped.length > 0 ? GENERATE_IF_UNMAPPED_HINT : null,
  };
}

export function formatRiskFactorLines(factors: RiskFactorRow[], limit = 5): string[] {
  return sortRiskFactors(factors)
    .slice(0, limit)
    .map((factor) => {
      const label = riskFactorLabel(factor.factor);
      const explanation = (factor.explanation ?? "").trim();
      return explanation
        ? `- **${label}** (${factor.score}/100): ${explanation}`
        : `- **${label}** (${factor.score}/100)`;
    });
}

export function formatTestGapLines(testGaps: TestGaps | null | undefined): string[] {
  if (!testGaps?.has_gaps) return [];

  const lines = [
    `- **${testGaps.unmapped_count}** of **${testGaps.total_changed_functions}** changed function(s) ` +
      `have no TestNeo test mapping (${testGaps.coverage_pct}% mapped)`,
  ];
  for (const item of testGaps.unmapped_functions) {
    lines.push(`  - \`${item.file_path}\` → \`${item.function_name}\``);
  }
  const remaining = testGaps.unmapped_count - testGaps.unmapped_functions.length;
  if (remaining > 0) lines.push(`  - _…and ${remaining} more_`);
  if (testGaps.generate_hint) lines.push(`- **Next step:** ${testGaps.generate_hint}`);
  return lines;
}

export function formatReleaseConfidenceLines(
  breakdown: ReleaseConfidenceFactor[] | null | undefined,
  releaseConfidence?: number,
  limit = 3,
): string[] {
  const sorted = sortReleaseBreakdown(breakdown ?? []);
  if (sorted.length === 0) return [];

  const header =
    releaseConfidence !== undefined
      ? `Release confidence **${releaseConfidence}%** — top drivers:`
      : "Release confidence drivers:";

  const lines = [header];
  for (const row of sorted.slice(0, limit)) {
    const label = row.label ?? releaseFactorLabel(row.factor);
    const detail = (row.detail ?? "").trim();
    lines.push(
      detail
        ? `- **${label}** (${row.score}/100): ${detail}`
        : `- **${label}** (${row.score}/100)`,
    );
  }
  return lines;
}

export function appendLayer4Sections(
  lines: string[],
  opts: {
    riskFactors?: RiskFactorRow[];
    testGaps?: TestGaps | null;
    releaseConfidence?: number;
    releaseConfidenceBreakdown?: ReleaseConfidenceFactor[];
    riskFactorLimit?: number;
    releaseFactorLimit?: number;
  },
): string[] {
  const out = [...lines];

  const factorLines = formatRiskFactorLines(opts.riskFactors ?? [], opts.riskFactorLimit ?? 5);
  if (factorLines.length > 0) {
    out.push("### Why this score", ...factorLines, "");
  }

  const gapLines = formatTestGapLines(opts.testGaps);
  if (gapLines.length > 0) {
    out.push("### Test gaps", ...gapLines, "");
  }

  const confidenceLines = formatReleaseConfidenceLines(
    opts.releaseConfidenceBreakdown,
    opts.releaseConfidence,
    opts.releaseFactorLimit ?? 3,
  );
  if (confidenceLines.length > 0) {
    out.push("### Release confidence", ...confidenceLines, "");
  }

  return out;
}
