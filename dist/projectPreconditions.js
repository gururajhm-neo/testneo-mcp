"use strict";
/**
 * Fail-fast checks before generate/execute surfaces: project must have a real HTTP(S) base URL
 * so {{base_url}} expansions and runners do not silently hit placeholder targets.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyExecutableBaseUrl = classifyExecutableBaseUrl;
exports.evaluateProjectExecutableBase = evaluateProjectExecutableBase;
exports.formatPreconditionBlock = formatPreconditionBlock;
/**
 * Classify a single candidate string. Exported for regression checks (see scripts/project-preconditions-check.mjs).
 */
function classifyExecutableBaseUrl(rawInput) {
    const raw = typeof rawInput === "string" ? rawInput.trim() : "";
    if (!raw)
        return null;
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        try {
            url = new URL(`https://${raw}`);
        }
        catch {
            return null;
        }
    }
    if (url.protocol !== "http:" && url.protocol !== "https:")
        return null;
    const host = url.hostname.toLowerCase();
    if (!host)
        return null;
    if (host === "example.com")
        return null;
    return { resolved_base_url: url.toString() };
}
function asRecordArray(v) {
    if (!Array.isArray(v))
        return [];
    return v.filter((x) => x && typeof x === "object" && !Array.isArray(x));
}
function pickBaseFromEnvironmentRow(env) {
    const top = typeof env.base_url === "string" ? env.base_url.trim() : "";
    if (top)
        return { value: top, source: "environment_base_url" };
    const vars = env.variables;
    if (vars && typeof vars === "object" && !Array.isArray(vars)) {
        const bv = vars.base_url;
        if (typeof bv === "string" && bv.trim())
            return { value: bv.trim(), source: "environment_variable_base_url" };
    }
    return null;
}
function sortEnvironmentsForResolution(envs) {
    return [...envs].sort((a, b) => {
        const ad = Boolean(a.is_default);
        const bd = Boolean(b.is_default);
        if (ad !== bd)
            return ad ? -1 : 1;
        const aid = typeof a.id === "number" ? a.id : Number(a.id) || 0;
        const bid = typeof b.id === "number" ? b.id : Number(b.id) || 0;
        return aid - bid;
    });
}
function fail(project_id, code, message, remediation, detail) {
    return { ok: false, project_id, code, message, remediation, detail };
}
/**
 * Load project + environments (when needed) and resolve a single executable base URL.
 */
async function evaluateProjectExecutableBase(client, projectId) {
    let projectBody;
    try {
        projectBody = await client.request(`/api/web/v1/projects/${encodeURIComponent(String(projectId))}`);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return fail(projectId, "project_fetch_failed", `Could not load project ${projectId} to verify execution base URL.`, [
            "Confirm project_id is valid for this API key.",
            "Call testneo_list_projects or testneo_validate_connection.",
        ], msg);
    }
    const websiteUrl = typeof projectBody.website_url === "string" ? projectBody.website_url.trim() : "";
    const primary = classifyExecutableBaseUrl(websiteUrl);
    if (primary) {
        return {
            ok: true,
            project_id: projectId,
            resolved_base_url: primary.resolved_base_url,
            source: "project_website_url",
        };
    }
    let envRows = [];
    try {
        const envPayload = await client.request(`/api/web/v1/projects/${encodeURIComponent(String(projectId))}/environments`);
        envRows = sortEnvironmentsForResolution(asRecordArray(envPayload));
    }
    catch {
        envRows = [];
    }
    for (const env of envRows) {
        const picked = pickBaseFromEnvironmentRow(env);
        if (!picked)
            continue;
        const resolved = classifyExecutableBaseUrl(picked.value);
        if (resolved) {
            return {
                ok: true,
                project_id: projectId,
                resolved_base_url: resolved.resolved_base_url,
                source: picked.source,
            };
        }
    }
    if (!websiteUrl) {
        return fail(projectId, "missing_executable_base_url", `Project ${projectId} has no website_url and no environment base_url suitable for execution.`, [
            "Set the project website URL (target URL) in TestNeo for this project.",
            "Or define a default web environment with a valid base_url variable.",
            "URL must be http(s); example.com is blocked as a placeholder.",
        ]);
    }
    const lower = websiteUrl.toLowerCase();
    if (lower.includes("example.com")) {
        return fail(projectId, "placeholder_base_url", `Project ${projectId} website_url looks like a placeholder (example.com).`, [
            "Replace example.com with your real application base URL.",
            "Configure a default environment base_url if the UI stores URL there instead.",
        ], websiteUrl);
    }
    return fail(projectId, "invalid_base_url", `Project ${projectId} website_url is not a valid http(s) base: ${JSON.stringify(websiteUrl)}`, [
        "Use a full URL such as https://app.example.com or http://localhost:3000",
        "Ensure the value is not a path-only string without host.",
    ], websiteUrl);
}
function formatPreconditionBlock(result) {
    return {
        error: "project_precondition_failed",
        precondition_code: result.code,
        project_id: result.project_id,
        message: result.message,
        remediation: result.remediation,
        ...(result.detail ? { detail: result.detail } : {}),
    };
}
