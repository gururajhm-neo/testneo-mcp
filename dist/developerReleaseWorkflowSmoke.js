"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const developerReleaseWorkflow_js_1 = require("./developerReleaseWorkflow.js");
const repoConfig_js_1 = require("./repoConfig.js");
function findRepoRoot(start) {
    let dir = start;
    for (let i = 0; i < 8; i++) {
        if ((0, node_fs_1.existsSync)((0, node_path_1.join)(dir, ".testneo", "config.yaml")))
            return dir;
        const parent = (0, node_path_1.dirname)(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return start;
}
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
async function run() {
    const base = {
        repository: { owner: "demo", name: "tasker" },
        pull_request: { number: 1 },
        git: { base_sha: "abc1234567890", head_sha: "def1234567890" },
    };
    const start = process.env.TESTNEO_REPO_ROOT?.trim() || process.cwd();
    const repoRoot = findRepoRoot(start);
    const merged = (0, repoConfig_js_1.mergeRepoConfigIntoWorkflowParams)({ ...base, project_id: 99 }, repoRoot);
    const parsed = developerReleaseWorkflow_js_1.DeveloperReleaseWorkflowInputSchema.parse(merged);
    assert(parsed.project_id === 99, "explicit project_id must win over repo config");
    assert(parsed.generate_engine === "langgraph" || parsed.generate_engine === "heuristic", "generate_engine must be valid enum");
    assert(typeof parsed.generate_if_unmapped === "boolean", "generate_if_unmapped boolean");
    console.log("developerReleaseWorkflowSmoke: OK");
    console.log(JSON.stringify({
        project_id: parsed.project_id,
        generate_engine: parsed.generate_engine,
        generate_if_unmapped: parsed.generate_if_unmapped,
        gate_threshold: parsed.gate_threshold,
    }));
}
run().catch((err) => {
    console.error("developerReleaseWorkflowSmoke: FAIL", err);
    process.exit(1);
});
