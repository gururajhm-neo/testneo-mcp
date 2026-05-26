import type { HttpClient } from "./httpClient.js";

/** Join SPA origin, optional prefix (`/web`), and a path like `test-runner/execution/:id`. */
function joinWebAppPath(appOrigin: string, pathPrefix: string, relativePath: string): string {
  const o = appOrigin.replace(/\/+$/, "");
  const pre = (pathPrefix || "").replace(/\/+$/, "").replace(/^\/+/, "");
  const path = relativePath.replace(/^\/+/, "");
  if (!pre) return `${o}/${path}`;
  return `${o}/${pre}/${path}`;
}

/**
 * Human-facing URLs for the React app (may differ from API `TESTNEO_BASE_URL`, e.g. Vite on :5173).
 * API details stay on the API origin.
 * @see frontend/src/App.jsx — `/test-runner/execution/:executionId`, `/web/test-runner/execution/:executionId`
 */
export function buildExecutionUiNavigation(
  opts: { apiOrigin: string; appOrigin: string; appPathPrefix: string },
  executionId: string
): {
  contract_version: "testneo_mcp_execution_ui.v1";
  origin: string;
  api_origin: string;
  execution_dashboard_url: string;
  executions_list_url: string;
  api_execution_details_url: string;
  note: string;
} {
  const apiOrigin = opts.apiOrigin.replace(/\/+$/, "");
  const appOrigin = opts.appOrigin.replace(/\/+$/, "");
  const prefix = opts.appPathPrefix || "";
  const enc = encodeURIComponent(executionId);
  const relExec = `test-runner/execution/${enc}`;
  return {
    contract_version: "testneo_mcp_execution_ui.v1",
    origin: appOrigin,
    api_origin: apiOrigin,
    execution_dashboard_url: joinWebAppPath(appOrigin, prefix, relExec),
    executions_list_url: joinWebAppPath(appOrigin, prefix, "test-runner/executions"),
    api_execution_details_url: `${apiOrigin}/api/web/v1/executions/details/${enc}`,
    note:
      "Open execution_dashboard_url in a browser while logged in for full steps, screenshots, and video. " +
      "When TESTNEO_BASE_URL points at the local API (:8001) and TESTNEO_WEB_APP_URL is unset, links default to the Vite dev origin (:5173). " +
      "Set TESTNEO_WEB_APP_URL / TESTNEO_WEB_APP_PATH_PREFIX (e.g. /web) if your UI lives elsewhere. " +
      "Local-agent runs may show analytics/MCP as still running until the app syncs; the dashboard is the source of truth.",
  };
}

export function buildExecutionUiNavigationForClient(client: HttpClient, executionId: string) {
  return buildExecutionUiNavigation(
    {
      apiOrigin: client.getBaseUrl(),
      appOrigin: client.getWebAppBaseUrl(),
      appPathPrefix: client.getWebAppPathPrefix(),
    },
    executionId
  );
}

function joinWebAppPathWithQuery(
  appOrigin: string,
  pathPrefix: string,
  relativePath: string,
  query: Record<string, string | number | undefined | null>
): string {
  const base = joinWebAppPath(appOrigin, pathPrefix, relativePath);
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    qs.set(key, String(value));
  }
  const q = qs.toString();
  return q ? `${base}?${q}` : base;
}

export type MultiTestRunUiNavigation = {
  contract_version: "testneo_mcp_multi_test_run_ui.v1";
  origin: string;
  api_origin: string;
  project_id: number;
  test_run_id: number | null;
  run_id: string | null;
  /** Multi Test Runner (batch tab) — live progress and aggregated results. */
  multi_test_runner_url: string;
  /** Project test-case management (where API chain scan often starts). */
  project_manage_url: string;
  executions_list_url: string;
  multi_test_status_api_url: string | null;
  multi_test_results_api_url: string | null;
  /** Per-case execution dashboards when results are available. */
  test_execution_links: Array<{
    test_case_id: number;
    test_case_name: string | null;
    execution_id: string;
    execution_dashboard_url: string;
  }>;
  note: string;
};

