"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = registerTools;
const zod_1 = require("zod");
const httpClient_js_1 = require("../httpClient.js");
const apiErrorHints_js_1 = require("../apiErrorHints.js");
const projectRouteMap_js_1 = require("../projectRouteMap.js");
const routeHardening_js_1 = require("../routeHardening.js");
const unifiedContextDiscovery_js_1 = require("../unifiedContextDiscovery.js");
const failureNlpPatch_js_1 = require("../failureNlpPatch.js");
const executionContracts_js_1 = require("../executionContracts.js");
const policyEngine_js_1 = require("../policyEngine.js");
const idempotency_js_1 = require("../idempotency.js");
const toolTelemetry_js_1 = require("../toolTelemetry.js");
const swaggerIntel_js_1 = require("../swaggerIntel.js");
const routeHardeningToolSchema = zod_1.z
    .object({
    enabled: zod_1.z.boolean().optional(),
    profile: zod_1.z.enum(["none", "saucedemo"]).optional(),
    extra_map: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
})
    .optional();
function resolveRouteMap(runtime, override) {
    return (0, routeHardening_js_1.resolvePhraseToPathMap)(runtime, override);
}
function parseUnifiedContextListPayload(payload) {
    const raw = Array.isArray(payload) ? payload : [];
    const out = [];
    for (const row of raw) {
        if (!row || typeof row !== "object")
            continue;
        const r = row;
        const idVal = r.id;
        const idNum = typeof idVal === "number" ? idVal : Number(idVal);
        if (!Number.isFinite(idNum) || idNum <= 0)
            continue;
        const nameStr = typeof r.name === "string" ? r.name : String(r.name ?? "");
        if (!nameStr.trim())
            continue;
        out.push({
            id: idNum,
            name: nameStr,
            description: r.description === null || r.description === undefined ? undefined : String(r.description),
            context_type: typeof r.context_type === "string" ? r.context_type : undefined,
            entity_count: typeof r.entity_count === "number" ? r.entity_count : Number(r.entity_count) || undefined,
            relationship_count: typeof r.relationship_count === "number" ? r.relationship_count : Number(r.relationship_count) || undefined,
            ai_summary: typeof r.ai_summary === "string" ? r.ai_summary : r.ai_summary == null ? null : String(r.ai_summary),
            created_at: typeof r.created_at === "string" ? r.created_at : undefined,
            is_active: typeof r.is_active === "boolean" ? r.is_active : undefined,
        });
    }
    return out;
}
function unifiedContextsCompactLines(items, limit) {
    if (!items.length)
        return "(no unified contexts)";
    return items.slice(0, limit).map((ctx, idx) => {
        const parts = [
            `${idx + 1}.`,
            `id=${ctx.id}`,
            `${JSON.stringify(ctx.name)}`,
            ctx.context_type ?? "unified",
            `entities=${ctx.entity_count ?? "?"}`,
            `rels=${ctx.relationship_count ?? "?"}`,
            ctx.created_at ? `created=${ctx.created_at}` : "",
        ].filter(Boolean);
        return parts.join(" | ");
    }).join("\n");
}
function asText(value) {
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}
function validateSwaggerFilename(name) {
    const n = name.trim().toLowerCase();
    if (!n.endsWith(".json") && !n.endsWith(".yaml") && !n.endsWith(".yml")) {
        return "swagger_filename must end with .json, .yaml, or .yml";
    }
    return undefined;
}
function validateOpenapiFilename(name) {
    return validateSwaggerFilename(name);
}
function validateBusinessRulesFilename(name) {
    const n = name.trim();
    if (n.length < 2)
        return "business_rules_filename is too short";
    return undefined;
}
const MAX_FIGMA_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
function validateFigmaImageFilename(name) {
    const n = name.trim().toLowerCase();
    const ok = [".png", ".jpg", ".jpeg", ".gif", ".webp"].some((ext) => n.endsWith(ext));
    if (!ok)
        return "image_filename must end with .png, .jpg, .jpeg, .gif, or .webp";
    return undefined;
}
function mimeForImageFilename(name) {
    const n = name.trim().toLowerCase();
    if (n.endsWith(".png"))
        return "image/png";
    if (n.endsWith(".jpg") || n.endsWith(".jpeg"))
        return "image/jpeg";
    if (n.endsWith(".gif"))
        return "image/gif";
    if (n.endsWith(".webp"))
        return "image/webp";
    return "application/octet-stream";
}
function result(text) {
    return { content: [{ type: "text", text }] };
}
function formatTestNeoApiFailure(e) {
    if (!(e instanceof httpClient_js_1.TestNeoApiError))
        return null;
    let detail = e.body;
    try {
        detail = JSON.parse(e.body);
    }
    catch {
        /* keep raw string */
    }
    const hint = (0, apiErrorHints_js_1.summarizeTestNeoHttpError)(e.status, e.body);
    const payload = {
        error: "testneo_api_error",
        http_status: e.status,
        path: e.path,
        detail,
    };
    if (hint) {
        payload.mcp_client_summary = hint;
    }
    const jsonBlock = asText(payload);
    const text = hint
        ? `### TestNeo API blocked this action (HTTP ${e.status})\n\n${hint}\n\n---\n\n${jsonBlock}`
        : jsonBlock;
    return result(text);
}
function compactExecution(items) {
    if (!items.length)
        return "No executions found.";
    const lines = items.map((x, idx) => {
        return `${idx + 1}. ${x.execution_id} | status=${x.status ?? "unknown"} | test=${x.test_case_name ?? "n/a"} | project=${x.project_id ?? "n/a"} | created=${x.created_at ?? "n/a"}`;
    });
    return lines.join("\n");
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function normalizeStatus(value) {
    return (0, executionContracts_js_1.normalizeRawStatus)(value);
}
function isPassedStatus(value) {
    return (0, executionContracts_js_1.toCanonicalExecutionStatus)(value) === "passed";
}
function isFailedStatus(value) {
    return (0, executionContracts_js_1.toCanonicalExecutionStatus)(value) === "failed";
}
function isTerminalStatus(value) {
    return (0, executionContracts_js_1.isTerminalCanonicalStatus)((0, executionContracts_js_1.toCanonicalExecutionStatus)(value));
}
function inferFailureTheme(logLikeText) {
    const haystack = logLikeText.toLowerCase();
    if (haystack.includes("timeout") || haystack.includes("timed out")) {
        return {
            theme: "timeout_or_wait_condition",
            confidence: "high",
            nextActions: [
                "Add deterministic wait/assertion around the failing transition.",
                "Validate element readiness before action (visible, enabled, stable).",
                "Check backend/API latency for this flow."
            ],
        };
    }
    if (haystack.includes("selector") || haystack.includes("locator") || haystack.includes("not found")) {
        return {
            theme: "selector_or_dom_drift",
            confidence: "high",
            nextActions: [
                "Update selectors to stable attributes or role-based locators.",
                "Avoid brittle text-only selectors for dynamic UI.",
                "Capture DOM snapshot for the failing step."
            ],
        };
    }
    if (haystack.includes("401") || haystack.includes("403") || haystack.includes("unauthorized") || haystack.includes("forbidden")) {
        return {
            theme: "auth_or_permission",
            confidence: "high",
            nextActions: [
                "Verify API token/session validity and role permissions.",
                "Confirm test environment credentials are up-to-date.",
                "Check auth redirect/session-expiry behavior."
            ],
        };
    }
    if (haystack.includes("500") || haystack.includes("502") || haystack.includes("503") || haystack.includes("network")) {
        return {
            theme: "service_or_network_instability",
            confidence: "medium",
            nextActions: [
                "Check backend/service health around execution timestamp.",
                "Correlate with infra/network incidents.",
                "Retry once to classify transient vs deterministic failure."
            ],
        };
    }
    if (haystack.includes("expect") || haystack.includes("assert")) {
        return {
            theme: "assertion_mismatch",
            confidence: "medium",
            nextActions: [
                "Verify expected value/text and current product behavior.",
                "Inspect test data setup assumptions.",
                "Review whether assertion is too strict for current UX."
            ],
        };
    }
    return {
        theme: "unknown_needs_manual_triage",
        confidence: "low",
        nextActions: [
            "Inspect execution summary + logs + screenshots together.",
            "Classify as product bug vs test instability.",
            "Add explicit failure tagging for future clustering."
        ],
    };
}
function extractNlpCommandsFromGeneratedTest(test) {
    const possible = test.nlp_commands ??
        test.steps ??
        test.commands ??
        test.test_steps;
    if (Array.isArray(possible)) {
        return possible.map((x) => String(x)).filter((x) => x.trim().length > 0);
    }
    if (typeof possible === "string") {
        return possible
            .split("\n")
            .map((x) => x.trim())
            .filter((x) => x.length > 0);
    }
    return [];
}
function buildPlaywrightSpecTs(testName, nlpCommands) {
    const safeName = testName.replace(/[`$\\]/g, "_");
    const commands = nlpCommands.map((c) => `    ${JSON.stringify(c)},`).join("\n");
    return `import { test } from "@playwright/test";
import { createAIClient } from "@testneo/playwright-ai-sdk";

test("${safeName}", async ({ page }) => {
  const ai = createAIClient(page);
  await ai.run([
${commands}
  ], {
    mode: "balanced",
    autoPublish: { enabled: true }
  });
});
`;
}
function parseNlpFromPlaywrightSpec(specTs) {
    const runMatch = specTs.match(/ai\.run\s*\(\s*\[([\s\S]*?)\]\s*,/m);
    if (!runMatch)
        return [];
    const arrBody = runMatch[1];
    const commands = [];
    const regex = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
    let m = regex.exec(arrBody);
    while (m) {
        const raw = (m[1] ?? m[2] ?? "").replace(/\\n/g, "\n").replace(/\\"/g, "\"").replace(/\\'/g, "'");
        if (raw.trim())
            commands.push(raw.trim());
        m = regex.exec(arrBody);
    }
    return commands;
}
function buildAuthPreamble(auth) {
    if (!auth || auth.enabled === false)
        return [];
    if (auth.preset === "custom") {
        return (auth.commands || []).map((x) => String(x).trim()).filter((x) => x.length > 0);
    }
    // Default preset: SauceDemo
    return [
        "Navigate to {{base_url}}",
        "Fill Username with \"standard_user\"",
        "Fill Password with \"secret_sauce\"",
        "Click on Login",
        "Wait for 2 seconds",
    ];
}
function withAuthPreamble(nlpCommands, preamble) {
    if (!preamble.length)
        return nlpCommands;
    const existing = nlpCommands.map((x) => x.toLowerCase());
    const looksLikeHasLogin = existing.some((x) => x.includes("fill username")) &&
        existing.some((x) => x.includes("fill password")) &&
        existing.some((x) => x.includes("login"));
    if (looksLikeHasLogin)
        return nlpCommands;
    return [...preamble, ...nlpCommands];
}
async function fetchRecentExecutionsWithFallback(client, params) {
    const primary = await client.request("/api/web/v1/executions/list", {
        query: {
            project: params.project_id,
            status_filter: params.status_filter,
            release: params.release,
            build: params.build,
            limit: params.limit,
            offset: params.offset,
        },
    });
    const primaryItems = primary.executions || [];
    if (primaryItems.length > 0) {
        const normalized = primaryItems.map((x) => (0, executionContracts_js_1.normalizeExecutionItem)(x));
        return {
            executions: normalized,
            total: primary.total ?? normalized.length,
            source: "executions_list",
        };
    }
    const analytics = await client.request("/api/web/v1/analytics/executions", {
        query: {
            project: params.project_id,
            release: params.release,
            build: params.build,
            range: params.range ?? "30d",
        },
    });
    let items = (analytics.executions || []).map((x) => (0, executionContracts_js_1.normalizeExecutionItem)(x));
    if (params.status_filter) {
        const wanted = normalizeStatus(params.status_filter);
        if (wanted === "failed" || wanted === "error") {
            items = items.filter((x) => isFailedStatus(x.status));
        }
        else if (wanted === "passed" || wanted === "success" || wanted === "completed") {
            items = items.filter((x) => isPassedStatus(x.status));
        }
        else {
            items = items.filter((x) => normalizeStatus(x.status) === wanted);
        }
    }
    const total = items.length;
    const paged = items.slice(params.offset, params.offset + params.limit);
    return {
        executions: paged,
        total,
        source: "analytics_executions",
    };
}
async function enrichBundleWithNlpPatch(client, bundle, routeHardening) {
    let baselineNlp = null;
    const tid = bundle.summary?.test_case_id;
    const testCaseNum = typeof tid === "number" ? tid : tid !== undefined ? Number(tid) : NaN;
    if (Number.isFinite(testCaseNum) && testCaseNum > 0) {
        try {
            const tc = await client.request(`/api/web/v1/test-cases/${encodeURIComponent(String(testCaseNum))}`);
            baselineNlp = extractNlpCommandsFromGeneratedTest(tc);
        }
        catch {
            baselineNlp = null;
        }
    }
    const patch = (0, failureNlpPatch_js_1.buildSuggestedNlpPatch)(bundle, baselineNlp && baselineNlp.length ? baselineNlp : null, {
        routeProfile: routeHardening.profile,
        routeEnvCustomMap: routeHardening.customMap,
        suggestRouteHardenNav: routeHardening.enabled,
    });
    return { ...bundle, suggested_nlp_patch: patch };
}
async function buildFailureBundle(client, execution_id, logs_limit, event_limit) {
    const [summary, eventsResponse, logsResponse] = await Promise.all([
        client.request(`/api/web/v1/analytics/execution/${encodeURIComponent(execution_id)}/summary`),
        client.request(`/api/web/v1/analytics/execution/${encodeURIComponent(execution_id)}/events`),
        client.request(`/api/web/v1/executions/${encodeURIComponent(execution_id)}/logs`, { query: { limit: logs_limit, offset: 0 } }),
    ]);
    const events = eventsResponse.events || [];
    const logs = logsResponse.logs || [];
    const failedEvents = events.filter((e) => isFailedStatus(e.status));
    const combinedText = `${asText(summary)}\n${asText(failedEvents.slice(0, event_limit))}\n${asText(logs.slice(0, logs_limit))}`;
    const theme = inferFailureTheme(combinedText);
    return {
        execution_id,
        summary,
        failure_signals: {
            failed_event_count: failedEvents.length,
            total_event_count: events.length,
            log_count: logs.length,
        },
        failed_event_sample: failedEvents.slice(0, event_limit),
        log_sample: logs.slice(0, logs_limit),
        inferred_root_cause: theme,
    };
}
function extractExecutionIdFromExecuteResponse(response) {
    if (!response || typeof response !== "object")
        return null;
    const r = response;
    const direct = r.execution_id;
    if (typeof direct === "string" && direct.length >= 6)
        return direct;
    const data = r.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
        const nested = data.execution_id;
        if (typeof nested === "string" && nested.length >= 6)
            return nested;
    }
    return null;
}
async function buildPassFailTrendPayload(client, project_id, range, limit) {
    const response = await fetchRecentExecutionsWithFallback(client, {
        project_id,
        range,
        limit,
        offset: 0,
    });
    const items = response.executions || [];
    const passed = items.filter((x) => isPassedStatus(x.status)).length;
    const failed = items.filter((x) => isFailedStatus(x.status)).length;
    const other = items.length - passed - failed;
    const passRate = items.length > 0 ? Number(((passed / items.length) * 100).toFixed(2)) : 0;
    const midpoint = Math.max(1, Math.floor(items.length / 2));
    const firstHalf = items.slice(midpoint);
    const secondHalf = items.slice(0, midpoint);
    const firstHalfPassRate = firstHalf.length > 0 ? (firstHalf.filter((x) => isPassedStatus(x.status)).length / firstHalf.length) * 100 : 0;
    const secondHalfPassRate = secondHalf.length > 0
        ? (secondHalf.filter((x) => isPassedStatus(x.status)).length / secondHalf.length) * 100
        : 0;
    const delta = Number((secondHalfPassRate - firstHalfPassRate).toFixed(2));
    const trendDirection = delta > 2 ? "improving" : delta < -2 ? "declining" : "stable";
    return {
        contract_version: "execution_intelligence.v1",
        source: response.source,
        project_id,
        range,
        sample_size: items.length,
        passed,
        failed,
        other,
        pass_rate_percent: passRate,
        trend: {
            direction: trendDirection,
            pass_rate_delta_percent: delta,
            first_half_pass_rate_percent: Number(firstHalfPassRate.toFixed(2)),
            second_half_pass_rate_percent: Number(secondHalfPassRate.toFixed(2)),
        },
        latest_executions_preview: items.slice(0, 10).map((x) => ({
            execution_id: x.execution_id,
            status: x.status ?? "unknown",
            canonical_status: (0, executionContracts_js_1.toCanonicalExecutionStatus)(x.status),
            test_case_name: x.test_case_name ?? null,
            created_at: x.created_at ?? null,
        })),
    };
}
async function runExecutionReportPipeline(client, execution_id, opts) {
    const timeline = [];
    let finalSummary = null;
    for (let attempt = 1; attempt <= opts.max_polls; attempt += 1) {
        const summary = await client.request(`/api/web/v1/analytics/execution/${encodeURIComponent(execution_id)}/summary`);
        const status = normalizeStatus(summary.status);
        finalSummary = (0, executionContracts_js_1.normalizeExecutionSummary)(summary);
        timeline.push({
            poll: attempt,
            status: summary.status ?? "unknown",
            canonical_status: (0, executionContracts_js_1.toCanonicalExecutionStatus)(status),
            completed_steps: summary.completed_steps ?? 0,
            failed_steps: summary.failed_steps ?? 0,
            total_steps: summary.total_steps ?? 0,
            duration_ms: summary.duration_ms ?? 0,
        });
        if (isTerminalStatus(status))
            break;
        await sleep(opts.poll_interval_ms);
    }
    const statusResp = await client.request(`/api/web/v1/playwright-sdk/executions/${encodeURIComponent(execution_id)}`, { query: { include_steps: opts.include_steps } });
    const data = statusResp.data;
    const executionNormalized = data && typeof data === "object" && !Array.isArray(data)
        ? (0, executionContracts_js_1.normalizeExecutionSummary)(data)
        : (0, executionContracts_js_1.normalizeExecutionSummary)(statusResp);
    let failure_bundle = null;
    if (opts.include_failure_bundle_on_fail && isFailedStatus(finalSummary?.status)) {
        const bundle = await buildFailureBundle(client, execution_id, opts.failure_logs_limit, opts.failure_event_limit);
        failure_bundle =
            opts.include_nlp_patch_in_bundle !== false
                ? await enrichBundleWithNlpPatch(client, bundle, opts.routeHardening)
                : bundle;
    }
    let project_trend = null;
    if (opts.include_project_trend) {
        const rawPid = executionNormalized.project_id ??
            finalSummary?.project_id ??
            opts.project_id_fallback;
        const projectNum = typeof rawPid === "number" ? rawPid : Number(rawPid);
        if (Number.isFinite(projectNum) && projectNum > 0) {
            project_trend = await buildPassFailTrendPayload(client, projectNum, opts.trend_range, opts.trend_limit);
        }
    }
    return {
        contract_version: "execution_pipeline.v1",
        execution_id,
        reached_terminal_state: isTerminalStatus(finalSummary?.status),
        polls_performed: timeline.length,
        watch_timeline: timeline,
        analytics_summary: finalSummary,
        execution: executionNormalized,
        raw_response_meta: {
            api_version: statusResp.api_version ?? null,
        },
        failure_bundle,
        project_trend,
        insights: {
            headline: finalSummary && isPassedStatus(finalSummary.status)
                ? "Run finished successfully."
                : finalSummary && isFailedStatus(finalSummary.status)
                    ? "Run failed — use failure_bundle and execution.steps for triage."
                    : isTerminalStatus(finalSummary?.status)
                        ? "Run reached a terminal state."
                        : "Run did not reach a terminal status within the poll budget — increase max_polls or poll_interval_ms.",
            note: "This payload replaces chaining testneo_execute_generated_test_case → testneo_watch_execution → testneo_get_execution_status → testneo_get_execution_summary.",
            recommended_next_tools: isFailedStatus(finalSummary?.status)
                ? ["testneo_update_test_case_nlp (review suggested_nlp_patch in failure_bundle)", "testneo_rerun_failed"]
                : isPassedStatus(finalSummary?.status)
                    ? []
                    : ["testneo_get_execution_logs", "testneo_get_failure_bundle"],
        },
    };
}
async function waitForEtlJobCompletion(client, jobId, maxPolls, pollIntervalMs) {
    let last = {};
    for (let attempt = 1; attempt <= maxPolls; attempt += 1) {
        const job = await client.request(`/api/v1/etl/jobs/${encodeURIComponent(jobId)}`);
        last = job;
        const status = normalizeStatus(job.status);
        if (status === "completed" || status === "failed")
            return job;
        await sleep(pollIntervalMs);
    }
    return last;
}
function registerTools(server, deps) {
    const { client } = deps;
    const projectRouteCache = new Map();
    let cachedTenantId = undefined;
    let tenantLookupInFlight = null;
    function deriveTenantIdFromRecord(record) {
        const directTenant = record.tenant_id ?? record.tenantId ?? record.organization_id ?? record.org_id ?? record.account_id;
        if (typeof directTenant === "number" && Number.isFinite(directTenant) && directTenant > 0) {
            return `tenant:${directTenant}`;
        }
        if (typeof directTenant === "string" && directTenant.trim()) {
            return `tenant:${directTenant.trim()}`;
        }
        const uid = record.user_id ?? record.userId;
        if (typeof uid === "number" && Number.isFinite(uid) && uid > 0)
            return `user:${uid}`;
        if (typeof uid === "string" && uid.trim())
            return `user:${uid.trim()}`;
        return null;
    }
    async function gateProjectExecutable(projectId, opts) {
        const policy = await (0, policyEngine_js_1.evaluatePreconditionPolicies)(client, {
            tool_name: opts?.toolName ?? "unknown_tool",
            project_id: projectId,
            nlp_commands: opts?.nlpCommands,
            auth_expectation: opts?.authExpectation,
            route_map: opts?.routeMap,
            skip_base_url_check: deps.relaxProjectPreconditions,
            mode: deps.policyMode,
        });
        if (policy.ok)
            return null;
        return result(asText((0, policyEngine_js_1.formatPolicyFailure)(policy)));
    }
    async function gateProjectExecutableFromTestCase(testCaseId, opts) {
        const tc = await client.request(`/api/web/v1/test-cases/${encodeURIComponent(String(testCaseId))}`);
        const pid = tc.project_id;
        const projectId = typeof pid === "number" ? pid : Number(pid);
        if (!Number.isFinite(projectId) || projectId <= 0) {
            return result(asText({
                error: "project_precondition_failed",
                precondition_code: "project_fetch_failed",
                test_case_id: testCaseId,
                message: "Test case response did not include a usable project_id.",
                remediation: ["Verify test_case_id exists and the API key has access."],
            }));
        }
        const routeRuntime = await runtimeForProjectRouteMap(projectId, deps.routeHardening);
        const routeMap = (0, routeHardening_js_1.resolvePhraseToPathMap)(routeRuntime);
        return gateProjectExecutable(projectId, {
            toolName: opts?.toolName ?? "unknown_tool",
            authExpectation: opts?.authExpectation,
            nlpCommands: extractNlpCommandsFromGeneratedTest(tc),
            routeMap,
        });
    }
    function replayOrConflict(toolName, idempotencyKey, fingerprintInput) {
        if (!idempotencyKey)
            return { blocked: null };
        const key = `${toolName}:${idempotencyKey}`;
        const fingerprint = (0, idempotency_js_1.makeIdempotencyFingerprint)(fingerprintInput);
        const check = (0, idempotency_js_1.checkIdempotency)(key, fingerprint);
        if (!check.ok) {
            return {
                blocked: result(asText({
                    error: "idempotency_conflict",
                    idempotency_key: idempotencyKey,
                    message: check.message,
                })),
            };
        }
        if (check.replay) {
            let cached = check.replay;
            try {
                cached = JSON.parse(check.replay);
            }
            catch {
                cached = check.replay;
            }
            return {
                blocked: result(asText({
                    replayed: true,
                    idempotency_key: idempotencyKey,
                    cached_response: cached,
                })),
            };
        }
        return { blocked: null, key, fingerprint };
    }
    async function fetchProjectRouteConfig(projectId) {
        const cached = projectRouteCache.get(projectId);
        if (cached)
            return cached;
        const project = await client.request(`/api/web/v1/projects/${encodeURIComponent(String(projectId))}`);
        const parsed = (0, projectRouteMap_js_1.parseProjectRouteConfig)(project);
        projectRouteCache.set(projectId, parsed);
        return parsed;
    }
    async function runtimeForProjectRouteMap(projectId, base) {
        const pr = await fetchProjectRouteConfig(projectId);
        return {
            enabled: pr.enabled ?? base.enabled,
            profile: pr.profile ?? base.profile,
            customMap: { ...base.customMap, ...pr.extra_map },
        };
    }
    async function runtimeForTestCaseRouteMap(testCaseId, base) {
        const tc = await client.request(`/api/web/v1/test-cases/${encodeURIComponent(String(testCaseId))}`);
        const pid = Number(tc.project_id);
        if (!Number.isFinite(pid) || pid <= 0)
            return base;
        return runtimeForProjectRouteMap(pid, base);
    }
    function registerTracedTool(toolName, config, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MCP + Zod inferred tool args; traced wrapper must not widen to unknown
    cb) {
        async function ensureTenantId() {
            if (cachedTenantId !== undefined)
                return cachedTenantId;
            if (tenantLookupInFlight)
                return tenantLookupInFlight;
            tenantLookupInFlight = (async () => {
                try {
                    const v = await client.request("/api/web/v1/playwright-sdk/validate", {
                        method: "POST",
                    });
                    const tid = deriveTenantIdFromRecord(v);
                    cachedTenantId = tid;
                    return tid;
                }
                catch {
                    cachedTenantId = null;
                    return null;
                }
                finally {
                    tenantLookupInFlight = null;
                }
            })();
            return tenantLookupInFlight;
        }
        function deriveProjectIdFromParams(params) {
            if (!params || typeof params !== "object" || Array.isArray(params))
                return null;
            const rec = params;
            const pid = rec.project_id;
            if (typeof pid === "number" && Number.isFinite(pid) && pid > 0)
                return pid;
            if (typeof pid === "string") {
                const n = Number(pid);
                if (Number.isFinite(n) && n > 0)
                    return n;
            }
            return null;
        }
        function recordDimensionsFromRecord(record) {
            const tenantId = deriveTenantIdFromRecord(record);
            let pidRaw = record.project_id ?? record.projectId;
            if (pidRaw === undefined) {
                const filters = record.filters;
                if (filters && typeof filters === "object" && !Array.isArray(filters)) {
                    const f = filters;
                    pidRaw = f.project_id ?? f.projectId;
                }
            }
            if (pidRaw === undefined) {
                const ex = record.executions;
                if (Array.isArray(ex) && ex.length > 0 && ex[0] && typeof ex[0] === "object") {
                    const first = ex[0];
                    pidRaw = first.project_id ?? first.projectId;
                }
            }
            let projectId = null;
            if (typeof pidRaw === "number" && Number.isFinite(pidRaw) && pidRaw > 0)
                projectId = pidRaw;
            if (typeof pidRaw === "string") {
                const n = Number(pidRaw);
                if (Number.isFinite(n) && n > 0)
                    projectId = n;
            }
            (0, toolTelemetry_js_1.recordToolDimensions)({
                ...(projectId !== null ? { projectId } : {}),
                ...(tenantId !== null ? { tenantId } : {}),
            });
        }
        server.registerTool(toolName, config, async (params) => {
            // Tenant dimension should be stable per API key/user; resolve once and reuse.
            await ensureTenantId();
            return (0, toolTelemetry_js_1.runWithToolTelemetry)(toolName, async () => {
                const projectId = deriveProjectIdFromParams(params);
                (0, toolTelemetry_js_1.recordToolDimensions)({
                    ...(projectId !== null ? { projectId } : {}),
                    ...(cachedTenantId ? { tenantId: cachedTenantId } : {}),
                });
                const out = await cb(params);
                const chunk = out.content[0];
                if (chunk?.type === "text") {
                    const txt = chunk.text.trim();
                    if (txt.startsWith("{") && txt.endsWith("}")) {
                        try {
                            const parsed = JSON.parse(txt);
                            recordDimensionsFromRecord(parsed);
                        }
                        catch {
                            /* noop */
                        }
                    }
                }
                return out;
            });
        });
    }
    registerTracedTool("testneo_validate_connection", {
        description: "Validate token and fetch basic account context.",
        inputSchema: zod_1.z.object({}),
    }, async () => {
        const response = await client.request("/api/web/v1/playwright-sdk/validate", { method: "POST" });
        const tenant = response && typeof response === "object" ? deriveTenantIdFromRecord(response) : null;
        if (tenant) {
            cachedTenantId = tenant;
            (0, toolTelemetry_js_1.recordToolDimensions)({ tenantId: tenant });
        }
        return result(`Connection valid.\n${asText(response)}`);
    });
    registerTracedTool("testneo_get_project_route_map", {
        description: "Get project-level MCP route-hardening map/profile from project_settings.mcp_route_hardening.",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
        }),
    }, async ({ project_id }) => {
        const project = await client.request(`/api/web/v1/projects/${encodeURIComponent(String(project_id))}`);
        const route = (0, projectRouteMap_js_1.parseProjectRouteConfig)(project);
        const effective = await runtimeForProjectRouteMap(project_id, deps.routeHardening);
        return result(asText({
            project_id,
            settings_key: (0, projectRouteMap_js_1.projectRouteSettingsKey)(),
            project_route_hardening: route,
            effective_route_hardening: {
                enabled: effective.enabled,
                profile: effective.profile,
                map_size: Object.keys(effective.customMap).length,
            },
        }));
    });
    registerTracedTool("testneo_set_project_route_map", {
        description: "Persist project-level route-hardening map/profile in project_settings.mcp_route_hardening (guarded write action).",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
            profile: zod_1.z.enum(["none", "saucedemo"]).optional(),
            enabled: zod_1.z.boolean().optional(),
            extra_map: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).default({}),
            merge_mode: zod_1.z.enum(["merge", "replace"]).default("merge"),
            confirm: zod_1.z.boolean().default(false),
            idempotency_key: zod_1.z.string().min(8).max(128).optional(),
        }),
    }, async ({ project_id, profile, enabled, extra_map, merge_mode, confirm, idempotency_key }) => {
        const project = await client.request(`/api/web/v1/projects/${encodeURIComponent(String(project_id))}`);
        const current = (0, projectRouteMap_js_1.parseProjectRouteConfig)(project);
        const normalizedIncoming = (0, projectRouteMap_js_1.parseProjectRouteConfig)({
            project_settings: { [(0, projectRouteMap_js_1.projectRouteSettingsKey)()]: { extra_map, profile, enabled } },
        });
        const next = {
            enabled: normalizedIncoming.enabled ?? current.enabled,
            profile: normalizedIncoming.profile ?? current.profile,
            extra_map: merge_mode === "replace"
                ? normalizedIncoming.extra_map
                : { ...current.extra_map, ...normalizedIncoming.extra_map },
        };
        if (!deps.allowWriteTools) {
            return result(asText({
                message: "Write tools are disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to persist project route map.",
                project_id,
                merge_mode,
                current,
                proposed: next,
            }));
        }
        if (!confirm) {
            return result(asText({
                message: "Preview mode only. Set confirm=true to persist project route map.",
                project_id,
                merge_mode,
                current,
                proposed: next,
            }));
        }
        const idem = replayOrConflict("testneo_set_project_route_map", idempotency_key, {
            project_id,
            profile,
            enabled,
            extra_map,
            merge_mode,
        });
        if (idem.blocked)
            return idem.blocked;
        const projectSettings = (0, projectRouteMap_js_1.buildProjectSettingsWithRouteMap)(project.project_settings, next);
        const updateResp = await client.request(`/api/web/v1/projects/${encodeURIComponent(String(project_id))}`, { method: "PUT", body: { project_settings: projectSettings } });
        projectRouteCache.set(project_id, next);
        const payload = {
            project_id,
            settings_key: (0, projectRouteMap_js_1.projectRouteSettingsKey)(),
            merge_mode,
            saved: next,
            update_response: updateResp,
        };
        if (idem.key && idem.fingerprint)
            (0, idempotency_js_1.recordIdempotency)(idem.key, idem.fingerprint, JSON.stringify(payload));
        return result(asText(payload));
    });
    registerTracedTool("testneo_apply_route_hardening", {
        description: "Rewrite vague Navigate-to NLP lines into {{base_url}}/path using server env (TESTNEO_ROUTE_PROFILE, TESTNEO_ROUTE_MAP_JSON) plus optional per-call overrides. Read-only; does not call the TestNeo API.",
        inputSchema: zod_1.z.object({
            nlp_commands: zod_1.z.array(zod_1.z.string()).min(1),
            route_hardening: routeHardeningToolSchema,
        }),
    }, async ({ nlp_commands, route_hardening }) => {
        const routeMap = resolveRouteMap(deps.routeHardening, route_hardening);
        const hardened = (0, routeHardening_js_1.hardenNavigationCommands)(nlp_commands, routeMap);
        return result(asText({
            nlp_commands: hardened.commands,
            replacements: hardened.replacements,
            phrase_map_size: Object.keys(routeMap).length,
        }));
    });
    registerTracedTool("testneo_swagger_preview", {
        description: "Parse Swagger/OpenAPI (JSON or YAML) from base64 and return spec format, tags, and endpoint counts. Read-only; no DB writes. Backend: POST /api/web/v1/ai-test-gen/preview.",
        inputSchema: zod_1.z.object({
            swagger_file_base64: zod_1.z.string().min(1),
            swagger_filename: zod_1.z.string().min(1).max(512),
        }),
    }, async ({ swagger_file_base64, swagger_filename }) => {
        const fnErr = validateSwaggerFilename(swagger_filename);
        if (fnErr) {
            return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_preview", { success: false, error: fnErr })));
        }
        const dec = (0, swaggerIntel_js_1.decodeSwaggerUploadBase64)(swagger_file_base64);
        if (!dec.ok) {
            return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_preview", { success: false, error: dec.error })));
        }
        const form = new FormData();
        form.append("swagger_file", dec.blob, swagger_filename.trim());
        const data = await client.requestMultipart("/api/web/v1/ai-test-gen/preview", form);
        return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_preview", {
            ...data,
            fingerprint_sha256: dec.sha256,
        })));
    });
    registerTracedTool("testneo_swagger_upload_and_generate", {
        description: "Upload Swagger + optional business rules → unified context indexing + NLP web test cases (multipart). Guarded: TESTNEO_MCP_ALLOW_WRITE + confirm=true. Respects project execution preconditions. Large payloads: set TESTNEO_MCP_SWAGGER_TIMEOUT_MS. Backend: POST /api/web/v1/ai-test-gen/upload-and-generate.",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
            swagger_file_base64: zod_1.z.string().min(1),
            swagger_filename: zod_1.z.string().min(1).max(512),
            business_rules_text: zod_1.z.string().max(2_000_000).optional(),
            business_rules_file_base64: zod_1.z.string().min(1).optional(),
            business_rules_filename: zod_1.z.string().min(1).max(512).optional(),
            folder_id: zod_1.z.number().int().positive().optional(),
            max_test_cases: zod_1.z.number().int().min(1).max(200).default(50),
            focus_tags: zod_1.z.string().max(500).optional(),
            confirm: zod_1.z.boolean().default(false),
            idempotency_key: zod_1.z.string().min(8).max(128).optional(),
        }),
    }, async ({ project_id, swagger_file_base64, swagger_filename, business_rules_text, business_rules_file_base64, business_rules_filename, folder_id, max_test_cases, focus_tags, confirm, idempotency_key, }) => {
        const fnErr = validateSwaggerFilename(swagger_filename);
        if (fnErr) {
            return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_upload_and_generate", { success: false, error: fnErr })));
        }
        const swaggerDec = (0, swaggerIntel_js_1.decodeSwaggerUploadBase64)(swagger_file_base64);
        if (!swaggerDec.ok) {
            return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_upload_and_generate", { success: false, error: swaggerDec.error })));
        }
        let rulesHash = "none";
        let rulesBlob = null;
        let rulesFname = null;
        if (business_rules_text != null && business_rules_text.length > 0) {
            if (business_rules_file_base64 || business_rules_filename) {
                return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_upload_and_generate", {
                    success: false,
                    error: "Use either business_rules_text or business_rules_file_base64+filename, not both.",
                })));
            }
            rulesHash = (0, swaggerIntel_js_1.sha256Utf8)(business_rules_text);
            rulesBlob = new Blob([business_rules_text], { type: "text/plain" });
            rulesFname = "business_rules.txt";
        }
        else if (business_rules_file_base64 || business_rules_filename) {
            if (!business_rules_file_base64 || !business_rules_filename) {
                return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_upload_and_generate", {
                    success: false,
                    error: "Provide both business_rules_file_base64 and business_rules_filename together.",
                })));
            }
            const rfn = validateBusinessRulesFilename(business_rules_filename);
            if (rfn) {
                return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_upload_and_generate", { success: false, error: rfn })));
            }
            const rdec = (0, swaggerIntel_js_1.decodeSwaggerUploadBase64)(business_rules_file_base64);
            if (!rdec.ok) {
                return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_upload_and_generate", { success: false, error: rdec.error })));
            }
            rulesHash = rdec.sha256;
            rulesBlob = rdec.blob;
            rulesFname = business_rules_filename.trim();
        }
        const idem = replayOrConflict("testneo_swagger_upload_and_generate", idempotency_key, {
            project_id,
            swagger_sha256: swaggerDec.sha256,
            rules_hash: rulesHash,
            folder_id: folder_id ?? null,
            max_test_cases,
            focus_tags: focus_tags ?? null,
        });
        if (idem.blocked)
            return idem.blocked;
        if (!deps.allowWriteTools) {
            return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_upload_and_generate", {
                message: "Write tools disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to run Swagger → NLP generation.",
                project_id,
                swagger_sha256: swaggerDec.sha256,
                rules_hash: rulesHash,
                max_test_cases,
                focus_tags: focus_tags ?? null,
            })));
        }
        if (!confirm) {
            return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_upload_and_generate", {
                message: "Preview mode. Set confirm=true to upload, index context, and generate NLP test cases.",
                project_id,
                swagger_sha256: swaggerDec.sha256,
                rules_hash: rulesHash,
                max_test_cases,
                focus_tags: focus_tags ?? null,
            })));
        }
        const routeRuntime = await runtimeForProjectRouteMap(project_id, deps.routeHardening);
        const routeMap = (0, routeHardening_js_1.resolvePhraseToPathMap)(routeRuntime);
        const blocked = await gateProjectExecutable(project_id, {
            toolName: "testneo_swagger_upload_and_generate",
            routeMap,
        });
        if (blocked)
            return blocked;
        const form = new FormData();
        form.append("swagger_file", swaggerDec.blob, swagger_filename.trim());
        if (rulesBlob && rulesFname) {
            form.append("business_rules_file", rulesBlob, rulesFname);
        }
        form.append("project_id", String(project_id));
        if (folder_id !== undefined)
            form.append("folder_id", String(folder_id));
        form.append("max_test_cases", String(max_test_cases));
        if (focus_tags !== undefined && focus_tags.trim()) {
            form.append("focus_tags", focus_tags.trim());
        }
        const data = await client.requestMultipart("/api/web/v1/ai-test-gen/upload-and-generate", form);
        const wrapped = (0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_upload_and_generate", {
            ...data,
            swagger_fingerprint_sha256: swaggerDec.sha256,
            business_rules_fingerprint_sha256: rulesHash !== "none" ? rulesHash : undefined,
        });
        if (idem.key && idem.fingerprint)
            (0, idempotency_js_1.recordIdempotency)(idem.key, idem.fingerprint, asText(wrapped));
        return result(asText(wrapped));
    });
    registerTracedTool("testneo_swagger_impact_analysis", {
        description: "Compare an uploaded Swagger revision against the last snapshot for a web project, diff endpoints, and list impacted swagger-sourced NLP tests. Persists the modified spec bytes for the next baseline. Guarded: allow-write + confirm=true. Backend: POST /api/web/v1/ai-test-gen/impact-analysis.",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
            swagger_file_base64: zod_1.z.string().min(1),
            swagger_filename: zod_1.z.string().min(1).max(512),
            confirm: zod_1.z.boolean().default(false),
            idempotency_key: zod_1.z.string().min(8).max(128).optional(),
        }),
    }, async ({ project_id, swagger_file_base64, swagger_filename, confirm, idempotency_key }) => {
        const fnErr = validateSwaggerFilename(swagger_filename);
        if (fnErr) {
            return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_impact_analysis", { success: false, error: fnErr })));
        }
        const dec = (0, swaggerIntel_js_1.decodeSwaggerUploadBase64)(swagger_file_base64);
        if (!dec.ok) {
            return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_impact_analysis", { success: false, error: dec.error })));
        }
        const idem = replayOrConflict("testneo_swagger_impact_analysis", idempotency_key, {
            project_id,
            swagger_sha256: dec.sha256,
        });
        if (idem.blocked)
            return idem.blocked;
        if (!deps.allowWriteTools) {
            return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_impact_analysis", {
                message: "Write tools disabled. Set TESTNEO_MCP_ALLOW_WRITE=true; impact analysis persists spec state.",
                project_id,
                swagger_fingerprint_sha256: dec.sha256,
            })));
        }
        if (!confirm) {
            return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_impact_analysis", {
                message: "Preview mode. Set confirm=true to run diff + impacted-test detection (persists new spec).",
                project_id,
                swagger_fingerprint_sha256: dec.sha256,
            })));
        }
        const routeRuntime = await runtimeForProjectRouteMap(project_id, deps.routeHardening);
        const routeMap = (0, routeHardening_js_1.resolvePhraseToPathMap)(routeRuntime);
        const blocked = await gateProjectExecutable(project_id, {
            toolName: "testneo_swagger_impact_analysis",
            routeMap,
        });
        if (blocked)
            return blocked;
        const form = new FormData();
        form.append("swagger_file", dec.blob, swagger_filename.trim());
        form.append("project_id", String(project_id));
        const data = await client.requestMultipart("/api/web/v1/ai-test-gen/impact-analysis", form);
        const wrapped = (0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_impact_analysis", {
            ...data,
            swagger_fingerprint_sha256: dec.sha256,
        });
        if (idem.key && idem.fingerprint)
            (0, idempotency_js_1.recordIdempotency)(idem.key, idem.fingerprint, asText(wrapped));
        return result(asText(wrapped));
    });
    registerTracedTool("testneo_swagger_impact_actions", {
        description: "Bulk apply impact triage on web test cases: mark_stale | archive | keep, then promote modified spec snapshot when possible. Guarded: allow-write + confirm=true. Backend: POST /api/web/v1/ai-test-gen/impact-actions.",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
            actions: zod_1.z
                .array(zod_1.z.object({
                test_case_id: zod_1.z.number().int().positive(),
                action: zod_1.z.enum(["mark_stale", "archive", "keep"]),
            }))
                .min(1)
                .max(200),
            confirm: zod_1.z.boolean().default(false),
            idempotency_key: zod_1.z.string().min(8).max(128).optional(),
        }),
    }, async ({ project_id, actions, confirm, idempotency_key }) => {
        const idem = replayOrConflict("testneo_swagger_impact_actions", idempotency_key, {
            project_id,
            actions,
        });
        if (idem.blocked)
            return idem.blocked;
        if (!deps.allowWriteTools) {
            return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_impact_actions", {
                message: "Write tools disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to apply impact actions.",
                project_id,
                action_count: actions.length,
            })));
        }
        if (!confirm) {
            return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_impact_actions", {
                message: "Preview mode. Set confirm=true to apply stale/archive/keep actions.",
                project_id,
                preview_actions: actions,
            })));
        }
        const routeRuntime = await runtimeForProjectRouteMap(project_id, deps.routeHardening);
        const routeMap = (0, routeHardening_js_1.resolvePhraseToPathMap)(routeRuntime);
        const blocked = await gateProjectExecutable(project_id, {
            toolName: "testneo_swagger_impact_actions",
            routeMap,
        });
        if (blocked)
            return blocked;
        const data = await client.request("/api/web/v1/ai-test-gen/impact-actions", {
            method: "POST",
            body: { project_id, actions },
        });
        const wrapped = (0, swaggerIntel_js_1.wrapSwaggerIntel)("swagger_impact_actions", { ...data });
        if (idem.key && idem.fingerprint)
            (0, idempotency_js_1.recordIdempotency)(idem.key, idem.fingerprint, asText(wrapped));
        return result(asText(wrapped));
    });
    registerTracedTool("testneo_api_project_upload_openapi", {
        description: "Upload OpenAPI JSON/YAML to a classic API project (stores spec on Project.openapi_spec). Use before testneo_api_project_openapi_impact. Guarded: allow-write + confirm=true. Backend: POST /api/v1/projects/{id}/upload-openapi (multipart field: file).",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
            openapi_file_base64: zod_1.z.string().min(1),
            openapi_filename: zod_1.z.string().min(1).max(512),
            confirm: zod_1.z.boolean().default(false),
            idempotency_key: zod_1.z.string().min(8).max(128).optional(),
        }),
    }, async ({ project_id, openapi_file_base64, openapi_filename, confirm, idempotency_key }) => {
        const fnErr = validateOpenapiFilename(openapi_filename);
        if (fnErr) {
            return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("api_project_upload_openapi", { success: false, error: fnErr })));
        }
        const dec = (0, swaggerIntel_js_1.decodeSwaggerUploadBase64)(openapi_file_base64);
        if (!dec.ok) {
            return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("api_project_upload_openapi", { success: false, error: dec.error })));
        }
        const idem = replayOrConflict("testneo_api_project_upload_openapi", idempotency_key, {
            project_id,
            openapi_sha256: dec.sha256,
        });
        if (idem.blocked)
            return idem.blocked;
        if (!deps.allowWriteTools) {
            return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("api_project_upload_openapi", {
                message: "Write tools disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to upload OpenAPI to the API project.",
                project_id,
                openapi_fingerprint_sha256: dec.sha256,
            })));
        }
        if (!confirm) {
            return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("api_project_upload_openapi", {
                message: "Preview mode. Set confirm=true to persist OpenAPI on the API project.",
                project_id,
                openapi_fingerprint_sha256: dec.sha256,
            })));
        }
        const form = new FormData();
        form.append("file", dec.blob, openapi_filename.trim());
        const data = await client.requestMultipart(`/api/v1/projects/${encodeURIComponent(String(project_id))}/upload-openapi`, form);
        const wrapped = (0, swaggerIntel_js_1.wrapSwaggerIntel)("api_project_upload_openapi", { ...data, openapi_fingerprint_sha256: dec.sha256 });
        if (idem.key && idem.fingerprint)
            (0, idempotency_js_1.recordIdempotency)(idem.key, idem.fingerprint, asText(wrapped));
        return result(asText(wrapped));
    });
    registerTracedTool("testneo_api_project_openapi_impact", {
        description: "Run OpenAPI impact analysis for API (non-web) test cases against a new or stored spec. Pass openapi_spec to diff an inline revision, or omit to analyze using the spec already saved on the project. Guarded: allow-write + confirm=true (service may flag tests). Backend: POST /api/v1/projects/{id}/openapi-impact.",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
            openapi_spec: zod_1.z.union([zod_1.z.record(zod_1.z.unknown()), zod_1.z.string()]).optional(),
            auto_flag: zod_1.z.boolean().default(true),
            business_rules: zod_1.z.array(zod_1.z.record(zod_1.z.unknown())).optional(),
            confirm: zod_1.z.boolean().default(false),
            idempotency_key: zod_1.z.string().min(8).max(128).optional(),
        }),
    }, async ({ project_id, openapi_spec, auto_flag, business_rules, confirm, idempotency_key }) => {
        const specKey = openapi_spec === undefined
            ? "stored_spec"
            : typeof openapi_spec === "string"
                ? (0, swaggerIntel_js_1.sha256Utf8)(openapi_spec)
                : (0, swaggerIntel_js_1.sha256Utf8)(JSON.stringify(openapi_spec));
        const idem = replayOrConflict("testneo_api_project_openapi_impact", idempotency_key, {
            project_id,
            spec_key: specKey,
            auto_flag,
            business_rules_len: business_rules?.length ?? 0,
        });
        if (idem.blocked)
            return idem.blocked;
        if (!deps.allowWriteTools) {
            return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("api_project_openapi_impact", {
                message: "Write tools disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to run API OpenAPI impact analysis.",
                project_id,
            })));
        }
        if (!confirm) {
            return result(asText((0, swaggerIntel_js_1.wrapSwaggerIntel)("api_project_openapi_impact", {
                message: "Preview mode. Set confirm=true to run openapi-impact (may update test metadata / flags downstream).",
                project_id,
                would_send_inline_spec: openapi_spec !== undefined,
                auto_flag,
            })));
        }
        const raw = await client.request(`/api/v1/projects/${encodeURIComponent(String(project_id))}/openapi-impact`, {
            method: "POST",
            body: {
                openapi_spec,
                auto_flag,
                business_rules: business_rules ?? [],
            },
            timeoutMs: client.longRequestTimeoutMs,
        });
        const data = raw.success === true && raw.data !== undefined ? raw.data : raw;
        const wrapped = (0, swaggerIntel_js_1.wrapSwaggerIntel)("api_project_openapi_impact", {
            ...data,
            envelope: raw.success === true ? { success: raw.success } : undefined,
        });
        if (idem.key && idem.fingerprint)
            (0, idempotency_js_1.recordIdempotency)(idem.key, idem.fingerprint, asText(wrapped));
        return result(asText(wrapped));
    });
    registerTracedTool("testneo_list_projects", {
        description: "List projects available to the current API key user.",
        inputSchema: zod_1.z.object({
            limit: zod_1.z.number().int().min(1).max(200).default(20),
            offset: zod_1.z.number().int().min(0).default(0),
        }),
    }, async ({ limit, offset }) => {
        const response = await client.request("/api/web/v1/playwright-sdk/projects", { query: { limit, offset } });
        const summary = (response.projects || [])
            .map((p, idx) => `${idx + 1}. ${p.id} | ${p.name} | test_cases=${p.test_cases_count ?? 0}`)
            .join("\n");
        return result(`Total projects: ${response.total ?? response.projects?.length ?? 0}\n${summary || "No projects."}`);
    });
    registerTracedTool("testneo_create_web_project", {
        description: "Create a new web automation project (stored under your API key account). Mirrors POST /api/web/v1/projects. Guarded: TESTNEO_MCP_ALLOW_WRITE=true and confirm=true. By default creates a default web environment with base_url (and optional username/password variables) in the same request; set create_default_environment=false for project-only. New projects get Lighthouse performance audits enabled unless project_settings overrides.",
        inputSchema: zod_1.z.object({
            name: zod_1.z.string().min(1).max(255),
            website_url: zod_1.z.string().url().describe("HTTPS/HTTP origin for the site under test"),
            description: zod_1.z.string().max(8000).optional(),
            environment: zod_1.z.enum(["local", "staging", "production", "development"]).default("staging"),
            status: zod_1.z.enum(["active", "inactive", "archived"]).default("active"),
            project_environment_name: zod_1.z.string().min(1).max(100).default("staging"),
            base_url_variable_name: zod_1.z.string().min(1).max(100).default("base_url"),
            create_default_environment: zod_1.z
                .boolean()
                .default(true)
                .describe("When true (default), creates the first web environment with base_url (and credentials if provided) in the same API call."),
            environment_username: zod_1.z.string().min(1).max(500).optional(),
            environment_password: zod_1.z.string().min(1).max(8192).optional(),
            confirm: zod_1.z.boolean().default(false),
            idempotency_key: zod_1.z.string().min(8).max(128).optional(),
        }),
    }, async ({ name, website_url, description, environment, status, project_environment_name, base_url_variable_name, create_default_environment, environment_username, environment_password, confirm, idempotency_key, }) => {
        const idem = replayOrConflict("testneo_create_web_project", idempotency_key, {
            name,
            website_url,
            description,
            environment,
            status,
            project_environment_name,
            base_url_variable_name,
            create_default_environment,
            environment_username: environment_username ?? null,
            environment_password: environment_password ? "***" : null,
        });
        if (idem.blocked)
            return idem.blocked;
        if (!deps.allowWriteTools) {
            return result(asText({
                message: "Write tools disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to create a web project.",
                would_create: {
                    name,
                    website_url,
                    description,
                    environment,
                    status,
                    project_environment_name,
                    base_url_variable_name,
                    create_default_environment,
                    environment_username: environment_username ?? null,
                    environment_password: environment_password ? "***" : null,
                },
            }));
        }
        if (!confirm) {
            const previewBody = {
                name,
                website_url,
                description,
                environment,
                status,
                create_default_environment,
                environment_username: environment_username ?? undefined,
                environment_password: environment_password ? "***" : undefined,
            };
            if (create_default_environment) {
                previewBody.initial_environment = {
                    name: project_environment_name,
                    is_default: true,
                    is_active: true,
                    variables: base_url_variable_name !== "base_url"
                        ? [{ variable_name: base_url_variable_name, variable_value: website_url }]
                        : [],
                };
            }
            return result(asText({
                message: "Preview only. Set confirm=true to create this web project.",
                would_post: {
                    path: "/api/web/v1/projects",
                    body: previewBody,
                },
            }));
        }
        try {
            const body = {
                name,
                website_url,
                description,
                environment,
                status,
                create_default_environment,
            };
            if (environment_username !== undefined && environment_username !== "") {
                body.environment_username = environment_username;
            }
            if (environment_password !== undefined && environment_password !== "") {
                body.environment_password = environment_password;
            }
            if (create_default_environment) {
                body.initial_environment = {
                    name: project_environment_name,
                    is_default: true,
                    is_active: true,
                    variables: base_url_variable_name !== "base_url"
                        ? [{ variable_name: base_url_variable_name, variable_value: website_url }]
                        : [],
                };
            }
            const created = await client.request("/api/web/v1/projects", {
                method: "POST",
                body,
            });
            const wrapped = {
                contract_version: "web_project_bootstrap.v1",
                created_project: created,
                recommended_next_tools: create_default_environment
                    ? [
                        "testneo_set_project_route_map (optional phrase→path hardening)",
                        "testneo_figma_image_to_tests_workflow (PNG export, no Figma token) or testneo_swagger_upload_and_generate",
                        "testneo_run_generated_test_pipeline (use test_case_id from generation preview or Swagger response)",
                    ]
                    : [
                        "testneo_create_web_project_environment (default env + base_url variable for {{base_url}} in NLP)",
                        "testneo_set_project_route_map (optional phrase→path hardening)",
                        "testneo_figma_image_to_tests_workflow (PNG export, no Figma token) or testneo_swagger_upload_and_generate",
                        "testneo_run_generated_test_pipeline (use test_case_id from generation preview or Swagger response)",
                    ],
            };
            const text = asText(wrapped);
            if (idem.key && idem.fingerprint)
                (0, idempotency_js_1.recordIdempotency)(idem.key, idem.fingerprint, text);
            return result(text);
        }
        catch (e) {
            const fmt = formatTestNeoApiFailure(e);
            if (fmt)
                return fmt;
            throw e;
        }
    });
    registerTracedTool("testneo_create_web_project_environment", {
        description: "Create a named web project environment with optional variables (e.g. base_url for {{base_url}} in NLP). Backend: POST /api/web/v1/projects/{project_id}/environments. Guarded: allow-write + confirm=true.",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
            name: zod_1.z.string().min(1).max(100),
            is_default: zod_1.z.boolean().default(true),
            is_active: zod_1.z.boolean().default(true),
            variables: zod_1.z
                .array(zod_1.z.object({
                variable_name: zod_1.z.string().min(1).max(100),
                variable_value: zod_1.z.string().min(1),
                is_secret: zod_1.z.boolean().optional(),
                variable_type: zod_1.z.string().max(50).optional(),
            }))
                .optional(),
            confirm: zod_1.z.boolean().default(false),
            idempotency_key: zod_1.z.string().min(8).max(128).optional(),
        }),
    }, async ({ project_id, name, is_default, is_active, variables, confirm, idempotency_key }) => {
        const idem = replayOrConflict("testneo_create_web_project_environment", idempotency_key, {
            project_id,
            name,
            is_default,
            is_active,
            variables,
        });
        if (idem.blocked)
            return idem.blocked;
        if (!deps.allowWriteTools) {
            return result(asText({
                message: "Write tools disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to create environments.",
                project_id,
                would_create: { name, is_default, is_active, variables },
            }));
        }
        if (!confirm) {
            return result(asText({
                message: "Preview only. Set confirm=true to create this environment.",
                project_id,
                would_post: {
                    path: `/api/web/v1/projects/${project_id}/environments`,
                    body: { name, is_default, is_active, variables: variables ?? [] },
                },
            }));
        }
        try {
            const created = await client.request(`/api/web/v1/projects/${encodeURIComponent(String(project_id))}/environments`, {
                method: "POST",
                body: {
                    name,
                    is_default,
                    is_active,
                    variables: variables ?? [],
                },
            });
            const text = asText({ contract_version: "web_project_bootstrap.v1", environment: created });
            if (idem.key && idem.fingerprint)
                (0, idempotency_js_1.recordIdempotency)(idem.key, idem.fingerprint, text);
            return result(text);
        }
        catch (e) {
            const fmt = formatTestNeoApiFailure(e);
            if (fmt)
                return fmt;
            throw e;
        }
    });
    registerTracedTool("testneo_bootstrap_web_mcp_project", {
        description: "One-shot onboarding: validate → create web project with optional default environment (base_url + credentials) in a single POST when add_base_url_variable=true. Returns a trace + recommended_next_tools. Guarded like other writes.",
        inputSchema: zod_1.z.object({
            name: zod_1.z.string().min(1).max(255),
            website_url: zod_1.z.string().url(),
            description: zod_1.z.string().max(8000).optional(),
            project_environment_name: zod_1.z.string().min(1).max(100).default("staging"),
            add_base_url_variable: zod_1.z.boolean().default(true),
            base_url_variable_name: zod_1.z.string().min(1).max(100).default("base_url"),
            environment_username: zod_1.z.string().min(1).max(500).optional(),
            environment_password: zod_1.z.string().min(1).max(8192).optional(),
            confirm: zod_1.z.boolean().default(false),
            idempotency_key: zod_1.z.string().min(8).max(128).optional(),
        }),
    }, async ({ name, website_url, description, project_environment_name, add_base_url_variable, base_url_variable_name, environment_username, environment_password, confirm, idempotency_key, }) => {
        const trace = [];
        const idem = replayOrConflict("testneo_bootstrap_web_mcp_project", idempotency_key, {
            name,
            website_url,
            description,
            project_environment_name,
            add_base_url_variable,
            base_url_variable_name,
            environment_username: environment_username ?? null,
            environment_password: environment_password ? "***" : null,
        });
        if (idem.blocked)
            return idem.blocked;
        if (!deps.allowWriteTools) {
            trace.push({
                step: "allow_write",
                status: "blocked",
                detail: "Set TESTNEO_MCP_ALLOW_WRITE=true to run bootstrap.",
            });
            return result(asText({
                contract_version: "web_project_bootstrap.v1",
                trace,
                planned: {
                    name,
                    website_url,
                    description,
                    project_environment_name,
                    add_base_url_variable,
                    environment_username: environment_username ?? null,
                    environment_password: environment_password ? "***" : null,
                },
            }));
        }
        if (!confirm) {
            trace.push({ step: "dry_run", status: "ok", detail: "Set confirm=true to execute." });
            const bootstrapProjectBody = {
                name,
                website_url,
                description,
                environment: "staging",
                status: "active",
                create_default_environment: add_base_url_variable,
            };
            if (environment_username !== undefined && environment_username !== "") {
                bootstrapProjectBody.environment_username = environment_username;
            }
            if (environment_password !== undefined && environment_password !== "") {
                bootstrapProjectBody.environment_password = "***";
            }
            if (add_base_url_variable) {
                bootstrapProjectBody.initial_environment = {
                    name: project_environment_name,
                    is_default: true,
                    is_active: true,
                    variables: base_url_variable_name !== "base_url"
                        ? [{ variable_name: base_url_variable_name, variable_value: website_url }]
                        : [],
                };
            }
            return result(asText({
                contract_version: "web_project_bootstrap.v1",
                trace,
                preview: {
                    create_project: {
                        path: "/api/web/v1/projects",
                        body: bootstrapProjectBody,
                    },
                },
                recommended_next_tools: [
                    "testneo_bootstrap_web_mcp_project (confirm=true, same idempotency_key optional)",
                    "testneo_list_projects",
                    "testneo_figma_image_to_tests_workflow (PNG export, no Figma token)",
                    "testneo_swagger_upload_and_generate",
                    "testneo_figma_to_tests_workflow (Figma API token path)",
                    "testneo_run_generated_test_pipeline",
                ],
            }));
        }
        try {
            const v = await client.request("/api/web/v1/playwright-sdk/validate", {
                method: "POST",
            });
            trace.push({ step: "validate_connection", status: "ok", detail: v });
        }
        catch (e) {
            const fmt = formatTestNeoApiFailure(e);
            if (fmt)
                return fmt;
            throw e;
        }
        let project;
        try {
            const bootstrapProjectBody = {
                name,
                website_url,
                description,
                environment: "staging",
                status: "active",
                create_default_environment: add_base_url_variable,
            };
            if (environment_username !== undefined && environment_username !== "") {
                bootstrapProjectBody.environment_username = environment_username;
            }
            if (environment_password !== undefined && environment_password !== "") {
                bootstrapProjectBody.environment_password = environment_password;
            }
            if (add_base_url_variable) {
                bootstrapProjectBody.initial_environment = {
                    name: project_environment_name,
                    is_default: true,
                    is_active: true,
                    variables: base_url_variable_name !== "base_url"
                        ? [{ variable_name: base_url_variable_name, variable_value: website_url }]
                        : [],
                };
            }
            project = await client.request("/api/web/v1/projects", {
                method: "POST",
                body: bootstrapProjectBody,
            });
            trace.push({ step: "create_web_project", status: "ok", detail: { id: project.id, name: project.name } });
        }
        catch (e) {
            if (e instanceof httpClient_js_1.TestNeoApiError) {
                trace.push({ step: "create_web_project", status: "error" });
                let detail = e.body;
                try {
                    detail = JSON.parse(e.body);
                }
                catch {
                    /* keep string */
                }
                return result(asText({
                    contract_version: "web_project_bootstrap.v1",
                    trace,
                    error: "testneo_api_error",
                    http_status: e.status,
                    path: e.path,
                    detail,
                }));
            }
            throw e;
        }
        const pidRaw = project.id;
        const project_id = typeof pidRaw === "number" ? pidRaw : Number(pidRaw);
        if (!Number.isFinite(project_id) || project_id <= 0) {
            return result(asText({
                contract_version: "web_project_bootstrap.v1",
                trace,
                error: "bootstrap_invalid_response",
                message: "Create project succeeded but response had no usable id.",
                raw: project,
            }));
        }
        let environment = null;
        if (add_base_url_variable) {
            trace.push({
                step: "create_initial_environment",
                status: "ok",
                detail: "Created in same transaction as project (POST /api/web/v1/projects).",
            });
            try {
                const envs = await client.request(`/api/web/v1/projects/${encodeURIComponent(String(project_id))}/environments`);
                const list = Array.isArray(envs) ? envs : [];
                environment = list[0] ?? null;
            }
            catch {
                environment = null;
            }
        }
        else {
            trace.push({ step: "create_environment", status: "skipped", detail: "add_base_url_variable=false" });
        }
        const wrapped = asText({
            contract_version: "web_project_bootstrap.v1",
            trace,
            project_id,
            project,
            environment,
            headline: "Web project ready for ingest + generation + execution.",
            recommended_next_tools: [
                `testneo_set_project_route_map (project_id=${project_id}, optional navigation hardening)`,
                `testneo_figma_image_to_tests_workflow (PNG/JPEG export, no Figma token) or testneo_swagger_upload_and_generate (OpenAPI)`,
                `testneo_figma_to_tests_workflow (only if you use a Figma API token + file id)`,
                `testneo_run_generated_test_pipeline (test_case_id from generation preview or API)`,
            ],
        });
        if (idem.key && idem.fingerprint)
            (0, idempotency_js_1.recordIdempotency)(idem.key, idem.fingerprint, wrapped);
        return result(wrapped);
    });
    registerTracedTool("testneo_list_recent_executions", {
        description: "List recent executions, optionally filtered by project/status/release/build.",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive().optional(),
            status_filter: zod_1.z.string().min(1).optional(),
            release: zod_1.z.string().min(1).optional(),
            build: zod_1.z.string().min(1).optional(),
            limit: zod_1.z.number().int().min(1).max(200).default(20),
            offset: zod_1.z.number().int().min(0).default(0),
        }),
    }, async ({ project_id, status_filter, release, build, limit, offset }) => {
        const response = await fetchRecentExecutionsWithFallback(client, {
            project_id,
            status_filter,
            release,
            build,
            range: "30d",
            limit,
            offset,
        });
        const items = (response.executions || []).map((x) => (0, executionContracts_js_1.normalizeExecutionItem)(x));
        return result(asText({
            contract_version: "execution_intelligence.v1",
            source: response.source,
            filters: { project_id, status_filter: status_filter ?? null, release: release ?? null, build: build ?? null },
            total: response.total ?? items.length,
            executions: items,
        }));
    });
    registerTracedTool("testneo_get_execution_status", {
        description: "Fetch primary execution status, steps and summary metadata for an execution ID.",
        inputSchema: zod_1.z.object({
            execution_id: zod_1.z.string().min(6),
            include_steps: zod_1.z.boolean().default(true),
        }),
    }, async ({ execution_id, include_steps }) => {
        const response = await client.request(`/api/web/v1/playwright-sdk/executions/${encodeURIComponent(execution_id)}`, {
            query: { include_steps },
        });
        const data = response.data;
        const normalized = data && typeof data === "object" && !Array.isArray(data)
            ? (0, executionContracts_js_1.normalizeExecutionSummary)(data)
            : (0, executionContracts_js_1.normalizeExecutionSummary)(response);
        return result(asText({
            contract_version: "execution_intelligence.v1",
            execution_id,
            execution: normalized,
            raw_response_meta: {
                api_version: response.api_version ?? null,
            },
        }));
    });
    registerTracedTool("testneo_get_execution_summary", {
        description: "Get analytics summary for an execution (status, pass/fail, duration, video metadata).",
        inputSchema: zod_1.z.object({
            execution_id: zod_1.z.string().min(6),
        }),
    }, async ({ execution_id }) => {
        const response = await client.request(`/api/web/v1/analytics/execution/${encodeURIComponent(execution_id)}/summary`);
        const normalized = (0, executionContracts_js_1.normalizeExecutionSummary)(response);
        return result(asText({ contract_version: "execution_intelligence.v1", execution_id, summary: normalized }));
    });
    registerTracedTool("testneo_get_execution_logs", {
        description: "Get execution logs for an execution ID.",
        inputSchema: zod_1.z.object({
            execution_id: zod_1.z.string().min(6),
            limit: zod_1.z.number().int().min(1).max(1000).default(200),
            offset: zod_1.z.number().int().min(0).default(0),
        }),
    }, async ({ execution_id, limit, offset }) => {
        const response = await client.request(`/api/web/v1/executions/${encodeURIComponent(execution_id)}/logs`, { query: { limit, offset } });
        return result(asText(response));
    });
    registerTracedTool("testneo_search_failures", {
        description: "Search failed executions for a project by test name or execution id fragment.",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
            query: zod_1.z.string().min(1),
            limit: zod_1.z.number().int().min(1).max(200).default(50),
        }),
    }, async ({ project_id, query, limit }) => {
        const response = await fetchRecentExecutionsWithFallback(client, {
            project_id,
            status_filter: "failed",
            range: "30d",
            limit,
            offset: 0,
        });
        const q = query.toLowerCase();
        const filtered = (response.executions || []).filter((x) => (x.execution_id || "").toLowerCase().includes(q) ||
            (x.test_case_name || "").toLowerCase().includes(q));
        return result(asText({
            contract_version: "execution_intelligence.v1",
            source: response.source,
            project_id,
            query,
            matched: filtered.length,
            executions: filtered.map((x) => (0, executionContracts_js_1.normalizeExecutionItem)(x)),
        }));
    });
    registerTracedTool("testneo_get_pass_fail_trend", {
        description: "Summarize pass/fail trend for a project over a date range.",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
            range: zod_1.z.enum(["1d", "7d", "30d", "90d"]).default("30d"),
            limit: zod_1.z.number().int().min(10).max(500).default(200),
        }),
    }, async ({ project_id, range, limit }) => {
        const payload = await buildPassFailTrendPayload(client, project_id, range, limit);
        return result(asText(payload));
    });
    registerTracedTool("testneo_watch_execution", {
        description: "Poll execution summary until terminal status or timeout window.",
        inputSchema: zod_1.z.object({
            execution_id: zod_1.z.string().min(6),
            max_polls: zod_1.z.number().int().min(1).max(120).default(20),
            poll_interval_ms: zod_1.z.number().int().min(500).max(10000).default(1500),
            include_event_sample: zod_1.z.boolean().default(true),
            event_sample_limit: zod_1.z.number().int().min(1).max(30).default(10),
        }),
    }, async ({ execution_id, max_polls, poll_interval_ms, include_event_sample, event_sample_limit }) => {
        const timeline = [];
        let finalSummary = null;
        for (let attempt = 1; attempt <= max_polls; attempt += 1) {
            const summary = await client.request(`/api/web/v1/analytics/execution/${encodeURIComponent(execution_id)}/summary`);
            const status = normalizeStatus(summary.status);
            finalSummary = (0, executionContracts_js_1.normalizeExecutionSummary)(summary);
            timeline.push({
                poll: attempt,
                status: summary.status ?? "unknown",
                canonical_status: (0, executionContracts_js_1.toCanonicalExecutionStatus)(status),
                completed_steps: summary.completed_steps ?? 0,
                failed_steps: summary.failed_steps ?? 0,
                total_steps: summary.total_steps ?? 0,
                duration_ms: summary.duration_ms ?? 0,
            });
            if (isTerminalStatus(status))
                break;
            await sleep(poll_interval_ms);
        }
        let eventSample = [];
        if (include_event_sample) {
            try {
                const eventsResponse = await client.request(`/api/web/v1/analytics/execution/${encodeURIComponent(execution_id)}/events`);
                eventSample = (eventsResponse.events || []).slice(-event_sample_limit);
            }
            catch {
                eventSample = [];
            }
        }
        return result(asText({
            contract_version: "execution_intelligence.v1",
            execution_id,
            final_status: finalSummary?.status ?? "unknown",
            final_canonical_status: (0, executionContracts_js_1.toCanonicalExecutionStatus)(finalSummary?.status),
            polls_performed: timeline.length,
            reached_terminal_state: isTerminalStatus(finalSummary?.status),
            final_summary: finalSummary,
            timeline,
            event_sample: eventSample,
        }));
    });
    registerTracedTool("testneo_get_failure_bundle", {
        description: "Get a compact failure triage bundle: summary, event sample, logs, inferred theme, next actions, plus a concrete suggested NLP patch (diff + testneo_update_test_case_nlp payload) when execution summary includes test_case_id.",
        inputSchema: zod_1.z.object({
            execution_id: zod_1.z.string().min(6),
            logs_limit: zod_1.z.number().int().min(20).max(500).default(150),
            event_limit: zod_1.z.number().int().min(5).max(50).default(20),
            include_nlp_patch_suggestion: zod_1.z.boolean().default(true),
        }),
    }, async ({ execution_id, logs_limit, event_limit, include_nlp_patch_suggestion }) => {
        const bundle = await buildFailureBundle(client, execution_id, logs_limit, event_limit);
        const enriched = include_nlp_patch_suggestion !== false
            ? await enrichBundleWithNlpPatch(client, bundle, deps.routeHardening)
            : bundle;
        return result(asText(enriched));
    });
    registerTracedTool("testneo_run_agent_workflow", {
        description: "Run an agentic multi-step QA workflow (triage_failure, rerun_decision, qa_intelligence) over TestNeo data.",
        inputSchema: zod_1.z.object({
            workflow_type: zod_1.z.enum(["triage_failure_workflow", "rerun_decision_workflow", "qa_intelligence_workflow"]),
            project_id: zod_1.z.number().int().positive(),
            range: zod_1.z.enum(["1d", "7d", "30d", "90d"]).default("30d"),
            top_failures: zod_1.z.number().int().min(1).max(5).default(2),
            rerun_limit: zod_1.z.number().int().min(1).max(20).default(3),
        }),
    }, async ({ workflow_type, project_id, range, top_failures, rerun_limit }) => {
        const trace = [];
        trace.push({ step: "load_recent_executions", status: "ok" });
        const recent = await fetchRecentExecutionsWithFallback(client, {
            project_id,
            range,
            limit: 300,
            offset: 0,
        });
        const recentItems = recent.executions || [];
        const failedItems = recentItems.filter((x) => isFailedStatus(x.status));
        const passed = recentItems.filter((x) => isPassedStatus(x.status)).length;
        const failed = failedItems.length;
        const passRate = recentItems.length > 0 ? Number(((passed / recentItems.length) * 100).toFixed(2)) : 0;
        const selectedFailures = failedItems.slice(0, top_failures);
        const bundles = [];
        if (workflow_type === "triage_failure_workflow" || workflow_type === "qa_intelligence_workflow") {
            trace.push({ step: "build_failure_bundles", status: "ok", detail: `count=${selectedFailures.length}` });
            for (const item of selectedFailures) {
                const raw = await buildFailureBundle(client, item.execution_id, 120, 20);
                bundles.push(await enrichBundleWithNlpPatch(client, raw, deps.routeHardening));
            }
            trace.push({ step: "enrich_failure_bundles_with_nlp_patch_suggestions", status: "ok" });
        }
        else {
            trace.push({ step: "build_failure_bundles", status: "skipped", detail: "workflow does not require deep triage" });
        }
        const themeCounts = {};
        for (const bundle of bundles) {
            const theme = bundle.inferred_root_cause.theme;
            themeCounts[theme] = (themeCounts[theme] || 0) + 1;
        }
        const recurringThemes = Object.entries(themeCounts)
            .map(([theme, count]) => ({ theme, count }))
            .sort((a, b) => b.count - a.count);
        const rerunCandidates = Array.from(new Map(failedItems
            .filter((x) => typeof x.test_case_id === "number" && x.test_case_id > 0)
            .map((x) => [x.test_case_id, x])).values()).slice(0, rerun_limit);
        trace.push({ step: "compute_rerun_candidates", status: "ok", detail: `count=${rerunCandidates.length}` });
        const rerunPlan = rerunCandidates.map((x, idx) => ({
            rank: idx + 1,
            test_case_id: x.test_case_id ?? null,
            execution_id: x.execution_id,
            reason: "recent_failed_execution",
            preview_only: true,
        }));
        if (workflow_type === "triage_failure_workflow") {
            return result(asText({
                workflow_type,
                source: recent.source,
                project_id,
                range,
                execution_volume: recentItems.length,
                failed_executions: selectedFailures.map((x) => x.execution_id),
                triage_bundles: bundles,
                recurring_themes: recurringThemes,
                trace,
            }));
        }
        if (workflow_type === "rerun_decision_workflow") {
            return result(asText({
                workflow_type,
                source: recent.source,
                project_id,
                range,
                execution_volume: recentItems.length,
                pass_rate_percent: passRate,
                failed_executions_count: failed,
                rerun_plan_preview: rerunPlan,
                write_execution_required: {
                    allow_write_env: "TESTNEO_MCP_ALLOW_WRITE=true",
                    confirm_flag: "confirm=true",
                },
                trace,
            }));
        }
        return result(asText({
            workflow_type: "qa_intelligence_workflow",
            source: recent.source,
            project_id,
            range,
            execution_summary: {
                total: recentItems.length,
                passed,
                failed,
                pass_rate_percent: passRate,
            },
            latest_failed_execution_ids: failedItems.slice(0, Math.max(top_failures, 10)).map((x) => x.execution_id),
            triage_bundles: bundles,
            recurring_themes: recurringThemes,
            rerun_plan_preview: rerunPlan,
            write_execution_required: {
                allow_write_env: "TESTNEO_MCP_ALLOW_WRITE=true",
                confirm_flag: "confirm=true",
            },
            trace,
        }));
    });
    registerTracedTool("testneo_ingest_figma_context", {
        description: "Ingest Figma metadata via ETL, optionally wait for completion, then create a linked unified context for test generation.",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
            figma_token: zod_1.z.string().min(10),
            figma_file_id: zod_1.z.string().min(3),
            context_name: zod_1.z.string().min(3),
            context_description: zod_1.z.string().optional(),
            wait_for_ingest: zod_1.z.boolean().default(true),
            max_polls: zod_1.z.number().int().min(1).max(120).default(30),
            poll_interval_ms: zod_1.z.number().int().min(500).max(10000).default(2000),
        }),
    }, async ({ project_id, figma_token, figma_file_id, context_name, context_description, wait_for_ingest, max_polls, poll_interval_ms, }) => {
        const connect = await client.request(`/api/v1/etl/connect-figma`, {
            method: "POST",
            body: {
                projectId: project_id,
                figmaToken: figma_token,
                fileId: figma_file_id,
            },
        });
        const etlJobId = String(connect.jobId);
        let etlJob = { id: etlJobId, status: connect.status };
        if (wait_for_ingest) {
            etlJob = await waitForEtlJobCompletion(client, etlJobId, max_polls, poll_interval_ms);
        }
        const context = await client.request(`/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts`, {
            method: "POST",
            body: {
                name: context_name,
                description: context_description || `Figma context for file ${figma_file_id}`,
                context_type: "unified",
                selected_document_ids: [`etl-${etlJobId}`],
            },
        });
        return result(asText({
            project_id,
            figma_file_id,
            etl_job: etlJob,
            unified_context: {
                id: context.id ?? null,
                name: context.name ?? context_name,
                entity_count: context.entity_count ?? 0,
                relationship_count: context.relationship_count ?? 0,
            },
        }));
    });
    registerTracedTool("testneo_list_unified_contexts", {
        description: "List unified contexts for a project with id + human-readable names. Use before testneo_generate_tests_from_context so agents do not have to scrape context_id from the UI.",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
            compact: zod_1.z.boolean().default(true),
            max_compact_lines: zod_1.z.number().int().min(1).max(150).default(60),
        }),
    }, async ({ project_id, compact, max_compact_lines }) => {
        const payload = await client.request(`/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts`);
        const contexts = parseUnifiedContextListPayload(payload);
        const body = {
            project_id,
            count: contexts.length,
            ...(compact ? { compact_index: unifiedContextsCompactLines(contexts, max_compact_lines) } : {}),
            contexts,
            next_steps: [
                "Call testneo_get_unified_context_by_name(project_id, name_query) when you know the intent label but not id.",
                "Pass resolved context_id into testneo_generate_tests_from_context.",
            ],
        };
        let textLead = compact
            ? `Unified contexts for project ${project_id} (${contexts.length} total)\n${body.compact_index}\n`
            : `Unified contexts for project ${project_id} (${contexts.length} total)\n`;
        if (!compact)
            textLead = textLead.trimEnd();
        return result(`${textLead}\n${asText(body)}`);
    });
    registerTracedTool("testneo_get_unified_context_by_name", {
        description: "Resolve unified context_id from a natural-language name against this project’s contexts (calls list internally). Great for onboarding and demos.",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
            name_query: zod_1.z.string().min(1).max(500),
            match_mode: zod_1.z.enum(["auto", "exact", "substring"]).default("auto"),
            prefer_context_id: zod_1.z.number().int().positive().optional(),
            include_detail: zod_1.z.boolean().default(false),
        }),
    }, async ({ project_id, name_query, match_mode, prefer_context_id, include_detail }) => {
        const payload = await client.request(`/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts`);
        const contexts = parseUnifiedContextListPayload(payload);
        const resolved = (0, unifiedContextDiscovery_js_1.resolveUnifiedContextByName)(contexts, name_query, match_mode, { prefer_context_id });
        let detail = null;
        if (include_detail && resolved.chosen) {
            detail = await client.request(`/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts/${encodeURIComponent(String(resolved.chosen.id))}`);
        }
        const body = {
            project_id,
            name_query,
            normalized_query: (0, unifiedContextDiscovery_js_1.normalizeContextQuery)(name_query),
            match_mode,
            resolved_context_id: resolved.chosen?.id ?? null,
            summary: resolved.chosen ?? null,
            ambiguity: resolved.chosen
                ? null
                : {
                    candidate_count: resolved.candidates_same_tier.length,
                    candidates: resolved.candidates_same_tier.map((x) => ({
                        id: x.id,
                        name: x.name,
                        entity_count: x.entity_count,
                        relationship_count: x.relationship_count,
                        created_at: x.created_at,
                    })),
                },
            hint: resolved.hint,
            include_detail_requested: include_detail,
            detail: detail ?? undefined,
        };
        const leadLines = resolved.chosen
            ? [`Using context id ${resolved.chosen.id} (${JSON.stringify(resolved.chosen.name)}). ${resolved.hint}`]
            : [
                `${resolved.hint}`,
                "Try listing with testneo_list_unified_contexts, narrow name_query, or pass prefer_context_id when several share a label.",
            ];
        return result(`${leadLines.join("\n")}\n${asText(body)}`);
    });
    registerTracedTool("testneo_generate_tests_from_context", {
        description: "Generate NLP test cases from an existing unified context (Figma, requirements, etc.). Resolve context via testneo_list_unified_contexts or testneo_get_unified_context_by_name (name_query, not scraped UI ids). Omit auth_preamble for public / no-login apps (default: no SauceDemo login injected, no SauceDemo route auto-align). Pass auth_preamble { enabled:true, preset:'saucedemo' } only for demos against saucedemo.com. Custom maps: TESTNEO_ROUTE_MAP_JSON or testneo_set_project_route_map; optional auto_align_saucedemo_route_map + SauceDemo preset ties route phrases to SauceDemo paths.",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
            context_id: zod_1.z.number().int().positive(),
            test_types: zod_1.z.array(zod_1.z.string().min(1)).default(["positive", "negative", "edge"]),
            include_ui_tests: zod_1.z.boolean().default(true),
            include_api_tests: zod_1.z.boolean().default(true),
            include_e2e_flows: zod_1.z.boolean().default(true),
            max_tests: zod_1.z.number().int().min(1).max(200).optional(),
            max_tests_per_type: zod_1.z.number().int().min(1).max(20).default(5),
            priority_threshold: zod_1.z.number().min(0).max(1).default(0.3),
            relationship_depth: zod_1.z.number().int().min(1).max(5).default(2),
            focus_areas: zod_1.z.array(zod_1.z.string().min(1)).optional(),
            auth_preamble: zod_1.z
                .object({
                enabled: zod_1.z.boolean().default(true),
                preset: zod_1.z.enum(["saucedemo", "custom"]).default("saucedemo"),
                commands: zod_1.z.array(zod_1.z.string().min(1)).optional(),
            })
                .optional()
                .describe("Omit entirely for generic sites (no login preamble). Use { enabled:false } to persist without auth lines. SauceDemo preset only for saucedemo.com demos."),
            persist_auth_preamble: zod_1.z.boolean().default(true),
            route_hardening: routeHardeningToolSchema,
            persist_route_hardening: zod_1.z.boolean().default(true),
            auto_align_saucedemo_route_map: zod_1.z.boolean().default(true),
        }),
    }, async ({ project_id, context_id, test_types, include_ui_tests, include_api_tests, include_e2e_flows, max_tests, max_tests_per_type, priority_threshold, relationship_depth, focus_areas, auth_preamble, persist_auth_preamble, route_hardening, persist_route_hardening, auto_align_saucedemo_route_map, }) => {
        const wantsSauceLogin = !!auth_preamble &&
            auth_preamble.enabled !== false &&
            (auth_preamble.preset ?? "saucedemo") === "saucedemo";
        const blocked = await gateProjectExecutable(project_id, {
            toolName: "testneo_generate_tests_from_context",
            authExpectation: wantsSauceLogin ? "required" : "optional",
        });
        if (blocked)
            return blocked;
        const generation = await client.request(`/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts/${encodeURIComponent(String(context_id))}/generate-tests`, {
            method: "POST",
            body: {
                selected_entity_ids: [],
                test_types,
                include_ui_tests,
                include_api_tests,
                include_e2e_flows,
                max_tests,
                max_tests_per_type,
                priority_threshold,
                relationship_depth,
                focus_areas,
            },
        });
        const generated = generation.generated_test_cases || [];
        const authSteps = buildAuthPreamble(auth_preamble);
        let routeRuntime = await runtimeForProjectRouteMap(project_id, deps.routeHardening);
        const authUsesSaucedemo = wantsSauceLogin;
        if (auto_align_saucedemo_route_map &&
            authUsesSaucedemo &&
            routeRuntime.profile === "none" &&
            Object.keys(routeRuntime.customMap).length === 0 &&
            route_hardening?.profile === undefined) {
            routeRuntime = { ...routeRuntime, profile: "saucedemo" };
        }
        const routeMap = resolveRouteMap(routeRuntime, route_hardening);
        const patchedPreview = generated.slice(0, 10).map((t) => {
            const baseline = extractNlpCommandsFromGeneratedTest(t);
            const afterAuth = withAuthPreamble(baseline, authSteps);
            const hardened = (0, routeHardening_js_1.hardenNavigationCommands)(afterAuth, routeMap);
            const previewCommands = persist_route_hardening ? hardened.commands : afterAuth;
            return {
                id: t.id ?? t.test_case_id ?? null,
                name: t.name ?? t.test_name ?? "Generated Test",
                nlp_commands: previewCommands,
                route_replacements: persist_route_hardening ? hardened.replacements : [],
                route_replacements_available: hardened.replacements,
            };
        });
        const persisted = [];
        if (persist_auth_preamble || persist_route_hardening) {
            for (const test of generated) {
                const testId = test.id ?? test.test_case_id;
                if (!testId)
                    continue;
                const baseline = extractNlpCommandsFromGeneratedTest(test);
                const afterAuth = withAuthPreamble(baseline, authSteps);
                const hardened = (0, routeHardening_js_1.hardenNavigationCommands)(afterAuth, routeMap);
                const toPersist = persist_route_hardening ? hardened.commands : afterAuth;
                const authChanged = persist_auth_preamble && JSON.stringify(afterAuth) !== JSON.stringify(baseline);
                const routeChanged = persist_route_hardening &&
                    JSON.stringify(hardened.commands) !== JSON.stringify(afterAuth);
                if (!authChanged && !routeChanged) {
                    persisted.push({
                        test_case_id: testId,
                        updated: false,
                        skipped: true,
                        reason: "no_changes",
                    });
                    continue;
                }
                try {
                    await client.request(`/api/web/v1/test-cases/${encodeURIComponent(String(testId))}`, {
                        method: "PUT",
                        body: {
                            nlp_commands: toPersist,
                        },
                    });
                    persisted.push({
                        test_case_id: testId,
                        updated: true,
                        added_auth_steps: afterAuth.length - baseline.length,
                        route_replacements_applied: hardened.replacements.length,
                    });
                }
                catch (error) {
                    persisted.push({
                        test_case_id: testId,
                        updated: false,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        }
        return result(asText({
            generation_id: generation.generation_id ?? null,
            context_id,
            total_tests_generated: generation.total_tests_generated ?? generated.length,
            message: generation.message ?? "",
            ai_summary: generation.ai_summary ?? "",
            auth_preamble_applied: authSteps,
            route_hardening: {
                effective_profile: routeRuntime.profile,
                map_size: Object.keys(routeMap).length,
                persist_route_hardening,
                auto_align_saucedemo_route_map,
            },
            generated_test_cases_preview: patchedPreview,
            persisted_auth_updates: persisted,
            raw: generation,
        }));
    });
    registerTracedTool("testneo_preview_generated_tests", {
        description: "Preview generated tests in both NLP and Playwright SDK spec.ts draft format for human-in-loop approval. Applies route hardening (env + optional route_hardening) to Navigate-to lines when a phrase map is configured.",
        inputSchema: zod_1.z.object({
            generated_test_cases: zod_1.z.array(zod_1.z.record(zod_1.z.any())).min(1),
            max_items: zod_1.z.number().int().min(1).max(20).default(5),
            route_hardening: routeHardeningToolSchema,
        }),
    }, async ({ generated_test_cases, max_items, route_hardening }) => {
        const routeMap = resolveRouteMap(deps.routeHardening, route_hardening);
        const preview = generated_test_cases.slice(0, max_items).map((t, idx) => {
            const testName = String(t.name ?? t.test_name ?? `Generated Test ${idx + 1}`);
            let nlp = extractNlpCommandsFromGeneratedTest(t);
            const hardened = (0, routeHardening_js_1.hardenNavigationCommands)(nlp, routeMap);
            nlp = hardened.commands;
            const riskFlags = [];
            if (!nlp.length)
                riskFlags.push("no_nlp_commands_detected");
            if (nlp.length < 3)
                riskFlags.push("very_short_flow");
            if (!nlp.some((x) => /verify|assert|expect/i.test(x)))
                riskFlags.push("no_explicit_assertion_step");
            return {
                id: t.id ?? t.test_case_id ?? null,
                name: testName,
                nlp_commands: nlp,
                route_replacements: hardened.replacements,
                risk_flags: riskFlags,
                playwright_spec_ts: buildPlaywrightSpecTs(testName, nlp),
            };
        });
        return result(asText({ preview_count: preview.length, items: preview }));
    });
    registerTracedTool("testneo_execute_generated_test_case", {
        description: "Execute a generated test case by ID (human-in-loop gated). Uses web test-case execution endpoint. Optional environment_id or environment_name resolves {{variables}} from that project environment (same as UI); omit to use NLP # Environment: directive, project default, or first env.",
        inputSchema: zod_1.z.object({
            test_case_id: zod_1.z.number().int().positive(),
            confirm: zod_1.z.boolean().default(false),
            idempotency_key: zod_1.z.string().min(8).max(128).optional(),
            environment_id: zod_1.z.number().int().positive().optional(),
            environment_name: zod_1.z.string().min(1).optional(),
        }),
    }, async ({ test_case_id, confirm, idempotency_key, environment_id, environment_name }) => {
        if (!deps.allowWriteTools) {
            return result("Write tools are disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to enable execution.");
        }
        if (!confirm) {
            return result(`Execution preview only. Set confirm=true to execute test_case_id=${test_case_id}.`);
        }
        const idem = replayOrConflict("testneo_execute_generated_test_case", idempotency_key, {
            test_case_id,
            environment_id: environment_id ?? null,
            environment_name: environment_name ?? null,
        });
        if (idem.blocked)
            return idem.blocked;
        const blocked = await gateProjectExecutableFromTestCase(test_case_id, {
            toolName: "testneo_execute_generated_test_case",
        });
        if (blocked)
            return blocked;
        const response = await client.request(`/api/web/v1/test-cases/${encodeURIComponent(String(test_case_id))}/execute`, {
            method: "POST",
            body: {
                execution_source: "mcp_generated_test_execution",
                trigger_reason: "human_approved_generated_test",
                ...(environment_id != null ? { environment_id } : {}),
                ...(environment_name ? { environment_name } : {}),
            },
        });
        const payload = { test_case_id, response };
        if (idem.key && idem.fingerprint)
            (0, idempotency_js_1.recordIdempotency)(idem.key, idem.fingerprint, JSON.stringify(payload));
        return result(asText(payload));
    });
    registerTracedTool("testneo_run_generated_test_pipeline", {
        description: "End-to-end: execute a generated test (confirm), poll until terminal, return analytics summary + step-level execution, optional failure triage bundle, and project pass/fail trend. Prefer this over manually chaining execute → watch → get_execution_status → get_execution_summary.",
        inputSchema: zod_1.z.object({
            test_case_id: zod_1.z.number().int().positive(),
            confirm: zod_1.z.boolean().default(false),
            idempotency_key: zod_1.z.string().min(8).max(128).optional(),
            environment_id: zod_1.z.number().int().positive().optional(),
            environment_name: zod_1.z.string().min(1).optional(),
            max_polls: zod_1.z.number().int().min(1).max(120).default(40),
            poll_interval_ms: zod_1.z.number().int().min(500).max(10000).default(1500),
            include_steps: zod_1.z.boolean().default(true),
            include_failure_bundle_on_fail: zod_1.z.boolean().default(true),
            include_project_trend: zod_1.z.boolean().default(true),
            trend_range: zod_1.z.enum(["1d", "7d", "30d", "90d"]).default("30d"),
            trend_limit: zod_1.z.number().int().min(10).max(500).default(200),
            failure_logs_limit: zod_1.z.number().int().min(20).max(500).default(150),
            failure_event_limit: zod_1.z.number().int().min(5).max(50).default(20),
            include_nlp_patch_suggestion: zod_1.z.boolean().default(true),
        }),
    }, async ({ test_case_id, confirm, idempotency_key, environment_id, environment_name, max_polls, poll_interval_ms, include_steps, include_failure_bundle_on_fail, include_project_trend, trend_range, trend_limit, failure_logs_limit, failure_event_limit, include_nlp_patch_suggestion, }) => {
        if (!confirm) {
            return result(asText({
                contract_version: "execution_pipeline.v1",
                mode: "preview",
                message: "Set confirm=true to run the full pipeline: execute test → wait for completion → return report (analytics_summary, execution with steps, failure_bundle on failure, project_trend).",
                test_case_id,
                requires_env: "TESTNEO_MCP_ALLOW_WRITE=true for execution",
            }));
        }
        if (!deps.allowWriteTools) {
            return result("Write tools are disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to run the pipeline.");
        }
        const idem = replayOrConflict("testneo_run_generated_test_pipeline", idempotency_key, {
            test_case_id,
            environment_id: environment_id ?? null,
            environment_name: environment_name ?? null,
            max_polls,
            poll_interval_ms,
            include_steps,
            include_failure_bundle_on_fail,
            include_project_trend,
            trend_range,
            trend_limit,
        });
        if (idem.blocked)
            return idem.blocked;
        const blocked = await gateProjectExecutableFromTestCase(test_case_id, {
            toolName: "testneo_run_generated_test_pipeline",
        });
        if (blocked)
            return blocked;
        let projectIdFallback;
        if (include_project_trend) {
            try {
                const tc = await client.request(`/api/web/v1/test-cases/${encodeURIComponent(String(test_case_id))}`);
                const pid = tc.project_id ?? tc.projectId;
                const n = typeof pid === "number" ? pid : Number(pid);
                if (Number.isFinite(n) && n > 0)
                    projectIdFallback = n;
            }
            catch {
                projectIdFallback = undefined;
            }
        }
        const response = await client.request(`/api/web/v1/test-cases/${encodeURIComponent(String(test_case_id))}/execute`, {
            method: "POST",
            body: {
                execution_source: "mcp_generated_test_pipeline",
                trigger_reason: "human_approved_generated_test_pipeline",
                ...(environment_id != null ? { environment_id } : {}),
                ...(environment_name ? { environment_name } : {}),
            },
        });
        const execution_id = extractExecutionIdFromExecuteResponse(response);
        if (!execution_id) {
            return result(asText({
                contract_version: "execution_pipeline.v1",
                error: "Could not read execution_id from execute response",
                test_case_id,
                execute_response: response,
            }));
        }
        const pipeline = await runExecutionReportPipeline(client, execution_id, {
            max_polls,
            poll_interval_ms,
            include_steps,
            include_failure_bundle_on_fail,
            failure_logs_limit,
            failure_event_limit,
            include_nlp_patch_in_bundle: include_nlp_patch_suggestion,
            routeHardening: deps.routeHardening,
            include_project_trend,
            trend_range,
            trend_limit,
            project_id_fallback: projectIdFallback,
        });
        const payload = {
            test_case_id,
            execute_response: response,
            pipeline,
        };
        if (idem.key && idem.fingerprint)
            (0, idempotency_js_1.recordIdempotency)(idem.key, idem.fingerprint, JSON.stringify(payload));
        return result(asText(payload));
    });
    registerTracedTool("testneo_update_test_case_nlp", {
        description: "Update NLP commands for a specific test case ID and return verification snapshot. Optionally rewrites Navigate-to lines using route hardening (same env / route_hardening as generate).",
        inputSchema: zod_1.z.object({
            test_case_id: zod_1.z.number().int().positive(),
            nlp_commands: zod_1.z.array(zod_1.z.string().min(1)).min(1),
            apply_route_hardening: zod_1.z.boolean().default(true),
            route_hardening: routeHardeningToolSchema,
            idempotency_key: zod_1.z.string().min(8).max(128).optional(),
        }),
    }, async ({ test_case_id, nlp_commands, apply_route_hardening, route_hardening, idempotency_key }) => {
        const routeRuntime = await runtimeForTestCaseRouteMap(test_case_id, deps.routeHardening);
        const routeMap = resolveRouteMap(routeRuntime, route_hardening);
        const hardened = apply_route_hardening ? (0, routeHardening_js_1.hardenNavigationCommands)(nlp_commands, routeMap) : null;
        const commandsToSave = hardened ? hardened.commands : nlp_commands;
        const idem = replayOrConflict("testneo_update_test_case_nlp", idempotency_key, {
            test_case_id,
            apply_route_hardening,
            commandsToSave,
        });
        if (idem.blocked)
            return idem.blocked;
        const before = await client.request(`/api/web/v1/test-cases/${encodeURIComponent(String(test_case_id))}`);
        const beforeCommands = extractNlpCommandsFromGeneratedTest(before);
        const updateResp = await client.request(`/api/web/v1/test-cases/${encodeURIComponent(String(test_case_id))}`, {
            method: "PUT",
            body: {
                nlp_commands: commandsToSave,
            },
        });
        const after = await client.request(`/api/web/v1/test-cases/${encodeURIComponent(String(test_case_id))}`);
        const afterCommands = extractNlpCommandsFromGeneratedTest(after);
        const payload = {
            test_case_id,
            update_response: updateResp,
            before_nlp_count: beforeCommands.length,
            after_nlp_count: afterCommands.length,
            route_replacements: hardened?.replacements ?? [],
            updated_nlp_commands: afterCommands,
        };
        if (idem.key && idem.fingerprint)
            (0, idempotency_js_1.recordIdempotency)(idem.key, idem.fingerprint, JSON.stringify(payload));
        return result(asText(payload));
    });
    registerTracedTool("testneo_export_playwright_spec", {
        description: "Export a test case as Playwright SDK TypeScript spec text.",
        inputSchema: zod_1.z.object({
            test_case_id: zod_1.z.number().int().positive(),
        }),
    }, async ({ test_case_id }) => {
        const testCase = await client.request(`/api/web/v1/test-cases/${encodeURIComponent(String(test_case_id))}`);
        const nlp = extractNlpCommandsFromGeneratedTest(testCase);
        const name = String(testCase.name ?? `Test Case ${test_case_id}`);
        return result(asText({
            test_case_id,
            test_name: name,
            nlp_commands: nlp,
            playwright_spec_ts: buildPlaywrightSpecTs(name, nlp),
        }));
    });
    registerTracedTool("testneo_run_playwright_spec_preview", {
        description: "Run a Playwright SDK spec preview by extracting ai.run commands and executing via Playwright SDK execute endpoint.",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
            test_name: zod_1.z.string().min(1),
            playwright_spec_ts: zod_1.z.string().min(20),
            mode: zod_1.z.enum(["strict", "balanced", "adaptive"]).default("balanced"),
            confirm: zod_1.z.boolean().default(false),
            idempotency_key: zod_1.z.string().min(8).max(128).optional(),
        }),
    }, async ({ project_id, test_name, playwright_spec_ts, mode, confirm, idempotency_key }) => {
        const nlp_commands = parseNlpFromPlaywrightSpec(playwright_spec_ts);
        if (!nlp_commands.length) {
            return result("No ai.run([...]) commands were parsed from the provided Playwright spec. Ensure script includes ai.run([...], ...).");
        }
        if (!deps.allowWriteTools) {
            return result(asText({
                message: "Write tools are disabled. Enable TESTNEO_MCP_ALLOW_WRITE=true to execute.",
                parsed_nlp_commands: nlp_commands,
            }));
        }
        if (!confirm) {
            return result(asText({
                message: "Preview mode only. Set confirm=true to execute.",
                parsed_nlp_commands: nlp_commands,
            }));
        }
        const idem = replayOrConflict("testneo_run_playwright_spec_preview", idempotency_key, {
            project_id,
            test_name,
            mode,
            nlp_commands,
        });
        if (idem.blocked)
            return idem.blocked;
        const routeRuntime = await runtimeForProjectRouteMap(project_id, deps.routeHardening);
        const routeMap = (0, routeHardening_js_1.resolvePhraseToPathMap)(routeRuntime);
        const blockedPlay = await gateProjectExecutable(project_id, {
            toolName: "testneo_run_playwright_spec_preview",
            nlpCommands: nlp_commands,
            routeMap,
        });
        if (blockedPlay)
            return blockedPlay;
        const response = await client.request("/api/web/v1/playwright-sdk/execute", {
            method: "POST",
            body: {
                project_id,
                test_name,
                nlp_commands,
                options: { mode },
            },
        });
        const payload = { project_id, test_name, mode, parsed_nlp_commands: nlp_commands, response };
        if (idem.key && idem.fingerprint)
            (0, idempotency_js_1.recordIdempotency)(idem.key, idem.fingerprint, JSON.stringify(payload));
        return result(asText(payload));
    });
    registerTracedTool("testneo_figma_to_tests_workflow", {
        description: "End-to-end workflow: ingest Figma -> create unified context -> generate tests -> preview NLP + Playwright drafts.",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
            figma_token: zod_1.z.string().min(10),
            figma_file_id: zod_1.z.string().min(3),
            context_name: zod_1.z.string().min(3),
            context_description: zod_1.z.string().optional(),
            test_types: zod_1.z.array(zod_1.z.string().min(1)).default(["positive", "negative", "edge"]),
            max_tests: zod_1.z.number().int().min(1).max(200).optional(),
            preview_items: zod_1.z.number().int().min(1).max(10).default(3),
        }),
    }, async ({ project_id, figma_token, figma_file_id, context_name, context_description, test_types, max_tests, preview_items, }) => {
        const blockedProject = await gateProjectExecutable(project_id, {
            toolName: "testneo_figma_to_tests_workflow",
        });
        if (blockedProject)
            return blockedProject;
        const trace = [];
        const connect = await client.request(`/api/v1/etl/connect-figma`, {
            method: "POST",
            body: { projectId: project_id, figmaToken: figma_token, fileId: figma_file_id },
        });
        trace.push({ step: "connect_figma", status: "ok", detail: `jobId=${connect.jobId}` });
        const etlJob = await waitForEtlJobCompletion(client, String(connect.jobId), 45, 2000);
        trace.push({ step: "wait_etl_job", status: "ok", detail: `status=${etlJob.status ?? "unknown"}` });
        const context = await client.request(`/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts`, {
            method: "POST",
            body: {
                name: context_name,
                description: context_description || `Figma context for file ${figma_file_id}`,
                context_type: "unified",
                selected_document_ids: [`etl-${connect.jobId}`],
            },
        });
        trace.push({ step: "create_unified_context", status: "ok", detail: `context_id=${context.id ?? "unknown"}` });
        const generation = await client.request(`/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts/${encodeURIComponent(String(context.id))}/generate-tests`, {
            method: "POST",
            body: {
                selected_entity_ids: [],
                test_types,
                include_ui_tests: true,
                include_api_tests: true,
                include_e2e_flows: true,
                max_tests,
                max_tests_per_type: 5,
                priority_threshold: 0.3,
                relationship_depth: 2,
            },
        });
        trace.push({
            step: "generate_tests",
            status: "ok",
            detail: `count=${generation.total_tests_generated ?? 0}`,
        });
        const generated = generation.generated_test_cases || [];
        const preview = generated.slice(0, preview_items).map((t, idx) => {
            const name = String(t.name ?? t.test_name ?? `Generated Test ${idx + 1}`);
            const nlp = extractNlpCommandsFromGeneratedTest(t);
            return {
                id: t.id ?? t.test_case_id ?? null,
                name,
                nlp_commands: nlp,
                playwright_spec_ts: buildPlaywrightSpecTs(name, nlp),
            };
        });
        return result(asText({
            project_id,
            figma_file_id,
            etl_job: etlJob,
            unified_context: {
                id: context.id ?? null,
                name: context.name ?? context_name,
                entity_count: context.entity_count ?? 0,
            },
            generation_summary: {
                generation_id: generation.generation_id ?? null,
                total_tests_generated: generation.total_tests_generated ?? generated.length,
                message: generation.message ?? "",
            },
            preview,
            human_in_loop: {
                approve_then_execute_with: "testneo_execute_generated_test_case(test_case_id, confirm=true)",
            },
            trace,
        }));
    });
    registerTracedTool("testneo_figma_image_to_tests_workflow", {
        description: "No Figma token: upload exported UI image (PNG/JPEG/GIF/WebP) like the product 'Upload Figma Image' flow → wait for vision ETL → create unified context → generate tests → preview. Guarded: TESTNEO_MCP_ALLOW_WRITE + confirm=true. Backend: POST /api/web/v1/etl/upload-figma-image (multipart field: file).",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
            image_file_base64: zod_1.z.string().min(1),
            image_filename: zod_1.z.string().min(1).max(512),
            context_name: zod_1.z.string().min(3),
            context_description: zod_1.z.string().optional(),
            figma_json_id: zod_1.z.string().min(1).optional(),
            enrich_context_id: zod_1.z.number().int().positive().optional(),
            wait_for_vision: zod_1.z.boolean().default(true),
            max_polls: zod_1.z.number().int().min(1).max(120).default(45),
            poll_interval_ms: zod_1.z.number().int().min(500).max(10000).default(2000),
            test_types: zod_1.z.array(zod_1.z.string().min(1)).default(["positive", "negative", "edge"]),
            max_tests: zod_1.z.number().int().min(1).max(200).optional(),
            preview_items: zod_1.z.number().int().min(1).max(10).default(3),
            confirm: zod_1.z.boolean().default(false),
            idempotency_key: zod_1.z.string().min(8).max(128).optional(),
        }),
    }, async ({ project_id, image_file_base64, image_filename, context_name, context_description, figma_json_id, enrich_context_id, wait_for_vision, max_polls, poll_interval_ms, test_types, max_tests, preview_items, confirm, idempotency_key, }) => {
        const fnErr = validateFigmaImageFilename(image_filename);
        if (fnErr) {
            return result(asText({ contract_version: "figma_image_workflow.v1", success: false, error: fnErr }));
        }
        const dec = (0, swaggerIntel_js_1.decodeSwaggerUploadBase64)(image_file_base64);
        if (!dec.ok) {
            return result(asText({ contract_version: "figma_image_workflow.v1", success: false, error: dec.error }));
        }
        if (dec.buf.length > MAX_FIGMA_IMAGE_UPLOAD_BYTES) {
            return result(asText({
                contract_version: "figma_image_workflow.v1",
                success: false,
                error: `Image exceeds ${MAX_FIGMA_IMAGE_UPLOAD_BYTES} bytes (product limit ~10MB).`,
            }));
        }
        const idem = replayOrConflict("testneo_figma_image_to_tests_workflow", idempotency_key, {
            project_id,
            image_sha256: dec.sha256,
            image_filename: image_filename.trim(),
            context_name,
            figma_json_id: figma_json_id ?? null,
            enrich_context_id: enrich_context_id ?? null,
        });
        if (idem.blocked)
            return idem.blocked;
        if (!deps.allowWriteTools) {
            return result(asText({
                contract_version: "figma_image_workflow.v1",
                message: "Write tools disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to upload images and generate tests.",
                project_id,
                image_sha256: dec.sha256,
                image_bytes: dec.buf.length,
            }));
        }
        if (!confirm) {
            return result(asText({
                contract_version: "figma_image_workflow.v1",
                mode: "preview",
                message: "Set confirm=true to POST /api/web/v1/etl/upload-figma-image and run context + generate-tests.",
                project_id,
                image_filename: image_filename.trim(),
                image_bytes: dec.buf.length,
                image_sha256: dec.sha256,
                would_post: {
                    path: "/api/web/v1/etl/upload-figma-image",
                    query: {
                        project_id,
                        ...(figma_json_id ? { figma_json_id } : {}),
                        ...(enrich_context_id != null ? { context_id: enrich_context_id } : {}),
                    },
                    multipart_field: "file",
                },
                then: "Poll GET /api/v1/etl/jobs/{jobId} → POST unified-context with selected_document_ids [\"etl-{jobId}\"] → POST generate-tests",
            }));
        }
        const blockedProject = await gateProjectExecutable(project_id, {
            toolName: "testneo_figma_image_to_tests_workflow",
        });
        if (blockedProject)
            return blockedProject;
        const trace = [];
        const mime = mimeForImageFilename(image_filename);
        const fileBlob = new Blob([new Uint8Array(dec.buf)], { type: mime });
        const form = new FormData();
        form.append("file", fileBlob, image_filename.trim());
        const qs = new URLSearchParams({ project_id: String(project_id) });
        if (figma_json_id)
            qs.set("figma_json_id", figma_json_id);
        if (enrich_context_id != null)
            qs.set("context_id", String(enrich_context_id));
        let upload;
        try {
            upload = await client.requestMultipart(`/api/web/v1/etl/upload-figma-image?${qs.toString()}`, form, client.longRequestTimeoutMs);
        }
        catch (e) {
            const fmt = formatTestNeoApiFailure(e);
            if (fmt)
                return fmt;
            throw e;
        }
        const jobIdRaw = upload.jobId ?? upload.job_id;
        const jobId = jobIdRaw != null ? String(jobIdRaw) : "";
        if (!jobId) {
            return result(asText({
                contract_version: "figma_image_workflow.v1",
                success: false,
                error: "upload_missing_jobId",
                upload,
            }));
        }
        trace.push({ step: "upload_figma_image", status: "ok", detail: `jobId=${jobId}` });
        let etlJob = { id: jobId, status: upload.status };
        if (wait_for_vision) {
            etlJob = await waitForEtlJobCompletion(client, jobId, max_polls, poll_interval_ms);
            trace.push({ step: "wait_etl_job", status: "ok", detail: `status=${etlJob.status ?? "unknown"}` });
            const st = normalizeStatus(etlJob.status);
            if (st === "failed") {
                return result(asText({
                    contract_version: "figma_image_workflow.v1",
                    trace,
                    project_id,
                    etl_job: etlJob,
                    error: "vision_etl_failed",
                    message: String(etlJob.error_message ?? etlJob.detail ?? "ETL job failed"),
                }));
            }
        }
        const context = await client.request(`/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts`, {
            method: "POST",
            body: {
                name: context_name,
                description: context_description || `Figma image context for job ${jobId}`,
                context_type: "unified",
                selected_document_ids: [`etl-${jobId}`],
            },
        });
        trace.push({ step: "create_unified_context", status: "ok", detail: `context_id=${context.id ?? "unknown"}` });
        const generation = await client.request(`/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts/${encodeURIComponent(String(context.id))}/generate-tests`, {
            method: "POST",
            body: {
                selected_entity_ids: [],
                test_types,
                include_ui_tests: true,
                include_api_tests: true,
                include_e2e_flows: true,
                max_tests,
                max_tests_per_type: 5,
                priority_threshold: 0.3,
                relationship_depth: 2,
            },
            timeoutMs: client.longRequestTimeoutMs,
        });
        trace.push({
            step: "generate_tests",
            status: "ok",
            detail: `count=${generation.total_tests_generated ?? 0}`,
        });
        const generated = generation.generated_test_cases || [];
        const preview = generated.slice(0, preview_items).map((t, idx) => {
            const name = String(t.name ?? t.test_name ?? `Generated Test ${idx + 1}`);
            const nlp = extractNlpCommandsFromGeneratedTest(t);
            return {
                id: t.id ?? t.test_case_id ?? null,
                name,
                nlp_commands: nlp,
                playwright_spec_ts: buildPlaywrightSpecTs(name, nlp),
            };
        });
        const wrapped = asText({
            contract_version: "figma_image_workflow.v1",
            project_id,
            etl_job_id: jobId,
            unified_context: {
                id: context.id ?? null,
                name: context.name ?? context_name,
                entity_count: context.entity_count ?? 0,
            },
            generation_summary: {
                generation_id: generation.generation_id ?? null,
                total_tests_generated: generation.total_tests_generated ?? generated.length,
                message: generation.message ?? "",
            },
            preview,
            human_in_loop: {
                approve_then_execute_with: "testneo_run_generated_test_pipeline(test_case_id, confirm=true)",
            },
            trace,
        });
        if (idem.key && idem.fingerprint)
            (0, idempotency_js_1.recordIdempotency)(idem.key, idem.fingerprint, wrapped);
        return result(wrapped);
    });
    registerTracedTool("testneo_rerun_failed", {
        description: "Rerun failed tests for a project using test-case execute endpoint (guarded write action).",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
            limit: zod_1.z.number().int().min(1).max(20).default(5),
            confirm: zod_1.z.boolean().default(false),
            range: zod_1.z.enum(["1d", "7d", "30d", "90d"]).default("30d"),
            idempotency_key: zod_1.z.string().min(8).max(128).optional(),
        }),
    }, async ({ project_id, limit, confirm, range, idempotency_key }) => {
        const failed = await fetchRecentExecutionsWithFallback(client, {
            project_id,
            status_filter: "failed",
            range,
            limit: Math.max(limit * 3, 20),
            offset: 0,
        });
        const candidates = Array.from(new Map((failed.executions || [])
            .filter((x) => typeof x.test_case_id === "number" && x.test_case_id > 0)
            .map((x) => [x.test_case_id, x])).values()).slice(0, limit);
        if (!deps.allowWriteTools) {
            return result(`Write tools are disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to enable rerun actions.\n` +
                `Rerun candidates (${candidates.length}):\n${compactExecution(candidates)}`);
        }
        if (!confirm) {
            return result(`Rerun preview only (set confirm=true to execute).\n` +
                `Source: ${failed.source}\nCandidates (${candidates.length}):\n${compactExecution(candidates)}`);
        }
        const idem = replayOrConflict("testneo_rerun_failed", idempotency_key, {
            project_id,
            limit,
            range,
            candidates: candidates.map((x) => x.test_case_id),
        });
        if (idem.blocked)
            return idem.blocked;
        const routeRuntime = await runtimeForProjectRouteMap(project_id, deps.routeHardening);
        const routeMap = (0, routeHardening_js_1.resolvePhraseToPathMap)(routeRuntime);
        const blockedRerun = await gateProjectExecutable(project_id, {
            toolName: "testneo_rerun_failed",
            routeMap,
        });
        if (blockedRerun)
            return blockedRerun;
        const rerunResults = [];
        for (const item of candidates) {
            const testCaseId = item.test_case_id;
            try {
                const response = await client.request(`/api/web/v1/test-cases/${encodeURIComponent(String(testCaseId))}/execute`, {
                    method: "POST",
                    body: {
                        execution_source: "mcp_rerun_failed",
                        trigger_reason: "rerun_failed_tool",
                    },
                });
                rerunResults.push({
                    test_case_id: testCaseId,
                    previous_execution_id: item.execution_id,
                    accepted: true,
                    response,
                });
            }
            catch (error) {
                rerunResults.push({
                    test_case_id: testCaseId,
                    previous_execution_id: item.execution_id,
                    accepted: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        const payload = {
            project_id,
            source: failed.source,
            attempted: rerunResults.length,
            accepted: rerunResults.filter((x) => x.accepted === true).length,
            failed: rerunResults.filter((x) => x.accepted === false).length,
            results: rerunResults,
        };
        if (idem.key && idem.fingerprint)
            (0, idempotency_js_1.recordIdempotency)(idem.key, idem.fingerprint, JSON.stringify(payload));
        return result(asText(payload));
    });
    registerTracedTool("testneo_trigger_playwright_execution", {
        description: "Trigger NLP execution via Playwright SDK execute endpoint (write tool, requires confirm + allow-write).",
        inputSchema: zod_1.z.object({
            project_id: zod_1.z.number().int().positive(),
            test_name: zod_1.z.string().min(1),
            nlp_commands: zod_1.z.array(zod_1.z.string().min(1)).min(1),
            mode: zod_1.z.enum(["strict", "balanced", "adaptive"]).default("balanced"),
            confirm: zod_1.z.boolean().default(false),
            idempotency_key: zod_1.z.string().min(8).max(128).optional(),
        }),
    }, async ({ project_id, test_name, nlp_commands, mode, confirm, idempotency_key }) => {
        if (!deps.allowWriteTools) {
            return result("Write tools are disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to enable trigger actions.");
        }
        if (!confirm) {
            return result("Execution not triggered: set confirm=true explicitly.");
        }
        const idem = replayOrConflict("testneo_trigger_playwright_execution", idempotency_key, {
            project_id,
            test_name,
            mode,
            nlp_commands,
        });
        if (idem.blocked)
            return idem.blocked;
        const routeRuntime = await runtimeForProjectRouteMap(project_id, deps.routeHardening);
        const routeMap = (0, routeHardening_js_1.resolvePhraseToPathMap)(routeRuntime);
        const blockedTrig = await gateProjectExecutable(project_id, {
            toolName: "testneo_trigger_playwright_execution",
            nlpCommands: nlp_commands,
            routeMap,
        });
        if (blockedTrig)
            return blockedTrig;
        const response = await client.request("/api/web/v1/playwright-sdk/execute", {
            method: "POST",
            body: {
                test_name,
                project_id,
                nlp_commands,
                options: { mode },
            },
        });
        if (idem.key && idem.fingerprint)
            (0, idempotency_js_1.recordIdempotency)(idem.key, idem.fingerprint, JSON.stringify(response));
        return result(asText(response));
    });
}
