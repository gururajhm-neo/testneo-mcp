import { z } from "zod";
import { execFile } from "node:child_process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  InMemoryWorkflowStore,
  ApiWorkflowStore,
  DataDrivenClaudeAnalyzer,
  PrValidationOrchestrator,
  createHttpIncidentContextAdapter,
  ValidatePrRequestSchema,
  type AffectedTestCandidate,
  type ImpactAnalysisAdapter,
  type ImpactAnalysisResult,
  type TestExecutionAdapter,
  type ValidatePrRequest,
  type VerificationFinding,
} from "../orchestration/index.js";
import { HttpClient, TestNeoApiError } from "../httpClient.js";
import { buildAgentFacingHttpEnvelope, summarizeTestNeoHttpError } from "../apiErrorHints.js";
import {
  buildProjectSettingsWithRouteMap,
  parseProjectRouteConfig,
  projectRouteSettingsKey,
  type ProjectRouteHardeningConfig,
} from "../projectRouteMap.js";
import {
  hardenNavigationCommands,
  resolvePhraseToPathMap,
  type RouteHardeningRuntimeConfig,
  type RouteHardeningToolOverride,
} from "../routeHardening.js";
import {
  normalizeContextQuery,
  resolveUnifiedContextByName,
  type UnifiedContextSummary,
} from "../unifiedContextDiscovery.js";
import { buildSuggestedNlpPatch, type FailureBundleLike } from "../failureNlpPatch.js";
import {
  isTerminalCanonicalStatus,
  normalizeExecutionItem,
  normalizeExecutionSummary,
  normalizeRawStatus,
  toCanonicalExecutionStatus,
} from "../executionContracts.js";
import { evaluatePreconditionPolicies, formatPolicyFailure, type PolicyMode } from "../policyEngine.js";
import { checkIdempotency, makeIdempotencyFingerprint, recordIdempotency } from "../idempotency.js";
import { recordToolDimensions, runWithToolTelemetry } from "../toolTelemetry.js";
import { ToolTextResult, ExecutionListItem } from "../types.js";
import {
  ingestEngineeringMemoryCsv,
  resolveBugCsvSource,
  wrapEngineeringMemoryCsv,
} from "../engineeringMemoryCsv.js";
import {
  ingestPostmortem,
  readPostmortemFromPath,
  wrapEngineeringMemoryPostmortem,
} from "../engineeringMemoryPostmortem.js";
import {
  ingestConfluencePage,
  wrapEngineeringMemoryConfluence,
} from "../engineeringMemoryConfluence.js";
import {
  syncJiraEngineeringMemory,
  wrapEngineeringMemoryJira,
} from "../engineeringMemoryJira.js";
import {
  buildExecutionUiNavigationForClient,
  buildMultiTestRunUiNavigationForClient,
  mergeTestExecutionLinksIntoMultiTestNav,
} from "../executionUiLinks.js";
import {
  decodeSwaggerUploadBase64,
  sha256Utf8,
  wrapSwaggerIntel,
} from "../swaggerIntel.js";
import {
  DeveloperReleaseWorkflowInputSchema,
  runDeveloperReleaseWorkflow,
} from "../developerReleaseWorkflow.js";

const routeHardeningToolSchema = z
  .object({
    enabled: z.boolean().optional(),
    profile: z.enum(["none", "saucedemo"]).optional(),
    extra_map: z.record(z.string(), z.string()).optional(),
  })
  .optional();

function resolveRouteMap(
  runtime: RouteHardeningRuntimeConfig,
  override?: z.infer<typeof routeHardeningToolSchema>
): Record<string, string> {
  return resolvePhraseToPathMap(runtime, override as RouteHardeningToolOverride | undefined);
}

function parseUnifiedContextListPayload(payload: unknown): UnifiedContextSummary[] {
  const raw = Array.isArray(payload) ? payload : [];
  const out: UnifiedContextSummary[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const idVal = r.id;
    const idNum = typeof idVal === "number" ? idVal : Number(idVal);
    if (!Number.isFinite(idNum) || idNum <= 0) continue;
    const nameStr = typeof r.name === "string" ? r.name : String(r.name ?? "");
    if (!nameStr.trim()) continue;
    out.push({
      id: idNum,
      name: nameStr,
      description: r.description === null || r.description === undefined ? undefined : String(r.description),
      context_type: typeof r.context_type === "string" ? r.context_type : undefined,
      entity_count: typeof r.entity_count === "number" ? r.entity_count : Number(r.entity_count) || undefined,
      relationship_count:
        typeof r.relationship_count === "number" ? r.relationship_count : Number(r.relationship_count) || undefined,
      ai_summary: typeof r.ai_summary === "string" ? r.ai_summary : r.ai_summary == null ? null : String(r.ai_summary),
      created_at: typeof r.created_at === "string" ? r.created_at : undefined,
      is_active: typeof r.is_active === "boolean" ? r.is_active : undefined,
    });
  }
  return out;
}

function unifiedContextsCompactLines(items: UnifiedContextSummary[], limit: number): string {
  if (!items.length) return "(no unified contexts)";
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

function asText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function validateSwaggerFilename(name: string): string | undefined {
  const n = name.trim().toLowerCase();
  if (!n.endsWith(".json") && !n.endsWith(".yaml") && !n.endsWith(".yml")) {
    return "swagger_filename must end with .json, .yaml, or .yml";
  }
  return undefined;
}

function validateOpenapiFilename(name: string): string | undefined {
  return validateSwaggerFilename(name);
}

function validateBusinessRulesFilename(name: string): string | undefined {
  const n = name.trim();
  if (n.length < 2) return "business_rules_filename is too short";
  return undefined;
}

const MAX_FIGMA_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

function validateFigmaImageFilename(name: string): string | undefined {
  const n = name.trim().toLowerCase();
  const ok = [".png", ".jpg", ".jpeg", ".gif", ".webp"].some((ext) => n.endsWith(ext));
  if (!ok) return "image_filename must end with .png, .jpg, .jpeg, .gif, or .webp";
  return undefined;
}

function mimeForImageFilename(name: string): string {
  const n = name.trim().toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

function result(text: string): ToolTextResult {
  return { content: [{ type: "text", text }] };
}

function normalizeImpactAnalysisPayload(payload: Record<string, unknown>): ImpactAnalysisResult {
  const rawAffectedTests = Array.isArray(payload.affected_tests) ? payload.affected_tests : [];
  const affectedTests = rawAffectedTests
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row))
    .map((row) => ({
      test_id:
        typeof row.test_id === "number"
          ? row.test_id
          : typeof row.id === "number"
            ? row.id
            : undefined,
      test_name: typeof row.test_name === "string" ? row.test_name : typeof row.name === "string" ? row.name : undefined,
      function_name: typeof row.function_name === "string" ? row.function_name : undefined,
      confidence:
        typeof row.confidence === "number"
          ? row.confidence
          : typeof row.confidence_score === "number"
            ? row.confidence_score
            : undefined,
      confidence_score: typeof row.confidence_score === "number" ? row.confidence_score : undefined,
      impact_level: typeof row.impact_level === "string" ? row.impact_level : undefined,
      reason: typeof row.reason === "string" ? row.reason : undefined,
    }));

  const recommendationsRaw = payload.recommendations;
  let recommendations: ImpactAnalysisResult["recommendations"];
  if (Array.isArray(recommendationsRaw)) {
    recommendations = recommendationsRaw.filter((v): v is string => typeof v === "string");
  } else if (recommendationsRaw && typeof recommendationsRaw === "object" && !Array.isArray(recommendationsRaw)) {
    recommendations = recommendationsRaw as Record<string, unknown>;
  } else {
    recommendations = undefined;
  }

  return {
    affectedTests,
    summary:
      payload.summary && typeof payload.summary === "object" && !Array.isArray(payload.summary)
        ? (payload.summary as Record<string, unknown>)
        : undefined,
    recommendations,
    source: "none",
  };
}

