"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferRequiresAuthFromNlp = inferRequiresAuthFromNlp;
exports.evaluatePreconditionPolicies = evaluatePreconditionPolicies;
exports.formatPolicyFailure = formatPolicyFailure;
const projectPreconditions_js_1 = require("./projectPreconditions.js");
function asRecordArray(v) {
    if (!Array.isArray(v))
        return [];
    return v.filter((x) => x && typeof x === "object" && !Array.isArray(x));
}
function hasCredentialVars(env) {
    const flat = (0, projectPreconditions_js_1.flattenEnvironmentVariables)(env);
    const user = flat.username?.trim() ?? "";
    const pass = flat.password?.trim() ?? "";
    return user.length > 0 && pass.length > 0;
}
function inferRequiresAuthFromNlp(commands) {
    if (!commands || !commands.length)
        return false;
    const text = commands.join("\n").toLowerCase();
    return (text.includes("login") ||
        text.includes("sign in") ||
        text.includes("fill username") ||
        text.includes("fill password"));
}
function hasAssertionCoverage(commands) {
    if (!commands || !commands.length)
        return false;
    return commands.some((x) => /verify|assert|expect/i.test(x));
}
function listUnknownNavigateTargets(commands, routeMap) {
    if (!commands?.length)
        return [];
    const known = Object.keys(routeMap || {}).map((k) => k.toLowerCase());
    const unknown = [];
    for (const cmd of commands) {
        const m = cmd.match(/^\s*navigate\s+to\s+(.+?)\s*$/i);
        if (!m?.[1])
            continue;
        const raw = m[1].trim();
        if (!raw || raw.startsWith("/") || raw.startsWith("http") || raw.toLowerCase().startsWith("{{base_url}}"))
            continue;
        const low = raw.toLowerCase();
        const hit = known.some((k) => low.includes(k));
        if (!hit)
            unknown.push(raw);
    }
    return unknown;
}
function looksLikeCheckoutFlow(commands) {
    if (!commands?.length)
        return false;
    const t = commands.join("\n").toLowerCase();
    return t.includes("checkout");
}
function hasAddToCart(commands) {
    if (!commands?.length)
        return false;
    return commands.some((x) => /add.*cart|cart.*add/i.test(x));
}
async function evaluatePreconditionPolicies(client, ctx) {
    const findings = [];
    if (!ctx.skip_base_url_check) {
        const base = await (0, projectPreconditions_js_1.evaluateProjectExecutableBase)(client, ctx.project_id);
        if (!base.ok) {
            findings.push({
                code: base.code === "invalid_base_url" || base.code === "placeholder_base_url" ? "missing_executable_base_url" : base.code,
                severity: "blocker",
                message: base.message,
                remediation: base.remediation,
                detail: base.detail,
            });
        }
    }
    const authRequired = ctx.auth_expectation === "required" || inferRequiresAuthFromNlp(ctx.nlp_commands);
    if (authRequired) {
        try {
            const envPayload = await client.request(`/api/web/v1/projects/${encodeURIComponent(String(ctx.project_id))}/environments`);
            const envRows = asRecordArray(envPayload);
            const hasCreds = envRows.some((e) => hasCredentialVars(e));
            if (!hasCreds) {
                findings.push({
                    code: "missing_auth_credentials",
                    severity: ctx.mode === "strict" ? "blocker" : "warning",
                    message: `Project ${ctx.project_id} appears to require login steps but no environment username/password variables were found.`,
                    remediation: [
                        "Define username and password in project environment variables.",
                        "Or remove login-dependent steps before execution.",
                    ],
                });
            }
        }
        catch {
            findings.push({
                code: "project_fetch_failed",
                severity: ctx.mode === "strict" ? "blocker" : "warning",
                message: "Could not load project environments to validate auth preconditions.",
                remediation: ["Verify API access and project ownership; retry."],
            });
        }
    }
    if ((ctx.tool_name.includes("execute") || ctx.tool_name.includes("rerun")) && ctx.nlp_commands?.length) {
        if (!hasAssertionCoverage(ctx.nlp_commands)) {
            findings.push({
                code: "weak_assertion_coverage",
                severity: "warning",
                message: "NLP commands contain no explicit verify/assert/expect step.",
                remediation: [
                    "Add at least one assertion step to avoid false positives.",
                    "Use testneo_update_test_case_nlp to insert a deterministic verification.",
                ],
            });
        }
    }
    if ((ctx.tool_name.includes("execute") || ctx.tool_name.includes("generate")) && ctx.nlp_commands?.length) {
        const unknownNav = listUnknownNavigateTargets(ctx.nlp_commands, ctx.route_map ?? {});
        if (unknownNav.length > 0) {
            findings.push({
                code: "missing_route_map_coverage",
                severity: ctx.mode === "strict" ? "blocker" : "warning",
                message: `Found Navigate targets without route-map coverage: ${unknownNav.slice(0, 5).join(", ")}`,
                remediation: [
                    "Add phrase mappings in project route map (testneo_set_project_route_map).",
                    "Or use explicit {{base_url}}/path in NLP commands.",
                ],
            });
        }
    }
    if ((ctx.tool_name.includes("execute") || ctx.tool_name.includes("trigger")) && looksLikeCheckoutFlow(ctx.nlp_commands)) {
        if (!hasAddToCart(ctx.nlp_commands)) {
            findings.push({
                code: "missing_checkout_data_prerequisite",
                severity: ctx.mode === "strict" ? "blocker" : "warning",
                message: "Checkout flow detected but no add-to-cart prerequisite step was found.",
                remediation: [
                    "Insert add-to-cart steps before checkout.",
                    "Or run from a test data state that already has cart items.",
                ],
            });
        }
    }
    const hasBlocker = findings.some((f) => f.severity === "blocker");
    return {
        ok: !hasBlocker,
        mode: ctx.mode,
        tool_name: ctx.tool_name,
        project_id: ctx.project_id,
        findings,
    };
}
function formatPolicyFailure(result) {
    return {
        error: "policy_failed",
        policy_mode: result.mode,
        tool: result.tool_name,
        project_id: result.project_id,
        findings: result.findings,
    };
}
