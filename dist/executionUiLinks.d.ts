import type { HttpClient } from "./httpClient.js";
/**
 * Human-facing URLs for the React app (may differ from API `TESTNEO_BASE_URL`, e.g. Vite on :5173).
 * API details stay on the API origin.
 * @see frontend/src/App.jsx — `/test-runner/execution/:executionId`, `/web/test-runner/execution/:executionId`
 */
export declare function buildExecutionUiNavigation(opts: {
    apiOrigin: string;
    appOrigin: string;
    appPathPrefix: string;
}, executionId: string): {
    contract_version: "testneo_mcp_execution_ui.v1";
    origin: string;
    api_origin: string;
    execution_dashboard_url: string;
    executions_list_url: string;
    api_execution_details_url: string;
    note: string;
};
export declare function buildExecutionUiNavigationForClient(client: HttpClient, executionId: string): {
    contract_version: "testneo_mcp_execution_ui.v1";
    origin: string;
    api_origin: string;
    execution_dashboard_url: string;
    executions_list_url: string;
    api_execution_details_url: string;
    note: string;
};
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
export declare function buildMultiTestRunUiNavigation(opts: {
    apiOrigin: string;
    appOrigin: string;
    appPathPrefix: string;
}, projectId: number, testRunId: number | null, runId?: string | null): MultiTestRunUiNavigation;
export declare function buildMultiTestRunUiNavigationForClient(client: HttpClient, projectId: number, testRunId: number | null, runId?: string | null): MultiTestRunUiNavigation;
/** Attach per-test execution dashboard URLs from a completed multi-test results payload. */
export declare function mergeTestExecutionLinksIntoMultiTestNav(nav: MultiTestRunUiNavigation, resultsPayload: Record<string, unknown>, opts: {
    apiOrigin: string;
    appOrigin: string;
    appPathPrefix: string;
}): MultiTestRunUiNavigation;
