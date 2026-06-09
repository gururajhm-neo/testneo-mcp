"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateTestsFromCodeInputSchema = exports.CODE_GENERATE_CONTRACT = void 0;
exports.wrapCodeGenerate = wrapCodeGenerate;
exports.generateTestsFromCode = generateTestsFromCode;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const zod_1 = require("zod");
exports.CODE_GENERATE_CONTRACT = "code_generate.v1";
exports.GenerateTestsFromCodeInputSchema = zod_1.z.object({
    project_id: zod_1.z.number().int().positive(),
    scope: zod_1.z
        .enum(["function", "file", "folder", "codebase"])
        .default("function")
        .describe("VS Code parity: one function, whole file, folder prefix, or codebase (capped)."),
    file_path: zod_1.z.string().min(1).optional(),
    function_name: zod_1.z.string().min(1).optional(),
    folder_path: zod_1.z.string().min(1).optional(),
    workspace_root: zod_1.z
        .string()
        .min(1)
        .optional()
        .describe("Repo root to read function bodies from disk (recommended for LangGraph quality)."),
    include_function_bodies: zod_1.z.boolean().default(true),
    only_unmapped: zod_1.z.boolean().default(true),
    max_tests: zod_1.z.number().int().min(1).max(50).default(5),
    generate_engine: zod_1.z.enum(["heuristic", "langgraph"]).default("heuristic"),
    list_only: zod_1.z
        .boolean()
        .default(false)
        .describe("When true, only list matching functions (dry discovery) — no test creation."),
    confirm: zod_1.z
        .boolean()
        .default(false)
        .describe("Set true + TESTNEO_MCP_ALLOW_WRITE=true to create tests."),
});
function wrapCodeGenerate(payload) {
    return { contract_version: exports.CODE_GENERATE_CONTRACT, ...payload };
}
async function readFunctionBody(workspaceRoot, filePath, lineStart, lineEnd) {
    try {
        const abs = (0, node_path_1.resolve)(workspaceRoot, filePath);
        const content = await (0, promises_1.readFile)(abs, "utf8");
        const lines = content.split(/\r?\n/);
        if (lineStart && lineEnd && lineStart > 0) {
            const slice = lines.slice(lineStart - 1, lineEnd);
            return slice.join("\n").trim() || undefined;
        }
        if (content.length <= 12000) {
            return content.trim();
        }
        return content.slice(0, 12000);
    }
    catch {
        return undefined;
    }
}
async function fetchStructureFunctions(client, params) {
    const query = {
        project_id: params.project_id,
        only_unmapped: params.only_unmapped,
        limit: Math.max(params.max_tests, 50),
    };
    if (params.file_path)
        query.file_path = params.file_path;
    if (params.folder_path)
        query.folder_path = params.folder_path;
    if (params.function_name)
        query.function_name = params.function_name;
    const resp = await client.request("/api/web/v1/code-impact/structure/functions", { query, timeoutMs: client.longRequestTimeoutMs });
    return Array.isArray(resp.functions) ? resp.functions : [];
}
async function buildSources(client, params) {
    if (!params.include_function_bodies || !params.workspace_root?.trim()) {
        return [];
    }
    const root = (0, node_path_1.resolve)(process.cwd(), params.workspace_root.trim());
    const functions = await fetchStructureFunctions(client, params);
    const take = functions.slice(0, params.max_tests);
    const sources = [];
    for (const fn of take) {
        const body = await readFunctionBody(root, fn.file_path, fn.line_start, fn.line_end);
        const entry = {
            file_path: fn.file_path,
            function_name: fn.function_name,
        };
        if (fn.signature)
            entry.signature = fn.signature;
        if (fn.docstring)
            entry.docstring = fn.docstring;
        if (fn.language)
            entry.language = fn.language;
        if (body)
            entry.function_body = body;
        sources.push(entry);
    }
    return sources;
}
async function generateTestsFromCode(params, deps) {
    const { client, allowWriteTools, asText, result } = deps;
    if (params.list_only) {
        const functions = await fetchStructureFunctions(client, params);
        return result(asText(wrapCodeGenerate({
            success: true,
            list_only: true,
            scope: params.scope,
            total: functions.length,
            functions: functions.slice(0, params.max_tests),
            message: "Discovery only — set confirm=true to generate tests.",
        })));
    }
    if (!params.confirm) {
        const functions = await fetchStructureFunctions(client, params);
        return result(asText(wrapCodeGenerate({
            success: false,
            dry_run: true,
            scope: params.scope,
            matching_functions: functions.length,
            preview: functions.slice(0, Math.min(10, params.max_tests)),
            message: "Planning only. Set confirm=true and TESTNEO_MCP_ALLOW_WRITE=true to generate NLP tests.",
        })));
    }
    if (!allowWriteTools) {
        return result(asText(wrapCodeGenerate({
            success: false,
            error: "Write tools disabled. Set TESTNEO_MCP_ALLOW_WRITE=true and restart MCP.",
        })));
    }
    const scope = params.scope;
    if (scope === "function" && !(params.file_path && params.function_name)) {
        return result(asText(wrapCodeGenerate({
            success: false,
            error: "scope=function requires file_path and function_name.",
        })));
    }
    if (scope === "file" && !params.file_path) {
        return result(asText(wrapCodeGenerate({
            success: false,
            error: "scope=file requires file_path.",
        })));
    }
    if (scope === "folder" && !params.folder_path) {
        return result(asText(wrapCodeGenerate({
            success: false,
            error: "scope=folder requires folder_path.",
        })));
    }
    const sources = await buildSources(client, params);
    const resp = await client.request("/api/web/v1/code-impact/generate-tests-from-code", {
        method: "POST",
        query: { project_id: params.project_id },
        body: {
            scope: params.scope,
            file_path: params.file_path,
            function_name: params.function_name,
            folder_path: params.folder_path,
            sources: sources.length ? sources : undefined,
            only_unmapped: params.only_unmapped,
            max_tests: params.max_tests,
            generate_engine: params.generate_engine,
        },
        timeoutMs: client.longRequestTimeoutMs,
    });
    return result(asText(wrapCodeGenerate({
        ...resp,
        next_steps: [
            "Run tests: testneo_run_generated_test_pipeline with test_case_id from tests[].",
            "Validate PR: testneo_developer_release_workflow.",
        ],
    })));
}
