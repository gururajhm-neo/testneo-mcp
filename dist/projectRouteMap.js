"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseProjectRouteConfig = parseProjectRouteConfig;
exports.buildProjectSettingsWithRouteMap = buildProjectSettingsWithRouteMap;
exports.projectRouteSettingsKey = projectRouteSettingsKey;
const routeHardening_js_1 = require("./routeHardening.js");
const PROJECT_ROUTE_KEY = "mcp_route_hardening";
function asRecord(v) {
    if (!v || typeof v !== "object" || Array.isArray(v))
        return null;
    return v;
}
function parseProfile(v) {
    const t = typeof v === "string" ? v.trim().toLowerCase() : "";
    if (t === "none" || t === "saucedemo")
        return t;
    return undefined;
}
function parseBoolean(v) {
    if (typeof v === "boolean")
        return v;
    return undefined;
}
function parseExtraMap(v) {
    const obj = asRecord(v);
    if (!obj)
        return {};
    const out = {};
    for (const [k, value] of Object.entries(obj)) {
        if (typeof k !== "string" || !k.trim() || typeof value !== "string" || !value.trim())
            continue;
        out[k.trim()] = (0, routeHardening_js_1.normalizePathFragment)(value.trim());
    }
    return out;
}
function parseProjectRouteConfig(project) {
    const settings = asRecord(project.project_settings);
    const raw = settings ? asRecord(settings[PROJECT_ROUTE_KEY]) : null;
    return {
        enabled: parseBoolean(raw?.enabled),
        profile: parseProfile(raw?.profile),
        extra_map: parseExtraMap(raw?.extra_map),
    };
}
function buildProjectSettingsWithRouteMap(currentProjectSettings, routeConfig) {
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
function projectRouteSettingsKey() {
    return PROJECT_ROUTE_KEY;
}
