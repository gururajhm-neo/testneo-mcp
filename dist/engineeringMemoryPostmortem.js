"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_POSTMORTEM_BYTES = exports.ENGINEERING_MEMORY_POSTMORTEM_CONTRACT = void 0;
exports.wrapEngineeringMemoryPostmortem = wrapEngineeringMemoryPostmortem;
exports.readPostmortemFromPath = readPostmortemFromPath;
exports.ingestPostmortem = ingestPostmortem;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
exports.ENGINEERING_MEMORY_POSTMORTEM_CONTRACT = "engineering_memory_postmortem.v1";
exports.MAX_POSTMORTEM_BYTES = 512 * 1024;
function wrapEngineeringMemoryPostmortem(payload) {
    return {
        contract_version: exports.ENGINEERING_MEMORY_POSTMORTEM_CONTRACT,
        ...payload,
    };
}
async function readPostmortemFromPath(md_path) {
    try {
        const trimmed = md_path.trim();
        if (!trimmed) {
            return { ok: false, error: "md_path is empty" };
        }
        const resolved = (0, node_path_1.resolve)(process.cwd(), trimmed);
        const cwd = (0, node_path_1.resolve)(process.cwd());
        if (!resolved.startsWith(cwd)) {
            return { ok: false, error: "md_path must stay within the workspace directory" };
        }
        const name = (0, node_path_1.basename)(resolved).toLowerCase();
        if (!name.endsWith(".md") && !name.endsWith(".markdown") && !name.endsWith(".txt")) {
            return { ok: false, error: "md_path must end with .md, .markdown, or .txt" };
        }
        const buf = await (0, promises_1.readFile)(resolved);
        if (!buf.length) {
            return { ok: false, error: "Postmortem file is empty" };
        }
        if (buf.length > exports.MAX_POSTMORTEM_BYTES) {
            return {
                ok: false,
                error: `Postmortem exceeds ${exports.MAX_POSTMORTEM_BYTES} bytes (${buf.length} bytes)`,
            };
        }
        const body = buf.toString("utf-8");
        const titleMatch = body.match(/^#\s+(.+)$/m);
        const title = titleMatch?.[1]?.trim() || (0, node_path_1.basename)(resolved, ".md");
        return { ok: true, title: title.slice(0, 512), body, filename: (0, node_path_1.basename)(resolved) };
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}
async function ingestPostmortem(client, project_id, title, body, external_id) {
    return client.request("/api/web/v1/engineering-memory/ingest/postmortem", {
        method: "POST",
        body: {
            project_id,
            title,
            body,
            ...(external_id ? { external_id } : {}),
        },
        timeoutMs: client.longRequestTimeoutMs,
    });
}
