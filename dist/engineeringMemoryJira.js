"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENGINEERING_MEMORY_JIRA_CONTRACT = void 0;
exports.wrapEngineeringMemoryJira = wrapEngineeringMemoryJira;
exports.syncJiraEngineeringMemory = syncJiraEngineeringMemory;
exports.ENGINEERING_MEMORY_JIRA_CONTRACT = "engineering_memory_jira_sync.v1";
function wrapEngineeringMemoryJira(payload) {
    return {
        contract_version: exports.ENGINEERING_MEMORY_JIRA_CONTRACT,
        ...payload,
    };
}
async function syncJiraEngineeringMemory(client, project_id, opts) {
    const body = {
        project_id,
        max_issues: opts?.max_issues ?? 50,
        lookback_days: opts?.lookback_days ?? 90,
    };
    if (opts?.jira_project_key?.trim()) {
        body.jira_project_key = opts.jira_project_key.trim();
    }
    return client.request("/api/web/v1/engineering-memory/ingest/jira", {
        method: "POST",
        body,
        timeoutMs: client.longRequestTimeoutMs,
    });
}
