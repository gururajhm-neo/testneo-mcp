"use strict";
/**
 * Human-readable summaries for TestNeo HTTP errors in MCP tool output (Cursor chat).
 * FastAPI often returns { "detail": { ... } }; some routes return top-level trial / limit fields.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeTestNeoHttpError = summarizeTestNeoHttpError;
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
    if (typeof detail.message === "string")
        lines.push(String(detail.message));
    else if (typeof detail.error === "string")
        lines.push(String(detail.error));
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
