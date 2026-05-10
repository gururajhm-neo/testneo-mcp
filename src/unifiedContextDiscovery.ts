/** Helpers to pick a unified context by human-friendly name instead of numeric context_id alone. */

export type UnifiedContextSummary = {
  id: number;
  name: string;
  description?: string | null;
  context_type?: string;
  entity_count?: number;
  relationship_count?: number;
  ai_summary?: string | null;
  created_at?: string;
  is_active?: boolean;
};

export function normalizeContextQuery(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

export type MatchMode = "auto" | "exact" | "substring";

function normName(raw: string): string {
  return normalizeContextQuery(raw);
}

/** -1 no match; 0 exact name; 1 starts with query; 2 contains query elsewhere */
export function rankNameMatch(itemName: string, queryNorm: string): -1 | 0 | 1 | 2 {
  if (!queryNorm) return -1;
  const n = normName(itemName);
  if (n === queryNorm) return 0;
  if (n.startsWith(queryNorm)) return 1;
  if (n.includes(queryNorm)) return 2;
  return -1;
}

export type ResolveUnifiedContextResult = {
  query_normalized: string;
  effective_mode: MatchMode;
  chosen: UnifiedContextSummary | null;
  candidates_same_tier: UnifiedContextSummary[];
  best_rank: -1 | 0 | 1 | 2;
  hint: string;
};

function compareRecency(a: UnifiedContextSummary, b: UnifiedContextSummary): number {
  const ta = a.created_at ? Date.parse(String(a.created_at)) : 0;
  const tb = b.created_at ? Date.parse(String(b.created_at)) : 0;
  return tb - ta;
}

/** Active-only when flag is explicitly false on an item — otherwise keep (API defaults to active contexts). */
function isUsable(item: UnifiedContextSummary): boolean {
  if (item.is_active === false) return false;
  return true;
}

/**
 * Resolve a single context_id from natural language against a list endpoint payload.
 *
 * auto: tier exact → starts-with → substring; prefer newest within tier unless prefer_context_id resolves a tie.
 * exact: normalized full name equality (may still collide if duplicates exist).
 * substring: normalized name `.includes(query)`.
 */
export function resolveUnifiedContextByName(
  items: UnifiedContextSummary[],
  rawQuery: string,
  mode: MatchMode,
  opts?: { prefer_context_id?: number }
): ResolveUnifiedContextResult {
  const query_normalized = normalizeContextQuery(rawQuery);
  const pool = items.filter(isUsable);

  if (!query_normalized) {
    return {
      query_normalized,
      effective_mode: mode,
      chosen: null,
      candidates_same_tier: [],
      best_rank: -1,
      hint: "Missing or empty context name query.",
    };
  }

  const prefer = opts?.prefer_context_id;

  const tierForMode = (): { tier: UnifiedContextSummary[]; rank: -1 | 0 | 1 | 2 } => {
    if (mode === "exact") {
      const tier = pool.filter((x) => rankNameMatch(x.name, query_normalized) === 0).sort(compareRecency);
      return { tier, rank: tier.length ? 0 : -1 };
    }
    if (mode === "substring") {
      const tier = pool
        .filter((x) => normName(x.name).includes(query_normalized))
        .sort((a, b) => compareRecency(a, b));
      const rank = tier.length ? 2 : -1;
      return { tier, rank };
    }
    // auto
    let bestRank: -1 | 0 | 1 | 2 = -1;
    for (let r = 0; r <= 2; r += 1) {
      const rk = r as 0 | 1 | 2;
      const hit = pool.filter((x) => rankNameMatch(x.name, query_normalized) === rk);
      if (hit.length) {
        bestRank = rk;
        return { tier: hit.sort(compareRecency), rank: bestRank };
      }
    }
    return { tier: [], rank: -1 };
  };

  const { tier, rank: best_rank } = tierForMode();
  let chosen: UnifiedContextSummary | null = null;
  let hint: string;

  if (!tier.length) {
    hint =
      mode === "exact"
        ? "No unified context matched this exact name."
        : mode === "substring"
          ? "No unified context name contains this substring."
          : "No unified context matched (try substring mode or a shorter query).";
    return {
      query_normalized,
      effective_mode: mode,
      chosen: null,
      candidates_same_tier: [],
      best_rank,
      hint,
    };
  }

  if (prefer !== undefined && tier.some((x) => x.id === prefer)) {
    chosen = tier.find((x) => x.id === prefer)!;
    hint = "Resolved via prefer_context_id among name matches.";
  } else if (tier.length === 1) {
    chosen = tier[0]!;
    hint = "Unique match.";
  } else if (tier.length <= 15) {
    hint = `Ambiguous: ${tier.length} contexts matched. Pass prefer_context_id or narrow the name.`;
  } else {
    hint = `Ambiguous: many contexts (${tier.length}) matched; showing first 15 — narrow the query.`;
  }

  return {
    query_normalized,
    effective_mode: mode,
    chosen,
    candidates_same_tier: tier.slice(0, 15),
    best_rank,
    hint,
  };
}
