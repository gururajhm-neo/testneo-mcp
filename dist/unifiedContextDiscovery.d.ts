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
export declare function normalizeContextQuery(input: string): string;
export type MatchMode = "auto" | "exact" | "substring";
/** -1 no match; 0 exact name; 1 starts with query; 2 contains query elsewhere */
export declare function rankNameMatch(itemName: string, queryNorm: string): -1 | 0 | 1 | 2;
export type ResolveUnifiedContextResult = {
    query_normalized: string;
    effective_mode: MatchMode;
    chosen: UnifiedContextSummary | null;
    candidates_same_tier: UnifiedContextSummary[];
    best_rank: -1 | 0 | 1 | 2;
    hint: string;
};
/**
 * Resolve a single context_id from natural language against a list endpoint payload.
 *
 * auto: tier exact → starts-with → substring; prefer newest within tier unless prefer_context_id resolves a tie.
 * exact: normalized full name equality (may still collide if duplicates exist).
 * substring: normalized name `.includes(query)`.
 */
export declare function resolveUnifiedContextByName(items: UnifiedContextSummary[], rawQuery: string, mode: MatchMode, opts?: {
    prefer_context_id?: number;
}): ResolveUnifiedContextResult;
