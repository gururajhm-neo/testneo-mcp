# TestNeo MCP Tool Reference

The TestNeo MCP server (`packages/testneo-mcp-server`) exposes **37** tools, all prefixed with `testneo_`. This page is the public copy; the package also ships [MCP_TOOL_REFERENCE.md](../packages/testneo-mcp-server/docs/MCP_TOOL_REFERENCE.md) (kept in sync with this file).

**Agent workflows:** `qa_intelligence_workflow`, `triage_failure_workflow`, and `rerun_decision_workflow` are **not** separate tool names. They are values of **`workflow_type`** on **`testneo_run_agent_workflow`** (see [Agent workflow tool](#agent-workflow-tool-testneo_run_agent_workflow)).

## Alphabetical index (all tools)

`testneo_api_project_openapi_impact` · `testneo_api_project_upload_openapi` · `testneo_apply_route_hardening` · `testneo_bootstrap_web_mcp_project` · `testneo_create_web_project` · `testneo_create_web_project_environment` · `testneo_execute_generated_test_case` · `testneo_export_playwright_spec` · `testneo_figma_image_to_tests_workflow` · `testneo_figma_to_tests_workflow` · `testneo_generate_tests_from_context` · `testneo_get_execution_logs` · `testneo_get_execution_status` · `testneo_get_execution_summary` · `testneo_get_failure_bundle` · `testneo_get_pass_fail_trend` · `testneo_get_project_route_map` · `testneo_get_unified_context_by_name` · `testneo_ingest_figma_context` · `testneo_list_projects` · `testneo_list_recent_executions` · `testneo_list_unified_contexts` · `testneo_preview_generated_tests` · `testneo_rerun_failed` · `testneo_run_agent_workflow` · `testneo_run_generated_test_pipeline` · `testneo_run_playwright_spec_preview` · `testneo_search_failures` · `testneo_set_project_route_map` · `testneo_swagger_impact_actions` · `testneo_swagger_impact_analysis` · `testneo_swagger_preview` · `testneo_swagger_upload_and_generate` · `testneo_trigger_playwright_execution` · `testneo_update_test_case_nlp` · `testneo_validate_connection` · `testneo_watch_execution`

## Read/Analysis Tools
- `testneo_validate_connection`
- `testneo_list_projects`
- `testneo_get_project_route_map`
- `testneo_list_recent_executions`
- `testneo_get_execution_status`
- `testneo_get_execution_summary`
- `testneo_get_execution_logs`
- `testneo_search_failures`
- `testneo_get_pass_fail_trend`
- `testneo_watch_execution`
- `testneo_get_failure_bundle`
- `testneo_run_agent_workflow` — multi-step QA workflow over project data; see [Agent workflow tool](#agent-workflow-tool-testneo_run_agent_workflow).

## Context/Test Generation Tools
- `testneo_list_unified_contexts`
- `testneo_get_unified_context_by_name`
- `testneo_ingest_figma_context`
- `testneo_figma_to_tests_workflow` — **Figma API token** path: metadata ingest → context → generate.
- `testneo_figma_image_to_tests_workflow` — **PNG/JPEG export** path (same as product “Upload Figma Image”): multipart upload → vision ETL → unified context → generate (no Figma token).
- `testneo_generate_tests_from_context`
- `testneo_preview_generated_tests`
- `testneo_apply_route_hardening`
- `testneo_set_project_route_map`

## Swagger / OpenAPI intelligence (web + API projects)
- `testneo_swagger_preview` — parse Swagger/OpenAPI from **base64** (read-only).
- `testneo_swagger_upload_and_generate` — **web project**: Swagger + optional business rules → unified context + NLP web tests (multipart; guarded write).
- `testneo_swagger_impact_analysis` — **web project**: diff new spec vs snapshot; list impacted swagger-sourced tests (guarded write; persists spec state).
- `testneo_swagger_impact_actions` — bulk `mark_stale` / `archive` / `keep` after triage (guarded write).
- `testneo_api_project_upload_openapi` — **classic API project**: store OpenAPI on `Project.openapi_spec` (guarded write).
- `testneo_api_project_openapi_impact` — **API project**: OpenAPI impact vs stored or inline spec (guarded write).

Responses include a stable envelope: **`contract_version: swagger_intel.v1`** plus **`kind`** (preview / upload_and_generate / …). Multipart tools use **`TESTNEO_MCP_SWAGGER_TIMEOUT_MS`** (default 120000 ms) instead of the default HTTP timeout.

## Script/Editing Tools
- `testneo_update_test_case_nlp`
- `testneo_export_playwright_spec`
- `testneo_run_playwright_spec_preview`

## Write/Execution Tools (Guarded)

These require write enablement + confirmation where `confirm` is supported:

- `TESTNEO_MCP_ALLOW_WRITE=true`
- `confirm=true` (per tool, when applicable)

| Tool | Notes |
| --- | --- |
| `testneo_create_web_project` | `POST /api/web/v1/projects`; requires **`website_url`**. MCP sends **`create_default_environment`** (default **true**), optional **`initial_environment`**, **`environment_username`** / **`environment_password`**, **`project_environment_name`**, **`base_url_variable_name`** — **single transaction** when the API supports the extended schema. Otherwise create env with **`testneo_create_web_project_environment`**. New projects: **`lighthouse_enabled`** default **true** when the API includes that merge. |
| `testneo_create_web_project_environment` | `POST /api/web/v1/projects/{id}/environments`; **`variables`** array (`base_url`, `username`, `password` with **`is_secret: true`** on password). Use as **fallback** if inline create did not persist env rows. |
| `testneo_bootstrap_web_mcp_project` | Validates → **`POST /api/web/v1/projects`** with optional inline default env + **`base_url`** (and optional credentials) when **`add_base_url_variable`** is true; returns **`contract_version: web_project_bootstrap.v1`**. |
| `testneo_execute_generated_test_case` | Optional **`environment_id`** / **`environment_name`**. |
| `testneo_run_generated_test_pipeline` | Preferred full run + report (`contract_version: execution_pipeline.v1`). Same env options. |
| `testneo_rerun_failed` | |
| `testneo_trigger_playwright_execution` | Raw NLP → SDK execute. |
| `testneo_set_project_route_map` | Persists `project_settings.mcp_route_hardening`. |
| `testneo_figma_image_to_tests_workflow` | **Image upload** (base64 + filename): same pipeline as UI “Upload Figma Image”; requires long timeouts for vision. |
| `testneo_swagger_upload_and_generate` | Multipart upload path for large specs. |
| `testneo_swagger_impact_analysis` | Persists spec snapshot state for diffing. |
| `testneo_swagger_impact_actions` | Bulk stale/archive/keep after triage. |
| `testneo_api_project_upload_openapi` | Classic API project OpenAPI storage. |
| `testneo_api_project_openapi_impact` | Impact vs stored or inline spec. |
| `testneo_update_test_case_nlp` | |
| `testneo_run_playwright_spec_preview` | |

**Mutating but no `confirm` flag:** `testneo_ingest_figma_context` and **`testneo_figma_to_tests_workflow`** (Figma token path) perform ETL and server-side generation without the same `confirm` gate as execute tools. **`testneo_figma_image_to_tests_workflow`** uses **`confirm=true`** like Swagger upload. Use only with intentional credentials and project scope.

Tools not listed here are read-only or compose reads (e.g. `testneo_preview_generated_tests`, `testneo_apply_route_hardening`, `testneo_swagger_preview`).

---

## Agent workflow tool (`testneo_run_agent_workflow`)

**Read-only orchestration** over existing executions: never starts new runs or calls **`testneo_rerun_failed`** by itself. Use **`testneo_run_generated_test_pipeline`** / **`testneo_execute_generated_test_case`** after you approve execution.

| `workflow_type` | Purpose |
| --- | --- |
| `qa_intelligence_workflow` | Pass/fail volume, **`latest_failed_execution_ids`**, **`triage_bundles`** (failure bundles + NLP patch hints), **`recurring_themes`**, **`rerun_plan_preview`**. |
| `triage_failure_workflow` | **`triage_bundles`** + **`recurring_themes`** for the top failed runs (no high-level **`execution_summary`** block). |
| `rerun_decision_workflow` | **`pass_rate_percent`**, failed count, **`rerun_plan_preview`** only — skips building **`triage_bundles`**. |

**Inputs:** `project_id` (required); `range`: `1d` \| `7d` \| `30d` \| `90d` (default `30d`); `top_failures` 1–5 (default 2); `rerun_limit` 1–20 (default 3).

---

## Response telemetry (`_telemetry`)

Every MCP tool invocation is wrapped with timing and backend-call tracing. On **JSON-shaped** responses, the payload includes a merged top-level **`_telemetry`** object (any prior `_telemetry` from upstream is replaced):

| Field | Meaning |
| --- | --- |
| `request_id` | Stable UUID for this tool run (support correlation). |
| `tool` | MCP tool name. |
| `duration_ms` | Wall time for the handler, milliseconds. |
| `backend_paths` | Ordered list of backend HTTP calls as **`METHOD path`** (from the MCP server’s configured API base URL). |
| `project_id` | Best-effort project dimension (derived from tool input when available). |
| `tenant_id` | Reserved tenant dimension (currently nullable unless populated by future integration). |
| `telemetry_schema_version` | Schema marker (`mcp_telemetry.v1`). |

If the handler returns plain text that is **not** parseable JSON, telemetry is appended as a trailing JSON block labeled `_mcp.telemetry (JSON)`.

For centralized monitoring, set MCP env **`TESTNEO_MCP_TELEMETRY_JSONL=true`** to emit one JSON line per tool invocation to stderr (same correlation fields + `outcome` and optional `error_message`), suitable for log shippers (Vector/Fluent Bit/Loki/SigNoz pipelines).

---

## Execution-intelligence contract normalization

Execution-oriented MCP outputs now include a stable envelope for deterministic agent parsing:

- `contract_version: "execution_intelligence.v1"` on normalized execution/status tools.
- Canonical status fields:
  - `canonical_status` per execution/summary (`queued | running | passed | failed | cancelled | unknown`)
  - `raw_status` preserved for backend debugging.
- Tools aligned to this envelope include:
  - `testneo_list_recent_executions`
  - `testneo_get_execution_status`
  - `testneo_get_execution_summary`
  - `testneo_search_failures`
  - `testneo_get_pass_fail_trend` (preview rows include `canonical_status`)
  - `testneo_watch_execution` (`final_canonical_status` + timeline canonical statuses)
  - `testneo_run_generated_test_pipeline` (`pipeline.analytics_summary`, `pipeline.execution`, embedded watch timeline)

This reduces downstream prompt/parser drift when backend status strings vary (`completed`, `success`, `error`, etc.).

---

## Failure bundle: NLP patch suggestion (`suggested_nlp_patch`)

**`testneo_get_failure_bundle`** accepts **`include_nlp_patch_suggestion`** (default **`true`**). When enabled, the server may fetch baseline NLP for the failing test case and attach **`suggested_nlp_patch`** with:

- **`unified_diff`** — line-oriented before/after for quick review.
- **`proposed_nlp_commands`** — full suggested NLP list.
- **`testneo_update_test_case_nlp`** — ready-to-call arguments when **`test_case_id`** is known; otherwise **`null`** (use **`proposed_nlp_commands`** as a template).

**`testneo_run_agent_workflow`** — for **`triage_failure_workflow`** and **`qa_intelligence_workflow`**, enriches each built failure bundle the same way. **`rerun_decision_workflow`** does not build **`triage_bundles`**.

Heuristics are conservative (route hardening, optional short wait for timeout themes); always review before applying **`testneo_update_test_case_nlp`**.

---

## Project execution preconditions (executable base URL)

**Default:** before **`testneo_generate_tests_from_context`**, **`testneo_figma_to_tests_workflow`**, and any **confirmed** execution on **`testneo_execute_generated_test_case`**, **`testneo_run_generated_test_pipeline`**, **`testneo_run_playwright_spec_preview`**, **`testneo_rerun_failed`**, or **`testneo_trigger_playwright_execution`**, the server loads the project (and, if needed, **web environments**) and requires a resolvable **http(s)** base URL. Failures return JSON with **`error: "project_precondition_failed"`**, **`precondition_code`**, and **`remediation`** (agent-actionable).

**Escape hatch (not for prod):** **`TESTNEO_MCP_RELAX_PROJECT_PRECONDITIONS=true`**.

### Precondition Policies v2

Write/execute surfaces now run a policy layer and may return:
- `error: "policy_failed"`
- `policy_mode` (`strict`/`warn`)
- `findings[]` with `code`, `severity`, `message`, and `remediation`

Current policy checks include:
- executable base URL readiness
- auth credentials presence when login-like commands are detected
- route-map coverage warnings/blockers for unresolved Navigate phrases
- checkout data prerequisite warnings/blockers (checkout flow with no add-to-cart signal)
- weak assertion coverage warning (no verify/assert/expect)

Config:
- `TESTNEO_MCP_POLICY_MODE=strict` (default) or `warn`

---

## Project-scoped route map (`project_settings.mcp_route_hardening`)

- **`testneo_get_project_route_map`** reads project settings and reports both stored and effective route-hardening config.
- **`testneo_set_project_route_map`** updates `project_settings.mcp_route_hardening` (requires write enablement; use `confirm=true` to apply).
- Effective precedence during generation/update flows is:
  1. MCP env defaults (`TESTNEO_ROUTE_PROFILE`, `TESTNEO_ROUTE_MAP_JSON`)
  2. Project-scoped route map (`project_settings.mcp_route_hardening`)
  3. Per-call `route_hardening` override

This keeps a team-level source of truth without relying on each developer machine env.

---

## Idempotency for write tools

Write tools accept optional `idempotency_key` (string). Behavior:
- Same key + same effective input => replay cached response (`replayed: true`)
- Same key + different effective input => `error: "idempotency_conflict"`
- No key => normal behavior (no replay protection)

Recommended for retries from CI agents and orchestrated prompts.

---

## Example Inputs

### `testneo_get_failure_bundle`
```json
{
  "execution_id": "abc123def456",
  "logs_limit": 150,
  "event_limit": 20,
  "include_nlp_patch_suggestion": true
}
```

### `testneo_get_pass_fail_trend`
```json
{
  "project_id": 47,
  "range": "30d",
  "limit": 200
}
```

### `testneo_run_agent_workflow`
```json
{
  "workflow_type": "qa_intelligence_workflow",
  "project_id": 47,
  "range": "30d",
  "top_failures": 2,
  "rerun_limit": 3
}
```

### `testneo_generate_tests_from_context`

Do **not** scrape numeric ids from the UI when you have a label: call **`testneo_get_unified_context_by_name`** with **`name_query`** (e.g. `"figma checkout"` for a context named like **`Figma — Checkout flow`**), then pass its **`resolved_context_id`** as the **`context_id`** field below. The sample value **`203`** is illustrative only.

**Generic sites (no SauceDemo login):** omit **`auth_preamble`** entirely — the server does **not** inject `standard_user` / `secret_sauce` lines and does **not** auto-apply the SauceDemo phrase map unless you explicitly pass **`auth_preamble`** with **`preset: "saucedemo"`**. Environment username/password policy for generation is relaxed when SauceDemo is not requested.

**SauceDemo demos only:**

```json
{
  "project_id": 47,
  "context_id": 203,
  "auth_preamble": {
    "enabled": true,
    "preset": "saucedemo"
  },
  "persist_auth_preamble": true,
  "persist_route_hardening": true,
  "auto_align_saucedemo_route_map": true
}
```

**Public or custom-login app (omit `auth_preamble`):**

```json
{
  "project_id": 47,
  "context_id": 203,
  "auto_align_saucedemo_route_map": false
}
```

With **`auto_align_saucedemo_route_map`** **`true`** **and** explicit SauceDemo **`auth_preamble`**, MCP applies the SauceDemo phrase map when env has **`TESTNEO_ROUTE_PROFILE=none`** and no **`TESTNEO_ROUTE_MAP_JSON`**. For other apps, set **`auto_align_saucedemo_route_map: false`** or supply **`TESTNEO_ROUTE_MAP_JSON`** / **`testneo_set_project_route_map`** for Navigate phrase → path. See [Non–Sauce Demo sites](./mcp-non-saucedemo-testing.md).

### `testneo_list_unified_contexts`
```json
{
  "project_id": 47,
  "compact": true,
  "max_compact_lines": 60
}
```

### `testneo_get_unified_context_by_name`

Matches names like **`Figma — Checkout flow`** when you query `"figma checkout"`. Use **`prefer_context_id`** only if several rows tie.

```json
{
  "project_id": 47,
  "name_query": "figma checkout",
  "match_mode": "auto",
  "prefer_context_id": 203,
  "include_detail": false
}
```

### `testneo_run_generated_test_pipeline`

```json
{
  "test_case_id": 7708,
  "confirm": true,
  "environment_name": "uat",
  "idempotency_key": "run-7708-2026-05-10"
}
```

### `testneo_execute_generated_test_case`
```json
{
  "test_case_id": 7708,
  "confirm": true
}
```

