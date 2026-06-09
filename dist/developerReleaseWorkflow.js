"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeveloperReleaseWorkflowInputSchema = void 0;
exports.runDeveloperReleaseWorkflow = runDeveloperReleaseWorkflow;
const zod_1 = require("zod");
const index_js_1 = require("./orchestration/index.js");
const engineeringMemoryCsv_js_1 = require("./engineeringMemoryCsv.js");
const engineeringMemoryJira_js_1 = require("./engineeringMemoryJira.js");
const codeStructureSync_js_1 = require("./codeStructureSync.js");
exports.DeveloperReleaseWorkflowInputSchema = zod_1.z.object({
    project_id: zod_1.z.number().int().positive(),
    repository: zod_1.z.object({
        owner: zod_1.z.string().min(1),
        name: zod_1.z.string().min(1),
    }),
    pull_request: zod_1.z.object({
        number: zod_1.z.number().int().positive(),
        url: zod_1.z.string().url().optional(),
    }),
    git: zod_1.z.object({
        base_sha: zod_1.z.string().min(7),
        head_sha: zod_1.z.string().min(7),
        diff_content: zod_1.z.string().optional(),
        changed_files: zod_1.z
            .array(zod_1.z.object({
            path: zod_1.z.string().min(1),
            status: zod_1.z.enum(["added", "modified", "deleted", "renamed"]).default("modified"),
            additions: zod_1.z.number().int().optional(),
            deletions: zod_1.z.number().int().optional(),
            language: zod_1.z.string().optional(),
        }))
            .optional(),
    }),
    execution: zod_1.z
        .object({
        run_impacted_tests: zod_1.z.boolean().default(true),
        mode: zod_1.z.enum(["local", "cloud"]).optional(),
        platform: zod_1.z.string().optional(),
    })
        .default({}),
    confirm: zod_1.z
        .boolean()
        .default(false)
        .describe("Set true + TESTNEO_MCP_ALLOW_WRITE=true to execute impacted tests."),
    generate_if_unmapped: zod_1.z
        .boolean()
        .default(false)
        .describe("When true and diff_content is provided, auto-generate tests for uncovered changed functions before validation."),
    generate_engine: zod_1.z
        .enum(["heuristic", "langgraph"])
        .default("heuristic")
        .optional()
        .describe("Test generation engine for unmapped diff functions. langgraph uses AI (requires GROQ on API)."),
    generate_max_tests: zod_1.z.number().int().min(1).max(20).default(5).optional(),
    auto_sync_structure: zod_1.z
        .boolean()
        .default(false)
        .describe("When true, upload code structure from workspace_root before validate (requires confirm + write)."),
    workspace_root: zod_1.z
        .string()
        .min(1)
        .optional()
        .describe("Repo root for auto_sync_structure (defaults to process.cwd())."),
    include_paths: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    auto_release_bundle: zod_1.z
        .boolean()
        .default(false)
        .describe("When true, create a Release Bundle and evaluate the release gate after validation."),
    release_name: zod_1.z
        .string()
        .max(100)
        .optional()
        .describe("Release bundle name (required when auto_release_bundle=true)."),
    target_env: zod_1.z.string().max(50).default("production").optional(),
    gate_policy: zod_1.z.enum(["both", "no_block", "min_confidence", "warn_only"]).default("both").optional(),
    gate_threshold: zod_1.z.number().int().min(50).max(100).default(85).optional(),
    engineering_memory_csv_path: zod_1.z.string().min(1).optional(),
    engineering_memory_csv_base64: zod_1.z.string().min(1).optional(),
    engineering_memory_csv_filename: zod_1.z.string().min(1).max(512).optional(),
    sync_jira_before_validate: zod_1.z.boolean().default(true).optional(),
    jira_sync_max_issues: zod_1.z.number().int().min(1).max(200).default(50).optional(),
    jira_sync_lookback_days: zod_1.z.number().int().min(1).max(365).default(90).optional(),
    idempotency_key: zod_1.z.string().min(8).max(128).optional(),
});
const SIGNAL_EMOJI = {
    block: "🔴",
    review: "🟡",
    clean: "🟢",
    BLOCK: "🔴",
    WARN: "🟡",
    PASS: "🟢",
    GATE_PASS: "🟢",
    GATE_BLOCK: "🔴",
    GATE_WARN: "🟡",
};
function riskLevelLabel(level) {
    if (level === "BLOCK")
        return "BLOCK";
    if (level === "WARN")
        return "WARN";
    return "PASS";
}
async function maybeGenerateTestsForDiff(client, params) {
    if (!params.generate_if_unmapped) {
        return { generated_count: 0, test_case_ids: [], skipped: true, skip_reason: "generate_if_unmapped=false" };
    }
    const diff = params.git.diff_content?.trim();
    if (!diff) {
        return {
            generated_count: 0,
            test_case_ids: [],
            skipped: true,
            skip_reason: "No git.diff_content — provide diff or disable generate_if_unmapped.",
        };
    }
    const resp = await client.request("/api/web/v1/code-impact/generate-tests-for-diff", {
        method: "POST",
        query: { project_id: params.project_id },
        body: {
            diff_content: diff,
            max_tests: params.generate_max_tests ?? 5,
        },
        timeoutMs: client.longRequestTimeoutMs,
    });
    const ids = Array.isArray(resp.test_case_ids)
        ? resp.test_case_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
        : [];
    return {
        generated_count: typeof resp.generated_count === "number" ? resp.generated_count : ids.length,
        test_case_ids: ids,
        message: typeof resp.message === "string" ? resp.message : undefined,
    };
}
async function maybeCreateBundleAndGate(client, params, workflowId) {
    if (!params.auto_release_bundle)
        return {};
    const releaseName = params.release_name?.trim() ||
        `PR-${params.pull_request.number}-${params.git.head_sha.slice(0, 7)}`;
    const bundleResp = await client.request("/api/web/v1/release-readiness/bundle", {
        method: "POST",
        body: {
            project_id: params.project_id,
            release_name: releaseName,
            workflow_ids: [workflowId],
            target_env: params.target_env ?? "production",
            gate_policy: params.gate_policy ?? "both",
            gate_threshold: params.gate_threshold ?? 85,
        },
        timeoutMs: client.longRequestTimeoutMs,
    });
    const bundleId = String(bundleResp.bundle_id ?? "");
    const bundle = {
        bundle_id: bundleId,
        release_confidence: Number(bundleResp.release_confidence ?? 0),
        recommendation: String(bundleResp.recommendation ?? "NO DATA"),
        block_count: Number(bundleResp.summary?.block_count ?? 0),
        warn_count: Number(bundleResp.summary?.warn_count ?? 0),
    };
    let gate;
    if (bundleId) {
        const gateResp = await client.request("/api/web/v1/release-readiness/gate", {
            method: "POST",
            body: {
                bundle_id: bundleId,
                policy: params.gate_policy ?? "both",
                min_confidence: params.gate_threshold ?? 85,
            },
            timeoutMs: client.longRequestTimeoutMs,
        });
        gate = {
            gate_status: String(gateResp.gate_status ?? "UNKNOWN"),
            reason: String(gateResp.reason ?? ""),
            release_confidence: Number(gateResp.release_confidence ?? bundle.release_confidence),
        };
    }
    return { bundle, gate };
}
function formatExecutionRouteLabel(routing) {
    if (routing.resolved_mode === "cloud") {
        return `☁️ cloud · ${routing.resolved_platform}`;
    }
    if (routing.use_local_agent) {
        return "🖥️ local · TestNeo self-hosted agent";
    }
    return "🖥️ local · platform runner";
}
function appendExecutionRoutingBrief(lines, routing, validation, generateSummary) {
    const ran = validation.metadata.execution_mode === "executed";
    lines.push("## 🧪 NLP tests — generate & execute");
    lines.push("");
    if (generateSummary.skipped) {
        lines.push(`**Generate:** skipped — ${generateSummary.skip_reason ?? "generate_if_unmapped=false"}`);
    }
    else if (generateSummary.generated_count > 0) {
        lines.push(`**Generate:** created **${generateSummary.generated_count}** NLP test(s) · IDs: ${generateSummary.test_case_ids.join(", ")}`);
        lines.push("_Source: `POST /code-impact/generate-tests-for-diff` → `web_test_cases.nlp_commands`_");
    }
    else {
        lines.push(`**Generate:** ${generateSummary.message ?? "no new tests needed (mappings exist)"}`);
    }
    lines.push(`**Impacted tests:** ${validation.impact_summary.impacted_tests}`);
    lines.push(`**Execution route:** ${formatExecutionRouteLabel(routing)}`);
    lines.push(`**Run status:** ${ran ? "✅ executed" : "📋 planned_only"} ` +
        `(confirm=${routing.confirm_requested}, writes=${routing.write_tools_enabled})`);
    if (!ran && routing.confirm_requested && !routing.write_tools_enabled) {
        lines.push("_Set `TESTNEO_MCP_ALLOW_WRITE=true` to execute tests._");
    }
    else if (!ran && !routing.confirm_requested) {
        lines.push("_Re-run with `confirm: true` to execute impacted NLP tests._");
    }
    lines.push("");
}
function appendValidationBrief(lines, validation, prRef) {
    const { workflow_id, ai_ready_summary, findings, claude_analysis } = validation;
    const riskScore = ai_ready_summary.risk_score;
    const riskLevel = ai_ready_summary.risk_level;
    const mergeSignal = ai_ready_summary.merge_signal;
    const headerEmoji = SIGNAL_EMOJI[mergeSignal] ?? "⬜";
    lines.push(`## ${headerEmoji} PR Validation — ${riskLevelLabel(riskLevel)} (${riskScore}/100)`);
    lines.push(`**${prRef}** · workflow \`${workflow_id}\``);
    lines.push("");
    lines.push(`Findings: ${ai_ready_summary.blocking_count} blocking · ` +
        `${ai_ready_summary.warning_count} warnings · ${ai_ready_summary.passed_count} passed`);
    lines.push("");
    const blocking = findings.filter((f) => f.blocking);
    if (blocking.length > 0) {
        lines.push("### Blocking");
        for (let i = 0; i < Math.min(blocking.length, 5); i++) {
            const f = blocking[i];
            lines.push(`${i + 1}. **${f.title}** — \`${f.flow}\``);
            if (f.suggestedFixes[0])
                lines.push(`   → ${f.suggestedFixes[0]}`);
        }
        lines.push("");
    }
    const rec = claude_analysis?.mergeRecommendation ?? "hold";
    const recLabel = {
        merge: "Safe to merge",
        merge_with_followup: "Merge with follow-up",
        hold: "Hold — run validation before merging",
        request_changes: "Request changes",
    };
    lines.push(`**Recommendation:** ${recLabel[rec] ?? rec}`);
    lines.push("");
}
async function runDeveloperReleaseWorkflow(params, deps) {
    const { client, store, impactAnalyzer, testExecutor, incidentContextAdapter, allowWriteTools, executionRouting, asText, result, } = deps;
    const prRef = `${params.repository.owner}/${params.repository.name} #${params.pull_request.number}`;
    const lines = [
        "# 🚀 TestNeo Developer Release Workflow",
        `**${prRef}** · IDE-agnostic MCP orchestration`,
        "",
    ];
    // Step 0a: Jira sync
    if (params.sync_jira_before_validate !== false) {
        try {
            const jiraIngest = await (0, engineeringMemoryJira_js_1.syncJiraEngineeringMemory)(client, params.project_id, {
                max_issues: params.jira_sync_max_issues ?? 50,
                lookback_days: params.jira_sync_lookback_days ?? 90,
            });
            const j = (0, engineeringMemoryJira_js_1.wrapEngineeringMemoryJira)({
                success: true,
                synced: true,
                created: jiraIngest.created ?? 0,
                updated: jiraIngest.updated ?? 0,
                skipped_rows: jiraIngest.skipped ?? 0,
            });
            if (j.synced) {
                lines.push("## 📥 Engineering Memory (Jira synced)");
                lines.push(`Created ${j.created ?? 0} · updated ${j.updated ?? 0} entries.`);
                lines.push("");
            }
        }
        catch (jiraErr) {
            const msg = jiraErr instanceof Error ? jiraErr.message : String(jiraErr);
            lines.push("## 📥 Engineering Memory (Jira sync skipped)");
            lines.push(`_${msg.slice(0, 160)}_`);
            lines.push("");
        }
    }
    // Step 0b: CSV ingest
    const memPath = params.engineering_memory_csv_path?.trim();
    const memB64 = params.engineering_memory_csv_base64?.trim();
    const memFn = params.engineering_memory_csv_filename?.trim();
    if (memPath || memB64) {
        if (memB64 && !memFn) {
            return result(asText({
                contract_version: "developer_release_workflow.v1",
                success: false,
                error: "engineering_memory_csv_filename required with engineering_memory_csv_base64.",
            }));
        }
        const csvPayload = memPath
            ? await (0, engineeringMemoryCsv_js_1.resolveBugCsvSource)({ kind: "path", csv_path: memPath })
            : await (0, engineeringMemoryCsv_js_1.resolveBugCsvSource)({
                kind: "base64",
                csv_file_base64: memB64,
                csv_filename: memFn,
            });
        if (!csvPayload.ok) {
            return result(asText({
                contract_version: "developer_release_workflow.v1",
                success: false,
                error: `Engineering Memory CSV ingest failed: ${csvPayload.error}`,
            }));
        }
        const ingest = await (0, engineeringMemoryCsv_js_1.ingestEngineeringMemoryCsv)(client, params.project_id, csvPayload.blob, csvPayload.filename);
        const csv = (0, engineeringMemoryCsv_js_1.wrapEngineeringMemoryCsv)({
            success: true,
            filename: csvPayload.filename,
            csv_sha256: csvPayload.sha256,
            created: ingest.created ?? 0,
            updated: ingest.updated ?? 0,
            skipped: ingest.skipped ?? 0,
        });
        lines.push("## 📥 Engineering Memory (CSV ingested)");
        lines.push(`File \`${csv.filename}\` — created ${csv.created ?? 0}, updated ${csv.updated ?? 0}.`);
        lines.push("");
    }
    // Step 0c: Optional code structure sync
    if (params.auto_sync_structure) {
        const syncRoot = params.workspace_root?.trim() || process.cwd();
        try {
            const syncResult = await (0, codeStructureSync_js_1.syncCodeStructure)({
                project_id: params.project_id,
                workspace_root: syncRoot,
                include_paths: params.include_paths,
                confirm: params.confirm,
                auto_detect: true,
                max_size_mb: 50,
                wait_timeout_seconds: 120,
            }, { client, allowWriteTools, asText, result });
            const syncText = syncResult.content?.[0]?.text ?? "";
            let syncJson = {};
            try {
                syncJson = JSON.parse(syncText);
            }
            catch {
                /* markdown fallback */
            }
            if (syncJson.success) {
                lines.push("## 📂 Code structure synced");
                lines.push(`Structure ID **${syncJson.structure_id}** · task \`${syncJson.task_id}\``);
                lines.push("");
            }
            else if (!syncJson.dry_run) {
                lines.push("## 📂 Code structure sync (failed — continuing)");
                lines.push(`_${String(syncJson.error ?? syncText).slice(0, 200)}_`);
                lines.push("");
            }
        }
        catch (syncErr) {
            const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
            lines.push("## 📂 Code structure sync (failed — continuing)");
            lines.push(`_${msg.slice(0, 200)}_`);
            lines.push("");
        }
    }
    // Step 1: Optional generate for unmapped functions
    let generateSummary = { generated_count: 0, test_case_ids: [] };
    try {
        generateSummary = await maybeGenerateTestsForDiff(client, params);
        if (generateSummary.skipped) {
            lines.push("## 🧪 Test generation");
            lines.push(`Skipped — ${generateSummary.skip_reason}`);
            lines.push("");
        }
        else if (generateSummary.generated_count > 0) {
            lines.push("## 🧪 Test generation");
            lines.push(`Created **${generateSummary.generated_count}** test(s) for uncovered changed functions.`);
            lines.push(`Test IDs: ${generateSummary.test_case_ids.join(", ")}`);
            lines.push("");
        }
        else {
            lines.push("## 🧪 Test generation");
            lines.push(generateSummary.message ?? "No new tests needed — mappings exist.");
            lines.push("");
        }
    }
    catch (genErr) {
        const msg = genErr instanceof Error ? genErr.message : String(genErr);
        lines.push("## 🧪 Test generation (failed — continuing validation)");
        lines.push(`_${msg.slice(0, 200)}_`);
        lines.push("");
    }
    // Step 2: Full PR validation orchestration
    const orchestrator = new index_js_1.PrValidationOrchestrator({
        store,
        impactAnalyzer,
        claudeAnalyzer: new index_js_1.DataDrivenClaudeAnalyzer(),
        incidentContextAdapter,
        testExecutor,
        enableTestExecution: allowWriteTools,
    });
    const validation = await orchestrator.validatePr({
        project_id: params.project_id,
        repository: params.repository,
        pull_request: params.pull_request,
        git: params.git,
        execution: {
            run_impacted_tests: params.execution.run_impacted_tests,
            run_visual_regression: false,
            run_lighthouse: false,
            capture_replay: false,
            max_parallelism: 4,
            mode: params.execution.mode,
            platform: params.execution.platform,
        },
        output: { include_comment_draft: true, publish_comment: false },
        confirm: params.confirm,
        idempotency_key: params.idempotency_key,
    });
    appendExecutionRoutingBrief(lines, executionRouting, validation, generateSummary);
    appendValidationBrief(lines, validation, prRef);
    // Step 3: Optional bundle + gate
    let bundleSummary;
    let gateSummary;
    if (params.auto_release_bundle) {
        try {
            const { bundle, gate } = await maybeCreateBundleAndGate(client, params, validation.workflow_id);
            bundleSummary = bundle;
            gateSummary = gate;
            if (bundle) {
                const confEmoji = bundle.release_confidence >= 85 ? "🟢" : bundle.release_confidence >= 70 ? "🟡" : "🔴";
                lines.push("## 📦 Release Bundle");
                lines.push(`**${params.release_name ?? "auto"}** · ${confEmoji} ${bundle.release_confidence}/100 · ${bundle.recommendation}`);
                lines.push(`Bundle ID: \`${bundle.bundle_id}\``);
                lines.push(`BLOCK/WARN: ${bundle.block_count} / ${bundle.warn_count}`);
                lines.push("");
            }
            if (gate) {
                const gateEmoji = SIGNAL_EMOJI[gate.gate_status] ?? "⬜";
                lines.push(`## 🚦 Release Gate — ${gateEmoji} ${gate.gate_status}`);
                lines.push(gate.reason);
                lines.push("");
            }
        }
        catch (bundleErr) {
            const msg = bundleErr instanceof Error ? bundleErr.message : String(bundleErr);
            lines.push("## 📦 Release Bundle (failed)");
            lines.push(`_${msg.slice(0, 200)}_`);
            lines.push("");
        }
    }
    lines.push("---");
    lines.push("## ⚡ Next Actions");
    lines.push(`- Full board: \`testneo_get_pr_validation_detail\` workflow_id \`${validation.workflow_id}\``);
    lines.push(`- Deep-dive: \`testneo_explain_failure\` / \`testneo_suggest_fix\``);
    if (!params.confirm) {
        lines.push("- Re-run with `confirm: true` to execute impacted tests (requires TESTNEO_MCP_ALLOW_WRITE=true).");
    }
    if (params.auto_release_bundle && bundleSummary?.bundle_id) {
        lines.push(`- Release brief: \`testneo_generate_release_brief\` bundle_id \`${bundleSummary.bundle_id}\``);
    }
    lines.push("");
    lines.push(`_contract: developer_release_workflow.v1 · workflow \`${validation.workflow_id}\`_`);
    const structured = {
        contract_version: "developer_release_workflow.v1",
        success: true,
        workflow_id: validation.workflow_id,
        risk_score: validation.ai_ready_summary.risk_score,
        risk_level: validation.ai_ready_summary.risk_level,
        merge_signal: validation.ai_ready_summary.merge_signal,
        generate: generateSummary,
        execution: {
            ...executionRouting,
            run_status: validation.metadata.execution_mode,
            tests_ran: validation.metadata.execution_mode === "executed",
            impacted_tests: validation.impact_summary.impacted_tests,
            route_label: formatExecutionRouteLabel(executionRouting),
        },
        bundle: bundleSummary,
        gate: gateSummary,
        pr_ref: prRef,
    };
    return result(`${lines.join("\n")}\n\n${asText(structured)}`);
}
