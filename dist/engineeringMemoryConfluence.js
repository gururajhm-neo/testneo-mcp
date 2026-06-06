"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENGINEERING_MEMORY_CONFLUENCE_CONTRACT = void 0;
exports.wrapEngineeringMemoryConfluence = wrapEngineeringMemoryConfluence;
exports.ingestConfluencePage = ingestConfluencePage;
exports.ENGINEERING_MEMORY_CONFLUENCE_CONTRACT = "engineering_memory_confluence.v1";
function wrapEngineeringMemoryConfluence(payload) {
    return {
        contract_version: exports.ENGINEERING_MEMORY_CONFLUENCE_CONTRACT,
        ...payload,
    };
}
async function ingestConfluencePage(client, project_id, page_id, title) {
    return client.request("/api/web/v1/engineering-memory/ingest/confluence", {
        method: "POST",
        body: {
            project_id,
            page_id,
            ...(title ? { title } : {}),
        },
        timeoutMs: client.longRequestTimeoutMs,
    });
}
