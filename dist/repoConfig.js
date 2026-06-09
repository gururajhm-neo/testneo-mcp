"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRepoConfigDefaults = loadRepoConfigDefaults;
exports.mergeRepoConfigIntoWorkflowParams = mergeRepoConfigIntoWorkflowParams;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
/** Parse minimal flat YAML (key: value) — no external deps. */
function parseSimpleYaml(text) {
    const out = {};
    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        const idx = trimmed.indexOf(":");
        if (idx < 1)
            continue;
        const key = trimmed.slice(0, idx).trim();
        let raw = trimmed.slice(idx + 1).trim();
        if ((raw.startsWith('"') && raw.endsWith('"')) ||
            (raw.startsWith("'") && raw.endsWith("'"))) {
            raw = raw.slice(1, -1);
        }
        if (raw === "true")
            out[key] = true;
        else if (raw === "false")
            out[key] = false;
        else if (/^-?\d+$/.test(raw))
            out[key] = parseInt(raw, 10);
        else if (/^-?\d+\.\d+$/.test(raw))
            out[key] = parseFloat(raw);
        else
            out[key] = raw;
    }
    return out;
}
function loadRawConfig(workspaceRoot) {
    const yamlPath = (0, node_path_1.join)(workspaceRoot, ".testneo", "config.yaml");
    const jsonPath = (0, node_path_1.join)(workspaceRoot, ".testneo", "config.json");
    if ((0, node_fs_1.existsSync)(jsonPath)) {
        try {
            return JSON.parse((0, node_fs_1.readFileSync)(jsonPath, "utf8"));
        }
        catch {
            return {};
        }
    }
    if ((0, node_fs_1.existsSync)(yamlPath)) {
        try {
            return parseSimpleYaml((0, node_fs_1.readFileSync)(yamlPath, "utf8"));
        }
        catch {
            return {};
        }
    }
    return {};
}
function loadRepoConfigDefaults(workspaceRoot) {
    const root = workspaceRoot?.trim() || process.cwd();
    const raw = loadRawConfig(root);
    const defaults = {};
    if (typeof raw.project_id === "number")
        defaults.project_id = raw.project_id;
    if (raw.generate_engine === "heuristic" || raw.generate_engine === "langgraph") {
        defaults.generate_engine = raw.generate_engine;
    }
    if (typeof raw.generate_if_unmapped === "boolean") {
        defaults.generate_if_unmapped = raw.generate_if_unmapped;
    }
    if (typeof raw.auto_sync_structure === "boolean") {
        defaults.auto_sync_structure = raw.auto_sync_structure;
    }
    if (typeof raw.auto_release_bundle === "boolean") {
        defaults.auto_release_bundle = raw.auto_release_bundle;
    }
    if (typeof raw.confirm === "boolean")
        defaults.confirm = raw.confirm;
    if (typeof raw.sync_jira_before_validate === "boolean") {
        defaults.sync_jira_before_validate = raw.sync_jira_before_validate;
    }
    if (raw.gate_policy === "both" ||
        raw.gate_policy === "no_block" ||
        raw.gate_policy === "min_confidence" ||
        raw.gate_policy === "warn_only") {
        defaults.gate_policy = raw.gate_policy;
    }
    if (typeof raw.gate_threshold === "number")
        defaults.gate_threshold = raw.gate_threshold;
    if (typeof raw.target_env === "string")
        defaults.target_env = raw.target_env;
    return defaults;
}
/** Tool params override repo defaults; repo defaults override schema defaults. */
function mergeRepoConfigIntoWorkflowParams(params, workspaceRoot) {
    const repo = loadRepoConfigDefaults(workspaceRoot || process.cwd());
    const merged = { ...params };
    for (const [k, v] of Object.entries(repo)) {
        if (merged[k] === undefined || merged[k] === null) {
            merged[k] = v;
        }
    }
    return merged;
}
