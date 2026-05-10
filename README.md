# @testneo/mcp-server (v1)

Model Context Protocol (MCP) server for TestNeo quality workflows.

This server exposes TestNeo project/execution tools to MCP-compatible IDE clients (Cursor, Claude Desktop, VS Code MCP clients, etc.).

## Public mirror (MCP Market / GitHub)

The **standalone** open-source mirror used for listings and sharing is:

**https://github.com/gururajhm-neo/testneo-mcp**

This directory is the **source of truth** inside the TestNeo API monorepo. To refresh the public repo after you change this package, run:

```bash
./scripts/sync-public-mcp-repo.sh /path/to/your/local/testneo-mcp-clone
```

Then `git commit` + `git push` from that clone. License: **GPL-3.0** — see `LICENSE`. Security reporting: see `SECURITY.md`.

**Stay in testneo-api (no CI secret on your laptop):** from `packages/testneo-mcp-server` run `./scripts/push-public-mirror-local.sh ~/path/to/testneo-mcp-clone` — uses your normal Git auth. Optional: add secret **`MCP_PUBLIC_MIRROR_PUSH_TOKEN`** on the **testneo-api** GitHub repo only if you want **Actions** to push the mirror after merge to `main` (see `docs/PUBLISHING.md`).

## Responses

- Every tool merges **`_telemetry`** into JSON results: **`request_id`**, **`tool`**, **`duration_ms`**, **`backend_paths`** (`METHOD path` per backend call traced from this process), plus schema marker **`telemetry_schema_version`** and best-effort dimensions (**`project_id`**, nullable **`tenant_id`**).
- **`testneo_get_failure_bundle`** (and triage-heavy **`testneo_run_agent_workflow`** steps) may include **`suggested_nlp_patch`** when **`include_nlp_patch_suggestion`** is true (default). Full tool list and contracts: **`docs/MCP_TOOL_REFERENCE.md`** (kept in sync with the monorepo’s `docs/mcp-tool-reference.md` via `scripts/sync-public-mcp-repo.sh`).
- **Project execution preconditions (default on):** generate and execute-family tools return **`project_precondition_failed`** unless the project resolves a real **http(s)** base URL (`website_url` or environment `base_url`). Rejects **`example.com`** placeholders. Disable only for special cases: **`TESTNEO_MCP_RELAX_PROJECT_PRECONDITIONS=true`**.
- **Execution contract normalization:** execution-intelligence tools emit **`contract_version: execution_intelligence.v1`** and canonical statuses (`queued | running | passed | failed | cancelled | unknown`) while preserving raw backend status.

## v1 scope

Read-heavy tools + guarded write actions:

- `testneo_validate_connection`
- `testneo_list_projects`
- `testneo_get_project_route_map` (read project-level route hardening map/profile)
- `testneo_list_unified_contexts` (browse contexts by name + id)
- `testneo_get_unified_context_by_name` (resolve `context_id` without the UI)
- `testneo_list_recent_executions`
- `testneo_get_execution_status`
- `testneo_get_execution_summary`
- `testneo_get_execution_logs`
- `testneo_get_pass_fail_trend`
- `testneo_watch_execution`
- `testneo_get_failure_bundle`
- `testneo_run_agent_workflow` (`triage_failure_workflow`, `rerun_decision_workflow`, `qa_intelligence_workflow`)
- `testneo_ingest_figma_context` (Figma ETL + unified context creation)
- `testneo_generate_tests_from_context` (unified context -> NLP test generation; optional route hardening)
- `testneo_preview_generated_tests` (human-in-loop preview: NLP + Playwright spec drafts)
- `testneo_apply_route_hardening` (read-only: normalize vague Navigate-to lines using phrase maps)
- `testneo_set_project_route_map` (persist project-level route map/profile; guarded write)
- `testneo_execute_generated_test_case` (guarded execution of approved generated tests)
- `testneo_update_test_case_nlp` (update NLP commands for a generated test)
- `testneo_export_playwright_spec` (export generated test as Playwright SDK `.spec.ts`)
- `testneo_run_playwright_spec_preview` (execute parsed `ai.run` flow from spec draft)
- `testneo_figma_to_tests_workflow` (end-to-end Figma -> Context -> Tests -> Preview)
- `testneo_search_failures`
- `testneo_rerun_failed` (preview by default; execution requires `TESTNEO_MCP_ALLOW_WRITE=true` and `confirm=true`)
- `testneo_trigger_playwright_execution` (requires `TESTNEO_MCP_ALLOW_WRITE=true` and `confirm=true`)
- **Swagger/OpenAPI intelligence**
  - `testneo_swagger_preview` (read-only: parse spec from base64 → tags, endpoint counts)
  - `testneo_swagger_upload_and_generate` (web project: Swagger + optional business rules → context + NLP tests; write + confirm)
  - `testneo_swagger_impact_analysis` / `testneo_swagger_impact_actions` (web: diff vs snapshot, triage actions; write + confirm)
  - `testneo_api_project_upload_openapi` / `testneo_api_project_openapi_impact` (classic API projects; write + confirm)

