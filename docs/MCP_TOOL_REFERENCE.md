# TestNeo MCP Tool Reference

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
- `testneo_run_agent_workflow`

## Context/Test Generation Tools
- `testneo_list_unified_contexts`
- `testneo_get_unified_context_by_name`
- `testneo_ingest_figma_context`
- `testneo_generate_tests_from_context`
- `testneo_preview_generated_tests`
- `testneo_apply_route_hardening`
- `testneo_figma_to_tests_workflow`
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
- `testneo_execute_generated_test_case` — optional **`environment_id`** / **`environment_name`** to resolve `{{variables}}` from that web project environment.
- `testneo_run_generated_test_pipeline` — **execute → poll to terminal → analytics summary + steps + optional failure bundle + project trend** in one call (`contract_version: execution_pipeline.v1`). Same env options as execute; prefers this over chaining watch/status/summary manually.
- `testneo_rerun_failed`
- `testneo_trigger_playwright_execution`

These require write enablement + confirmation:
- `TESTNEO_MCP_ALLOW_WRITE=true`
- `confirm=true`

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

**`testneo_run_agent_workflow`** (`triage_failure_workflow`, `qa_intelligence_workflow`) enriches each built failure bundle the same way.

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

Prefer obtaining `context_id` from **`testneo_get_unified_context_by_name`** (for example after Figma ingest, name fragment `"figma checkout"`). Below, **`203` is an illustrative resolved id**, not fixed.

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

With **`auto_align_saucedemo_route_map`** left default **`true`** and SauceDemo auth, MCP applies the SauceDemo phrase map whenever env has **`TESTNEO_ROUTE_PROFILE=none`** and no **`TESTNEO_ROUTE_MAP_JSON`**. Set **`false`** to rely only on env + **`route_hardening`** overrides.

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

### `testneo_execute_generated_test_case`
```json
{
  "test_case_id": 7708,
  "confirm": true
}
```

