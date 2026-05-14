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
