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
export function normalizeNavigatePhrase(target: string): string {
  return target
    .replace(/^["']|["']$/g, "")
    .trim()
    .toLowerCase()
    .replace(/^the\s+/i, "")
    .replace(/\s+(screen|page|view|panel|route|url)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePathFragment(path: string): string {
  const t = path.trim();
  if (!t) return "/";
  if (t.startsWith("/")) return t;
  return `/${t}`;
}

const NAVIGATE_LINE = /^\s*(Navigate\s+to)\s+(.+?)\s*$/i;

function shouldSkipTargetRewrite(target: string): boolean {
  const t = target.trim();
  if (!t) return true;
  if (/^\{\{\s*base_url\s*\}\}/i.test(t)) return true;
  if (/^https?:\/\//i.test(t)) return true;
  if (t.startsWith("/")) return true;
  return false;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Longest key wins when multiple phrase keys match the normalized target. */
function lookupPath(norm: string, sortedKeys: string[], map: Record<string, string>): string | undefined {
  if (map[norm]) return map[norm];
  for (const key of sortedKeys) {
    if (norm === key) return map[key];
  }
  for (const key of sortedKeys) {
    const re = new RegExp(`(^|\\s)${escapeRe(key)}(\\s|$)`);
    if (re.test(norm)) return map[key];
  }
  return undefined;
}

const SAUCEDEMO_RAW: ReadonlyArray<readonly [string, string]> = [
  ["login", "/"],
  ["login page", "/"],
  ["sign in", "/"],
  ["sign in page", "/"],
  ["products", "/inventory.html"],
  ["product listing", "/inventory.html"],
  ["inventory", "/inventory.html"],
  ["inventory page", "/inventory.html"],
  ["catalog", "/inventory.html"],
  ["shopping inventory", "/inventory.html"],
  ["cart", "/cart.html"],
  ["shopping cart", "/cart.html"],
  ["your cart", "/cart.html"],
  ["cart page", "/cart.html"],
  ["checkout", "/checkout-step-one.html"],
  ["checkout information", "/checkout-step-one.html"],
  ["checkout your information", "/checkout-step-one.html"],
  ["checkout step one", "/checkout-step-one.html"],
  ["checkout step 1", "/checkout-step-one.html"],
  ["checkout overview", "/checkout-step-two.html"],
  ["checkout overview screen", "/checkout-step-two.html"],
  ["checkout summary", "/checkout-step-two.html"],
  ["review your order", "/checkout-step-two.html"],
  ["checkout step two", "/checkout-step-two.html"],
  ["checkout step 2", "/checkout-step-two.html"],
  ["order complete", "/checkout-complete.html"],
  ["thank you", "/checkout-complete.html"],
  ["confirmation", "/checkout-complete.html"],
  ["checkout complete", "/checkout-complete.html"],
];

function buildSaucedemoMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [phrase, path] of SAUCEDEMO_RAW) {
    out[normalizeNavigatePhrase(phrase)] = normalizePathFragment(path);
  }
  return out;
}

export const SAUCEDEMO_PHRASE_TO_PATH: Record<string, string> = buildSaucedemoMap();

export function mergeCustomIntoPhraseMap(
  base: Record<string, string>,
  custom: Record<string, string>
): Record<string, string> {
  const merged = { ...base };
  for (const [k, v] of Object.entries(custom)) {
    merged[normalizeNavigatePhrase(k)] = normalizePathFragment(v);
  }
  return merged;
}

export type RouteHardeningRuntimeConfig = {
  enabled: boolean;
  profile: RouteProfile;
  customMap: Record<string, string>;
};

export function resolvePhraseToPathMap(
  runtime: RouteHardeningRuntimeConfig,
  override?: RouteHardeningToolOverride
): Record<string, string> {
  const enabled = override?.enabled ?? runtime.enabled;
  if (!enabled) return {};

  const profile = override?.profile ?? runtime.profile;
  const preset = profile === "saucedemo" ? { ...SAUCEDEMO_PHRASE_TO_PATH } : {};
  let merged = mergeCustomIntoPhraseMap(preset, runtime.customMap);
  merged = mergeCustomIntoPhraseMap(merged, override?.extra_map ?? {});
  return merged;
}

export type RouteReplacement = { index: number; before: string; after: string };

export function hardenNavigationCommands(
  commands: string[],
  phraseToPath: Record<string, string>
): { commands: string[]; replacements: RouteReplacement[] } {
  const keys = Object.keys(phraseToPath);
  if (!keys.length) {
    return { commands: [...commands], replacements: [] };
  }
  const sortedKeys = [...keys].sort((a, b) => b.length - a.length);
  const replacements: RouteReplacement[] = [];
  const out = commands.map((line, index) => {
    const m = line.match(NAVIGATE_LINE);
    if (!m?.[1] || !m[2]) return line;
    const prefix = m[1];
    const rawTarget = m[2];
    if (shouldSkipTargetRewrite(rawTarget)) return line;
    const norm = normalizeNavigatePhrase(rawTarget);
    const path = lookupPath(norm, sortedKeys, phraseToPath);
    if (!path) return line;
    const after = `${prefix} {{base_url}}${path}`;
    if (after !== line) {
      replacements.push({ index, before: line, after });
    }
    return after;
  });
  return { commands: out, replacements };
}
