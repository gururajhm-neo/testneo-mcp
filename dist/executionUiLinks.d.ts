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
