"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeStructureSyncInputSchema = exports.DEFAULT_MAX_ZIP_MB = exports.CODE_STRUCTURE_SYNC_CONTRACT = void 0;
exports.wrapCodeStructureSync = wrapCodeStructureSync;
exports.syncCodeStructure = syncCodeStructure;
exports.projectHasCodeStructure = projectHasCodeStructure;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const zod_1 = require("zod");
const swaggerIntel_js_1 = require("./swaggerIntel.js");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
exports.CODE_STRUCTURE_SYNC_CONTRACT = "code_structure_sync.v1";
/** Keep MCP uploads conservative; API allows up to 200MB. */
exports.DEFAULT_MAX_ZIP_MB = 50;
const DEFAULT_EXCLUDE_GLOBS = [
    "**/node_modules/**",
    "**/.git/**",
    "**/__pycache__/**",
    "**/.venv/**",
    "**/dist/**",
    "**/coverage/**",
    "**/.next/**",
    "**/target/**",
];
exports.CodeStructureSyncInputSchema = zod_1.z.object({
    project_id: zod_1.z.number().int().positive(),
    workspace_root: zod_1.z
        .string()
        .min(1)
        .optional()
        .describe("Absolute or cwd-relative repo root to zip and upload."),
    include_paths: zod_1.z
        .array(zod_1.z.string().min(1))
        .optional()
        .describe('Paths relative to workspace_root (default: ["."]).'),
    zip_base64: zod_1.z
        .string()
        .min(1)
        .optional()
        .describe("Pre-built ZIP as base64 (skip workspace zip)."),
    zip_filename: zod_1.z.string().min(1).max(255).optional(),
    auto_detect: zod_1.z.boolean().default(true),
    folders: zod_1.z.string().optional().describe("Comma-separated folders when auto_detect=false."),
    max_size_mb: zod_1.z.number().int().min(1).max(200).default(exports.DEFAULT_MAX_ZIP_MB),
    wait_timeout_seconds: zod_1.z.number().int().min(10).max(600).default(120),
    confirm: zod_1.z
        .boolean()
        .default(false)
        .describe("Set true + TESTNEO_MCP_ALLOW_WRITE=true to upload structure."),
});
function wrapCodeStructureSync(payload) {
    return { contract_version: exports.CODE_STRUCTURE_SYNC_CONTRACT, ...payload };
}
async function zipWorkspace(workspaceRoot, includePaths, excludeGlobs) {
    const root = (0, node_path_1.resolve)(workspaceRoot);
    const tmp = await (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "testneo-structure-"));
    const zipPath = (0, node_path_1.join)(tmp, "codebase.zip");
    const excludes = excludeGlobs.flatMap((g) => {
        const pattern = g.replace(/^\*\*\//, "").replace(/\/\*\*$/, "");
        return ["-x", `*${pattern}*`];
    });
    const args = ["-r", zipPath, ...includePaths, ...excludes];
    try {
        await execFileAsync("zip", args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
        const st = await (0, promises_1.stat)(zipPath);
        const sizeMb = st.size / (1024 * 1024);
        return { ok: true, zipPath, sizeMb };
    }
    catch (e) {
        await (0, promises_1.rm)(tmp, { recursive: true, force: true }).catch(() => undefined);
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("ENOENT") || msg.includes("not found")) {
            return {
                ok: false,
                error: "zip CLI not found. Install zip (macOS/Linux) or pass zip_base64 instead of workspace_root.",
            };
        }
        return { ok: false, error: `Failed to create ZIP: ${msg}` };
    }
}
async function pollUploadStatus(client, taskId, timeoutMs) {
    const started = Date.now();
    const pollMs = 2000;
    let last = { task_id: taskId, status: "processing", progress: 0 };
    while (Date.now() - started < timeoutMs) {
        last = await client.request(`/api/web/v1/code-impact/upload-status/${taskId}`, {
            timeoutMs: client.longRequestTimeoutMs,
        });
        const terminal = ["completed", "failed", "error"].includes(last.status);
        if (terminal)
            return last;
        await new Promise((r) => setTimeout(r, pollMs));
    }
    return {
        ...last,
        status: "timeout",
        error: `Upload did not complete within ${Math.round(timeoutMs / 1000)}s`,
    };
}
async function syncCodeStructure(params, deps) {
    const { client, allowWriteTools, asText, result } = deps;
    if (!params.confirm) {
        return result(asText(wrapCodeStructureSync({
            success: false,
            dry_run: true,
            message: "Planning only. Set confirm=true and TESTNEO_MCP_ALLOW_WRITE=true to upload code structure.",
            project_id: params.project_id,
        })));
    }
    if (!allowWriteTools) {
        return result(asText(wrapCodeStructureSync({
            success: false,
            error: "Write tools disabled. Set TESTNEO_MCP_ALLOW_WRITE=true and restart MCP.",
        })));
    }
    let zipBuf;
    let zipName;
    let tempDir;
    if (params.zip_base64?.trim()) {
        const dec = (0, swaggerIntel_js_1.decodeSwaggerUploadBase64)(params.zip_base64.trim());
        if (!dec.ok) {
            return result(asText(wrapCodeStructureSync({ success: false, error: dec.error })));
        }
        zipBuf = dec.buf;
        zipName = params.zip_filename?.trim() || "codebase.zip";
    }
    else if (params.workspace_root?.trim()) {
        const root = (0, node_path_1.resolve)(process.cwd(), params.workspace_root.trim());
        const includes = params.include_paths?.length ? params.include_paths : ["."];
        const zipped = await zipWorkspace(root, includes, DEFAULT_EXCLUDE_GLOBS);
        if (!zipped.ok) {
            return result(asText(wrapCodeStructureSync({ success: false, error: zipped.error })));
        }
        if (zipped.sizeMb > params.max_size_mb) {
            tempDir = (0, node_path_1.join)(zipped.zipPath, "..");
            await (0, promises_1.rm)(tempDir, { recursive: true, force: true }).catch(() => undefined);
            return result(asText(wrapCodeStructureSync({
                success: false,
                error: `ZIP size ${zipped.sizeMb.toFixed(1)}MB exceeds max_size_mb=${params.max_size_mb}`,
            })));
        }
        tempDir = (0, node_path_1.join)(zipped.zipPath, "..");
        zipBuf = await (0, promises_1.readFile)(zipped.zipPath);
        zipName = `${(0, node_path_1.basename)(root) || "codebase"}.zip`;
    }
    else {
        return result(asText(wrapCodeStructureSync({
            success: false,
            error: "Provide workspace_root or zip_base64.",
        })));
    }
    const sizeMb = zipBuf.length / (1024 * 1024);
    if (sizeMb > params.max_size_mb) {
        return result(asText(wrapCodeStructureSync({
            success: false,
            error: `ZIP size ${sizeMb.toFixed(1)}MB exceeds max_size_mb=${params.max_size_mb}`,
        })));
    }
    try {
        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(zipBuf)]), zipName.endsWith(".zip") ? zipName : `${zipName}.zip`);
        const query = {
            project_id: params.project_id,
            auto_detect: params.auto_detect,
            max_size_mb: params.max_size_mb,
        };
        if (params.folders?.trim()) {
            query.folders = params.folders.trim();
        }
        const qs = Object.entries(query)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
            .join("&");
        const uploadResp = await client.requestMultipart(`/api/web/v1/code-impact/upload-zip-async?${qs}`, form, client.longRequestTimeoutMs);
        const taskId = uploadResp.task_id;
        if (!taskId) {
            return result(asText(wrapCodeStructureSync({
                success: false,
                error: uploadResp.message || "Upload did not return task_id",
            })));
        }
        const finalStatus = await pollUploadStatus(client, taskId, params.wait_timeout_seconds * 1000);
        if (finalStatus.status !== "completed") {
            return result(asText(wrapCodeStructureSync({
                success: false,
                task_id: taskId,
                status: finalStatus.status,
                error: finalStatus.error || finalStatus.message || "Upload failed",
                progress: finalStatus.progress,
            })));
        }
        const uploadResult = finalStatus.result ?? {};
        return result(asText(wrapCodeStructureSync({
            success: true,
            task_id: taskId,
            structure_id: uploadResult.structure_id,
            mapping_stats: uploadResult.mapping_stats,
            file_count: uploadResult.file_count,
            function_count: uploadResult.function_count,
            message: finalStatus.message || "Code structure synced.",
        })));
    }
    finally {
        if (tempDir) {
            await (0, promises_1.rm)(tempDir, { recursive: true, force: true }).catch(() => undefined);
        }
    }
}
/** Preflight: returns false when analyze would fail due to missing structure. */
async function projectHasCodeStructure(client, projectId) {
    try {
        const resp = await client.request("/api/web/v1/code-impact/analyze/manual", {
            method: "POST",
            query: { project_id: projectId },
            body: {
                changed_files: [{ path: "__testneo_preflight__.ts", status: "modified" }],
                diff_content: "",
            },
            timeoutMs: 15000,
        });
        const err = String(resp.error ?? resp.detail ?? "");
        if (err.toLowerCase().includes("no code structure") || err.toLowerCase().includes("structure")) {
            return false;
        }
        return resp.success !== false;
    }
    catch {
        return true;
    }
}