export function buildMultiTestRunUiNavigation(
  opts: { apiOrigin: string; appOrigin: string; appPathPrefix: string },
  projectId: number,
  testRunId: number | null,
  runId?: string | null
): MultiTestRunUiNavigation {
  const apiOrigin = opts.apiOrigin.replace(/\/+$/, "");
  const appOrigin = opts.appOrigin.replace(/\/+$/, "");
  const prefix = opts.appPathPrefix || "";
  const tr =
    testRunId != null && Number.isFinite(testRunId) && testRunId > 0 ? Math.floor(testRunId) : null;

  return {
    contract_version: "testneo_mcp_multi_test_run_ui.v1",
    origin: appOrigin,
    api_origin: apiOrigin,
    project_id: projectId,
    test_run_id: tr,
    run_id: runId?.trim() ? runId.trim() : null,
    multi_test_runner_url: joinWebAppPathWithQuery(appOrigin, prefix, "test-runner", {
      projectId,
      ...(tr != null ? { testRunId: tr } : {}),
    }),
    project_manage_url: joinWebAppPath(appOrigin, prefix, `projects/${projectId}/manage`),
    executions_list_url: joinWebAppPath(appOrigin, prefix, "test-runner/executions"),
    multi_test_status_api_url: tr != null ? `${apiOrigin}/api/web/v1/multi-test-runs/${tr}/status` : null,
    multi_test_results_api_url: tr != null ? `${apiOrigin}/api/web/v1/multi-test-runs/${tr}/results` : null,
    test_execution_links: [],
    note:
      "Open multi_test_runner_url in a browser while logged in to watch batch/API-chain progress and open per-test execution dashboards. " +
      "When TESTNEO_BASE_URL is local (:8001) and TESTNEO_WEB_APP_URL is unset, links use the Vite dev origin (:5173). " +
      "Set TESTNEO_WEB_APP_URL / TESTNEO_WEB_APP_PATH_PREFIX (e.g. /web) if your UI lives elsewhere.",
  };
}

export function buildMultiTestRunUiNavigationForClient(
  client: HttpClient,
  projectId: number,
  testRunId: number | null,
  runId?: string | null
): MultiTestRunUiNavigation {
  return buildMultiTestRunUiNavigation(
    {
      apiOrigin: client.getBaseUrl(),
      appOrigin: client.getWebAppBaseUrl(),
      appPathPrefix: client.getWebAppPathPrefix(),
    },
    projectId,
    testRunId,
    runId
  );
}

/** Attach per-test execution dashboard URLs from a completed multi-test results payload. */
export function mergeTestExecutionLinksIntoMultiTestNav(
  nav: MultiTestRunUiNavigation,
  resultsPayload: Record<string, unknown>,
  opts: { apiOrigin: string; appOrigin: string; appPathPrefix: string }
): MultiTestRunUiNavigation {
  const rows = resultsPayload.results;
  if (!Array.isArray(rows) || !rows.length) return nav;

  const links: MultiTestRunUiNavigation["test_execution_links"] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;
    const nested = row.result && typeof row.result === "object" && !Array.isArray(row.result)
      ? (row.result as Record<string, unknown>)
      : null;
    const executionId =
      (typeof row.execution_id === "string" && row.execution_id) ||
      (nested && typeof nested.execution_id === "string" ? nested.execution_id : null);
    if (!executionId) continue;
    const tcId = row.test_case_id;
    const testCaseId = typeof tcId === "number" ? tcId : Number(tcId);
    if (!Number.isFinite(testCaseId)) continue;
    const nameRaw = row.test_case_name ?? nested?.test_case_name;
    links.push({
      test_case_id: testCaseId,
      test_case_name: typeof nameRaw === "string" ? nameRaw : null,
      execution_id: executionId,
      execution_dashboard_url: buildExecutionUiNavigation(opts, executionId).execution_dashboard_url,
    });
  }

  return links.length ? { ...nav, test_execution_links: links } : nav;
}