function stageRunStatusFromExecutionStatus(value: unknown): "queued" | "running" | "passed" | "failed" | "partial" {
  const canonical = toCanonicalExecutionStatus(value);
  switch (canonical) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "passed":
      return "passed";
    case "failed":
    case "cancelled":
      return "failed";
    default:
      return "partial";
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function buildValidatePrFindingFromExecution(args: {
  candidate: AffectedTestCandidate;
  pipeline: Record<string, unknown>;
  changedFileHints: string[];
  resolvedTestId: number | null;
}): VerificationFinding {
  const executionId = typeof args.pipeline.execution_id === "string" ? args.pipeline.execution_id : null;
  const uiNavigation =
    args.pipeline.ui_navigation && typeof args.pipeline.ui_navigation === "object" && !Array.isArray(args.pipeline.ui_navigation)
      ? (args.pipeline.ui_navigation as Record<string, unknown>)
      : {};
  const analyticsSummary =
    args.pipeline.analytics_summary && typeof args.pipeline.analytics_summary === "object" && !Array.isArray(args.pipeline.analytics_summary)
      ? (args.pipeline.analytics_summary as Record<string, unknown>)
      : {};
  const failureBundle =
    args.pipeline.failure_bundle && typeof args.pipeline.failure_bundle === "object" && !Array.isArray(args.pipeline.failure_bundle)
      ? (args.pipeline.failure_bundle as Record<string, unknown>)
      : {};
  const inferredRootCause =
    failureBundle.inferred_root_cause && typeof failureBundle.inferred_root_cause === "object" && !Array.isArray(failureBundle.inferred_root_cause)
      ? (failureBundle.inferred_root_cause as Record<string, unknown>)
      : {};

  const canonicalStatus = toCanonicalExecutionStatus(analyticsSummary.status ?? "unknown");
  const flow = args.candidate.function_name?.trim() || args.candidate.test_name?.trim() || "impacted-runtime-check";
  const titleName = args.candidate.test_name?.trim() || flow;
  const dashboardUrl = typeof uiNavigation.execution_dashboard_url === "string" ? uiNavigation.execution_dashboard_url : undefined;
  const errorMessage =
    typeof analyticsSummary.error_message === "string"
      ? analyticsSummary.error_message
      : typeof analyticsSummary.message === "string"
        ? analyticsSummary.message
        : undefined;
  const rootCauseTheme = typeof inferredRootCause.theme === "string" ? inferredRootCause.theme : undefined;
  const nextActions = asStringArray(inferredRootCause.nextActions);

  const status: VerificationFinding["status"] =
    canonicalStatus === "passed" ? "passed" : canonicalStatus === "failed" ? "failed" : "warning";
  const severity: VerificationFinding["severity"] =
    canonicalStatus === "passed"
      ? "info"
      : canonicalStatus === "failed"
        ? "high"
        : "medium";
  const issue =
    canonicalStatus === "passed"
      ? "Impacted runtime validation passed."
      : canonicalStatus === "failed"
        ? errorMessage || "Impacted runtime validation failed."
        : "Impacted runtime validation did not reach a clean terminal state.";

  return {
    id: executionId ? `finding-${executionId}` : `finding-${flow.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    source: "test" as const,
    status,
    severity,
    blocking: canonicalStatus === "failed",
    flow,
    title:
      canonicalStatus === "passed"
        ? `Impacted test passed: ${titleName}`
        : canonicalStatus === "failed"
          ? `Impacted test failed: ${titleName}`
          : `Impacted test needs review: ${titleName}`,
    issue,
    rootCauseHint: rootCauseTheme,
    changedFileHints: args.changedFileHints,
    relatedTestIds: args.resolvedTestId != null ? [args.resolvedTestId] : [],
    evidence: dashboardUrl
      ? [
          {
            id: executionId ?? `execution-${titleName}`,
            kind: "trace" as const,
            name: `Execution dashboard for ${titleName}`,
            url: dashboardUrl,
            flow,
            ...(args.resolvedTestId != null ? { testId: args.resolvedTestId } : {}),
            metadata: {
              execution_id: executionId,
              canonical_status: canonicalStatus,
            },
          },
        ]
      : [],
    replayUrl: dashboardUrl,
    suggestedFixes:
      canonicalStatus === "passed"
        ? ["No action required; impacted runtime validation passed."]
        : nextActions.length > 0
          ? nextActions
          : canonicalStatus === "failed"
            ? [
                "Open the execution dashboard and inspect the failed step details.",
                "Review the impacted code path and rerun validation after fixing the issue.",
              ]
            : [
                "Increase polling budget or inspect the live execution dashboard.",
                "Rerun validation if the execution was still starting.",
              ],
    confidence: args.candidate.confidence ?? args.candidate.confidence_score ?? (canonicalStatus === "passed" ? 0.9 : 0.75),
  };
}

function formatTestNeoApiFailure(e: unknown, opts?: { agentSetupUrl?: string }): ToolTextResult | null {
  if (!(e instanceof TestNeoApiError)) return null;
  let detail: unknown = e.body;
  try {
    detail = JSON.parse(e.body);
  } catch {
    /* keep raw string */
  }
  const hint = summarizeTestNeoHttpError(e.status, e.body);
  const envelope = buildAgentFacingHttpEnvelope(e.status, e.path, e.body, opts);
  const payload: Record<string, unknown> = {
    error: "testneo_api_error",
    http_status: e.status,
    path: e.path,
    detail,
    http_error_contract: envelope,
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

function compactExecution(items: ExecutionListItem[]): string {
  if (!items.length) return "No executions found.";
  const lines = items.map((x, idx) => {
    return `${idx + 1}. ${x.execution_id} | status=${x.status ?? "unknown"} | test=${x.test_case_name ?? "n/a"} | project=${x.project_id ?? "n/a"} | created=${x.created_at ?? "n/a"}`;
  });
  return lines.join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeStatus(value: unknown): string {
  return normalizeRawStatus(value);
}

function isPassedStatus(value: unknown): boolean {
  return toCanonicalExecutionStatus(value) === "passed";
}

function isFailedStatus(value: unknown): boolean {
  return toCanonicalExecutionStatus(value) === "failed";
}

function isTerminalStatus(value: unknown): boolean {
  return isTerminalCanonicalStatus(toCanonicalExecutionStatus(value));
}

function inferFailureTheme(logLikeText: string): { theme: string; confidence: "high" | "medium" | "low"; nextActions: string[] } {
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

type FailureBundleResult = {
  execution_id: string;
  summary: Record<string, unknown>;
  failure_signals: {
    failed_event_count: number;
    total_event_count: number;
    log_count: number;
  };
  failed_event_sample: Array<Record<string, unknown>>;
  log_sample: Array<Record<string, unknown>>;
  inferred_root_cause: {
    theme: string;
    confidence: "high" | "medium" | "low";
    nextActions: string[];
  };
  suggested_nlp_patch?: ReturnType<typeof buildSuggestedNlpPatch>;
};

function extractNlpCommandsFromGeneratedTest(test: Record<string, unknown>): string[] {
  const possible =
    (test.nlp_commands as unknown) ??
    (test.steps as unknown) ??
    (test.commands as unknown) ??
    (test.test_steps as unknown);
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

function buildPlaywrightSpecTs(testName: string, nlpCommands: string[]): string {
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

function parseNlpFromPlaywrightSpec(specTs: string): string[] {
  const runMatch = specTs.match(/ai\.run\s*\(\s*\[([\s\S]*?)\]\s*,/m);
  if (!runMatch) return [];
  const arrBody = runMatch[1];
  const commands: string[] = [];
  const regex = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
  let m: RegExpExecArray | null = regex.exec(arrBody);
  while (m) {
    const raw = (m[1] ?? m[2] ?? "").replace(/\\n/g, "\n").replace(/\\"/g, "\"").replace(/\\'/g, "'");
    if (raw.trim()) commands.push(raw.trim());
    m = regex.exec(arrBody);
  }
  return commands;
}

function buildAuthPreamble(
  auth:
    | undefined
    | {
        enabled?: boolean;
        preset?: "saucedemo" | "custom";
        commands?: string[];
      }
): string[] {
  if (!auth || auth.enabled === false) return [];
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

function withAuthPreamble(nlpCommands: string[], preamble: string[]): string[] {
  if (!preamble.length) return nlpCommands;
  const existing = nlpCommands.map((x) => x.toLowerCase());
  const looksLikeHasLogin =
    existing.some((x) => x.includes("fill username")) &&
    existing.some((x) => x.includes("fill password")) &&
    existing.some((x) => x.includes("login"));
  if (looksLikeHasLogin) return nlpCommands;
  return [...preamble, ...nlpCommands];
}

async function fetchRecentExecutionsWithFallback(
  client: HttpClient,
  params: {
    project_id?: number;
    status_filter?: string;
    release?: string;
    build?: string;
    range?: "1d" | "7d" | "30d" | "90d";
    limit: number;
    offset: number;
  }
): Promise<{ executions: ExecutionListItem[]; total: number; source: "executions_list" | "analytics_executions" }> {
  const primary = await client.request<{ executions: ExecutionListItem[]; total: number }>(
    "/api/web/v1/executions/list",
    {
      query: {
        project: params.project_id,
        status_filter: params.status_filter,
        release: params.release,
        build: params.build,
        limit: params.limit,
        offset: params.offset,
      },
    }
  );

  const primaryItems = primary.executions || [];
  if (primaryItems.length > 0) {
    const normalized = primaryItems.map((x) => normalizeExecutionItem(x));
    return {
      executions: normalized,
      total: primary.total ?? normalized.length,
      source: "executions_list",
    };
  }

  const analytics = await client.request<{ executions: ExecutionListItem[]; total: number }>(
    "/api/web/v1/analytics/executions",
    {
      query: {
        project: params.project_id,
        release: params.release,
        build: params.build,
        range: params.range ?? "30d",
      },
    }
  );

  let items = (analytics.executions || []).map((x) => normalizeExecutionItem(x));
  if (params.status_filter) {
    const wanted = normalizeStatus(params.status_filter);
    if (wanted === "failed" || wanted === "error") {
      items = items.filter((x) => isFailedStatus(x.status));
    } else if (wanted === "passed" || wanted === "success" || wanted === "completed") {
      items = items.filter((x) => isPassedStatus(x.status));
    } else {
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

async function enrichBundleWithNlpPatch(
  client: HttpClient,
  bundle: FailureBundleResult,
  routeHardening: RouteHardeningRuntimeConfig
): Promise<FailureBundleResult> {
  let baselineNlp: string[] | null = null;
  const tid = bundle.summary?.test_case_id;
  const testCaseNum = typeof tid === "number" ? tid : tid !== undefined ? Number(tid) : NaN;
  if (Number.isFinite(testCaseNum) && testCaseNum > 0) {
    try {
      const tc = await client.request<Record<string, unknown>>(`/api/web/v1/test-cases/${encodeURIComponent(String(testCaseNum))}`);
      baselineNlp = extractNlpCommandsFromGeneratedTest(tc);
    } catch {
      baselineNlp = null;
    }
  }
  const patch = buildSuggestedNlpPatch(bundle as FailureBundleLike, baselineNlp && baselineNlp.length ? baselineNlp : null, {
    routeProfile: routeHardening.profile,
    routeEnvCustomMap: routeHardening.customMap,
    suggestRouteHardenNav: routeHardening.enabled,
  });
  return { ...bundle, suggested_nlp_patch: patch };
}

async function buildFailureBundle(
  client: HttpClient,
  execution_id: string,
  logs_limit: number,
  event_limit: number
): Promise<FailureBundleResult> {
  const [summary, eventsResponse, logsResponse] = await Promise.all([
    client.request<Record<string, unknown>>(
      `/api/web/v1/analytics/execution/${encodeURIComponent(execution_id)}/summary`
    ),
    client.request<{ events?: Array<Record<string, unknown>> }>(
      `/api/web/v1/analytics/execution/${encodeURIComponent(execution_id)}/events`
    ),
    client.request<{ logs?: Array<Record<string, unknown>> }>(
      `/api/web/v1/executions/${encodeURIComponent(execution_id)}/logs`,
      { query: { limit: logs_limit, offset: 0 } }
    ),
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

function extractExecutionIdFromExecuteResponse(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const r = response as Record<string, unknown>;
  const direct = r.execution_id;
  if (typeof direct === "string" && direct.length >= 6) return direct;
  const data = r.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const nested = (data as Record<string, unknown>).execution_id;
    if (typeof nested === "string" && nested.length >= 6) return nested;
  }
  return null;
}

async function buildPassFailTrendPayload(
  client: HttpClient,
  project_id: number,
  range: "1d" | "7d" | "30d" | "90d",
  limit: number
): Promise<Record<string, unknown>> {
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
  const firstHalfPassRate =
    firstHalf.length > 0 ? (firstHalf.filter((x) => isPassedStatus(x.status)).length / firstHalf.length) * 100 : 0;
  const secondHalfPassRate =
    secondHalf.length > 0
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
      canonical_status: toCanonicalExecutionStatus(x.status),
      test_case_name: x.test_case_name ?? null,
      created_at: x.created_at ?? null,
    })),
  };
}

type ExecutionPipelineOpts = {
  max_polls: number;
  poll_interval_ms: number;
  include_steps: boolean;
  include_failure_bundle_on_fail: boolean;
  failure_logs_limit: number;
  failure_event_limit: number;
  include_nlp_patch_in_bundle: boolean;
  routeHardening: RouteHardeningRuntimeConfig;
  include_project_trend: boolean;
  trend_range: "1d" | "7d" | "30d" | "90d";
  trend_limit: number;
  /** When analytics/execution payloads omit project_id, use this (e.g. from GET test-cases/{id}). */
  project_id_fallback?: number;
};

async function runExecutionReportPipeline(
  client: HttpClient,
  execution_id: string,
  opts: ExecutionPipelineOpts
): Promise<Record<string, unknown>> {
  const timeline: Array<Record<string, unknown>> = [];
  let finalSummary: Record<string, unknown> | null = null;

  for (let attempt = 1; attempt <= opts.max_polls; attempt += 1) {
    const summary = await client.request<Record<string, unknown>>(
      `/api/web/v1/analytics/execution/${encodeURIComponent(execution_id)}/summary`
    );
    const status = normalizeStatus(summary.status);
    finalSummary = normalizeExecutionSummary(summary);
    timeline.push({
      poll: attempt,
      status: summary.status ?? "unknown",
      canonical_status: toCanonicalExecutionStatus(status),
      completed_steps: summary.completed_steps ?? 0,
      failed_steps: summary.failed_steps ?? 0,
      total_steps: summary.total_steps ?? 0,
      duration_ms: summary.duration_ms ?? 0,
    });
    if (isTerminalStatus(status)) break;
    await sleep(opts.poll_interval_ms);
  }

  const statusResp = await client.request<Record<string, unknown>>(
    `/api/web/v1/playwright-sdk/executions/${encodeURIComponent(execution_id)}`,
    { query: { include_steps: opts.include_steps } }
  );
  const data = statusResp.data;
  const executionNormalized =
    data && typeof data === "object" && !Array.isArray(data)
      ? normalizeExecutionSummary(data as Record<string, unknown>)
      : normalizeExecutionSummary(statusResp);

  let failure_bundle: FailureBundleResult | null = null;
  if (opts.include_failure_bundle_on_fail && isFailedStatus(finalSummary?.status)) {
    const bundle = await buildFailureBundle(client, execution_id, opts.failure_logs_limit, opts.failure_event_limit);
    failure_bundle =
      opts.include_nlp_patch_in_bundle !== false
        ? await enrichBundleWithNlpPatch(client, bundle, opts.routeHardening)
        : bundle;
  }

  let project_trend: Record<string, unknown> | null = null;
  if (opts.include_project_trend) {
    const rawPid =
      (executionNormalized as Record<string, unknown>).project_id ??
      (finalSummary as Record<string, unknown> | null)?.project_id ??
      opts.project_id_fallback;
    const projectNum = typeof rawPid === "number" ? rawPid : Number(rawPid);
    if (Number.isFinite(projectNum) && projectNum > 0) {
      project_trend = await buildPassFailTrendPayload(client, projectNum, opts.trend_range, opts.trend_limit);
    }
  }

  return {
    contract_version: "execution_pipeline.v1",
    execution_id,
    ui_navigation: buildExecutionUiNavigationForClient(client, execution_id),
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
      headline:
        finalSummary && isPassedStatus(finalSummary.status)
          ? "Run finished successfully."
          : finalSummary && isFailedStatus(finalSummary.status)
            ? "Run failed — use failure_bundle and execution.steps for triage."
            : isTerminalStatus(finalSummary?.status)
              ? "Run reached a terminal state."
              : "Run did not reach a terminal status within the poll budget — increase max_polls or poll_interval_ms, or open ui_navigation.execution_dashboard_url for live app status.",
      note: "This payload replaces chaining testneo_execute_generated_test_case → testneo_watch_execution → testneo_get_execution_status → testneo_get_execution_summary. For local-agent runs, analytics may lag; use ui_navigation for the in-app execution view.",
      recommended_next_tools: isFailedStatus(finalSummary?.status)
        ? ["testneo_update_test_case_nlp (review suggested_nlp_patch in failure_bundle)", "testneo_rerun_failed"]
        : isPassedStatus(finalSummary?.status)
          ? []
          : ["testneo_get_execution_logs", "testneo_get_failure_bundle"],
    },
  };
}

async function waitForEtlJobCompletion(
  client: HttpClient,
  jobId: string,
  maxPolls: number,
  pollIntervalMs: number
): Promise<Record<string, unknown>> {
  let last: Record<string, unknown> = {};
  for (let attempt = 1; attempt <= maxPolls; attempt += 1) {
    const job = await client.request<Record<string, unknown>>(`/api/v1/etl/jobs/${encodeURIComponent(jobId)}`);
    last = job;
    const status = normalizeStatus(job.status);
    if (status === "completed" || status === "failed") return job;
    await sleep(pollIntervalMs);
  }
  return last;
}

export function registerTools(
  server: McpServer,
  deps: {
    client: HttpClient;
    allowWriteTools: boolean;
    relaxProjectPreconditions: boolean;
    policyMode: PolicyMode;
    routeHardening: RouteHardeningRuntimeConfig;
    batchExecutionDefaults: {
      defaultExecutionMode: "local" | "cloud";
      defaultExecutionPlatform: string;
      preferLocalAgent: boolean;
      requireLocalAgentForBatch: boolean;
      waitForAgentMs: number;
      openAgentSetupOnAgentFailure: boolean;
    };
  }
): void {
  const { client, batchExecutionDefaults } = deps;
  const agentSetupUrl = `${client.getBaseUrl()}/web/agent`;
  // Use API-backed persistent store; falls back to in-memory on any network error
  const workflowStore = new ApiWorkflowStore(client);
  const incidentContextAdapter = createHttpIncidentContextAdapter(client);

  /**
   * Fetches historical risk signals (failure rates, flakiness) for affected test IDs
   * from the /api/web/v1/code-impact/risk-signals endpoint and merges them back
   * into the AffectedTestCandidate array. Fails silently — enrichment is best-effort.
   */
  /**
   * Sprint 1: Fetches per-test historical failure rates from risk-signals endpoint.
   * Sprint 2: Also merges component_label from the signal response.
   *
   * Fails silently — enrichment is best-effort and must never block validation.
   */
  async function enrichWithRiskSignals(
    projectId: number,
    result: import("../orchestration/contracts.js").ImpactAnalysisResult,
  ): Promise<import("../orchestration/contracts.js").ImpactAnalysisResult> {
    const testIds = result.affectedTests
      .map((t) => t.test_id)
      .filter((id): id is number => typeof id === "number" && id > 0);

    if (!testIds.length) return result;

    try {
      const riskResp = await client.request<Record<string, unknown>>(
        "/api/web/v1/code-impact/risk-signals",
        {
          query: { project_id: projectId, test_ids: testIds.join(",") },
          timeoutMs: 8000,
        },
      );
      const signals = Array.isArray(riskResp?.signals)
        ? (riskResp.signals as Array<Record<string, unknown>>)
        : [];
      const signalMap = new Map(signals.map((s) => [Number(s.test_id), s]));

      return {
        ...result,
        affectedTests: result.affectedTests.map((t) => {
          const sig = t.test_id !== undefined ? signalMap.get(t.test_id) : undefined;
          if (!sig) return t;
          return {
            ...t,
            failure_rate_7d: typeof sig.failure_rate_7d === "number" ? sig.failure_rate_7d : undefined,
            failure_rate_30d: typeof sig.failure_rate_30d === "number" ? sig.failure_rate_30d : undefined,
            flakiness_score: typeof sig.flakiness_score === "number" ? sig.flakiness_score : undefined,
            recent_failure_count: typeof sig.recent_failure_count === "number" ? sig.recent_failure_count : undefined,
            // Sprint 2: component_label from TestFunctionMapping via ComponentExtractor
            component_label: typeof sig.component_label === "string" ? sig.component_label : t.component_label,
          };
        }),
      };
    } catch {
      return result;
    }
  }

  /**
   * Sprint 2: Fetches project-level component failure summary.
   * Returns the component health array to be passed into computeRiskScore's
   * component_history factor.  Fails silently.
   */
  async function fetchComponentHealth(
    projectId: number,
  ): Promise<import("../orchestration/contracts.js").ComponentHealthEntry[]> {
    try {
      const resp = await client.request<Record<string, unknown>>(
        "/api/web/v1/code-impact/component-failure-summary",
        {
          query: { project_id: projectId },
          timeoutMs: 8000,
        },
      );
      const components = Array.isArray(resp?.components) ? resp.components : [];
      return components as import("../orchestration/contracts.js").ComponentHealthEntry[];
    } catch {
      // Component health enrichment is best-effort
      return [];
    }
  }

  /**
   * Sprint 3 (complete flow):
   * Fetches transitive dependency blast radius AND discovers tests for all
   * expanded files (blast → test bridge).
   *
   * Returns:
   *   - DependencyBlast: the graph snapshot (nodes, depths, components)
   *   - blastTestCandidates: tests covering expanded files, with depth-adjusted confidence
   *
   * Fails silently — both are best-effort enrichment.
   */
  async function fetchDependencyBlast(
    projectId: number,
    changedFiles: Array<{ path: string }>,
  ): Promise<{
    blast: import("../orchestration/contracts.js").DependencyBlast | undefined;
    blastTestCandidates: import("../orchestration/contracts.js").AffectedTestCandidate[];
    blastTestSummary: Record<string, number> | undefined;
  }> {
    if (!changedFiles.length) return { blast: undefined, blastTestCandidates: [], blastTestSummary: undefined };
    try {
      const resp = await client.request<Record<string, unknown>>(
        "/api/web/v1/code-impact/dependency-blast",
        {
          method: "POST" as const,
          body: {
            project_id: projectId,
            changed_files: changedFiles.map((f) => f.path),
            max_depth: 2,
            include_tests: true,
          },
          timeoutMs: 12000,
        },
      );
      if (!resp || typeof resp !== "object") {
        return { blast: undefined, blastTestCandidates: [], blastTestSummary: undefined };
      }

      const blast: import("../orchestration/contracts.js").DependencyBlast = {
        changed_files: Array.isArray(resp.changed_files) ? (resp.changed_files as string[]) : [],
        expanded_files: Array.isArray(resp.expanded_files) ? (resp.expanded_files as string[]) : [],
        nodes: Array.isArray(resp.nodes) ? (resp.nodes as import("../orchestration/contracts.js").DependencyNode[]) : [],
        direct_dependents: typeof resp.direct_dependents === "number" ? resp.direct_dependents : 0,
        transitive_dependents: typeof resp.transitive_dependents === "number" ? resp.transitive_dependents : 0,
        total_expanded: typeof resp.total_expanded === "number" ? resp.total_expanded : 0,
        max_depth: typeof resp.max_depth === "number" ? resp.max_depth : 0,
        affected_components: (typeof resp.blast_summary === "object" && resp.blast_summary !== null)
          ? ((resp.blast_summary as Record<string, unknown>).affected_components as Record<string, number> | undefined)
          : undefined,
        has_structure: resp.has_structure === true,
      };

      // Normalise blast_test_candidates from the API response
      const rawCandidates = Array.isArray(resp.blast_test_candidates)
        ? (resp.blast_test_candidates as Array<Record<string, unknown>>)
        : [];

      const blastTestCandidates: import("../orchestration/contracts.js").AffectedTestCandidate[] =
        rawCandidates.map((c) => ({
          test_id: typeof c.test_id === "number" ? c.test_id : undefined,
          test_name: typeof c.test_name === "string" ? c.test_name : undefined,
          function_name: typeof c.function_name === "string" ? c.function_name : undefined,
          confidence: typeof c.confidence === "number" ? c.confidence : 0.5,
          confidence_score: typeof c.confidence === "number" ? c.confidence : 0.5,
          impact_level: (c.risk_level === "HIGH" ? "high" : c.risk_level === "MEDIUM" ? "medium" : "low"),
          // reason encodes the blast chain
          reason: `Transitive: ${c.file_path ?? ""} imports changed files (depth ${c.depth ?? "?"})`,
          failure_rate_7d: typeof c.failure_rate_7d === "number" ? c.failure_rate_7d : undefined,
          failure_rate_30d: typeof c.failure_rate_30d === "number" ? c.failure_rate_30d : undefined,
          flakiness_score: typeof c.flakiness_score === "number" ? c.flakiness_score : undefined,
          component_label: typeof c.component_label === "string" ? c.component_label : undefined,
          // Sprint 3 blast provenance fields
          blast_source: typeof c.blast_source === "string" ? (c.blast_source as import("../orchestration/contracts.js").AffectedTestCandidate["blast_source"]) : undefined,
          blast_depth: typeof c.depth === "number" ? c.depth : undefined,
          blast_file_path: typeof c.file_path === "string" ? c.file_path : undefined,
        }));

      const rawSummary = resp.blast_test_summary;
      const blastTestSummary = (typeof rawSummary === "object" && rawSummary !== null)
        ? rawSummary as Record<string, number>
        : undefined;

      return { blast, blastTestCandidates, blastTestSummary };
    } catch {
      return { blast: undefined, blastTestCandidates: [], blastTestSummary: undefined };
    }
  }

  /**
   * Merges blast test candidates into the main affectedTests list.
   *
   * Rules:
   *   - Skip blast candidates whose test_id already appears in directTests
   *     (avoids double-counting tests found both ways)
   *   - Blast candidates get blast_source + blast_depth set
   *   - Sorted: direct first (higher confidence), then transitive by depth
   */
  function mergeBlastCandidates(
    directTests: import("../orchestration/contracts.js").AffectedTestCandidate[],
    blastCandidates: import("../orchestration/contracts.js").AffectedTestCandidate[],
  ): import("../orchestration/contracts.js").AffectedTestCandidate[] {
    const directIds = new Set(
      directTests.map((t) => t.test_id).filter((id): id is number => typeof id === "number")
    );

    // Tag direct tests as blast_source="direct" if not already tagged
    const taggedDirect = directTests.map((t) => ({
      ...t,
      blast_source: t.blast_source ?? ("direct" as const),
      blast_depth: t.blast_depth ?? 0,
    }));

    // Filter blast candidates to exclude already-found tests
    const newBlast = blastCandidates.filter(
      (c) => c.test_id === undefined || !directIds.has(c.test_id)
    );

    // Merge and sort: direct first, then by depth ascending, then by confidence descending
    return [
      ...taggedDirect,
      ...newBlast.sort((a, b) => {
        const depthDiff = (a.blast_depth ?? 1) - (b.blast_depth ?? 1);
        if (depthDiff !== 0) return depthDiff;
        return (b.confidence ?? 0) - (a.confidence ?? 0);
      }),
    ];
  }

  const impactAnalyzer: ImpactAnalysisAdapter = {
    analyze: async (request: ValidatePrRequest) => {
      // Sprint 2+3: all enrichment fetched in parallel with impact analysis
      // (all best-effort — never block validation on failure)
      const changedFiles = request.git.changed_files ?? [];
      const componentHealthPromise = fetchComponentHealth(request.project_id);
      const dependencyBlastPromise = fetchDependencyBlast(request.project_id, changedFiles);

      let base: import("../orchestration/contracts.js").ImpactAnalysisResult;

      if (request.git.diff_content?.trim()) {
        const response = await client.request<Record<string, unknown>>("/api/web/v1/code-impact/analyze/manual", {
          method: "POST",
          query: { project_id: request.project_id },
          body: { diff_content: request.git.diff_content },
          timeoutMs: client.longRequestTimeoutMs,
        });
        base = { ...normalizeImpactAnalysisPayload(response), source: "manual_diff" as const };
      } else {
        const response = await client.request<Record<string, unknown>>("/api/web/v1/code-impact/analyze", {
          method: "POST",
          query: { project_id: request.project_id },
          body: {
            base_ref: request.git.base_sha,
            head_ref: request.git.head_sha,
          },
          timeoutMs: client.longRequestTimeoutMs,
        });
        base = { ...normalizeImpactAnalysisPayload(response), source: "git_refs" as const };
      }

      // Enrich per-test signals (failure rates, component labels)
      const enriched = await enrichWithRiskSignals(request.project_id, base);

      // Resolve parallel enrichment
      const [componentHealth, { blast: dependencyBlast, blastTestCandidates, blastTestSummary }] =
        await Promise.all([componentHealthPromise, dependencyBlastPromise]);

      // Merge blast test candidates into affected tests
      const mergedTests = mergeBlastCandidates(enriched.affectedTests, blastTestCandidates);

      return {
        ...enriched,
        affectedTests: mergedTests,
        componentHealth,
        dependencyBlast,
        // Store blast summary for orchestrator to persist in metadata
        ...(blastTestSummary ? { blastTestSummary } : {}),
      } as import("../orchestration/contracts.js").ImpactAnalysisResult & { blastTestSummary?: Record<string, number> };
    },
  };
  const testExecutionAdapter: TestExecutionAdapter = {
    execute: async ({ request, affectedTests }) => {
      const changedFileHints = (request.git.changed_files ?? []).map((file) => file.path);
      const startedAt = new Date().toISOString();
      const findings: VerificationFinding[] = [];
      const artifacts: VerificationFinding["evidence"] = [];
      const executionIds: string[] = [];
      const unresolved: Array<{ test_name?: string; function_name?: string; reason: string }> = [];
      const staleMappings: Array<{ test_case_id: number; test_name?: string; reason: string }> = [];
      const uniqueCandidates = new Map<string, AffectedTestCandidate>();

      for (const candidate of affectedTests) {
        const key =
          candidate.test_id != null
            ? `id:${candidate.test_id}`
            : candidate.test_name?.trim()
              ? `name:${candidate.test_name.trim().toLowerCase()}`
              : candidate.function_name?.trim()
                ? `function:${candidate.function_name.trim().toLowerCase()}`
                : null;
        if (!key || uniqueCandidates.has(key)) continue;
        uniqueCandidates.set(key, candidate);
      }

      const useAgent = shouldPostUseAgentToExecuteApi();
      const executionMode =
        request.execution?.mode ?? batchExecutionDefaults.defaultExecutionMode;
      const executionPlatform =
        request.execution?.platform ?? batchExecutionDefaults.defaultExecutionPlatform;
      for (const candidate of uniqueCandidates.values()) {
        let resolvedTestId =
          typeof candidate.test_id === "number" && Number.isFinite(candidate.test_id) && candidate.test_id > 0
            ? candidate.test_id
            : null;

        if (resolvedTestId == null && candidate.test_name?.trim()) {
          const resolved = await resolveTestCaseIdForExecuteInput({
            project_id: request.project_id,
            name_query: candidate.test_name.trim(),
            name_match_mode: "auto",
          });
          if (resolved.ok) {
            resolvedTestId = resolved.test_case_id;
          }
        }

        if (resolvedTestId == null) {
          unresolved.push({
            test_name: candidate.test_name,
            function_name: candidate.function_name,
            reason: "Could not resolve impacted test to a runnable test case ID.",
          });
          const unresolvedFinding: VerificationFinding = {
            id: `finding-unresolved-${(candidate.test_name ?? candidate.function_name ?? "test").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
            source: "test",
            status: "warning",
            severity: "medium",
            blocking: false,
            flow: candidate.function_name?.trim() || candidate.test_name?.trim() || "impacted-runtime-check",
            title: `Impacted test needs manual resolution: ${candidate.test_name?.trim() || candidate.function_name?.trim() || "unknown"}`,
            issue: "Impact analysis identified a test candidate, but the orchestrator could not resolve a runnable test case ID.",
            changedFileHints,
            relatedTestIds: [],
            evidence: [],
            suggestedFixes: [
              "Review the impacted test mapping for this project.",
              "Resolve the test case manually and rerun validate_pr.",
            ],
            confidence: candidate.confidence ?? candidate.confidence_score ?? 0.5,
          };
          findings.push(unresolvedFinding);
          continue;
        }

        let executeResponse: Record<string, unknown>;
        try {
          executeResponse = await client.request<Record<string, unknown>>(
            `/api/web/v1/test-cases/${encodeURIComponent(String(resolvedTestId))}/execute`,
            {
              method: "POST",
              body: {
                execution_source: "mcp_validate_pr",
                trigger_reason: "orchestrated_pr_validation",
                execution_mode: executionMode,
                execution_platform: executionPlatform,
                ...(useAgent ? { use_agent: true } : {}),
              },
              timeoutMs: client.longRequestTimeoutMs,
            }
          );
        } catch (error) {
          if (error instanceof TestNeoApiError && error.status === 404) {
            staleMappings.push({
              test_case_id: resolvedTestId,
              test_name: candidate.test_name,
              reason: "Impact analysis returned a test case ID that is no longer executable.",
            });
            findings.push({
              id: `finding-stale-${resolvedTestId}`,
              source: "test",
              status: "warning",
              severity: "medium",
              blocking: false,
              flow: candidate.function_name?.trim() || candidate.test_name?.trim() || "impacted-runtime-check",
              title: `Stale impacted test mapping: ${candidate.test_name?.trim() || resolvedTestId}`,
              issue: `Test case ${resolvedTestId} was returned by impact analysis but the execution API reported it as not found.`,
              rootCauseHint: "Project test mappings may be stale or point to deleted test cases.",
              changedFileHints,
              relatedTestIds: [resolvedTestId],
              evidence: [],
              suggestedFixes: [
                "Recreate or refresh code-impact mappings for this project.",
                "Remove stale test case IDs from mapping tables before rerunning validate_pr.",
              ],
              confidence: candidate.confidence ?? candidate.confidence_score ?? 0.7,
            });
            continue;
          }
          throw error;
        }

        const executionId = extractExecutionIdFromExecuteResponse(executeResponse);
        if (!executionId) {
          throw new Error(`Could not read execution_id from execute response for test_case_id=${resolvedTestId}`);
        }
        executionIds.push(executionId);

        const pipeline = await runExecutionReportPipeline(client, executionId, {
          max_polls: 20,
          poll_interval_ms: 1500,
          include_steps: true,
          include_failure_bundle_on_fail: false,
          failure_logs_limit: 120,
          failure_event_limit: 20,
          include_nlp_patch_in_bundle: false,
          routeHardening: deps.routeHardening,
          include_project_trend: false,
          trend_range: "30d",
          trend_limit: 100,
          project_id_fallback: request.project_id,
        });

        const finding = buildValidatePrFindingFromExecution({
          candidate,
          pipeline,
          changedFileHints,
          resolvedTestId,
        });
        findings.push(finding);
        artifacts.push(...finding.evidence);
      }

      const hasFailed = findings.some((finding) => finding.status === "failed");
      const hasWarnings = findings.some((finding) => finding.status === "warning");
      const stageStatus = hasFailed ? "failed" : hasWarnings ? "partial" : "passed";

      return {
        stageRun: {
          stage: "tests",
          status: stageStatus,
          startedAt,
          completedAt: new Date().toISOString(),
          executionIds,
          dashboardUrl: artifacts[0]?.url,
        },
        findings,
        artifacts,
        suggestedFixes: findings.flatMap((finding) => finding.suggestedFixes),
        metadata: {
          executed_test_count: executionIds.length,
          unresolved_candidates: unresolved,
          stale_mappings: staleMappings,
          requested_candidate_count: uniqueCandidates.size,
          routing: {
            use_agent: useAgent,
          },
        },
      };
    },
  };

  function formatApiFailure(e: unknown): ToolTextResult | null {
    return formatTestNeoApiFailure(e, { agentSetupUrl });
  }

  function normalizeMcpTagList(tags: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of tags) {
      const t = raw.trim().replace(/^@+/, "").trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }

  type ListedWebCase = { id: number; name: string; tags: string[] };

  async function listAllTestCasesForTag(projectId: number, tag: string): Promise<ListedWebCase[]> {
    const out: ListedWebCase[] = [];
    let skip = 0;
    const limit = 1000;
    for (;;) {
      const resp = await client.request<Record<string, unknown>>("/api/web/v1/test-cases/", {
        query: { project_id: projectId, tag_filter: tag, limit, skip },
      });
      const items = parseListedWebCasesFromResponse(resp);
      const total = typeof resp.total === "number" ? resp.total : skip + items.length;
      out.push(...items);
      skip += items.length;
      if (skip >= total || items.length === 0) break;
    }
    return out;
  }

  async function resolveTestCasesByTags(
    projectId: number,
    normalizedTags: string[],
    mode: "any" | "all"
  ): Promise<{ cases: ListedWebCase[]; per_tag: Record<string, ListedWebCase[]> }> {
    const per_tag: Record<string, ListedWebCase[]> = {};
    for (const tag of normalizedTags) {
      per_tag[tag] = await listAllTestCasesForTag(projectId, tag);
    }
    if (mode === "any") {
      const byId = new Map<number, ListedWebCase>();
      for (const tag of normalizedTags) {
        for (const c of per_tag[tag] ?? []) {
          if (!byId.has(c.id)) byId.set(c.id, c);
        }
      }
      return { cases: [...byId.values()], per_tag };
    }
    const sets = normalizedTags.map((t) => new Set((per_tag[t] ?? []).map((c) => c.id)));
    if (!sets.length) return { cases: [], per_tag };
    let intersection = sets[0]!;
    for (let i = 1; i < sets.length; i++) {
      const next = new Set<number>();
      for (const id of intersection) {
        if (sets[i]!.has(id)) next.add(id);
      }
      intersection = next;
    }
    const byId = new Map<number, ListedWebCase>();
    for (const tag of normalizedTags) {
      for (const c of per_tag[tag] ?? []) {
        if (intersection.has(c.id)) byId.set(c.id, c);
      }
    }
    return { cases: [...byId.values()], per_tag };
  }

  function parseListedWebCasesFromResponse(resp: Record<string, unknown>): ListedWebCase[] {
    const itemsRaw = Array.isArray(resp.items) ? resp.items : [];
    const items: ListedWebCase[] = [];
    for (const row of itemsRaw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "number" ? r.id : Number(r.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      const name = typeof r.name === "string" ? r.name : String(r.name ?? "");
      const tagList = Array.isArray(r.tags) ? r.tags.map((t) => String(t)) : [];
      items.push({ id, name, tags: tagList });
    }
    return items;
  }

  async function listTestCasesSearchAllPages(projectId: number, search: string, maxRows: number): Promise<ListedWebCase[]> {
    const all: ListedWebCase[] = [];
    let skip = 0;
    const limit = 100;
    for (;;) {
      const resp = await client.request<Record<string, unknown>>("/api/web/v1/test-cases/", {
        query: { project_id: projectId, search, limit, skip },
      });
      const items = parseListedWebCasesFromResponse(resp);
      const total = typeof resp.total === "number" ? resp.total : skip + items.length;
      all.push(...items);
      skip += items.length;
      if (skip >= total || items.length === 0 || all.length >= maxRows) break;
    }
    return all;
  }

  type ResolveByNameOk = {
    ok: true;
    test_case_id: number;
    name: string;
    resolution: "exact_name" | "unique_name_substring";
  };
  type ResolveByNameErr = {
    ok: false;
    error: "ambiguous_name" | "no_match" | "invalid_name_query";
    message: string;
    candidates?: ListedWebCase[];
  };

  async function resolveTestCaseByNameQuery(
    projectId: number,
    rawQuery: string,
    mode: "auto" | "exact" | "substring"
  ): Promise<ResolveByNameOk | ResolveByNameErr> {
    const nameQuery = rawQuery.trim();
    if (!nameQuery) {
      return { ok: false, error: "invalid_name_query", message: "name_query is empty after trim." };
    }
    const needle = nameQuery.toLowerCase();
    const rows = await listTestCasesSearchAllPages(projectId, nameQuery, 2000);
    const exact = rows.filter((c) => c.name.trim().toLowerCase() === needle);
    const byNameSub = rows.filter((c) => c.name.toLowerCase().includes(needle));

    if (mode === "exact") {
      if (exact.length === 1) {
        const c = exact[0]!;
        return { ok: true, test_case_id: c.id, name: c.name, resolution: "exact_name" };
      }
      if (exact.length === 0) {
        return {
          ok: false,
          error: "no_match",
          message: `No test case in project ${projectId} has name exactly matching "${nameQuery}".`,
          candidates: byNameSub.slice(0, 25),
        };
      }
      return {
        ok: false,
        error: "ambiguous_name",
        message: `Multiple test cases have the exact name "${nameQuery}". Use test_case_id.`,
        candidates: exact,
      };
    }

    if (mode === "substring") {
      if (byNameSub.length === 1) {
        const c = byNameSub[0]!;
        return { ok: true, test_case_id: c.id, name: c.name, resolution: "unique_name_substring" };
      }
      if (byNameSub.length === 0) {
        return {
          ok: false,
          error: "no_match",
          message: `No test case name in project ${projectId} contains "${nameQuery}".`,
          candidates: rows.slice(0, 25),
        };
      }
      return {
        ok: false,
        error: "ambiguous_name",
        message: `Multiple test cases match name substring "${nameQuery}". Narrow name_query or use test_case_id.`,
        candidates: byNameSub.slice(0, 25),
      };
    }

    if (exact.length === 1) {
      const c = exact[0]!;
      return { ok: true, test_case_id: c.id, name: c.name, resolution: "exact_name" };
    }
    if (exact.length > 1) {
      return {
        ok: false,
        error: "ambiguous_name",
        message: `Multiple test cases have the exact name "${nameQuery}".`,
        candidates: exact,
      };
    }
    if (byNameSub.length === 1) {
      const c = byNameSub[0]!;
      return { ok: true, test_case_id: c.id, name: c.name, resolution: "unique_name_substring" };
    }
    if (byNameSub.length === 0) {
      return {
        ok: false,
        error: "no_match",
        message: `No test case in project ${projectId} matched "${nameQuery}" (exact name or unique name substring). Try testneo_find_test_cases with a longer search string.`,
        candidates: rows.slice(0, 25),
      };
    }
    return {
      ok: false,
      error: "ambiguous_name",
      message: `Multiple test cases match "${nameQuery}" in the name. Narrow name_query or use test_case_id.`,
      candidates: byNameSub.slice(0, 25),
    };
  }

  async function resolveTestCaseIdForExecuteInput(args: {
    test_case_id?: number | undefined;
    project_id?: number | undefined;
    name_query?: string | null | undefined;
    name_match_mode: "auto" | "exact" | "substring";
  }): Promise<
    | {
        ok: true;
        test_case_id: number;
        name_resolution:
          | { mode: "by_id" }
          | { mode: "by_name"; matched_name: string; resolution: string; name_query: string };
      }
    | { ok: false; payload: Record<string, unknown> }
  > {
    if (args.test_case_id != null && args.test_case_id > 0) {
      return { ok: true, test_case_id: args.test_case_id, name_resolution: { mode: "by_id" } };
    }
    const pid = args.project_id;
    const nq = args.name_query?.trim();
    if (pid == null || pid <= 0 || !nq) {
      return {
        ok: false,
        payload: {
          contract_version: "testneo_mcp_test_case_resolve.v1",
          error: "missing_test_target",
          message: "Provide test_case_id OR (project_id + name_query).",
        },
      };
    }
    const resolved = await resolveTestCaseByNameQuery(pid, nq, args.name_match_mode);
    if (!resolved.ok) {
      return {
        ok: false,
        payload: {
          contract_version: "testneo_mcp_test_case_resolve.v1",
          error: resolved.error,
          message: resolved.message,
          project_id: pid,
          name_query: nq,
          name_match_mode: args.name_match_mode,
          ...(resolved.candidates ? { candidates: resolved.candidates } : {}),
        },
      };
    }
    return {
      ok: true,
      test_case_id: resolved.test_case_id,
      name_resolution: {
        mode: "by_name",
        matched_name: resolved.name,
        resolution: resolved.resolution,
        name_query: nq,
      },
    };
  }

  async function readLocalAgentSafePayload(): Promise<Record<string, unknown>> {
    const data = await client.request<Record<string, unknown>>("/api/web/v1/agents/my-agent");
    const hb = typeof data.last_heartbeat === "string" ? data.last_heartbeat : null;
    let seconds_since_heartbeat: number | null = null;
    if (hb) {
      const t = Date.parse(hb);
      if (!Number.isNaN(t)) seconds_since_heartbeat = Math.max(0, Math.floor((Date.now() - t) / 1000));
    }
    const st = typeof data.status === "string" ? data.status.toLowerCase() : "offline";
    const fresh = seconds_since_heartbeat !== null && seconds_since_heartbeat <= 90;
    const agent_connected = (st === "online" || st === "busy") && fresh;
    const agent_id = typeof data.agent_id === "number" ? data.agent_id : Number(data.agent_id);
    return {
      contract_version: "testneo_mcp_agent_status.v1",
      agent_registered: true,
      agent_id: Number.isFinite(agent_id) ? agent_id : null,
      status: st,
      last_heartbeat: hb,
      seconds_since_heartbeat,
      agent_connected,
      setup_url: agentSetupUrl,
      note: "Agent API key is omitted for safety.",
    };
  }

  function isAgentConnectedSnapshot(snapshot: Record<string, unknown>): boolean {
    return snapshot.agent_connected === true;
  }

  /** Best-effort: open agent setup in the default browser (user machine). No-op when disabled in config. */
  function tryOpenAgentSetupUrl(url: string): void {
    if (!batchExecutionDefaults.openAgentSetupOnAgentFailure) return;
    try {
      if (process.platform === "darwin") {
        execFile("open", [url], { timeout: 15_000 }, () => {});
      } else if (process.platform === "win32") {
        execFile("cmd", ["/c", "start", "", url], { timeout: 15_000, windowsHide: true }, () => {});
      } else {
        execFile("xdg-open", [url], { timeout: 15_000 }, () => {});
      }
    } catch {
      /* ignore desktop open failures */
    }
  }

  type EnsureAgentOutcome =
    | { ok: true; snapshot: Record<string, unknown>; waited_ms: number; polls: number }
    | { ok: false; kind: "not_registered"; waited_ms: number; polls: number }
    | { ok: false; kind: "not_connected"; snapshot: Record<string, unknown>; waited_ms: number; polls: number };

  async function ensureLocalAgentReadyForRun(maxWaitMs: number): Promise<EnsureAgentOutcome> {
    const pollMs = 2000;
    const t0 = Date.now();
    let polls = 0;
    let lastSnapshot: Record<string, unknown> | null = null;
    const deadline = t0 + maxWaitMs;

    while (true) {
      polls += 1;
      try {
        lastSnapshot = await readLocalAgentSafePayload();
        if (isAgentConnectedSnapshot(lastSnapshot)) {
          return { ok: true, snapshot: lastSnapshot, waited_ms: Date.now() - t0, polls };
        }
      } catch (e) {
        if (e instanceof TestNeoApiError && e.status === 404) {
          return { ok: false, kind: "not_registered", waited_ms: Date.now() - t0, polls };
        }
        throw e;
      }
      if (Date.now() >= deadline) {
        return {
          ok: false,
          kind: "not_connected",
          snapshot: lastSnapshot as Record<string, unknown>,
          waited_ms: Date.now() - t0,
          polls,
        };
      }
      await sleep(pollMs);
    }
  }

  /** True when MCP should ask the API to queue work for the self-hosted agent (same rules as batch-by-tags). */
  function shouldPostUseAgentToExecuteApi(): boolean {
    return batchExecutionDefaults.preferLocalAgent && batchExecutionDefaults.defaultExecutionMode === "local";
  }

  type SingleExecutePreflight =
    | {
        proceed: true;
        use_agent: boolean;
        agent_wait: Record<string, unknown> | null;
        agent_snapshot: Record<string, unknown> | null;
      }
    | { proceed: false; blocked: ToolTextResult };

  async function preflightLocalAgentForSingleTestExecute(
    wait_for_agent_seconds: number | undefined | null,
    contractVersion: string
  ): Promise<SingleExecutePreflight> {
    const use_agent = shouldPostUseAgentToExecuteApi();
    if (!use_agent) {
      return { proceed: true, use_agent: false, agent_wait: null, agent_snapshot: null };
    }

    const requireAgent = batchExecutionDefaults.requireLocalAgentForBatch;
    const toolBudgetMs =
      wait_for_agent_seconds != null ? Math.min(wait_for_agent_seconds * 1000, 300_000) : null;
    const effectiveWaitMs =
      toolBudgetMs != null ? toolBudgetMs : batchExecutionDefaults.waitForAgentMs;

    if (!requireAgent && effectiveWaitMs <= 0) {
      return { proceed: true, use_agent: true, agent_wait: null, agent_snapshot: null };
    }

    const ensured = await ensureLocalAgentReadyForRun(effectiveWaitMs);
    const agent_wait = {
      max_wait_ms: effectiveWaitMs,
      waited_ms: ensured.waited_ms,
      polls: ensured.polls,
      outcome: ensured.ok ? "connected" : ensured.kind,
    };

    if (ensured.ok) {
      return { proceed: true, use_agent: true, agent_wait, agent_snapshot: ensured.snapshot };
    }

    if (ensured.kind === "not_registered") {
      if (requireAgent) {
        tryOpenAgentSetupUrl(agentSetupUrl);
        return {
          proceed: false,
          blocked: result(
            asText({
              contract_version: contractVersion,
              error: "local_agent_required_not_registered",
              setup_url: agentSetupUrl,
              opened_setup_url: batchExecutionDefaults.openAgentSetupOnAgentFailure,
              agent_wait,
              message:
                "This execution is configured to use the self-hosted agent (use_agent), but no agent is registered for your account.",
              next_steps: [
                `Register and connect an agent via ${agentSetupUrl}`,
                "Increase TESTNEO_MCP_WAIT_FOR_AGENT_MS (or pass wait_for_agent_seconds) if you create the agent immediately after this call.",
              ],
            })
          ),
        };
      }
      return {
        proceed: true,
        use_agent: true,
        agent_wait,
        agent_snapshot: {
          contract_version: "testneo_mcp_agent_status.v1",
          agent_registered: false,
          agent_connected: false,
          setup_url: agentSetupUrl,
          note: "No agent registered; request still sends use_agent=true — the API may fall back if job creation fails.",
        },
      };
    }

    if (requireAgent) {
      tryOpenAgentSetupUrl(agentSetupUrl);
      return {
        proceed: false,
        blocked: result(
          asText({
            contract_version: contractVersion,
            error: "local_agent_required_not_connected",
            opened_setup_url: batchExecutionDefaults.openAgentSetupOnAgentFailure,
            agent_wait,
            agent: ensured.snapshot,
            message:
              "Local agent did not show a fresh heartbeat within the wait window. Start the agent, increase TESTNEO_MCP_WAIT_FOR_AGENT_MS or wait_for_agent_seconds, or set TESTNEO_MCP_REQUIRE_LOCAL_AGENT_FOR_BATCH=false.",
          })
        ),
      };
    }

    return {
      proceed: true,
      use_agent: true,
      agent_wait,
      agent_snapshot: {
        ...ensured.snapshot,
        note: "Agent not connected within wait window; request still sends use_agent=true — the API may fall back if no agent is available.",
      },
    };
  }

  const projectRouteCache = new Map<number, ProjectRouteHardeningConfig>();
  let cachedTenantId: string | null | undefined = undefined;
  let tenantLookupInFlight: Promise<string | null> | null = null;

  function deriveTenantIdFromRecord(record: Record<string, unknown>): string | null {
    const directTenant =
      record.tenant_id ?? record.tenantId ?? record.organization_id ?? record.org_id ?? record.account_id;
    if (typeof directTenant === "number" && Number.isFinite(directTenant) && directTenant > 0) {
      return `tenant:${directTenant}`;
    }
    if (typeof directTenant === "string" && directTenant.trim()) {
      return `tenant:${directTenant.trim()}`;
    }
    const uid = record.user_id ?? record.userId;
    if (typeof uid === "number" && Number.isFinite(uid) && uid > 0) return `user:${uid}`;
    if (typeof uid === "string" && uid.trim()) return `user:${uid.trim()}`;
    return null;
  }

  async function gateProjectExecutable(
    projectId: number,
    opts?: {
      toolName?: string;
      nlpCommands?: string[];
      authExpectation?: "required" | "optional";
      routeMap?: Record<string, string>;
    }
  ): Promise<ToolTextResult | null> {
    const policy = await evaluatePreconditionPolicies(client, {
      tool_name: opts?.toolName ?? "unknown_tool",
      project_id: projectId,
      nlp_commands: opts?.nlpCommands,
      auth_expectation: opts?.authExpectation,
      route_map: opts?.routeMap,
      skip_base_url_check: deps.relaxProjectPreconditions,
      mode: deps.policyMode,
    });
    if (policy.ok) return null;
    return result(asText(formatPolicyFailure(policy)));
  }

  async function gateProjectExecutableFromTestCase(
    testCaseId: number,
    opts?: { toolName?: string; authExpectation?: "required" | "optional" }
  ): Promise<ToolTextResult | null> {
    const tc = await client.request<Record<string, unknown>>(
      `/api/web/v1/test-cases/${encodeURIComponent(String(testCaseId))}`
    );
    const pid = tc.project_id;
    const projectId = typeof pid === "number" ? pid : Number(pid);
    if (!Number.isFinite(projectId) || projectId <= 0) {
      return result(
        asText({
          error: "project_precondition_failed",
          precondition_code: "project_fetch_failed",
          test_case_id: testCaseId,
          message: "Test case response did not include a usable project_id.",
          remediation: ["Verify test_case_id exists and the API key has access."],
        })
      );
    }
    const routeRuntime = await runtimeForProjectRouteMap(projectId, deps.routeHardening);
    const routeMap = resolvePhraseToPathMap(routeRuntime);
    return gateProjectExecutable(projectId, {
      toolName: opts?.toolName ?? "unknown_tool",
      authExpectation: opts?.authExpectation,
      nlpCommands: extractNlpCommandsFromGeneratedTest(tc),
      routeMap,
    });
  }

  function replayOrConflict(
    toolName: string,
    idempotencyKey: string | undefined,
    fingerprintInput: unknown
  ): { blocked: ToolTextResult | null; key?: string; fingerprint?: string } {
    if (!idempotencyKey) return { blocked: null };
    const key = `${toolName}:${idempotencyKey}`;
    const fingerprint = makeIdempotencyFingerprint(fingerprintInput);
    const check = checkIdempotency(key, fingerprint);
    if (!check.ok) {
      return {
        blocked: result(
          asText({
            error: "idempotency_conflict",
            idempotency_key: idempotencyKey,
            message: check.message,
          })
        ),
      };
    }
    if (check.replay) {
      let cached: unknown = check.replay;
      try {
        cached = JSON.parse(check.replay);
      } catch {
        cached = check.replay;
      }
      return {
        blocked: result(
          asText({
            replayed: true,
            idempotency_key: idempotencyKey,
            cached_response: cached,
          })
        ),
      };
    }
    return { blocked: null, key, fingerprint };
  }

  /** Shared multi-test create + execute (batch-by-tags vs ordered API chains). */
  async function executeMultiTestRunCore(params: {
    project_id: number;
    test_case_ids: number[];
    /** Tags batch sorts ascending; API chains preserve caller order (dedupe consecutive duplicates only when preserving). */
    preserve_test_case_order: boolean;
    toolName: string;
    wait_for_agent_seconds?: number;
    run_name?: string;
    notes?: string;
    parallel: boolean;
    max_workers?: number;
    environment_variables?: Record<string, string>;
    execution_settings?: Record<string, unknown>;
    envelope_extra?: Record<string, unknown>;
  }): Promise<{ ok: true; payload: Record<string, unknown> } | { ok: false; toolResult: ToolTextResult }> {
    const {
      project_id,
      preserve_test_case_order,
      toolName,
      wait_for_agent_seconds,
      run_name,
      notes,
      parallel,
      max_workers,
      environment_variables,
      execution_settings,
      envelope_extra,
    } = params;

    const rawIds = params.test_case_ids.map((n) => (typeof n === "number" ? n : Number(n)));
    let test_case_ids: number[];
    if (preserve_test_case_order) {
      const seen = new Set<number>();
      test_case_ids = [];
      for (const id of rawIds) {
        if (!Number.isFinite(id) || id <= 0) continue;
        if (seen.has(id)) continue;
        seen.add(id);
        test_case_ids.push(id);
      }
    } else {
      test_case_ids = [...new Set(rawIds.filter((id) => Number.isFinite(id) && id > 0))].sort((a, b) => a - b);
    }

    if (!test_case_ids.length) {
      return {
        ok: false,
        toolResult: result(
          asText({
            contract_version: "testneo_mcp_batch_run.v1",
            error: "no_test_case_ids",
            message: "No valid test_case_ids after normalization.",
            project_id,
            ...(envelope_extra ?? {}),
          })
        ),
      };
    }

    try {
      const blocked = await gateProjectExecutable(project_id, { toolName });
      if (blocked) return { ok: false, toolResult: blocked };

      const use_agent = shouldPostUseAgentToExecuteApi();
      const requireAgent = use_agent && batchExecutionDefaults.requireLocalAgentForBatch;

      let agent_snapshot: Record<string, unknown> | null = null;
      let agent_wait: Record<string, unknown> | null = null;

      if (use_agent) {
        const toolBudgetMs =
          wait_for_agent_seconds != null ? Math.min(wait_for_agent_seconds * 1000, 300_000) : null;
        const effectiveWaitMs =
          toolBudgetMs != null ? toolBudgetMs : batchExecutionDefaults.waitForAgentMs;
        const ensured = await ensureLocalAgentReadyForRun(effectiveWaitMs);
        agent_wait = {
          max_wait_ms: effectiveWaitMs,
          waited_ms: ensured.waited_ms,
          polls: ensured.polls,
          outcome: ensured.ok ? "connected" : ensured.kind,
        };

        if (ensured.ok) {
          agent_snapshot = ensured.snapshot;
        } else if (ensured.kind === "not_registered") {
          if (requireAgent) {
            tryOpenAgentSetupUrl(agentSetupUrl);
            return {
              ok: false,
              toolResult: result(
                asText({
                  contract_version: "testneo_mcp_batch_run.v1",
                  error: "local_agent_required_not_registered",
                  setup_url: agentSetupUrl,
                  opened_setup_url: batchExecutionDefaults.openAgentSetupOnAgentFailure,
                  agent_wait,
                  message:
                    "Batch execution is configured to require a connected TestNeo local agent, but no agent is registered.",
                  next_steps: [
                    `Register and connect an agent via ${agentSetupUrl}`,
                    "Increase TESTNEO_MCP_WAIT_FOR_AGENT_MS (or pass wait_for_agent_seconds) if you create the agent immediately after this call.",
                  ],
                  project_id,
                  ...(envelope_extra ?? {}),
                })
              ),
            };
          }
          agent_snapshot = {
            contract_version: "testneo_mcp_agent_status.v1",
            agent_registered: false,
            agent_connected: false,
            setup_url: agentSetupUrl,
            note: "No agent registered; batch still runs because TESTNEO_MCP_REQUIRE_LOCAL_AGENT_FOR_BATCH is false.",
          };
        } else {
          if (requireAgent) {
            tryOpenAgentSetupUrl(agentSetupUrl);
            return {
              ok: false,
              toolResult: result(
                asText({
                  contract_version: "testneo_mcp_batch_run.v1",
                  error: "local_agent_required_not_connected",
                  opened_setup_url: batchExecutionDefaults.openAgentSetupOnAgentFailure,
                  agent_wait,
                  agent: ensured.snapshot,
                  message:
                    "Local agent did not show a fresh heartbeat within the wait window. Start the agent, increase TESTNEO_MCP_WAIT_FOR_AGENT_MS or wait_for_agent_seconds, or set TESTNEO_MCP_REQUIRE_LOCAL_AGENT_FOR_BATCH=false.",
                  project_id,
                  ...(envelope_extra ?? {}),
                })
              ),
            };
          }
          agent_snapshot = {
            ...ensured.snapshot,
            note: "Agent not connected within wait window; batch still runs because require-local is false.",
          };
        }
      }

      const mergedExecutionSettings: Record<string, unknown> = {
        headless: true,
        screenshots: "on_failure",
        timeout: 60000,
        slow_motion: 0,
        ...(execution_settings ?? {}),
        use_agent,
        execution_mode: batchExecutionDefaults.defaultExecutionMode,
        execution_platform: batchExecutionDefaults.defaultExecutionPlatform,
      };

      const createBody: Record<string, unknown> = {
        project_id,
        test_case_ids,
        ...(run_name ? { run_name } : {}),
        ...(notes ? { notes } : {}),
      };

      const created = await client.request<Record<string, unknown>>("/api/web/v1/multi-test-runs/create", {
        method: "POST",
        body: createBody,
      });

      const test_run_id = typeof created.test_run_id === "number" ? created.test_run_id : Number(created.test_run_id);
      if (!Number.isFinite(test_run_id) || test_run_id <= 0) {
        return {
          ok: false,
          toolResult: result(
            asText({
              contract_version: "testneo_mcp_batch_run.v1",
              error: "create_response_missing_test_run_id",
              create_response: created,
              project_id,
              ...(envelope_extra ?? {}),
            })
          ),
        };
      }

      const execBody: Record<string, unknown> = {
        test_case_ids,
        environment_variables: environment_variables ?? {},
        execution_settings: mergedExecutionSettings,
        parallel,
        execution_mode: batchExecutionDefaults.defaultExecutionMode,
        execution_platform: batchExecutionDefaults.defaultExecutionPlatform,
        ...(max_workers != null ? { max_workers } : {}),
      };
      if (run_name) execBody.run_name = run_name;
      if (notes !== undefined && notes !== "") execBody.notes = notes;

      const executed = await client.request<Record<string, unknown>>(
        `/api/web/v1/multi-test-runs/${encodeURIComponent(String(test_run_id))}/execute`,
        { method: "POST", body: execBody }
      );

      const runIdStr =
        typeof created.run_id === "string"
          ? created.run_id
          : typeof executed.run_id === "string"
            ? executed.run_id
            : null;

      let ui_navigation = buildMultiTestRunUiNavigationForClient(client, project_id, test_run_id, runIdStr);

      const execStatus = typeof executed.status === "string" ? executed.status.toLowerCase() : "";
      if (execStatus === "completed" || execStatus === "failed") {
        try {
          const results = await client.request<Record<string, unknown>>(
            `/api/web/v1/multi-test-runs/${encodeURIComponent(String(test_run_id))}/results`
          );
          ui_navigation = mergeTestExecutionLinksIntoMultiTestNav(ui_navigation, results, {
            apiOrigin: client.getBaseUrl(),
            appOrigin: client.getWebAppBaseUrl(),
            appPathPrefix: client.getWebAppPathPrefix(),
          });
        } catch {
          /* results may not be ready yet */
        }
      }

      const payload: Record<string, unknown> = {
        contract_version: "testneo_mcp_batch_run.v1",
        project_id,
        test_case_ids,
        test_case_count: test_case_ids.length,
        preserve_test_case_order,
        routing: {
          execution_mode: batchExecutionDefaults.defaultExecutionMode,
          execution_platform: batchExecutionDefaults.defaultExecutionPlatform,
          prefer_local_agent: batchExecutionDefaults.preferLocalAgent,
          require_local_agent_for_batch: batchExecutionDefaults.requireLocalAgentForBatch,
          wait_for_agent_ms_default: batchExecutionDefaults.waitForAgentMs,
          open_agent_setup_on_agent_failure: batchExecutionDefaults.openAgentSetupOnAgentFailure,
          use_agent,
        },
        agent_wait: use_agent ? agent_wait : null,
        agent_snapshot,
        create_response: created,
        execute_response: executed,
        ui_navigation,
        monitor_hint: `Open ui_navigation.multi_test_runner_url for live batch progress, or poll GET /api/web/v1/multi-test-runs/${test_run_id}/status.`,
        ...(envelope_extra ?? {}),
      };

      return { ok: true, payload };
    } catch (e) {
      const fmt = formatApiFailure(e);
      if (fmt) return { ok: false, toolResult: fmt };
      throw e;
    }
  }

  async function fetchProjectRouteConfig(projectId: number): Promise<ProjectRouteHardeningConfig> {
    const cached = projectRouteCache.get(projectId);
    if (cached) return cached;
    const project = await client.request<Record<string, unknown>>(
      `/api/web/v1/projects/${encodeURIComponent(String(projectId))}`
    );
    const parsed = parseProjectRouteConfig(project);
    projectRouteCache.set(projectId, parsed);
    return parsed;
  }

  async function runtimeForProjectRouteMap(
    projectId: number,
    base: RouteHardeningRuntimeConfig
  ): Promise<RouteHardeningRuntimeConfig> {
    const pr = await fetchProjectRouteConfig(projectId);
    return {
      enabled: pr.enabled ?? base.enabled,
      profile: pr.profile ?? base.profile,
      customMap: { ...base.customMap, ...pr.extra_map },
    };
  }

  async function runtimeForTestCaseRouteMap(
    testCaseId: number,
    base: RouteHardeningRuntimeConfig
  ): Promise<RouteHardeningRuntimeConfig> {
    const tc = await client.request<Record<string, unknown>>(
      `/api/web/v1/test-cases/${encodeURIComponent(String(testCaseId))}`
    );
    const pid = Number(tc.project_id);
    if (!Number.isFinite(pid) || pid <= 0) return base;
    return runtimeForProjectRouteMap(pid, base);
  }

  function registerTracedTool(
    toolName: string,
    config: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MCP + Zod inferred tool args; traced wrapper must not widen to unknown
    cb: (params: any) => Promise<ToolTextResult>
  ): void {
    async function ensureTenantId(): Promise<string | null> {
      if (cachedTenantId !== undefined) return cachedTenantId;
      if (tenantLookupInFlight) return tenantLookupInFlight;
      tenantLookupInFlight = (async () => {
        try {
          const v = await client.request<Record<string, unknown>>("/api/web/v1/playwright-sdk/validate", {
            method: "POST",
          });
          const tid = deriveTenantIdFromRecord(v);
          cachedTenantId = tid;
          return tid;
        } catch {
          cachedTenantId = null;
          return null;
        } finally {
          tenantLookupInFlight = null;
        }
      })();
      return tenantLookupInFlight;
    }

    function deriveProjectIdFromParams(params: unknown): number | null {
      if (!params || typeof params !== "object" || Array.isArray(params)) return null;
      const rec = params as Record<string, unknown>;
      const pid = rec.project_id;
      if (typeof pid === "number" && Number.isFinite(pid) && pid > 0) return pid;
      if (typeof pid === "string") {
        const n = Number(pid);
        if (Number.isFinite(n) && n > 0) return n;
      }
      return null;
    }

    function recordDimensionsFromRecord(record: Record<string, unknown>): void {
      const tenantId = deriveTenantIdFromRecord(record);
      let pidRaw = record.project_id ?? record.projectId;
      if (pidRaw === undefined) {
        const filters = record.filters;
        if (filters && typeof filters === "object" && !Array.isArray(filters)) {
          const f = filters as Record<string, unknown>;
          pidRaw = f.project_id ?? f.projectId;
        }
      }
      if (pidRaw === undefined) {
        const ex = record.executions;
        if (Array.isArray(ex) && ex.length > 0 && ex[0] && typeof ex[0] === "object") {
          const first = ex[0] as Record<string, unknown>;
          pidRaw = first.project_id ?? first.projectId;
        }
      }
      let projectId: number | null = null;
      if (typeof pidRaw === "number" && Number.isFinite(pidRaw) && pidRaw > 0) projectId = pidRaw;
      if (typeof pidRaw === "string") {
        const n = Number(pidRaw);
        if (Number.isFinite(n) && n > 0) projectId = n;
      }
      recordToolDimensions({
        ...(projectId !== null ? { projectId } : {}),
        ...(tenantId !== null ? { tenantId } : {}),
      });
    }

    (server as unknown as { registerTool(n: string, c: unknown, h: (params: unknown) => Promise<ToolTextResult>): void }).registerTool(
      toolName,
      config,
      async (params: unknown) => {
        // Tenant dimension should be stable per API key/user; resolve once and reuse.
        await ensureTenantId();
        return runWithToolTelemetry(toolName, async () => {
          const projectId = deriveProjectIdFromParams(params);
          recordToolDimensions({
            ...(projectId !== null ? { projectId } : {}),
            ...(cachedTenantId ? { tenantId: cachedTenantId } : {}),
          });
          const out = await cb(params);
          const chunk = out.content[0];
          if (chunk?.type === "text") {
            const txt = chunk.text.trim();
            if (txt.startsWith("{") && txt.endsWith("}")) {
              try {
                const parsed = JSON.parse(txt) as Record<string, unknown>;
                recordDimensionsFromRecord(parsed);
              } catch {
                /* noop */
              }
            }
          }
          return out;
        });
      }
    );
  }

  registerTracedTool(
    "testneo_validate_connection",
    {
      description: "Validate token and fetch basic account context.",
      inputSchema: z.object({}),
    },
    async () => {
      const response = await client.request("/api/web/v1/playwright-sdk/validate", { method: "POST" });
      const tenant = response && typeof response === "object" ? deriveTenantIdFromRecord(response as Record<string, unknown>) : null;
      if (tenant) {
        cachedTenantId = tenant;
        recordToolDimensions({ tenantId: tenant });
      }
      return result(`Connection valid.\n${asText(response)}`);
    }
  );

  registerTracedTool(
    "testneo_validate_pr",
    {
      description:
        "Run TestNeo PR validation planning from diff or git refs. Returns shared workflow context, impacted tests, planned verification stages, and Claude-ready findings using the new orchestration contracts.",
      inputSchema: ValidatePrRequestSchema,
    },
    async (params) => {
      try {
        const orchestrator = new PrValidationOrchestrator({
          store: workflowStore,
          impactAnalyzer,
          claudeAnalyzer: new DataDrivenClaudeAnalyzer(),
          incidentContextAdapter,
          testExecutor: testExecutionAdapter,
          enableTestExecution: deps.allowWriteTools,
        });
        const response = await orchestrator.validatePr(params);
        return result(asText(response));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  registerTracedTool(
    "testneo_get_pr_validation_history",
    {
      description:
        "Returns the recent validate_pr run history for a project — risk scores, merge signals, and statuses. " +
        "Use this to answer 'have we seen failures like this before?' or 'what was the risk score last time we touched this file?'. " +
        "Foundation for Release Memory. Read-only.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    },
    async ({ project_id, limit }) => {
      try {
        const resp = await client.request<Record<string, unknown>>(
          `/api/web/v1/workflow-contexts/project/${encodeURIComponent(String(project_id))}/history`,
          { query: { limit } },
        );
        const history = Array.isArray(resp?.history) ? resp.history : [];
        return result(asText({
          contract_version: "pr_validation_history.v1",
          project_id,
          count: history.length,
          history: history.map((h: Record<string, unknown>) => ({
            workflow_id: h.workflow_id,
            status: h.status,
            risk_score: h.risk_score,
            risk_level: h.risk_level,
            merge_signal: h.merge_signal,
            source: h.source,
            created_at: h.created_at,
          })),
          insight: history.length > 0
            ? `Last validation: ${(history[0] as Record<string, unknown>).risk_level ?? "unknown"} risk (score ${(history[0] as Record<string, unknown>).risk_score ?? "?"}/100)`
            : "No previous validations found for this project.",
        }));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  // ── Gap #1: Release Readiness Intelligence ────────────────────────────────
  registerTracedTool(
    "testneo_get_release_readiness",
    {
      description:
        "Compute a Release Confidence score (0–100) across all PR validations in a time window. " +
        "Answers: 'Is this release safe to ship?' — aggregates verification coverage, average PR risk, " +
        "component health, and Engineering Memory signals. Returns a recommendation: " +
        "SAFE TO RELEASE / RELEASE WITH CAUTION / HOLD / BLOCKED. " +
        "Call this before merging a batch of PRs to production. Read-only.",
      inputSchema: z.object({
        project_id: z.number().int().positive().describe("Project ID to analyse."),
        lookback_days: z
          .number().int().min(1).max(90).default(14)
          .describe("Days to look back for PR validation runs (default 14). Ignored if bundle_id provided."),
        since: z.string().optional().describe("ISO datetime — start of window (overrides lookback_days)."),
        until: z.string().optional().describe("ISO datetime — end of window (default: now)."),
        bundle_id: z.string().optional()
          .describe("v1.1: Score a named Release Bundle instead of a time window. Pass bundle_id from testneo_create_release_bundle."),
      }),
    },
    async ({ project_id, lookback_days, since, until, bundle_id }) => {
      try {
        let resp: Record<string, unknown>;
        if (bundle_id) {
          resp = await client.request<Record<string, unknown>>(
            `/api/web/v1/release-readiness/bundle/${bundle_id}`,
          );
        } else {
          const query: Record<string, string | number | boolean | undefined> = { project_id, lookback_days };
          if (since) query.since = since;
          if (until) query.until = until;
          resp = await client.request<Record<string, unknown>>(
            "/api/web/v1/release-readiness/summary",
            { query },
          );
        }
        const confidence = resp?.release_confidence as number ?? 0;
        const rec = resp?.recommendation as string ?? "UNKNOWN";
        const recDetail = resp?.recommendation_detail as string ?? "";
        const summary = (resp?.summary as Record<string, unknown>) ?? {};
        const breakdown = Array.isArray(resp?.score_breakdown) ? resp.score_breakdown as Array<Record<string, unknown>> : [];
        const unlockActions = Array.isArray(resp?.unlock_actions) ? resp.unlock_actions as Array<Record<string, unknown>> : [];
        const blockPrs = Array.isArray(resp?.block_prs) ? resp.block_prs as Array<Record<string, unknown>> : [];
        const warnPrs = Array.isArray(resp?.warn_prs) ? resp.warn_prs as Array<Record<string, unknown>> : [];

        const lines: string[] = [
          `# Release Readiness: Project ${project_id}`,
          ``,
          `## 🏁 Release Confidence: ${confidence}/100 — ${rec}`,
          `${recDetail}`,
          ``,
          `## Summary`,
          `- PRs analysed: ${summary.total_prs ?? 0}`,
          `- BLOCK: ${summary.block_count ?? 0}  WARN: ${summary.warn_count ?? 0}  PASS: ${summary.pass_count ?? 0}`,
          `- Services changed: ${summary.services_changed ?? 0}`,
          `- High-risk components: ${summary.high_risk_components ?? 0} (${summary.high_risk_worsening ?? 0} worsening)`,
          `- Engineering Memory HIGH signals: ${summary.engineering_memory_high_signals ?? 0}`,
          `- Verification coverage: ${summary.verification_coverage_pct ?? 100}%`,
          ``,
        ];

        if (breakdown.length > 0) {
          lines.push("## Score Breakdown");
          for (const f of breakdown) {
            lines.push(`- **${f.label}** (${Math.round((f.weight as number ?? 0) * 100)}% weight): ${f.score}/100 — ${f.detail}`);
          }
          lines.push("");
        }

        if (blockPrs.length > 0) {
          lines.push(`## 🚨 Blocked PRs (${blockPrs.length})`);
          for (const pr of blockPrs.slice(0, 5)) {
            lines.push(`- PR #${pr.pr_number ?? "?"} — ${pr.pr_title ?? "(no title)"} — score ${pr.risk_score}/100`);
          }
          if (blockPrs.length > 5) lines.push(`  ... and ${blockPrs.length - 5} more`);
          lines.push("");
        }

        if (warnPrs.length > 0) {
          lines.push(`## ⚠️ Warning PRs (${warnPrs.length})`);
          for (const pr of warnPrs.slice(0, 5)) {
            lines.push(`- PR #${pr.pr_number ?? "?"} — ${pr.pr_title ?? "(no title)"} — score ${pr.risk_score}/100`);
          }
          lines.push("");
        }

        lines.push(
          `## Next Steps`,
          confidence >= 85
            ? "✅ Release is ready. No blocking issues detected."
            : confidence >= 70
            ? "⚠️ Address warnings before releasing to production."
            : "🚨 Resolve all BLOCK-level PRs before proceeding with the release.",
        );

        return result(lines.join("\n"));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  // ── Gap #3: AI Change Risk Prediction (Pre-PR Preflight) ──────────────────
  registerTracedTool(
    "testneo_preflight_check",
    {
      description:
        "Instant AI risk assessment for code changes BEFORE a PR is created. " +
        "Takes a list of changed files (or a raw diff summary) and returns: " +
        "affected components, risk tier (LOW/MEDIUM/HIGH/CRITICAL), recommended tests to run, " +
        "Engineering Memory matches (have we seen these files fail before?), and top risk reasons. " +
        "Designed to run in <2 seconds inside your editor flow — no test execution, analysis only. " +
        "Call this while coding to get an early warning before you push.",
      inputSchema: z.object({
        project_id: z.number().int().positive().describe("Project ID."),
        changed_files: z
          .array(z.string())
          .min(1)
          .max(200)
          .describe(
            "List of file paths being modified (relative to repo root). " +
              "E.g. ['src/orders/order_service.py', 'src/models/order.py']",
          ),
        branch: z
          .string()
          .optional()
          .describe("Current branch name (optional, for context)."),
        change_description: z
          .string()
          .max(500)
          .optional()
          .describe("Short summary of what you are changing (optional, improves analysis)."),
      }),
    },
    async ({ project_id, changed_files, branch, change_description }) => {
      try {
        // 1. Code impact analysis — which tests / components are affected?
        const impactResp = await client.request<Record<string, unknown>>(
          "/api/web/v1/code-impact/analyze",
          {
            method: "POST",
            body: {
              project_id,
              changed_files,
              branch: branch ?? "feature/preflight",
              pr_title: change_description ?? `Preflight check: ${changed_files.slice(0, 3).join(", ")}`,
            },
          },
        ).catch(() => null);

        // 2. Engineering Memory — incident context for these files
        const memoryResp = await client.request<Record<string, unknown>>(
          "/api/web/v1/incident-context/lookup",
          {
            method: "POST",
            body: {
              project_id,
              changed_files,
              pr_title: change_description ?? "preflight",
              error_messages: [],
              failed_test_names: [],
            },
          },
        ).catch(() => null);

        // 3. Parse results
        const affectedTests = Array.isArray((impactResp as Record<string, unknown> | null)?.affected_tests)
          ? ((impactResp as Record<string, unknown>).affected_tests as Array<Record<string, unknown>>)
          : [];
        const componentHealth = Array.isArray((impactResp as Record<string, unknown> | null)?.component_health)
          ? ((impactResp as Record<string, unknown>).component_health as Array<Record<string, unknown>>)
          : [];

        const memMatchTier: string = (memoryResp as Record<string, unknown> | null)?.match_tier as string ?? "none";
        const memMatchScore: number = (memoryResp as Record<string, unknown> | null)?.incident_match_score as number ?? 0;
        const memMatches = Array.isArray((memoryResp as Record<string, unknown> | null)?.matches)
          ? ((memoryResp as Record<string, unknown>).matches as Array<Record<string, unknown>>)
          : [];
        const memInsight: string = (memoryResp as Record<string, unknown> | null)?.insight as string ?? "";

        const highRiskComponents = componentHealth.filter(
          (c) => (c.risk_level as string) === "HIGH",
        );
        const criticalTests = affectedTests.filter(
          (t) => (t.confidence as number ?? 0) >= 0.8,
        );

        // 4. Compute preflight risk tier
        const hasHighMem = memMatchTier === "high";
        const hasHighComp = highRiskComponents.length > 0;
        const testCount = criticalTests.length;

        let riskTier: string;
        let riskScore: number;
        if (hasHighMem && hasHighComp) {
          riskTier = "CRITICAL";
          riskScore = 90;
        } else if (hasHighMem || (hasHighComp && testCount > 3)) {
          riskTier = "HIGH";
          riskScore = 70;
        } else if (hasHighComp || testCount > 1 || memMatchTier === "medium") {
          riskTier = "MEDIUM";
          riskScore = 45;
        } else {
          riskTier = "LOW";
          riskScore = 20;
        }

        // 5. Build human-readable output
        const lines: string[] = [
          `# ⚡ Preflight Risk Check`,
          `**Project ${project_id}** · ${changed_files.length} file(s) changed${branch ? ` · branch: \`${branch}\`` : ""}`,
          ``,
          `## Risk Assessment: ${riskTier} (${riskScore}/100)`,
          ``,
        ];

        if (changed_files.length > 0) {
          lines.push("## Changed Files");
          for (const f of changed_files.slice(0, 10)) lines.push(`- \`${f}\``);
          if (changed_files.length > 10) lines.push(`  ... +${changed_files.length - 10} more`);
          lines.push("");
        }

        if (criticalTests.length > 0) {
          lines.push(`## 🧪 Recommended Tests (${criticalTests.length} high-confidence matches)`);
          for (const t of criticalTests.slice(0, 8)) {
            lines.push(`- ${t.name ?? t.test_name ?? t.id} (confidence: ${Math.round((t.confidence as number ?? 0) * 100)}%)`);
          }
          lines.push("");
        } else if (affectedTests.length > 0) {
          lines.push(`## 🧪 Potentially Affected Tests (${affectedTests.length})`);
          for (const t of affectedTests.slice(0, 5)) {
            lines.push(`- ${t.name ?? t.test_name ?? t.id}`);
          }
          lines.push("");
        }

        if (highRiskComponents.length > 0) {
          lines.push(`## ⚠️ High-Risk Components (${highRiskComponents.length})`);
          for (const c of highRiskComponents) {
            lines.push(`- **${c.component ?? c.name}** — ${c.risk_level} risk${c.trend ? ` (${c.trend})` : ""}`);
          }
          lines.push("");
        }

        if (memMatchTier !== "none" && memMatchTier !== "low") {
          lines.push(`## 🧠 Engineering Memory — ${memMatchTier.toUpperCase()} signal (score: ${memMatchScore}/100)`);
          if (memInsight) lines.push(memInsight);
          if (memMatches.length > 0) {
            lines.push("");
            for (const m of memMatches.slice(0, 3)) {
              lines.push(`- ${m.summary ?? m.description ?? JSON.stringify(m).slice(0, 120)}`);
            }
          }
          lines.push("");
        }

        lines.push("## 💡 Recommendation");
        if (riskTier === "CRITICAL") {
          lines.push(
            "🚨 **CRITICAL** — Engineering Memory detected recurring failures in these files. " +
              "Run `testneo_validate_pr` before pushing to ensure these are addressed.",
          );
        } else if (riskTier === "HIGH") {
          lines.push(
            "🔴 **HIGH RISK** — High-risk component(s) or recurring incident pattern detected. " +
              "Consider running the recommended tests locally before opening a PR.",
          );
        } else if (riskTier === "MEDIUM") {
          lines.push(
            "🟡 **MEDIUM RISK** — Some test coverage recommended. " +
              "Open a PR and run `testneo_validate_pr` to get a full risk assessment.",
          );
        } else {
          lines.push(
            "🟢 **LOW RISK** — No high-risk signals detected for these files. " +
              "Proceed with PR creation. `testneo_validate_pr` will confirm before merge.",
          );
        }

        return result(lines.join("\n"));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  // ── Gap #5: AI Release Manager ────────────────────────────────────────────
  registerTracedTool(
    "testneo_generate_release_brief",
    {
      description:
        "Gap #5 — AI Release Manager. Generates a complete Release Brief before deploying to production. " +
        "Produces: (1) Go/No-Go verdict grounded in Release Confidence score, " +
        "(2) AI-generated Release Notes summarising all PRs in the release window, " +
        "(3) Deploy Checklist with pre/deploy/post-deploy steps and risk flags, " +
        "(4) Rollback Plan with per-service revert steps and command hints. " +
        "Powered by Groq llama-3.3-70b with template fallback. " +
        "Call this when the team asks 'are we ready to ship?' or 'generate release notes'. Read-only.",
      inputSchema: z.object({
        project_id: z.number().int().positive().describe("Project ID."),
        lookback_days: z
          .number().int().min(1).max(90).default(14)
          .describe("Days to look back for PR validations (default 14). Ignored if bundle_id provided."),
        release_name: z
          .string().max(100).optional()
          .describe("Release name/tag (e.g. 'v2.4.0' or 'Sprint 42'). Defaults to today's date."),
        target_env: z
          .string().max(50).default("production")
          .describe("Target deployment environment (default: 'production')."),
        since: z.string().optional().describe("ISO datetime — start of window."),
        until: z.string().optional().describe("ISO datetime — end of window."),
        bundle_id: z.string().optional()
          .describe("v1.1: Generate brief for a named Release Bundle. Pass bundle_id from testneo_create_release_bundle."),
      }),
    },
    async ({ project_id, lookback_days, release_name, target_env, since, until, bundle_id }) => {
      try {
        const body: Record<string, unknown> = { project_id, lookback_days, target_env };
        if (release_name) body.release_name = release_name;
        if (since) body.since = since;
        if (until) body.until = until;
        if (bundle_id) body.bundle_id = bundle_id;

        const resp = await client.request<Record<string, unknown>>(
          "/api/web/v1/release-readiness/brief",
          { method: "POST", body },
        );

        const confidence = resp?.release_confidence as number ?? 0;
        const rec = resp?.recommendation as string ?? "UNKNOWN";
        const gng = (resp?.go_no_go as Record<string, unknown>) ?? {};
        const notes = Array.isArray(resp?.release_notes) ? resp.release_notes as Array<Record<string, unknown>> : [];
        const checklist = Array.isArray(resp?.deploy_checklist) ? resp.deploy_checklist as Array<Record<string, unknown>> : [];
        const rollback = Array.isArray(resp?.rollback_plan) ? resp.rollback_plan as Array<Record<string, unknown>> : [];
        const blockPrs = Array.isArray(resp?.block_prs) ? resp.block_prs as Array<Record<string, unknown>> : [];
        const warnPrs = Array.isArray(resp?.warn_prs) ? resp.warn_prs as Array<Record<string, unknown>> : [];

        const verdictEmoji = gng.verdict === "GO" ? "🟢" : gng.verdict === "GO WITH CAUTION" ? "🟡" : gng.verdict === "HOLD" ? "🟠" : "🔴";

        const lines: string[] = [
          `# 🚀 AI Release Brief — ${resp?.release_name ?? "Release"}`,
          `**Target:** ${resp?.target_env ?? "production"} · **Confidence:** ${confidence}/100 · ${rec}`,
          ``,
          `## ${verdictEmoji} Go / No-Go: ${gng.verdict ?? "UNKNOWN"}`,
          `${gng.summary ?? ""}`,
        ];

        if ((gng.blockers as string[] ?? []).length > 0) {
          lines.push(``, `**Blockers to resolve first:**`);
          for (const b of gng.blockers as string[]) lines.push(`- 🚨 ${b}`);
        }
        lines.push(``);

        if (notes.length > 0) {
          lines.push(`## 📋 Release Notes`);
          for (const n of notes) {
            const flag = n.risk_flag ? " ⚠️" : "";
            lines.push(`- **[${String(n.category ?? "").toUpperCase()}]** ${n.title}${flag} — ${n.detail}`);
          }
          lines.push(``);
        }

        if (checklist.length > 0) {
          lines.push(`## ✅ Deploy Checklist`);
          const phases = ["pre-deploy", "deploy", "post-deploy", "monitoring"];
          for (const phase of phases) {
            const items = checklist.filter(c => c.phase === phase);
            if (items.length === 0) continue;
            lines.push(``, `**${phase.toUpperCase()}**`);
            for (const item of items) {
              const flag = item.risk_flag ? " 🔴" : "";
              lines.push(`- [ ] ${item.step}${flag} _(${item.owner})_ — ${item.detail}`);
            }
          }
          lines.push(``);
        }

        if (rollback.length > 0) {
          lines.push(`## 🔁 Rollback Plan`);
          for (const r of rollback) {
            const cmd = r.command_hint ? ` \`${r.command_hint}\`` : "";
            lines.push(`- **[${r.priority}]** ${r.step}${cmd} _(${r.owner})_ — ${r.detail}`);
          }
          lines.push(``);
        }

        if (blockPrs.length > 0) {
          lines.push(`## 🚨 Blocked PRs — Must Fix Before Deploy`);
          for (const pr of blockPrs) {
            lines.push(`- PR #${pr.pr_number ?? "?"} — ${pr.pr_title ?? "(no title)"} — score ${pr.risk_score}/100`);
          }
          lines.push(``);
        }

        lines.push(
          `---`,
          `*Generated by TestNeo AI Release Manager · Release Confidence ${confidence}/100*`,
          `*View in dashboard: \`/web/pr-validation\`*`,
        );

        return result(lines.join("\n"));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  // ── Release Intelligence v1.1 tools ─────────────────────────────────────

  registerTracedTool(
    "testneo_create_release_bundle",
    {
      description:
        "Create a named Release Bundle — a labelled release candidate scored against exactly the PRs it contains. " +
        "Use instead of time-window readiness when you want 'Release v2.4.0 = these 8 PR validations'. " +
        "Returns release_confidence, unlock_actions (which BLOCK PRs to fix and estimated +confidence), " +
        "go/no-go ready signal, and a shareable bundle_id for the web UI. " +
        "Then call testneo_generate_release_brief with bundle_id for checklist + rollback. Read/write.",
      inputSchema: z.object({
        project_id: z.number().int().positive().describe("Project ID."),
        release_name: z.string().max(100).describe("Release name, e.g. 'v2.4.0' or 'Sprint 42'."),
        workflow_ids: z.array(z.string()).optional()
          .describe("Explicit list of PR validation workflow IDs to include. If omitted, uses since/until window."),
        target_env: z.string().max(50).default("production").describe("Target deployment environment."),
        since: z.string().optional().describe("ISO datetime — start of window (if workflow_ids not provided)."),
        until: z.string().optional().describe("ISO datetime — end of window."),
        gate_policy: z.enum(["both", "no_block", "min_confidence", "warn_only"]).default("both")
          .describe("Gate policy: 'both' = no BLOCKs AND confidence ≥ threshold (recommended)."),
        gate_threshold: z.number().int().min(50).max(100).default(85)
          .describe("Minimum confidence required for gate pass (default 85)."),
      }),
    },
    async ({ project_id, release_name, workflow_ids, target_env, since, until, gate_policy, gate_threshold }) => {
      try {
        const body: Record<string, unknown> = { project_id, release_name, target_env, gate_policy, gate_threshold };
        if (workflow_ids?.length) body.workflow_ids = workflow_ids;
        if (since) body.since = since;
        if (until) body.until = until;

        const resp = await client.request<Record<string, unknown>>(
          "/api/web/v1/release-readiness/bundle",
          { method: "POST", body },
        );

        const confidence = resp?.release_confidence as number ?? 0;
        const rec = resp?.recommendation as string ?? "NO DATA";
        const bundleId = resp?.bundle_id as string ?? "";
        const unlockActions = Array.isArray(resp?.unlock_actions) ? resp.unlock_actions as Array<Record<string, unknown>> : [];
        const summary = (resp?.summary as Record<string, unknown>) ?? {};
        const blockCount = summary.block_count as number ?? 0;
        const warnCount  = summary.warn_count  as number ?? 0;

        const confEmoji = confidence >= 85 ? "🟢" : confidence >= 70 ? "🟡" : confidence >= 50 ? "🟠" : "🔴";

        const lines: string[] = [
          `# 📦 Release Bundle — ${release_name}`,
          `**Target:** ${target_env} · **Confidence:** ${confEmoji} ${confidence}/100 · ${rec}`,
          `**Bundle ID:** \`${bundleId}\``,
          `**Gate policy:** ${gate_policy} · threshold ${gate_threshold}`,
          ``,
          `## Summary`,
          `- Total PRs: ${summary.total_prs ?? 0} (${blockCount} BLOCK, ${warnCount} WARN, ${summary.pass_count ?? 0} PASS)`,
          `- Execution evidence: ${summary.exec_total_ran ?? 0} tests ran, ${summary.exec_pass_rate ?? "—"}% pass rate`,
          `- Engineering Memory HIGH signals: ${summary.engineering_memory_high_signals ?? 0}`,
        ];

        if (unlockActions.length > 0) {
          lines.push(``, `## 🔓 Unlock Ship — Fix These First`);
          for (const a of unlockActions) {
            lines.push(`- **${a.pr_title ?? `PR #${a.pr_number}`}**: ${a.action} → **${a.confidence_gain}** confidence`);
          }
        }

        lines.push(
          ``,
          `## Next Steps`,
          `- Fix BLOCK PRs listed above, re-validate, then call \`testneo_create_release_bundle\` again`,
          `- Or: call \`testneo_generate_release_brief\` with \`bundle_id: "${bundleId}"\` for Go/No-Go + checklist + rollback`,
          `- Web UI: /web/release-readiness?bundle_id=${bundleId}`,
        );

        return result(lines.join("\n"));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  registerTracedTool(
    "testneo_evaluate_release_gate",
    {
      description:
        "Evaluate the CI/CD release gate for a Release Bundle. Returns GATE_PASS | GATE_BLOCK | GATE_WARN, " +
        "reason, unlock actions, and incident density hints. GATE_PASS auto-stubs a release_outcomes row for learning. " +
        "Use after testneo_create_release_bundle when confidence meets threshold.",
      inputSchema: z.object({
        bundle_id: z.string().min(1).describe("Bundle ID from testneo_create_release_bundle."),
        policy: z.enum(["both", "no_block", "min_confidence", "warn_only"]).default("both"),
        min_confidence: z.number().int().min(50).max(100).default(85),
        override_reason: z.string().optional()
          .describe("Optional audit override — forces GATE_PASS with recorded reason."),
      }),
    },
    async ({ bundle_id, policy, min_confidence, override_reason }) => {
      try {
        const resp = await client.request<Record<string, unknown>>(
          "/api/web/v1/release-readiness/gate",
          {
            method: "POST",
            body: { bundle_id, policy, min_confidence, override_reason: override_reason ?? undefined },
          },
        );
        const status = resp?.gate_status as string ?? "UNKNOWN";
        const lines: string[] = [
          `# Release Gate — ${status}`,
          ``,
          `- **Reason:** ${resp?.reason ?? ""}`,
          `- **Confidence:** ${resp?.release_confidence ?? "?"}/100`,
          `- **BLOCK/WARN counts:** ${resp?.block_count ?? 0} / ${resp?.warn_count ?? 0}`,
        ];
        const actions = Array.isArray(resp?.actions) ? resp.actions as string[] : [];
        if (actions.length > 0) {
          lines.push("", "## Actions");
          for (const a of actions) lines.push(`- ${a}`);
        }
        if (status === "GATE_PASS") {
          lines.push(
            "",
            "Outcome stub recorded — after deploy:",
            "  • testneo_get_release_webhook_config + testneo_test_release_webhook (Jira/PagerDuty demo signals)",
            "  • testneo_get_release_outcomes → testneo_record_release_outcome to finalize",
          );
        }
        lines.push("", `Web UI: /web/release-readiness?bundle_id=${bundle_id}`);
        return result(lines.join("\n"));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    },
  );

  registerTracedTool(
    "testneo_record_release_outcome",
    {
      description:
        "Mark a release deployed or record post-ship outcome (rollback, incidents, hotfixes). " +
        "Without outcome_id: creates ship snapshot (POST). With outcome_id: updates post-ship signals (PATCH). " +
        "Feeds testneo_get_release_calibration. Write — no confirm flag.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        outcome_id: z.string().optional()
          .describe("When set, PATCH this outcome with post-ship fields below."),
        bundle_id: z.string().optional(),
        release_name: z.string().optional(),
        confidence_at_ship: z.number().int().min(0).max(100).optional(),
        gate_status_at_ship: z.string().optional(),
        memory_high_signals: z.number().int().min(0).optional(),
        block_count: z.number().int().min(0).optional(),
        deploy_ref: z.string().optional().describe("Git SHA, tag, or workflow run id."),
        incident_within_7d: z.boolean().optional(),
        incident_within_30d: z.boolean().optional(),
        rollback: z.boolean().optional(),
        hotfix_pr_count: z.number().int().min(0).optional(),
        mttr_hours: z.number().min(0).optional(),
        outcome_notes: z.string().optional(),
      }),
    },
    async (params) => {
      try {
        if (params.outcome_id) {
          const { outcome_id, project_id: _pid, ...fields } = params;
          const body: Record<string, unknown> = {};
          if (fields.incident_within_7d !== undefined) body.incident_within_7d = fields.incident_within_7d;
          if (fields.incident_within_30d !== undefined) body.incident_within_30d = fields.incident_within_30d;
          if (fields.rollback !== undefined) body.rollback = fields.rollback;
          if (fields.hotfix_pr_count !== undefined) body.hotfix_pr_count = fields.hotfix_pr_count;
          if (fields.mttr_hours !== undefined) body.mttr_hours = fields.mttr_hours;
          if (fields.outcome_notes !== undefined) body.outcome_notes = fields.outcome_notes;
          if (fields.deploy_ref !== undefined) body.deploy_ref = fields.deploy_ref;
          const resp = await client.request<Record<string, unknown>>(
            `/api/web/v1/release-readiness/outcome/${outcome_id}`,
            { method: "PATCH", body },
          );
          return result(asText(resp));
        }

        const resp = await client.request<Record<string, unknown>>(
          "/api/web/v1/release-readiness/outcome",
          {
            method: "POST",
            body: {
              project_id: params.project_id,
              bundle_id: params.bundle_id,
              release_name: params.release_name,
              confidence_at_ship: params.confidence_at_ship,
              gate_status_at_ship: params.gate_status_at_ship ?? "manual",
              memory_high_signals: params.memory_high_signals ?? 0,
              block_count: params.block_count ?? 0,
              deploy_ref: params.deploy_ref,
            },
          },
        );
        return result(asText(resp));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    },
  );

  registerTracedTool(
    "testneo_get_release_outcomes",
    {
      description:
        "List release outcome records for a project — ship snapshots and post-ship signals. Read-only.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    },
    async ({ project_id, limit }) => {
      try {
        const resp = await client.request<Record<string, unknown>>(
          `/api/web/v1/release-readiness/outcomes?project_id=${project_id}&limit=${limit}`,
        );
        return result(asText(resp));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    },
  );

  registerTracedTool(
    "testneo_get_release_calibration",
    {
      description:
        "Read-only calibration suggestions from recorded release outcomes — e.g. " +
        "'Ignored HIGH memory patterns → 3× rollback rate'. Never auto-changes gate policy.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
      }),
    },
    async ({ project_id }) => {
      try {
        const resp = await client.request<Record<string, unknown>>(
          `/api/web/v1/release-readiness/calibration?project_id=${project_id}`,
        );
        const summary = resp?.summary as string ?? "";
        const suggestions = Array.isArray(resp?.suggestions) ? resp.suggestions as Array<Record<string, unknown>> : [];
        const lines: string[] = [
          `# Release Outcome Calibration — project ${project_id}`,
          ``,
          summary,
          ``,
          `- Sample size: ${resp?.sample_size ?? 0}`,
          `- Pending outcomes: ${resp?.pending_outcomes ?? 0}`,
        ];
        if (resp?.suggested_min_confidence != null) {
          lines.push(`- Suggested min confidence: ${resp.suggested_min_confidence}`);
        }
        if (suggestions.length > 0) {
          lines.push("", "## Suggestions");
          for (const s of suggestions) {
            lines.push(`- [${s.severity}] ${s.message}`);
          }
        }
        return result(lines.join("\n"));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    },
  );

  registerTracedTool(
    "testneo_get_release_webhook_config",
    {
      description:
        "Post-ship webhook setup for a project — Jira/PagerDuty URLs, match rules, open outcome stub readiness. " +
        "Use before production wiring or to confirm an open stub exists for webhook pre-fill. Read-only.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
      }),
    },
    async ({ project_id }) => {
      try {
        const resp = await client.request<Record<string, unknown>>(
          `/api/web/v1/release-readiness/webhook-config?project_id=${project_id}`,
        );
        const readiness = (resp.readiness as Record<string, unknown>) ?? {};
        const jira = (resp.jira as Record<string, unknown>) ?? {};
        const pd = (resp.pagerduty as Record<string, unknown>) ?? {};
        const lines: string[] = [
          `# Post-ship webhooks — project ${project_id}`,
          "",
          (resp.value_copy as Record<string, unknown>)?.headline as string ??
            "Connect production signals to your last ship.",
          "",
          `Open outcome stubs: ${readiness.open_outcome_count ?? 0} (${readiness.ready ? "ready" : "none — GATE_PASS or Mark deployed first"})`,
        ];
        const open = readiness.open_outcome as Record<string, unknown> | undefined;
        if (open?.release_name || open?.bundle_id) {
          lines.push(`Latest stub: ${open.release_name ?? open.bundle_id}`);
        }
        lines.push(
          "",
          "## Jira post-release",
          `- URL (copy full URL in web UI — secret masked here): ${jira.url_display ?? jira.url ?? "—"}`,
          `- Labels: ${((jira.match_rules as Record<string, unknown>)?.labels_any as string[] | undefined)?.join(", ") ?? "post-release"}`,
          "",
          "## PagerDuty",
          `- URL: ${pd.url ?? "—"}`,
          `- Signing secret configured: ${pd.signing_secret_configured ? "yes" : "no (optional for in-app test)"}`,
          "",
          "Test without ngrok: testneo_test_release_webhook with provider jira or pagerduty.",
          `Web UI: /web/release-readiness?project_id=${project_id}`,
        );
        return result(lines.join("\n"));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    },
  );

  registerTracedTool(
    "testneo_test_release_webhook",
    {
      description:
        "Send a realistic demo Jira post-release bug or PagerDuty incident.triggered through the same pipeline " +
        "as production webhooks. Pre-fills the open release outcome stub (notes + incident flags). " +
        "Requires an open outcome stub from GATE_PASS or Mark deployed. Write — no confirm flag.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        provider: z.enum(["jira", "pagerduty"]).describe("jira = post-release bug + EM ingest; pagerduty = incident page"),
      }),
    },
    async ({ project_id, provider }) => {
      try {
        const resp = await client.request<Record<string, unknown>>(
          `/api/web/v1/release-readiness/webhook-config/test/${provider}?project_id=${project_id}`,
          { method: "POST" },
        );
        const summary = (resp.summary as Record<string, unknown>) ?? {};
        const lines: string[] = [
          `# Post-ship webhook test (${provider}) — project ${project_id}`,
          "",
          `Status: ${summary.status ?? resp.handled ?? "unknown"}`,
          summary.title ? `Title: ${summary.title}` : "",
          summary.message ? `Message: ${summary.message}` : "",
          summary.next_step ? `Next: ${summary.next_step}` : "",
          "",
          "Call testneo_get_release_outcomes then testneo_record_release_outcome to finalize calibration.",
        ].filter(Boolean);
        return result(lines.join("\n"));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    },
  );

  registerTracedTool(
    "testneo_pre_validate_hint",
    {
      description:
        "Engineering Memory pre-check — surface historical risk patterns for changed files BEFORE running full PR validation. " +
        "Fast, read-only, no LLM. Returns warnings with pattern name, failure count, confidence, and suggested pre-checks. " +
        "Use at the start of a coding session or before committing. " +
        "If has_warnings=true, run testneo_pr_validation_workflow next for full risk score.",
      inputSchema: z.object({
        project_id: z.number().int().positive().describe("Project ID."),
        changed_files: z.array(z.string()).min(1).max(100)
          .describe("List of file paths that have changed (e.g. from git diff --name-only)."),
      }),
    },
    async ({ project_id, changed_files }) => {
      try {
        const resp = await client.request<Record<string, unknown>>(
          "/api/web/v1/release-readiness/memory-hint",
          { query: { project_id, files: changed_files.join(",") } },
        );

        const hasWarnings = resp?.has_warnings as boolean ?? false;
        const warnings = Array.isArray(resp?.warnings) ? resp.warnings as Array<Record<string, unknown>> : [];
        const prompt = resp?.prompt as string ?? null;

        if (!hasWarnings || warnings.length === 0) {
          return result(
            `✅ **Engineering Memory: No historical risk patterns** detected for the changed files.\n\n` +
            `${changed_files.length} file(s) checked. Proceed with \`testneo_pr_validation_workflow\` for full validation.`
          );
        }

        const lines: string[] = [
          `⚠️ **Engineering Memory: ${warnings.length} historical risk area(s) detected**`,
          ``,
          `Changed files checked: ${resp?.changed_files_checked ?? changed_files.length}`,
          ``,
        ];

        for (const w of warnings) {
          lines.push(
            `### ${w.pattern}`,
            `- **Confidence:** ${w.confidence_pct} · **Failures:** ${w.failure_count} · **Resolved:** ${w.resolution_count ?? 0} times`,
            `- **Last seen:** ${w.last_seen_label ?? "unknown"}`,
          );
          if (w.description) lines.push(`- ${w.description}`);
          const actions = Array.isArray(w.suggested_actions) ? w.suggested_actions as string[] : [];
          if (actions.length > 0) {
            lines.push(`- **Pre-check:** ${actions[0]}`);
          }
          lines.push(``);
        }

        lines.push(
          `---`,
          `**Next:** Run \`testneo_pr_validation_workflow\` for full risk score, blast radius, and fix plan.`,
          prompt ? `\n${prompt}` : "",
        );

        return result(lines.join("\n"));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  registerTracedTool(
    "testneo_get_risk_signals",
    {
      description:
        "Returns historical failure rates, flakiness scores, and risk levels for specific test case IDs. " +
        "Use before running validate_pr to understand which tests are historically risky. " +
        "Inputs: project_id + comma-separated test IDs. Read-only.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        test_ids: z.array(z.number().int().positive()).min(1).max(50),
      }),
    },
    async ({ project_id, test_ids }) => {
      try {
        const resp = await client.request<Record<string, unknown>>(
          "/api/web/v1/code-impact/risk-signals",
          { query: { project_id, test_ids: test_ids.join(",") } },
        );
        const signals = Array.isArray(resp?.signals) ? resp.signals as Array<Record<string, unknown>> : [];
        const risky = signals.filter((s) => (s.failure_rate_7d as number ?? 0) > 0.2 || (s.flakiness_score as number ?? 0) > 0.3);
        return result(asText({
          contract_version: "risk_signals.v1",
          project_id,
          requested: test_ids.length,
          signals,
          summary: {
            high_risk_tests: risky.length,
            high_risk_test_ids: risky.map((s) => s.test_id),
            insight: risky.length > 0
              ? `${risky.length} test(s) have elevated failure rates or flakiness — prioritise these in PR validation.`
              : "All requested tests have low historical failure rates.",
          },
        }));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  registerTracedTool(
    "testneo_get_incident_matches",
    {
      description:
        "Engineering Memory lookup — returns prior PR validations, failure patterns, and resolutions " +
        "matching changed files, components, or findings. Use for 'have we seen this before?' without " +
        "running full validate_pr. Read-only.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        changed_files: z.array(z.string()).default([]),
        component_labels: z.array(z.string()).default([]),
        affected_test_ids: z.array(z.number().int().positive()).default([]),
        lookback_days: z.number().int().min(1).max(365).default(30),
        max_matches: z.number().int().min(1).max(25).default(10),
      }),
    },
    async ({ project_id, changed_files, component_labels, affected_test_ids, lookback_days, max_matches }) => {
      try {
        const resp = await client.request<Record<string, unknown>>("/api/web/v1/incident-context/lookup", {
          method: "POST",
          body: {
            project_id,
            changed_files,
            component_labels,
            affected_test_ids,
            findings: [],
            lookback_days,
            max_matches,
          },
          timeoutMs: client.longRequestTimeoutMs,
        });
        return result(asText(resp));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  registerTracedTool(
    "testneo_sync_engineering_memory",
    {
      description:
        "Sync Jira bugs/incidents into Engineering Memory for a project. " +
        "Requires Jira connected in TestNeo project settings. write: no confirm needed.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        max_issues: z.number().int().min(1).max(200).default(50),
        lookback_days: z.number().int().min(1).max(365).default(90),
      }),
    },
    async ({ project_id, max_issues, lookback_days }) => {
      try {
        const resp = await client.request<Record<string, unknown>>(
          "/api/web/v1/engineering-memory/ingest/jira",
          {
            method: "POST",
            body: { project_id, max_issues, lookback_days },
            timeoutMs: client.longRequestTimeoutMs,
          },
        );
        return result(asText(resp));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    },
  );

  registerTracedTool(
    "testneo_ingest_engineering_memory_csv",
    {
      description:
        "Upload a bug-report CSV from the IDE workspace into Engineering Memory for a project. " +
        "Use before testneo_pr_validation_workflow when the developer has a local bugs.csv — " +
        "memory is matched to PR changed files automatically (no PR number on bugs). " +
        "Provide csv_path (workspace-relative) OR csv_file_base64 + csv_filename. " +
        "Backend: POST /api/web/v1/engineering-memory/ingest/csv. No confirm flag required.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        csv_path: z
          .string()
          .min(1)
          .optional()
          .describe("Workspace-relative path, e.g. scripts/fixtures/project10_engineering_memory_bugs.csv"),
        csv_file_base64: z.string().min(1).optional(),
        csv_filename: z.string().min(1).max(512).optional(),
      }),
    },
    async ({ project_id, csv_path, csv_file_base64, csv_filename }) => {
      try {
        if (!csv_path && !csv_file_base64) {
          return result(
            asText(
              wrapEngineeringMemoryCsv({
                success: false,
                error: "Provide csv_path or csv_file_base64 (+ csv_filename).",
              }),
            ),
          );
        }
        if (csv_file_base64 && !csv_filename) {
          return result(
            asText(
              wrapEngineeringMemoryCsv({
                success: false,
                error: "csv_filename is required when using csv_file_base64.",
              }),
            ),
          );
        }

        const payload = csv_path
          ? await resolveBugCsvSource({ kind: "path", csv_path })
          : await resolveBugCsvSource({
              kind: "base64",
              csv_file_base64: csv_file_base64!,
              csv_filename: csv_filename!,
            });

        if (!payload.ok) {
          return result(
            asText(wrapEngineeringMemoryCsv({ success: false, error: payload.error })),
          );
        }

        const ingest = await ingestEngineeringMemoryCsv(
          client,
          project_id,
          payload.blob,
          payload.filename,
        );

        const created = Number(ingest.created ?? 0);
        const updated = Number(ingest.updated ?? 0);
        const skipped = Number(ingest.skipped ?? 0);

        return result(
          asText(
            wrapEngineeringMemoryCsv({
              success: true,
              project_id,
              filename: payload.filename,
              csv_sha256: payload.sha256,
              bytes: payload.buf.length,
              created,
              updated,
              skipped,
              message:
                created + updated > 0
                  ? `Engineering Memory updated (${created} new, ${updated} updated). ` +
                    "Run testneo_pr_validation_workflow on your PR — incident matches are live."
                  : `No new rows (${skipped} unchanged). Run PR validation to see existing memory matches.`,
              next_step:
                "testneo_pr_validation_workflow(project_id, repository, pull_request, git, confirm: false)",
              ingest,
            }),
          ),
        );
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    },
  );

  registerTracedTool(
    "testneo_list_engineering_memory",
    {
      description:
        "List Engineering Memory entries (bugs, Jira incidents, postmortems) for a project. Read-only.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        source: z.enum(["bug_csv", "jira", "postmortem_upload"]).optional(),
        area: z.string().optional(),
        pattern_id: z.number().int().positive().optional()
          .describe("Filter entries linked to a unified failure pattern (from testneo_list_engineering_memory_patterns)."),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    },
    async ({ project_id, source, area, pattern_id, limit }) => {
      try {
        const q = new URLSearchParams({
          project_id: String(project_id),
          limit: String(limit),
        });
        if (source) q.set("source", source);
        if (area) q.set("area", area);
        if (pattern_id) q.set("pattern_id", String(pattern_id));
        const resp = await client.request<Record<string, unknown>>(
          `/api/web/v1/engineering-memory/entries?${q.toString()}`,
        );
        return result(asText(resp));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    },
  );

  registerTracedTool(
    "testneo_list_engineering_memory_patterns",
    {
      description:
        "List unified failure patterns for a project (Phase 3 clustering). " +
        "Returns pattern_label, source_mix narrative, trend (30d vs prior 30d), best_resolution, entry_count. " +
        "Pass pattern_id for full detail including contributing entries. Read-only.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        pattern_id: z.number().int().positive().optional()
          .describe("When set, returns full pattern detail + contributing memory entries."),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    },
    async ({ project_id, pattern_id, limit }) => {
      try {
        if (pattern_id) {
          const resp = await client.request<Record<string, unknown>>(
            `/api/web/v1/engineering-memory/patterns/${pattern_id}?project_id=${project_id}`,
          );
          const p = (resp?.pattern as Record<string, unknown>) ?? {};
          const lines: string[] = [
            `# Pattern: ${p.pattern_label ?? pattern_id}`,
            ``,
            `- **ID:** ${p.id ?? pattern_id}`,
            `- **Trend:** ${p.trend ?? "stable"} — ${p.trend_narrative ?? ""}`,
            `- **Seen:** ${p.source_mix_narrative ?? p.failure_count ?? 0}`,
            `- **Confidence:** ${p.confidence ?? 0}%`,
            `- **Best fix:** ${p.best_resolution ?? "(none)"}`,
            ``,
            `**Web UI:** /web/engineering-memory?project_id=${project_id}&pattern_id=${pattern_id}&view=patterns`,
          ];
          const entries = Array.isArray(p.entries) ? p.entries as Array<Record<string, unknown>> : [];
          if (entries.length > 0) {
            lines.push("", "## Contributing entries");
            for (const e of entries.slice(0, 15)) {
              lines.push(`- [${e.source}] ${e.title} (${e.id})`);
            }
          }
          return result(lines.join("\n"));
        }

        const resp = await client.request<Record<string, unknown>>(
          `/api/web/v1/engineering-memory/patterns?project_id=${project_id}&limit=${limit}`,
        );
        const patterns = Array.isArray(resp?.patterns) ? resp.patterns as Array<Record<string, unknown>> : [];
        if (patterns.length === 0) {
          return result(
            `No unified patterns for project ${project_id}. Ingest bugs/postmortems then call testneo_refresh_engineering_memory_patterns.`,
          );
        }
        const lines: string[] = [`# Unified failure patterns — project ${project_id}`, ``];
        for (const p of patterns) {
          lines.push(
            `## ${p.pattern_label ?? "Pattern"} (id=${p.id})`,
            `- ${p.source_mix_narrative ?? ""}`,
            `- Trend: **${p.trend ?? "stable"}** — ${p.trend_narrative ?? ""}`,
            `- Fix: ${p.best_resolution ?? "(none)"}`,
            `- Entries: ${p.entry_count ?? 0} · /web/engineering-memory?project_id=${project_id}&pattern_id=${p.id}&view=entries`,
            ``,
          );
        }
        return result(lines.join("\n"));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    },
  );

  registerTracedTool(
    "testneo_refresh_engineering_memory_patterns",
    {
      description:
        "Re-cluster Engineering Memory entries into unified failure patterns and refresh source_mix + trend. " +
        "Run after ingesting new bugs, Jira sync, or postmortems. Write — no confirm flag.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
      }),
    },
    async ({ project_id }) => {
      try {
        const resp = await client.request<Record<string, unknown>>(
          `/api/web/v1/engineering-memory/patterns/refresh?project_id=${project_id}`,
          { method: "POST", timeoutMs: client.longRequestTimeoutMs },
        );
        return result(asText(resp));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    },
  );

  registerTracedTool(
    "testneo_ingest_postmortem",
    {
      description:
        "Ingest a postmortem / RCA into Engineering Memory for a project. " +
        "Provide title + body (paste) OR md_path (workspace-relative .md file). " +
        "Extracts impact areas, root cause, resolution actions, and related file paths for PR matching. " +
        "Backend: POST /api/web/v1/engineering-memory/ingest/postmortem. No confirm flag required.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        title: z.string().min(1).max(512).optional(),
        body: z.string().min(10).optional(),
        md_path: z
          .string()
          .min(1)
          .optional()
          .describe("Workspace-relative path, e.g. docs/demo/postmortem-orders-sev1.md"),
        external_id: z
          .string()
          .min(1)
          .max(128)
          .optional()
          .describe("Stable id for upsert (e.g. pm-project10-fulfillment-0042)"),
      }),
    },
    async ({ project_id, title, body, md_path, external_id }) => {
      try {
        let pmTitle = title?.trim();
        let pmBody = body?.trim();
        let filename: string | undefined;

        if (md_path) {
          const payload = await readPostmortemFromPath(md_path);
          if (!payload.ok) {
            return result(
              asText(wrapEngineeringMemoryPostmortem({ success: false, error: payload.error })),
            );
          }
          pmTitle = pmTitle || payload.title;
          pmBody = pmBody || payload.body;
          filename = payload.filename;
        }

        if (!pmTitle || !pmBody) {
          return result(
            asText(
              wrapEngineeringMemoryPostmortem({
                success: false,
                error: "Provide body (+ title) or md_path.",
              }),
            ),
          );
        }

        const ingest = await ingestPostmortem(client, project_id, pmTitle, pmBody, external_id);
        const created = Number(ingest.created ?? 0);
        const updated = Number(ingest.updated ?? 0);
        const warnings = (ingest.duplicate_warnings as unknown[]) || [];

        return result(
          asText(
            wrapEngineeringMemoryPostmortem({
              success: true,
              project_id,
              filename,
              title: pmTitle,
              created,
              updated,
              entry_ids: ingest.entry_ids,
              duplicate_warnings: warnings,
              message:
                created + updated > 0
                  ? `Postmortem ingested (${created} new, ${updated} updated). Run PR validation to see matches.`
                  : "No changes (duplicate or unchanged body).",
              next_step: "testneo_pr_validation_workflow(project_id, repository, pull_request, git, confirm: false)",
            }),
          ),
        );
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    },
  );

  registerTracedTool(
    "testneo_ingest_confluence",
    {
      description:
        "Import a Confluence postmortem page into Engineering Memory. " +
        "Uses the same Atlassian credentials as Jira Integration for the project. " +
        "Provide page_id (numeric) or full Confluence page URL. " +
        "Backend: POST /api/web/v1/engineering-memory/ingest/confluence. No confirm flag required.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        page_id: z
          .string()
          .min(1)
          .describe("Confluence page id or full URL, e.g. https://…atlassian.net/wiki/spaces/TEAM/pages/123456789/…"),
        title: z.string().min(1).max(512).optional().describe("Optional title override"),
      }),
    },
    async ({ project_id, page_id, title }) => {
      try {
        const ingest = await ingestConfluencePage(client, project_id, page_id.trim(), title?.trim());
        const created = Number(ingest.created ?? 0);
        const updated = Number(ingest.updated ?? 0);
        const warnings = (ingest.duplicate_warnings as unknown[]) || [];

        return result(
          asText(
            wrapEngineeringMemoryConfluence({
              success: true,
              project_id,
              confluence_page_id: ingest.confluence_page_id,
              external_url: ingest.external_url,
              created,
              updated,
              entry_ids: ingest.entry_ids,
              duplicate_warnings: warnings,
              message:
                created + updated > 0
                  ? `Confluence page ingested (${created} new, ${updated} updated). Run PR validation to see matches.`
                  : "No changes (duplicate or unchanged body).",
              next_step: "testneo_refresh_engineering_memory_patterns(project_id)",
            }),
          ),
        );
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    },
  );

  registerTracedTool(
    "testneo_get_pr_validation_detail",
    {
      description:
        "Returns the full stored context for a specific validate_pr run by workflow ID. " +
        "Includes all findings, risk factors, and the complete audit event trail. Read-only.",
      inputSchema: z.object({
        workflow_id: z.string().min(1),
        include_events: z.boolean().default(false),
      }),
    },
    async ({ workflow_id, include_events }) => {
      try {
        const contextResp = await client.request<Record<string, unknown>>(
          `/api/web/v1/workflow-contexts/${encodeURIComponent(workflow_id)}`,
        );
        const context = contextResp?.context as Record<string, unknown> | undefined;
        if (!context) {
          return result(asText({ error: "not_found", workflow_id, message: "No validation run found with this workflow ID." }));
        }

        let events: unknown[] = [];
        if (include_events) {
          const eventsResp = await client.request<Record<string, unknown>>(
            `/api/web/v1/workflow-events/${encodeURIComponent(workflow_id)}`,
          );
          events = Array.isArray(eventsResp?.events) ? eventsResp.events : [];
        }

        return result(asText({
          contract_version: "pr_validation_detail.v1",
          workflow_id,
          status: context.status,
          risk_score: (context.metadata as Record<string, unknown>)?.risk_score,
          risk_level: (context.metadata as Record<string, unknown>)?.risk_level,
          findings_count: Array.isArray(context.findings) ? context.findings.length : 0,
          blocking_findings: Array.isArray(context.findings)
            ? (context.findings as Array<Record<string, unknown>>).filter((f) => f.blocking).length
            : 0,
          context,
          ...(include_events ? { events, event_count: events.length } : {}),
        }));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  // ─── IDE Agent Companion Tools ───────────────────────────────────────────
  // These three tools are the "FAANG-level IDE experience" layer:
  //   testneo_explain_failure      — deep-dive explanation for each finding
  //   testneo_suggest_fix          — prioritised, actionable fix plan
  //   testneo_pr_validation_workflow — one-shot release brief (validate + explain + fix)

  registerTracedTool(
    "testneo_explain_failure",
    {
      description:
        "Returns a deep, human-readable explanation for each finding in a PR validation run. " +
        "Synthesises historical failure rates, component risk trends, transitive blast radius, " +
        "and changed file context into plain-English root cause analysis and concrete next steps. " +
        "Designed for Cursor / VS Code chat: call this after testneo_validate_pr to give the " +
        "developer a crystal-clear picture of *why* something is risky before they touch any code. " +
        "Read-only — never starts execution.",
      inputSchema: z.object({
        workflow_id: z.string().min(1).describe("Workflow ID from a testneo_validate_pr run."),
        finding_id: z
          .string()
          .optional()
          .describe(
            "Explain only this finding ID (e.g. 'finding-1'). " +
            "Omit to explain all blocking and warning findings.",
          ),
        include_rerun_plan: z
          .boolean()
          .default(true)
          .describe("Include a concrete 'what to run next' plan at the end."),
      }),
    },
    async ({ workflow_id, finding_id, include_rerun_plan }) => {
      try {
        const contextResp = await client.request<Record<string, unknown>>(
          `/api/web/v1/workflow-contexts/${encodeURIComponent(workflow_id)}`,
        );
        const ctx = contextResp?.context as Record<string, unknown> | undefined;
        if (!ctx) {
          return result(
            asText({
              error: "not_found",
              workflow_id,
              message: "No validation run found. Run testneo_validate_pr first.",
            }),
          );
        }

        const findings = Array.isArray(ctx.findings)
          ? (ctx.findings as Array<Record<string, unknown>>)
          : [];

        const riskScore = (ctx.metadata as Record<string, unknown> | undefined)?.risk_score;
        const riskLevel = (ctx.metadata as Record<string, unknown> | undefined)?.risk_level ?? "PASS";
        const executionMode = (ctx.metadata as Record<string, unknown> | undefined)?.execution_mode ?? "planned_only";

        const targetFindings = finding_id
          ? findings.filter((f) => f.id === finding_id)
          : findings.filter((f) => f.blocking === true || f.status === "warning");

        if (targetFindings.length === 0) {
          return result(
            asText({
              contract_version: "pr_explain_failure.v1",
              workflow_id,
              risk_score: riskScore,
              risk_level: riskLevel,
              message:
                finding_id
                  ? `Finding "${finding_id}" not found in this workflow.`
                  : "No blocking or warning findings in this validation run — clean pass.",
              explanations: [],
            }),
          );
        }

        const signalEmoji: Record<string, string> = {
          BLOCK: "🔴", WARN: "🟡", PASS: "🟢",
        };
        const headerSignal = signalEmoji[String(riskLevel)] ?? "⬜";

        const lines: string[] = [
          `## ${headerSignal} TestNeo — Failure Explanation`,
          `**Workflow:** \`${workflow_id}\` · **Risk:** ${riskScore ?? "?"}/100 ${riskLevel} · **Mode:** ${executionMode}`,
          "",
        ];

        for (let idx = 0; idx < targetFindings.length; idx++) {
          const f = targetFindings[idx] as Record<string, unknown>;
          const fid = String(f.id ?? `finding-${idx + 1}`);
          const isBlocking = f.blocking === true;
          const status = String(f.status ?? "warning");
          const severity = String(f.severity ?? "medium");
          const confidence = typeof f.confidence === "number" ? Math.round(f.confidence * 100) : "?";
          const flow = String(f.flow ?? "unknown");
          const title = String(f.title ?? flow);
          const issue = String(f.issue ?? "");
          const rootCauseHint = String(f.rootCauseHint ?? "");
          const changedFileHints = Array.isArray(f.changedFileHints) ? (f.changedFileHints as string[]) : [];
          const relatedTestIds = Array.isArray(f.relatedTestIds) ? (f.relatedTestIds as number[]) : [];
          const suggestedFixes = Array.isArray(f.suggestedFixes) ? (f.suggestedFixes as string[]) : [];

          const statusIcon = isBlocking ? "🚫 BLOCKING" : status === "passed" ? "✅ PASSED" : "⚠️ WARNING";
          lines.push(`### Finding ${idx + 1}: ${statusIcon} — ${title}`);
          lines.push(
            `**Flow:** \`${flow}\` · **Severity:** ${severity} · **Confidence:** ${confidence}%`,
          );
          lines.push("");

          // Issue description
          if (issue) {
            lines.push("**What this check found:**");
            lines.push(issue);
            lines.push("");
          }

          // Root cause
          const rootCause = rootCauseHint || issue.split(".")[0] || "See changed files below.";
          lines.push("**Root cause:**");
          lines.push(rootCause);
          lines.push("");

          // Changed files context
          if (changedFileHints.length > 0) {
            lines.push("**Changed files involved:**");
            for (const fp of changedFileHints.slice(0, 6)) {
              lines.push(`- \`${fp}\``);
            }
            lines.push("");
          }

          // Historical signals from ai analysis if present
          const aiAnalysis = ctx.ai as Record<string, unknown> | undefined;
          const rootCauseEntry = (Array.isArray(aiAnalysis?.rootCauses) ? aiAnalysis!.rootCauses as Array<Record<string, unknown>> : [])
            .find((rc) => rc.findingId === fid);

          if (rootCauseEntry) {
            if (rootCauseEntry.probableCause && String(rootCauseEntry.probableCause) !== rootCause) {
              lines.push("**Historical + component signal:**");
              lines.push(String(rootCauseEntry.probableCause));
              lines.push("");
            }
            if (rootCauseEntry.rationale) {
              lines.push("**Rationale:**");
              lines.push(String(rootCauseEntry.rationale));
              lines.push("");
            }
          }

          // Related test IDs
          if (relatedTestIds.length > 0) {
            lines.push(
              `**Related test IDs:** ${relatedTestIds.slice(0, 8).join(", ")}`,
            );
            lines.push("");
          }

          // What to do
          if (suggestedFixes.length > 0) {
            lines.push("**What to do:**");
            suggestedFixes.slice(0, 4).forEach((fix, i) => {
              lines.push(`${i + 1}. ${fix}`);
            });
            lines.push("");
          }

          if (idx < targetFindings.length - 1) lines.push("---");
          lines.push("");
        }

        // Rerun plan
        if (include_rerun_plan) {
          const allTestIds = targetFindings.flatMap(
            (f) =>
              Array.isArray((f as Record<string, unknown>).relatedTestIds)
                ? ((f as Record<string, unknown>).relatedTestIds as number[])
                : [],
          );
          const uniqueTestIds = [...new Set(allTestIds)].slice(0, 20);

          lines.push("## 🔁 Next Steps");
          lines.push("1. Review the changed files listed above and address root causes.");
          if (uniqueTestIds.length > 0) {
            lines.push(
              `2. Run impacted tests by ID to verify fixes: \`[${uniqueTestIds.join(", ")}]\``,
            );
            lines.push(
              "   → Use \`testneo_execute_generated_test_case\` or \`testneo_run_batch_by_tags\`.",
            );
          }
          lines.push(
            `3. Re-validate the PR: call \`testneo_validate_pr\` again with the same ` +
            `repository and PR number after fixes are pushed.`,
          );
          lines.push(
            "4. View the full board: call `testneo_get_pr_validation_detail` with " +
            `workflow_id \`${workflow_id}\`.`,
          );
        }

        return result(lines.join("\n"));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    },
  );

  registerTracedTool(
    "testneo_suggest_fix",
    {
      description:
        "Returns a prioritised, actionable fix plan from a PR validation run. " +
        "Separates findings into NOW (blocking — must fix before merge) and NEXT (warning — safe to defer). " +
        "Each fix includes: which files to change, what to look for, how to verify the fix, and which " +
        "tests to rerun. Ends with a concrete rerun strategy so the developer knows exactly what to " +
        "execute to confirm the PR is safe. Designed as a follow-up to testneo_validate_pr or " +
        "testneo_explain_failure. Read-only.",
      inputSchema: z.object({
        workflow_id: z.string().min(1).describe("Workflow ID from a testneo_validate_pr run."),
        priority_filter: z
          .enum(["now", "next", "all"])
          .default("all")
          .describe(
            "'now' = blocking fixes only, 'next' = warning fixes only, 'all' = both. Default: all.",
          ),
      }),
    },
    async ({ workflow_id, priority_filter }) => {
      try {
        const contextResp = await client.request<Record<string, unknown>>(
          `/api/web/v1/workflow-contexts/${encodeURIComponent(workflow_id)}`,
        );
        const ctx = contextResp?.context as Record<string, unknown> | undefined;
        if (!ctx) {
          return result(
            asText({
              error: "not_found",
              workflow_id,
              message: "No validation run found. Run testneo_validate_pr first.",
            }),
          );
        }

        const findings = Array.isArray(ctx.findings)
          ? (ctx.findings as Array<Record<string, unknown>>)
          : [];
        const riskScore = (ctx.metadata as Record<string, unknown> | undefined)?.risk_score;
        const riskLevel = (ctx.metadata as Record<string, unknown> | undefined)?.risk_level ?? "PASS";
        const aiAnalysis = ctx.ai as Record<string, unknown> | undefined;
        const aiFixSuggestions = Array.isArray(aiAnalysis?.suggestedFixes)
          ? (aiAnalysis!.suggestedFixes as Array<Record<string, unknown>>)
          : [];

        const blockingFindings = findings.filter((f) => f.blocking === true);
        const warningFindings = findings.filter(
          (f) => f.blocking !== true && f.status === "warning",
        );

        const mergeRec = String(aiAnalysis?.mergeRecommendation ?? "hold");
        const recLabel: Record<string, string> = {
          merge: "✅ Safe to merge",
          merge_with_followup: "⚠️ Merge with follow-up",
          hold: "🟡 Hold — run validation before merging",
          request_changes: "🚫 Request changes — blocking issues must be resolved",
        };

        const lines: string[] = [
          `## 🔧 TestNeo — Fix Suggestions`,
          `**Workflow:** \`${workflow_id}\` · **Risk:** ${riskScore ?? "?"}/100 ${riskLevel}`,
          `**Merge recommendation:** ${recLabel[mergeRec] ?? mergeRec}`,
          `**Findings:** ${blockingFindings.length} blocking (NOW) · ${warningFindings.length} warnings (NEXT)`,
          "",
        ];

        // ── NOW: Blocking fixes ──────────────────────────────────────────────
        if (
          (priority_filter === "now" || priority_filter === "all") &&
          blockingFindings.length > 0
        ) {
          lines.push("---");
          lines.push("### 🚫 NOW — Fix before merging (blocking)");
          lines.push("");

          blockingFindings.forEach((f, idx) => {
            const fid = String(f.id ?? `finding-${idx + 1}`);
            const flow = String(f.flow ?? "unknown");
            const changedFileHints = Array.isArray(f.changedFileHints)
              ? (f.changedFileHints as string[])
              : [];
            const relatedTestIds = Array.isArray(f.relatedTestIds)
              ? (f.relatedTestIds as number[])
              : [];
            const suggestedFixes = Array.isArray(f.suggestedFixes)
              ? (f.suggestedFixes as string[])
              : [];

            // Look up the AI-generated fix for this finding
            const aiFix = aiFixSuggestions.find((af) => af.findingId === fid);

            lines.push(
              `**${idx + 1}. Fix \`${flow}\`** — finding \`${fid}\``,
            );

            if (aiFix?.fix) {
              lines.push(`→ ${String(aiFix.fix)}`);
            } else if (suggestedFixes.length > 0) {
              lines.push(`→ ${suggestedFixes[0]}`);
            }

            if (changedFileHints.length > 0) {
              lines.push(
                `   **Files to review:** ${changedFileHints.slice(0, 4).map((fp) => `\`${fp}\``).join(", ")}`,
              );
            }

            if (relatedTestIds.length > 0) {
              lines.push(
                `   **Verify with tests:** ${relatedTestIds.slice(0, 6).join(", ")}`,
              );
            }

            // Additional fix hints from the finding
            if (suggestedFixes.length > 1) {
              for (const fix of suggestedFixes.slice(1, 3)) {
                lines.push(`   • ${fix}`);
              }
            }

            lines.push("");
          });
        }

        // ── NEXT: Warning fixes ──────────────────────────────────────────────
        if (
          (priority_filter === "next" || priority_filter === "all") &&
          warningFindings.length > 0
        ) {
          lines.push("---");
          lines.push("### ⚠️ NEXT — Review after merging (warnings)");
          lines.push("");

          warningFindings.slice(0, 6).forEach((f, idx) => {
            const fid = String(f.id ?? `finding-${idx + 1}`);
            const flow = String(f.flow ?? "unknown");
            const relatedTestIds = Array.isArray(f.relatedTestIds)
              ? (f.relatedTestIds as number[])
              : [];
            const aiFix = aiFixSuggestions.find((af) => af.findingId === fid);
            const fallbackFix = Array.isArray(f.suggestedFixes) ? (f.suggestedFixes as string[])[0] : undefined;

            lines.push(`**${idx + 1}. Review \`${flow}\`** — finding \`${fid}\``);
            if (aiFix?.fix) {
              lines.push(`→ ${String(aiFix.fix)}`);
            } else if (fallbackFix) {
              lines.push(`→ ${fallbackFix}`);
            }

            if (relatedTestIds.length > 0) {
              lines.push(
                `   **Monitor tests:** ${relatedTestIds.slice(0, 4).join(", ")}`,
              );
            }
            lines.push("");
          });
        }

        if (blockingFindings.length === 0 && warningFindings.length === 0) {
          lines.push("✅ No fixes required — this validation passed with no blocking or warning findings.");
          lines.push("");
        }

        // ── Rerun strategy ───────────────────────────────────────────────────
        lines.push("---");
        lines.push("### 🔁 Rerun Strategy");
        lines.push("");

        const allBlockingTestIds = [
          ...new Set(
            blockingFindings.flatMap((f) =>
              Array.isArray(f.relatedTestIds) ? (f.relatedTestIds as number[]) : [],
            ),
          ),
        ].slice(0, 20);

        if (allBlockingTestIds.length > 0) {
          lines.push(
            `**After fixing blocking issues:** rerun test IDs \`[${allBlockingTestIds.join(", ")}]\``,
          );
          lines.push(
            "  → `testneo_run_batch_by_tags` with tags matching these tests, or",
          );
          lines.push(
            "  → `testneo_execute_generated_test_case` for individual tests.",
          );
          lines.push("");
        }

        lines.push(
          "**To re-validate the full PR** after fixes are pushed, call:",
        );
        lines.push(
          "```\ntestneo_validate_pr with the same repository, pr_number, and updated head_sha\n```",
        );
        lines.push("");

        const repoOwner = (ctx.repository as Record<string, unknown> | undefined)?.owner;
        const repoName = (ctx.repository as Record<string, unknown> | undefined)?.name;
        const prNumber = (ctx.repository as Record<string, unknown> | undefined)?.prNumber;

        if (repoOwner && repoName && prNumber) {
          lines.push(
            `**Repository:** \`${repoOwner}/${repoName}\` · **PR:** #${prNumber}`,
          );
        }

        lines.push(
          "**View full board:** `testneo_get_pr_validation_detail` with " +
          `workflow_id \`${workflow_id}\``,
        );

        return result(lines.join("\n"));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    },
  );

  registerTracedTool(
    "testneo_pr_validation_workflow",
    {
      description:
        "One-shot FAANG-level PR validation workflow for Cursor / VS Code. " +
        "Runs the full TestNeo validation pipeline — impact analysis, risk scoring, test execution " +
        "(when writes are allowed), DataDriven analysis — then inline-generates human-quality " +
        "failure explanations and an actionable fix plan, all in a single call. " +
        "Returns a structured 'Release Brief' the developer can act on immediately in the IDE: " +
        "risk score, impacted flows, per-finding root cause, prioritised fixes, and a rerun plan. " +
        "Use this as the primary entry point for any 'validate my PR / check my branch' workflow. " +
        "write: requires confirm=true + TESTNEO_MCP_ALLOW_WRITE=true to execute tests; " +
        "planning + risk scoring always runs regardless.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        repository: z.object({
          owner: z.string().min(1),
          name: z.string().min(1),
        }),
        pull_request: z.object({
          number: z.number().int().positive(),
          url: z.string().url().optional(),
        }),
        git: z.object({
          base_sha: z.string().min(7),
          head_sha: z.string().min(7),
          diff_content: z.string().optional(),
          changed_files: z
            .array(
              z.object({
                path: z.string().min(1),
                status: z
                  .enum(["added", "modified", "deleted", "renamed"])
                  .default("modified"),
                additions: z.number().int().optional(),
                deletions: z.number().int().optional(),
                language: z.string().optional(),
              }),
            )
            .optional(),
        }),
        execution: z
          .object({
            run_impacted_tests: z.boolean().default(true),
            mode: z.enum(["local", "cloud"]).optional(),
            platform: z.string().optional(),
          })
          .default({}),
        confirm: z
          .boolean()
          .default(false)
          .describe("Set true + TESTNEO_MCP_ALLOW_WRITE=true to execute impacted tests."),
        engineering_memory_csv_path: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Optional: ingest this bug CSV into Engineering Memory before validation " +
            "(workspace-relative path, e.g. bugs/orders_incidents.csv).",
          ),
        engineering_memory_csv_base64: z.string().min(1).optional(),
        engineering_memory_csv_filename: z.string().min(1).max(512).optional(),
        sync_jira_before_validate: z
          .boolean()
          .default(true)
          .describe(
            "When true (default), sync Jira bugs/incidents into Engineering Memory before validation. " +
            "Requires Jira connected on the project; skipped silently if not.",
          ),
        jira_sync_max_issues: z.number().int().min(1).max(200).default(50).optional(),
        jira_sync_lookback_days: z.number().int().min(1).max(365).default(90).optional(),
        idempotency_key: z.string().min(8).max(128).optional(),
      }),
    },
    async (params) => {
      try {
        // ── Step 0a (default): Sync Jira → Engineering Memory ───────────────
        let jiraSyncSummary: Record<string, unknown> | undefined;
        if (params.sync_jira_before_validate !== false) {
          try {
            const jiraIngest = await syncJiraEngineeringMemory(client, params.project_id, {
              max_issues: params.jira_sync_max_issues ?? 50,
              lookback_days: params.jira_sync_lookback_days ?? 90,
            });
            jiraSyncSummary = wrapEngineeringMemoryJira({
              success: true,
              synced: true,
              created: jiraIngest.created ?? 0,
              updated: jiraIngest.updated ?? 0,
              skipped_rows: jiraIngest.skipped ?? 0,
            });
          } catch (jiraErr) {
            const msg = jiraErr instanceof Error ? jiraErr.message : String(jiraErr);
            jiraSyncSummary = wrapEngineeringMemoryJira({
              success: true,
              synced: false,
              skipped: true,
              skip_reason: msg.slice(0, 200),
            });
          }
        }

        // ── Step 0b (optional): Ingest bug CSV into Engineering Memory ───────
        let memoryIngestSummary: Record<string, unknown> | undefined;
        const memPath = params.engineering_memory_csv_path?.trim();
        const memB64 = params.engineering_memory_csv_base64?.trim();
        const memFn = params.engineering_memory_csv_filename?.trim();

        if (memPath || memB64) {
          if (memB64 && !memFn) {
            return result(
              asText({
                contract_version: "pr_validation_workflow.v1",
                success: false,
                error:
                  "engineering_memory_csv_filename is required when using engineering_memory_csv_base64.",
              }),
            );
          }
          const csvPayload = memPath
            ? await resolveBugCsvSource({ kind: "path", csv_path: memPath })
            : await resolveBugCsvSource({
                kind: "base64",
                csv_file_base64: memB64!,
                csv_filename: memFn!,
              });
          if (!csvPayload.ok) {
            return result(
              asText({
                contract_version: "pr_validation_workflow.v1",
                success: false,
                error: `Engineering Memory CSV ingest failed: ${csvPayload.error}`,
              }),
            );
          }
          const ingest = await ingestEngineeringMemoryCsv(
            client,
            params.project_id,
            csvPayload.blob,
            csvPayload.filename,
          );
          memoryIngestSummary = wrapEngineeringMemoryCsv({
            success: true,
            filename: csvPayload.filename,
            csv_sha256: csvPayload.sha256,
            created: ingest.created ?? 0,
            updated: ingest.updated ?? 0,
            skipped: ingest.skipped ?? 0,
          });
        }

        // ── Step 1: Run full orchestration with DataDrivenClaudeAnalyzer ────
        const orchestrator = new PrValidationOrchestrator({
          store: workflowStore,
          impactAnalyzer,
          claudeAnalyzer: new DataDrivenClaudeAnalyzer(),
          incidentContextAdapter,
          testExecutor: testExecutionAdapter,
          enableTestExecution: deps.allowWriteTools,
        });

        const validation = await orchestrator.validatePr({
          ...params,
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
        });

        const {
          workflow_id,
          ai_ready_summary,
          impact_summary,
          findings,
          claude_analysis,
          comment_draft,
          metadata,
        } = validation;

        const riskScore = ai_ready_summary.risk_score;
        const riskLevel = ai_ready_summary.risk_level;
        const mergeSignal = ai_ready_summary.merge_signal;
        const blockingCount = ai_ready_summary.blocking_count;
        const warningCount = ai_ready_summary.warning_count;
        const passedCount = ai_ready_summary.passed_count;
        const incidentContext = ai_ready_summary.incident_context;

        const SIGNAL_EMOJI: Record<string, string> = {
          block: "🔴", review: "🟡", clean: "🟢",
        };
        const headerEmoji = SIGNAL_EMOJI[mergeSignal] ?? "⬜";

        const recLabel: Record<string, string> = {
          merge: "Safe to merge",
          merge_with_followup: "Merge with follow-up",
          hold: "Hold — run validation stages before merging",
          request_changes: "Request changes — resolve blocking issues first",
        };
        const rec = claude_analysis?.mergeRecommendation ?? "hold";

        const prRef = `${params.repository.owner}/${params.repository.name} #${params.pull_request.number}`;

        // ── Build Release Brief ──────────────────────────────────────────────
        const lines: string[] = [];

        // Header
        lines.push(
          `# ${headerEmoji} TestNeo Release Brief — ${riskLevel} (${riskScore}/100)`,
        );
        lines.push(`**${prRef}** · workflow \`${workflow_id}\``);
        lines.push("");

        if (jiraSyncSummary?.synced) {
          const created = jiraSyncSummary.created ?? 0;
          const updated = jiraSyncSummary.updated ?? 0;
          lines.push("## 📥 Engineering Memory (Jira synced before validation)");
          lines.push(
            `Pulled latest Jira bugs/incidents — ${created} new, ${updated} updated. ` +
              "Matches below use fresh memory against your changed files.",
          );
          lines.push("");
        } else if (jiraSyncSummary && params.sync_jira_before_validate !== false) {
          lines.push("## 📥 Engineering Memory (Jira sync skipped)");
          lines.push(
            `No Jira sync (${String(jiraSyncSummary.skip_reason || "not connected")}). ` +
              "Existing memory entries still used for matching.",
          );
          lines.push("");
        }

        if (memoryIngestSummary) {
          const created = memoryIngestSummary.created ?? 0;
          const updated = memoryIngestSummary.updated ?? 0;
          lines.push("## 📥 Engineering Memory (CSV ingested before validation)");
          lines.push(
            `Loaded **${String(memoryIngestSummary.filename)}** — ` +
              `${created} new, ${updated} updated incident(s). ` +
              "Matches below use this fresh memory against your changed files.",
          );
          lines.push("");
        }

        // AI Summary
        if (claude_analysis?.summary) {
          lines.push(claude_analysis.summary);
          lines.push("");
        }

        // ── Impact Overview ──────────────────────────────────────────────────
        lines.push("## 📊 Impact Overview");
        lines.push(
          `| Metric | Value |`,
        );
        lines.push(`|--------|-------|`);
        lines.push(`| Changed files | ${impact_summary.changed_files} |`);
        lines.push(`| Impacted flows | ${impact_summary.impacted_flows} |`);
        lines.push(`| Impacted tests | ${impact_summary.impacted_tests} |`);
        lines.push(`| Blocking findings | ${blockingCount} |`);
        lines.push(`| Warning findings | ${warningCount} |`);
        lines.push(`| Passed findings | ${passedCount} |`);
        lines.push(
          `| Execution mode | ${metadata.execution_mode} |`,
        );
        lines.push(`| Risk score | **${riskScore}/100** |`);
        lines.push(`| Merge signal | **${headerEmoji} ${mergeSignal.toUpperCase()}** |`);
        lines.push("");

        // ── Risk Factor Breakdown ────────────────────────────────────────────
        if (ai_ready_summary.risk_factors.length > 0) {
          lines.push("## 📈 Risk Factor Breakdown");
          for (const factor of ai_ready_summary.risk_factors) {
            const bar =
              "█".repeat(Math.round(factor.score / 10)) +
              "░".repeat(10 - Math.round(factor.score / 10));
            lines.push(
              `- **${factor.factor.replace(/_/g, " ")}** \`${bar}\` ${factor.score}/100 — ${factor.explanation}`,
            );
          }
          lines.push("");
        }

        // ── Component Health ─────────────────────────────────────────────────
        const componentHealth = ai_ready_summary.component_health;
        if (componentHealth && componentHealth.length > 0) {
          const highRisk = componentHealth.filter(
            (c) => (c.failure_rate_7d ?? 0) >= 0.2 || c.risk_level === "HIGH",
          );
          if (highRisk.length > 0) {
            lines.push("## 🏥 Component Risk Snapshot");
            lines.push("| Component | 7d Failure Rate | Trend | Risk |");
            lines.push("|-----------|----------------|-------|------|");
            const TREND_ARROW: Record<string, string> = {
              worsening: "↑ worse", improving: "↓ better",
              stable: "→ stable", insufficient_data: "—",
            };
            const RISK_ICON: Record<string, string> = {
              HIGH: "🔴", MEDIUM: "🟡", LOW: "🟢", UNKNOWN: "⬜",
            };
            for (const c of highRisk.slice(0, 6)) {
              const rate =
                c.failure_rate_7d != null
                  ? `${Math.round(c.failure_rate_7d * 100)}%`
                  : "—";
              const trend = TREND_ARROW[c.trend ?? ""] ?? "—";
              const riskIcon = RISK_ICON[c.risk_level ?? ""] ?? "⬜";
              lines.push(`| ${c.component} | ${rate} | ${trend} | ${riskIcon} ${c.risk_level ?? "?"} |`);
            }
            lines.push("");
          }
        }

        // ── Historical Incident Matches (Engineering Memory) ─────────────────
        if (incidentContext) {
          const TIER_EMOJI: Record<string, string> = {
            high: "🔴", medium: "🟡", low: "🟢", none: "⬜",
          };
          const tierEmoji = TIER_EMOJI[incidentContext.match_tier] ?? "⬜";
          lines.push(
            `## 🔁 Historical Incident Matches — ${tierEmoji} ${incidentContext.match_count} found ` +
            `(score ${incidentContext.incident_match_score}/100)`,
          );
          lines.push("");
          if (incidentContext.insight) {
            lines.push(incidentContext.insight);
            lines.push("");
          }
          if (incidentContext.top_resolution?.action) {
            const tr = incidentContext.top_resolution;
            const rateNote =
              tr.success_rate != null
                ? ` · ${Math.round(tr.success_rate * 100)}% success`
                : "";
            const timeNote =
              tr.avg_resolve_minutes != null ? ` · ~${tr.avg_resolve_minutes} min avg` : "";
            lines.push(
              `**Top prior fix:** ${tr.action}${rateNote}${timeNote} (${tr.cases_count} case(s))`,
            );
            lines.push("");
          }
          for (let i = 0; i < Math.min(incidentContext.matches.length, 5); i++) {
            const m = incidentContext.matches[i];
            const typeLabel = m.match_type.replace(/_/g, " ");
            lines.push(
              `${i + 1}. **${m.title}** — ${typeLabel} · match ${m.match_score}/100 (${m.match_tier})`,
            );
            lines.push(`   ${m.description}`);
            if (m.resolution_action) {
              lines.push(`   ↳ Fix: ${m.resolution_action}`);
            }
            if (m.workflow_id) {
              lines.push(`   ↳ Prior workflow: \`${m.workflow_id}\``);
            }
            lines.push("");
          }
          if (incidentContext.match_count === 0) {
            lines.push(
              "_No prior incidents for this change set — TestNeo will remember this validation for next time._",
            );
            lines.push("");
          }
        }

        // ── Findings: Blocking ───────────────────────────────────────────────
        const blockingFindings = findings.filter((f) => f.blocking);
        if (blockingFindings.length > 0) {
          lines.push("## 🚫 Blocking Findings — Must Resolve Before Merge");
          lines.push("");

          for (let i = 0; i < blockingFindings.length; i++) {
            const f = blockingFindings[i];
            const rootCauseEntry = (claude_analysis?.rootCauses ?? []).find(
              (rc) => rc.findingId === f.id,
            );
            lines.push(`### ${i + 1}. ${f.title}`);
            lines.push(
              `**Flow:** \`${f.flow}\` · **Severity:** ${f.severity} · **Confidence:** ${Math.round(f.confidence * 100)}%`,
            );
            lines.push("");

            if (rootCauseEntry?.probableCause) {
              lines.push("**Root cause:**");
              lines.push(rootCauseEntry.probableCause);
              lines.push("");
            } else if (f.rootCauseHint) {
              lines.push("**Root cause:**");
              lines.push(f.rootCauseHint);
              lines.push("");
            }

            lines.push(f.issue);
            lines.push("");

            if (f.changedFileHints.length > 0) {
              lines.push(
                `**Files:** ${f.changedFileHints.slice(0, 4).map((fp) => `\`${fp}\``).join(", ")}`,
              );
            }

            if (f.relatedTestIds.length > 0) {
              lines.push(`**Test IDs:** ${f.relatedTestIds.slice(0, 6).join(", ")}`);
            }
            lines.push("");

            // Fixes from AI analysis first, else from finding
            const aiFix = (claude_analysis?.suggestedFixes ?? []).find(
              (sf) => sf.findingId === f.id,
            );
            if (aiFix?.fix) {
              lines.push(`**Fix:** ${aiFix.fix}`);
            } else if (f.suggestedFixes.length > 0) {
              lines.push(`**Fix:** ${f.suggestedFixes[0]}`);
            }
            lines.push("");
          }
        }

        // ── Findings: Warnings ───────────────────────────────────────────────
        const warningFindings = findings.filter(
          (f) => !f.blocking && f.status === "warning",
        );
        if (warningFindings.length > 0) {
          lines.push("## ⚠️ Warning Findings — Review Before or After Merge");
          lines.push("");

          for (let i = 0; i < Math.min(warningFindings.length, 6); i++) {
            const f = warningFindings[i];
            const aiFix = (claude_analysis?.suggestedFixes ?? []).find(
              (sf) => sf.findingId === f.id,
            );
            lines.push(
              `**${i + 1}. \`${f.flow}\`** — ${f.title} ` +
              `(severity: ${f.severity} · confidence: ${Math.round(f.confidence * 100)}%)`,
            );
            if (aiFix?.fix ?? f.suggestedFixes[0]) {
              lines.push(`  → ${aiFix?.fix ?? f.suggestedFixes[0]}`);
            }
            if (f.relatedTestIds.length > 0) {
              lines.push(`  → Monitor test IDs: ${f.relatedTestIds.slice(0, 4).join(", ")}`);
            }
            lines.push("");
          }
          if (warningFindings.length > 6) {
            lines.push(
              `_…and ${warningFindings.length - 6} more warnings. Call \`testneo_explain_failure\` ` +
              `with workflow_id \`${workflow_id}\` for full details._`,
            );
            lines.push("");
          }
        }

        // ── Recommendation ───────────────────────────────────────────────────
        lines.push("---");
        lines.push("## 🎯 Recommendation");
        lines.push(`**${headerEmoji} ${recLabel[rec] ?? rec}**`);
        lines.push("");

        if (claude_analysis?.suggestedFixes && claude_analysis.suggestedFixes.length > 0) {
          const nowFixes = claude_analysis.suggestedFixes.filter((sf) => sf.priority === "now");
          const nextFixes = claude_analysis.suggestedFixes.filter((sf) => sf.priority === "next");
          if (nowFixes.length > 0) {
            lines.push("**Fix now (blocking):**");
            for (const sf of nowFixes.slice(0, 4)) {
              lines.push(`- ${sf.fix}`);
            }
            lines.push("");
          }
          if (nextFixes.length > 0) {
            lines.push("**Fix next (warnings):**");
            for (const sf of nextFixes.slice(0, 3)) {
              lines.push(`- ${sf.fix}`);
            }
            lines.push("");
          }
        }

        // ── Comment Draft ────────────────────────────────────────────────────
        if (comment_draft) {
          lines.push("<details>");
          lines.push("<summary>📋 PR Comment Draft (copy to GitHub)</summary>");
          lines.push("");
          lines.push(comment_draft);
          lines.push("</details>");
          lines.push("");
        }

        // ── Next Tools ───────────────────────────────────────────────────────
        lines.push("---");
        lines.push("## ⚡ Next Actions");
        lines.push("");
        if (blockingCount > 0) {
          lines.push(
            `- Deep-dive on failures: \`testneo_explain_failure\` with workflow_id \`${workflow_id}\``,
          );
          lines.push(
            `- Full fix plan: \`testneo_suggest_fix\` with workflow_id \`${workflow_id}\``,
          );
        }
        lines.push(
          `- Full validation board: \`testneo_get_pr_validation_detail\` with workflow_id \`${workflow_id}\``,
        );
        lines.push(
          `- History for this project: \`testneo_get_pr_validation_history\` with project_id \`${params.project_id}\``,
        );
        if (blockingCount === 0 && warningCount === 0) {
          lines.push("- ✅ All clear — this PR is ready to merge.");
        }
        lines.push("");
        lines.push(
          `_Powered by [TestNeo](https://testneo.ai) · workflow \`${workflow_id}\`_`,
        );

        return result(lines.join("\n"));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    },
  );

  registerTracedTool(
    "testneo_developer_release_workflow",
    {
      description:
        "IDE-agnostic end-to-end developer release workflow — works in Cursor, Claude Code, VS Code, Windsurf, or any MCP client. " +
        "Orchestrates: optional Jira/CSV Engineering Memory ingest → optional auto-generate tests for unmapped diff functions → " +
        "full PR validation (impact, execute, risk PASS/WARN/BLOCK) → optional Release Bundle + gate evaluation. " +
        "Single call replaces 3–5 separate MCP tools. Planning + risk scoring always run; set confirm=true + TESTNEO_MCP_ALLOW_WRITE=true to execute tests. " +
        "Pass execution.mode/platform for cloud (e.g. saucelabs) or local agent routing.",
      inputSchema: DeveloperReleaseWorkflowInputSchema,
    },
    async (params) => {
      try {
        const resolvedMode =
          params.execution?.mode ?? batchExecutionDefaults.defaultExecutionMode;
        const resolvedPlatform =
          params.execution?.platform ?? batchExecutionDefaults.defaultExecutionPlatform;
        return await runDeveloperReleaseWorkflow(params, {
          client,
          store: workflowStore,
          impactAnalyzer,
          testExecutor: testExecutionAdapter,
          incidentContextAdapter,
          allowWriteTools: deps.allowWriteTools,
          executionRouting: {
            resolved_mode: resolvedMode,
            resolved_platform: resolvedPlatform,
            use_local_agent: shouldPostUseAgentToExecuteApi(),
            write_tools_enabled: deps.allowWriteTools,
            confirm_requested: params.confirm === true,
          },
          asText,
          result,
        });
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    },
  );

  registerTracedTool(
    "testneo_get_local_agent_status",
    {
      description:
        "Returns whether a TestNeo self-hosted agent is registered and recently heartbeating (local runner). Includes setup_url on the same origin as TESTNEO_BASE_URL (for example …/web/agent). Read-only.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        return result(asText(await readLocalAgentSafePayload()));
      } catch (e) {
        if (e instanceof TestNeoApiError && e.status === 404) {
          return result(
            asText({
              contract_version: "testneo_mcp_agent_status.v1",
              agent_registered: false,
              agent_connected: false,
              setup_url: agentSetupUrl,
              message: "No self-hosted agent registered for this account yet.",
              next_steps: [
                `Open ${agentSetupUrl} to install or connect the agent.`,
                "After the agent runs, expect a heartbeat within about a minute.",
              ],
            })
          );
        }
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  registerTracedTool(
    "testneo_list_tests_by_tags",
    {
      description:
        "List web test case ids for a project matching one or more tags. Tags may include a leading @; each tag is queried separately (union with tag_match=any, intersection with all). Backend: GET /api/web/v1/test-cases/?tag_filter= (one tag per request).",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        tags: z.array(z.string().min(1)).min(1).max(40),
        tag_match: z.enum(["any", "all"]).default("any"),
      }),
    },
    async ({ project_id, tags, tag_match }) => {
      try {
        const normalized = normalizeMcpTagList(tags);
        if (!normalized.length) {
          return result(
            asText({
              contract_version: "testneo_mcp_tag_list.v1",
              error: "no_tags_after_normalize",
              message: "Provide at least one non-empty tag (with or without a leading @).",
            })
          );
        }
        const { cases, per_tag } = await resolveTestCasesByTags(project_id, normalized, tag_match);
        const counts: Record<string, number> = {};
        for (const t of normalized) counts[t] = per_tag[t]?.length ?? 0;
        return result(
          asText({
            contract_version: "testneo_mcp_tag_list.v1",
            project_id,
            tag_match,
            tags_requested: normalized,
            counts_per_tag: counts,
            test_case_count: cases.length,
            test_cases: cases.map((c) => ({ id: c.id, name: c.name, tags: c.tags })),
          })
        );
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  registerTracedTool(
    "testneo_find_test_cases",
    {
      description:
        "List web test cases in a project using the backend text search (?search= on GET /api/web/v1/test-cases/). Matches name/description per API rules. Read-only — use returned id + name with testneo_run_generated_test_pipeline (test_case_id) or pass project_id + name_query to run by name.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        search: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(200).default(50),
        skip: z.number().int().min(0).default(0),
      }),
    },
    async ({ project_id, search, limit, skip }) => {
      try {
        const resp = await client.request<Record<string, unknown>>("/api/web/v1/test-cases/", {
          query: { project_id, search, limit, skip },
        });
        const items = parseListedWebCasesFromResponse(resp);
        const total = typeof resp.total === "number" ? resp.total : items.length;
        return result(
          asText({
            contract_version: "testneo_mcp_test_case_search.v1",
            project_id,
            search,
            skip,
            limit,
            total,
            count: items.length,
            test_cases: items.map((c) => ({ id: c.id, name: c.name, tags: c.tags })),
          })
        );
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  registerTracedTool(
    "testneo_run_batch_by_tags",
    {
      description:
        "Create and execute a multi-test run for tests matching tags (write: requires TESTNEO_MCP_ALLOW_WRITE + confirm=true). Resolves tags like testneo_list_tests_by_tags, then POST /api/web/v1/multi-test-runs/create and POST …/execute. When TESTNEO_MCP_DEFAULT_EXECUTION_MODE=local and TESTNEO_MCP_PREFER_LOCAL_AGENT=true, sets use_agent for the local TestNeo agent. While use_agent: polls GET /agents/my-agent until connected or until TESTNEO_MCP_WAIT_FOR_AGENT_MS / wait_for_agent_seconds elapses (avoids failing if you start the agent seconds after invoking the tool). Optional TESTNEO_MCP_OPEN_AGENT_SETUP_ON_AGENT_FAILURE opens setup_url on hard agent failure.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        tags: z.array(z.string().min(1)).min(1).max(40),
        tag_match: z.enum(["any", "all"]).default("any"),
        confirm: z.boolean().default(false),
        idempotency_key: z.string().min(8).max(128).optional(),
        run_name: z.string().min(1).max(200).optional(),
        notes: z.string().max(2000).optional(),
        parallel: z.boolean().default(false),
        max_workers: z.number().int().min(1).max(50).optional(),
        environment_variables: z.record(z.string()).optional(),
        execution_settings: z.record(z.string(), z.unknown()).optional(),
        /** Overrides TESTNEO_MCP_WAIT_FOR_AGENT_MS for this call (0–300 seconds). */
        wait_for_agent_seconds: z.number().int().min(0).max(300).optional(),
      }),
    },
    async ({
      project_id,
      tags,
      tag_match,
      confirm,
      idempotency_key,
      run_name,
      notes,
      parallel,
      max_workers,
      environment_variables,
      execution_settings,
      wait_for_agent_seconds,
    }) => {
      if (!deps.allowWriteTools) {
        return result(
          "Write tools are disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to create and execute multi-test runs."
        );
      }
      if (!confirm) {
        return result(
          asText({
            contract_version: "testneo_mcp_batch_run.v1",
            mode: "preview",
            message:
              "Set confirm=true to create and execute a multi-test run for tests matching the given tags.",
            project_id,
            tags,
            tag_match,
            wait_for_agent_seconds: wait_for_agent_seconds ?? null,
            wait_for_agent_ms_env: batchExecutionDefaults.waitForAgentMs,
            requires_env: "TESTNEO_MCP_ALLOW_WRITE=true",
          })
        );
      }

      const normalized = normalizeMcpTagList(tags);
      if (!normalized.length) {
        return result(
          asText({
            contract_version: "testneo_mcp_batch_run.v1",
            error: "no_tags_after_normalize",
            message: "Provide at least one non-empty tag (with or without a leading @).",
          })
        );
      }

      const idem = replayOrConflict("testneo_run_batch_by_tags", idempotency_key, {
        project_id,
        tags: normalized,
        tag_match,
        wait_for_agent_seconds: wait_for_agent_seconds ?? null,
      });
      if (idem.blocked) return idem.blocked;

      try {
        const { cases } = await resolveTestCasesByTags(project_id, normalized, tag_match);
        if (!cases.length) {
          return result(
            asText({
              contract_version: "testneo_mcp_batch_run.v1",
              error: "no_matching_tests",
              project_id,
              tags: normalized,
              tag_match,
              message: "No test cases matched the tag filter for this project.",
            })
          );
        }

        const execOutcome = await executeMultiTestRunCore({
          project_id,
          test_case_ids: cases.map((c) => c.id),
          preserve_test_case_order: false,
          toolName: "testneo_run_batch_by_tags",
          wait_for_agent_seconds,
          run_name,
          notes,
          parallel,
          max_workers,
          environment_variables,
          execution_settings,
          envelope_extra: {
            tags_requested: normalized,
            tag_match,
          },
        });

        if (!execOutcome.ok) return execOutcome.toolResult;

        const payload = execOutcome.payload;

        if (idem.key && idem.fingerprint) {
          recordIdempotency(idem.key, idem.fingerprint, JSON.stringify(payload));
        }
        return result(asText(payload));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  registerTracedTool(
    "testneo_suggest_api_test_chains",
    {
      description:
        "Scan Swagger/NLP-derived API-style web tests for a project and return suggested business-flow chains (ordering, phases, suite summaries). Read-only: GET /api/web/v1/projects/{id}/api-test-chains/suggest. Use before recommending which suite to run or before testneo_save_api_test_chain / testneo_run_api_test_chain.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
      }),
    },
    async ({ project_id }) => {
      try {
        const payload = await client.request<Record<string, unknown>>(
          `/api/web/v1/projects/${encodeURIComponent(String(project_id))}/api-test-chains/suggest`
        );
        const product_navigation = buildMultiTestRunUiNavigationForClient(client, project_id, null);
        return result(
          asText({
            contract_version: "testneo_mcp_api_test_chains.v1",
            kind: "suggest",
            product_navigation: {
              project_manage_url: product_navigation.project_manage_url,
              multi_test_runner_url: product_navigation.multi_test_runner_url,
              note: "After testneo_run_api_test_chain, use ui_navigation.multi_test_runner_url to view the batch in the Multi Test Runner UI.",
            },
            ...payload,
          })
        );
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  registerTracedTool(
    "testneo_list_saved_api_test_chains",
    {
      description:
        "List user-saved API test chain suites for a web project (ordered test_case_ids). Read-only: GET /api/web/v1/projects/{id}/api-test-chains.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
      }),
    },
    async ({ project_id }) => {
      try {
        const payload = await client.request<Record<string, unknown>>(
          `/api/web/v1/projects/${encodeURIComponent(String(project_id))}/api-test-chains`
        );
        return result(
          asText({
            contract_version: "testneo_mcp_api_test_chains.v1",
            kind: "list_saved",
            ...payload,
          })
        );
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  registerTracedTool(
    "testneo_save_api_test_chain",
    {
      description:
        "Persist a named API test chain (ordered NLP/API web tests) for a project. Guarded: TESTNEO_MCP_ALLOW_WRITE + confirm=true. Backend: POST /api/web/v1/projects/{id}/api-test-chains.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        name: z.string().min(1).max(255),
        description: z.string().max(8000).optional(),
        test_case_ids: z.array(z.number().int().positive()).min(1).max(500),
        confirm: z.boolean().default(false),
        idempotency_key: z.string().min(8).max(128).optional(),
      }),
    },
    async ({ project_id, name, description, test_case_ids, confirm, idempotency_key }) => {
      if (!deps.allowWriteTools) {
        return result(
          "Write tools are disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to save API test chains."
        );
      }
      if (!confirm) {
        return result(
          asText({
            contract_version: "testneo_mcp_api_test_chains.v1",
            kind: "save_preview",
            message: "Set confirm=true to save this API test chain.",
            project_id,
            name,
            test_case_ids_count: test_case_ids.length,
          })
        );
      }

      const idem = replayOrConflict("testneo_save_api_test_chain", idempotency_key, {
        project_id,
        name: name.trim(),
        test_case_ids,
      });
      if (idem.blocked) return idem.blocked;

      try {
        const blocked = await gateProjectExecutable(project_id, { toolName: "testneo_save_api_test_chain" });
        if (blocked) return blocked;

        const created = await client.request<Record<string, unknown>>(
          `/api/web/v1/projects/${encodeURIComponent(String(project_id))}/api-test-chains`,
          {
            method: "POST",
            body: {
              name: name.trim(),
              description: description?.trim() || undefined,
              test_case_ids,
            },
          }
        );

        const wrapped = {
          contract_version: "testneo_mcp_api_test_chains.v1",
          kind: "saved",
          ...created,
        };
        if (idem.key && idem.fingerprint) {
          recordIdempotency(idem.key, idem.fingerprint, JSON.stringify(wrapped));
        }
        return result(asText(wrapped));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  registerTracedTool(
    "testneo_delete_saved_api_test_chain",
    {
      description:
        "Delete a saved API test chain by id. Guarded: TESTNEO_MCP_ALLOW_WRITE + confirm=true. Backend: DELETE /api/web/v1/projects/{id}/api-test-chains/{chain_id}.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        chain_id: z.number().int().positive(),
        confirm: z.boolean().default(false),
        idempotency_key: z.string().min(8).max(128).optional(),
      }),
    },
    async ({ project_id, chain_id, confirm, idempotency_key }) => {
      if (!deps.allowWriteTools) {
        return result(
          "Write tools are disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to delete API test chains."
        );
      }
      if (!confirm) {
        return result(
          asText({
            contract_version: "testneo_mcp_api_test_chains.v1",
            kind: "delete_preview",
            message: "Set confirm=true to delete this saved API test chain.",
            project_id,
            chain_id,
          })
        );
      }

      const idem = replayOrConflict("testneo_delete_saved_api_test_chain", idempotency_key, {
        project_id,
        chain_id,
      });
      if (idem.blocked) return idem.blocked;

      try {
        const blocked = await gateProjectExecutable(project_id, { toolName: "testneo_delete_saved_api_test_chain" });
        if (blocked) return blocked;

        const deleted = await client.request<Record<string, unknown>>(
          `/api/web/v1/projects/${encodeURIComponent(String(project_id))}/api-test-chains/${encodeURIComponent(String(chain_id))}`,
          { method: "DELETE" }
        );

        const wrapped = {
          contract_version: "testneo_mcp_api_test_chains.v1",
          kind: "deleted",
          project_id,
          chain_id,
          ...deleted,
        };
        if (idem.key && idem.fingerprint) {
          recordIdempotency(idem.key, idem.fingerprint, JSON.stringify(wrapped));
        }
        return result(asText(wrapped));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  registerTracedTool(
    "testneo_run_api_test_chain",
    {
      description:
        "Create and execute a multi-test run using an ordered API chain: either explicit test_case_ids (preserves order) or saved_chain_id from testneo_list_saved_api_test_chains. Same execution routing as testneo_run_batch_by_tags (local agent wait, use_agent, etc.). Guarded: TESTNEO_MCP_ALLOW_WRITE + confirm=true.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        test_case_ids: z.array(z.number().int().positive()).min(1).max(500).optional(),
        saved_chain_id: z.number().int().positive().optional(),
        confirm: z.boolean().default(false),
        idempotency_key: z.string().min(8).max(128).optional(),
        run_name: z.string().min(1).max(200).optional(),
        notes: z.string().max(2000).optional(),
        parallel: z.boolean().default(false),
        max_workers: z.number().int().min(1).max(50).optional(),
        environment_variables: z.record(z.string()).optional(),
        execution_settings: z.record(z.string(), z.unknown()).optional(),
        wait_for_agent_seconds: z.number().int().min(0).max(300).optional(),
      }),
    },
    async ({
      project_id,
      test_case_ids: idsArg,
      saved_chain_id,
      confirm,
      idempotency_key,
      run_name,
      notes,
      parallel,
      max_workers,
      environment_variables,
      execution_settings,
      wait_for_agent_seconds,
    }) => {
      if (!deps.allowWriteTools) {
        return result(
          "Write tools are disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to run API test chains."
        );
      }
      if (!confirm) {
        return result(
          asText({
            contract_version: "testneo_mcp_batch_run.v1",
            mode: "preview",
            message:
              "Set confirm=true to create and execute a multi-test run for the given API chain (test_case_ids or saved_chain_id).",
            project_id,
            test_case_ids: idsArg ?? null,
            saved_chain_id: saved_chain_id ?? null,
            wait_for_agent_seconds: wait_for_agent_seconds ?? null,
            requires_env: "TESTNEO_MCP_ALLOW_WRITE=true",
          })
        );
      }

      const hasIds = idsArg != null && idsArg.length > 0;
      const hasSaved = saved_chain_id != null && saved_chain_id > 0;
      if (hasIds === hasSaved) {
        return result(
          asText({
            contract_version: "testneo_mcp_batch_run.v1",
            error: "invalid_chain_selector",
            message: "Provide exactly one of: test_case_ids (non-empty) OR saved_chain_id.",
            project_id,
          })
        );
      }

      const idem = replayOrConflict("testneo_run_api_test_chain", idempotency_key, {
        project_id,
        test_case_ids: idsArg ?? null,
        saved_chain_id: saved_chain_id ?? null,
        wait_for_agent_seconds: wait_for_agent_seconds ?? null,
      });
      if (idem.blocked) return idem.blocked;

      try {
        let resolvedIds: number[] | null = idsArg ?? null;
        let chain_label: Record<string, unknown> = {};

        if (saved_chain_id != null) {
          const listed = await client.request<{ chains?: Array<{ id: number; name?: string; test_case_ids?: number[] }> }>(
            `/api/web/v1/projects/${encodeURIComponent(String(project_id))}/api-test-chains`
          );
          const chains = Array.isArray(listed.chains) ? listed.chains : [];
          const row = chains.find((c) => c.id === saved_chain_id);
          if (!row || !Array.isArray(row.test_case_ids) || !row.test_case_ids.length) {
            return result(
              asText({
                contract_version: "testneo_mcp_batch_run.v1",
                error: "saved_chain_not_found",
                project_id,
                saved_chain_id,
                message: "No saved chain with this id for the project, or chain has no tests.",
              })
            );
          }
          resolvedIds = row.test_case_ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
          chain_label = { saved_chain_id, saved_chain_name: row.name ?? null };
        }

        if (!resolvedIds || !resolvedIds.length) {
          return result(
            asText({
              contract_version: "testneo_mcp_batch_run.v1",
              error: "no_test_case_ids",
              project_id,
              ...chain_label,
            })
          );
        }

        const execOutcome = await executeMultiTestRunCore({
          project_id,
          test_case_ids: resolvedIds,
          preserve_test_case_order: true,
          toolName: "testneo_run_api_test_chain",
          wait_for_agent_seconds,
          run_name,
          notes,
          parallel,
          max_workers,
          environment_variables,
          execution_settings,
          envelope_extra: {
            chain_source: saved_chain_id != null ? "saved_chain" : "explicit_test_case_ids",
            ...chain_label,
          },
        });

        if (!execOutcome.ok) return execOutcome.toolResult;

        const payload = execOutcome.payload;

        if (idem.key && idem.fingerprint) {
          recordIdempotency(idem.key, idem.fingerprint, JSON.stringify(payload));
        }
        return result(asText(payload));
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  registerTracedTool(
    "testneo_get_project_route_map",
    {
      description:
        "Get project-level MCP route-hardening map/profile from project_settings.mcp_route_hardening.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
      }),
    },
    async ({ project_id }) => {
      const project = await client.request<Record<string, unknown>>(
        `/api/web/v1/projects/${encodeURIComponent(String(project_id))}`
      );
      const route = parseProjectRouteConfig(project);
      const effective = await runtimeForProjectRouteMap(project_id, deps.routeHardening);
      return result(
        asText({
          project_id,
          settings_key: projectRouteSettingsKey(),
          project_route_hardening: route,
          effective_route_hardening: {
            enabled: effective.enabled,
            profile: effective.profile,
            map_size: Object.keys(effective.customMap).length,
          },
        })
      );
    }
  );

  registerTracedTool(
    "testneo_set_project_route_map",
    {
      description:
        "Persist project-level route-hardening map/profile in project_settings.mcp_route_hardening (guarded write action).",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        profile: z.enum(["none", "saucedemo"]).optional(),
        enabled: z.boolean().optional(),
        extra_map: z.record(z.string(), z.string()).default({}),
        merge_mode: z.enum(["merge", "replace"]).default("merge"),
        confirm: z.boolean().default(false),
        idempotency_key: z.string().min(8).max(128).optional(),
      }),
    },
    async ({ project_id, profile, enabled, extra_map, merge_mode, confirm, idempotency_key }) => {
      const project = await client.request<Record<string, unknown>>(
        `/api/web/v1/projects/${encodeURIComponent(String(project_id))}`
      );
      const current = parseProjectRouteConfig(project);
      const normalizedIncoming = parseProjectRouteConfig({
        project_settings: { [projectRouteSettingsKey()]: { extra_map, profile, enabled } },
      });
      const next: ProjectRouteHardeningConfig = {
        enabled: normalizedIncoming.enabled ?? current.enabled,
        profile: normalizedIncoming.profile ?? current.profile,
        extra_map:
          merge_mode === "replace"
            ? normalizedIncoming.extra_map
            : { ...current.extra_map, ...normalizedIncoming.extra_map },
      };

      if (!deps.allowWriteTools) {
        return result(
          asText({
            message: "Write tools are disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to persist project route map.",
            project_id,
            merge_mode,
            current,
            proposed: next,
          })
        );
      }
      if (!confirm) {
        return result(
          asText({
            message: "Preview mode only. Set confirm=true to persist project route map.",
            project_id,
            merge_mode,
            current,
            proposed: next,
          })
        );
      }
      const idem = replayOrConflict("testneo_set_project_route_map", idempotency_key, {
        project_id,
        profile,
        enabled,
        extra_map,
        merge_mode,
      });
      if (idem.blocked) return idem.blocked;

      const projectSettings = buildProjectSettingsWithRouteMap(project.project_settings, next);
      const updateResp = await client.request<Record<string, unknown>>(
        `/api/web/v1/projects/${encodeURIComponent(String(project_id))}`,
        { method: "PUT", body: { project_settings: projectSettings } }
      );
      projectRouteCache.set(project_id, next);

      const payload = {
        project_id,
        settings_key: projectRouteSettingsKey(),
        merge_mode,
        saved: next,
        update_response: updateResp,
      };
      if (idem.key && idem.fingerprint) recordIdempotency(idem.key, idem.fingerprint, JSON.stringify(payload));
      return result(asText(payload));
    }
  );

  registerTracedTool(
    "testneo_apply_route_hardening",
    {
      description:
        "Rewrite vague Navigate-to NLP lines into {{base_url}}/path using server env (TESTNEO_ROUTE_PROFILE, TESTNEO_ROUTE_MAP_JSON) plus optional per-call overrides. Read-only; does not call the TestNeo API.",
      inputSchema: z.object({
        nlp_commands: z.array(z.string()).min(1),
        route_hardening: routeHardeningToolSchema,
      }),
    },
    async ({ nlp_commands, route_hardening }) => {
      const routeMap = resolveRouteMap(deps.routeHardening, route_hardening);
      const hardened = hardenNavigationCommands(nlp_commands, routeMap);
      return result(
        asText({
          nlp_commands: hardened.commands,
          replacements: hardened.replacements,
          phrase_map_size: Object.keys(routeMap).length,
        })
      );
    }
  );

  registerTracedTool(
    "testneo_swagger_preview",
    {
      description:
        "Parse Swagger/OpenAPI (JSON or YAML) from base64 and return spec format, tags, and endpoint counts. Read-only; no DB writes. Backend: POST /api/web/v1/ai-test-gen/preview.",
      inputSchema: z.object({
        swagger_file_base64: z.string().min(1),
        swagger_filename: z.string().min(1).max(512),
      }),
    },
    async ({ swagger_file_base64, swagger_filename }) => {
      const fnErr = validateSwaggerFilename(swagger_filename);
      if (fnErr) {
        return result(asText(wrapSwaggerIntel("swagger_preview", { success: false, error: fnErr })));
      }
      const dec = decodeSwaggerUploadBase64(swagger_file_base64);
      if (!dec.ok) {
        return result(asText(wrapSwaggerIntel("swagger_preview", { success: false, error: dec.error })));
      }
      const form = new FormData();
      form.append("swagger_file", dec.blob, swagger_filename.trim());
      const data = await client.requestMultipart<Record<string, unknown>>(
        "/api/web/v1/ai-test-gen/preview",
        form
      );
      return result(
        asText(
          wrapSwaggerIntel("swagger_preview", {
            ...data,
            fingerprint_sha256: dec.sha256,
          })
        )
      );
    }
  );

  registerTracedTool(
    "testneo_swagger_upload_and_generate",
    {
      description:
        "Upload Swagger + optional business rules → unified context indexing + NLP web test cases (multipart). Guarded: TESTNEO_MCP_ALLOW_WRITE + confirm=true. Respects project execution preconditions. Large payloads: set TESTNEO_MCP_SWAGGER_TIMEOUT_MS. Backend: POST /api/web/v1/ai-test-gen/upload-and-generate.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        swagger_file_base64: z.string().min(1),
        swagger_filename: z.string().min(1).max(512),
        business_rules_text: z.string().max(2_000_000).optional(),
        business_rules_file_base64: z.string().min(1).optional(),
        business_rules_filename: z.string().min(1).max(512).optional(),
        folder_id: z.number().int().positive().optional(),
        max_test_cases: z.number().int().min(1).max(200).default(50),
        focus_tags: z.string().max(500).optional(),
        confirm: z.boolean().default(false),
        idempotency_key: z.string().min(8).max(128).optional(),
      }),
    },
    async ({
      project_id,
      swagger_file_base64,
      swagger_filename,
      business_rules_text,
      business_rules_file_base64,
      business_rules_filename,
      folder_id,
      max_test_cases,
      focus_tags,
      confirm,
      idempotency_key,
    }) => {
      const fnErr = validateSwaggerFilename(swagger_filename);
      if (fnErr) {
        return result(asText(wrapSwaggerIntel("swagger_upload_and_generate", { success: false, error: fnErr })));
      }
      const swaggerDec = decodeSwaggerUploadBase64(swagger_file_base64);
      if (!swaggerDec.ok) {
        return result(
          asText(
            wrapSwaggerIntel("swagger_upload_and_generate", { success: false, error: swaggerDec.error })
          )
        );
      }
      let rulesHash = "none";
      let rulesBlob: Blob | null = null;
      let rulesFname: string | null = null;
      if (business_rules_text != null && business_rules_text.length > 0) {
        if (business_rules_file_base64 || business_rules_filename) {
          return result(
            asText(
              wrapSwaggerIntel("swagger_upload_and_generate", {
                success: false,
                error: "Use either business_rules_text or business_rules_file_base64+filename, not both.",
              })
            )
          );
        }
        rulesHash = sha256Utf8(business_rules_text);
        rulesBlob = new Blob([business_rules_text], { type: "text/plain" });
        rulesFname = "business_rules.txt";
      } else if (business_rules_file_base64 || business_rules_filename) {
        if (!business_rules_file_base64 || !business_rules_filename) {
          return result(
            asText(
              wrapSwaggerIntel("swagger_upload_and_generate", {
                success: false,
                error: "Provide both business_rules_file_base64 and business_rules_filename together.",
              })
            )
          );
        }
        const rfn = validateBusinessRulesFilename(business_rules_filename);
        if (rfn) {
          return result(asText(wrapSwaggerIntel("swagger_upload_and_generate", { success: false, error: rfn })));
        }
        const rdec = decodeSwaggerUploadBase64(business_rules_file_base64);
        if (!rdec.ok) {
          return result(
            asText(wrapSwaggerIntel("swagger_upload_and_generate", { success: false, error: rdec.error }))
          );
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
      if (idem.blocked) return idem.blocked;

      if (!deps.allowWriteTools) {
        return result(
          asText(
            wrapSwaggerIntel("swagger_upload_and_generate", {
              message:
                "Write tools disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to run Swagger → NLP generation.",
              project_id,
              swagger_sha256: swaggerDec.sha256,
              rules_hash: rulesHash,
              max_test_cases,
              focus_tags: focus_tags ?? null,
            })
          )
        );
      }
      if (!confirm) {
        return result(
          asText(
            wrapSwaggerIntel("swagger_upload_and_generate", {
              message:
                "Preview mode. Set confirm=true to upload, index context, and generate NLP test cases.",
              project_id,
              swagger_sha256: swaggerDec.sha256,
              rules_hash: rulesHash,
              max_test_cases,
              focus_tags: focus_tags ?? null,
            })
          )
        );
      }

      const routeRuntime = await runtimeForProjectRouteMap(project_id, deps.routeHardening);
      const routeMap = resolvePhraseToPathMap(routeRuntime);
      const blocked = await gateProjectExecutable(project_id, {
        toolName: "testneo_swagger_upload_and_generate",
        routeMap,
      });
      if (blocked) return blocked;

      const form = new FormData();
      form.append("swagger_file", swaggerDec.blob, swagger_filename.trim());
      if (rulesBlob && rulesFname) {
        form.append("business_rules_file", rulesBlob, rulesFname);
      }
      form.append("project_id", String(project_id));
      if (folder_id !== undefined) form.append("folder_id", String(folder_id));
      form.append("max_test_cases", String(max_test_cases));
      if (focus_tags !== undefined && focus_tags.trim()) {
        form.append("focus_tags", focus_tags.trim());
      }

      const data = await client.requestMultipart<Record<string, unknown>>(
        "/api/web/v1/ai-test-gen/upload-and-generate",
        form
      );
      const wrapped = wrapSwaggerIntel("swagger_upload_and_generate", {
        ...data,
        swagger_fingerprint_sha256: swaggerDec.sha256,
        business_rules_fingerprint_sha256: rulesHash !== "none" ? rulesHash : undefined,
      });
      if (idem.key && idem.fingerprint) recordIdempotency(idem.key, idem.fingerprint, asText(wrapped));
      return result(asText(wrapped));
    }
  );

  registerTracedTool(
    "testneo_swagger_impact_analysis",
    {
      description:
        "Compare an uploaded Swagger revision against the last snapshot for a web project, diff endpoints, and list impacted swagger-sourced NLP tests. Persists the modified spec bytes for the next baseline. Guarded: allow-write + confirm=true. Backend: POST /api/web/v1/ai-test-gen/impact-analysis.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        swagger_file_base64: z.string().min(1),
        swagger_filename: z.string().min(1).max(512),
        confirm: z.boolean().default(false),
        idempotency_key: z.string().min(8).max(128).optional(),
      }),
    },
    async ({ project_id, swagger_file_base64, swagger_filename, confirm, idempotency_key }) => {
      const fnErr = validateSwaggerFilename(swagger_filename);
      if (fnErr) {
        return result(asText(wrapSwaggerIntel("swagger_impact_analysis", { success: false, error: fnErr })));
      }
      const dec = decodeSwaggerUploadBase64(swagger_file_base64);
      if (!dec.ok) {
        return result(asText(wrapSwaggerIntel("swagger_impact_analysis", { success: false, error: dec.error })));
      }

      const idem = replayOrConflict("testneo_swagger_impact_analysis", idempotency_key, {
        project_id,
        swagger_sha256: dec.sha256,
      });
      if (idem.blocked) return idem.blocked;

      if (!deps.allowWriteTools) {
        return result(
          asText(
            wrapSwaggerIntel("swagger_impact_analysis", {
              message:
                "Write tools disabled. Set TESTNEO_MCP_ALLOW_WRITE=true; impact analysis persists spec state.",
              project_id,
              swagger_fingerprint_sha256: dec.sha256,
            })
          )
        );
      }
      if (!confirm) {
        return result(
          asText(
            wrapSwaggerIntel("swagger_impact_analysis", {
              message: "Preview mode. Set confirm=true to run diff + impacted-test detection (persists new spec).",
              project_id,
              swagger_fingerprint_sha256: dec.sha256,
            })
          )
        );
      }

      const routeRuntime = await runtimeForProjectRouteMap(project_id, deps.routeHardening);
      const routeMap = resolvePhraseToPathMap(routeRuntime);
      const blocked = await gateProjectExecutable(project_id, {
        toolName: "testneo_swagger_impact_analysis",
        routeMap,
      });
      if (blocked) return blocked;

      const form = new FormData();
      form.append("swagger_file", dec.blob, swagger_filename.trim());
      form.append("project_id", String(project_id));
      const data = await client.requestMultipart<Record<string, unknown>>(
        "/api/web/v1/ai-test-gen/impact-analysis",
        form
      );
      const wrapped = wrapSwaggerIntel("swagger_impact_analysis", {
        ...data,
        swagger_fingerprint_sha256: dec.sha256,
      });
      if (idem.key && idem.fingerprint) recordIdempotency(idem.key, idem.fingerprint, asText(wrapped));
      return result(asText(wrapped));
    }
  );

  registerTracedTool(
    "testneo_swagger_impact_actions",
    {
      description:
        "Bulk apply impact triage on web test cases: mark_stale | archive | keep, then promote modified spec snapshot when possible. Guarded: allow-write + confirm=true. Backend: POST /api/web/v1/ai-test-gen/impact-actions.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        actions: z
          .array(
            z.object({
              test_case_id: z.number().int().positive(),
              action: z.enum(["mark_stale", "archive", "keep"]),
            })
          )
          .min(1)
          .max(200),
        confirm: z.boolean().default(false),
        idempotency_key: z.string().min(8).max(128).optional(),
      }),
    },
    async ({ project_id, actions, confirm, idempotency_key }) => {
      const idem = replayOrConflict("testneo_swagger_impact_actions", idempotency_key, {
        project_id,
        actions,
      });
      if (idem.blocked) return idem.blocked;

      if (!deps.allowWriteTools) {
        return result(
          asText(
            wrapSwaggerIntel("swagger_impact_actions", {
              message: "Write tools disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to apply impact actions.",
              project_id,
              action_count: actions.length,
            })
          )
        );
      }
      if (!confirm) {
        return result(
          asText(
            wrapSwaggerIntel("swagger_impact_actions", {
              message: "Preview mode. Set confirm=true to apply stale/archive/keep actions.",
              project_id,
              preview_actions: actions,
            })
          )
        );
      }

      const routeRuntime = await runtimeForProjectRouteMap(project_id, deps.routeHardening);
      const routeMap = resolvePhraseToPathMap(routeRuntime);
      const blocked = await gateProjectExecutable(project_id, {
        toolName: "testneo_swagger_impact_actions",
        routeMap,
      });
      if (blocked) return blocked;

      const data = await client.request<Record<string, unknown>>("/api/web/v1/ai-test-gen/impact-actions", {
        method: "POST",
        body: { project_id, actions },
      });
      const wrapped = wrapSwaggerIntel("swagger_impact_actions", { ...data });
      if (idem.key && idem.fingerprint) recordIdempotency(idem.key, idem.fingerprint, asText(wrapped));
      return result(asText(wrapped));
    }
  );

  registerTracedTool(
    "testneo_api_project_upload_openapi",
    {
      description:
        "Upload OpenAPI JSON/YAML to a classic API project (stores spec on Project.openapi_spec). Use before testneo_api_project_openapi_impact. Guarded: allow-write + confirm=true. Backend: POST /api/v1/projects/{id}/upload-openapi (multipart field: file).",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        openapi_file_base64: z.string().min(1),
        openapi_filename: z.string().min(1).max(512),
        confirm: z.boolean().default(false),
        idempotency_key: z.string().min(8).max(128).optional(),
      }),
    },
    async ({ project_id, openapi_file_base64, openapi_filename, confirm, idempotency_key }) => {
      const fnErr = validateOpenapiFilename(openapi_filename);
      if (fnErr) {
        return result(asText(wrapSwaggerIntel("api_project_upload_openapi", { success: false, error: fnErr })));
      }
      const dec = decodeSwaggerUploadBase64(openapi_file_base64);
      if (!dec.ok) {
        return result(asText(wrapSwaggerIntel("api_project_upload_openapi", { success: false, error: dec.error })));
      }

      const idem = replayOrConflict("testneo_api_project_upload_openapi", idempotency_key, {
        project_id,
        openapi_sha256: dec.sha256,
      });
      if (idem.blocked) return idem.blocked;

      if (!deps.allowWriteTools) {
        return result(
          asText(
            wrapSwaggerIntel("api_project_upload_openapi", {
              message: "Write tools disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to upload OpenAPI to the API project.",
              project_id,
              openapi_fingerprint_sha256: dec.sha256,
            })
          )
        );
      }
      if (!confirm) {
        return result(
          asText(
            wrapSwaggerIntel("api_project_upload_openapi", {
              message: "Preview mode. Set confirm=true to persist OpenAPI on the API project.",
              project_id,
              openapi_fingerprint_sha256: dec.sha256,
            })
          )
        );
      }

      const form = new FormData();
      form.append("file", dec.blob, openapi_filename.trim());
      const data = await client.requestMultipart<Record<string, unknown>>(
        `/api/v1/projects/${encodeURIComponent(String(project_id))}/upload-openapi`,
        form
      );
      const wrapped = wrapSwaggerIntel("api_project_upload_openapi", { ...data, openapi_fingerprint_sha256: dec.sha256 });
      if (idem.key && idem.fingerprint) recordIdempotency(idem.key, idem.fingerprint, asText(wrapped));
      return result(asText(wrapped));
    }
  );

  registerTracedTool(
    "testneo_api_project_openapi_impact",
    {
      description:
        "Run OpenAPI impact analysis for API (non-web) test cases against a new or stored spec. Pass openapi_spec to diff an inline revision, or omit to analyze using the spec already saved on the project. Guarded: allow-write + confirm=true (service may flag tests). Backend: POST /api/v1/projects/{id}/openapi-impact.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        openapi_spec: z.union([z.record(z.unknown()), z.string()]).optional(),
        auto_flag: z.boolean().default(true),
        business_rules: z.array(z.record(z.unknown())).optional(),
        confirm: z.boolean().default(false),
        idempotency_key: z.string().min(8).max(128).optional(),
      }),
    },
    async ({ project_id, openapi_spec, auto_flag, business_rules, confirm, idempotency_key }) => {
      const specKey =
        openapi_spec === undefined
          ? "stored_spec"
          : typeof openapi_spec === "string"
            ? sha256Utf8(openapi_spec)
            : sha256Utf8(JSON.stringify(openapi_spec));

      const idem = replayOrConflict("testneo_api_project_openapi_impact", idempotency_key, {
        project_id,
        spec_key: specKey,
        auto_flag,
        business_rules_len: business_rules?.length ?? 0,
      });
      if (idem.blocked) return idem.blocked;

      if (!deps.allowWriteTools) {
        return result(
          asText(
            wrapSwaggerIntel("api_project_openapi_impact", {
              message: "Write tools disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to run API OpenAPI impact analysis.",
              project_id,
            })
          )
        );
      }
      if (!confirm) {
        return result(
          asText(
            wrapSwaggerIntel("api_project_openapi_impact", {
              message:
                "Preview mode. Set confirm=true to run openapi-impact (may update test metadata / flags downstream).",
              project_id,
              would_send_inline_spec: openapi_spec !== undefined,
              auto_flag,
            })
          )
        );
      }

      const raw = await client.request<Record<string, unknown>>(
        `/api/v1/projects/${encodeURIComponent(String(project_id))}/openapi-impact`,
        {
          method: "POST",
          body: {
            openapi_spec,
            auto_flag,
            business_rules: business_rules ?? [],
          },
          timeoutMs: client.longRequestTimeoutMs,
        }
      );
      const data =
        raw.success === true && raw.data !== undefined ? (raw.data as Record<string, unknown>) : raw;
      const wrapped = wrapSwaggerIntel("api_project_openapi_impact", {
        ...data,
        envelope: raw.success === true ? { success: raw.success } : undefined,
      });
      if (idem.key && idem.fingerprint) recordIdempotency(idem.key, idem.fingerprint, asText(wrapped));
      return result(asText(wrapped));
    }
  );

  registerTracedTool(
    "testneo_list_projects",
    {
      description: "List projects available to the current API key user.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(200).default(20),
        offset: z.number().int().min(0).default(0),
      }),
    },
    async ({ limit, offset }) => {
      const response = await client.request<{ projects: Array<Record<string, unknown>>; total: number }>(
        "/api/web/v1/playwright-sdk/projects",
        { query: { limit, offset } }
      );
      const summary = (response.projects || [])
        .map((p, idx) => `${idx + 1}. ${p.id} | ${p.name} | test_cases=${p.test_cases_count ?? 0}`)
        .join("\n");
      return result(`Total projects: ${response.total ?? response.projects?.length ?? 0}\n${summary || "No projects."}`);
    }
  );

  registerTracedTool(
    "testneo_create_web_project",
    {
      description:
        "Create a new web automation project (stored under your API key account). Mirrors POST /api/web/v1/projects. Guarded: TESTNEO_MCP_ALLOW_WRITE=true and confirm=true. By default creates a default web environment with base_url (and optional username/password variables) in the same request; set create_default_environment=false for project-only. New projects get Lighthouse performance audits enabled unless project_settings overrides.",
      inputSchema: z.object({
        name: z.string().min(1).max(255),
        website_url: z.string().url().describe("HTTPS/HTTP origin for the site under test"),
        description: z.string().max(8000).optional(),
        environment: z.enum(["local", "staging", "production", "development"]).default("staging"),
        status: z.enum(["active", "inactive", "archived"]).default("active"),
        project_environment_name: z.string().min(1).max(100).default("staging"),
        base_url_variable_name: z.string().min(1).max(100).default("base_url"),
        create_default_environment: z
          .boolean()
          .default(true)
          .describe(
            "When true (default), creates the first web environment with base_url (and credentials if provided) in the same API call."
          ),
        environment_username: z.string().min(1).max(500).optional(),
        environment_password: z.string().min(1).max(8192).optional(),
        confirm: z.boolean().default(false),
        idempotency_key: z.string().min(8).max(128).optional(),
      }),
    },
    async ({
      name,
      website_url,
      description,
      environment,
      status,
      project_environment_name,
      base_url_variable_name,
      create_default_environment,
      environment_username,
      environment_password,
      confirm,
      idempotency_key,
    }) => {
      const idem = replayOrConflict(
        "testneo_create_web_project",
        idempotency_key,
        {
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
        }
      );
      if (idem.blocked) return idem.blocked;
      if (!deps.allowWriteTools) {
        return result(
          asText({
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
          })
        );
      }
      if (!confirm) {
        const previewBody: Record<string, unknown> = {
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
            variables:
              base_url_variable_name !== "base_url"
                ? [{ variable_name: base_url_variable_name, variable_value: website_url }]
                : [],
          };
        }
        return result(
          asText({
            message: "Preview only. Set confirm=true to create this web project.",
            would_post: {
              path: "/api/web/v1/projects",
              body: previewBody,
            },
          })
        );
      }
      try {
        const body: Record<string, unknown> = {
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
            variables:
              base_url_variable_name !== "base_url"
                ? [{ variable_name: base_url_variable_name, variable_value: website_url }]
                : [],
          };
        }
        const created = await client.request<Record<string, unknown>>("/api/web/v1/projects", {
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
        if (idem.key && idem.fingerprint) recordIdempotency(idem.key, idem.fingerprint, text);
        return result(text);
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  registerTracedTool(
    "testneo_create_web_project_environment",
    {
      description:
        "Create a named web project environment with optional variables (e.g. base_url for {{base_url}} in NLP). Backend: POST /api/web/v1/projects/{project_id}/environments. Guarded: allow-write + confirm=true.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        name: z.string().min(1).max(100),
        is_default: z.boolean().default(true),
        is_active: z.boolean().default(true),
        variables: z
          .array(
            z.object({
              variable_name: z.string().min(1).max(100),
              variable_value: z.string().min(1),
              is_secret: z.boolean().optional(),
              variable_type: z.string().max(50).optional(),
            })
          )
          .optional(),
        confirm: z.boolean().default(false),
        idempotency_key: z.string().min(8).max(128).optional(),
      }),
    },
    async ({ project_id, name, is_default, is_active, variables, confirm, idempotency_key }) => {
      const idem = replayOrConflict("testneo_create_web_project_environment", idempotency_key, {
        project_id,
        name,
        is_default,
        is_active,
        variables,
      });
      if (idem.blocked) return idem.blocked;
      if (!deps.allowWriteTools) {
        return result(
          asText({
            message: "Write tools disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to create environments.",
            project_id,
            would_create: { name, is_default, is_active, variables },
          })
        );
      }
      if (!confirm) {
        return result(
          asText({
            message: "Preview only. Set confirm=true to create this environment.",
            project_id,
            would_post: {
              path: `/api/web/v1/projects/${project_id}/environments`,
              body: { name, is_default, is_active, variables: variables ?? [] },
            },
          })
        );
      }
      try {
        const created = await client.request<Record<string, unknown>>(
          `/api/web/v1/projects/${encodeURIComponent(String(project_id))}/environments`,
          {
            method: "POST",
            body: {
              name,
              is_default,
              is_active,
              variables: variables ?? [],
            },
          }
        );
        const text = asText({ contract_version: "web_project_bootstrap.v1", environment: created });
        if (idem.key && idem.fingerprint) recordIdempotency(idem.key, idem.fingerprint, text);
        return result(text);
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }
    }
  );

  registerTracedTool(
    "testneo_bootstrap_web_mcp_project",
    {
      description:
        "One-shot onboarding: validate → create web project with optional default environment (base_url + credentials) in a single POST when add_base_url_variable=true. Returns a trace + recommended_next_tools. Guarded like other writes.",
      inputSchema: z.object({
        name: z.string().min(1).max(255),
        website_url: z.string().url(),
        description: z.string().max(8000).optional(),
        project_environment_name: z.string().min(1).max(100).default("staging"),
        add_base_url_variable: z.boolean().default(true),
        base_url_variable_name: z.string().min(1).max(100).default("base_url"),
        environment_username: z.string().min(1).max(500).optional(),
        environment_password: z.string().min(1).max(8192).optional(),
        confirm: z.boolean().default(false),
        idempotency_key: z.string().min(8).max(128).optional(),
      }),
    },
    async ({
      name,
      website_url,
      description,
      project_environment_name,
      add_base_url_variable,
      base_url_variable_name,
      environment_username,
      environment_password,
      confirm,
      idempotency_key,
    }) => {
      const trace: Array<Record<string, unknown>> = [];
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
      if (idem.blocked) return idem.blocked;

      if (!deps.allowWriteTools) {
        trace.push({
          step: "allow_write",
          status: "blocked",
          detail: "Set TESTNEO_MCP_ALLOW_WRITE=true to run bootstrap.",
        });
        return result(
          asText({
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
          })
        );
      }

      if (!confirm) {
        trace.push({ step: "dry_run", status: "ok", detail: "Set confirm=true to execute." });
        const bootstrapProjectBody: Record<string, unknown> = {
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
            variables:
              base_url_variable_name !== "base_url"
                ? [{ variable_name: base_url_variable_name, variable_value: website_url }]
                : [],
          };
        }
        return result(
          asText({
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
          })
        );
      }

      try {
        const v = await client.request<Record<string, unknown>>("/api/web/v1/playwright-sdk/validate", {
          method: "POST",
        });
        trace.push({ step: "validate_connection", status: "ok", detail: v });
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }

      let project: Record<string, unknown>;
      try {
        const bootstrapProjectBody: Record<string, unknown> = {
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
            variables:
              base_url_variable_name !== "base_url"
                ? [{ variable_name: base_url_variable_name, variable_value: website_url }]
                : [],
          };
        }
        project = await client.request<Record<string, unknown>>("/api/web/v1/projects", {
          method: "POST",
          body: bootstrapProjectBody,
        });
        trace.push({ step: "create_web_project", status: "ok", detail: { id: project.id, name: project.name } });
      } catch (e) {
        if (e instanceof TestNeoApiError) {
          trace.push({ step: "create_web_project", status: "error" });
          let detail: unknown = e.body;
          try {
            detail = JSON.parse(e.body);
          } catch {
            /* keep string */
          }
          return result(
            asText({
              contract_version: "web_project_bootstrap.v1",
              trace,
              error: "testneo_api_error",
              http_status: e.status,
              path: e.path,
              detail,
            })
          );
        }
        throw e;
      }

      const pidRaw = project.id;
      const project_id = typeof pidRaw === "number" ? pidRaw : Number(pidRaw);
      if (!Number.isFinite(project_id) || project_id <= 0) {
        return result(
          asText({
            contract_version: "web_project_bootstrap.v1",
            trace,
            error: "bootstrap_invalid_response",
            message: "Create project succeeded but response had no usable id.",
            raw: project,
          })
        );
      }

      let environment: Record<string, unknown> | null = null;
      if (add_base_url_variable) {
        trace.push({
          step: "create_initial_environment",
          status: "ok",
          detail: "Created in same transaction as project (POST /api/web/v1/projects).",
        });
        try {
          const envs = await client.request<unknown>(
            `/api/web/v1/projects/${encodeURIComponent(String(project_id))}/environments`
          );
          const list = Array.isArray(envs) ? envs : [];
          environment = (list[0] as Record<string, unknown>) ?? null;
        } catch {
          environment = null;
        }
      } else {
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
      if (idem.key && idem.fingerprint) recordIdempotency(idem.key, idem.fingerprint, wrapped);
      return result(wrapped);
    }
  );

  registerTracedTool(
    "testneo_list_recent_executions",
    {
      description: "List recent executions, optionally filtered by project/status/release/build.",
      inputSchema: z.object({
        project_id: z.number().int().positive().optional(),
        status_filter: z.string().min(1).optional(),
        release: z.string().min(1).optional(),
        build: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(200).default(20),
        offset: z.number().int().min(0).default(0),
      }),
    },
    async ({ project_id, status_filter, release, build, limit, offset }) => {
      const response = await fetchRecentExecutionsWithFallback(client, {
        project_id,
        status_filter,
        release,
        build,
        range: "30d",
        limit,
        offset,
      });
      const items = (response.executions || []).map((x) => normalizeExecutionItem(x));
      return result(
        asText({
          contract_version: "execution_intelligence.v1",
          source: response.source,
          filters: { project_id, status_filter: status_filter ?? null, release: release ?? null, build: build ?? null },
          total: response.total ?? items.length,
          executions: items,
        })
      );
    }
  );

  registerTracedTool(
    "testneo_get_execution_status",
    {
      description: "Fetch primary execution status, steps and summary metadata for an execution ID.",
      inputSchema: z.object({
        execution_id: z.string().min(6),
        include_steps: z.boolean().default(true),
      }),
    },
    async ({ execution_id, include_steps }) => {
      const response = await client.request<Record<string, unknown>>(`/api/web/v1/playwright-sdk/executions/${encodeURIComponent(execution_id)}`, {
        query: { include_steps },
      });
      const data = response.data;
      const normalized =
        data && typeof data === "object" && !Array.isArray(data)
          ? normalizeExecutionSummary(data as Record<string, unknown>)
          : normalizeExecutionSummary(response);
      return result(
        asText({
          contract_version: "execution_intelligence.v1",
          execution_id,
          ui_navigation: buildExecutionUiNavigationForClient(client, execution_id),
          execution: normalized,
          raw_response_meta: {
            api_version: response.api_version ?? null,
          },
        })
      );
    }
  );

  registerTracedTool(
    "testneo_get_execution_summary",
    {
      description: "Get analytics summary for an execution (status, pass/fail, duration, video metadata).",
      inputSchema: z.object({
        execution_id: z.string().min(6),
      }),
    },
    async ({ execution_id }) => {
      const response = await client.request<Record<string, unknown>>(
        `/api/web/v1/analytics/execution/${encodeURIComponent(execution_id)}/summary`
      );
      const normalized = normalizeExecutionSummary(response);
      return result(
        asText({
          contract_version: "execution_intelligence.v1",
          execution_id,
          ui_navigation: buildExecutionUiNavigationForClient(client, execution_id),
          summary: normalized,
        })
      );
    }
  );

  registerTracedTool(
    "testneo_get_execution_logs",
    {
      description: "Get execution logs for an execution ID.",
      inputSchema: z.object({
        execution_id: z.string().min(6),
        limit: z.number().int().min(1).max(1000).default(200),
        offset: z.number().int().min(0).default(0),
      }),
    },
    async ({ execution_id, limit, offset }) => {
      const response = await client.request(
        `/api/web/v1/executions/${encodeURIComponent(execution_id)}/logs`,
        { query: { limit, offset } }
      );
      const nav = buildExecutionUiNavigationForClient(client, execution_id);
      if (response && typeof response === "object" && !Array.isArray(response)) {
        return result(asText({ ...(response as Record<string, unknown>), ui_navigation: nav }));
      }
      return result(asText({ logs_payload: response, ui_navigation: nav }));
    }
  );

  registerTracedTool(
    "testneo_search_failures",
    {
      description: "Search failed executions for a project by test name or execution id fragment.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        query: z.string().min(1),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    },
    async ({ project_id, query, limit }) => {
      const response = await fetchRecentExecutionsWithFallback(client, {
        project_id,
        status_filter: "failed",
        range: "30d",
        limit,
        offset: 0,
      });
      const q = query.toLowerCase();
      const filtered = (response.executions || []).filter(
        (x) =>
          (x.execution_id || "").toLowerCase().includes(q) ||
          (x.test_case_name || "").toLowerCase().includes(q)
      );
      return result(
        asText({
          contract_version: "execution_intelligence.v1",
          source: response.source,
          project_id,
          query,
          matched: filtered.length,
          executions: filtered.map((x) => normalizeExecutionItem(x)),
        })
      );
    }
  );

  registerTracedTool(
    "testneo_get_pass_fail_trend",
    {
      description: "Summarize pass/fail trend for a project over a date range.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        range: z.enum(["1d", "7d", "30d", "90d"]).default("30d"),
        limit: z.number().int().min(10).max(500).default(200),
      }),
    },
    async ({ project_id, range, limit }) => {
      const payload = await buildPassFailTrendPayload(client, project_id, range, limit);
      return result(asText(payload));
    }
  );

  registerTracedTool(
    "testneo_watch_execution",
    {
      description: "Poll execution summary until terminal status or timeout window.",
      inputSchema: z.object({
        execution_id: z.string().min(6),
        max_polls: z.number().int().min(1).max(120).default(20),
        poll_interval_ms: z.number().int().min(500).max(10000).default(1500),
        include_event_sample: z.boolean().default(true),
        event_sample_limit: z.number().int().min(1).max(30).default(10),
      }),
    },
    async ({ execution_id, max_polls, poll_interval_ms, include_event_sample, event_sample_limit }) => {
      const timeline: Array<Record<string, unknown>> = [];
      let finalSummary: Record<string, unknown> | null = null;

      for (let attempt = 1; attempt <= max_polls; attempt += 1) {
        const summary = await client.request<Record<string, unknown>>(
          `/api/web/v1/analytics/execution/${encodeURIComponent(execution_id)}/summary`
        );
        const status = normalizeStatus(summary.status);
        finalSummary = normalizeExecutionSummary(summary);
        timeline.push({
          poll: attempt,
          status: summary.status ?? "unknown",
          canonical_status: toCanonicalExecutionStatus(status),
          completed_steps: summary.completed_steps ?? 0,
          failed_steps: summary.failed_steps ?? 0,
          total_steps: summary.total_steps ?? 0,
          duration_ms: summary.duration_ms ?? 0,
        });
        if (isTerminalStatus(status)) break;
        await sleep(poll_interval_ms);
      }

      let eventSample: unknown[] = [];
      if (include_event_sample) {
        try {
          const eventsResponse = await client.request<{ events?: unknown[] }>(
            `/api/web/v1/analytics/execution/${encodeURIComponent(execution_id)}/events`
          );
          eventSample = (eventsResponse.events || []).slice(-event_sample_limit);
        } catch {
          eventSample = [];
        }
      }

      return result(
        asText({
          contract_version: "execution_intelligence.v1",
          execution_id,
          ui_navigation: buildExecutionUiNavigationForClient(client, execution_id),
          final_status: finalSummary?.status ?? "unknown",
          final_canonical_status: toCanonicalExecutionStatus(finalSummary?.status),
          polls_performed: timeline.length,
          reached_terminal_state: isTerminalStatus(finalSummary?.status),
          final_summary: finalSummary,
          timeline,
          event_sample: eventSample,
        })
      );
    }
  );

  registerTracedTool(
    "testneo_get_failure_bundle",
    {
      description:
        "Get a compact failure triage bundle: summary, event sample, logs, inferred theme, next actions, plus a concrete suggested NLP patch (diff + testneo_update_test_case_nlp payload) when execution summary includes test_case_id.",
      inputSchema: z.object({
        execution_id: z.string().min(6),
        logs_limit: z.number().int().min(20).max(500).default(150),
        event_limit: z.number().int().min(5).max(50).default(20),
        include_nlp_patch_suggestion: z.boolean().default(true),
      }),
    },
    async ({ execution_id, logs_limit, event_limit, include_nlp_patch_suggestion }) => {
      const bundle = await buildFailureBundle(client, execution_id, logs_limit, event_limit);
      const enriched =
        include_nlp_patch_suggestion !== false
          ? await enrichBundleWithNlpPatch(client, bundle, deps.routeHardening)
          : bundle;
      return result(
        asText({
          ...(typeof enriched === "object" && enriched !== null && !Array.isArray(enriched)
            ? (enriched as Record<string, unknown>)
            : { bundle: enriched }),
          ui_navigation: buildExecutionUiNavigationForClient(client, execution_id),
        })
      );
    }
  );

  registerTracedTool(
    "testneo_run_agent_workflow",
    {
      description:
        "Run an agentic multi-step QA workflow (triage_failure, rerun_decision, qa_intelligence) over TestNeo data.",
      inputSchema: z.object({
        workflow_type: z.enum(["triage_failure_workflow", "rerun_decision_workflow", "qa_intelligence_workflow"]),
        project_id: z.number().int().positive(),
        range: z.enum(["1d", "7d", "30d", "90d"]).default("30d"),
        top_failures: z.number().int().min(1).max(5).default(2),
        rerun_limit: z.number().int().min(1).max(20).default(3),
      }),
    },
    async ({ workflow_type, project_id, range, top_failures, rerun_limit }) => {
      const trace: Array<{ step: string; status: "ok" | "skipped"; detail?: string }> = [];

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
      const bundles: FailureBundleResult[] = [];
      if (workflow_type === "triage_failure_workflow" || workflow_type === "qa_intelligence_workflow") {
        trace.push({ step: "build_failure_bundles", status: "ok", detail: `count=${selectedFailures.length}` });
        for (const item of selectedFailures) {
          const raw = await buildFailureBundle(client, item.execution_id, 120, 20);
          bundles.push(await enrichBundleWithNlpPatch(client, raw, deps.routeHardening));
        }
        trace.push({ step: "enrich_failure_bundles_with_nlp_patch_suggestions", status: "ok" });
      } else {
        trace.push({ step: "build_failure_bundles", status: "skipped", detail: "workflow does not require deep triage" });
      }

      const themeCounts: Record<string, number> = {};
      for (const bundle of bundles) {
        const theme = bundle.inferred_root_cause.theme;
        themeCounts[theme] = (themeCounts[theme] || 0) + 1;
      }
      const recurringThemes = Object.entries(themeCounts)
        .map(([theme, count]) => ({ theme, count }))
        .sort((a, b) => b.count - a.count);

      const rerunCandidates = Array.from(
        new Map(
          failedItems
            .filter((x) => typeof x.test_case_id === "number" && x.test_case_id! > 0)
            .map((x) => [x.test_case_id as number, x])
        ).values()
      ).slice(0, rerun_limit);
      trace.push({ step: "compute_rerun_candidates", status: "ok", detail: `count=${rerunCandidates.length}` });

      const rerunPlan = rerunCandidates.map((x, idx) => ({
        rank: idx + 1,
        test_case_id: x.test_case_id ?? null,
        execution_id: x.execution_id,
        reason: "recent_failed_execution",
        preview_only: true,
      }));

      if (workflow_type === "triage_failure_workflow") {
        return result(
          asText({
            workflow_type,
            source: recent.source,
            project_id,
            range,
            execution_volume: recentItems.length,
            failed_executions: selectedFailures.map((x) => x.execution_id),
            triage_bundles: bundles,
            recurring_themes: recurringThemes,
            trace,
          })
        );
      }

      if (workflow_type === "rerun_decision_workflow") {
        return result(
          asText({
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
          })
        );
      }

      return result(
        asText({
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
        })
      );
    }
  );

  registerTracedTool(
    "testneo_ingest_figma_context",
    {
      description:
        "Ingest Figma metadata via ETL, optionally wait for completion, then create a linked unified context for test generation.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        figma_token: z.string().min(10),
        figma_file_id: z.string().min(3),
        context_name: z.string().min(3),
        context_description: z.string().optional(),
        wait_for_ingest: z.boolean().default(true),
        max_polls: z.number().int().min(1).max(120).default(30),
        poll_interval_ms: z.number().int().min(500).max(10000).default(2000),
      }),
    },
    async ({
      project_id,
      figma_token,
      figma_file_id,
      context_name,
      context_description,
      wait_for_ingest,
      max_polls,
      poll_interval_ms,
    }) => {
      const connect = await client.request<{ jobId: string; status: string }>(`/api/v1/etl/connect-figma`, {
        method: "POST",
        body: {
          projectId: project_id,
          figmaToken: figma_token,
          fileId: figma_file_id,
        },
      });

      const etlJobId = String(connect.jobId);
      let etlJob: Record<string, unknown> = { id: etlJobId, status: connect.status };
      if (wait_for_ingest) {
        etlJob = await waitForEtlJobCompletion(client, etlJobId, max_polls, poll_interval_ms);
      }

      const context = await client.request<Record<string, unknown>>(
        `/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts`,
        {
          method: "POST",
          body: {
            name: context_name,
            description: context_description || `Figma context for file ${figma_file_id}`,
            context_type: "unified",
            selected_document_ids: [`etl-${etlJobId}`],
          },
        }
      );

      return result(
        asText({
          project_id,
          figma_file_id,
          etl_job: etlJob,
          unified_context: {
            id: context.id ?? null,
            name: context.name ?? context_name,
            entity_count: context.entity_count ?? 0,
            relationship_count: context.relationship_count ?? 0,
          },
        })
      );
    }
  );

  registerTracedTool(
    "testneo_list_unified_contexts",
    {
      description:
        "List unified contexts for a project with id + human-readable names. Use before testneo_generate_tests_from_context so agents do not have to scrape context_id from the UI.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        compact: z.boolean().default(true),
        max_compact_lines: z.number().int().min(1).max(150).default(60),
      }),
    },
    async ({ project_id, compact, max_compact_lines }) => {
      const payload = await client.request<unknown>(
        `/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts`
      );
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
      if (!compact) textLead = textLead.trimEnd();
      return result(`${textLead}\n${asText(body)}`);
    }
  );

  registerTracedTool(
    "testneo_get_unified_context_by_name",
    {
      description:
        "Resolve unified context_id from a natural-language name against this project’s contexts (calls list internally). Great for onboarding and demos.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        name_query: z.string().min(1).max(500),
        match_mode: z.enum(["auto", "exact", "substring"]).default("auto"),
        prefer_context_id: z.number().int().positive().optional(),
        include_detail: z.boolean().default(false),
      }),
    },
    async ({ project_id, name_query, match_mode, prefer_context_id, include_detail }) => {
      const payload = await client.request<unknown>(
        `/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts`
      );
      const contexts = parseUnifiedContextListPayload(payload);
      const resolved = resolveUnifiedContextByName(contexts, name_query, match_mode, { prefer_context_id });

      let detail: Record<string, unknown> | null = null;
      if (include_detail && resolved.chosen) {
        detail = await client.request<Record<string, unknown>>(
          `/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts/${encodeURIComponent(
            String(resolved.chosen.id)
          )}`
        );
      }

      const body = {
        project_id,
        name_query,
        normalized_query: normalizeContextQuery(name_query),
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
    }
  );

  registerTracedTool(
    "testneo_ai_assistant_query",
    {
      description:
        "Same Web AI Assistant as the product UI (/web/ai-assistant): natural-language Q&A over a project, optionally scoped to a unified context (PDF/Figma/requirements ingest). POST /api/web/v1/etl/ai-assistant/query. Pass context_id or context_name_query; omit both for project-wide analytics-style questions. Uses your Web AI chat quota. Optional recommend_context / rag_context match the web request body for AI-Q and document-aware answers.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        query: z.string().min(1).max(32000),
        context_id: z.number().int().positive().optional(),
        context_name_query: z.string().min(1).max(500).optional(),
        context_match_mode: z.enum(["auto", "exact", "substring"]).default("auto"),
        prefer_context_id: z.number().int().positive().optional(),
        response_style: z.enum(["concise", "detailed"]).default("concise"),
        recommend_context: z.record(z.string(), z.unknown()).optional(),
        rag_context: z.record(z.string(), z.unknown()).optional(),
      }),
    },
    async ({
      project_id,
      query,
      context_id,
      context_name_query,
      context_match_mode,
      prefer_context_id,
      response_style,
      recommend_context,
      rag_context,
    }) => {
      let resolvedContextId: number | null = context_id ?? null;
      let context_resolution: Record<string, unknown> | null = null;

      if (resolvedContextId == null && context_name_query?.trim()) {
        const payload = await client.request<unknown>(
          `/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts`
        );
        const contexts = parseUnifiedContextListPayload(payload);
        const resolved = resolveUnifiedContextByName(contexts, context_name_query.trim(), context_match_mode, {
          prefer_context_id,
        });
        context_resolution = {
          name_query: context_name_query.trim(),
          match_mode: context_match_mode,
          resolved_context_id: resolved.chosen?.id ?? null,
          hint: resolved.hint,
          ambiguity:
            resolved.chosen == null && resolved.candidates_same_tier.length > 0
              ? {
                  candidate_count: resolved.candidates_same_tier.length,
                  candidates: resolved.candidates_same_tier.slice(0, 8).map((x) => ({
                    id: x.id,
                    name: x.name,
                  })),
                }
              : undefined,
        };
        if (resolved.chosen?.id != null) {
          resolvedContextId = resolved.chosen.id;
        } else {
          return result(
            asText({
              contract_version: "testneo_mcp_ai_assistant.v1",
              project_id,
              error: "context_not_resolved",
              context_resolution,
              hint: "Call testneo_list_unified_contexts or narrow context_name_query / pass prefer_context_id, then retry.",
            })
          );
        }
      }

      const queryParams: Record<string, string | number | boolean | undefined> = {
        project_id,
        query,
        responseStyle: response_style,
      };
      if (resolvedContextId != null) {
        queryParams.context_id = String(resolvedContextId);
      }

      const body: Record<string, unknown> = {};
      if (recommend_context && Object.keys(recommend_context).length > 0) {
        body.recommend_context = recommend_context;
      }
      if (rag_context && Object.keys(rag_context).length > 0) {
        body.rag_context = rag_context;
      }

      const appOrigin = client.getWebAppBaseUrl().replace(/\/+$/, "");
      const web_ai_assistant_url = `${appOrigin}/web/ai-assistant`;

      try {
        const upstream = await client.request<Record<string, unknown>>(
          `/api/web/v1/etl/ai-assistant/query`,
          {
            method: "POST",
            query: queryParams,
            body: Object.keys(body).length > 0 ? body : {},
            timeoutMs: client.longRequestTimeoutMs,
          }
        );

        const assistantText =
          typeof upstream.response === "string"
            ? upstream.response
            : upstream.response != null
              ? JSON.stringify(upstream.response)
              : "";

        return result(
          asText({
            contract_version: "testneo_mcp_ai_assistant.v1",
            project_id,
            context_id: resolvedContextId,
            context_resolution,
            response_style,
            product_navigation: {
              contract_version: "testneo_mcp_product_links.v1",
              web_ai_assistant_url,
              note: "Open in browser to continue the thread with full RAG UI controls.",
            },
            assistant_reply: assistantText,
            usage: upstream.usage ?? undefined,
            upstream,
          })
        );
      } catch (e) {
        const formatted = formatApiFailure(e);
        if (formatted) return formatted;
        throw e;
      }
    }
  );

  registerTracedTool(
    "testneo_generate_tests_from_context",
    {
      description:
        "Generate NLP test cases from an existing unified context (Figma, requirements, etc.). Resolve context via testneo_list_unified_contexts or testneo_get_unified_context_by_name (name_query, not scraped UI ids). Omit auth_preamble for public / no-login apps (default: no SauceDemo login injected, no SauceDemo route auto-align). Pass auth_preamble { enabled:true, preset:'saucedemo' } only for demos against saucedemo.com. Custom maps: TESTNEO_ROUTE_MAP_JSON or testneo_set_project_route_map; optional auto_align_saucedemo_route_map + SauceDemo preset ties route phrases to SauceDemo paths.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        context_id: z.number().int().positive(),
        test_types: z.array(z.string().min(1)).default(["positive", "negative", "edge"]),
        include_ui_tests: z.boolean().default(true),
        include_api_tests: z.boolean().default(true),
        include_e2e_flows: z.boolean().default(true),
        max_tests: z.number().int().min(1).max(200).optional(),
        max_tests_per_type: z.number().int().min(1).max(20).default(5),
        priority_threshold: z.number().min(0).max(1).default(0.3),
        relationship_depth: z.number().int().min(1).max(5).default(2),
        focus_areas: z.array(z.string().min(1)).optional(),
        auth_preamble: z
          .object({
            enabled: z.boolean().default(true),
            preset: z.enum(["saucedemo", "custom"]).default("saucedemo"),
            commands: z.array(z.string().min(1)).optional(),
          })
          .optional()
          .describe(
            "Omit entirely for generic sites (no login preamble). Use { enabled:false } to persist without auth lines. SauceDemo preset only for saucedemo.com demos."
          ),
        persist_auth_preamble: z.boolean().default(true),
        route_hardening: routeHardeningToolSchema,
        persist_route_hardening: z.boolean().default(true),
        auto_align_saucedemo_route_map: z.boolean().default(true),
      }),
    },
    async ({
      project_id,
      context_id,
      test_types,
      include_ui_tests,
      include_api_tests,
      include_e2e_flows,
      max_tests,
      max_tests_per_type,
      priority_threshold,
      relationship_depth,
      focus_areas,
      auth_preamble,
      persist_auth_preamble,
      route_hardening,
      persist_route_hardening,
      auto_align_saucedemo_route_map,
    }) => {
      const wantsSauceLogin =
        !!auth_preamble &&
        auth_preamble.enabled !== false &&
        (auth_preamble.preset ?? "saucedemo") === "saucedemo";
      const blocked = await gateProjectExecutable(project_id, {
        toolName: "testneo_generate_tests_from_context",
        authExpectation: wantsSauceLogin ? "required" : "optional",
      });
      if (blocked) return blocked;

      const generation = await client.request<Record<string, unknown>>(
        `/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts/${encodeURIComponent(
          String(context_id)
        )}/generate-tests`,
        {
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
        }
      );
      const generated = (generation.generated_test_cases as Array<Record<string, unknown>>) || [];
      const authSteps = buildAuthPreamble(auth_preamble);

      let routeRuntime = await runtimeForProjectRouteMap(project_id, deps.routeHardening);
      const authUsesSaucedemo = wantsSauceLogin;
      if (
        auto_align_saucedemo_route_map &&
        authUsesSaucedemo &&
        routeRuntime.profile === "none" &&
        Object.keys(routeRuntime.customMap).length === 0 &&
        route_hardening?.profile === undefined
      ) {
        routeRuntime = { ...routeRuntime, profile: "saucedemo" };
      }
      const routeMap = resolveRouteMap(routeRuntime, route_hardening);

      const patchedPreview = generated.slice(0, 10).map((t) => {
        const baseline = extractNlpCommandsFromGeneratedTest(t);
        const afterAuth = withAuthPreamble(baseline, authSteps);
        const hardened = hardenNavigationCommands(afterAuth, routeMap);
        const previewCommands = persist_route_hardening ? hardened.commands : afterAuth;
        return {
          id: t.id ?? t.test_case_id ?? null,
          name: t.name ?? t.test_name ?? "Generated Test",
          nlp_commands: previewCommands,
          route_replacements: persist_route_hardening ? hardened.replacements : [],
          route_replacements_available: hardened.replacements,
        };
      });

      const persisted: Array<Record<string, unknown>> = [];
      if (persist_auth_preamble || persist_route_hardening) {
        for (const test of generated) {
          const testId = test.id ?? test.test_case_id;
          if (!testId) continue;
          const baseline = extractNlpCommandsFromGeneratedTest(test);
          const afterAuth = withAuthPreamble(baseline, authSteps);
          const hardened = hardenNavigationCommands(afterAuth, routeMap);
          const toPersist = persist_route_hardening ? hardened.commands : afterAuth;

          const authChanged =
            persist_auth_preamble && JSON.stringify(afterAuth) !== JSON.stringify(baseline);
          const routeChanged =
            persist_route_hardening &&
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
          } catch (error) {
            persisted.push({
              test_case_id: testId,
              updated: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      return result(
        asText({
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
        })
      );
    }
  );

  registerTracedTool(
    "testneo_preview_generated_tests",
    {
      description:
        "Preview generated tests in both NLP and Playwright SDK spec.ts draft format for human-in-loop approval. Applies route hardening (env + optional route_hardening) to Navigate-to lines when a phrase map is configured.",
      inputSchema: z.object({
        generated_test_cases: z.array(z.record(z.any())).min(1),
        max_items: z.number().int().min(1).max(20).default(5),
        route_hardening: routeHardeningToolSchema,
      }),
    },
    async ({ generated_test_cases, max_items, route_hardening }) => {
      const routeMap = resolveRouteMap(deps.routeHardening, route_hardening);
      const preview = generated_test_cases.slice(0, max_items).map((t: Record<string, unknown>, idx: number) => {
        const testName = String(t.name ?? t.test_name ?? `Generated Test ${idx + 1}`);
        let nlp = extractNlpCommandsFromGeneratedTest(t);
        const hardened = hardenNavigationCommands(nlp, routeMap);
        nlp = hardened.commands;
        const riskFlags: string[] = [];
        if (!nlp.length) riskFlags.push("no_nlp_commands_detected");
        if (nlp.length < 3) riskFlags.push("very_short_flow");
        if (!nlp.some((x) => /verify|assert|expect/i.test(x))) riskFlags.push("no_explicit_assertion_step");
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
    }
  );

  registerTracedTool(
    "testneo_execute_generated_test_case",
    {
      description:
        "Execute a generated test case by numeric test_case_id OR by project_id + name_query (resolved via GET …/test-cases/?search= then exact/unique name match). Human-in-loop gated. POST /api/web/v1/test-cases/{id}/execute — passes use_agent when TESTNEO_MCP_DEFAULT_EXECUTION_MODE=local and TESTNEO_MCP_PREFER_LOCAL_AGENT=true (same routing as batch). Optional wait_for_agent_seconds + env TESTNEO_MCP_WAIT_FOR_AGENT_MS / TESTNEO_MCP_REQUIRE_LOCAL_AGENT_FOR_BATCH control preflight polling. Use testneo_find_test_cases to browse matches before running.",
      inputSchema: z
        .object({
          test_case_id: z.number().int().positive().optional(),
          project_id: z.number().int().positive().optional(),
          name_query: z.string().min(1).max(500).optional(),
          name_match_mode: z.enum(["auto", "exact", "substring"]).default("auto"),
          confirm: z.boolean().default(false),
          idempotency_key: z.string().min(8).max(128).optional(),
          environment_id: z.number().int().positive().optional(),
          environment_name: z.string().min(1).optional(),
          wait_for_agent_seconds: z.number().int().min(0).max(300).optional(),
        })
        .superRefine((data, ctx) => {
          const hasId = data.test_case_id != null && data.test_case_id > 0;
          const hasName = data.project_id != null && data.project_id > 0 && !!data.name_query?.trim();
          if (!hasId && !hasName) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Provide test_case_id OR (project_id + name_query).",
              path: [],
            });
          }
        }),
    },
    async ({
      test_case_id,
      project_id,
      name_query,
      name_match_mode,
      confirm,
      idempotency_key,
      environment_id,
      environment_name,
      wait_for_agent_seconds,
    }) => {
      const resolved = await resolveTestCaseIdForExecuteInput({
        test_case_id,
        project_id,
        name_query,
        name_match_mode,
      });
      if (!resolved.ok) return result(asText(resolved.payload));
      const execId = resolved.test_case_id;

      if (!confirm) {
        return result(
          asText({
            contract_version: "testneo_mcp_execute_preview.v1",
            mode: "preview",
            message: `Set confirm=true to execute test_case_id=${execId}.`,
            test_case_id: execId,
            name_resolution: resolved.name_resolution,
            requires_env: "TESTNEO_MCP_ALLOW_WRITE=true to perform execution",
          })
        );
      }
      if (!deps.allowWriteTools) {
        return result("Write tools are disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to enable execution.");
      }
      const idem = replayOrConflict("testneo_execute_generated_test_case", idempotency_key, {
        test_case_id: execId,
        environment_id: environment_id ?? null,
        environment_name: environment_name ?? null,
        wait_for_agent_seconds: wait_for_agent_seconds ?? null,
      });
      if (idem.blocked) return idem.blocked;
      const blocked = await gateProjectExecutableFromTestCase(execId, {
        toolName: "testneo_execute_generated_test_case",
      });
      if (blocked) return blocked;

      const agentPf = await preflightLocalAgentForSingleTestExecute(
        wait_for_agent_seconds,
        "testneo_mcp_execute_preflight.v1"
      );
      if (!agentPf.proceed) return agentPf.blocked;

      const response = await client.request<Record<string, unknown>>(
        `/api/web/v1/test-cases/${encodeURIComponent(String(execId))}/execute`,
        {
          method: "POST",
          body: {
            execution_source: "mcp_generated_test_execution",
            trigger_reason: "human_approved_generated_test",
            ...(environment_id != null ? { environment_id } : {}),
            ...(environment_name ? { environment_name } : {}),
            ...(agentPf.use_agent ? { use_agent: true } : {}),
          },
        }
      );
      const startedExecutionId = extractExecutionIdFromExecuteResponse(response);
      const payload = {
        test_case_id: execId,
        name_resolution: resolved.name_resolution,
        routing: { use_agent: agentPf.use_agent },
        ...(agentPf.agent_wait ? { agent_wait: agentPf.agent_wait } : {}),
        ...(agentPf.agent_snapshot ? { agent_preflight: agentPf.agent_snapshot } : {}),
        ...(startedExecutionId
          ? { ui_navigation: buildExecutionUiNavigationForClient(client, startedExecutionId) }
          : {}),
        response,
      };
      if (idem.key && idem.fingerprint) recordIdempotency(idem.key, idem.fingerprint, JSON.stringify(payload));
      return result(asText(payload));
    }
  );

  registerTracedTool(
    "testneo_run_generated_test_pipeline",
    {
      description:
        "End-to-end: execute a generated test by test_case_id OR (project_id + name_query), poll until terminal, return analytics summary + step-level execution, optional failure triage bundle, and project pass/fail trend. POST /api/web/v1/test-cases/{id}/execute sends use_agent when local+prefer-local (same as testneo_execute_generated_test_case). name_match_mode: auto|exact|substring. Optional wait_for_agent_seconds for preflight.",
      inputSchema: z
        .object({
          test_case_id: z.number().int().positive().optional(),
          project_id: z.number().int().positive().optional(),
          name_query: z.string().min(1).max(500).optional(),
          name_match_mode: z.enum(["auto", "exact", "substring"]).default("auto"),
          confirm: z.boolean().default(false),
          idempotency_key: z.string().min(8).max(128).optional(),
          environment_id: z.number().int().positive().optional(),
          environment_name: z.string().min(1).optional(),
          wait_for_agent_seconds: z.number().int().min(0).max(300).optional(),
          max_polls: z.number().int().min(1).max(120).default(40),
          poll_interval_ms: z.number().int().min(500).max(10000).default(1500),
          include_steps: z.boolean().default(true),
          include_failure_bundle_on_fail: z.boolean().default(true),
          include_project_trend: z.boolean().default(true),
          trend_range: z.enum(["1d", "7d", "30d", "90d"]).default("30d"),
          trend_limit: z.number().int().min(10).max(500).default(200),
          failure_logs_limit: z.number().int().min(20).max(500).default(150),
          failure_event_limit: z.number().int().min(5).max(50).default(20),
          include_nlp_patch_suggestion: z.boolean().default(true),
        })
        .superRefine((data, ctx) => {
          const hasId = data.test_case_id != null && data.test_case_id > 0;
          const hasName = data.project_id != null && data.project_id > 0 && !!data.name_query?.trim();
          if (!hasId && !hasName) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Provide test_case_id OR (project_id + name_query).",
              path: [],
            });
          }
        }),
    },
    async ({
      test_case_id,
      project_id,
      name_query,
      name_match_mode,
      confirm,
      idempotency_key,
      environment_id,
      environment_name,
      max_polls,
      poll_interval_ms,
      include_steps,
      include_failure_bundle_on_fail,
      include_project_trend,
      trend_range,
      trend_limit,
      failure_logs_limit,
      failure_event_limit,
      include_nlp_patch_suggestion,
      wait_for_agent_seconds,
    }) => {
      const resolved = await resolveTestCaseIdForExecuteInput({
        test_case_id,
        project_id,
        name_query,
        name_match_mode,
      });
      if (!resolved.ok) return result(asText(resolved.payload));
      const execId = resolved.test_case_id;

      if (!confirm) {
        return result(
          asText({
            contract_version: "execution_pipeline.v1",
            mode: "preview",
            message:
              "Set confirm=true to run the full pipeline: execute test → wait for completion → return report (analytics_summary, execution with steps, failure_bundle on failure, project_trend).",
            test_case_id: execId,
            name_resolution: resolved.name_resolution,
            requires_env: "TESTNEO_MCP_ALLOW_WRITE=true for execution",
            wait_for_agent_seconds: wait_for_agent_seconds ?? null,
            wait_for_agent_ms_env: batchExecutionDefaults.waitForAgentMs,
          })
        );
      }
      if (!deps.allowWriteTools) {
        return result("Write tools are disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to run the pipeline.");
      }
      const idem = replayOrConflict("testneo_run_generated_test_pipeline", idempotency_key, {
        test_case_id: execId,
        environment_id: environment_id ?? null,
        environment_name: environment_name ?? null,
        max_polls,
        poll_interval_ms,
        include_steps,
        include_failure_bundle_on_fail,
        include_project_trend,
        trend_range,
        trend_limit,
        wait_for_agent_seconds: wait_for_agent_seconds ?? null,
      });
      if (idem.blocked) return idem.blocked;
      const blocked = await gateProjectExecutableFromTestCase(execId, {
        toolName: "testneo_run_generated_test_pipeline",
      });
      if (blocked) return blocked;

      const agentPf = await preflightLocalAgentForSingleTestExecute(
        wait_for_agent_seconds,
        "testneo_mcp_execute_preflight.v1"
      );
      if (!agentPf.proceed) return agentPf.blocked;

      let projectIdFallback: number | undefined;
      if (include_project_trend) {
        try {
          const tc = await client.request<Record<string, unknown>>(
            `/api/web/v1/test-cases/${encodeURIComponent(String(execId))}`
          );
          const pid = tc.project_id ?? tc.projectId;
          const n = typeof pid === "number" ? pid : Number(pid);
          if (Number.isFinite(n) && n > 0) projectIdFallback = n;
        } catch {
          projectIdFallback = undefined;
        }
      }

      const response = await client.request<Record<string, unknown>>(
        `/api/web/v1/test-cases/${encodeURIComponent(String(execId))}/execute`,
        {
          method: "POST",
          body: {
            execution_source: "mcp_generated_test_pipeline",
            trigger_reason: "human_approved_generated_test_pipeline",
            ...(environment_id != null ? { environment_id } : {}),
            ...(environment_name ? { environment_name } : {}),
            ...(agentPf.use_agent ? { use_agent: true } : {}),
          },
        }
      );
      const execution_id = extractExecutionIdFromExecuteResponse(response);
      if (!execution_id) {
        return result(
          asText({
            contract_version: "execution_pipeline.v1",
            error: "Could not read execution_id from execute response",
            test_case_id: execId,
            execute_response: response,
          })
        );
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
        contract_version: "execution_pipeline.v1",
        test_case_id: execId,
        name_resolution: resolved.name_resolution,
        routing: { use_agent: agentPf.use_agent },
        ...(agentPf.agent_wait ? { agent_wait: agentPf.agent_wait } : {}),
        ...(agentPf.agent_snapshot ? { agent_preflight: agentPf.agent_snapshot } : {}),
        execute_response: response,
        pipeline,
      };
      if (idem.key && idem.fingerprint) recordIdempotency(idem.key, idem.fingerprint, JSON.stringify(payload));
      return result(asText(payload));
    }
  );

  registerTracedTool(
    "testneo_update_test_case_nlp",
    {
      description:
        "Update NLP commands for a specific test case ID and return verification snapshot. Optionally rewrites Navigate-to lines using route hardening (same env / route_hardening as generate).",
      inputSchema: z.object({
        test_case_id: z.number().int().positive(),
        nlp_commands: z.array(z.string().min(1)).min(1),
        apply_route_hardening: z.boolean().default(true),
        route_hardening: routeHardeningToolSchema,
        idempotency_key: z.string().min(8).max(128).optional(),
      }),
    },
    async ({ test_case_id, nlp_commands, apply_route_hardening, route_hardening, idempotency_key }) => {
      const routeRuntime = await runtimeForTestCaseRouteMap(test_case_id, deps.routeHardening);
      const routeMap = resolveRouteMap(routeRuntime, route_hardening);
      const hardened = apply_route_hardening ? hardenNavigationCommands(nlp_commands, routeMap) : null;
      const commandsToSave = hardened ? hardened.commands : nlp_commands;
      const idem = replayOrConflict("testneo_update_test_case_nlp", idempotency_key, {
        test_case_id,
        apply_route_hardening,
        commandsToSave,
      });
      if (idem.blocked) return idem.blocked;

      const before = await client.request<Record<string, unknown>>(
        `/api/web/v1/test-cases/${encodeURIComponent(String(test_case_id))}`
      );
      const beforeCommands = extractNlpCommandsFromGeneratedTest(before);

      const updateResp = await client.request<Record<string, unknown>>(
        `/api/web/v1/test-cases/${encodeURIComponent(String(test_case_id))}`,
        {
          method: "PUT",
          body: {
            nlp_commands: commandsToSave,
          },
        }
      );
      const after = await client.request<Record<string, unknown>>(
        `/api/web/v1/test-cases/${encodeURIComponent(String(test_case_id))}`
      );
      const afterCommands = extractNlpCommandsFromGeneratedTest(after);

      const payload = {
        test_case_id,
        update_response: updateResp,
        before_nlp_count: beforeCommands.length,
        after_nlp_count: afterCommands.length,
        route_replacements: hardened?.replacements ?? [],
        updated_nlp_commands: afterCommands,
      };
      if (idem.key && idem.fingerprint) recordIdempotency(idem.key, idem.fingerprint, JSON.stringify(payload));
      return result(asText(payload));
    }
  );

  registerTracedTool(
    "testneo_export_playwright_spec",
    {
      description: "Export a test case as Playwright SDK TypeScript spec text.",
      inputSchema: z.object({
        test_case_id: z.number().int().positive(),
      }),
    },
    async ({ test_case_id }) => {
      const testCase = await client.request<Record<string, unknown>>(
        `/api/web/v1/test-cases/${encodeURIComponent(String(test_case_id))}`
      );
      const nlp = extractNlpCommandsFromGeneratedTest(testCase);
      const name = String(testCase.name ?? `Test Case ${test_case_id}`);
      return result(
        asText({
          test_case_id,
          test_name: name,
          nlp_commands: nlp,
          playwright_spec_ts: buildPlaywrightSpecTs(name, nlp),
        })
      );
    }
  );

  registerTracedTool(
    "testneo_run_playwright_spec_preview",
    {
      description:
        "Run a Playwright SDK spec preview by extracting ai.run commands and executing via Playwright SDK execute endpoint.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        test_name: z.string().min(1),
        playwright_spec_ts: z.string().min(20),
        mode: z.enum(["strict", "balanced", "adaptive"]).default("balanced"),
        confirm: z.boolean().default(false),
        idempotency_key: z.string().min(8).max(128).optional(),
      }),
    },
    async ({ project_id, test_name, playwright_spec_ts, mode, confirm, idempotency_key }) => {
      const nlp_commands = parseNlpFromPlaywrightSpec(playwright_spec_ts);
      if (!nlp_commands.length) {
        return result(
          "No ai.run([...]) commands were parsed from the provided Playwright spec. Ensure script includes ai.run([...], ...)."
        );
      }
      if (!deps.allowWriteTools) {
        return result(
          asText({
            message: "Write tools are disabled. Enable TESTNEO_MCP_ALLOW_WRITE=true to execute.",
            parsed_nlp_commands: nlp_commands,
          })
        );
      }
      if (!confirm) {
        return result(
          asText({
            message: "Preview mode only. Set confirm=true to execute.",
            parsed_nlp_commands: nlp_commands,
          })
        );
      }
      const idem = replayOrConflict("testneo_run_playwright_spec_preview", idempotency_key, {
        project_id,
        test_name,
        mode,
        nlp_commands,
      });
      if (idem.blocked) return idem.blocked;
      const routeRuntime = await runtimeForProjectRouteMap(project_id, deps.routeHardening);
      const routeMap = resolvePhraseToPathMap(routeRuntime);
      const blockedPlay = await gateProjectExecutable(project_id, {
        toolName: "testneo_run_playwright_spec_preview",
        nlpCommands: nlp_commands,
        routeMap,
      });
      if (blockedPlay) return blockedPlay;
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
      if (idem.key && idem.fingerprint) recordIdempotency(idem.key, idem.fingerprint, JSON.stringify(payload));
      return result(asText(payload));
    }
  );

  registerTracedTool(
    "testneo_figma_to_tests_workflow",
    {
      description:
        "End-to-end workflow: ingest Figma -> create unified context -> generate tests -> preview NLP + Playwright drafts.",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        figma_token: z.string().min(10),
        figma_file_id: z.string().min(3),
        context_name: z.string().min(3),
        context_description: z.string().optional(),
        test_types: z.array(z.string().min(1)).default(["positive", "negative", "edge"]),
        max_tests: z.number().int().min(1).max(200).optional(),
        preview_items: z.number().int().min(1).max(10).default(3),
      }),
    },
    async ({
      project_id,
      figma_token,
      figma_file_id,
      context_name,
      context_description,
      test_types,
      max_tests,
      preview_items,
    }) => {
      const blockedProject = await gateProjectExecutable(project_id, {
        toolName: "testneo_figma_to_tests_workflow",
      });
      if (blockedProject) return blockedProject;

      const trace: Array<{ step: string; status: "ok" | "failed"; detail?: string }> = [];
      const connect = await client.request<{ jobId: string; status: string }>(`/api/v1/etl/connect-figma`, {
        method: "POST",
        body: { projectId: project_id, figmaToken: figma_token, fileId: figma_file_id },
      });
      trace.push({ step: "connect_figma", status: "ok", detail: `jobId=${connect.jobId}` });

      const etlJob = await waitForEtlJobCompletion(client, String(connect.jobId), 45, 2000);
      trace.push({ step: "wait_etl_job", status: "ok", detail: `status=${etlJob.status ?? "unknown"}` });

      const context = await client.request<Record<string, unknown>>(
        `/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts`,
        {
          method: "POST",
          body: {
            name: context_name,
            description: context_description || `Figma context for file ${figma_file_id}`,
            context_type: "unified",
            selected_document_ids: [`etl-${connect.jobId}`],
          },
        }
      );
      trace.push({ step: "create_unified_context", status: "ok", detail: `context_id=${context.id ?? "unknown"}` });

      const generation = await client.request<Record<string, unknown>>(
        `/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts/${encodeURIComponent(
          String(context.id)
        )}/generate-tests`,
        {
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
        }
      );
      trace.push({
        step: "generate_tests",
        status: "ok",
        detail: `count=${generation.total_tests_generated ?? 0}`,
      });

      const generated = (generation.generated_test_cases as Array<Record<string, unknown>>) || [];
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

      return result(
        asText({
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
        })
      );
    }
  );

  registerTracedTool(
    "testneo_figma_image_to_tests_workflow",
    {
      description:
        "No Figma token: upload exported UI image (PNG/JPEG/GIF/WebP) like the product 'Upload Figma Image' flow → wait for vision ETL → create unified context → generate tests → preview. Guarded: TESTNEO_MCP_ALLOW_WRITE + confirm=true. Backend: POST /api/web/v1/etl/upload-figma-image (multipart field: file).",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        image_file_base64: z.string().min(1),
        image_filename: z.string().min(1).max(512),
        context_name: z.string().min(3),
        context_description: z.string().optional(),
        figma_json_id: z.string().min(1).optional(),
        enrich_context_id: z.number().int().positive().optional(),
        wait_for_vision: z.boolean().default(true),
        max_polls: z.number().int().min(1).max(120).default(45),
        poll_interval_ms: z.number().int().min(500).max(10000).default(2000),
        test_types: z.array(z.string().min(1)).default(["positive", "negative", "edge"]),
        max_tests: z.number().int().min(1).max(200).optional(),
        preview_items: z.number().int().min(1).max(10).default(3),
        confirm: z.boolean().default(false),
        idempotency_key: z.string().min(8).max(128).optional(),
      }),
    },
    async ({
      project_id,
      image_file_base64,
      image_filename,
      context_name,
      context_description,
      figma_json_id,
      enrich_context_id,
      wait_for_vision,
      max_polls,
      poll_interval_ms,
      test_types,
      max_tests,
      preview_items,
      confirm,
      idempotency_key,
    }) => {
      const fnErr = validateFigmaImageFilename(image_filename);
      if (fnErr) {
        return result(asText({ contract_version: "figma_image_workflow.v1", success: false, error: fnErr }));
      }
      const dec = decodeSwaggerUploadBase64(image_file_base64);
      if (!dec.ok) {
        return result(asText({ contract_version: "figma_image_workflow.v1", success: false, error: dec.error }));
      }
      if (dec.buf.length > MAX_FIGMA_IMAGE_UPLOAD_BYTES) {
        return result(
          asText({
            contract_version: "figma_image_workflow.v1",
            success: false,
            error: `Image exceeds ${MAX_FIGMA_IMAGE_UPLOAD_BYTES} bytes (product limit ~10MB).`,
          })
        );
      }

      const idem = replayOrConflict("testneo_figma_image_to_tests_workflow", idempotency_key, {
        project_id,
        image_sha256: dec.sha256,
        image_filename: image_filename.trim(),
        context_name,
        figma_json_id: figma_json_id ?? null,
        enrich_context_id: enrich_context_id ?? null,
      });
      if (idem.blocked) return idem.blocked;

      if (!deps.allowWriteTools) {
        return result(
          asText({
            contract_version: "figma_image_workflow.v1",
            message: "Write tools disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to upload images and generate tests.",
            project_id,
            image_sha256: dec.sha256,
            image_bytes: dec.buf.length,
          })
        );
      }

      if (!confirm) {
        return result(
          asText({
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
          })
        );
      }

      const blockedProject = await gateProjectExecutable(project_id, {
        toolName: "testneo_figma_image_to_tests_workflow",
      });
      if (blockedProject) return blockedProject;

      const trace: Array<{ step: string; status: "ok" | "failed"; detail?: string }> = [];
      const mime = mimeForImageFilename(image_filename);
      const fileBlob = new Blob([new Uint8Array(dec.buf)], { type: mime });
      const form = new FormData();
      form.append("file", fileBlob, image_filename.trim());

      const qs = new URLSearchParams({ project_id: String(project_id) });
      if (figma_json_id) qs.set("figma_json_id", figma_json_id);
      if (enrich_context_id != null) qs.set("context_id", String(enrich_context_id));

      let upload: Record<string, unknown>;
      try {
        upload = await client.requestMultipart<Record<string, unknown>>(
          `/api/web/v1/etl/upload-figma-image?${qs.toString()}`,
          form,
          client.longRequestTimeoutMs
        );
      } catch (e) {
        const fmt = formatApiFailure(e);
        if (fmt) return fmt;
        throw e;
      }

      const jobIdRaw = upload.jobId ?? upload.job_id;
      const jobId = jobIdRaw != null ? String(jobIdRaw) : "";
      if (!jobId) {
        return result(
          asText({
            contract_version: "figma_image_workflow.v1",
            success: false,
            error: "upload_missing_jobId",
            upload,
          })
        );
      }
      trace.push({ step: "upload_figma_image", status: "ok", detail: `jobId=${jobId}` });

      let etlJob: Record<string, unknown> = { id: jobId, status: upload.status };
      if (wait_for_vision) {
        etlJob = await waitForEtlJobCompletion(client, jobId, max_polls, poll_interval_ms);
        trace.push({ step: "wait_etl_job", status: "ok", detail: `status=${etlJob.status ?? "unknown"}` });
        const st = normalizeStatus(etlJob.status);
        if (st === "failed") {
          return result(
            asText({
              contract_version: "figma_image_workflow.v1",
              trace,
              project_id,
              etl_job: etlJob,
              error: "vision_etl_failed",
              message: String(etlJob.error_message ?? etlJob.detail ?? "ETL job failed"),
            })
          );
        }
      }

      const context = await client.request<Record<string, unknown>>(
        `/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts`,
        {
          method: "POST",
          body: {
            name: context_name,
            description: context_description || `Figma image context for job ${jobId}`,
            context_type: "unified",
            selected_document_ids: [`etl-${jobId}`],
          },
        }
      );
      trace.push({ step: "create_unified_context", status: "ok", detail: `context_id=${context.id ?? "unknown"}` });

      const generation = await client.request<Record<string, unknown>>(
        `/api/v1/web/v1/projects/${encodeURIComponent(String(project_id))}/unified-contexts/${encodeURIComponent(
          String(context.id)
        )}/generate-tests`,
        {
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
        }
      );
      trace.push({
        step: "generate_tests",
        status: "ok",
        detail: `count=${generation.total_tests_generated ?? 0}`,
      });

      const generated = (generation.generated_test_cases as Array<Record<string, unknown>>) || [];
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
      if (idem.key && idem.fingerprint) recordIdempotency(idem.key, idem.fingerprint, wrapped);
      return result(wrapped);
    }
  );

  registerTracedTool(
    "testneo_rerun_failed",
    {
      description: "Rerun failed tests for a project using test-case execute endpoint (guarded write action).",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        limit: z.number().int().min(1).max(20).default(5),
        confirm: z.boolean().default(false),
        range: z.enum(["1d", "7d", "30d", "90d"]).default("30d"),
        idempotency_key: z.string().min(8).max(128).optional(),
      }),
    },
    async ({ project_id, limit, confirm, range, idempotency_key }) => {
      const failed = await fetchRecentExecutionsWithFallback(client, {
        project_id,
        status_filter: "failed",
        range,
        limit: Math.max(limit * 3, 20),
        offset: 0,
      });
      const candidates = Array.from(
        new Map(
          (failed.executions || [])
            .filter((x) => typeof x.test_case_id === "number" && x.test_case_id! > 0)
            .map((x) => [x.test_case_id as number, x])
        ).values()
      ).slice(0, limit);

      if (!deps.allowWriteTools) {
        return result(
          `Write tools are disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to enable rerun actions.\n` +
            `Rerun candidates (${candidates.length}):\n${compactExecution(candidates)}`
        );
      }
      if (!confirm) {
        return result(
          `Rerun preview only (set confirm=true to execute).\n` +
            `Source: ${failed.source}\nCandidates (${candidates.length}):\n${compactExecution(candidates)}`
        );
      }
      const idem = replayOrConflict("testneo_rerun_failed", idempotency_key, {
        project_id,
        limit,
        range,
        candidates: candidates.map((x) => x.test_case_id),
      });
      if (idem.blocked) return idem.blocked;

      const routeRuntime = await runtimeForProjectRouteMap(project_id, deps.routeHardening);
      const routeMap = resolvePhraseToPathMap(routeRuntime);
      const blockedRerun = await gateProjectExecutable(project_id, {
        toolName: "testneo_rerun_failed",
        routeMap,
      });
      if (blockedRerun) return blockedRerun;

      const rerunResults: Array<Record<string, unknown>> = [];
      for (const item of candidates) {
        const testCaseId = item.test_case_id as number;
        try {
          const response = await client.request<Record<string, unknown>>(
            `/api/web/v1/test-cases/${encodeURIComponent(String(testCaseId))}/execute`,
            {
              method: "POST",
              body: {
                execution_source: "mcp_rerun_failed",
                trigger_reason: "rerun_failed_tool",
              },
            }
          );
          rerunResults.push({
            test_case_id: testCaseId,
            previous_execution_id: item.execution_id,
            accepted: true,
            response,
          });
        } catch (error) {
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
      if (idem.key && idem.fingerprint) recordIdempotency(idem.key, idem.fingerprint, JSON.stringify(payload));
      return result(asText(payload));
    }
  );

  registerTracedTool(
    "testneo_trigger_playwright_execution",
    {
      description: "Trigger NLP execution via Playwright SDK execute endpoint (write tool, requires confirm + allow-write).",
      inputSchema: z.object({
        project_id: z.number().int().positive(),
        test_name: z.string().min(1),
        nlp_commands: z.array(z.string().min(1)).min(1),
        mode: z.enum(["strict", "balanced", "adaptive"]).default("balanced"),
        confirm: z.boolean().default(false),
        idempotency_key: z.string().min(8).max(128).optional(),
      }),
    },
    async ({ project_id, test_name, nlp_commands, mode, confirm, idempotency_key }) => {
      if (!deps.allowWriteTools) {
        return result(
          "Write tools are disabled. Set TESTNEO_MCP_ALLOW_WRITE=true to enable trigger actions."
        );
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
      if (idem.blocked) return idem.blocked;
      const routeRuntime = await runtimeForProjectRouteMap(project_id, deps.routeHardening);
      const routeMap = resolvePhraseToPathMap(routeRuntime);
      const blockedTrig = await gateProjectExecutable(project_id, {
        toolName: "testneo_trigger_playwright_execution",
        nlpCommands: nlp_commands,
        routeMap,
      });
      if (blockedTrig) return blockedTrig;
      const response = await client.request("/api/web/v1/playwright-sdk/execute", {
        method: "POST",
        body: {
          test_name,
          project_id,
          nlp_commands,
          options: { mode },
        },
      });
      if (idem.key && idem.fingerprint) recordIdempotency(idem.key, idem.fingerprint, JSON.stringify(response));
      return result(asText(response));
    }
  );
}
