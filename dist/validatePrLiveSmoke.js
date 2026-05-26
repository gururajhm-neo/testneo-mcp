"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const orchestrator_1 = require("@testneo/orchestrator");
const config_js_1 = require("./config.js");
const httpClient_js_1 = require("./httpClient.js");
const validatePrSmokeHarness_js_1 = require("./validatePrSmokeHarness.js");
function requireEnv(name) {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required env var ${name}`);
    }
    return value;
}
function readPositiveIntEnv(name, fallback) {
    const raw = process.env[name]?.trim();
    if (!raw)
        return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Env var ${name} must be a positive integer`);
    }
    return Math.floor(value);
}
async function resolveDiffContent() {
    const diffFile = process.env.TESTNEO_VALIDATE_PR_DIFF_FILE?.trim();
    if (diffFile) {
        return (0, promises_1.readFile)(diffFile, "utf8");
    }
    const inlineDiff = process.env.TESTNEO_VALIDATE_PR_DIFF_CONTENT?.trim();
    if (inlineDiff) {
        return inlineDiff;
    }
    return [
        "diff --git a/README.md b/README.md",
        "index 1111111..2222222 100644",
        "--- a/README.md",
        "+++ b/README.md",
        "@@ -1 +1 @@",
        "-old",
        "+new",
    ].join("\n");
}
async function run() {
    requireEnv("TESTNEO_API_KEY");
    requireEnv("TESTNEO_PROJECT_ID");
    const config = (0, config_js_1.loadConfig)(process.env);
    const client = new httpClient_js_1.HttpClient(config);
    const diffContent = await resolveDiffContent();
    const request = orchestrator_1.ValidatePrRequestSchema.parse({
        project_id: readPositiveIntEnv("TESTNEO_PROJECT_ID", 0),
        repository: {
            owner: process.env.TESTNEO_VALIDATE_PR_REPO_OWNER?.trim() || "live-smoke",
            name: process.env.TESTNEO_VALIDATE_PR_REPO_NAME?.trim() || "live-smoke-repo",
        },
        pull_request: {
            number: readPositiveIntEnv("TESTNEO_VALIDATE_PR_NUMBER", 99999),
            url: process.env.TESTNEO_VALIDATE_PR_URL?.trim() || undefined,
        },
        git: {
            base_sha: process.env.TESTNEO_VALIDATE_PR_BASE_SHA?.trim() || "abc1234",
            head_sha: process.env.TESTNEO_VALIDATE_PR_HEAD_SHA?.trim() || "def5678",
            diff_content: diffContent,
            changed_files: [
                {
                    path: process.env.TESTNEO_VALIDATE_PR_CHANGED_FILE?.trim() || "README.md",
                    status: "modified",
                },
            ],
        },
        execution: {
            run_impacted_tests: true,
            run_visual_regression: true,
            run_lighthouse: true,
            capture_replay: true,
            max_parallelism: 4,
        },
        output: {
            include_comment_draft: true,
            publish_comment: false,
        },
        idempotency_key: process.env.TESTNEO_VALIDATE_PR_IDEMPOTENCY_KEY?.trim() ||
            `live-smoke:${readPositiveIntEnv("TESTNEO_PROJECT_ID", 0)}:${Date.now()}`,
        confirm: true,
    });
    const harness = (0, validatePrSmokeHarness_js_1.createValidatePrToolHarness)({
        client,
        allowWriteTools: true,
        relaxProjectPreconditions: config.relaxProjectPreconditions,
        policyMode: config.policyMode,
        routeHardening: {
            enabled: config.routeHardeningEnabled,
            profile: config.routeProfile,
            customMap: config.routeMapCustom,
        },
        batchExecutionDefaults: {
            defaultExecutionMode: config.defaultExecutionMode,
            defaultExecutionPlatform: config.defaultExecutionPlatform,
            preferLocalAgent: config.preferLocalAgent,
            requireLocalAgentForBatch: config.requireLocalAgentForBatch,
            waitForAgentMs: config.waitForAgentMs,
            openAgentSetupOnAgentFailure: config.openAgentSetupOnAgentFailure,
        },
    });
    const response = await harness.invoke(request);
    process.stdout.write("validate_pr live smoke completed.\n");
    process.stdout.write(`${JSON.stringify({
        baseUrl: config.baseUrl,
        projectId: request.project_id,
        repository: request.repository,
        prNumber: request.pull_request.number,
        workflowId: response.workflow_id,
        status: response.status,
        impactSummary: response.impact_summary,
        mergeSignal: response.ai_ready_summary.merge_signal,
        impactSource: response.metadata.impact_source,
        findings: response.findings.length,
        plannedStages: Object.values(response.execution_summary).filter(Boolean).length,
    }, null, 2)}\n`);
}
run().catch((error) => {
    const msg = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`[testneo_validate_pr live smoke] failed: ${msg}\n`);
    process.exit(1);
});
