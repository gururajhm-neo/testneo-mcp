"use strict";
/**
 * Human-readable summaries for TestNeo HTTP errors in MCP tool output (Cursor chat).
 * FastAPI often returns { "detail": { ... } }; some routes return top-level trial / limit fields.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeTestNeoHttpError = summarizeTestNeoHttpError;
exports.buildAgentFacingHttpEnvelope = buildAgentFacingHttpEnvelope;
function isRecord(x) {
    return typeof x === "object" && x !== null && !Array.isArray(x);
}
/**
 * Build a short markdown-friendly summary for 403/429 responses so MCP users see
 * upgrade / limit context without digging through raw JSON.
 */
function summarizeTestNeoHttpError(status, bodyText) {
    if (status !== 403 && status !== 429)
        return null;
    const raw = bodyText.trim();
    if (!raw)
        return null;
    let root;
    try {
        const p = JSON.parse(raw);
        root = isRecord(p) ? p : {};
    }
    catch {
        return raw.length > 800 ? `${raw.slice(0, 800)}…` : raw;
    }
    if (root.trial_expired === true && typeof root.error === "string") {
        return [
            String(root.error),
            "",
            "Your trial or subscription blocked this API call. Open the TestNeo web app to upgrade or renew, then retry the MCP tool.",
        ].join("\n");
    }
    if (root.upgrade_required === true) {
        const parts = [];
        if (typeof root.error === "string")
            parts.push(String(root.error));
        if (typeof root.message === "string")
            parts.push(String(root.message));
        if (typeof root.upgrade_url === "string")
            parts.push(`Upgrade / pricing path: ${String(root.upgrade_url)}`);
        if (parts.length)
            return parts.join("\n\n");
    }
    const d = root.detail;
    if (typeof d === "string") {
        return d.length > 800 ? `${d.slice(0, 800)}…` : d;
    }
    if (!isRecord(d)) {
        if (typeof root.error === "string")
            return String(root.error);
        return null;
    }
    const detail = d;
    const lines = [];
    const errorCode = typeof detail.error === "string" ? detail.error : "";
    const friendlyByCode = {
        release_verification_limit_reached: "Monthly release verification limit reached. Each PR validation counts as one verification (impact, execution, evidence, PASS/WARN/BLOCK).",
        mcp_call_limit_reached: "Daily MCP call limit reached (write operations). Upgrade to Pro for unlimited MCP, or wait until tomorrow.",
        test_run_limit_reached: "Monthly test execution limit reached inside your plan. Upgrade for more capacity or wait for the monthly reset.",
        daily_chat_limit_reached: "Daily AI chat limit reached. Upgrade your plan or try again tomorrow.",
        project_limit_reached: "Project limit reached. Upgrade to create more projects.",
    };
    if (errorCode && friendlyByCode[errorCode]) {
        lines.push(friendlyByCode[errorCode]);
    }
    if (typeof detail.message === "string")
        lines.push(String(detail.message));
    else if (errorCode && !friendlyByCode[errorCode])
        lines.push(errorCode);
    if (typeof detail.error_code === "string") {
        lines.push(`(code: ${String(detail.error_code)})`);
    }
    if (typeof detail.current === "number" && typeof detail.limit === "number") {
        lines.push(`Usage: ${detail.current} / ${detail.limit}`);
    }
    const usage = detail.usage_info;
    if (isRecord(usage)) {
        const cur = usage.current ?? usage.current_usage;
        const lim = usage.limit ?? usage.daily_limit;
        if (typeof cur === "number" && typeof lim === "number") {
            lines.push(`Usage: ${cur} / ${lim}`);
        }
    }
    const limInfo = detail.limit_info;
    if (isRecord(limInfo)) {
        const cur = limInfo.current;
        const lim = limInfo.limit;
        if (typeof cur === "number" && typeof lim === "number") {
            lines.push(`Usage: ${cur} / ${lim}`);
        }
    }
    if (detail.upgrade_required === true || typeof detail.upgrade_url === "string") {
        if (typeof detail.upgrade_url === "string") {
            lines.push(`Upgrade: ${String(detail.upgrade_url)}`);
        }
        else {
            lines.push("Upgrade: /pricing (open from your TestNeo app origin)");
        }
    }
    if (!lines.length)
        return null;
    return lines.join("\n");
}
function categorizeHttpStatus(status) {
    if (status === 401)
        return "unauthorized";
    if (status === 403)
        return "forbidden";
    if (status === 404)
        return "not_found";
    if (status === 409)
        return "conflict";
    if (status === 422 || status === 400)
        return "validation";
    if (status === 429)
        return "rate_limit";
    if (status >= 500)
        return "server";
    return "unknown";
}
function defaultNextSteps(status, agentSetupUrl) {
    const steps = [];
    if (status === 401) {
        steps.push("Regenerate your TestNeo API key (tn_…) and update TESTNEO_API_KEY / ~/.npmrc token if you use publish.");
        steps.push("Confirm npm whoami works with the same credentials used for MCP.");
    }
    if (status === 403) {
        steps.push("Check subscription / trial limits in the TestNeo web app.");
        steps.push("If publishing npm packages, ensure your token has publish scope and use npm publish --otp if 2FA applies.");
    }
    if (status === 404 && agentSetupUrl) {
        steps.push(`No resource found. If this was the local agent endpoint, install and connect the agent: ${agentSetupUrl}`);
    }
    if (status === 429)
        steps.push("Wait and retry with exponential backoff; reduce parallel tool calls.");
    if (status >= 500)
        steps.push("Retry later; if it persists, contact support with request_id from _telemetry when available.");
    return steps;
}
/**
 * Structured JSON error for MCP tools so agents can branch without scraping stack traces.
 */
function buildAgentFacingHttpEnvelope(status, path, bodyText, opts) {
    const category = categorizeHttpStatus(status);
    const hint = summarizeTestNeoHttpError(status, bodyText);
    const message = hint ??
        (bodyText.trim().length ? bodyText.trim().slice(0, 500) : `HTTP ${status} on ${path}`);
    const retryable = status === 429 || status >= 500;
    return {
        contract_version: "testneo_mcp_http_error.v1",
        http_status: status,
        path,
        category,
        message,
        detail_excerpt: bodyText.trim().slice(0, 1200),
        retryable,
        next_steps: defaultNextSteps(status, opts?.agentSetupUrl),
    };
}