## Setup

```bash
cd packages/testneo-mcp-server
npm install
npm run build
```

Required env:

- `TESTNEO_BASE_URL` (example: `http://localhost:8001`)
- `TESTNEO_API_KEY`

Optional:

- `TESTNEO_MCP_ALLOW_WRITE=false` (default)
- `TESTNEO_MCP_RELAX_PROJECT_PRECONDITIONS=false` (default) — set `true` only to skip executable-base URL checks on generate/execute tools
- `TESTNEO_MCP_TELEMETRY_JSONL=false` (default) — set `true` to emit one JSON line per tool invocation to stderr (`outcome`, `request_id`, `duration_ms`, `backend_paths`)
- `TESTNEO_MCP_POLICY_MODE=strict` (default) or `warn` — precondition policy behavior (`strict` blocks on blocker findings, `warn` downgrades some checks)
- `TESTNEO_MCP_TIMEOUT_MS=20000`
- `TESTNEO_MCP_SWAGGER_TIMEOUT_MS=120000` (Swagger multipart + heavy OpenAPI impact JSON calls)
- `TESTNEO_MCP_USER_AGENT=@testneo/mcp-server`
- `TESTNEO_ROUTE_HARDENING=true` (default) — set `false` to disable phrase→path rewrites globally
- `TESTNEO_ROUTE_PROFILE=none` (default) or `saucedemo` — optional preset phrase map (not required for other apps)
- `TESTNEO_ROUTE_MAP_JSON` — JSON object of phrase → path (e.g. `{"checkout overview":"/checkout"}`); merged over the preset when profile is `saucedemo`, or used alone when profile is `none`. Paths should start with `/`.

**Generation:** `testneo_generate_tests_from_context` defaults to **`auto_align_saucedemo_route_map=true`**, so Navigate lines get SauceDemo URLs when auth preset is SauceDemo and you have no custom env map (`profile` `none`, empty JSON map).

## Tests (no API)

Runs a production build, then route-hardening, unified-context discovery, and project-precondition classifiers (no HTTP calls to the TestNeo API):

```bash
npm test
```

## Smoke check

```bash
TESTNEO_BASE_URL="http://localhost:8001" TESTNEO_API_KEY="tn_xxx" npm run smoke
```

## Cursor/IDE command

The MCP command should run:

```bash
node /absolute/path/to/testneo-api/packages/testneo-mcp-server/dist/index.js
```

See `docs/IDE_SETUP.md` for config guidance and example prompts.

## Security notes

- API key is only read from environment.
- Write tool is disabled by default.
- Trigger tool requires explicit `confirm=true`.
- Write tools support optional `idempotency_key` to prevent replay/duplicate execution on retries.

## Agentic workflows (Phase 2A)

`testneo_run_agent_workflow` adds an orchestration layer over core tools and returns structured step traces:

- `triage_failure_workflow`: recent failures -> top failure bundles -> recurring themes
- `rerun_decision_workflow`: recent failures -> rerun candidate planning (preview-first)
- `qa_intelligence_workflow`: unified intelligence report (trend + failures + triage + rerun preview)

## Figma-to-tests workflows (Phase 2B)

MCP now supports context-driven generation with human approval:

- Ingest Figma metadata and link ETL output into unified context
- Generate NLP tests from context entities via existing LangGraph pipeline
- Preview generated tests in both NLP and Playwright SDK `.spec.ts` draft format
- Execute approved generated tests through guarded write actions
