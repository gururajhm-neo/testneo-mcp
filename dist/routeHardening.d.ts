/**
 * Maps vague "Navigate to …" phrases to concrete {{base_url}}/path steps.
 * Presets (e.g. SauceDemo) are optional; any app can supply phrases via env JSON or tool `extra_map`.
 */
export type RouteProfile = "none" | "saucedemo";
export type RouteHardeningToolOverride = {
    enabled?: boolean;
    profile?: RouteProfile;
    extra_map?: Record<string, string>;
};
/** Normalize a phrase for dictionary lookup (keys and targets use the same rules). */
export declare function normalizeNavigatePhrase(target: string): string;
export declare function normalizePathFragment(path: string): string;
export declare const SAUCEDEMO_PHRASE_TO_PATH: Record<string, string>;
export declare function mergeCustomIntoPhraseMap(base: Record<string, string>, custom: Record<string, string>): Record<string, string>;
export type RouteHardeningRuntimeConfig = {
    enabled: boolean;
    profile: RouteProfile;
    customMap: Record<string, string>;
};
export declare function resolvePhraseToPathMap(runtime: RouteHardeningRuntimeConfig, override?: RouteHardeningToolOverride): Record<string, string>;
export type RouteReplacement = {
    index: number;
    before: string;
    after: string;
};
export declare function hardenNavigationCommands(commands: string[], phraseToPath: Record<string, string>): {
    commands: string[];
    replacements: RouteReplacement[];
};
