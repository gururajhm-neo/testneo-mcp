import { normalizePathFragment, type RouteProfile } from "./routeHardening.js";

export type ProjectRouteHardeningConfig = {
  enabled?: boolean;
  profile?: RouteProfile;
  extra_map: Record<string, string>;
};

const PROJECT_ROUTE_KEY = "mcp_route_hardening";

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function parseProfile(v: unknown): RouteProfile | undefined {
  const t = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (t === "none" || t === "saucedemo") return t;
  return undefined;
}

function parseBoolean(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  return undefined;
}

function parseExtraMap(v: unknown): Record<string, string> {
  const obj = asRecord(v);
  if (!obj) return {};
  const out: Record<string, string> = {};
  for (const [k, value] of Object.entries(obj)) {
    if (typeof k !== "string" || !k.trim() || typeof value !== "string" || !value.trim()) continue;
    out[k.trim()] = normalizePathFragment(value.trim());
  }
  return out;
}

export function parseProjectRouteConfig(project: Record<string, unknown>): ProjectRouteHardeningConfig {
  const settings = asRecord(project.project_settings);
  const raw = settings ? asRecord(settings[PROJECT_ROUTE_KEY]) : null;
  return {
    enabled: parseBoolean(raw?.enabled),
    profile: parseProfile(raw?.profile),
    extra_map: parseExtraMap(raw?.extra_map),
  };
}

export function buildProjectSettingsWithRouteMap(
  currentProjectSettings: unknown,
  routeConfig: ProjectRouteHardeningConfig
): Record<string, unknown> {
  const base = asRecord(currentProjectSettings) ?? {};
  return {
    ...base,
    [PROJECT_ROUTE_KEY]: {
      ...(routeConfig.enabled === undefined ? {} : { enabled: routeConfig.enabled }),
      ...(routeConfig.profile ? { profile: routeConfig.profile } : {}),
      extra_map: routeConfig.extra_map,
      updated_at: new Date().toISOString(),
    },
  };
}

export function projectRouteSettingsKey(): string {
  return PROJECT_ROUTE_KEY;
}

